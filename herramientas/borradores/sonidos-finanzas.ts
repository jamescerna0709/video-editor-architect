// Borrador: sintetiza desde cero los efectos de sonido y la música de fondo del reel
// "finanzas-3d" (estilo explicador 3D, caricaturesco). Todo sale de matemática pura:
// osciladores, envolventes y ruido filtrado con un generador pseudoaleatorio con semilla.
// No descarga nada ni usa muestras, así que el audio es original y determinista
// (misma semilla, mismos archivos). Escribe WAV PCM de 16 bits, 48 kHz, estéreo, en
// proyectos/2026-11-15-finanzas-3d/sonidos/.
// Uso: npx tsx herramientas/borradores/sonidos-finanzas.ts

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const TAU = Math.PI * 2;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = path.join(RAIZ, 'proyectos', '2026-11-15-finanzas-3d', 'sonidos');

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
	const v = new Float32Array(muestras(seg));
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
	console.log(`${nombre.padEnd(13)} ${(n / SR).toFixed(3)} s`);
}

/** Cierra un efecto: pico a -1 dBFS, fundidos cortos y escritura. */
function guardarSfx(nombre: string, b: Estereo): void {
	normalizar(b, -1);
	fundidos(b, 0.002, 0.012);
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
		s += 0.4 * Math.sin(TAU * base * 1.006 * t) * Math.exp(-6 * t); // batido metálico
		const golpecito = (rng() * 2 - 1) * Math.exp(-t / 0.0015);
		s += 0.5 * (golpecito - brillo(golpecito, 3000)); // ruido agudo del impacto
		return s * ataque(t, 0.0008);
	});
}

