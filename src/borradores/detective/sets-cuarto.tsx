// Sets 3D del reel "El caso del yapeo fantasma" (Alcanza, app del creador): cuarto en corte con cama,
// velador, ventana, póster, escritorio y corcho de detective con hilo rojo; rincón de cocina con
// lavadero y caño; chorro de agua, vaso, pan francés y lentes oscuros. Mismo estilo diorama de
// juguete que `../finanzas/escenarios.tsx` y `../alcanza/props3d.tsx` (primitivas con aristas
// redondeadas y texturas dibujadas en canvas, sin archivos externos).
// Animación 100 % determinista: solo props y useCurrentFrame() (azar con semilla, nada de Math.random).
// Convención: origen en la base (y = 0), abierto/mirando hacia +Z. Unidades ≈ metros (la mascota mide ≈1.85).
import {useEffect, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {Cuaderno, LentesOscuros, MARCA, PanFrances, TazaCafe, VasoConAgua} from '../alcanza/props3d';

type V3 = [number, number, number];

// ============================================================
// utilidades
// ============================================================
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const suave = (v: number) => {
	const t = clamp01(v);
	return t * t * (3 - 2 * t);
};

/** PRNG con semilla (mulberry32). */
const rng = (semilla: number) => {
	let a = semilla >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const lienzo = (w: number, h: number, dibujar: (ctx: CanvasRenderingContext2D) => void) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	dibujar(c.getContext('2d')!);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 4;
	return t;
};

const cacheTex = new Map<string, THREE.Texture>();
const texFija = (clave: string, crear: () => THREE.Texture) => {
	let t = cacheTex.get(clave);
	if (!t) {
		t = crear();
		cacheTex.set(clave, t);
	}
	return t;
};
const texRepetida = (clave: string, rx: number, ry: number, crear: () => THREE.Texture) =>
	texFija(`${clave}|${rx}|${ry}`, () => {
		const t = crear();
		t.wrapS = THREE.RepeatWrapping;
		t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(rx, ry);
		return t;
	});

const cacheGeo = new Map<string, THREE.BufferGeometry>();
const geo = <T extends THREE.BufferGeometry>(clave: string, crear: () => T): T => {
	let g = cacheGeo.get(clave);
	if (!g) {
		g = crear();
		cacheGeo.set(clave, g);
	}
	return g as T;
};
const G = {
	caja: () => geo('caja', () => new THREE.BoxGeometry(1, 1, 1)),
	cil: (seg = 24) => geo(`cil${seg}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, seg)),
	cono: (arriba: number, seg = 24) => geo(`cono${arriba}|${seg}`, () => new THREE.CylinderGeometry(arriba * 0.5, 0.5, 1, seg)),
	esfera: (seg = 24) => geo(`esf${seg}`, () => new THREE.SphereGeometry(0.5, seg, Math.round(seg * 0.75))),
	redonda: (w: number, h: number, d: number, r: number, seg = 3) => geo(`rb${w}|${h}|${d}|${r}|${seg}`, () => cajaRedonda(w, h, d, r, seg)),
	toro: (r: number, tubo: number, arco = Math.PI * 2, segT = 8, segR = 24) =>
		geo(`toro${r}|${tubo}|${arco}|${segT}|${segR}`, () => new THREE.TorusGeometry(r, tubo, segT, segR, arco)),
	disco: (seg = 24) => geo(`disco${seg}`, () => new THREE.CircleGeometry(0.5, seg)),
	plano: () => geo('plano', () => new THREE.PlaneGeometry(1, 1)),
};

/** Caja con aristas redondeadas (esquinas esféricas, normales suaves). */
function cajaRedonda(w: number, h: number, d: number, radio: number, k = 3) {
	const r = Math.max(0.0001, Math.min(radio, w / 2, h / 2, d / 2) * 0.999);
	const N = 2 * k + 1;
	const g = new THREE.BoxGeometry(1, 1, 1, N, N, N);
	const pos = g.attributes.position;
	const nor = g.attributes.normal;
	const mitad = [w / 2, h / 2, d / 2];
	const remap = (t: number, m: number) => {
		const j = Math.round((t + 0.5) * N);
		if (j <= k) return -m + r * (j / k);
		return m - r + r * ((j - k - 1) / k);
	};
	const v = new THREE.Vector3();
	const n = new THREE.Vector3();
	for (let i = 0; i < pos.count; i++) {
		const p = [remap(pos.getX(i), mitad[0]), remap(pos.getY(i), mitad[1]), remap(pos.getZ(i), mitad[2])];
		const dentro = p.map((c, a) => Math.max(-(mitad[a] - r), Math.min(mitad[a] - r, c)));
		n.set(p[0] - dentro[0], p[1] - dentro[1], p[2] - dentro[2]);
		if (n.lengthSq() > 1e-12) {
			n.normalize();
			v.set(dentro[0], dentro[1], dentro[2]).addScaledVector(n, r);
			pos.setXYZ(i, v.x, v.y, v.z);
			nor.setXYZ(i, n.x, n.y, n.z);
		} else pos.setXYZ(i, p[0], p[1], p[2]);
	}
	pos.needsUpdate = true;
	return g;
}

type OpcMat = {r?: number; m?: number; e?: string; ei?: number; lado?: THREE.Side; o?: number};
const cacheMat = new Map<string, THREE.Material>();
const mat = (color: string, o: OpcMat = {}) => {
	const clave = `${color}|${JSON.stringify(o)}`;
	let m = cacheMat.get(clave);
	if (!m) {
		m = new THREE.MeshStandardMaterial({
			color,
			roughness: o.r ?? 0.78,
			metalness: o.m ?? 0,
			emissive: new THREE.Color(o.e ?? '#000000'),
			emissiveIntensity: o.ei ?? 0,
			side: o.lado ?? THREE.FrontSide,
			transparent: o.o !== undefined,
			opacity: o.o ?? 1,
			depthWrite: o.o === undefined,
		});
		cacheMat.set(clave, m);
	}
	return m;
};
const matMapa = (clave: string, tex: () => THREE.Texture, o: {r?: number; lado?: THREE.Side; ei?: number; color?: string} = {}) => {
	const k = `map|${clave}|${JSON.stringify(o)}`;
	let m = cacheMat.get(k);
	if (!m) {
		const t = tex();
		m = new THREE.MeshStandardMaterial({
			map: t,
			color: o.color ?? '#ffffff',
			roughness: o.r ?? 0.85,
			side: o.lado ?? THREE.FrontSide,
			emissive: new THREE.Color(o.ei ? '#ffffff' : '#000000'),
			emissiveMap: o.ei ? t : null,
			emissiveIntensity: o.ei ?? 0,
		});
		cacheMat.set(k, m);
	}
	return m;
};

const B: React.FC<{p: V3; s: V3; c?: string; m?: THREE.Material; rot?: V3; o?: OpcMat; sombra?: boolean}> = ({p, s, c = '#cccccc', m, rot, o, sombra = true}) => (
	<mesh geometry={G.caja()} material={m ?? mat(c, o)} position={p} scale={s} rotation={rot} castShadow={sombra} receiveShadow />
);
const R: React.FC<{p: V3; s: V3; r?: number; c?: string; m?: THREE.Material; rot?: V3; o?: OpcMat; sombra?: boolean}> = ({p, s, r = 0.02, c = '#cccccc', m, rot, o, sombra = true}) => (
	<mesh geometry={G.redonda(s[0], s[1], s[2], r)} material={m ?? mat(c, o)} position={p} rotation={rot} castShadow={sombra} receiveShadow />
);
const Cil: React.FC<{p: V3; r: number; h: number; c?: string; m?: THREE.Material; seg?: number; rot?: V3; o?: OpcMat; sombra?: boolean}> = ({p, r, h, c = '#cccccc', m, seg = 20, rot, o, sombra = true}) => (
	<group position={p} rotation={rot}>
		<mesh geometry={G.cil(seg)} material={m ?? mat(c, o)} position={[0, h / 2, 0]} scale={[r * 2, h, r * 2]} castShadow={sombra} receiveShadow />
	</group>
);
const Esf: React.FC<{p: V3; r: number | V3; c?: string; m?: THREE.Material; seg?: number; o?: OpcMat; sombra?: boolean}> = ({p, r, c = '#cccccc', m, seg = 16, o, sombra = true}) => (
	<mesh
		geometry={G.esfera(seg)}
		material={m ?? mat(c, o)}
		position={p}
		scale={typeof r === 'number' ? [r * 2, r * 2, r * 2] : [r[0] * 2, r[1] * 2, r[2] * 2]}
		castShadow={sombra}
		receiveShadow
	/>
);
const ARRIBA = new THREE.Vector3(0, 1, 0);
/** Cilindro delgado entre dos puntos (hilo rojo, patas). */
const Palo: React.FC<{a: V3; b: V3; r: number; m: THREE.Material; seg?: number; sombra?: boolean}> = ({a, b, r, m, seg = 6, sombra = false}) => {
	const va = new THREE.Vector3(...a);
	const vb = new THREE.Vector3(...b);
	const d = vb.clone().sub(va);
	const largo = d.length();
	const q = new THREE.Quaternion().setFromUnitVectors(ARRIBA, d.normalize());
	const medio = va.add(vb).multiplyScalar(0.5);
	return <mesh geometry={G.cil(seg)} material={m} position={[medio.x, medio.y, medio.z]} quaternion={[q.x, q.y, q.z, q.w]} scale={[r * 2, largo, r * 2]} castShadow={sombra} />;
};

const FUENTE = 'Arial, Helvetica, "DejaVu Sans", sans-serif';
const MANO = '"Comic Sans MS", "Segoe Print", "DejaVu Sans", sans-serif';
const mezcla = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t)).getHexString()}`;

// ============================================================
// texturas
// ============================================================
const texPiso = () =>
	texRepetida('pisoMadera', 3, 3, () =>
		lienzo(512, 512, (ctx) => {
			const r = rng(21);
			const tonos = ['#b07a4f', '#a46f45', '#ba8558', '#9c6840'];
			for (let i = 0; i < 8; i++) {
				const y = i * 64;
				let x = -r() * 200;
				while (x < 512) {
					const largo = 160 + r() * 200;
					ctx.fillStyle = tonos[Math.floor(r() * tonos.length)];
					ctx.fillRect(x, y, largo, 64);
					ctx.strokeStyle = 'rgba(70,40,20,0.18)';
					ctx.lineWidth = 1.5;
					for (let k = 0; k < 3; k++) {
						ctx.beginPath();
						ctx.moveTo(x + 6, y + 14 + k * 16 + r() * 6);
						ctx.bezierCurveTo(x + largo * 0.3, y + 10 + k * 16 + r() * 10, x + largo * 0.6, y + 20 + k * 16 - r() * 10, x + largo - 6, y + 14 + k * 16 + r() * 6);
						ctx.stroke();
					}
					ctx.fillStyle = 'rgba(60,35,18,0.55)';
					ctx.fillRect(x, y, 3, 64);
					x += largo;
				}
				ctx.fillStyle = 'rgba(60,35,18,0.5)';
				ctx.fillRect(0, y, 512, 3);
			}
		}),
	);

const texCielo = (noche: boolean) =>
	texFija(noche ? 'cieloNoche' : 'cieloDia', () =>
		lienzo(256, 220, (ctx) => {
			const g = ctx.createLinearGradient(0, 0, 0, 220);
			if (noche) {
				g.addColorStop(0, '#0a1238');
				g.addColorStop(1, '#283e8c');
			} else {
				g.addColorStop(0, '#7cc3f2');
				g.addColorStop(1, '#dff2ff');
			}
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 256, 220);
			const r = rng(noche ? 7 : 8);
			if (noche) {
				for (let i = 0; i < 60; i++) {
					const x = r() * 256;
					const y = r() * 170;
					const t = 0.6 + r() * 1.6;
					ctx.fillStyle = `rgba(255,255,240,${0.55 + r() * 0.45})`;
					ctx.beginPath();
					ctx.arc(x, y, t, 0, Math.PI * 2);
					ctx.fill();
				}
				// luna creciente
				ctx.fillStyle = '#fff6d6';
				ctx.beginPath();
				ctx.arc(190, 52, 22, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = '#0f1a48';
				ctx.beginPath();
				ctx.arc(201, 45, 19, 0, Math.PI * 2);
				ctx.fill();
			} else {
				ctx.fillStyle = 'rgba(255,255,255,0.95)';
				for (const [cx, cy, s] of [
					[70, 60, 1],
					[185, 95, 0.75],
				] as const) {
					for (const [dx, dy, rr] of [
						[0, 0, 20],
						[22, -8, 24],
						[46, 2, 18],
						[24, 8, 20],
					] as const) {
						ctx.beginPath();
						ctx.arc(cx + dx * s, cy + dy * s, rr * s, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}
			// techitos del barrio
			ctx.fillStyle = noche ? '#141a3a' : '#9fb7c9';
			const r2 = rng(3);
			let x = 0;
			while (x < 256) {
				const w = 30 + r2() * 40;
				const h = 22 + r2() * 30;
				ctx.fillRect(x, 220 - h, w - 3, h);
				if (noche && r2() > 0.35) {
					ctx.fillStyle = '#ffd27a';
					ctx.fillRect(x + 8, 220 - h + 8, 7, 7);
					ctx.fillStyle = '#141a3a';
				}
				x += w;
			}
		}),
	);

const texPoster = () =>
	texFija('posterCuarto', () =>
		lienzo(256, 360, (ctx) => {
			ctx.fillStyle = '#f2e3c4';
			ctx.fillRect(0, 0, 256, 360);
			const g = ctx.createLinearGradient(0, 30, 0, 250);
			g.addColorStop(0, '#f08a5d');
			g.addColorStop(1, '#ffd38a');
			ctx.fillStyle = g;
			ctx.fillRect(20, 20, 216, 240);
			ctx.fillStyle = '#ffefb8';
			ctx.beginPath();
			ctx.arc(128, 150, 54, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#6b9080';
			ctx.beginPath();
			ctx.moveTo(20, 260);
			ctx.lineTo(80, 150);
			ctx.lineTo(125, 210);
			ctx.lineTo(170, 130);
			ctx.lineTo(236, 260);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = '#3f6457';
			ctx.beginPath();
			ctx.moveTo(20, 260);
			ctx.lineTo(60, 215);
			ctx.lineTo(110, 260);
			ctx.lineTo(170, 205);
			ctx.lineTo(236, 260);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = '#1e1e1e';
			ctx.font = `900 54px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.fillText('LIMA', 128, 318);
			ctx.font = `700 16px ${FUENTE}`;
			ctx.fillText('· 1535 ·', 128, 342);
		}),
	);

const texCuadros = () =>
	texRepetida('frazada', 3, 2, () =>
		lienzo(128, 128, (ctx) => {
			ctx.fillStyle = '#4f78b0';
			ctx.fillRect(0, 0, 128, 128);
			ctx.fillStyle = 'rgba(246,239,226,0.55)';
			ctx.fillRect(0, 48, 128, 32);
			ctx.fillRect(48, 0, 32, 128);
			ctx.fillStyle = 'rgba(217,72,47,0.7)';
			ctx.fillRect(0, 61, 128, 6);
			ctx.fillRect(61, 0, 6, 128);
		}),
	);

const texNota = (texto: string, fondo: string, semilla: number) =>
	texFija(`nota|${texto}|${fondo}`, () =>
		lienzo(128, 128, (ctx) => {
			ctx.fillStyle = fondo;
			ctx.fillRect(0, 0, 128, 128);
			ctx.fillStyle = 'rgba(0,0,0,0.06)';
			ctx.fillRect(0, 0, 128, 14);
			ctx.fillStyle = '#23232e';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const lineas = texto.split('\n');
			let tam = lineas.length > 1 ? 30 : 38;
			ctx.font = `700 ${tam}px ${MANO}`;
			while (Math.max(...lineas.map((l) => ctx.measureText(l).width)) > 116 && tam > 14) {
				tam -= 2;
				ctx.font = `700 ${tam}px ${MANO}`;
			}
			const r = rng(semilla);
			ctx.save();
			ctx.translate(64, 68);
			ctx.rotate((r() - 0.5) * 0.12);
			lineas.forEach((l, i) => ctx.fillText(l, 0, (i - (lineas.length - 1) / 2) * tam * 1.1));
			ctx.restore();
		}),
	);

const texFoto = (semilla: number) =>
	texFija(`foto${semilla}`, () =>
		lienzo(96, 112, (ctx) => {
			ctx.fillStyle = '#fbfbf7';
			ctx.fillRect(0, 0, 96, 112);
			const r = rng(semilla);
			ctx.fillStyle = r() > 0.5 ? '#9fb7c9' : '#c9b49f';
			ctx.fillRect(8, 8, 80, 78);
			// silueta misteriosa con sombrero
			ctx.fillStyle = '#2a2a33';
			ctx.beginPath();
			ctx.arc(48, 44, 14, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillRect(26, 56, 44, 30);
			ctx.fillRect(28, 28, 40, 6);
			ctx.fillRect(36, 18, 24, 12);
			ctx.fillStyle = '#ffffff';
			ctx.font = `900 22px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.fillText('?', 48, 52);
			ctx.fillStyle = '#c0392b';
			ctx.font = `700 13px ${MANO}`;
			ctx.fillText(semilla % 2 ? '¿yo?' : 'sospechoso', 48, 102);
		}),
	);

const texAzulejo = () =>
	texRepetida('azulejos', 6, 2.5, () =>
		lienzo(128, 128, (ctx) => {
			ctx.fillStyle = '#d4d9d6';
			ctx.fillRect(0, 0, 128, 128);
			for (let i = 0; i < 2; i++)
				for (let j = 0; j < 2; j++) {
					ctx.fillStyle = (i + j) % 2 ? '#f4f6f2' : '#cfe7df';
					ctx.fillRect(i * 64 + 3, j * 64 + 3, 58, 58);
					ctx.fillStyle = 'rgba(255,255,255,0.35)';
					ctx.fillRect(i * 64 + 8, j * 64 + 8, 20, 6);
				}
		}),
	);

const texPisoCocina = () =>
	texRepetida('pisoCocina', 4, 3, () =>
		lienzo(128, 128, (ctx) => {
			for (let i = 0; i < 2; i++)
				for (let j = 0; j < 2; j++) {
					ctx.fillStyle = (i + j) % 2 ? '#efe7d6' : '#b9483a';
					ctx.fillRect(i * 64, j * 64, 64, 64);
				}
			ctx.strokeStyle = 'rgba(0,0,0,0.12)';
			ctx.lineWidth = 2;
			ctx.strokeRect(0, 0, 128, 128);
			ctx.beginPath();
			ctx.moveTo(64, 0);
			ctx.lineTo(64, 128);
			ctx.moveTo(0, 64);
			ctx.lineTo(128, 64);
			ctx.stroke();
		}),
	);

// ============================================================
// Cuarto
// ============================================================
/** Altura del colchón (donde se sienta la mascota). */
export const CAMA_ALTURA = 0.42;
/**
 * Dónde poner una `Protagonista` con `sentado` al borde de la cama, mirando a +Z (con el Cuarto en el
 * origen y sin rotar). La cara queda a y ≈ 1.21 (ojos ≈ 1.23) y las rodillas en z ≈ -0.86.
 */
export const CAMA_SENTADO: V3 = [-1.35, -0.04, -1.28];
/** Bombilla de la lámpara del velador (para LucesCuarto). */
export const LAMPARA_CUARTO: V3 = [0.32, 0.98, -1.72];
/** Centro de la ventana (en la pared del fondo, sobre la cama). */
export const VENTANA_CUARTO: V3 = [-1.3, 1.62, -2.0];

const PARED_Z = -2.0;
const PARED_X = -2.5;
const ALTO = 2.9;

/** Frazada arrugada (plano desplazado con ruido con semilla), con un rollo en el borde de adelante. */
const geoFrazada = () =>
	geo('frazada', () => {
		const w = 1.5;
		const d = 0.62;
		const g = new THREE.PlaneGeometry(w, d, 44, 20);
		g.rotateX(-Math.PI / 2);
		const r = rng(41);
		const bultos = Array.from({length: 9}, () => ({x: (r() - 0.5) * w, z: (r() - 0.5) * d, a: 0.02 + r() * 0.035, s: 0.08 + r() * 0.14}));
		const pos = g.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const z = pos.getZ(i);
			const u = x / w + 0.5;
			const v = z / d + 0.5;
			const borde = Math.min(1, u / 0.08, (1 - u) / 0.04, v / 0.06, (1 - v) / 0.05);
			let y = 0.012;
			for (const b of bultos) y += b.a * Math.exp(-((x - b.x) ** 2 + (z - b.z) ** 2) / (2 * b.s * b.s));
			y += 0.018 * Math.sin(x * 23 + z * 7) * Math.sin(z * 19);
			// rollo adelante
			y += 0.055 * Math.exp(-(((v - 0.86) / 0.1) ** 2));
			pos.setY(i, Math.max(0.004, y * Math.max(0, borde) ** 0.5));
		}
		g.computeVertexNormals();
		return g;
	});

const NOTAS: {t: string; c: string; p: [number, number]; rot: number}[] = [
	{t: 'S/ 180\n→ 14.50', c: '#fff3a6', p: [-0.4, 0.22], rot: -0.08},
	{t: '¿QUIÉN?', c: '#ffd0d6', p: [0.02, 0.27], rot: 0.06},
	{t: 'menú\nS/ 22', c: '#cfeedd', p: [-0.38, -0.16], rot: 0.07},
	{t: 'taxi\nS/ 16', c: '#cfe3ff', p: [0.06, -0.2], rot: -0.05},
	{t: 'salchi-\npapa', c: '#fff3a6', p: [0.42, -0.08], rot: 0.1},
];
const FOTOS: {s: number; p: [number, number]; rot: number}[] = [
	{s: 3, p: [0.4, 0.24], rot: 0.09},
	{s: 4, p: [-0.16, 0.02], rot: -0.12},
];

/** Corcho de detective (1.2 × 0.85) con notas, fotos, chinches e hilo rojo. Origen en el centro, mira a +Z. */
const Corcho: React.FC<{p: V3}> = ({p}) => {
	const pines = useMemo(() => [...NOTAS.map((n) => n.p), ...FOTOS.map((f) => f.p)].map(([x, y]) => [x, y + 0.07] as [number, number]), []);
	const hilo = mat('#d01f1f', {r: 0.6});
	const conexiones: [number, number][] = [
		[0, 1],
		[1, 5],
		[0, 6],
		[6, 2],
		[6, 3],
		[3, 4],
		[5, 4],
		[1, 6],
	];
	const colPin = ['#e63946', '#2a9d8f', '#e9c46a', '#3a6ea5', '#e63946', '#2a9d8f', '#e9c46a'];
	return (
		<group position={p}>
			<R p={[0, 0, 0.012]} s={[1.28, 0.93, 0.04]} r={0.015} c="#7a4a2a" />
			<B p={[0, 0, 0.034]} s={[1.18, 0.83, 0.01]} c="#c99a63" o={{r: 0.95}} sombra={false} />
			{NOTAS.map((n, i) => (
				<mesh key={i} geometry={G.plano()} material={matMapa(`nota${i}`, () => texNota(n.t, n.c, i + 1), {r: 0.9})} position={[n.p[0], n.p[1], 0.041 + i * 0.0004]} rotation={[0, 0, n.rot]} scale={[0.22, 0.22, 1]} castShadow />
			))}
			{FOTOS.map((f, i) => (
				<mesh key={i} geometry={G.plano()} material={matMapa(`foto${f.s}`, () => texFoto(f.s), {r: 0.6})} position={[f.p[0], f.p[1], 0.043 + i * 0.0004]} rotation={[0, 0, f.rot]} scale={[0.19, 0.22, 1]} castShadow />
			))}
			{pines.map(([x, y], i) => (
				<group key={i}>
					<Esf p={[x, y, 0.06]} r={0.016} c={colPin[i % colPin.length]} o={{r: 0.35}} seg={10} sombra={false} />
					<Cil p={[x, y, 0.04]} r={0.003} h={0.02} c="#bbbbbb" rot={[Math.PI / 2, 0, 0]} seg={4} sombra={false} />
				</group>
			))}
			{conexiones.map(([a, b], i) => (
				<Palo key={i} a={[pines[a][0], pines[a][1], 0.055]} b={[pines[b][0], pines[b][1], 0.055]} r={0.0045} m={hilo} />
			))}
		</group>
	);
};

export type CuartoProps = {
	/** 0 = mañana (ventana celeste) · 1 = noche (cielo azul oscuro con estrellas y la lámpara prendida). */
	noche?: number;
	position?: V3;
	rotationY?: number;
};

/**
 * Cuarto en corte (≈5 × 4, paredes al fondo z = -2 y a la izquierda x = -2.5, abierto hacia +Z):
 * cama de una plaza contra el fondo (x de -2.35 a -0.25, colchón a y = 0.42) con almohada y frazada
 * arrugada, velador con lámpara, ventana sobre la cama, póster, escritorio con cuaderno y taza, y un
 * corcho de detective con notas e hilo rojo. Las luces van aparte: `<LucesCuarto noche={…} />`.
 */
export const Cuarto: React.FC<CuartoProps> = ({noche = 0, position = [0, 0, 0], rotationY = 0}) => {
	const n = clamp01(noche);
	const cieloDia = useMemo(() => new THREE.MeshStandardMaterial({map: texCielo(false), emissiveMap: texCielo(false), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.85, roughness: 1}), []);
	const cieloNoche = useMemo(
		() => new THREE.MeshStandardMaterial({map: texCielo(true), emissiveMap: texCielo(true), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.9, roughness: 1, transparent: true}),
		[],
	);
	const pantalla = useMemo(() => new THREE.MeshStandardMaterial({color: '#ffe6b8', emissive: new THREE.Color('#ffc477'), roughness: 0.9, side: THREE.DoubleSide}), []);
	useEffect(
		() => () => {
			cieloDia.dispose();
			cieloNoche.dispose();
			pantalla.dispose();
		},
		[cieloDia, cieloNoche, pantalla],
	);
	cieloNoche.opacity = n;
	cieloNoche.visible = n > 0.01;
	pantalla.emissiveIntensity = 0.15 + 1.1 * n;

	const madera = mat('#a0673d', {r: 0.7});
	const maderaClara = mat('#c48a58', {r: 0.7});
	const paredFondo = mat('#e9dcc3', {r: 0.95});
	const paredLado = mat('#dccfb4', {r: 0.95});
	const blanco = mat('#f6f2ea', {r: 0.6});
	const frazada = matMapa('frazada', texCuadros, {r: 0.95, lado: THREE.DoubleSide});

	const camaX = -1.3;
	const camaZ = -1.5;
	return (
		<group position={position} rotation={[0, rotationY, 0]}>
			{/* piso y paredes (las paredes no proyectan sombra para que entre la luz de la ventana) */}
			<mesh geometry={G.caja()} material={matMapa('pisoCuarto', texPiso, {r: 0.8})} position={[0, -0.05, 0]} scale={[5.3, 0.1, 4.3]} receiveShadow />
			<mesh geometry={G.caja()} material={paredFondo} position={[0, ALTO / 2, PARED_Z - 0.06]} scale={[5.3, ALTO, 0.12]} receiveShadow />
			<mesh geometry={G.caja()} material={paredLado} position={[PARED_X - 0.06, ALTO / 2, 0]} scale={[0.12, ALTO, 4.3]} receiveShadow />
			{/* zócalos */}
			<B p={[0, 0.05, PARED_Z + 0.012]} s={[5.3, 0.1, 0.025]} c="#8a5a36" sombra={false} />
			<B p={[PARED_X + 0.012, 0.05, 0]} s={[0.025, 0.1, 4.3]} c="#8a5a36" sombra={false} />
			{/* alfombra */}
			<R p={[-0.5, 0.006, -0.25]} s={[2.2, 0.012, 1.4]} r={0.005} c={MARCA.terracota} o={{r: 1}} sombra={false} />
			<R p={[-0.5, 0.013, -0.25]} s={[1.9, 0.004, 1.12]} r={0.002} c="#e9b48a" o={{r: 1}} sombra={false} />

			{/* ---------- cama ---------- */}
			<group position={[camaX, 0, camaZ]}>
				{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Cil key={`${sx}${sz}`} p={[sx * 0.98, 0, sz * 0.42]} r={0.035} h={0.12} m={madera} seg={10} />))}
				<R p={[0, 0.185, 0]} s={[2.1, 0.17, 0.98]} r={0.03} m={madera} />
				<R p={[0, 0.335, 0]} s={[2.02, 0.17, 0.93]} r={0.06} c="#dfe9f3" o={{r: 0.95}} />
				{/* cabecera y piecera */}
				<R p={[1.03, 0.52, 0]} s={[0.08, 1.04, 1.02]} r={0.035} m={madera} />
				<R p={[1.0, 0.82, 0]} s={[0.04, 0.3, 0.8]} r={0.015} m={maderaClara} />
				<R p={[-1.04, 0.33, 0]} s={[0.07, 0.66, 1.02]} r={0.03} m={madera} />
				{/* almohada */}
				<R p={[0.68, 0.49, -0.05]} s={[0.4, 0.13, 0.66]} r={0.06} rot={[0, 0, 0.22]} m={blanco} />
				{/* frazada arrugada (hacia el fondo y los pies) */}
				<mesh geometry={geoFrazada()} material={frazada} position={[-0.22, CAMA_ALTURA, -0.15]} castShadow receiveShadow />
			</group>
			{/* pantuflas */}
			{[-1, 1].map((s) => (
				<group key={s} position={[-2.05 + s * 0.09, 0, -0.72]} rotation={[0, 0.3 + s * 0.12, 0]}>
					<R p={[0, 0.025, 0]} s={[0.1, 0.05, 0.24]} r={0.024} c="#7f9cc4" o={{r: 1}} />
					<R p={[0, 0.06, 0.04]} s={[0.1, 0.05, 0.12]} r={0.025} c="#9db6d8" o={{r: 1}} />
				</group>
			))}

			{/* ---------- velador con lámpara ---------- */}
			<group position={[0.32, 0, -1.72]}>
				<R p={[0, 0.28, 0]} s={[0.5, 0.56, 0.44]} r={0.03} m={maderaClara} />
				{[0.19, 0.4].map((y) => (
					<group key={y}>
						<B p={[0, y, 0.221]} s={[0.44, 0.17, 0.01]} m={madera} sombra={false} />
						<Esf p={[0, y, 0.235]} r={0.018} c="#e9c46a" o={{m: 0.5, r: 0.3}} seg={10} sombra={false} />
					</group>
				))}
				<Cil p={[0, 0.56, 0]} r={0.08} h={0.04} c="#3a5a50" seg={16} />
				<Cil p={[0, 0.6, 0]} r={0.014} h={0.28} c="#3a5a50" seg={8} />
				<mesh geometry={G.cono(0.62, 20)} material={pantalla} position={[0, 0.94, 0]} scale={[0.32, 0.22, 0.32]} castShadow />
				<Esf p={[0, 0.9, 0]} r={0.035} c="#fff3d0" o={{e: '#fff1c8', ei: 2}} sombra={false} />
				{/* despertador */}
				<group position={[0.14, 0.56, 0.08]} rotation={[0, -0.4, 0]}>
					<R p={[0, 0.05, 0]} s={[0.13, 0.1, 0.06]} r={0.02} c={MARCA.rojo} />
					<B p={[0, 0.05, 0.031]} s={[0.1, 0.06, 0.004]} c="#1a1a1a" sombra={false} />
					<B p={[0, 0.05, 0.034]} s={[0.07, 0.02, 0.002]} c="#ff5a3d" o={{e: '#ff3d1f', ei: 0.8 + n}} sombra={false} />
				</group>
			</group>

			{/* ---------- ventana con cortinas ---------- */}
			<group position={VENTANA_CUARTO}>
				<mesh geometry={G.plano()} material={cieloDia} position={[0, 0, 0.012]} scale={[1.1, 0.9, 1]} />
				<mesh geometry={G.plano()} material={cieloNoche} position={[0, 0, 0.014]} scale={[1.1, 0.9, 1]} />
				{/* marco */}
				<B p={[0, 0.48, 0.04]} s={[1.24, 0.08, 0.07]} m={blanco} />
				<B p={[0, -0.48, 0.05]} s={[1.32, 0.07, 0.12]} m={blanco} />
				{[-1, 1].map((s) => (
					<B key={s} p={[s * 0.58, 0, 0.04]} s={[0.08, 0.98, 0.07]} m={blanco} />
				))}
				<B p={[0, 0, 0.035]} s={[0.04, 0.9, 0.04]} m={blanco} sombra={false} />
				<B p={[0, 0.06, 0.035]} s={[1.1, 0.04, 0.04]} m={blanco} sombra={false} />
				{/* barra y cortinas */}
				<Cil p={[-0.9, 0.62, 0.1]} r={0.015} h={1.8} c="#6a4a32" rot={[0, 0, -Math.PI / 2]} seg={8} sombra={false} />
				{[-1, 1].map((s) => (
					<group key={s} position={[s * 0.78, -0.02, 0.1]}>
						{[0, 1, 2, 3].map((i) => (
							<mesh key={i} geometry={G.cil(10)} material={mat(MARCA.miel, {r: 0.95})} position={[(i - 1.5) * 0.06 * s, 0, Math.sin(i * 2.1) * 0.02]} scale={[0.075, 1.24, 0.06]} castShadow />
						))}
					</group>
				))}
			</group>

			{/* ---------- póster en la pared izquierda ---------- */}
			<group position={[PARED_X + 0.012, 1.62, -0.7]} rotation={[0, Math.PI / 2, 0]}>
				<B p={[0, 0, 0]} s={[0.76, 1.06, 0.015]} c="#2b2b2b" sombra={false} />
				<mesh geometry={G.plano()} material={matMapa('posterCuarto', texPoster, {r: 0.8})} position={[0, 0, 0.009]} scale={[0.7, 0.98, 1]} />
			</group>
			{/* repisa con libros en la pared izquierda */}
			<group position={[PARED_X + 0.13, 1.35, 0.55]}>
				<B p={[0, 0, 0]} s={[0.25, 0.03, 0.8]} m={maderaClara} />
				{Array.from({length: 7}, (_, i) => {
					const r = rng(60 + i);
					const h = 0.18 + r() * 0.08;
					const col = ['#d9482f', '#6b9080', '#e9c46a', '#3a6ea5', '#8a5a9e', '#d96b52', '#2a9d8f'][i];
					return <B key={i} p={[0, 0.015 + h / 2, -0.32 + i * 0.07]} s={[0.17, h, 0.055]} rot={i === 6 ? [0.35, 0, 0] : undefined} c={col} o={{r: 0.8}} />;
				})}
			</group>

			{/* ---------- escritorio + corcho ---------- */}
			<group position={[1.65, 0, -1.62]}>
				<R p={[0, 0.74, 0]} s={[1.3, 0.05, 0.62]} r={0.015} m={maderaClara} />
				{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * 0.6, 0.36, sz * 0.26]} s={[0.05, 0.72, 0.05]} m={madera} />))}
				<B p={[0.38, 0.6, 0]} s={[0.46, 0.22, 0.56]} m={madera} />
				<Esf p={[0.38, 0.6, 0.29]} r={0.016} c="#e9c46a" o={{m: 0.5, r: 0.3}} seg={10} sombra={false} />
				<Cuaderno position={[-0.22, 0.765, 0.03]} rotationY={0.12} escala={0.85} hojas={0} color={MARCA.terracota} />
				<TazaCafe position={[0.42, 0.765, -0.12]} escala={0.38} vapor={false} />
				{/* lapicero con lápices */}
				<group position={[0.18, 0.765, -0.18]}>
					<Cil p={[0, 0, 0]} r={0.035} h={0.1} c="#3a6ea5" seg={14} />
					{[-1, 0, 1].map((i) => (
						<Cil key={i} p={[i * 0.012, 0.05, i * 0.008]} r={0.006} h={0.12} c={i ? MARCA.miel : '#d9482f'} rot={[i * 0.12, 0, i * 0.15]} seg={6} sombra={false} />
					))}
				</group>
				{/* lupa de detective */}
				<group position={[0.12, 0.775, 0.17]} rotation={[-Math.PI / 2, 0, 0.6]}>
					<mesh geometry={G.toro(0.05, 0.01, Math.PI * 2, 6, 20)} material={mat('#2b2b2b', {r: 0.4, m: 0.4})} castShadow />
					<mesh geometry={G.disco(20)} material={mat('#cfe9ff', {r: 0.05, o: 0.45})} scale={[0.1, 0.1, 1]} />
					<B p={[0, -0.1, 0]} s={[0.022, 0.1, 0.018]} c="#5a3a22" />
				</group>
				{/* silla (respaldo hacia la cámara) */}
				<group position={[-0.15, 0, 0.55]}>
					<R p={[0, 0.45, 0]} s={[0.46, 0.05, 0.44]} r={0.015} m={madera} />
					{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * 0.2, 0.22, sz * 0.19]} s={[0.04, 0.44, 0.04]} m={madera} />))}
					{[-1, 1].map((sx) => (
						<B key={sx} p={[sx * 0.2, 0.7, 0.2]} s={[0.04, 0.5, 0.04]} m={madera} />
					))}
					<R p={[0, 0.85, 0.2]} s={[0.46, 0.16, 0.04]} r={0.015} m={maderaClara} />
				</group>
			</group>
			<Corcho p={[1.65, 1.62, PARED_Z]} />
		</group>
	);
};

