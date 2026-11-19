// Borrador: sintetiza desde cero la música y los efectos del reel "El caso del yapeo fantasma"
// (parodia de detective / true crime). Todo sale de matemática pura: osciladores, envolventes y
// ruido filtrado con un generador pseudoaleatorio con semilla. No descarga nada ni usa muestras,
// así que el audio es original y determinista (misma semilla, mismos archivos).
// Escribe WAV PCM de 16 bits, 48 kHz, estéreo, en proyectos/2026-11-19-alcanza-detective/sonidos/.
// La música sigue las escenas de proyectos/2026-11-19-alcanza-detective/voz/narracion.json.
// Uso: npx tsx herramientas/borradores/sonidos-detective.ts
// (Las utilidades están copiadas de sonidos-finanzas.ts, que corre efectos al importarse.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const TAU = Math.PI * 2;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROYECTO = path.join(RAIZ, 'proyectos', '2026-11-19-alcanza-detective');
const SALIDA = path.join(PROYECTO, 'sonidos');
const NARRACION = path.join(PROYECTO, 'voz', 'narracion.json');

type Estereo = { l: Float32Array; r: Float32Array };

// ---------- utilidades básicas ----------

const muestras = (seg: number) => Math.round(seg * SR);
const midiAHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

function estereo(seg: number): Estereo {
	const n = muestras(seg);
	return { l: new Float32Array(n), r: new Float32Array(n) };
}

/** PRNG mulberry32: rápido, con semilla y reproducible. */
function prng(semilla: number): () => number {
	let a = semilla >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Genera una voz mono llamando a fn(t) en orden (fn puede guardar estado: fase, filtros). */
function voz(seg: number, fn: (t: number) => number): Float32Array {
	const v = new Float32Array(Math.max(0, muestras(seg)));
	for (let i = 0; i < v.length; i++) v[i] = fn(i / SR);
	return v;
}

/** Suma una voz mono a un buffer estéreo en t0, con paneo de potencia constante (-1..1). */
function mezclar(dest: Estereo, v: Float32Array, t0: number, pan = 0, ganancia = 1): void {
	const i0 = muestras(t0);
	const a = ((pan + 1) * Math.PI) / 4;
	const gl = Math.cos(a) * Math.SQRT2 * ganancia;
	const gr = Math.sin(a) * Math.SQRT2 * ganancia;
	for (let i = 0; i < v.length; i++) {
		const j = i0 + i;
		if (j < 0) continue;
		if (j >= dest.l.length) break;
		dest.l[j] += v[i] * gl;
		dest.r[j] += v[i] * gr;
	}
}

/** Oscilador senoidal con fase acumulada (sirve para frecuencias que cambian). */
function oscilador(): (f: number) => number {
	let fase = 0;
	return (f) => {
		fase = (fase + f / SR) % 1;
		return Math.sin(TAU * fase);
	};
}

/** Pasa-bajos de un polo con corte variable. */
function pasaBajos(): (x: number, fc: number) => number {
	let y = 0;
	return (x, fc) => {
		y += (1 - Math.exp((-TAU * fc) / SR)) * (x - y);
		return y;
	};
}

/** Pasa-banda biquad (RBJ, ganancia 0 dB en el centro) con centro y Q variables. */
function pasaBanda(): (x: number, fc: number, q: number) => number {
	let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	return (x, fc, q) => {
		const w0 = (TAU * Math.min(fc, SR * 0.45)) / SR;
		const alfa = Math.sin(w0) / (2 * q);
		const a0 = 1 + alfa;
		const y = (alfa * x - alfa * x2 + 2 * Math.cos(w0) * y1 - (1 - alfa) * y2) / a0;
		x2 = x1; x1 = x;
		y2 = y1; y1 = y;
		return y;
	};
}

const ataque = (t: number, seg: number) => 1 - Math.exp(-t / (seg / 5));
/** Envolvente con ataque lineal y salida lineal antes de `seg` (nunca corta en seco). */
const ventana = (t: number, seg: number, a = 0.003, s = 0.03) => Math.max(0, Math.min(1, t / a, (seg - t) / s));

function normalizar(b: Estereo, dbfs: number): void {
	let pico = 0;
	for (let i = 0; i < b.l.length; i++) pico = Math.max(pico, Math.abs(b.l[i]), Math.abs(b.r[i]));
	if (pico === 0) return;
	const g = 10 ** (dbfs / 20) / pico;
	for (let i = 0; i < b.l.length; i++) {
		b.l[i] *= g;
		b.r[i] *= g;
	}
}

/** Fundidos de entrada y salida (coseno) para evitar clics en los bordes. */
function fundidos(b: Estereo, entrada: number, salida: number): void {
	const n = b.l.length;
	const ne = muestras(entrada), ns = muestras(salida);
	for (let i = 0; i < ne && i < n; i++) {
		const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / ne);
		b.l[i] *= g;
		b.r[i] *= g;
	}
	for (let i = 0; i < ns && i < n; i++) {
		const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / ns);
		b.l[n - 1 - i] *= g;
		b.r[n - 1 - i] *= g;
	}
}

function escribirWav(nombre: string, b: Estereo, carpeta = SALIDA): void {
	const n = b.l.length;
	const datos = n * 4;
	const buf = Buffer.alloc(44 + datos);
	buf.write('RIFF', 0, 'ascii');
	buf.writeUInt32LE(36 + datos, 4);
	buf.write('WAVE', 8, 'ascii');
	buf.write('fmt ', 12, 'ascii');
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20); // PCM
	buf.writeUInt16LE(2, 22); // canales
	buf.writeUInt32LE(SR, 24);
	buf.writeUInt32LE(SR * 4, 28); // bytes por segundo
	buf.writeUInt16LE(4, 32); // bytes por cuadro
	buf.writeUInt16LE(16, 34); // bits
	buf.write('data', 36, 'ascii');
	buf.writeUInt32LE(datos, 40);
	const a16 = (x: number) => Math.round(Math.max(-1, Math.min(1, x)) * 32767);
	for (let i = 0; i < n; i++) {
		buf.writeInt16LE(a16(b.l[i]), 44 + i * 4);
		buf.writeInt16LE(a16(b.r[i]), 46 + i * 4);
	}
	fs.writeFileSync(path.join(carpeta, nombre), buf);
	console.log(`${nombre.padEnd(20)} ${(n / SR).toFixed(3)} s`);
}