/** Campana brillante (para la caja registradora y el "sube"). */
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
function thump(rng: () => number, fBase = 45, fExtra = 110, cuerpo = 0.07): Float32Array {
	const osc = oscilador();
	const lp = pasaBajos();
	return voz(0.3, (t) => {
		const f = fBase + fExtra * Math.exp(-t / 0.025);
		const tono = osc(f) * Math.exp(-t / cuerpo);
		const ruido = lp(rng() * 2 - 1, 700) * Math.exp(-t / 0.012) * 1.5;
		return Math.tanh(1.5 * (tono + ruido)) * ataque(t, 0.0015);
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

function monedas(): Estereo {
	const rng = prng(202);
	const b = estereo(1.2);
	const n = 14;
	for (let i = 0; i < n; i++) {
		const t = 0.9 * (i / n) ** 0.85 + rng() * 0.03;
		const base = 1900 + rng() * 1500;
		const seg = Math.min(0.45, 1.2 - t);
		mezclar(b, cling(base, seg, rng), t, rng() * 1.6 - 0.8, 0.5 + 0.5 * rng());
	}
	return b;
}

function whoosh(): Estereo {
	const seg = 0.6;
	const rng = prng(303);
	const b = estereo(seg);
	const bp = [pasaBanda(), pasaBanda(), pasaBanda(), pasaBanda()];
	for (let i = 0; i < b.l.length; i++) {
		const u = i / b.l.length;
		const fc = 400 * (2800 / 400) ** Math.sin((Math.PI / 2) * Math.min(1, u * 1.3)); // barrido hacia arriba
		const env = Math.sin(Math.PI * u ** 0.8) ** 1.5;
		const izq = bp[1](bp[0](rng() * 2 - 1, fc, 1.4), fc, 1.4);
		const der = bp[3](bp[2](rng() * 2 - 1, fc * 1.04, 1.4), fc * 1.04, 1.4);
		const pan = ((-0.7 + 1.4 * u + 1) * Math.PI) / 4; // cruza de izquierda a derecha
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
	// "ka": trinquete mecánico de clics cortos
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
	mezclar(b, thump(rng, 70, 90, 0.05), 0.12, 0, 0.35); // cajón que se abre
	// "ching": dos campanazos brillantes y un brillo de moneda
	mezclar(b, campana(1976, 0.86, 3.2), 0.14, -0.1, 0.8);
	mezclar(b, campana(2637, 0.8, 3.6), 0.2, 0.1, 0.55);
	mezclar(b, cling(3100, 0.5, rng), 0.16, 0.25, 0.25);
	return b;
}

function triste(): Estereo {
	const b = estereo(1.6);
	const notas = [
		{ midi: 58, t0: 0, seg: 0.27 },
		{ midi: 57, t0: 0.3, seg: 0.27 },
		{ midi: 56, t0: 0.6, seg: 0.27 },
		{ midi: 55, t0: 0.9, seg: 0.68 },
	];
	notas.forEach(({ midi, t0, seg }, k) => {
		const ultima = k === notas.length - 1;
		const f0 = midiAHz(midi);
		const lp1 = pasaBajos(), lp2 = pasaBajos();
		let fase = 0;
		const v = voz(seg, (t) => {
			const deslizar = 2 ** ((-0.4 * Math.exp(-t / 0.03)) / 12); // entra un poco abajo
			let vib = 1, caida = 1;
			if (ultima) {
				vib = 1 + 0.03 * Math.min(1, t / 0.25) * Math.sin(TAU * 5.5 * t);
				caida = 2 ** ((-0.8 * Math.max(0, t - 0.35)) / 12); // se desinfla al final
			}
			const f = f0 * deslizar * vib * caida;
			fase = (fase + f / SR) % 1;
			let saw = 0; // diente de sierra aditivo (sin aliasing)
			for (let h = 1; h <= 14; h++) saw += Math.sin(TAU * h * fase) / h;
			const env = Math.min(1, t / 0.03) * Math.min(1, (seg - t) / 0.06);
			// "wah": la sordina abre el filtro con cada nota (y oscila en la última)
			const wah = ultima ? 0.55 + 0.45 * Math.sin(TAU * 5.5 * t - Math.PI / 2) : Math.sin(Math.PI * Math.min(1, t / seg));
			const fc = 350 + 1900 * wah * env;
			return lp2(lp1(saw, fc), fc) * env;
		});
		mezclar(b, v, t0);
	});
	return b;
}

function boing(): Estereo {
	const b = estereo(0.6);
	let fase = 0;
	mezclar(b, voz(0.6, (t) => {
		const f = (150 + 80 * t) * (1 + 0.3 * Math.sin(TAU * 14 * t) * Math.exp(-3.5 * t));
		fase = (fase + f / SR) % 1;
		const s = Math.sin(TAU * fase) + 0.4 * Math.sin(2 * TAU * fase) + 0.15 * Math.sin(3 * TAU * fase);
		return s * ataque(t, 0.002) * Math.exp(-t / 0.2);
	}), 0);
	return b;
}

function sube(): Estereo {
	const rng = prng(505);
	const b = estereo(1.2);
	// arpegio mayor ascendente (Do)
	const arpegio = [72, 76, 79, 84, 88, 91, 96];
	arpegio.forEach((m, k) => {
		const f = midiAHz(m);
		const seg = Math.min(0.55, 1.2 - k * 0.11);
		const nota = voz(seg, (t) =>
			(Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.08)) *
			ataque(t, 0.002) * Math.exp(-t / 0.22));
		mezclar(b, nota, k * 0.11, k % 2 ? 0.35 : -0.35, 0.6);
	});
	// barrido suave por debajo
	const osc = oscilador();
	mezclar(b, voz(1.0, (t) => {
		const u = t / 1.0;
		return osc(220 * (1000 / 220) ** u) * Math.sin(Math.PI * u) * (0.8 + 0.2 * Math.sin(TAU * 9 * t));
	}), 0, 0, 0.18);
	// destellos mágicos: senos agudos diminutos, cada vez más densos
	for (let k = 0; k < 45; k++) {
		const t = 0.08 + 0.95 * Math.sqrt(rng());
		const f = 4000 + rng() * 5000;
		const seg = Math.min(0.09, 1.2 - t);
		if (seg <= 0.01) continue;
		mezclar(b, voz(seg, (tt) => Math.sin(TAU * f * tt) * ataque(tt, 0.002) * Math.exp(-tt / 0.025)), t, rng() * 1.8 - 0.9, 0.12);
	}
	return b;
}

function golpe(): Estereo {
	const b = estereo(0.3);
	mezclar(b, thump(prng(606)), 0);
	return b;
}

// ---------- música de fondo ----------

type Acorde = { raiz: number; menor: boolean };

/**
 * Música de fondo. `seccionEn(t)` dice qué parte suena en cada compás: A tranquila, B más oscura, C más enérgica.
 * Por defecto: la pista de 32 s del reel corto (A 0-8.7 s, B 8.7-15.3 s, C después).
 */
function musica(DUR = 32, seccionEn?: (t: number) => 'A' | 'B' | 'C'): Estereo {
	const BPM = 110;
	const tiempo = 60 / BPM;
	const compas = tiempo * 4;
	const octavo = tiempo / 2;
	const rng = prng(707);

	const C: Acorde = { raiz: 60, menor: false };
	const F: Acorde = { raiz: 65, menor: false };
	const G: Acorde = { raiz: 67, menor: false };
	const Am: Acorde = { raiz: 69, menor: true };
	const Dm: Acorde = { raiz: 62, menor: true };
	// A: compases 0-3 (0-8.7 s) · B, más oscuro: 4-6 (8.7-15.3 s) · C, más enérgico: 7 en adelante
	const progresion = [C, F, C, G, Am, Dm, Am, C, G, F, G, C, F, G, C];
	const seccion = (n: number) => (seccionEn ? seccionEn(n * compas) : n < 4 ? 'A' : n < 7 ? 'B' : 'C');
	// en la pista larga los acordes salen de la sección, no de la progresión fija del reel corto
	const porSeccion: Record<'A' | 'B' | 'C', Acorde[]> = {A: [C, F, C, G], B: [Am, Dm, Am, G], C: [C, G, F, G]};
	const acordeEn = (n: number) => (seccionEn ? porSeccion[seccion(n)][n % 4] : progresion[n]);

	// tono k del arpegio del acorde (0 raíz, 1 tercera, 2 quinta, 3 octava…)
	const tono = (a: Acorde, k: number) => a.raiz + [0, a.menor ? 3 : 4, 7][k % 3] + 12 * Math.floor(k / 3);

	const melodias: Record<string, (number | null)[][]> = {
		A: [[0, null, 2, null, 1, 2, 3, null], [4, null, 3, 2, null, 1, 2, null]],
		B: [[null, 0, null, 2, null, 1, null, null], [2, null, null, 1, null, 0, null, null]],
		C: [[0, 2, 4, 2, 3, 2, 1, 2], [3, null, 4, 3, 2, null, 1, 0]],
	};
	const bajos: Record<string, [number, number][]> = { // [octavo, tono del arpegio]
		A: [[0, 0], [3, 0], [4, 2], [7, 3]],
		B: [[0, 0], [4, 0], [6, 2]],
		C: [[0, 0], [2, 0], [3, 3], [4, 2], [6, 0], [7, 3]],
	};

	const bateria = estereo(DUR), bajo = estereo(DUR), mel = estereo(DUR), pad = estereo(DUR);

	const bombo = () => {
		const osc = oscilador();
		return voz(0.35, (t) => osc(48 + 110 * Math.exp(-t / 0.03)) * ataque(t, 0.001) * Math.exp(-t / 0.16));
	};
	const platillo = (caida: number) => {
		const lp = pasaBajos();
		return voz(caida * 5, (t) => {
			const r = rng() * 2 - 1;
			return (r - lp(r, 7000)) * ataque(t, 0.0005) * Math.exp(-t / caida);
		});
	};
	const palmada = () => {
		const bp = pasaBanda();
		return voz(0.25, (t) => {
			const rafagas = [0, 0.009, 0.018].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) / 0.006) : 0), 0);
			const cola = t >= 0.018 ? Math.exp(-(t - 0.018) / 0.07) : 0;
			return bp(rng() * 2 - 1, 1500, 0.9) * (0.6 * rafagas + cola) * ataque(t, 0.0005);
		});
	};
	const marimba = (f: number, seg: number) =>
		voz(seg, (t) =>
			(Math.sin(TAU * f * t) * Math.exp(-t / 0.35) +
				0.25 * Math.sin(TAU * 4 * f * t) * Math.exp(-t / 0.05) +
				0.08 * Math.sin(TAU * 10 * f * t) * Math.exp(-t / 0.015)) *
			ataque(t, 0.0015) * Math.min(1, (seg - t) / 0.02));
	const pulsado = (f: number, seg: number) =>
		voz(seg, (t) => {
			let s = 0;
			for (let h = 1; h <= 6; h++) s += (Math.sin(TAU * h * f * t) / h) * Math.exp(-t * (3 + h * 5));
			return s * ataque(t, 0.003) * Math.min(1, (seg - t) / 0.02);
		});

	for (let n = 0; (seccionEn || n < progresion.length) && n * compas < DUR; n++) {
		const t0 = n * compas;
		const a = acordeEn(n);
		const s = seccion(n);

		// batería
		for (let tm = 0; tm < 4; tm++) {
			const tt = t0 + tm * tiempo;
			if (s === 'C' || tm % 2 === 0) mezclar(bateria, bombo(), tt, 0, s === 'B' ? 0.7 : 0.9);
			if (s === 'C' && tm % 2 === 1) mezclar(bateria, palmada(), tt, 0.1, 0.3);
		}
		const pasosHat = s === 'C' ? 16 : 8;
		for (let p = 0; p < pasosHat; p++) {
			const enContra = s === 'C' ? p % 4 === 2 : p % 2 === 1;
			if (s !== 'C' && !enContra) continue;
			const g = (enContra ? 0.12 : 0.05) * (s === 'B' ? 0.7 : 1) * (0.85 + 0.3 * rng());
			mezclar(bateria, platillo(enContra ? 0.03 : 0.015), t0 + (p * compas) / pasosHat, -0.3, g);
		}

		// bajo
		const patron = bajos[s];
		patron.forEach(([oct, k], i) => {
			const sig = i + 1 < patron.length ? patron[i + 1][0] : 8;
			mezclar(bajo, pulsado(midiAHz(tono(a, k) - 24), (sig - oct) * octavo), t0 + oct * octavo, 0, 0.4);
		});

		// melodía (marimba); en B baja una octava y suena más suave
		const plantilla = melodias[s][n % 2];
		plantilla.forEach((k, oct) => {
			if (k === null) return;
			const m = tono(a, k) + (s === 'B' ? 0 : 12);
			const g = (s === 'B' ? 0.22 : 0.3) * (0.85 + 0.15 * rng());
			mezclar(mel, marimba(midiAHz(m), 0.6), t0 + oct * octavo, 0.2, g);
		});

		// colchón: acorde suave, un poco desafinado entre canales para dar amplitud
		const gPad = s === 'B' ? 0.1 : 0.05;
		for (const k of [0, 1, 2]) {
			const f = midiAHz(tono(a, k));
			const env = (t: number) => Math.min(1, t / 0.3) * Math.min(1, (compas - t) / 0.3);
			mezclar(pad, voz(compas, (t) => env(t) * (Math.sin(TAU * f * 0.9985 * t) + 0.2 * Math.sin(TAU * 2 * f * t))), t0, -0.8, gPad);
			mezclar(pad, voz(compas, (t) => env(t) * (Math.sin(TAU * f * 1.0015 * t) + 0.2 * Math.sin(TAU * 2 * f * t))), t0, 0.8, gPad);
		}
	}

	// eco ping-pong de octavo con puntillo sobre la melodía
	const retardo = muestras(octavo * 1.5);
	const salida = estereo(DUR);
	const eco = { l: new Float32Array(salida.l.length), r: new Float32Array(salida.l.length) };
	for (let i = 0; i < salida.l.length; i++) {
		const prevL = i >= retardo ? eco.l[i - retardo] : 0;
		const prevR = i >= retardo ? eco.r[i - retardo] : 0;
		eco.l[i] = mel.r[i] * 0.5 + prevR * 0.35; // cruza de canal en cada rebote
		eco.r[i] = mel.l[i] * 0.5 + prevL * 0.35;
		salida.l[i] = bateria.l[i] + bajo.l[i] + mel.l[i] + pad.l[i] + eco.l[i] * 0.35;
		salida.r[i] = bateria.r[i] + bajo.r[i] + mel.r[i] + pad.r[i] + eco.r[i] * 0.35;
	}

	normalizar(salida, -6);
	fundidos(salida, 0.01, 1.0);
	return salida;
}

