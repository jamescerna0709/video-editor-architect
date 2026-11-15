// Borrador: voz en off del reel narrado "finanzas-3d" con tiempos por palabra.
//
// Lee el guion (src/borradores/finanzas/guion.json). Cada escena trae `texto`; las llaves
// {mostrar|decir} juntan varias palabras habladas en un solo subtítulo: `decir` es lo que se
// pronuncia y se alinea, `mostrar` es lo que sale en pantalla.
//
// Dos modos:
//   --tts             sintetiza con Piper TTS (local y gratis) la voz es_MX "ald" (medium). Licencia: el
//                     dataset de Aldo es Unlicense (dominio público) y la voz base davefx es CC0; el repo
//                     rhasspy/piper-voices es MIT. Cada escena se genera aparte, se le recorta el silencio de
//                     las orillas y se juntan con ~0.45 s de silencio. length_scale se ajusta solo para que el
//                     total quede en ~100 s (o fíjalo con --length-scale).
//   --audio <archivo> tu propia voz (cualquier formato que lea ffmpeg), leyendo el guion en orden.
//
// Los dos modos normalizan con ganancia simple (~-16 LUFS, pico de muestra ≤ -1.5 dBFS), escriben el WAV
// final a 48 kHz / 16 bits / mono y alinean las palabras `decir` con herramientas/alinear.py (vía
// herramientas/lib/alineacion.ts). Modelo por defecto: jonatasgrosman/wav2vec2-large-xlsr-53-spanish
// (Apache-2.0, se puede usar en videos publicados). `--modelo mms` usa el MMS forced aligner, que es
// CC-BY-NC-4.0 (solo uso no comercial). Si una palabra no se alinea, su tiempo se interpola.
//
// Salida (por defecto proyectos/2026-11-15-finanzas-3d/voz/, o --salida <carpeta>):
//   narracion.wav, narracion.json ({fuente, licencia_voz?, audio, duracion_s, escenas, palabras}),
//   narracion16k.wav y alineacion.{txt,json} (el crudo del alineador, para revisar).
//
// Requisitos en el .venv del proyecto (uv venv .venv --python 3.12):
//   uv pip install --python .venv/bin/python piper-tts ctc-forced-aligner==1.0.2 unidecode==1.4.0
//   uv pip install --python .venv/bin/python torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
//   uv pip install --python .venv/bin/python transformers==5.18.0
// La voz de Piper se baja una vez (fijada a un commit) a $EDITOR_MODELOS/piper/.
//
// Uso:
//   npx tsx herramientas/borradores/voz-finanzas.ts --tts [--length-scale 1.05] [--salida <dir>]
//   npx tsx herramientas/borradores/voz-finanzas.ts --audio <mi-voz.m4a> [--salida <dir>]
//   opciones: --guion <json> · --modelo xlsr|mms|<id HF> · --objetivo-s 100 · --silencio-s 0.45

import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename, join, relative, resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {alinear, MODELO_MMS, MODELO_XLSR_ES, rutaPython} from '../lib/alineacion.ts';
import {correr, esPrincipal, fallo} from '../lib/fallo.ts';
import {ejecutable, RAIZ_PROYECTO, rutaModelos} from '../lib/plataforma.ts';

const RAIZ = RAIZ_PROYECTO;
const SLUG = '2026-11-15-finanzas-3d';
const GUION_DEF = join(RAIZ, 'src', 'borradores', 'finanzas', 'guion.json');
const SALIDA_DEF = join(RAIZ, 'proyectos', SLUG, 'voz');
const SR = 48000;
const OBJETIVO_LUFS = -16;
const PICO_DBFS = -1.5;

/** Voz de Piper elegida (ver encabezado). El commit fija los archivos que se revisaron. */
const VOZ = {
	id: 'es_MX-ald-medium',
	repo: 'rhasspy/piper-voices',
	revision: '6b9cfaacb4fb2e02a9621227e3c1a48bec9710c3',
	carpeta: 'es/es_MX/ald/medium',
	licencia:
		'Unlicense (dominio público) del dataset https://huggingface.co/datasets/rmcpantoja/Ald_Mexican_Spanish_speech_dataset ; afinada desde es_ES-davefx-medium (CC0); modelo en https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_MX/ald/medium (repo MIT)',
};

// ───────────────────────── guion ─────────────────────────