/** Cierra un efecto: pico a -1 dBFS, fundidos cortos y escritura. */
function guardarSfx(nombre: string, b: Estereo, entrada = 0.002, salida = 0.012): void {
	fundidos(b, entrada, salida);
	normalizar(b, -1);
	escribirWav(nombre, b);
}

// ---------- piezas reutilizables ----------

/** "Cling" metálico: parciales inarmónicos con caída exponencial (más agudos, más rápidos). */
function cling(base: number, seg: number, rng: () => number): Float32Array {
	const parciales: [number, number, number][] = [
		[1, 1, 7], [1.47, 0.6, 9], [2.09, 0.45, 12], [2.56, 0.3, 15], [3.21, 0.15, 22],
	];
	const fases = parciales.map(() => rng());
	const brillo = pasaBajos();
	return voz(seg, (t) => {
		let s = 0;
		parciales.forEach(([r, a, d], k) => {
			const f = base * r;
			if (f < 18000) s += a * Math.sin(TAU * (f * t + fases[k])) * Math.exp(-d * t);
		});
		s += 0.4 * Math.sin(TAU * base * 1.006 * t) * Math.exp(-6 * t);
		const golpecito = (rng() * 2 - 1) * Math.exp(-t / 0.0015);
		s += 0.5 * (golpecito - brillo(golpecito, 3000));
		return s * ataque(t, 0.0008);
	});
}

/** Campana brillante. */
function campana(f: number, seg: number, caida = 3): Float32Array {
	const parciales: [number, number, number][] = [
		[1, 1, caida], [2, 0.5, caida * 1.6], [3.01, 0.25, caida * 2.4], [4.17, 0.15, caida * 3.5],
	];
	return voz(seg, (t) => {
		let s = 0;
		for (const [r, a, d] of parciales) if (f * r < 18000) s += a * Math.sin(TAU * f * r * t) * Math.exp(-d * t);
		return s * ataque(t, 0.001);
	});
}

/** Golpe grave: seno con caída de tono + ruido grave corto. */
function thump(rng: () => number, fBase = 45, fExtra = 110, cuerpo = 0.07, seg = 0.3): Float32Array {
	const osc = oscilador();
	const lp = pasaBajos();
	return voz(seg, (t) => {
		const f = fBase + fExtra * Math.exp(-t / 0.025);
		const tono = osc(f) * Math.exp(-t / cuerpo);
		const ruido = lp(rng() * 2 - 1, 700) * Math.exp(-t / 0.012) * 1.5;
		return Math.tanh(1.5 * (tono + ruido)) * ataque(t, 0.0015);
	});
}

/** Clic resonante (madera / mecanismo): ruido muy corto por un pasa-banda + un tono de cuerpo. */
function clic(rng: () => number, fc: number, q: number, caida: number, seg = 0.06, cuerpoHz = 0): Float32Array {
	const bp = pasaBanda();
	return voz(seg, (t) => {
		const exc = (rng() * 2 - 1) * Math.exp(-t / 0.0008);
		let s = bp(exc, fc, q) * 4 * Math.exp(-t / caida);
		if (cuerpoHz) s += 0.35 * Math.sin(TAU * cuerpoHz * t) * Math.exp(-t / (caida * 1.5));
		return s * ventana(t, seg, 0.0003, 0.005);
	});
}

/** Latido: "lub" grave y redondo. */
function lub(rng: () => number, f0 = 52, cuerpo = 0.09): Float32Array {
	const osc = oscilador();
	const lp = pasaBajos();
	return voz(0.35, (t) => {
		const f = f0 + 30 * Math.exp(-t / 0.03);
		const tono = osc(f) * Math.exp(-t / cuerpo);
		const ruido = lp(rng() * 2 - 1, 180) * Math.exp(-t / 0.02) * 2.5;
		return Math.tanh(1.3 * (tono + ruido)) * ventana(t, 0.35, 0.006, 0.03);
	});
}

// ---------- efectos ----------

function moneda(): Estereo {
	const rng = prng(101);
	const b = estereo(0.4);
	mezclar(b, cling(2350, 0.4, rng), 0, -0.05);
	mezclar(b, cling(2350 * 1.013, 0.4, rng), 0.004, 0.05, 0.35);
	return b;
}

function whoosh(): Estereo {
	const seg = 0.6;
	const rng = prng(303);
	const b = estereo(seg);
	const bp = [pasaBanda(), pasaBanda(), pasaBanda(), pasaBanda()];
	for (let i = 0; i < b.l.length; i++) {
		const u = i / b.l.length;
		const fc = 400 * (2800 / 400) ** Math.sin((Math.PI / 2) * Math.min(1, u * 1.3));
		const env = Math.sin(Math.PI * u ** 0.8) ** 1.5;
		const izq = bp[1](bp[0](rng() * 2 - 1, fc, 1.4), fc, 1.4);
		const der = bp[3](bp[2](rng() * 2 - 1, fc * 1.04, 1.4), fc * 1.04, 1.4);
		const pan = ((-0.7 + 1.4 * u + 1) * Math.PI) / 4;
		b.l[i] = env * izq * Math.cos(pan) * Math.SQRT2;
		b.r[i] = env * der * Math.sin(pan) * Math.SQRT2;
	}
	return b;
}

function pop(): Estereo {
	const b = estereo(0.15);
	const osc = oscilador();
	mezclar(b, voz(0.15, (t) => {
		const f = 300 + 1100 * Math.exp(-t / 0.018);
		const s = osc(f);
		return (s + 0.2 * s * s) * ataque(t, 0.001) * Math.exp(-t / 0.035);
	}), 0);
	return b;
}

function kaching(): Estereo {
	const rng = prng(404);
	const b = estereo(1.0);
	for (let k = 0; k < 5; k++) {
		const lp = pasaBajos();
		const click = voz(0.03, (t) => {
			const r = rng() * 2 - 1;
			const ruido = (r - lp(r, 2500)) * Math.exp(-t / 0.002);
			const cuerpo = Math.sin(TAU * 900 * t) * Math.exp(-t / 0.012) * 0.5;
			const metal = Math.sin(TAU * 3100 * t) * Math.exp(-t / 0.004) * 0.4;
			return (ruido + cuerpo + metal) * ataque(t, 0.0005);
		});
		mezclar(b, click, k * 0.024, 0, 0.35 + k * 0.08);
	}
	mezclar(b, thump(rng, 70, 90, 0.05), 0.12, 0, 0.35);
	mezclar(b, campana(1976, 0.86, 3.2), 0.14, -0.1, 0.8);
	mezclar(b, campana(2637, 0.8, 3.6), 0.2, 0.1, 0.55);
	mezclar(b, cling(3100, 0.5, rng), 0.16, 0.25, 0.25);
	return b;
}