export type LucesCuartoProps = {
	/** 0 = mañana (luz de día fría y suave) · 1 = noche (lámpara cálida + luz de luna azul). */
	noche?: number;
	/** Dónde va la luz de la lámpara (el modelo está en el Cuarto). null = sin lámpara. */
	lampara?: V3 | null;
	/** Pinta el fondo y la niebla. Por defecto true. */
	cielo?: boolean;
	sombras?: boolean;
};

/** Luces del cuarto (y de la cocina): mañana fría por la ventana vs. noche con lámpara cálida y luna. */
export const LucesCuarto: React.FC<LucesCuartoProps> = ({noche = 0, lampara = LAMPARA_CUARTO, cielo = true, sombras = true}) => {
	const n = clamp01(noche);
	const fondo = mezcla('#cfe2ef', '#0e1430', n);
	return (
		<>
			{cielo ? <color attach="background" args={[fondo]} /> : null}
			{cielo ? <fog attach="fog" args={[fondo, 14, 40]} /> : null}
			<hemisphereLight args={[mezcla('#eef6ff', '#4a5ca8', n), mezcla('#b9a88f', '#1a1626', n), 1.05 - 0.45 * n]} />
			<ambientLight intensity={0.28 - 0.14 * n} color={mezcla('#ffffff', '#6a7cc0', n)} />
			{/* luz principal: día suave desde adelante-derecha; de noche, un relleno azul tenue */}
			<directionalLight
				position={[3, 5.5, 5]}
				intensity={1.7 - 0.85 * n}
				color={mezcla('#f4f8ff', '#b4c0f0', n)}
				castShadow={sombras}
				shadow-mapSize={[2048, 2048]}
				shadow-camera-left={-4}
				shadow-camera-right={4}
				shadow-camera-top={4}
				shadow-camera-bottom={-4}
				shadow-camera-near={1}
				shadow-camera-far={20}
				shadow-bias={-0.0006}
				shadow-normalBias={0.04}
				shadow-radius={4}
			/>
			{/* contraluz desde la ventana (fondo): celeste de mañana, luna azul de noche */}
			<directionalLight position={[-1.6, 4, -6]} intensity={0.55 + 0.35 * n} color={mezcla('#dff0ff', '#7f98ff', n)} />
			{lampara && n > 0.01 ? <pointLight position={lampara} color="#ffb362" intensity={4 * n} distance={6} decay={1.5} /> : null}
		</>
	);
};

