/**
 * Render de una composición de borrador en Windows (también sirve en macOS/Linux con EDITOR_CHROME).
 *   npx tsx herramientas/borradores/render-windows.ts <Composicion> stills <c1,c2,…> --salida <carpeta> [--public <carpeta>] [--gl angle]
 *   npx tsx herramientas/borradores/render-windows.ts <Composicion> video <archivo.mp4> [--public <carpeta>] [--gl angle] [--mudo]
 *
 * Por qué existe: en Windows sin modo desarrollador Remotion no puede recrear los symlinks/junctions de public/ al
 * empaquetar (EPERM) ni bajar su navegador. Aquí se usa el Chrome instalado (EDITOR_CHROME para otra ruta) y un
 * public/ chico que tú armas con SOLO lo que la composición pide por staticFile() (fuentes, narración, sonidos),
 * con copias reales, no enlaces. Sin --public se usa una carpeta vacía (sirve para composiciones que no cargan nada).
 * --gl: motor de WebGL para el 3D (@remotion/three). En Windows "angle" usa la GPU; "swangle" es por software.
 * Nunca sobrescribe un MP4 que ya existe.
 */
import {existsSync, mkdirSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';

type Gl = 'angle' | 'swangle' | 'egl' | 'swiftshader' | 'vulkan' | 'angle-egl';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.EDITOR_CHROME ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USO = 'usa: render-windows.ts <Composicion> stills <c1,c2> --salida <carpeta> | video <archivo.mp4> [--public <carpeta>] [--gl angle] [--mudo]';

const {values: v, positionals: [id, modo, objetivo]} = parseArgs({
	allowPositionals: true,
	options: {public: {type: 'string'}, gl: {type: 'string', default: 'angle'}, salida: {type: 'string'}, mudo: {type: 'boolean', default: false}},
});
if (!id || !modo || !objetivo) {
	console.error(USO);
	process.exit(2);
}
const publicDir = v.public ? resolve(v.public) : mkdtempSync(join(tmpdir(), 'borrador-public-'));
if (!existsSync(publicDir)) {
	console.error(`No existe la carpeta --public ${publicDir}. Siguiente paso: créala con lo que pide la composición.`);
	process.exit(2);
}

const serveUrl = await bundle({entryPoint: join(RAIZ, 'src', 'index.ts'), rootDir: RAIZ, publicDir, enableCaching: true});
const comun = {serveUrl, browserExecutable: CHROME, chromeMode: 'chrome-for-testing' as const, logLevel: 'error' as const, chromiumOptions: {gl: v.gl as Gl}};
const composition = await selectComposition({...comun, id});

if (modo === 'stills') {
	const dir = resolve(v.salida ?? '.');
	mkdirSync(dir, {recursive: true});
	for (const f of objetivo.split(',').map(Number)) {
		const t0 = Date.now();
		await renderStill({...comun, composition, frame: f, output: join(dir, `${id}-f${f}.png`), overwrite: true});
		console.log(`cuadro ${f} → ${join(dir, `${id}-f${f}.png`)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
	}
} else if (modo === 'video') {
	const salida = resolve(objetivo);
	if (existsSync(salida)) {
		console.error(`${salida} ya existe y no lo sobrescribo. Siguiente paso: usa otro nombre (versión nueva).`);
		process.exit(2);
	}
	mkdirSync(dirname(salida), {recursive: true});
	let ultimo = -1;
	await renderMedia({
		...comun,
		composition,
		codec: 'h264',
		crf: 16,
		pixelFormat: 'yuv420p',
		imageFormat: 'jpeg',
		jpegQuality: 95,
		outputLocation: salida,
		overwrite: false,
		muted: v.mudo,
		onProgress: ({progress}) => {
			const p = Math.floor(progress * 10);
			if (p > ultimo) {
				ultimo = p;
				console.log(`video ${p * 10} %`);
			}
		},
	});
	console.log(`listo: ${salida}`);
} else {
	console.error(USO);
	process.exit(2);
}