/** Sello de goma: golpe sordo del mango + palmada de papel + un toque de madera. */
function sello(): Estereo {
	const rng = prng(1101);
	const b = estereo(0.4);
	mezclar(b, thump(rng, 60, 140, 0.05, 0.3), 0, 0, 0.9);
	// papel: ráfaga de ruido de banda media-ancha con caída rápida y algo de "crujido"
	const bp = pasaBanda(), lp = pasaBajos();
	mezclar(b, voz(0.2, (t) => {
		const r = rng() * 2 - 1;
		const banda = bp(r, 1300 + 900 * Math.exp(-t / 0.01), 0.7);
		const crujido = (r - lp(r, 4000)) * (rng() < 0.02 ? 1 : 0.15);
		return (banda * 2.2 + crujido * 0.5) * Math.exp(-t / 0.018) * ventana(t, 0.2, 0.0004, 0.02);
	}), 0.003, 0.05, 0.75);
	mezclar(b, clic(rng, 600, 4, 0.03, 0.12, 180), 0.001, -0.05, 0.4);
	return b;
}

/** Máquina de escribir: ráfaga de teclas y la campanita de fin de línea. */
function maquina(): Estereo {
	const rng = prng(1202);
	const b = estereo(0.85);
	let t = 0.0;
	const golpes: number[] = [];
	while (t < 0.5) {
		golpes.push(t);
		t += 0.045 + rng() * 0.05;
	}
	golpes.forEach((t0, k) => {
		const g = 0.7 + 0.3 * rng();
		const pan = rng() * 0.6 - 0.3;
		// tecla (clac agudo), tipo contra el rodillo (golpe medio) y retorno de la barra
		mezclar(b, clic(rng, 2400 + rng() * 900, 3, 0.012, 0.05), t0, pan, g * 0.8);
		mezclar(b, clic(rng, 900 + rng() * 300, 2.5, 0.02, 0.07, 220), t0 + 0.006, pan, g * 0.7);
		if (k % 3 === 2) mezclar(b, clic(rng, 1600, 6, 0.008, 0.04), t0 + 0.03, pan, 0.3);
	});
	// campanita de fin de línea
	mezclar(b, campana(2093, 0.3, 9), 0.55, 0.2, 0.55);
	mezclar(b, clic(rng, 3000, 8, 0.004, 0.02), 0.548, 0.2, 0.3);
	return b;
}

/** Rebobinado de cinta: chillido que sube con trémolo + ruido de cinta + traqueteo del carrete. */
function rebobinar(): Estereo {
	const rng = prng(1303);
	const seg = 0.6;
	const b = estereo(seg);
	let fase = 0;
	const lp = pasaBajos();
	mezclar(b, voz(seg, (t) => {
		const u = t / seg;
		const f = 260 * (2400 / 260) ** (u ** 1.4) * (1 + 0.06 * Math.sin(TAU * (9 + 20 * u) * t));
		fase = (fase + f / SR) % 1;
		let s = 0;
		for (let h = 1; h <= 6; h++) if (f * h < 9000) s += Math.sin(TAU * h * fase) / (h * h);
		const env = Math.sin(Math.PI * Math.min(1, u * 1.05)) ** 0.7;
		return lp(s, 2600) * env;
	}), 0, 0, 0.55);
	const bp = [pasaBanda(), pasaBanda()];
	for (let i = 0; i < b.l.length; i++) {
		const u = i / b.l.length;
		const fc = 600 * (5000 / 600) ** u;
		const env = Math.sin(Math.PI * u) * (0.7 + 0.3 * Math.sin(TAU * 31 * (i / SR)));
		b.l[i] += bp[0](rng() * 2 - 1, fc, 1.2) * env * 0.45;
		b.r[i] += bp[1](rng() * 2 - 1, fc * 1.05, 1.2) * env * 0.45;
	}
	// carrete: clics que se aceleran
	let t = 0.02;
	while (t < seg - 0.04) {
		mezclar(b, clic(rng, 1800, 5, 0.004, 0.02), t, rng() * 0.4 - 0.2, 0.18);
		t += 0.06 * (1 - (t / seg) * 0.7);
	}
	return b;
}

/**
 * Proyector viejo de cine, en bucle de 2.0 s: obturador a 24 cuadros/s, zumbido del motor con
 * frecuencias de ciclo entero en 2 s y ruido mecánico. Se renderiza con cola y la cola se funde
 * sobre el inicio, así el final empalma con el principio sin clic.
 */
function proyector(): Estereo {
	const rng = prng(1404);
	const seg = 2.0, cola = 0.25;
	const largo = estereo(seg + cola);
	const paso = 1 / 24;
	for (let k = 0; k * paso < seg + cola; k++) {
		const t0 = k * paso;
		const g = (k % 2 === 0 ? 1 : 0.65) * (0.85 + 0.3 * rng());
		mezclar(largo, clic(rng, 1400 + rng() * 300, 2, 0.01, 0.035, 160), t0, -0.1, g * 0.6);
		mezclar(largo, clic(rng, 3200, 4, 0.004, 0.02), t0 + 0.012, 0.15, g * 0.25);
	}
	const lp = pasaBajos(), lp2 = pasaBajos();
	for (let i = 0; i < largo.l.length; i++) {
		const t = i / SR;
		const zumbido = 0.12 * Math.sin(TAU * 60 * t) + 0.06 * Math.sin(TAU * 120 * t) + 0.03 * Math.sin(TAU * 180 * t);
		const vaiven = 1 + 0.25 * Math.sin(TAU * 12 * t); // el carrete gira (12 Hz: entero en 2 s)
		const ruido = lp2(lp(rng() * 2 - 1, 2500), 2500) * 0.35 * vaiven;
		largo.l[i] += zumbido + ruido;
		largo.r[i] += zumbido * 0.95 + ruido * 0.9;
	}
	const n = muestras(seg), nc = muestras(cola);
	const b = { l: largo.l.slice(0, n), r: largo.r.slice(0, n) };
	for (let i = 0; i < nc; i++) {
		const w = i / nc;
		b.l[i] = largo.l[i] * w + largo.l[n + i] * (1 - w);
		b.r[i] = largo.r[i] * w + largo.r[n + i] * (1 - w);
	}
	return b;
}