export interface Ficha {
	mostrar: string;
	decir: string[];
}
export interface Escena {
	id: string;
	/** Texto para el TTS: las llaves ya cambiadas por lo que se dice, con su puntuación. */
	hablado: string;
	fichas: Ficha[];
}

const PUNTUACION = /[¿?¡!.,:;"“”«»()…]/gu;

/** Palabra normal → lo que se muestra/alinea (sin ¿?¡!.,:; y conservando acentos y ñ). */
export function limpiar(palabra: string): string {
	return palabra.replace(PUNTUACION, '').trim();
}

/** Parte el texto de una escena en fichas en pantalla, respetando las llaves {mostrar|decir}. */
export function analizarTexto(texto: string): {hablado: string; fichas: Ficha[]} {
	const fichas: Ficha[] = [];
	const re = /\{([^|{}]+)\|([^{}]+)\}|(\S+)/gu;
	let m: RegExpExecArray | null;
	while ((m = re.exec(texto))) {
		if (m[1] !== undefined) {
			const decir = m[2].split(/\s+/u).map(limpiar).filter(Boolean);
			if (!decir.length) throw fallo('leer el guion', `el grupo {${m[1]}|${m[2]}} no trae palabras que decir`, 'corrige esas llaves en el guion', 2);
			fichas.push({mostrar: m[1].trim(), decir});
		} else {
			// Puntuación pegada a una llave ("{$50|cincuenta}.") llega sola: no es ficha.
			const w = limpiar(m[3]);
			if (w) fichas.push({mostrar: w, decir: [w]});
		}
	}
	const hablado = texto.replace(/\{([^|{}]+)\|([^{}]+)\}/gu, (_t, _mostrar, decir: string) => decir.trim()).replace(/\s+/gu, ' ').trim();
	return {hablado, fichas};
}

export function leerGuion(ruta: string): Escena[] {
	if (!existsSync(ruta)) throw fallo('leer el guion', `no existe ${ruta}`, 'revisa la ruta o pásala con --guion', 2);
	let datos: {escenas?: {id?: unknown; texto?: unknown}[]};
	try {
		datos = JSON.parse(readFileSync(ruta, 'utf8'));
	} catch {
		throw fallo('leer el guion', `${ruta} no es un JSON válido`, 'corrige el JSON del guion', 2);
	}
	if (!Array.isArray(datos.escenas) || !datos.escenas.length) throw fallo('leer el guion', 'el guion no trae escenas', 'agrega "escenas": [{id, texto}]', 2);
	return datos.escenas.map((e, j) => {
		if (typeof e.id !== 'string' || typeof e.texto !== 'string') throw fallo('leer el guion', `la escena ${j} no trae id y texto`, 'agrega id y texto a esa escena', 2);
		const {hablado, fichas} = analizarTexto(e.texto);
		if (!fichas.length) throw fallo('leer el guion', `la escena "${e.id}" no trae palabras`, 'escribe su texto', 2);
		return {id: e.id, hablado, fichas};
	});
}

// ───────────────────────── audio ─────────────────────────

function ffmpeg(): string {
	const bin = ejecutable('ffmpeg');
	if (!bin) throw fallo('procesar el audio', 'no encuentro ffmpeg', 'instálalo con npx tsx herramientas/instalar.ts', 2);
	return bin;
}

/** Cualquier audio → Float32 mono a 48 kHz. */
function leerAudio(ruta: string): Float32Array {
	const r = spawnSync(ffmpeg(), ['-v', 'error', '-i', ruta, '-vn', '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {maxBuffer: 1 << 30});
	if (r.status !== 0 || !r.stdout?.length) {
		throw fallo('leer el audio', `ffmpeg no pudo leer ${basename(ruta)}`, 'revisa que el archivo sea un audio o video válido', 2, {stderr: r.stderr?.toString()});
	}
	const b = r.stdout as Buffer;
	return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/** WAV PCM 16 bits mono. */
function escribirWav(ruta: string, x: Float32Array, sr = SR): void {
	const datos = Buffer.alloc(x.length * 2);
	for (let i = 0; i < x.length; i++) datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), i * 2);
	const cab = Buffer.alloc(44);
	cab.write('RIFF', 0);
	cab.writeUInt32LE(36 + datos.length, 4);
	cab.write('WAVE', 8);
	cab.write('fmt ', 12);
	cab.writeUInt32LE(16, 16);
	cab.writeUInt16LE(1, 20);
	cab.writeUInt16LE(1, 22);
	cab.writeUInt32LE(sr, 24);
	cab.writeUInt32LE(sr * 2, 28);
	cab.writeUInt16LE(2, 32);
	cab.writeUInt16LE(16, 34);
	cab.write('data', 36);
	cab.writeUInt32LE(datos.length, 40);
	writeFileSync(ruta, Buffer.concat([cab, datos]));
}

/** Recorta el silencio de las orillas (umbral -45 dBFS en ventanas de 10 ms), dejando `margen` s. */
function recortar(x: Float32Array, margen = 0.04): Float32Array {
	const v = Math.round(SR * 0.01);
	const umbral = 10 ** (-45 / 20);
	const activa = (j: number) => {
		let s = 0;
		for (let i = j; i < Math.min(x.length, j + v); i++) s += x[i] * x[i];
		return Math.sqrt(s / v) > umbral;
	};
	let a = 0;
	while (a < x.length && !activa(a)) a += v;
	let b = x.length - v;
	while (b > a && !activa(b)) b -= v;
	const m = Math.round(SR * margen);
	return x.slice(Math.max(0, a - m), Math.min(x.length, b + v + m));
}

/** Sonoridad integrada (LUFS) con el filtro ebur128 de ffmpeg. */
function medirLufs(x: Float32Array, dir: string): number {
	const tmp = join(dir, 'medir.wav');
	escribirWav(tmp, x);
	const r = spawnSync(ffmpeg(), ['-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64 << 20});
	const m = [...(r.stderr ?? '').matchAll(/I:\s+(-?[\d.]+|-inf)\s+LUFS/gu)].at(-1);
	if (!m || m[1] === '-inf') throw fallo('medir la sonoridad', 'ffmpeg no midió la sonoridad del audio', 'revisa que el audio no esté en silencio', 2, {stderr: r.stderr?.slice(-2000)});
	return Number(m[1]);
}

/** Ganancia simple hacia OBJETIVO_LUFS sin pasar de PICO_DBFS. */
function normalizar(x: Float32Array, dir: string): {y: Float32Array; lufsAntes: number; gananciaDb: number; picoDb: number} {
	const lufsAntes = medirLufs(x, dir);
	let pico = 0;
	for (const v of x) pico = Math.max(pico, Math.abs(v));
	const porLufs = OBJETIVO_LUFS - lufsAntes;
	const porPico = PICO_DBFS - 20 * Math.log10(pico || 1e-9);
	const gananciaDb = Math.min(porLufs, porPico);
	const g = 10 ** (gananciaDb / 20);
	const y = x.map((v) => v * g);
	return {y, lufsAntes, gananciaDb, picoDb: 20 * Math.log10(pico * g)};
}

// ───────────────────────── Piper ─────────────────────────

function python(): string {
	const py = rutaPython();
	if (!existsSync(py)) throw fallo('preparar Python', `no existe ${py}`, 'crea el .venv con uv venv .venv --python 3.12 e instala piper-tts (ver el encabezado de este archivo)', 2);
	return py;
}

/** Baja (una vez) la voz de Piper fijada a su commit y devuelve la ruta del .onnx. */
function rutaVoz(): string {
	const dir = join(rutaModelos(), 'piper', VOZ.id);
	const onnx = join(dir, `${VOZ.id}.onnx`);
	if (existsSync(onnx) && existsSync(`${onnx}.json`)) return onnx;
	mkdirSync(dir, {recursive: true});
	const codigo = [
		'import os, shutil, sys',
		"os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'",
		'from huggingface_hub import hf_hub_download',
		'repo, rev, carpeta, vid, dest = sys.argv[1:6]',
		"for nombre in (f'{vid}.onnx', f'{vid}.onnx.json', 'MODEL_CARD'):",
		'    p = hf_hub_download(repo, f"{carpeta}/{nombre}", revision=rev)',
		'    shutil.copyfile(p, os.path.join(dest, nombre))',
	].join('\n');
	const r = spawnSync(python(), ['-I', '-c', codigo, VOZ.repo, VOZ.revision, VOZ.carpeta, VOZ.id, dir], {encoding: 'utf8', timeout: 15 * 60_000});
	if (r.status !== 0 || !existsSync(onnx)) {
		throw fallo('bajar la voz de Piper', `no pude bajar ${VOZ.id} de Hugging Face`, 'revisa tu conexión y vuelve a correr', 3, {stderr: r.stderr?.slice(-2000)});
	}
	return onnx;
}

function sintetizar(texto: string, onnx: string, lengthScale: number, dir: string, nombre: string): Float32Array {
	const entrada = join(dir, `${nombre}.txt`);
	const wav = join(dir, `${nombre}.wav`);
	writeFileSync(entrada, `${texto}\n`);
	const r = spawnSync(
		python(),
		['-m', 'piper', '-m', onnx, '-i', entrada, '-f', wav, '--length-scale', lengthScale.toFixed(3), '--sentence-silence', '0.25'],
		{encoding: 'utf8', timeout: 10 * 60_000},
	);
	if (r.status !== 0 || !existsSync(wav)) {
		throw fallo('sintetizar la voz', `Piper falló en la escena "${nombre}"`, 'revisa que piper-tts esté instalado en el .venv (uv pip install --python .venv/bin/python piper-tts)', 2, {stderr: r.stderr?.slice(-2000)});
	}
	return recortar(leerAudio(wav));
}

interface Tramo {
	id: string;
	inicio: number;
	fin: number;
}

/** Genera cada escena, ajusta length_scale hacia el objetivo y devuelve el audio unido y sus tramos. */
function narrarTts(escenas: Escena[], dir: string, op: {lengthScale?: number; objetivoS: number; silencioS: number}): {audio: Float32Array; tramos: Tramo[]; lengthScale: number} {
	const onnx = rutaVoz();
	const silencio = Math.round(op.silencioS * SR);
	const generar = (ls: number) => {
		console.log(`Piper ${VOZ.id} · length_scale ${ls.toFixed(3)}…`);
		const partes = escenas.map((e) => sintetizar(e.hablado, onnx, ls, dir, e.id));
		const total = partes.reduce((s, p) => s + p.length, 0) + silencio * (partes.length - 1);
		return {partes, totalS: total / SR};
	};
	let ls = op.lengthScale ?? 1.0;
	let g = generar(ls);
	if (op.lengthScale === undefined) {
		// La duración es casi proporcional a length_scale (el silencio entre escenas no escala).
		for (let k = 0; k < 2 && Math.abs(g.totalS - op.objetivoS) / op.objetivoS > 0.025; k++) {
			const fijo = op.silencioS * (escenas.length - 1);
			ls = Math.max(0.7, Math.min(1.5, ls * ((op.objetivoS - fijo) / (g.totalS - fijo))));
			g = generar(ls);
		}
	}
	const audio = new Float32Array(Math.round(g.totalS * SR));
	const tramos: Tramo[] = [];
	let pos = 0;
	g.partes.forEach((p, j) => {
		audio.set(p, pos);
		tramos.push({id: escenas[j].id, inicio: pos / SR, fin: (pos + p.length) / SR});
		pos += p.length + silencio;
	});
	return {audio, tramos, lengthScale: ls};
}

// ───────────────────────── alineación → fichas ─────────────────────────

const r3 = (x: number) => Math.round(x * 1000) / 1000;

interface Hablada {
	t: string;
	escena: number;
	ficha: number;
	d: number;
	h: number;
	alineada: boolean;
}

/**
 * Tiempos estimados de cada palabra (repartidos por letras dentro de su tramo): solo son la referencia que
 * pide la alineación; con scoreMinimo 0 nunca reemplazan al alineador.
 */
function estimar(escenas: Escena[], tramos: Tramo[]): Hablada[] {
	const salida: Hablada[] = [];
	escenas.forEach((e, ie) => {
		const palabras = e.fichas.flatMap((f, jf) => f.decir.map((t) => ({t, ficha: jf})));
		const letras = palabras.reduce((s, p) => s + p.t.length + 1, 0);
		let c = 0;
		const {inicio, fin} = tramos[ie];
		for (const p of palabras) {
			const d = inicio + ((fin - inicio) * c) / letras;
			c += p.t.length + 1;
			salida.push({t: p.t, escena: ie, ficha: p.ficha, d, h: inicio + ((fin - inicio) * (c - 1)) / letras, alineada: false});
		}
	});
	return salida;
}

/** Rellena por interpolación (proporcional a las letras) las palabras que el alineador no ubicó. */
export function interpolar(palabras: Hablada[], duracionS: number): void {
	const n = palabras.length;
	let j = 0;
	while (j < n) {
		if (palabras[j].alineada) {
			j++;
			continue;
		}
		let k = j;
		while (k < n && !palabras[k].alineada) k++;
		const desde = j > 0 ? palabras[j - 1].h : 0;
		const hasta = k < n ? palabras[k].d : duracionS;
		const letras = palabras.slice(j, k).reduce((s, p) => s + p.t.length + 1, 0);
		let c = 0;
		for (let q = j; q < k; q++) {
			palabras[q].d = desde + ((hasta - desde) * c) / letras;
			c += palabras[q].t.length + 1;
			palabras[q].h = desde + ((hasta - desde) * (c - 1)) / letras;
		}
		j = k;
	}
}

interface PalabraSalida {
	i: number;
	mostrar: string;
	inicio: number;
	fin: number;
	escena: string;
}

/** Junta las palabras habladas en fichas en pantalla y garantiza fin > inicio y orden sin solapes. */
export function aFichas(escenas: Escena[], habladas: Hablada[]): PalabraSalida[] {
	const salida: PalabraSalida[] = [];
	let q = 0;
	escenas.forEach((e, ie) => {
		e.fichas.forEach((f) => {
			const grupo = habladas.slice(q, q + f.decir.length);
			q += f.decir.length;
			if (grupo.length !== f.decir.length || grupo.some((g) => g.escena !== ie)) throw fallo('armar las fichas', 'las palabras alineadas no cuadran con el guion', 'avísame: es un error del script', 1);
			salida.push({i: salida.length, mostrar: f.mostrar, inicio: grupo[0].d, fin: grupo.at(-1)!.h, escena: e.id});
		});
	});
	for (let j = 0; j < salida.length; j++) {
		const p = salida[j];
		if (j > 0) p.inicio = Math.max(p.inicio, salida[j - 1].fin);
		p.fin = Math.max(p.fin, p.inicio + 0.04);
	}
	for (const p of salida) {
		p.inicio = r3(p.inicio);
		p.fin = r3(p.fin);
	}
	return salida;
}

function rutaPublica(rutaWav: string): string {
	const rel = relative(join(RAIZ, 'proyectos'), rutaWav);
	return rel.startsWith('..') ? rutaWav : `p/${rel.split(/[\\/]/u).join('/')}`;
}

// ───────────────────────── principal ─────────────────────────

async function main(): Promise<void> {
	const {values} = parseArgs({
		options: {
			tts: {type: 'boolean', default: false},
			audio: {type: 'string'},
			salida: {type: 'string'},
			guion: {type: 'string'},
			modelo: {type: 'string', default: 'xlsr'},
			'length-scale': {type: 'string'},
			'objetivo-s': {type: 'string', default: '100'},
			'silencio-s': {type: 'string', default: '0.45'},
		},
	});
	if (values.tts === Boolean(values.audio)) {
		throw fallo('elegir el modo', 'falta --tts o --audio <archivo> (uno de los dos)', 'corre con --tts para la voz sintética o --audio <tu-grabación> para tu voz', 2);
	}
	const escenas = leerGuion(resolve(values.guion ?? GUION_DEF));
	const salida = resolve(values.salida ?? SALIDA_DEF);
	mkdirSync(salida, {recursive: true});
	const modelo = values.modelo === 'xlsr' ? MODELO_XLSR_ES : values.modelo === 'mms' ? MODELO_MMS : values.modelo!;
	if (modelo === MODELO_MMS) console.warn('Aviso: el modelo MMS es CC-BY-NC-4.0 (solo uso no comercial).');
	const num = (v: string | undefined, nombre: string, min: number, max: number) => {
		const x = Number(v);
		if (!Number.isFinite(x) || x < min || x > max) throw fallo('leer las opciones', `${nombre} debe ser un número entre ${min} y ${max}`, `corrige ${nombre}`, 2);
		return x;
	};
	const objetivoS = num(values['objetivo-s'], '--objetivo-s', 10, 600);
	const silencioS = num(values['silencio-s'], '--silencio-s', 0, 3);
	const lengthScale = values['length-scale'] === undefined ? undefined : num(values['length-scale'], '--length-scale', 0.5, 2);

	const dir = mkdtempSync(join(tmpdir(), 'voz-finanzas-'));
	try {
		let crudo: Float32Array;
		let tramos: Tramo[];
		let fuente: string;
		let extra: Record<string, unknown> = {};
		if (values.tts) {
			const r = narrarTts(escenas, dir, {lengthScale, objetivoS, silencioS});
			crudo = r.audio;
			tramos = r.tramos;
			fuente = `tts:${VOZ.id}`;
			extra = {licencia_voz: VOZ.licencia};
			console.log(`length_scale final ${r.lengthScale.toFixed(3)}`);
		} else {
			const ruta = resolve(values.audio!);
			if (!existsSync(ruta)) throw fallo('leer tu grabación', `no existe ${ruta}`, 'revisa la ruta del archivo', 2);
			crudo = leerAudio(ruta);
			fuente = `voz-propia:${basename(ruta)}`;
			// Tramo único: las escenas salen de las palabras alineadas.
			tramos = escenas.map((e) => ({id: e.id, inicio: 0, fin: crudo.length / SR}));
		}

		const {y, lufsAntes, gananciaDb, picoDb} = normalizar(crudo, dir);
		const duracionS = y.length / SR;
		const rutaWav = join(salida, 'narracion.wav');
		escribirWav(rutaWav, y);
		const ruta16k = join(salida, 'narracion16k.wav');
		const c = spawnSync(ffmpeg(), ['-v', 'error', '-y', '-i', rutaWav, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', ruta16k]);
		if (c.status !== 0) throw fallo('convertir a 16 kHz', 'ffmpeg no pudo convertir la narración', 'revisa ffmpeg con npx tsx herramientas/doctor.ts', 1, {stderr: c.stderr?.toString()});
		console.log(`Audio: ${duracionS.toFixed(2)} s · ${lufsAntes.toFixed(1)} LUFS → ganancia ${gananciaDb.toFixed(1)} dB · pico ${picoDb.toFixed(1)} dBFS`);

		// En modo --audio no hay tramos por escena: se estima repartiendo todo el audio por letras.
		const estimadas = values.tts
			? estimar(escenas, tramos)
			: estimar([{id: '_', hablado: '', fichas: escenas.flatMap((e) => e.fichas)}], [{id: '_', inicio: 0, fin: duracionS}]);
		if (!values.tts) {
			// Reasigna la escena real de cada palabra.
			let q = 0;
			escenas.forEach((e, ie) => e.fichas.forEach((f) => f.decir.forEach(() => (estimadas[q++].escena = ie))));
		}
		const res = alinear(
			ruta16k,
			estimadas.map((p, i) => ({i, t: p.t, d: p.d, h: p.h})),
			{modelo, idioma: 'spa', scoreMinimo: 0, dirTrabajo: salida, avisar: (m) => m && console.log(m)},
		);
		const habladas: Hablada[] = estimadas.map((p, j) => {
			const a = res.palabras[j];
			return a.alineada ? {...p, d: a.d, h: a.h, alineada: true} : {...p, alineada: false};
		});
		interpolar(habladas, duracionS);
		const palabras = aFichas(escenas, habladas);

		const escenasSalida = escenas.map((e, ie) => {
			const mias = palabras.filter((p) => p.escena === e.id);
			// TTS: el tramo generado (ampliado si el alineador, con cuadros de 20 ms, se sale unos ms).
			if (values.tts) return {id: e.id, inicio: r3(Math.min(tramos[ie].inicio, mias[0].inicio)), fin: r3(Math.max(tramos[ie].fin, mias.at(-1)!.fin))};
			return {id: e.id, inicio: r3(Math.max(0, mias[0].inicio - 0.05)), fin: r3(Math.min(duracionS, mias.at(-1)!.fin + 0.05))};
		});

		const json = {
			fuente,
			...extra,
			audio: rutaPublica(rutaWav),
			duracion_s: r3(duracionS),
			escenas: escenasSalida,
			palabras,
		};
		writeFileSync(join(salida, 'narracion.json'), `${JSON.stringify(json, null, '\t')}\n`);
		const bajas = res.palabras.filter((p) => p.alineada && (p.score ?? 0) < 0.05).length;
		console.log(
			`Listo: ${palabras.length} fichas (${habladas.length} palabras; ${res.sinAlinear} interpoladas, ${bajas} con score < 0.05) · modelo ${modelo} → ${relative(RAIZ, join(salida, 'narracion.json'))}`,
		);
	} finally {
		rmSync(dir, {recursive: true, force: true});
	}
}

if (esPrincipal(import.meta.url)) void correr(main);
