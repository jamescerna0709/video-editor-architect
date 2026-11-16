/**
 * Audio del reel "PapelCortado", sintetizado aquí mismo (sin samples de nadie: licencia propia de James).
 *   npx tsx herramientas/borradores/papel-cortado/audio.ts <N>   → proyectos/2026-11-13-papel-cortado/audio/musica-vN.wav, audio/sfx-vN.wav, audio/mezcla-vN.wav
 *
 * - Música: ritmo lo-fi a 96 BPM (bombo, palmas, hi-hats con swing, bajo y acordes de piano eléctrico
 *   Am7 – Fmaj7 – Cmaj7 – G6), crujido de vinilo suave y salida en fade.
 * - Efectos: deslizamientos de papel, tarjetas que caen, pops, sellos, plumón de la palomita, campanita y un
 *   "womp" para la barra en 0 %. Cada uno va en el cuadro de su animación (src/papel/PapelCortado.tsx, 30 fps).
 * Los WAV salen en 48 kHz estéreo 16 bit; la sonoridad final (−14 LUFS) la pone ffmpeg al mezclar con el video.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DURACION_PAPEL, INICIOS_ESCENAS} from '../../../src/papel/tiempos.ts';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const FPS = 30;
const DURACION = DURACION_PAPEL / FPS; // igual que la composición (src/papel/tiempos.ts)
const N = Math.ceil(DURACION * SR);

// ───────────────────────── utilidades ─────────────────────────

let semilla = 12345;
const ruido = (): number => {
	semilla = (semilla * 1664525 + 1013904223) >>> 0;
	return (semilla / 4294967296) * 2 - 1;
};
const azar = (s: number): number => {
	let t = (s * 2654435761 + 0x6d2b79f5) >>> 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Pista = {l: Float32Array; r: Float32Array};
const pista = (): Pista => ({l: new Float32Array(N), r: new Float32Array(N)});

/** Suma una muestra con paneo (−1 izquierda, 1 derecha). */
function sumar(p: Pista, i: number, v: number, pan = 0): void {
	if (i < 0 || i >= N) return;
	p.l[i] += v * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
	p.r[i] += v * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
}

/** Biquad pasa-banda (RBJ) con frecuencia que puede cambiar en cada muestra. */
function pasaBanda(): (x: number, f: number, q: number) => number {
	let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	return (x, f, q) => {
		const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
		const alfa = Math.sin(w) / (2 * q);
		const a0 = 1 + alfa;
		const b0 = alfa / a0, b2 = -alfa / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alfa) / a0;
		const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1; x1 = x; y2 = y1; y1 = y;
		return y;
	};
}
/** Pasa-bajas de un polo. */
function pasaBajas(f: number): (x: number) => number {
	const a = Math.exp((-2 * Math.PI * f) / SR);
	let y = 0;
	return (x) => (y = (1 - a) * x + a * y);
}

const seg = (cuadro: number): number => cuadro / FPS;

// ───────────────────────── instrumentos ─────────────────────────

function bombo(p: Pista, t: number, g = 0.9): void {
	const i0 = Math.round(t * SR);
	let fase = 0;
	for (let k = 0; k < SR * 0.4; k++) {
		const s = k / SR;
		const f = 45 + 85 * Math.exp(-s * 28);
		fase += (2 * Math.PI * f) / SR;
		const env = Math.exp(-s * 9) * Math.min(1, k / 40);
		sumar(p, i0 + k, Math.sin(fase) * env * g);
	}
}
function palma(p: Pista, t: number, g = 0.3): void {
	const i0 = Math.round(t * SR);
	const bp = pasaBanda();
	for (let k = 0; k < SR * 0.22; k++) {
		const s = k / SR;
		// tres golpecitos muy juntos y la cola
		const env = (s < 0.03 ? 0.6 + 0.4 * Math.cos(s * 2 * Math.PI * 100) : 1) * Math.exp(-s * 18);
		sumar(p, i0 + k, bp(ruido(), 1400, 1.2) * env * g * 2.2, 0.1);
	}
}
function hat(p: Pista, t: number, g = 0.08, pan = -0.25): void {
	const i0 = Math.round(t * SR);
	let prev = 0;
	for (let k = 0; k < SR * 0.06; k++) {
		const x = ruido();
		const hp = x - prev;
		prev = x;
		sumar(p, i0 + k, hp * Math.exp((-k / SR) * 70) * g, pan);
	}
}
function bajo(p: Pista, t: number, f: number, dur: number, g = 0.32): void {
	const i0 = Math.round(t * SR);
	const lp = pasaBajas(400);
	for (let k = 0; k < SR * dur; k++) {
		const s = k / SR;
		const env = Math.min(1, k / 200) * Math.exp(-s * 2.2) * (s > dur - 0.05 ? (dur - s) / 0.05 : 1);
		const v = Math.sin(2 * Math.PI * f * s) + 0.35 * Math.sin(4 * Math.PI * f * s) + 0.15 * Math.sign(Math.sin(2 * Math.PI * f * s));
		sumar(p, i0 + k, lp(v) * env * g);
	}
}
function piano(p: Pista, t: number, f: number, dur: number, g = 0.05, pan = 0): void {
	const i0 = Math.round(t * SR);
	const lp = pasaBajas(2200);
	for (let k = 0; k < SR * (dur + 0.6); k++) {
		const s = k / SR;
		const env = Math.min(1, k / 300) * Math.exp(-s * 1.4) * (s > dur ? Math.exp(-(s - dur) * 8) : 1);
		const trem = 1 + 0.12 * Math.sin(2 * Math.PI * 4.5 * s);
		const v = Math.sin(2 * Math.PI * f * s) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * s) + 0.25 * Math.sin(4 * Math.PI * f * s) * Math.exp(-s * 6);
		sumar(p, i0 + k, lp(v) * env * trem * g, pan);
	}
}