/** Reloj: tic (agudo) y tac (más grave) dos veces por segundo, 2 s. */
function tictac(): Estereo {
	const rng = prng(1505);
	const b = estereo(2.0);
	for (let k = 0; k < 4; k++) {
		const tic = k % 2 === 0;
		const t0 = 0.01 + k * 0.5;
		mezclar(b, clic(rng, tic ? 3300 : 2300, 9, 0.009, 0.08, tic ? 900 : 650), t0, tic ? -0.15 : 0.15, 0.9);
		mezclar(b, clic(rng, tic ? 5200 : 4100, 6, 0.003, 0.02), t0 + 0.004, 0, 0.3);
	}
	return b;
}

/** Dos latidos (lub-dub, lub-dub). */
function latido(): Estereo {
	const rng = prng(1606);
	const b = estereo(1.6);
	for (const t0 of [0.0, 0.85]) {
		mezclar(b, lub(rng, 52, 0.09), t0, 0, 1);
		mezclar(b, lub(rng, 60, 0.07), t0 + 0.26, 0, 0.7);
	}
	return b;
}

/** Bronces de dibujo: diente de sierra aditivo con filtro que se abre (sonido "brassy"). */
function bronce(f0: number, seg: number, opts: { tremolo?: boolean; brillo?: number } = {}): Float32Array {
	const lp1 = pasaBajos(), lp2 = pasaBajos();
	let fase = 0;
	const brillo = opts.brillo ?? 2600;
	return voz(seg, (t) => {
		const vib = opts.tremolo ? 1 + 0.012 * Math.min(1, t / 0.3) * Math.sin(TAU * 5.2 * t) : 1;
		const f = f0 * vib * 2 ** ((-0.25 * Math.exp(-t / 0.04)) / 12);
		fase = (fase + f / SR) % 1;
		let saw = 0;
		for (let h = 1; h <= 20; h++) if (f * h < 12000) saw += Math.sin(TAU * h * fase) / h;
		const env = Math.min(1, t / 0.025) * Math.min(1, (seg - t) / 0.08) * (0.75 + 0.25 * Math.exp(-t / 0.15));
		const fc = 300 + brillo * env * (0.6 + 0.4 * Math.exp(-t / 0.2));
		return lp2(lp1(saw, fc), fc) * env;
	});
}

/** "Dun-dun-duuun": dos notas cortas y una larga que baja, con timbal. */
function dun(): Estereo {
	const rng = prng(1707);
	const b = estereo(1.6);
	const notas = [
		{ m: 55, t0: 0.0, seg: 0.24 }, // Sol
		{ m: 57, t0: 0.3, seg: 0.24 }, // La
		{ m: 54, t0: 0.6, seg: 0.98 }, // Fa# (larga, oscura)
	];
	notas.forEach(({ m, t0, seg }, k) => {
		const larga = k === 2;
		for (const [oct, g, pan] of [[0, 0.6, -0.25], [-12, 0.55, 0.25], [12, 0.18, 0]] as const)
			mezclar(b, bronce(midiAHz(m + oct), seg, { tremolo: larga, brillo: larga ? 3000 : 2200 }), t0, pan, g);
		if (larga) mezclar(b, bronce(midiAHz(m + 3), seg, { tremolo: true }), t0, 0, 0.25); // tercera menor
		mezclar(b, thump(rng, 50, 70, larga ? 0.35 : 0.12, larga ? 0.9 : 0.3), t0, 0, larga ? 0.9 : 0.55);
	});
	return b;
}

/** Notificación suave genérica: dos tonos de marimba ascendentes (quinta justa). */
function notif(): Estereo {
	const b = estereo(0.7);
	const tono = (f: number, seg: number) =>
		voz(seg, (t) =>
			(Math.sin(TAU * f * t) + 0.18 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.05)) *
			ventana(t, seg, 0.004, 0.05) * Math.exp(-t / 0.16));
	mezclar(b, tono(1046.5, 0.45), 0.0, -0.05, 0.6); // Do6
	mezclar(b, tono(1568, 0.55), 0.11, 0.05, 0.55); // Sol6
	return b;
}

/** Agua que se sirve (burbujas que suben de tono) y dos tragos. */
function glup(): Estereo {
	const rng = prng(1808);
	const b = estereo(1.0);
	// chorro: ruido grave filtrado que va subiendo (la botella se llena)
	const bp = pasaBanda();
	mezclar(b, voz(0.6, (t) => {
		const u = t / 0.6;
		return bp(rng() * 2 - 1, 500 + 700 * u, 2.5) * Math.sin(Math.PI * Math.min(1, u * 1.1)) ** 0.6 * 0.8;
	}), 0, -0.1, 0.5);
	// burbujas: senos con barrido de tono hacia arriba, caída corta
	for (let k = 0; k < 22; k++) {
		const t0 = 0.55 * (k / 22) + rng() * 0.02;
		const f0 = 500 + 600 * (k / 22) + rng() * 300;
		const seg = 0.05 + rng() * 0.03;
		const osc = oscilador();
		mezclar(b, voz(seg, (t) => osc(f0 * (1 + 2.5 * t / seg)) * Math.exp(-t / (seg * 0.35)) * ventana(t, seg, 0.002, 0.008)), t0, rng() * 0.6 - 0.3, 0.35 + 0.25 * rng());
	}
	// tragos: chasquido grave con formante y tono que sube
	for (const t0 of [0.62, 0.82]) {
		const osc = oscilador(), f2 = pasaBanda();
		const seg = 0.14;
		mezclar(b, voz(seg, (t) => {
			const f = 170 + 260 * (t / seg);
			const s = osc(f) * Math.exp(-t / 0.05);
			const glk = f2((rng() * 2 - 1) * Math.exp(-t / 0.006), 650, 3) * 3;
			return (s + glk) * ventana(t, seg, 0.004, 0.02);
		}), t0, 0, 0.9);
	}
	return b;
}

