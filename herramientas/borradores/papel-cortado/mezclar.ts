/**
 * Voz y mezcla final del reel "PapelCortado".
 *   npx tsx herramientas/borradores/papel-cortado/mezclar.ts <N>
 *
 * Necesita (en proyectos/2026-11-13-papel-cortado/):
 *   - salida/video-vN-mudo.mp4   (render-papel.ts video N)
 *   - audio/musica-vN.wav y audio/sfx-vN.wav   (audio.ts N)
 *   - voz/originales/toma1…toma4 (las grabaciones de James, 2026-11-14; no se versionan)
 * Hace:
 *   1. voz/voz-vN.wav: corta cada frase de su toma (cortes medidos con silencedetect) y la coloca en su escena
 *      (src/papel/tiempos.ts), con highpass 80 Hz + afftdn + compresor, normalizada a −16 LUFS.
 *   2. salida/final-vN.mp4: la música baja sola bajo la voz (sidechaincompress), mezcla música / efectos / voz con
 *      pesos 1 / 0.8 / 1.15 y deja todo en −14 LUFS con pico ≤ −2 dBTP (loudnorm + alimiter). Nunca sobrescribe.
 * Si cambian las tomas, vuelve a medir los cortes (silencedetect=noise=-38dB:d=0.12) y ajusta FRASES.
 */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DURACION_PAPEL, FPS_PAPEL, INICIOS_ESCENAS} from '../../../src/papel/tiempos.ts';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const P = join(RAIZ, 'proyectos', '2026-11-13-papel-cortado');
const TOMAS = ['toma1-ves-cientos.wav', 'toma2-consumir.wav', 'toma3-informacion.wav', 'toma4-elige-ponla-sigueme.wav'];

/**
 * Cada frase: de qué toma sale, qué tramos (s) se toman (varios = se pegan, para acortar una pausa), en qué escena
 * va, en qué cuadro local de esa escena empieza la VOZ y cuánto silencio trae el corte antes de la voz (s).
 */
const FRASES = [
	{texto: '¿Ves cientos de videos de productividad… y nada cambia?', toma: 0, tramos: [[0.6, 2.42], [2.7, 3.65]], escena: 0, cuadro: 3, previo: 0.06},
	{texto: 'Consumir no es aprender.', toma: 1, tramos: [[0.7, 2.1]], escena: 1, cuadro: 6, previo: 0.06},
	{texto: 'Información sin acción es igual a cero resultados.', toma: 2, tramos: [[0.58, 3.15]], escena: 2, cuadro: 6, previo: 0.04},
	{texto: 'Elige una sola cosa…', toma: 3, tramos: [[0.68, 1.84]], escena: 3, cuadro: 4, previo: 0.04},
	{texto: '…y ponla en práctica hoy.', toma: 3, tramos: [[2.14, 3.52]], escena: 4, cuadro: 12, previo: 0.04},
	{texto: 'Sígueme para aprender a aplicarlo.', toma: 3, tramos: [[3.6, 5.48]], escena: 5, cuadro: 4, previo: 0.04},
];

function ffmpeg(args: string[], que: string): void {
	const r = spawnSync('ffmpeg', ['-v', 'error', ...args], {stdio: 'inherit'});
	if (r.status !== 0) {
		console.error(`No pude ${que} (ffmpeg salió con ${r.status}). Siguiente paso: revisa el mensaje de arriba.`);
		process.exit(1);
	}
}

const v = process.argv[2];
if (!v || !/^\d+$/.test(v)) {
	console.error('usa: npx tsx herramientas/borradores/papel-cortado/mezclar.ts <N>');
	process.exit(2);
}
const video = join(P, 'salida', `video-v${v}-mudo.mp4`);
const musica = join(P, 'audio', `musica-v${v}.wav`);
const sfx = join(P, 'audio', `sfx-v${v}.wav`);
const final = join(P, 'salida', `final-v${v}.mp4`);
for (const f of [video, musica, sfx, ...TOMAS.map((t) => join(P, 'voz', 'originales', t))]) {
	if (!existsSync(f)) {
		console.error(`Falta ${f}. Siguiente paso: genéralo (render-papel.ts / audio.ts) o copia ahí las tomas de voz.`);
		process.exit(2);
	}
}
if (existsSync(final)) {
	console.error(`${final} ya existe y no lo sobrescribo. Siguiente paso: usa una versión nueva.`);
	process.exit(2);
}

// 1 · voz colocada
const duracion = DURACION_PAPEL / FPS_PAPEL;
const partes: string[] = [];
const usos = TOMAS.map((_, i) => FRASES.reduce((n, f) => n + f.tramos.filter(() => f.toma === i).length, 0));
TOMAS.forEach((_, i) => {
	if (usos[i] > 0) partes.push(`[${i}:a]aformat=channel_layouts=mono,asplit=${usos[i]}${Array.from({length: usos[i]}, (_, k) => `[t${i}_${k}]`).join('')}`);
});
const siguiente = TOMAS.map(() => 0);
FRASES.forEach((f, j) => {
	const piezas = f.tramos.map(([a, b], k) => {
		partes.push(`[t${f.toma}_${siguiente[f.toma]++}]atrim=${a}:${b},asetpts=PTS-STARTPTS[f${j}_${k}]`);
		return `[f${j}_${k}]`;
	});
	const ms = Math.round(((INICIOS_ESCENAS[f.escena] + f.cuadro) / FPS_PAPEL - f.previo) * 1000);
	const unida = piezas.length > 1 ? `${piezas.join('')}concat=n=${piezas.length}:v=0:a=1,` : piezas[0];
	partes.push(`${unida}adelay=${ms}:all=1[p${j}]`);
	console.log(`frase ${j + 1} → ${(ms / 1000).toFixed(2)} s: ${f.texto}`);
});
partes.push(
	`${FRASES.map((_, j) => `[p${j}]`).join('')}amix=inputs=${FRASES.length}:normalize=0:duration=longest,highpass=f=80,afftdn=nf=-30,` +
		`acompressor=threshold=-22dB:ratio=3:attack=5:release=90:makeup=2,apad=whole_dur=${duracion},atrim=0:${duracion},loudnorm=I=-16:TP=-3:LRA=7[out]`,
);
const voz = join(P, 'voz', `voz-v${v}.wav`);
ffmpeg(['-y', ...TOMAS.flatMap((t) => ['-i', join(P, 'voz', 'originales', t)]), '-filter_complex', partes.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '1', voz], 'armar la voz');

// 2 · mezcla final
ffmpeg(
	[
		'-i', video, '-i', musica, '-i', sfx, '-i', voz,
		'-filter_complex',
		'[3:a]aformat=channel_layouts=stereo,asplit=2[voz][vozsc];[1:a][vozsc]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350:makeup=1[musd];' +
			'[musd][2:a][voz]amix=inputs=3:normalize=0:weights=1 0.8 1.15,loudnorm=I=-14:TP=-2.5:LRA=11,alimiter=limit=0.8:level=false[a]',
		'-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final,
	],
	'mezclar el final',
);
console.log(`listo: ${final}`);