// ============================================================
// Cocina
// ============================================================
/** Punta del caño (con la Cocina en el origen y sin rotar): de aquí cae el ChorroAgua. */
export const GRIFO: V3 = [0.35, 1.14, -0.64];
/** Fondo del lavadero (para poner un VasoAgua bajo el chorro). */
export const LAVADERO_FONDO: V3 = [0.35, 0.74, -0.62];
/** Altura del tablero de la cocina. */
export const TABLERO_ALTURA = 0.92;

export type CocinaProps = {position?: V3; rotationY?: number};

/**
 * Rincón de cocina (≈3.2 × 1.9; pared del fondo en z = -0.9 y lateral en x = -1.6, abierto hacia +Z):
 * mueble bajo con tablero a y = 0.92, lavadero de acero en x = 0.35, caño cromado (punta en `GRIFO`),
 * azulejos, repisa con frascos y platos, tabla de picar con panes y hervidor.
 */
export const Cocina: React.FC<CocinaProps> = ({position = [0, 0, 0], rotationY = 0}) => {
	const mueble = mat('#6b9080', {r: 0.7});
	const tablero = mat('#efe8dc', {r: 0.45});
	const acero = mat('#c9ced4', {r: 0.28, m: 0.55});
	const cromo = mat('#eef1f4', {r: 0.16, m: 0.6, e: '#30343a', ei: 0.25});
	const maderaClara = mat('#c48a58', {r: 0.7});
	const T = TABLERO_ALTURA;
	const sx = GRIFO[0];
	// hueco del lavadero: x 0.1..0.6, z -0.79..-0.41
	return (
		<group position={position} rotation={[0, rotationY, 0]}>
			<mesh geometry={G.caja()} material={matMapa('pisoCocina', texPisoCocina, {r: 0.6})} position={[0, -0.05, 0.05]} scale={[3.3, 0.1, 2.0]} receiveShadow />
			<mesh geometry={G.caja()} material={mat('#f1e4c8', {r: 0.95})} position={[0, 1.4, -0.96]} scale={[3.3, 2.8, 0.12]} receiveShadow />
			<mesh geometry={G.caja()} material={mat('#e6d6b6', {r: 0.95})} position={[-1.66, 1.4, 0.05]} scale={[0.12, 2.8, 2.0]} receiveShadow />
			{/* azulejos */}
			<mesh geometry={G.plano()} material={matMapa('azulejos', texAzulejo, {r: 0.35})} position={[-0.15, T + 0.35, -0.899]} scale={[2.9, 0.7, 1]} receiveShadow />
			{/* mueble bajo con puertas */}
			<R p={[-0.15, 0.45, -0.62]} s={[2.7, 0.86, 0.56]} r={0.02} m={mueble} />
			<B p={[-0.15, 0.04, -0.33]} s={[2.66, 0.08, 0.02]} c="#2f3b37" sombra={false} />
			{[-1.2, -0.66, -0.12, 0.35, 0.86].map((x, i) => (
				<group key={x}>
					<R p={[x, 0.48, -0.335]} s={[i === 3 ? 0.46 : 0.5, 0.7, 0.02]} r={0.012} m={mat('#7fa392', {r: 0.65})} sombra={false} />
					<B p={[x + (i % 2 ? -0.18 : 0.18), 0.7, -0.32]} s={[0.025, 0.12, 0.02]} m={cromo} sombra={false} />
				</group>
			))}
			{/* tablero en piezas alrededor del hueco */}
			<R p={[-0.7, T - 0.03, -0.6]} s={[1.6, 0.06, 0.62]} r={0.012} m={tablero} />
			<R p={[0.9, T - 0.03, -0.6]} s={[0.6, 0.06, 0.62]} r={0.012} m={tablero} />
			<B p={[sx, T - 0.03, -0.355]} s={[0.5, 0.06, 0.11]} m={tablero} />
			<B p={[sx, T - 0.03, -0.85]} s={[0.5, 0.06, 0.12]} m={tablero} />
			{/* lavadero */}
			<B p={[sx, T - 0.18, -0.6]} s={[0.5, 0.01, 0.38]} m={acero} />
			<B p={[sx - 0.245, T - 0.09, -0.6]} s={[0.01, 0.18, 0.38]} m={acero} />
			<B p={[sx + 0.245, T - 0.09, -0.6]} s={[0.01, 0.18, 0.38]} m={acero} />
			<B p={[sx, T - 0.09, -0.415]} s={[0.5, 0.18, 0.01]} m={acero} />
			<B p={[sx, T - 0.09, -0.785]} s={[0.5, 0.18, 0.01]} m={acero} />
			<mesh geometry={G.disco(16)} material={mat('#5a5f66', {r: 0.4, m: 0.5})} position={[sx, T - 0.174, -0.6]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.05, 0.05, 1]} />
			{/* caño cromado: base, tubo, cuello de ganso y punta */}
			<Cil p={[sx, T, -0.84]} r={0.032} h={0.03} m={cromo} seg={16} />
			<Cil p={[sx, T + 0.03, -0.84]} r={0.018} h={0.25} m={cromo} seg={14} />
			<mesh geometry={G.toro(0.1, 0.018, Math.PI, 10, 20)} material={cromo} position={[sx, 1.2, -0.74]} rotation={[0, Math.PI / 2, 0]} castShadow />
			<Cil p={[sx, GRIFO[1] + 0.005, GRIFO[2]]} r={0.02} h={0.055} m={cromo} seg={14} />
			<Cil p={[sx, GRIFO[1], GRIFO[2]]} r={0.016} h={0.008} c="#4a4f55" seg={12} sombra={false} />
			<group position={[sx + 0.06, T + 0.08, -0.84]} rotation={[0, 0, -0.4]}>
				<Cil p={[0, 0, 0]} r={0.014} h={0.05} m={cromo} seg={10} />
				<B p={[0.03, 0.05, 0]} s={[0.08, 0.014, 0.02]} m={cromo} />
			</group>
			{/* repisa con frascos y platos */}
			<B p={[-0.4, 1.78, -0.78]} s={[1.6, 0.04, 0.26]} m={maderaClara} />
			{[-1.0, -0.84, -0.68].map((x, i) => (
				<group key={x} position={[x, 1.8, -0.78]}>
					<Cil p={[0, 0, 0]} r={0.055} h={0.16} c="#e9f4f7" o={{r: 0.15, o: 0.7}} seg={14} sombra={false} />
					<Cil p={[0, 0.02, 0]} r={0.048} h={0.09 - i * 0.02} c={['#e9c46a', '#d96b52', '#8b5a2b'][i]} seg={14} />
					<Cil p={[0, 0.16, 0]} r={0.058} h={0.03} c={[MARCA.rojo, MARCA.salvia, MARCA.miel][i]} seg={14} />
				</group>
			))}
			{[0, 1, 2, 3].map((i) => (
				<Cil key={i} p={[-0.25, 1.8 + i * 0.022, -0.78]} r={0.11} h={0.018} c={i % 2 ? '#f6f2ea' : '#9fc4d8'} seg={20} />
			))}
			<group position={[0.18, 1.8, -0.78]}>
				<Cil p={[0, 0, 0]} r={0.07} h={0.11} c={MARCA.terracota} seg={14} />
				{[-1, 0, 1].map((i) => (
					<Esf key={i} p={[i * 0.04, 0.17, Math.abs(i) * 0.01]} r={[0.05, 0.07, 0.05]} c="#4f9a5a" seg={10} />
				))}
			</group>
			{/* tabla de picar con dos panes y hervidor */}
			<R p={[-0.75, T + 0.012, -0.55]} s={[0.5, 0.024, 0.32]} r={0.01} m={maderaClara} />
			<PanFrances position={[-0.86, T + 0.024, -0.56]} rotation={[0, 0.3, 0]} />
			<PanFrances position={[-0.64, T + 0.024, -0.52]} rotation={[0, -0.4, 0]} />
			<group position={[-1.28, T, -0.66]}>
				<Cil p={[0, 0, 0]} r={0.11} h={0.2} c="#d9482f" seg={18} o={{r: 0.4}} />
				<mesh geometry={G.esfera(18)} material={mat('#d9482f', {r: 0.4})} position={[0, 0.2, 0]} scale={[0.22, 0.12, 0.22]} castShadow />
				<mesh geometry={G.toro(0.07, 0.012, Math.PI, 6, 12)} material={mat('#2b2b2b', {r: 0.5})} position={[0, 0.25, 0]} />
				<Cil p={[0.13, 0.08, 0]} r={0.018} h={0.12} c="#d9482f" rot={[0, 0, -0.9]} seg={8} />
			</group>
		</group>
	);
};