/** Grillos de noche, 2 s: varios grillos con trinos de pulsos a ~4.5 kHz, paneados, y un fondo de noche. */
function grillos(): Estereo {
	const rng = prng(1909);
	const seg = 2.0;
	const b = estereo(seg);
	const bichos = [
		{ f: 4300, pan: -0.6, periodo: 0.42, pulsos: 3, g: 0.5, fase: 0.05 },
		{ f: 4750, pan: 0.5, periodo: 0.55, pulsos: 4, g: 0.35, fase: 0.21 },
		{ f: 3900, pan: 0.1, periodo: 0.7, pulsos: 3, g: 0.25, fase: 0.4 },
	];
	for (const g of bichos) {
		for (let t0 = g.fase; t0 < seg - 0.15; t0 += g.periodo * (0.95 + 0.1 * rng())) {
			for (let p = 0; p < g.pulsos; p++) {
				const largo = 0.018;
				const f = g.f * (1 + 0.01 * (rng() - 0.5));
				mezclar(b, voz(largo, (t) => Math.sin(TAU * f * t) * Math.sin((Math.PI * t) / largo) ** 2), t0 + p * 0.03, g.pan, g.g);
			}
		}
	}
	const lp = [pasaBajos(), pasaBajos()];
	for (let i = 0; i < b.l.length; i++) {
		b.l[i] += lp[0](rng() * 2 - 1, 400) * 0.08;
		b.r[i] += lp[1](rng() * 2 - 1, 400) * 0.08;
	}
	return b;
}

// ---------- música de fondo ----------

type Escena = { id: string; inicio: number; fin: number };
type Seccion = 'gancho' | 'pista1' | 'pista2' | 'pista3' | 'cierre' | 'remate';
const ORDEN: Seccion[] = ['gancho', 'pista1', 'pista2', 'pista3', 'cierre', 'remate'];
type Acorde = { raiz: number; tonos: number[] }; // tonos: semitonos sobre la raíz

/** Reverb Schroeder pequeña (4 peines + 2 pasa-todo por canal), para dar sala sin ensuciar. */
function reverb(entrada: Estereo, envio: number): Estereo {
	const n = entrada.l.length;
	const salida = { l: new Float32Array(n), r: new Float32Array(n) };
	const canal = (x: Float32Array, y: Float32Array, extra: number) => {
		const peines = [1557, 1617, 1491, 1422].map((d) => d + extra);
		const acc = new Float32Array(n);
		for (const d of peines) {
			const buf = new Float32Array(d);
			let idx = 0, lp = 0;
			for (let i = 0; i < n; i++) {
				const out = buf[idx];
				lp = out * 0.6 + lp * 0.4; // amortiguación de agudos
				buf[idx] = x[i] * envio + lp * 0.8;
				idx = (idx + 1) % d;
				acc[i] += out * 0.25;
			}
		}
		for (const d of [225 + extra, 556 + extra]) {
			const buf = new Float32Array(d);
			let idx = 0;
			for (let i = 0; i < n; i++) {
				const bufout = buf[idx];
				const v = acc[i] + bufout * 0.5;
				acc[i] = bufout - v * 0.5;
				buf[idx] = v;
				idx = (idx + 1) % d;
			}
		}
		y.set(acc);
	};
	canal(entrada.l, salida.l, 0);
	canal(entrada.r, salida.r, 23);
	return salida;
}