// Efectos

/** Papel que se desliza: ruido en pasa-banda que barre de grave a agudo (o al revés). */
function deslizar(p: Pista, t: number, dur = 0.32, g = 0.35, sube = true, pan = 0): void {
	const i0 = Math.round(t * SR);
	const bp = pasaBanda();
	const n = Math.round(dur * SR);
	for (let k = 0; k < n; k++) {
		const u = k / n;
		const f = sube ? 500 + 3500 * u * u : 4000 - 3300 * u;
		const env = Math.sin(Math.PI * Math.pow(u, 0.7)) ** 1.5;
		sumar(p, i0 + k, bp(ruido(), f, 0.9) * env * g * 2.5, pan * (u * 2 - 1));
	}
}
/** Tarjeta de papel que cae sobre otra: golpecito grave + roce. */
function toque(p: Pista, t: number, g = 0.4, tono = 1, pan = 0): void {
	const i0 = Math.round(t * SR);
	const bp = pasaBanda();
	for (let k = 0; k < SR * 0.12; k++) {
		const s = k / SR;
		const v = Math.sin(2 * Math.PI * 170 * tono * s) * Math.exp(-s * 45) * 0.8 + bp(ruido(), 2500 * tono, 0.8) * Math.exp(-s * 60) * 1.6;
		sumar(p, i0 + k, v * g, pan);
	}
}
/** Pop: tono que sube rápido. */
function pop(p: Pista, t: number, g = 0.3, base = 380): void {
	const i0 = Math.round(t * SR);
	let fase = 0;
	for (let k = 0; k < SR * 0.12; k++) {
		const s = k / SR;
		const f = base + 700 * (1 - Math.exp(-s * 40));
		fase += (2 * Math.PI * f) / SR;
		sumar(p, i0 + k, Math.sin(fase) * Math.exp(-s * 30) * Math.min(1, k / 30) * g);
	}
}
/** Sello: golpe grave con cuerpo. */
function sello(p: Pista, t: number, g = 0.55): void {
	bombo(p, t, g * 0.8);
	const i0 = Math.round(t * SR);
	const lp = pasaBajas(1800);
	for (let k = 0; k < SR * 0.09; k++) sumar(p, i0 + k, lp(ruido()) * Math.exp((-k / SR) * 50) * g * 1.4);
}
/** Plumón dibujando: ráfagas de ruido agudo con trazos. */
function plumon(p: Pista, t0: number, t1: number, g = 0.22): void {
	const i0 = Math.round(t0 * SR);
	const n = Math.round((t1 - t0) * SR);
	const bp = pasaBanda();
	for (let k = 0; k < n; k++) {
		const u = k / n;
		const trazo = 0.55 + 0.45 * Math.sin(2 * Math.PI * 9 * u * (t1 - t0) + 1);
		const env = Math.min(1, u * 12) * Math.min(1, (1 - u) * 8);
		sumar(p, i0 + k, bp(ruido(), 3200 + 800 * Math.sin(u * 20), 1.5) * trazo * env * g * 3, 0.15);
	}
}
/** Campanita. */
function campana(p: Pista, t: number, g = 0.16, f = 1318.5): void {
	const i0 = Math.round(t * SR);
	for (let k = 0; k < SR * 1.1; k++) {
		const s = k / SR;
		const v = Math.sin(2 * Math.PI * f * s) * Math.exp(-s * 4) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * s) * Math.exp(-s * 9) + 0.3 * Math.sin(2 * Math.PI * f * 1.5 * s) * Math.exp(-s * 5);
		sumar(p, i0 + k, v * Math.min(1, k / 60) * g, 0.2);
	}
}
/** "Womp womp": dos notas que caen (la barra se queda en 0 %). */
function womp(p: Pista, t: number, g = 0.2): void {
	for (const [dt, f0, f1] of [[0, 392, 330], [0.28, 330, 220]] as const) {
		const i0 = Math.round((t + dt) * SR);
		let fase = 0;
		const n = SR * 0.34;
		for (let k = 0; k < n; k++) {
			const u = k / n;
			const f = f0 + (f1 - f0) * u * u;
			fase += (2 * Math.PI * f) / SR;
			const v = Math.sin(fase) + 0.3 * Math.sin(2 * fase) + 0.15 * Math.sin(3 * fase);
			sumar(p, i0 + k, v * Math.min(1, k / 200) * (1 - u) ** 0.6 * g);
		}
	}
}