// ============================================================
// Agua, vaso, pan y lentes
// ============================================================
export type ChorroAguaProps = {
	/** Punta del caño (p. ej. `GRIFO`). */
	position?: V3;
	/** 0..1: el chorro crece desde el caño hacia abajo. 0 = cerrado. */
	activo?: number;
	/** Largo del chorro completo. Por defecto 0.36 (del caño al fondo del lavadero). */
	largo?: number;
};

/** Chorro de agua translúcido que crece desde el caño, con un poco de temblor y salpicón abajo. */
export const ChorroAgua: React.FC<ChorroAguaProps> = ({position = GRIFO, activo = 1, largo = 0.36}) => {
	const frame = useCurrentFrame();
	const a = suave(activo);
	const agua = useMemo(
		() => new THREE.MeshStandardMaterial({color: '#7cc6f5', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false, emissive: new THREE.Color('#3c97e0'), emissiveIntensity: 0.35}),
		[],
	);
	const nucleo = useMemo(() => new THREE.MeshStandardMaterial({color: '#e6f6ff', roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, emissive: new THREE.Color('#bfe6ff'), emissiveIntensity: 0.3}), []);
	useEffect(
		() => () => {
			agua.dispose();
			nucleo.dispose();
		},
		[agua, nucleo],
	);
	if (a < 0.005) return null;
	const L = largo * a;
	const tiembla = Math.sin(frame * 0.9) * 0.0015;
	const cae = a > 0.98;
	return (
		<group position={position}>
			<mesh geometry={G.cono(1.25, 14)} material={agua} position={[tiembla, -L / 2, 0]} scale={[0.02, L, 0.02]} renderOrder={4} />
			<mesh geometry={G.cil(8)} material={nucleo} position={[-tiembla, -L / 2, 0.002]} scale={[0.008, L, 0.008]} renderOrder={5} />
			{cae ? (
				<group position={[0, -L, 0]}>
					<mesh geometry={G.toro(0.022 + (frame % 8) * 0.003, 0.004, Math.PI * 2, 4, 16)} material={agua} rotation={[Math.PI / 2, 0, 0]} renderOrder={4} />
					{[0, 1, 2, 3, 4].map((i) => {
						const f = ((frame * 0.11 + i * 0.37) % 1) * 1;
						const ang = i * 1.26 + frame * 0.05;
						return <Esf key={i} p={[Math.cos(ang) * 0.03 * (0.4 + f), 0.012 + Math.sin(f * Math.PI) * 0.03, Math.sin(ang) * 0.03 * (0.4 + f)]} r={0.0055 * (1 - f * 0.5)} m={agua} seg={6} sombra={false} />;
					})}
				</group>
			) : null}
		</group>
	);
};

export type VasoAguaProps = {position?: V3; nivel?: number; escala?: number};
/** Vaso de vidrio (≈0.09 × 0.13 con escala 1, base en y = 0) que se llena hasta `nivel` (0..1). */
export const VasoAgua: React.FC<VasoAguaProps> = ({position = [0, 0, 0], nivel = 0.7, escala = 1}) => <VasoConAgua position={position} nivel={nivel} escala={escala} />;

export type PanProps = {position?: V3; escala?: number; rotationY?: number};
/** Pan francés peruano (≈0.18 × 0.12 con escala 1, base en y = 0). */
export const Pan: React.FC<PanProps> = ({position = [0, 0, 0], escala = 1, rotationY = 0}) => <PanFrances position={position} escala={escala} rotation={[0, rotationY, 0]} />;

export type LentesProps = {position?: V3; rotation?: V3; escala?: number};
/** Lentes oscuros de detective sueltos (≈0.25 de ancho con escala 1, centro del puente en el origen, miran a +Z). */
export const Lentes: React.FC<LentesProps> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1}) => <LentesOscuros position={position} rotation={rotation} escala={escala} />;