function musica(narr: { duracion_s: number; escenas: Escena[] }): { b: Estereo; limites: Record<Seccion, [number, number]> } {
	const DUR = narr.duracion_s + 2;
	const esc = (id: Seccion) => {
		const e = narr.escenas.find((x) => x.id === id);
		if (!e) throw new Error(`narracion.json no tiene la escena ${id}`);
		return e;
	};
	// límites: punto medio entre el fin de una escena y el inicio de la siguiente
	const corte: number[] = [0];
	for (let k = 1; k < ORDEN.length; k++) corte.push((esc(ORDEN[k - 1]).fin + esc(ORDEN[k]).inicio) / 2);
	corte.push(DUR);
	const limites = Object.fromEntries(ORDEN.map((s, k) => [s, [corte[k], corte[k + 1]]])) as Record<Seccion, [number, number]>;
	const seccionEn = (t: number): Seccion => {
		for (let k = ORDEN.length - 1; k >= 0; k--) if (t >= corte[k]) return ORDEN[k];
		return 'gancho';
	};

	const BPM = 95;
	const TIEMPO = 60 / BPM;
	const COMPAS = TIEMPO * 4;
	const SWING = (2 / 3) * TIEMPO; // corchea a contratiempo con swing
	const ORIGEN = limites.pista1[0]; // primer tiempo fuerte del groove = entrada de la pista 1
	const rng = prng(2026);

	// progresiones (Re menor para las pistas, Re mayor para el cierre)
	const Dm: Acorde = { raiz: 62, tonos: [0, 3, 7, 10] };
	const Gm: Acorde = { raiz: 67, tonos: [0, 3, 7, 10] };
	const A7: Acorde = { raiz: 69, tonos: [0, 4, 7, 10] };
	const Bb7: Acorde = { raiz: 70, tonos: [0, 4, 7, 10] };
	const D: Acorde = { raiz: 62, tonos: [0, 4, 7, 11] };
	const Bm: Acorde = { raiz: 71, tonos: [0, 3, 7, 10] };
	const Em: Acorde = { raiz: 64, tonos: [0, 3, 7, 10] };
	const prog: Record<Seccion, Acorde[]> = {
		gancho: [Dm, Dm, Bb7, A7],
		pista1: [Dm, Dm, Gm, A7],
		pista2: [Dm, Gm, Bb7, A7],
		pista3: [Dm, Bb7, Gm, A7],
		cierre: [D, Bm, Em, A7],
		remate: [D, D, D, D],
	};
	const compasDe = (t: number) => Math.floor((t - ORIGEN) / COMPAS + 1e-9);
	const k0: Record<Seccion, number> = Object.fromEntries(
		ORDEN.map((s) => [s, s === 'gancho' ? 0 : compasDe(limites[s][0] - 1e-6) + ((limites[s][0] - ORIGEN) % COMPAS > COMPAS * 0.6 ? 1 : 0)]),
	) as Record<Seccion, number>;
	const indice = (s: Seccion, k: number) => (((k - k0[s]) % 4) + 4) % 4;
	const acordeEn = (s: Seccion, k: number) => prog[s][indice(s, k)];

	const seco = estereo(DUR); // lo que va directo
	const envio = estereo(DUR); // lo que además pasa por la reverb

	// --- instrumentos ---
	const contrabajo = (f: number, seg: number) => {
		let fase = 0;
		const lp = pasaBajos();
		return voz(seg, (t) => {
			const ff = f * (1 + 0.015 * Math.exp(-t / 0.02));
			fase = (fase + ff / SR) % 1;
			const s = Math.sin(TAU * fase) + 0.5 * Math.sin(2 * TAU * fase) * Math.exp(-t / 0.15) +
				0.25 * Math.sin(3 * TAU * fase) * Math.exp(-t / 0.08) + 0.1 * Math.sin(4 * TAU * fase) * Math.exp(-t / 0.04);
			const dedo = lp((rng() * 2 - 1) * Math.exp(-t / 0.004), 900) * 0.6;
			return (s * Math.exp(-t / 0.55) + dedo) * ventana(t, seg, 0.004, 0.04);
		});
	};
	const vibrafono = (f: number, seg: number, motor = true) =>
		voz(seg, (t) => {
			const trem = motor ? 1 - 0.22 * (0.5 + 0.5 * Math.sin(TAU * 5.3 * t)) : 1;
			const s = Math.sin(TAU * f * t) * Math.exp(-t / 1.1) +
				0.12 * Math.sin(TAU * 4 * f * t) * Math.exp(-t / 0.18) +
				0.03 * Math.sin(TAU * 10 * f * t) * Math.exp(-t / 0.015);
			return s * trem * ventana(t, seg, 0.002, 0.08);
		});
	const trompeta = (f0: number, seg: number) => {
		const lp1 = pasaBajos(), lp2 = pasaBajos();
		let fase = 0;
		return voz(seg, (t) => {
			const vib = 1 + 0.01 * Math.min(1, Math.max(0, t - 0.15) / 0.2) * Math.sin(TAU * 5.5 * t);
			const f = f0 * vib * 2 ** ((-0.5 * Math.exp(-t / 0.025)) / 12);
			fase = (fase + f / SR) % 1;
			let saw = 0;
			for (let h = 1; h <= 12; h++) if (f * h < 6000) saw += Math.sin(TAU * h * fase) / h;
			const env = Math.min(1, t / 0.03) * Math.min(1, Math.max(0, seg - t) / 0.05);
			const wah = Math.sin(Math.PI * Math.min(1, t / Math.max(0.12, seg)));
			const fc = 380 + 1100 * wah * env; // sordina: se queda bajo 1.5 kHz
			return lp2(lp1(saw, fc), fc) * env;
		});
	};
	const pizzicato = (f: number, seg: number) =>
		voz(seg, (t) => {
			let s = 0;
			for (let h = 1; h <= 5; h++) s += (Math.sin(TAU * h * f * t) / h) * Math.exp(-t * (6 + h * 6));
			return s * ventana(t, seg, 0.002, 0.03);
		});
	const pianoGrave = (f: number, seg: number) =>
		voz(seg, (t) => {
			const s = Math.sin(TAU * f * t) * Math.exp(-t / 1.6) + 0.5 * Math.sin(TAU * 2.003 * f * t) * Math.exp(-t / 0.9) +
				0.25 * Math.sin(TAU * 3.01 * f * t) * Math.exp(-t / 0.5) + 0.1 * Math.sin(TAU * 4.03 * f * t) * Math.exp(-t / 0.25);
			return s * ventana(t, seg, 0.003, 0.3);
		});
	const escobilla = (largo: number) => {
		const lp = pasaBajos();
		return voz(largo, (t) => {
			const r = rng() * 2 - 1;
			const env = Math.min(1, t / (largo * 0.3)) * Math.exp(-t / (largo * 0.35));
			return (r - lp(r, 5500)) * env * ventana(t, largo, 0.001, 0.01);
		});
	};
	const chasquido = () => {
		const bp = pasaBanda();
		return voz(0.08, (t) => bp((rng() * 2 - 1), 2000, 1.6) * Math.exp(-t / 0.012) * ventana(t, 0.08, 0.0005, 0.01) * 2);
	};
	const bombo = (g = 1) => {
		const osc = oscilador();
		return voz(0.4, (t) => g * osc(46 + 70 * Math.exp(-t / 0.03)) * Math.exp(-t / 0.18) * ventana(t, 0.4, 0.002, 0.04));
	};
	const tic = (agudo: boolean) => clic(rng, agudo ? 2600 : 1900, 8, 0.008, 0.06, agudo ? 800 : 600);

	const nota = (dest: Estereo, v: Float32Array, t0: number, pan: number, g: number, envia = 0) => {
		mezclar(dest, v, t0, pan, g);
		if (envia) mezclar(envio, v, t0, pan, g * envia);
	};

	// --- gancho: drone, reloj, latido, piano grave y pizzicato ---
	{
		const [g0, g1] = limites.gancho;
		const largo = g1 + 0.6;
		const lp = [pasaBajos(), pasaBajos()];
		let f1 = 0, f2 = 0, f3 = 0;
		const drone = voz(largo, (t) => {
			const u = t / g1;
			f1 = (f1 + 36.71 / SR) % 1; // Re1
			f2 = (f2 + 73.6 / SR) % 1; // Re2 un poco desafinado (batido)
			f3 = (f3 + 110.1 / SR) % 1; // La2
			let saw = 0;
			for (let h = 1; h <= 8; h++) saw += (Math.sin(TAU * h * f1) + Math.sin(TAU * h * f2) * 0.7 + Math.sin(TAU * h * f3) * 0.35) / h;
			const fc = 160 + 140 * (0.5 + 0.5 * Math.sin(TAU * 0.11 * t - Math.PI / 2)) + 120 * u;
			const env = Math.min(1, t / 1.5) * (0.7 + 0.3 * u) * Math.min(1, Math.max(0, largo - t) / 0.8);
			return lp[1](lp[0](saw, fc), fc) * env;
		});
		nota(seco, drone, g0, 0, 0.24, 0.3);

		const kIni = compasDe(g0), kFin = compasDe(g1);
		for (let k = kIni; k <= kFin; k++) {
			const t0 = ORIGEN + k * COMPAS;
			// reloj: un golpe por tiempo, tic-tac
			for (let b = 0; b < 4; b++) {
				const tt = t0 + b * TIEMPO;
				if (tt < 0.25 || tt >= g1) continue;
				nota(seco, tic(b % 2 === 0), tt, b % 2 ? 0.25 : -0.25, 0.06);
			}
			// latido (lub-dub) al inicio de cada compás, cada vez un poco más presente
			if (t0 >= 0.4 && t0 < g1 - 0.2) {
				const crece = 0.6 + 0.4 * (t0 / g1);
				nota(seco, lub(rng, 50, 0.09), t0, 0, 0.55 * crece);
				nota(seco, lub(rng, 58, 0.07), t0 + 0.24, 0, 0.38 * crece);
			}
			// piano grave cada dos compases
			if (k % 2 === 0 && t0 >= 0 && t0 < g1 - 1) {
				nota(seco, pianoGrave(midiAHz(38), 2.6), t0, -0.1, 0.22, 0.4);
				nota(seco, pianoGrave(midiAHz(45), 2.6), t0 + 0.01, 0.1, 0.12, 0.4);
			}
			// pizzicato escaso y sigiloso (Re menor con sensible)
			const fig: [number, number][] = k % 2 === 0 ? [[0.5, 50], [2.5, 53], [3.5, 49]] : [[1.5, 46], [3, 50]];
			for (const [b, m] of fig) {
				const tt = t0 + Math.floor(b) * TIEMPO + (b % 1 ? SWING : 0);
				if (tt < 0.8 || tt >= g1 - 0.05) continue;
				nota(seco, pizzicato(midiAHz(m), 0.35), tt, 0.3, 0.25, 0.5);
			}
		}
	}

	// --- pistas y cierre: groove noir a 95 BPM ---
	const frase: Record<'menor' | 'mayor', [number, number, number][][]> = {
		// [corchea 0..15 en dos compases, nota MIDI, duración en tiempos]
		menor: [
			[[0, 69, 0.4], [2, 68, 0.3], [3, 69, 0.4], [5, 65, 0.4], [6, 64, 0.4], [8, 62, 1.4], [11, 61, 0.3], [12, 62, 0.4], [14, 65, 0.4], [15, 64, 0.4]],
			[[0, 70, 0.4], [2, 69, 0.3], [3, 70, 0.4], [5, 67, 0.4], [6, 65, 0.4], [8, 64, 1.4], [11, 61, 0.3], [12, 64, 0.4], [14, 67, 0.8]],
		],
		mayor: [
			[[0, 66, 0.5], [2, 69, 0.4], [3, 71, 0.5], [5, 69, 0.4], [6, 66, 0.4], [8, 74, 1.6], [11, 71, 0.4], [12, 69, 0.4], [14, 66, 0.6]],
			[[0, 67, 0.5], [2, 71, 0.4], [3, 69, 0.5], [5, 67, 0.4], [6, 64, 0.4], [8, 73, 1.6], [11, 71, 0.4], [12, 69, 0.4], [14, 64, 0.6]],
		],
	};
	const tiempoCorchea = (t0: number, c: number) => t0 + Math.floor(c / 2) * TIEMPO + (c % 2 ? SWING : 0);
	const kGroove0 = compasDe(limites.pista1[0]);
	const kGroove1 = compasDe(limites.remate[0]);
	const fin = limites.remate[0];
	const groove = (s: Seccion) => s === 'pista1' || s === 'pista2' || s === 'pista3' || s === 'cierre';

	for (let k = kGroove0; k <= kGroove1; k++) {
		const t0 = ORIGEN + k * COMPAS;
		// bajo caminante: raíz, tono del acorde, otro tono, aproximación cromática a la siguiente raíz
		for (let b = 0; b < 4; b++) {
			const tt = t0 + b * TIEMPO;
			const s = seccionEn(tt);
			if (!groove(s) || tt >= fin) continue;
			const a = acordeEn(s, k);
			const sig = acordeEn(seccionEn(t0 + COMPAS), k + 1);
			const raiz = 38 + ((a.raiz - 38) % 12 + 12) % 12;
			const raizSig = 38 + ((sig.raiz - 38) % 12 + 12) % 12;
			const variante = (k + (s === 'pista3' ? 1 : 0)) % 2;
			let m: number;
			if (b === 0) m = raiz;
			else if (b === 1) m = raiz + (variante ? a.tonos[1] : a.tonos[2]);
			else if (b === 2) m = s === 'pista3' && k % 2 ? raiz + 12 : raiz + (variante ? a.tonos[2] : a.tonos[3]);
			else m = raizSig + (k % 2 ? 1 : -1);
			const acento = b === 0 ? 1 : 0.85;
			nota(seco, contrabajo(midiAHz(m), TIEMPO * 0.95), tt, 0, 0.42 * acento, 0.08);
		}
		// batería: escobillas con swing, chasquidos en 2 y 4, bombo suave en 1 y 3 desde la pista 3
		for (let c = 0; c < 8; c++) {
			const tt = tiempoCorchea(t0, c);
			const s = seccionEn(tt);
			if (!groove(s) || tt >= fin) continue;
			const densa = s !== 'pista1';
			if (c % 2 === 1 || densa || c % 4 === 0) {
				const g = (c % 2 ? 0.07 : 0.045) * (s === 'pista1' ? 0.8 : s === 'pista3' ? 1.15 : 1) * (0.85 + 0.3 * rng());
				nota(seco, escobilla(c % 2 ? 0.09 : 0.06), tt, -0.35, g);
			}
			if (c === 2 || c === 6) nota(seco, chasquido(), tt, 0.3, s === 'pista1' ? 0.09 : 0.11, 0.6);
			if ((s === 'pista3' || s === 'cierre') && (c === 0 || c === 4)) nota(seco, bombo(), tt, 0, s === 'cierre' ? 0.3 : 0.26);
			if (s === 'pista2' && c === 0 && (k - k0.pista2) % 2 === 0) nota(seco, bombo(), tt, 0, 0.2);
		}
		// colchón / acompañamiento
		{
			const s = seccionEn(t0 + 0.01);
			const sMitad = seccionEn(t0 + COMPAS / 2);
			// acordes cortos de vibráfono a contratiempo (pista2, pista3, cierre)
			for (const c of [3, 7]) {
				const tt = tiempoCorchea(t0, c);
				const sc = seccionEn(tt);
				if (tt >= fin || !(sc === 'pista2' || sc === 'pista3' || sc === 'cierre')) continue;
				const a = acordeEn(sc, k);
				for (const tn of a.tonos.slice(1)) {
					let m = a.raiz + tn;
					while (m > 66) m -= 12;
					while (m < 55) m += 12;
					nota(seco, vibrafono(midiAHz(m), TIEMPO * 0.6, false), tt, -0.4, 0.05, 0.6);
				}
			}
			// pad de tensión en la pista 3 y pad cálido en el cierre
			if ((s === 'pista3' || s === 'cierre') && sMitad === s && t0 + COMPAS <= fin + 0.3) {
				const a = acordeEn(s, k);
				const largo = Math.min(COMPAS, fin + 0.2 - t0);
				for (const tn of a.tonos.slice(0, 3)) {
					let m = a.raiz + tn;
					while (m > 64) m -= 12;
					const f = midiAHz(m);
					const env = (t: number) => Math.min(1, t / 0.4) * Math.min(1, Math.max(0, largo - t) / 0.4);
					const lpP = pasaBajos();
					const pad = voz(largo, (t) => lpP(env(t) * (Math.sin(TAU * f * 0.998 * t) + Math.sin(TAU * f * 1.002 * t) + 0.3 * Math.sin(TAU * 2 * f * t)), 900));
					nota(seco, pad, t0, tn === 0 ? -0.6 : 0.6, s === 'cierre' ? 0.05 : 0.04, 0.8);
				}
			}
		}
		// melodía: vibráfono (pista1), trompeta con sordina (pista2), ambos (pista3), vibráfono mayor (cierre)
		{
			const s = seccionEn(t0 + 0.01);
			if (!groove(s) && seccionEn(t0 + COMPAS / 2) !== 'pista1') continue;
			const sec = groove(s) ? s : 'pista1';
			const idx = indice(sec, k);
			const mitad = idx % 2; // compás 0 o 1 de la frase de dos
			const fr = frase[sec === 'cierre' ? 'mayor' : 'menor'][Math.floor(idx / 2)];
			const ciclo = Math.floor((k - k0[sec]) / 4);
			for (const [c, m0, dur] of fr) {
				if (Math.floor(c / 8) !== mitad) continue;
				const tt = tiempoCorchea(t0, c % 8);
				if (tt >= fin || seccionEn(tt) !== sec) continue;
				// en el tercer ciclo de cada pista la frase deja huecos para no tapar la voz
				if (ciclo >= 1 && sec === 'pista1' && c % 3 === 1) continue;
				const seg = Math.min(dur * TIEMPO, fin - tt + 0.05);
				let m = m0;
				if (sec === 'pista3' && Math.floor(idx / 2) === 1 && ciclo % 2 === 1) m += 12;
				if (sec === 'pista1' || sec === 'pista3' || sec === 'cierre')
					nota(seco, vibrafono(midiAHz(m), seg + 0.25), tt, 0.25, sec === 'pista3' ? 0.11 : 0.13, 0.7);
				if (sec === 'pista2' || sec === 'pista3')
					nota(seco, trompeta(midiAHz(m - (sec === 'pista3' ? 12 : 0)), seg), tt, -0.15, sec === 'pista3' ? 0.08 : 0.11, 0.6);
			}
		}
	}

	// --- remate: casi nada. Una nota sostenida, impasible; silencio; botón final ---
	{
		const [r0] = limites.remate;
		const largo = 2.3;
		nota(seco, trompeta(midiAHz(50), largo), r0 + 0.05, 0, 0.09, 0.5); // Re3 con sordina, plano
		nota(seco, contrabajo(midiAHz(38), 1.0), r0 + 0.05, 0, 0.3, 0.1);
		const vozFin = esc('remate').fin;
		const tb = Math.min(vozFin + 0.15, DUR - 1.8);
		// botón: Re 6/9 corto (bajo + vibráfono + chasquido)
		nota(seco, contrabajo(midiAHz(38), 0.6), tb, 0, 0.45, 0.1);
		for (const m of [62, 66, 71, 76]) nota(seco, vibrafono(midiAHz(m), 1.4, false), tb, (m - 69) / 14, 0.07, 0.8);
		nota(seco, chasquido(), tb, 0.3, 0.12, 0.6);
		nota(seco, escobilla(0.12), tb, -0.3, 0.07);
	}

	const rv = reverb(envio, 0.22);
	const salida = estereo(DUR);
	for (let i = 0; i < salida.l.length; i++) {
		salida.l[i] = seco.l[i] + rv.l[i];
		salida.r[i] = seco.r[i] + rv.r[i];
	}
	normalizar(salida, -6);
	fundidos(salida, 0.01, 1.0);
	return { b: salida, limites };
}