// ───────────────────────── música ─────────────────────────

function musica(): Pista {
	const p = pista();
	const bpm = 96;
	const b = 60 / bpm; // un tiempo
	const compas = 4 * b;
	const swing = b * 0.08;
	const nota = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
	// raíz del bajo y notas del acorde (MIDI)
	const acordes: Array<{raiz: number; notas: number[]}> = [
		{raiz: 45, notas: [57, 60, 64, 67]}, // Am7
		{raiz: 41, notas: [53, 57, 60, 64]}, // Fmaj7
		{raiz: 48, notas: [55, 59, 60, 64]}, // Cmaj7
		{raiz: 43, notas: [55, 59, 62, 64]}, // G6
	];
	const compases = Math.ceil(DURACION / compas);
	for (let c = 0; c < compases; c++) {
		const t0 = c * compas;
		const a = acordes[c % acordes.length];
		// acordes: uno largo al inicio del compás y un toque suave en el "y" del 3
		a.notas.forEach((n, j) => piano(p, t0 + j * 0.012, nota(n), compas * 0.62, 0.045, (j - 1.5) * 0.25));
		a.notas.slice(1).forEach((n, j) => piano(p, t0 + 2.5 * b + j * 0.01, nota(n + 12), b * 0.8, 0.018, 0.3));
		bajo(p, t0, nota(a.raiz), b * 1.6);
		bajo(p, t0 + 2.5 * b, nota(a.raiz), b * 0.9, 0.24);
		bajo(p, t0 + 3.5 * b, nota(a.raiz + 7), b * 0.45, 0.2);
		// batería (el primer compás solo con hats para que el gancho respire)
		for (let k = 0; k < 8; k++) hat(p, t0 + k * (b / 2) + (k % 2 ? swing : 0), k % 2 ? 0.05 : 0.08, k % 4 === 0 ? -0.3 : -0.15);
		if (c >= 1) {
			bombo(p, t0, 0.75);
			bombo(p, t0 + 1.75 * b, 0.45);
			bombo(p, t0 + 2.5 * b, 0.6);
			palma(p, t0 + b);
			palma(p, t0 + 3 * b);
		}
	}
	// vinilo: crujidos sueltos + soplido muy bajo
	const lp = pasaBajas(900);
	for (let i = 0; i < N; i++) {
		const v = lp(ruido()) * 0.012;
		p.l[i] += v;
		p.r[i] += v;
		if (azar(i) < 0.00012) sumar(p, i, (azar(i + 1) - 0.5) * 0.18, azar(i + 2) * 2 - 1);
	}
	// fade de entrada corto y de salida al final
	for (let i = 0; i < N; i++) {
		const t = i / SR;
		const g = Math.min(1, t / 0.15) * Math.min(1, (DURACION - t) / 1.4);
		p.l[i] *= g;
		p.r[i] *= g;
	}
	return p;
}

// ───────────────────────── efectos en la línea de tiempo ─────────────────────────