// ---------- principal ----------

fs.mkdirSync(SALIDA, { recursive: true });
guardarSfx('moneda.wav', moneda());
guardarSfx('monedas.wav', monedas());
guardarSfx('whoosh.wav', whoosh());
guardarSfx('pop.wav', pop());
guardarSfx('kaching.wav', kaching());
guardarSfx('triste.wav', triste());
guardarSfx('boing.wav', boing());
guardarSfx('sube.wav', sube());
guardarSfx('golpe.wav', golpe());
escribirWav('musica.wav', musica());

// Pista larga para el reel narrado: dura lo que la narración + 2 s y sus secciones siguen las escenas de
// proyectos/2026-11-15-finanzas-3d/voz/narracion.json (B durante la inflación, C desde los intereses).
// Otro reel: --musica-para <narracion.json> --secciones B=<escena>,C=<escena> --destino <carpeta>
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const otra = arg('--musica-para');
if (otra) {
	const n = JSON.parse(fs.readFileSync(path.resolve(otra), 'utf8')) as {duracion_s: number; escenas: {id: string; inicio: number}[]};
	const sec = Object.fromEntries((arg('--secciones') ?? 'B=inflacion,C=intereses').split(',').map((x) => x.split('=')));
	const inicio = (id?: string) => n.escenas.find((e) => e.id === id)?.inicio ?? Infinity;
	const b = inicio(sec.B), c = inicio(sec.C);
	const destino = path.resolve(arg('--destino') ?? SALIDA);
	fs.mkdirSync(destino, {recursive: true});
	const pista = musica(Math.ceil(n.duracion_s + 2), (t) => (t + 0.5 < b ? 'A' : t + 0.5 < c ? 'B' : 'C'));
	escribirWav('musica-larga.wav', pista, destino);
	console.log(`Música para ${otra} → ${destino}`);
}

const NARRACION = path.join(SALIDA, '..', 'voz', 'narracion.json');
if (!otra && fs.existsSync(NARRACION)) {
	const n = JSON.parse(fs.readFileSync(NARRACION, 'utf8')) as {duracion_s: number; escenas: {id: string; inicio: number}[]};
	const inicio = (id: string) => n.escenas.find((e) => e.id === id)?.inicio ?? Infinity;
	const b = inicio('inflacion'), c = inicio('intereses');
	escribirWav('musica-larga.wav', musica(Math.ceil(n.duracion_s + 2), (t) => (t + 0.5 < b ? 'A' : t + 0.5 < c ? 'B' : 'C')));
} else if (!otra) {
	console.log('Sin narracion.json todavía: no hice musica-larga.wav (corre primero voz-finanzas.ts).');
}
console.log(`Listo: ${SALIDA}`);
