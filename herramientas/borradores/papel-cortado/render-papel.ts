/**
 * Render del reel "PapelCortado" (src/papel/PapelCortado.tsx).
 *   npx tsx herramientas/borradores/papel-cortado/render-papel.ts stills 75,170,...   → proyectos/2026-11-13-papel-cortado/revision/fN.png
 *   npx tsx herramientas/borradores/papel-cortado/render-papel.ts video <N>           → proyectos/2026-11-13-papel-cortado/salida/video-vN-mudo.mp4
 * El audio sale de audio.ts (misma carpeta) y se mezcla con ffmpeg (ver ESTADO.md).
 *
 * Windows: Remotion no puede crear symlinks del public/ (EPERM sin modo desarrollador) ni bajar su navegador, así que
 * usa un public/ propio del proyecto con solo la fuente que hace falta (se copia aquí si falta) y el Chrome instalado
 * (EDITOR_CHROME para otra ruta).
 */
import {copyFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..', '..');
const PROYECTO = join(RAIZ, 'proyectos', '2026-11-13-papel-cortado');
const CHROME = process.env.EDITOR_CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// public/ propio: solo TikTok Sans ExtraBold (OFL-1.1) con su licencia.
const FUENTE = join('biblioteca', 'fuentes', 'tiktok-sans');
const PUBLICO = join(PROYECTO, 'public');
mkdirSync(join(PUBLICO, FUENTE), {recursive: true});
for (const f of ['TikTokSans-ExtraBold.ttf', 'OFL.txt']) {
	if (!existsSync(join(PUBLICO, FUENTE, f))) copyFileSync(join(RAIZ, FUENTE, f), join(PUBLICO, FUENTE, f));
}

const [modo, arg] = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: join(RAIZ, 'src', 'index.ts'), rootDir: RAIZ, publicDir: PUBLICO, enableCaching: true});
const comun = {serveUrl, browserExecutable: CHROME, chromeMode: 'chrome-for-testing' as const, logLevel: 'error' as const};
const composition = await selectComposition({...comun, id: 'PapelCortado'});

if (modo === 'stills') {
	const dir = join(PROYECTO, 'revision');
	mkdirSync(dir, {recursive: true});
	for (const f of (arg ?? '0').split(',').map(Number)) {
		await renderStill({...comun, composition, frame: f, output: join(dir, `f${f}.png`), overwrite: true});
		console.log(`cuadro ${f} → revision/f${f}.png`);
	}
} else if (modo === 'video') {
	const v = arg ?? '1';
	const dir = join(PROYECTO, 'salida');
	mkdirSync(dir, {recursive: true});
	let ultimo = -1;
	await renderMedia({
		...comun,
		composition,
		codec: 'h264',
		crf: 16,
		pixelFormat: 'yuv420p',
		imageFormat: 'jpeg',
		jpegQuality: 95,
		// v1 salió sin audio como final; desde v2 el video sale mudo y se mezcla con audio.ts (ver mezclar en README).
		outputLocation: join(dir, v === '1' ? 'final-v1.mp4' : `video-v${v}-mudo.mp4`),
		overwrite: false,
		muted: true,
		onProgress: ({progress}) => {
			const p = Math.floor(progress * 10);
			if (p > ultimo) {
				ultimo = p;
				console.log(`video ${p * 10} %`);
			}
		},
	});
	console.log(`listo: salida/${v === '1' ? 'final-v1.mp4' : `video-v${v}-mudo.mp4`}`);
} else {
	console.error('usa: render-papel.ts stills 0,90,…  |  render-papel.ts video <N>');
	process.exit(2);
}