// ---------- principal ----------

fs.mkdirSync(SALIDA, { recursive: true });
guardarSfx('sello.wav', sello());
guardarSfx('maquina.wav', maquina());
guardarSfx('rebobinar.wav', rebobinar());
{
	// el bucle del proyector no lleva fundidos (empalma consigo mismo); solo se normaliza
	const p = proyector();
	normalizar(p, -1);
	escribirWav('proyector.wav', p);
}
guardarSfx('tictac.wav', tictac());
guardarSfx('latido.wav', latido());
guardarSfx('dun.wav', dun());
guardarSfx('pop.wav', pop());
guardarSfx('whoosh.wav', whoosh());
guardarSfx('moneda.wav', moneda());
guardarSfx('kaching.wav', kaching());
guardarSfx('notif.wav', notif());
guardarSfx('glup.wav', glup());
guardarSfx('grillos.wav', grillos(), 0.12, 0.25);

if (fs.existsSync(NARRACION)) {
	const narr = JSON.parse(fs.readFileSync(NARRACION, 'utf8')) as { duracion_s: number; escenas: Escena[] };
	const { b, limites } = musica(narr);
	escribirWav('musica-detective.wav', b);
	for (const s of ORDEN) console.log(`  ${s.padEnd(7)} ${limites[s][0].toFixed(2)}–${limites[s][1].toFixed(2)} s`);
} else {
	console.log('Sin voz/narracion.json: no hice musica-detective.wav.');
}
console.log(`Listo: ${SALIDA}`);