function efectos(): Pista {
	const p = pista();
	/** Segundo de un cuadro local de la escena k (0–5). */
	const en = (k: number, local: number): number => seg(INICIOS_ESCENAS[k] + local);
	// 1 · gancho
	deslizar(p, en(0, 0), 0.4, 0.3, true);
	deslizar(p, en(0, 5), 0.3, 0.25, true, -0.4);
	for (let i = 0; i < 9; i++) toque(p, en(0, 10 + 6 * (i + 1)), 0.22, 0.9 + azar(i) * 0.3, (azar(i + 9) - 0.5) * 0.6);
	deslizar(p, en(0, 55), 0.3, 0.3, true, 0.3); // "…Y NADA CAMBIA?" entra en el cuadro 56, con la voz
	sello(p, en(0, 61), 0.45);
	// barridos entre escenas: la hoja cruza en ~14 cuadros desde (corte − 7)
	for (const corte of INICIOS_ESCENAS.slice(1)) deslizar(p, seg(corte - 7), 0.46, 0.42, false, -0.6);
	// 2 · consumir no es aprender
	deslizar(p, en(1, 4), 0.28, 0.24, true, 0.3);
	for (let i = 0; i < 7; i++) toque(p, en(1, 2 + 4 * i + 9), 0.35, 0.85 + azar(i + 20) * 0.2, (azar(i + 30) - 0.5) * 0.5);
	pop(p, en(1, 26), 0.3);
	sello(p, en(1, 29), 0.5);
	// 3 · información sin acción: tarjetas cada 4 cuadros, barra en 32, "= CERO RESULTADOS" en 44, womp al final de la voz
	deslizar(p, en(2, 4), 0.28, 0.24, true, -0.3);
	deslizar(p, en(2, 0), 0.36, 0.2, true, 0.2);
	for (let i = 0; i < 6; i++) {
		deslizar(p, en(2, 8 + 4 * i), 0.18, 0.12, true, i % 2 ? 0.7 : -0.7);
		toque(p, en(2, 8 + 4 * i + 9), 0.24, 1.1 + azar(i + 40) * 0.2);
	}
	deslizar(p, en(2, 32), 0.3, 0.22, true);
	deslizar(p, en(2, 44), 0.28, 0.22, true, 0.3);
	sello(p, en(2, 49), 0.45);
	womp(p, en(2, 84), 0.2);
	// 4 · elige una cosa
	deslizar(p, en(3, 2), 0.28, 0.24, true, -0.3);
	for (let i = 0; i < 5; i++) toque(p, en(3, 6 + 4 * i + 8), 0.22, 1 + azar(i + 50) * 0.2, (i - 2) * 0.3);
	deslizar(p, en(3, 40), 0.5, 0.4, false, 0.6);
	pop(p, en(3, 52), 0.32, 450);
	campana(p, en(3, 54), 0.14);
	// 5 · ponla en práctica hoy
	deslizar(p, en(4, 0), 0.4, 0.28, true);
	deslizar(p, en(4, 4), 0.28, 0.22, true, -0.3);
	plumon(p, en(4, 22), en(4, 40), 0.2);
	campana(p, en(4, 40), 0.16, 1568);
	sello(p, en(4, 46), 0.55);
	pop(p, en(4, 50), 0.22, 500);
	// 6 · cierre
	deslizar(p, en(5, 2), 0.28, 0.24, true, -0.3);
	deslizar(p, en(5, 12), 0.28, 0.24, true, 0.3);
	pop(p, en(5, 26), 0.3, 420);
	campana(p, en(5, 28), 0.14, 1318.5);
	return p;
}

// ───────────────────────── salida ─────────────────────────

/** `auto`: baja la ganancia si el pico pasa de 0.98. Las pistas separadas (stems) van sin auto, con ganancia fija. */
function escribirWav(ruta: string, p: Pista, ganancia = 1, auto = true): void {
	let pico = 0;
	for (let i = 0; i < N; i++) pico = Math.max(pico, Math.abs(p.l[i] * ganancia), Math.abs(p.r[i] * ganancia));
	const g = auto && pico > 0.98 ? (0.98 / pico) * ganancia : ganancia;
	const datos = Buffer.alloc(N * 4);
	for (let i = 0; i < N; i++) {
		datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, p.l[i] * g)) * 32767), i * 4);
		datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, p.r[i] * g)) * 32767), i * 4 + 2);
	}
	const h = Buffer.alloc(44);
	h.write('RIFF', 0); h.writeUInt32LE(36 + datos.length, 4); h.write('WAVE', 8);
	h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
	h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
	h.write('data', 36); h.writeUInt32LE(datos.length, 40);
	writeFileSync(ruta, Buffer.concat([h, datos]));
}

const v = process.argv[2] ?? '2';
const dir = join(AQUI, '..', '..', '..', 'proyectos', '2026-11-13-papel-cortado', 'audio');
mkdirSync(dir, {recursive: true});
const m = musica();
const e = efectos();
const mezcla = pista();
for (let i = 0; i < N; i++) {
	mezcla.l[i] = m.l[i] * 0.55 + e.l[i];
	mezcla.r[i] = m.r[i] * 0.55 + e.r[i];
}
// Stems con la MISMA proporción que la mezcla (música × 0.55, efectos × 1) y ganancia fija 0.5: así se pueden
// mezclar con la voz en ffmpeg sin que cambie el balance entre ellas.
escribirWav(join(dir, `musica-v${v}.wav`), {l: m.l.map((x) => x * 0.55), r: m.r.map((x) => x * 0.55)}, 0.5, false);
escribirWav(join(dir, `sfx-v${v}.wav`), e, 0.5, false);
escribirWav(join(dir, `mezcla-v${v}.wav`), mezcla);
console.log(`listo: audio/musica-v${v}.wav, audio/sfx-v${v}.wav, audio/mezcla-v${v}.wav (${DURACION} s, ${SR} Hz)`);
