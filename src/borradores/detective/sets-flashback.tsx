// Sets 3D de los FLASHBACKS del reel "El caso del yapeo fantasma" (Alcanza), mismo estilo diorama de
// juguete que `../finanzas/escenarios.tsx` y `../alcanza/props3d.tsx`: primitivas de three.js con
// aristas redondeadas, sombreado suave, colores saturados y texturas dibujadas en canvas.
// Los flashbacks se verán en blanco y negro (filtro 2D posterior), así que cada pieza clave tiene
// buen contraste de VALOR, no solo de color (chicha casi negra sobre mantel claro, plato blanco, etc.).
// Animación 100 % determinista: depende solo de props o de useCurrentFrame(); aleatoriedad con semilla.
// Convención: el origen de cada modelo está en su base (y = 0) y mira hacia +Z. Unidades ≈ metros.
// Sin marcas reales: gaseosa, galletas, combi, taxi y bodega son genéricos.
//
// Escenas:
//  · Restaurante  (pista 1, 1:30 pm) — rincón de menú con pizarra "MENÚ S/ 12"; usa <Luces tarde={0.1}>.
//  · CalleTarde   (pista 2, 6:00 pm) — calle encima de <Barrio>, combi llena, taxi, bodega; <Luces tarde={0.8}>.
//  · MesaNoche    (pista 3, 9:00 pm) — pollería de noche con foquitos; trae sus propias luces (prop `luces`).
//  · Salchipapa   (pista 3, medianoche) — caja de delivery que se abre + bolsa.
import {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {Persona} from '../finanzas/escenarios';
import {BolsaDelivery} from '../alcanza/props3d';

type V3 = [number, number, number];

// ============================================================
// utilidades (copias locales: las de los otros archivos no se exportan)
// ============================================================
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const suave = (v: number) => {
	const t = clamp01(v);
	return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const tramo = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
/** Escala de "pop" con rebote (easeOutBack). 0 → 0, 1 → 1. */
const pop = (v: number) => {
	const t = clamp01(v);
	if (t <= 0) return 0;
	const c1 = 1.9;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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

const FUENTE = 'Arial, Helvetica, "DejaVu Sans", sans-serif';

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
	/** Cono truncado de alto 1 y radio de base 0.5; `arriba` = radio superior relativo. */
	cono: (arriba: number, seg = 24, abierto = false) =>
		geo(`cono${arriba}|${seg}|${abierto}`, () => new THREE.CylinderGeometry(arriba * 0.5, 0.5, 1, seg, 1, abierto)),
	esfera: (seg = 24) => geo(`esf${seg}`, () => new THREE.SphereGeometry(0.5, seg, Math.round(seg * 0.75))),
	media: (seg = 24) => geo(`media${seg}`, () => new THREE.SphereGeometry(0.5, seg, Math.round(seg / 3), 0, Math.PI * 2, 0, Math.PI / 2)),
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
const matMapa = (clave: string, tex: () => THREE.Texture, o: {r?: number; e?: number} = {}) => {
	const k = `map|${clave}|${o.r ?? 0.85}|${o.e ?? 0}`;
	let m = cacheMat.get(k);
	if (!m) {
		const t = tex();
		m = new THREE.MeshStandardMaterial({map: t, roughness: o.r ?? 0.85, emissive: o.e ? new THREE.Color('#ffffff') : undefined, emissiveMap: o.e ? t : null, emissiveIntensity: o.e ?? 0});
		cacheMat.set(k, m);
	}
	return m;
};
const VIDRIO = () => mat('#e4f3fa', {r: 0.08, o: 0.2});

const B: React.FC<{p: V3; s: V3; c?: string; m?: THREE.Material; rot?: V3; o?: OpcMat; sombra?: boolean}> = ({p, s, c = '#cccccc', m, rot, o, sombra = true}) => (
	<mesh geometry={G.caja()} material={m ?? mat(c, o)} position={p} scale={s} rotation={rot} castShadow={sombra} receiveShadow />
);
/** Caja redondeada centrada en p. */
const R: React.FC<{p: V3; s: V3; r?: number; c?: string; m?: THREE.Material; rot?: V3; o?: OpcMat; sombra?: boolean}> = ({p, s, r = 0.03, c = '#cccccc', m, rot, o, sombra = true}) => (
	<mesh geometry={G.redonda(s[0], s[1], s[2], r)} material={m ?? mat(c, o)} position={p} rotation={rot} castShadow={sombra} receiveShadow />
);
/** Cilindro vertical con base en p. */
const Cil: React.FC<{p: V3; r: number; h: number; c?: string; m?: THREE.Material; seg?: number; rot?: V3; o?: OpcMat; sombra?: boolean}> = ({p, r, h, c = '#cccccc', m, seg = 20, rot, o, sombra = true}) => (
	<group position={p} rotation={rot}>
		<mesh geometry={G.cil(seg)} material={m ?? mat(c, o)} position={[0, h / 2, 0]} scale={[r * 2, h, r * 2]} castShadow={sombra} receiveShadow />
	</group>
);
const Esf: React.FC<{p: V3; r: number | V3; c?: string; m?: THREE.Material; seg?: number; o?: OpcMat; sombra?: boolean; rot?: V3}> = ({p, r, c = '#cccccc', m, seg = 18, o, sombra = true, rot}) => (
	<mesh
		geometry={G.esfera(seg)}
		material={m ?? mat(c, o)}
		position={p}
		rotation={rot}
		scale={typeof r === 'number' ? [r * 2, r * 2, r * 2] : [r[0] * 2, r[1] * 2, r[2] * 2]}
		castShadow={sombra}
		receiveShadow
	/>
);
/** Cartel plano con textura (mira a +Z). */
const Cartel: React.FC<{p: V3; w: number; h: number; clave: string; tex: () => THREE.Texture; rot?: V3; e?: number}> = ({p, w, h, clave, tex, rot, e}) => (
	<mesh geometry={G.plano()} material={matMapa(clave, tex, {r: 0.8, e})} position={p} rotation={rot} scale={[w, h, 1]} receiveShadow />
);
/** Grupo que aparece con rebote (escala desde la base) y cae un poquito desde arriba. */
const Pop: React.FC<{v: number; p: V3; rotY?: number; children: React.ReactNode}> = ({v, p, rotY = 0, children}) => {
	const s = pop(v);
	return (
		<group position={[p[0], p[1] + (1 - suave(v)) * 0.12, p[2]]} rotation={[0, rotY, 0]} scale={Math.max(0.0001, s)} visible={s > 0.001}>
			{children}
		</group>
	);
};
/** Tubo que pasa por puntos (cacheado por clave). */
const Tubo: React.FC<{clave: string; puntos: V3[]; r: number; c?: string; m?: THREE.Material; seg?: number}> = ({clave, puntos, r, c = '#333333', m, seg = 48}) => {
	const g = geo(`tubo|${clave}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos.map((q) => new THREE.Vector3(...q))), seg, r, 6, false));
	return <mesh geometry={g} material={m ?? mat(c, {r: 0.5})} castShadow />;
};

// ---------- texturas ----------
const texCuadrosMantel = (clave: string, a: string, b: string, n = 8) =>
	texFija(clave, () => {
		const t = lienzo(256, 256, (ctx) => {
			const k = 256 / n;
			for (let i = 0; i < n; i++)
				for (let j = 0; j < n; j++) {
					ctx.fillStyle = (i + j) % 2 === 0 ? a : b;
					ctx.fillRect(i * k, j * k, k, k);
				}
			// trama de tela
			ctx.globalAlpha = 0.12;
			ctx.fillStyle = '#ffffff';
			for (let i = 0; i < n * 2; i++) ctx.fillRect(i * (k / 2), 0, 2, 256);
			ctx.globalAlpha = 1;
		});
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		return t;
	});
const texMantelRojo = () => texCuadrosMantel('mantelRojo', '#d8382f', '#fbf6ec', 8);

const texBaldosas = (clave: string, a: string, b: string, rep: number) =>
	texFija(clave, () => {
		const t = lienzo(256, 256, (ctx) => {
			ctx.fillStyle = a;
			ctx.fillRect(0, 0, 256, 256);
			ctx.fillStyle = b;
			ctx.fillRect(0, 0, 128, 128);
			ctx.fillRect(128, 128, 128, 128);
			ctx.strokeStyle = 'rgba(0,0,0,0.18)';
			ctx.lineWidth = 3;
			ctx.strokeRect(0, 0, 128, 128);
			ctx.strokeRect(128, 128, 128, 128);
			ctx.strokeRect(128, 0, 128, 128);
			ctx.strokeRect(0, 128, 128, 128);
		});
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(rep, rep);
		return t;
	});

const texPizarra = () =>
	texFija('pizarraMenu', () =>
		lienzo(768, 512, (ctx) => {
			ctx.fillStyle = '#1d2a24';
			ctx.fillRect(0, 0, 768, 512);
			// borrones de tiza
			const r = rng(7);
			ctx.globalAlpha = 0.07;
			ctx.fillStyle = '#ffffff';
			for (let i = 0; i < 26; i++) {
				ctx.beginPath();
				ctx.ellipse(r() * 768, r() * 512, 40 + r() * 90, 10 + r() * 25, r() * 3, 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalAlpha = 1;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#ffffff';
			ctx.font = `900 132px ${FUENTE}`;
			ctx.fillText('MENÚ', 384, 100);
			ctx.fillStyle = '#ffe36b';
			ctx.font = `900 190px ${FUENTE}`;
			ctx.fillText('S/ 12', 384, 285);
			ctx.fillStyle = '#ffffff';
			ctx.font = `700 46px ${FUENTE}`;
			ctx.fillText('entrada + segundo + refresco', 384, 440);
			// subrayado
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 7;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(220, 172);
			ctx.quadraticCurveTo(384, 160, 548, 174);
			ctx.stroke();
		}),
	);

const texReloj = (clave: string, h: number, m: number) =>
	texFija(clave, () =>
		lienzo(256, 256, (ctx) => {
			ctx.fillStyle = '#fbfaf5';
			ctx.beginPath();
			ctx.arc(128, 128, 126, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#1e1e1e';
			for (let i = 0; i < 12; i++) {
				const a = (i / 12) * Math.PI * 2;
				const l = i % 3 === 0 ? 22 : 12;
				ctx.save();
				ctx.translate(128, 128);
				ctx.rotate(a);
				ctx.fillRect(-4, -118, 8, l);
				ctx.restore();
			}
			const mano = (ang: number, largo: number, ancho: number) => {
				ctx.save();
				ctx.translate(128, 128);
				ctx.rotate(ang);
				ctx.fillRect(-ancho / 2, -largo, ancho, largo + 12);
				ctx.restore();
			};
			mano(((h % 12) + m / 60) * (Math.PI / 6), 62, 14);
			mano((m / 60) * Math.PI * 2, 96, 9);
			ctx.beginPath();
			ctx.arc(128, 128, 11, 0, Math.PI * 2);
			ctx.fill();
		}),
	);

const texCuadro = () =>
	texFija('cuadroCerros', () =>
		lienzo(256, 192, (ctx) => {
			ctx.fillStyle = '#8fd0f0';
			ctx.fillRect(0, 0, 256, 192);
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.arc(200, 42, 20, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = '#3f7d3a';
			ctx.beginPath();
			ctx.moveTo(0, 192);
			ctx.lineTo(0, 120);
			ctx.lineTo(70, 50);
			ctx.lineTo(120, 100);
			ctx.lineTo(170, 40);
			ctx.lineTo(256, 130);
			ctx.lineTo(256, 192);
			ctx.fill();
			ctx.fillStyle = '#6aa84f';
			ctx.fillRect(0, 150, 256, 42);
		}),
	);

const texLetrero = (clave: string, texto: string, fondo: string, tinta: string, w = 512, h = 128, tam = 92, borde?: string) =>
	texFija(clave, () =>
		lienzo(w, h, (ctx) => {
			ctx.fillStyle = fondo;
			ctx.fillRect(0, 0, w, h);
			if (borde) {
				ctx.strokeStyle = borde;
				ctx.lineWidth = h * 0.08;
				ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
			}
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = tinta;
			ctx.font = `900 ${tam}px ${FUENTE}`;
			ctx.fillText(texto, w / 2, h / 2 + tam * 0.05);
		}),
	);

const texCuadrosTaxi = () =>
	texFija('cuadrosTaxiGrande', () =>
		lienzo(512, 32, (ctx) => {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, 512, 32);
			ctx.fillStyle = '#1e1e1e';
			for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 16, j * 16, 16, 16);
		}),
	);

// ============================================================
// muebles compartidos
// ============================================================
/** Silla de madera (asiento a 0.45, respaldo hacia -Z: quien se sienta mira a +Z). */
const Silla: React.FC<{p: V3; rotY?: number; c?: string}> = ({p, rotY = 0, c = '#9a5a2c'}) => {
	const m = mat(c, {r: 0.7});
	return (
		<group position={p} rotation={[0, rotY, 0]}>
			<R p={[0, 0.43, 0]} s={[0.44, 0.05, 0.42]} r={0.02} m={m} />
			{[
				[-0.19, -0.18],
				[0.19, -0.18],
				[-0.19, 0.18],
				[0.19, 0.18],
			].map(([x, z]) => (
				<B key={`${x}${z}`} p={[x, 0.205, z]} s={[0.04, 0.41, 0.04]} m={m} />
			))}
			{[-0.19, 0.19].map((x) => (
				<B key={x} p={[x, 0.7, -0.19]} s={[0.04, 0.5, 0.04]} m={m} />
			))}
			<R p={[0, 0.86, -0.19]} s={[0.44, 0.16, 0.04]} r={0.015} m={m} />
			<B p={[0, 0.66, -0.19]} s={[0.38, 0.05, 0.03]} m={m} />
		</group>
	);
};

/** Plato blanco con filo azul. */
const Plato: React.FC<{p: V3; r?: number}> = ({p, r = 0.13}) => (
	<group position={p}>
		<Cil p={[0, 0, 0]} r={r} h={0.014} c="#fbfbf8" seg={28} o={{r: 0.35}} />
		<mesh geometry={G.toro(r * 0.94, 0.006, Math.PI * 2, 6, 32)} material={mat('#2f62c4', {r: 0.4})} position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]} />
	</group>
);

/** Vaso alto con líquido (nivel 0..1). */
const Vaso: React.FC<{p: V3; liquido: string; nivel?: number; r?: number; h?: number; hielo?: boolean}> = ({p, liquido, nivel = 0.8, r = 0.04, h = 0.15, hielo = false}) => (
	<group position={p}>
		<mesh geometry={G.cono(1.22, 20)} material={mat(liquido, {r: 0.25})} position={[0, (h * nivel) / 2 + 0.006, 0]} scale={[r * 1.8, h * nivel, r * 1.8]} castShadow />
		<mesh geometry={G.cono(1.25, 20, true)} material={VIDRIO()} position={[0, h / 2, 0]} scale={[r * 2, h, r * 2]} />
		<Cil p={[0, 0, 0]} r={r * 0.9} h={0.008} m={VIDRIO()} seg={16} sombra={false} />
		{hielo ? <R p={[0.008, h * nivel, 0.004]} s={[0.025, 0.02, 0.025]} r={0.006} c="#eef8ff" o={{r: 0.1, o: 0.8}} rot={[0.3, 0.5, 0.2]} sombra={false} /> : null}
	</group>
);

// ============================================================
// 1. RESTAURANTE (pista 1: menú de S/ 12 + chicha + postre)
// ============================================================
/** Dónde va el origen de un `<Protagonista sentado />` en Restaurante (mira a +Z, rotationY = ROT_SILLA). */
export const SILLA: V3 = [0, 0, -0.62];
export const ROT_SILLA = 0;
/** Centro de la mesa (cubierta a y = 0.78). */
export const MESA_RESTAURANTE: V3 = [0, 0.78, 0];

export type RestauranteProps = {
	/** 0..1: aparecen el vaso alto y la jarra de chicha morada. */
	chicha?: number;
	/** 0..1: aparece la copa de mazamorra morada con arroz con leche (el "clásico"). */
	postre?: number;
	/** Hora del reloj de pared (por defecto 1:30, la de la pista). */
	hora?: [number, number];
};

/** Seco con arroz y frejoles en su plato. */
const PlatoSeco: React.FC<{p: V3}> = ({p}) => {
	const frejoles = useMemo(() => {
		const r = rng(31);
		return Array.from({length: 22}, () => [0.03 + r() * 0.06, r() * 0.012, 0.02 + r() * 0.06] as V3);
	}, []);
	return (
		<group position={p}>
			<Plato p={[0, 0, 0]} r={0.15} />
			{/* arroz graneado (domo blanco) */}
			<mesh geometry={G.media(22)} material={mat('#fffdf5', {r: 0.9})} position={[-0.055, 0.014, -0.02]} scale={[0.13, 0.11, 0.12]} castShadow />
			{/* salsa verde del seco y presa */}
			<mesh geometry={G.disco(20)} material={mat('#4c6a26', {r: 0.5})} position={[0.05, 0.017, 0.02]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.15, 0.13, 1]} />
			<R p={[0.045, 0.04, 0.0]} s={[0.07, 0.045, 0.055]} r={0.02} c="#6a3418" rot={[0.1, 0.4, 0.15]} o={{r: 0.55}} />
			<R p={[0.085, 0.032, 0.045]} s={[0.05, 0.035, 0.04]} r={0.015} c="#7b3f1d" rot={[-0.2, -0.3, 0]} o={{r: 0.55}} />
			{/* papa amarilla */}
			<Esf p={[0.0, 0.03, 0.06]} r={[0.025, 0.02, 0.022]} c="#f2c53d" seg={12} />
			{/* frejoles */}
			{frejoles.map((f, i) => (
				<Esf key={i} p={[f[0] - 0.09, 0.022 + f[1], f[2] - 0.12]} r={[0.009, 0.007, 0.006]} c="#9b6a3a" seg={8} sombra={false} />
			))}
			{/* salsa criolla */}
			{[0, 1, 2, 3, 4].map((k) => (
				<B key={k} p={[0.07 + (k % 2) * 0.012, 0.03 + k * 0.004, -0.06 + k * 0.008]} s={[0.035, 0.005, 0.007]} rot={[0, k * 0.7, 0.2]} c="#b2306a" sombra={false} />
			))}
		</group>
	);
};

const Cubiertos: React.FC<{p: V3}> = ({p}) => {
	const metal = mat('#c9ccd2', {r: 0.3, m: 0.6});
	return (
		<group position={p}>
			{/* servilleta */}
			<B p={[-0.2, 0.003, 0]} s={[0.08, 0.004, 0.16]} c="#ffffff" sombra={false} />
			{/* tenedor */}
			<B p={[-0.2, 0.008, 0.02]} s={[0.012, 0.004, 0.12]} m={metal} sombra={false} />
			{[-1, 0, 1].map((k) => (
				<B key={k} p={[-0.2 + k * 0.006, 0.008, -0.06]} s={[0.003, 0.004, 0.035]} m={metal} sombra={false} />
			))}
			{/* cuchillo y cuchara */}
			<B p={[0.2, 0.004, 0.0]} s={[0.014, 0.004, 0.16]} m={metal} sombra={false} />
			<B p={[0.235, 0.004, 0.02]} s={[0.01, 0.004, 0.11]} m={metal} sombra={false} />
			<Esf p={[0.235, 0.006, -0.055]} r={[0.017, 0.005, 0.024]} m={metal} seg={10} sombra={false} />
		</group>
	);
};

/** Jarra de vidrio con chicha morada. */
const Jarra: React.FC<{p: V3}> = ({p}) => (
	<group position={p}>
		<mesh geometry={G.cono(0.85, 22)} material={mat('#2e0a33', {r: 0.25})} position={[0, 0.095, 0]} scale={[0.14, 0.17, 0.14]} castShadow />
		<mesh geometry={G.cono(0.85, 22, true)} material={VIDRIO()} position={[0, 0.12, 0]} scale={[0.155, 0.24, 0.155]} />
		<mesh geometry={G.toro(0.05, 0.012, Math.PI * 1.1, 6, 14)} material={mat('#e8f3f8', {r: 0.1, o: 0.6})} position={[0.075, 0.13, 0]} rotation={[0, 0, -Math.PI / 2 - 0.1]} />
		{/* espuma/borde de la chicha y trozos de piña */}
		<Cil p={[0, 0.178, 0]} r={0.06} h={0.004} c="#5a1d5e" seg={20} sombra={false} />
		<R p={[0.02, 0.18, 0.01]} s={[0.025, 0.012, 0.02]} r={0.004} c="#f5d65a" sombra={false} />
	</group>
);

/** Copa de mazamorra morada con arroz con leche y cucharita. */
const Clasico: React.FC<{p: V3}> = ({p}) => (
	<group position={p}>
		{/* platito */}
		<Cil p={[0, 0, 0]} r={0.07} h={0.008} c="#ffffff" seg={22} o={{r: 0.35}} />
		{/* copa */}
		<Cil p={[0, 0.008, 0]} r={0.025} h={0.01} m={VIDRIO()} seg={14} sombra={false} />
		<Cil p={[0, 0.018, 0]} r={0.008} h={0.03} m={VIDRIO()} seg={10} sombra={false} />
		<mesh geometry={G.cono(1.7, 22, true)} material={VIDRIO()} position={[0, 0.085, 0]} scale={[0.075, 0.075, 0.075]} />
		{/* mazamorra (mitad) + arroz con leche (mitad), con su domo */}
		<mesh geometry={G.cono(1.55, 22)} material={mat('#4a1450', {r: 0.35})} position={[0, 0.075, 0]} scale={[0.07, 0.05, 0.07]} />
		<mesh geometry={G.media(20)} material={mat('#4a1450', {r: 0.35})} position={[-0.022, 0.1, 0]} scale={[0.07, 0.04, 0.09]} />
		<mesh geometry={G.media(20)} material={mat('#f7efd9', {r: 0.85})} position={[0.025, 0.1, 0]} scale={[0.065, 0.045, 0.09]} castShadow />
		{/* canela */}
		{[
			[0.02, 0.0],
			[0.035, 0.015],
			[0.03, -0.018],
		].map(([x, z], i) => (
			<Esf key={i} p={[x, 0.122, z]} r={0.004} c="#7a4a22" seg={6} sombra={false} />
		))}
		{/* cucharita */}
		<group position={[0.01, 0.12, 0.01]} rotation={[0.5, 0, -0.5]}>
			<B p={[0, 0.05, 0]} s={[0.008, 0.11, 0.004]} c="#c9ccd2" o={{r: 0.3, m: 0.6}} />
		</group>
	</group>
);

/**
 * Rincón de restaurante de menú limeño, centrado en el origen (≈6 × 5.2, paredes de 3 de alto en
 * z = -2.6 y x = -3). Pizarra "MENÚ S/ 12", reloj (1:30), mesa con mantel a cuadros, dos sillas, seco
 * con arroz, cubiertos. `chicha` y `postre` hacen aparecer la chicha morada (vaso + jarra) y el postre.
 * No trae luces: usa `<Luces tarde={0.1} cielo={false} />` + fondo, o `Luces` normal.
 */
export const Restaurante: React.FC<RestauranteProps> = ({chicha = 0, postre = 0, hora = [1, 30]}) => {
	const y = MESA_RESTAURANTE[1];
	const mantel = matMapa('mantelRojo', texMantelRojo, {r: 0.8});
	return (
		<group>
			{/* piso de losetas */}
			<mesh geometry={G.caja()} material={matMapa('baldosaRest', () => texBaldosas('baldosaRest', '#f1e7d2', '#c95f3c', 4))} position={[0, -0.05, 0]} scale={[6, 0.1, 5.2]} receiveShadow />
			{/* pared del fondo: mostaza con zócalo verde */}
			<B p={[0, 1.5, -2.66]} s={[6, 3, 0.12]} c="#f2c14e" />
			<B p={[0, 0.5, -2.59]} s={[6, 1.0, 0.03]} c="#2f8f6f" />
			<B p={[0, 1.01, -2.575]} s={[6, 0.05, 0.03]} c="#1f6b52" />
			{/* pared izquierda */}
			<B p={[-3.06, 1.5, 0]} s={[0.12, 3, 5.2]} c="#eab441" />
			<B p={[-2.99, 0.5, 0]} s={[0.03, 1.0, 5.2]} c="#2f8f6f" />
			{/* pizarra del menú */}
			<group position={[0.45, 1.95, -2.55]}>
				<R p={[0, 0, 0]} s={[1.62, 1.12, 0.06]} r={0.02} c="#7a4a26" />
				<Cartel p={[0, 0, 0.032]} w={1.5} h={1.0} clave="pizarraMenu" tex={texPizarra} />
				<B p={[0, -0.6, 0.05]} s={[1.3, 0.04, 0.08]} c="#7a4a26" />
				<B p={[0.35, -0.565, 0.06]} s={[0.08, 0.02, 0.02]} c="#ffffff" />
			</group>
			{/* reloj de pared */}
			<group position={[-1.45, 2.25, -2.58]}>
				<Cil p={[0, 0, 0]} r={0.25} h={0.05} c="#1e1e1e" seg={32} rot={[Math.PI / 2, 0, 0]} />
				<Cartel p={[0, 0, 0.052]} w={0.44} h={0.44} clave={`reloj${hora[0]}:${hora[1]}`} tex={() => texReloj(`reloj${hora[0]}:${hora[1]}`, hora[0], hora[1])} />
			</group>
			{/* cuadro de cerros en la pared izquierda */}
			<group position={[-2.98, 1.9, -0.6]} rotation={[0, Math.PI / 2, 0]}>
				<R p={[0, 0, 0]} s={[0.9, 0.68, 0.04]} r={0.015} c="#5a3a20" />
				<Cartel p={[0, 0, 0.022]} w={0.8} h={0.58} clave="cuadroCerros" tex={texCuadro} />
			</group>
			{/* repisa con frascos y una maceta */}
			<group position={[-1.45, 1.45, -2.48]}>
				<B p={[0, 0, 0]} s={[0.9, 0.04, 0.22]} c="#7a4a26" />
				{['#d94b3f', '#f2c53d', '#45b3c4', '#6fc06a'].map((c, i) => (
					<group key={i} position={[-0.32 + i * 0.21, 0.02, 0]}>
						<Cil p={[0, 0, 0]} r={0.05} h={0.14} c={c} seg={14} />
						<Cil p={[0, 0.14, 0]} r={0.045} h={0.025} c="#ffffff" seg={14} />
					</group>
				))}
			</group>
			<group position={[2.5, 0, -2.15]}>
				<Cil p={[0, 0, 0]} r={0.22} h={0.42} c="#c95f3c" seg={18} />
				{[0, 1, 2, 3, 4].map((k) => (
					<Esf key={k} p={[Math.sin(k * 1.3) * 0.15, 0.62 + (k % 3) * 0.12, Math.cos(k * 1.3) * 0.12]} r={[0.18, 0.24, 0.18]} c="#3e8f3a" seg={10} />
				))}
			</group>
			{/* lámpara colgante sobre la mesa */}
			<group position={[0, 3, 0]}>
				<Cil p={[0, -0.75, 0]} r={0.006} h={0.75} c="#1e1e1e" seg={6} sombra={false} />
				<mesh geometry={G.cono(0.25, 22, true)} material={mat('#2f8f6f', {r: 0.6, lado: THREE.DoubleSide})} position={[0, -0.85, 0]} scale={[0.42, 0.22, 0.42]} />
				<Esf p={[0, -0.93, 0]} r={0.05} c="#fff6d8" o={{e: '#fff1c8', ei: 1.6}} sombra={false} />
				<pointLight position={[0, -1.0, 0]} color="#ffd9a0" intensity={1.2} distance={4} decay={2} />
			</group>

			{/* mesa con mantel a cuadros */}
			<group>
				{[
					[-0.44, -0.34],
					[0.44, -0.34],
					[-0.44, 0.34],
					[0.44, 0.34],
				].map(([x, z]) => (
					<B key={`${x}${z}`} p={[x, 0.37, z]} s={[0.05, 0.74, 0.05]} c="#6b3e1f" />
				))}
				<B p={[0, 0.755, 0]} s={[1.0, 0.03, 0.8]} c="#6b3e1f" />
				<mesh geometry={G.caja()} material={mantel} position={[0, 0.772, 0]} scale={[1.08, 0.012, 0.88]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[0, 0.7, 0.44]} scale={[1.08, 0.15, 0.01]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[0, 0.7, -0.44]} scale={[1.08, 0.15, 0.01]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[0.54, 0.7, 0]} scale={[0.01, 0.15, 0.88]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[-0.54, 0.7, 0]} scale={[0.01, 0.15, 0.88]} castShadow receiveShadow />
			</group>
			<Silla p={[SILLA[0], 0, SILLA[2] - 0.02]} />
			<Silla p={[-0.85, 0, 0.05]} rotY={Math.PI / 2} />

			{/* sobre la mesa */}
			<PlatoSeco p={[0, y, -0.12]} />
			<Cubiertos p={[0, y, -0.12]} />
			{/* salero y ají */}
			<group position={[-0.38, y, -0.3]}>
				<Cil p={[0, 0, 0]} r={0.02} h={0.07} c="#ffffff" seg={12} />
				<Cil p={[0, 0.07, 0]} r={0.021} h={0.015} c="#c9ccd2" seg={12} o={{m: 0.5, r: 0.3}} />
				<Cil p={[0.06, 0, 0.01]} r={0.03} h={0.05} c="#f2c53d" seg={14} />
				<Cil p={[0.06, 0.05, 0.01]} r={0.031} h={0.01} c="#ffffff" seg={14} />
			</group>
			<Pop v={tramo(chicha, 0, 0.7)} p={[0.27, y, 0.12]}>
				<Vaso p={[0, 0, 0]} liquido="#2e0a33" nivel={0.8} r={0.042} h={0.17} hielo />
			</Pop>
			<Pop v={tramo(chicha, 0.25, 1)} p={[0.36, y, -0.22]}>
				<Jarra p={[0, 0, 0]} />
			</Pop>
			<Pop v={postre} p={[-0.27, y, 0.12]}>
				<Clasico p={[0, 0, 0]} />
			</Pop>
		</group>
	);
};

// ============================================================
// 2. CALLE TARDE (pista 2: micro lleno, taxi, bodega)
// ============================================================
/** Donde se para el Protagonista para tomar el taxi (vereda, junto al sardinel). */
export const PARADA: V3 = [2.4, 0.12, 3.75];
/** Punto sobre el mostrador de la bodega (donde aparecen la gaseosa y las galletas). */
export const MOSTRADOR: V3 = [1.1, 1.06, 2.12];
/** Dónde se detiene el taxi (centro, mirando a -X). */
export const TAXI_ALTO: V3 = [4.4, 0, 5.05];
const TAXI_DESDE_X = 17;

/** Cabeza de pasajero (con pelo o gorro). */
const Cabeza: React.FC<{p: V3; piel: string; pelo: string; gorro?: string | null; aplastada?: number; rot?: V3}> = ({p, piel, pelo, gorro, aplastada = 0, rot}) => (
	<group position={p} rotation={rot} scale={[1, 1, 1 - aplastada * 0.35]}>
		<Esf p={[0, 0, 0]} r={[0.13, 0.14, 0.13]} c={piel} seg={14} sombra={false} />
		{gorro ? (
			<mesh geometry={G.media(14)} material={mat(gorro, {r: 0.7})} position={[0, 0.03, 0]} scale={[0.28, 0.24, 0.28]} />
		) : (
			<mesh geometry={G.media(14)} material={mat(pelo, {r: 0.8})} position={[0, 0.02, -0.01]} scale={[0.275, 0.25, 0.275]} />
		)}
		<Esf p={[-0.045, 0.01, 0.12]} r={0.016} c="#1a1414" seg={6} sombra={false} />
		<Esf p={[0.045, 0.01, 0.12]} r={0.016} c="#1a1414" seg={6} sombra={false} />
	</group>
);

const PIELES = ['#c98a5e', '#a86b44', '#e0a97c', '#8a5534', '#d39a6a'];
const PELOS = ['#1d1612', '#2a1d16', '#3b2a1f', '#141414'];
const ROPAS = ['#e85a8c', '#f2c53d', '#45b3c4', '#6fc06a', '#ffffff', '#d94b3f', '#9c72cf', '#f07a2a'];

/** Cobrador colgado de la puerta (figura de bloques con pose propia). Origen en el pie de apoyo. */
const Cobrador: React.FC<{p: V3; rotY?: number; fase?: number}> = ({p, rotY = 0, fase = 0}) => {
	const frame = useCurrentFrame();
	const saludo = Math.sin(frame * 0.3 + fase) * 0.25;
	const piel = mat('#b8794e', {r: 0.65});
	const ropa = mat('#2f8f6f', {r: 0.85});
	const jean = mat('#2b3f66', {r: 0.9});
	return (
		<group position={p} rotation={[0, rotY, 0]}>
			{/* inclinado hacia afuera (−X local) colgado de la mano derecha */}
			<group rotation={[0, 0, 0.42]}>
				{/* pierna de apoyo y pierna al aire */}
				<group position={[0.08, 0.8, 0]}>
					<R p={[0, -0.4, 0]} s={[0.17, 0.8, 0.2]} r={0.05} m={jean} />
					<R p={[0, -0.8, 0.05]} s={[0.18, 0.09, 0.3]} r={0.03} c="#2b2522" />
				</group>
				<group position={[-0.1, 0.8, 0]} rotation={[0.2, 0, -0.9]}>
					<R p={[0, -0.4, 0]} s={[0.17, 0.8, 0.2]} r={0.05} m={jean} />
					<R p={[0, -0.8, 0.05]} s={[0.18, 0.09, 0.3]} r={0.03} c="#2b2522" />
				</group>
				<R p={[0, 0.84, 0]} s={[0.42, 0.14, 0.24]} r={0.05} m={jean} />
				<R p={[0, 1.13, 0]} s={[0.46, 0.46, 0.26]} r={0.08} m={ropa} />
				{/* canguro de monedas */}
				<R p={[0, 0.92, 0.14]} s={[0.26, 0.1, 0.06]} r={0.02} c="#1e1e1e" />
				<Cil p={[0, 1.32, 0]} r={0.055} h={0.08} m={piel} seg={10} />
				<Esf p={[0, 1.5, 0]} r={[0.15, 0.16, 0.15]} m={piel} seg={18} />
				{/* boca abierta gritando la ruta */}
				<Esf p={[0, 1.44, 0.14]} r={[0.04, 0.035, 0.02]} c="#5a2620" seg={8} sombra={false} />
				<Esf p={[-0.055, 1.53, 0.135]} r={0.017} c="#1a1414" seg={6} sombra={false} />
				<Esf p={[0.055, 1.53, 0.135]} r={0.017} c="#1a1414" seg={6} sombra={false} />
				{/* gorra al revés */}
				<mesh geometry={G.media(16)} material={mat('#d94b3f', {r: 0.7})} position={[0, 1.56, 0]} scale={[0.33, 0.26, 0.33]} />
				<mesh geometry={G.cil(16)} material={mat('#d94b3f', {r: 0.7})} position={[0, 1.57, -0.16]} rotation={[-0.15, 0, 0]} scale={[0.26, 0.014, 0.2]} />
				{/* brazo que se agarra (hacia +X local, arriba) */}
				<group position={[0.27, 1.32, 0]} rotation={[0, 0, 2.55]}>
					<R p={[0, -0.3, 0]} s={[0.12, 0.6, 0.13]} r={0.05} m={ropa} />
					<Esf p={[0, -0.64, 0]} r={0.065} m={piel} seg={10} />
				</group>
				{/* brazo libre saludando hacia afuera */}
				<group position={[-0.27, 1.32, 0]} rotation={[-0.4, 0, -1.9 + saludo]}>
					<R p={[0, -0.18, 0]} s={[0.12, 0.34, 0.13]} r={0.05} m={ropa} />
					<R p={[0, -0.46, 0]} s={[0.1, 0.3, 0.11]} r={0.045} m={piel} />
					<Esf p={[0, -0.64, 0]} r={0.065} m={piel} seg={10} />
				</group>
			</group>
		</group>
	);
};

export type CombiProps = {position?: V3; rotationY?: number; escala?: number; fase?: number};

/**
 * Combi/micro genérica de Lima REPLETA (≈4.6 de largo en Z, 1.95 de ancho, 2.35 de alto), mira a +Z.
 * Blanca arriba, azul abajo, franjas roja y amarilla, letrero de ruta "CENTRO" (sin empresa). Puerta
 * abierta en el lado derecho (−X local) con gente apretada y un cobrador colgado; ventanas llenas de
 * cabezas, brazos afuera, bultos en la parrilla y la carrocería ladeada por el peso.
 */
export const Combi: React.FC<CombiProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, fase = 0}) => {
	const frame = useCurrentFrame();
	const rebote = Math.abs(Math.sin(frame * 0.45 + fase)) * 0.018;
	const blanco = mat('#f6f4ee', {r: 0.45});
	const azul = mat('#2556a8', {r: 0.45});
	const interior = mat('#262a33', {r: 0.9});
	const llanta = mat('#1f1f1f', {r: 0.85});
	const rin = mat('#cfcfcf', {r: 0.35, m: 0.4});
	const L = 4.6;
	const W = 1.95;
	const pasajeros = useMemo(() => {
		const r = rng(73);
		const lista: {p: V3; piel: string; pelo: string; gorro: string | null; aplastada: number; rot: V3}[] = [];
		// lado de la puerta (−X): dos filas de cabezas en la franja de ventanas (z -2.0 .. 0.95)
		for (let z = -1.95; z <= 1.85; z += 0.29) {
			if (z > -0.6 && z < 0.5) continue; // puerta
			for (let fila = 0; fila < 2; fila++) {
				if (fila === 1 && r() < 0.15) continue;
				lista.push({
					p: [-W / 2 + 0.2 + r() * 0.06 + fila * 0.12, fila === 0 ? 1.56 + r() * 0.06 : 1.86 + r() * 0.06, z + (r() - 0.5) * 0.1 + fila * 0.12],
					piel: PIELES[Math.floor(r() * PIELES.length)],
					pelo: PELOS[Math.floor(r() * PELOS.length)],
					gorro: r() < 0.25 ? ROPAS[Math.floor(r() * ROPAS.length)] : null,
					aplastada: fila === 0 && r() < 0.3 ? 1 : 0,
					rot: [(r() - 0.5) * 0.3, -Math.PI / 2 + (r() - 0.5) * 0.9, (r() - 0.5) * 0.4],
				});
			}
		}
		return lista;
	}, []);
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* llantas (no se ladean) */}
			{[-1, 1].map((s) =>
				[1.45, -1.45].map((z) => (
					<group key={`${s}${z}`} position={[s * (W / 2 - 0.12), 0.38, z]} rotation={[0, 0, Math.PI / 2]}>
						<mesh geometry={G.cil(20)} material={llanta} scale={[0.76, 0.28, 0.76]} castShadow />
						<mesh geometry={G.cil(14)} material={rin} position={[0, s * 0.145, 0]} scale={[0.4, 0.02, 0.4]} />
					</group>
				)),
			)}
			<group position={[0, rebote, 0]} rotation={[0, 0, 0.045]}>
				{/* carrocería baja azul */}
				<R p={[0, 0.82, 0]} s={[W, 0.92, L]} r={0.14} m={azul} />
				{/* guardafangos oscuros */}
				{[-1, 1].map((s) =>
					[1.45, -1.45].map((z) => <B key={`${s}${z}`} p={[s * (W / 2 + 0.005), 0.55, z]} s={[0.02, 0.36, 0.86]} c="#1e2b44" sombra={false} />),
				)}
				{/* franjas roja y amarilla */}
				<B p={[0, 1.22, 0]} s={[W + 0.02, 0.13, L - 0.12]} c="#d9362b" />
				<B p={[0, 0.98, 0]} s={[W + 0.02, 0.06, L - 0.2]} c="#f2c53d" />
				{/* interior oscuro visible por las ventanas */}
				<B p={[0, 1.6, 0]} s={[W - 1.15, 0.8, L - 0.2]} m={interior} sombra={false} />
				<B p={[0, 1.27, 0]} s={[W - 0.1, 0.06, L - 0.2]} m={interior} sombra={false} />
				<B p={[0, 1.95, 0]} s={[W - 0.1, 0.06, L - 0.2]} m={interior} sombra={false} />
				{/* banda blanca superior y techo */}
				<R p={[0, 2.12, 0]} s={[W, 0.34, L]} r={0.12} m={blanco} />
				{/* parantes entre ventanas (ambos lados) y marcos */}
				{[-1, 1].map((s) => (
					<group key={s}>
						{[-2.18, -1.62, -1.04, -0.47, 0.47, 1.02, 1.5, 1.98, 2.18].map((z) => (
							<B key={z} p={[s * (W / 2 - 0.03), 1.62, z]} s={[0.07, 0.66, 0.1]} m={blanco} />
						))}
						<B p={[s * (W / 2 - 0.03), 1.3, 0]} s={[0.08, 0.06, L - 0.1]} m={blanco} />
					</group>
				))}
				{/* puerta corrediza abierta al medio (−X), entre z -0.42 y 0.42: hueco oscuro hasta abajo + estribo */}
				<B p={[-W / 2 - 0.004, 0.98, 0]} s={[0.02, 1.25, 0.84]} m={interior} sombra={false} />
				<B p={[-W / 2 - 0.12, 0.42, 0]} s={[0.26, 0.06, 0.8]} c="#9a9a9a" o={{m: 0.4, r: 0.4}} />
				<B p={[-W / 2 - 0.03, 1.32, -0.75]} s={[0.04, 1.1, 0.5]} c="#f6f4ee" rot={[0, 0, 0]} />
				{/* gente apretada en la puerta */}
				{[
					[-0.25, '#e85a8c', '#c98a5e'],
					[0.0, '#f2c53d', '#8a5534'],
					[0.25, '#45b3c4', '#e0a97c'],
				].map(([z, ropa, piel], i) => (
					<group key={i} position={[-W / 2 + 0.12, 0.45, z as number]} rotation={[0, -Math.PI / 2 + (i - 1) * 0.3, 0]}>
						<R p={[0, 0.65, 0]} s={[0.42, 0.75, 0.24]} r={0.08} c={ropa as string} />
						<Cabeza p={[0, 1.22 + (i % 2) * 0.06, 0]} piel={piel as string} pelo={PELOS[i]} gorro={i === 2 ? '#ffffff' : null} />
					</group>
				))}
				{/* pasajeros en ventanas */}
				{pasajeros.map((q, i) => (
					<Cabeza key={i} p={q.p} piel={q.piel} pelo={q.pelo} gorro={q.gorro} aplastada={q.aplastada} rot={q.rot} />
				))}
				{/* brazos afuera de las ventanas */}
				{[
					[-1.3, 0.4],
					[1.25, -0.3],
				].map(([z, g], i) => (
					<group key={i} position={[-W / 2 - 0.02, 1.48, z]} rotation={[g, 0, -1.25]}>
						<R p={[0, -0.18, 0]} s={[0.1, 0.36, 0.1]} r={0.04} c={PIELES[i + 1]} />
						<Esf p={[0, -0.38, 0]} r={0.055} c={PIELES[i + 1]} seg={10} />
					</group>
				))}
				{/* bolsa colgando de una ventana */}
				<group position={[-W / 2 - 0.06, 1.35, -1.85]}>
					<R p={[0, -0.15, 0]} s={[0.2, 0.26, 0.12]} r={0.04} c="#f2c53d" />
					<mesh geometry={G.toro(0.06, 0.01, Math.PI, 6, 12)} material={mat('#f2c53d')} position={[0, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
				</group>
				{/* frente: parabrisas, conductor, letrero de ruta, faros */}
				<mesh geometry={G.plano()} material={mat('#1d2a3e', {r: 0.15, o: 0.55})} position={[0, 1.66, L / 2 + 0.006]} scale={[W - 0.25, 0.62, 1]} />
				<Cabeza p={[0.45, 1.6, L / 2 - 0.35]} piel="#a86b44" pelo="#141414" />
				<Cabeza p={[-0.45, 1.62, L / 2 - 0.3]} piel="#e0a97c" pelo="#2a1d16" aplastada={1} />
				<Cabeza p={[0.0, 1.66, L / 2 - 0.4]} piel="#c98a5e" pelo="#1d1612" gorro="#9c72cf" />
				<Cartel p={[-0.35, 1.9, L / 2 + 0.012]} w={0.7} h={0.18} clave="rutaCentro" tex={() => texLetrero('rutaCentro', 'CENTRO', '#ffffff', '#d9362b', 512, 128, 96, '#d9362b')} />
				{[-1, 1].map((s) => (
					<group key={s}>
						<Esf p={[s * 0.7, 0.85, L / 2 + 0.01]} r={[0.13, 0.11, 0.04]} c="#fff8e0" o={{e: '#fff2c0', ei: 1.2, r: 0.2}} sombra={false} />
						<B p={[s * 0.75, 0.9, -L / 2 - 0.01]} s={[0.16, 0.22, 0.03]} c="#d9362b" o={{e: '#d9362b', ei: 0.4}} sombra={false} />
					</group>
				))}
				<R p={[0, 0.45, L / 2 + 0.04]} s={[W + 0.04, 0.16, 0.12]} r={0.05} c="#3a3a3a" />
				<R p={[0, 0.45, -L / 2 - 0.04]} s={[W + 0.04, 0.16, 0.12]} r={0.05} c="#3a3a3a" />
				{/* número de ruta pintado en el costado (sin empresa) */}
				<Cartel p={[-W / 2 - 0.012, 0.74, -1.3]} w={0.7} h={0.36} rot={[0, -Math.PI / 2, 0]} clave="ruta73" tex={() => texLetrero('ruta73', '73', '#f6f4ee', '#1e1e1e', 256, 128, 110)} />
				{/* parrilla del techo con bultos */}
				{[-1, 1].map((s) => (
					<B key={s} p={[s * 0.75, 2.36, -0.4]} s={[0.04, 0.05, 3.0]} c="#555555" o={{m: 0.4, r: 0.4}} />
				))}
				<R p={[-0.25, 2.5, -0.9]} s={[0.8, 0.3, 0.6]} r={0.12} c="#3f7fd0" />
				<R p={[0.35, 2.48, -0.2]} s={[0.6, 0.26, 0.55]} r={0.1} c="#e8e2d0" />
				<R p={[0.0, 2.48, 0.5]} s={[0.55, 0.24, 0.5]} r={0.1} c="#c95f3c" />
				<B p={[0.35, 2.62, -0.2]} s={[0.62, 0.02, 0.03]} c="#d9362b" sombra={false} />
				{/* cobrador colgado */}
				<Cobrador p={[-W / 2 - 0.14, 0.45, 0.15]} rotY={-0.55} fase={fase} />
			</group>
		</group>
	);
};

export type TaxiProps = {position?: V3; rotationY?: number; escala?: number; rueda?: number};

/** Taxi amarillo genérico tamaño real (≈3.9 de largo en Z, 1.72 de ancho, 1.65 de alto con letrero). */
export const Taxi: React.FC<TaxiProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, rueda = 0}) => {
	const amarillo = mat('#f4c22b', {r: 0.35});
	const vidrio = mat('#22324a', {r: 0.12, m: 0.1});
	const llanta = mat('#1f1f1f', {r: 0.85});
	const rin = mat('#cfcfcf', {r: 0.35, m: 0.4});
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<R p={[0, 0.62, 0]} s={[1.72, 0.56, 3.9]} r={0.2} m={amarillo} />
			<R p={[0, 1.08, -0.2]} s={[1.56, 0.5, 2.0]} r={0.16} m={vidrio} />
			<R p={[0, 1.33, -0.25]} s={[1.6, 0.08, 1.7]} r={0.05} m={amarillo} />
			{[-1, 1].map((s) => (
				<group key={s}>
					<B p={[s * 0.775, 1.08, -0.2]} s={[0.04, 0.46, 0.09]} m={amarillo} />
					<B p={[s * 0.765, 1.08, 0.72]} s={[0.04, 0.45, 0.09]} m={amarillo} rot={[-0.55, 0, 0]} />
					<B p={[s * 0.765, 1.08, -1.12]} s={[0.04, 0.45, 0.09]} m={amarillo} rot={[0.5, 0, 0]} />
					<mesh geometry={G.plano()} material={matMapa('cuadrosTaxiGrande', texCuadrosTaxi, {r: 0.6})} position={[s * 0.865, 0.68, 0]} rotation={[0, (s * Math.PI) / 2, 0]} scale={[3.3, 0.16, 1]} />
					<Esf p={[s * 0.55, 0.7, 1.94]} r={[0.17, 0.11, 0.04]} c="#fffbe8" o={{e: '#fff3c4', ei: 1.2, r: 0.2}} sombra={false} />
					<B p={[s * 0.6, 0.72, -1.95]} s={[0.3, 0.13, 0.03]} c="#d9362b" o={{e: '#d9362b', ei: 0.35}} sombra={false} />
					{[1.25, -1.25].map((z) => (
						<group key={z} position={[s * 0.74, 0.33, z]} rotation={[rueda, 0, Math.PI / 2]}>
							<mesh geometry={G.cil(20)} material={llanta} scale={[0.66, 0.26, 0.66]} castShadow />
							<mesh geometry={G.cil(12)} material={rin} position={[0, s * -0.135, 0]} scale={[0.34, 0.02, 0.34]} />
						</group>
					))}
					<B p={[s * 0.9, 0.98, 0.65]} s={[0.12, 0.08, 0.06]} m={amarillo} />
				</group>
			))}
			{/* conductor detrás del vidrio */}
			<Esf p={[0.4, 1.12, 0.15]} r={[0.13, 0.14, 0.13]} c="#a86b44" seg={14} />
			<R p={[0, 0.38, 1.98]} s={[1.76, 0.16, 0.1]} r={0.05} c="#3a3a3a" />
			<R p={[0, 0.38, -1.98]} s={[1.76, 0.16, 0.1]} r={0.05} c="#3a3a3a" />
			{/* letrero TAXI en el techo */}
			<group position={[0, 1.37, -0.2]}>
				<R p={[0, 0.1, 0]} s={[0.24, 0.2, 0.62]} r={0.04} c="#fff6d6" o={{e: '#fff1b8', ei: 0.35}} />
				{[-1, 1].map((s) => (
					<Cartel key={s} p={[s * 0.123, 0.1, 0]} w={0.56} h={0.17} rot={[0, (s * Math.PI) / 2, 0]} clave="taxiTecho" tex={() => texLetrero('taxiTecho', 'TAXI', '#fff6d6', '#1e1e1e', 256, 80, 66)} e={0.3} />
				))}
			</group>
		</group>
	);
};

/** Gaseosa personal genérica color cola (sin logo). Base en y = 0, ≈0.3 de alto (tamaño "juguete"). */
const Gaseosa: React.FC<{p?: V3}> = ({p = [0, 0, 0]}) => (
	<group position={p}>
		<mesh geometry={G.cono(0.9, 22)} material={mat('#3b1a0c', {r: 0.18})} position={[0, 0.1, 0]} scale={[0.1, 0.2, 0.1]} castShadow />
		<mesh geometry={G.cono(0.35, 22)} material={mat('#3b1a0c', {r: 0.18})} position={[0, 0.24, 0]} scale={[0.09, 0.08, 0.09]} castShadow />
		<Cil p={[0, 0.28, 0]} r={0.018} h={0.03} c="#d9362b" seg={12} />
		{/* etiqueta lisa con onda blanca, sin marca */}
		<Cil p={[0, 0.07, 0]} r={0.0505} h={0.07} c="#d9362b" seg={22} o={{r: 0.5}} />
		<Cil p={[0, 0.098, 0]} r={0.0508} h={0.014} c="#ffffff" seg={22} sombra={false} />
		{/* gotitas de frío */}
		{[0.15, 0.18, 0.2].map((y, i) => (
			<Esf key={i} p={[Math.sin(i * 2) * 0.046, y, Math.cos(i * 2) * 0.046]} r={0.006} c="#eaf6ff" o={{r: 0.1}} seg={6} sombra={false} />
		))}
	</group>
);

/** Paquete de galletas genérico (rollo envuelto). */
const Galletas: React.FC<{p?: V3; rotY?: number}> = ({p = [0, 0, 0], rotY = 0}) => (
	<group position={p} rotation={[0, rotY, 0]}>
		<group position={[0, 0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
			<mesh geometry={G.cil(18)} material={mat('#2f62c4', {r: 0.4})} scale={[0.09, 0.2, 0.09]} castShadow />
			{[-1, 1].map((s) => (
				<mesh key={s} geometry={G.cono(0.3, 14)} material={mat('#2f62c4', {r: 0.4})} position={[0, s * 0.115, 0]} rotation={[s > 0 ? 0 : Math.PI, 0, 0]} scale={[0.09, 0.03, 0.09]} />
			))}
		</group>
		{/* galletas dibujadas en el empaque */}
		{[-0.05, 0.0, 0.05].map((x) => (
			<group key={x} position={[x, 0.045, 0.045]} rotation={[0, 0, 0]}>
				<Cil p={[0, 0, 0]} r={0.022} h={0.006} c="#8a5a33" seg={14} rot={[Math.PI / 2, 0, 0]} sombra={false} />
			</group>
		))}
		<B p={[0, 0.09, 0]} s={[0.17, 0.004, 0.02]} c="#ffffff" sombra={false} />
	</group>
);

export type BodegaProps = {position?: V3; rotationY?: number; escala?: number; compras?: number};

/**
 * Bodega de esquina (frente de 3.2 de ancho, 2 pisos ≈5.4 de alto con fierros arriba), mira a +Z,
 * con la fachada en z = 0. Letrero "BODEGA", cartelito "GASEOSA HELADA", reja con ventanilla,
 * anaqueles llenos de productos genéricos y un bodeguero. El mostrador sale hasta z ≈ 0.42
 * (cubierta a y = 1.06 sobre la vereda de 0.12). `compras` 0..1 hace aparecer la gaseosa y las galletas.
 */
export const Bodega: React.FC<BodegaProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, compras = 0}) => {
	const productos = useMemo(() => {
		const r = rng(11);
		const colores = ['#d8312f', '#f2c53d', '#2f62c4', '#ffffff', '#3fae5a', '#f07a2a', '#9c72cf', '#3b1a0c'];
		const lista: {x: number; y: number; w: number; h: number; c: string; t: 'caja' | 'bot'}[] = [];
		for (const y of [0.55, 1.15, 1.7]) {
			let x = -1.25;
			while (x < 1.2) {
				const t = r() < 0.4 ? 'bot' : 'caja';
				const w = t === 'bot' ? 0.09 : 0.12 + r() * 0.12;
				const h = t === 'bot' ? 0.28 + r() * 0.06 : 0.16 + r() * 0.2;
				lista.push({x: x + w / 2, y, w, h, c: colores[Math.floor(r() * colores.length)], t});
				x += w + 0.025;
			}
		}
		return lista;
	}, []);
	const fierro = mat('#3a3d42', {r: 0.5, m: 0.4});
	const pared = '#7cc7b0';
	const yv = 0.12; // vereda
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* volumen del local (2 pisos) */}
			<B p={[-1.25, 2.7, -1.6]} s={[0.7, 5.4, 3.2]} c={pared} />
			<B p={[1.25, 2.7, -1.6]} s={[0.7, 5.4, 3.2]} c={pared} />
			<B p={[0, 4.0, -1.6]} s={[1.8, 2.8, 3.2]} c={pared} />
			<B p={[0, 2.7, -3.15]} s={[3.2, 5.4, 0.1]} c={pared} />
			{/* interior */}
			<B p={[0, yv + 0.01, -1.6]} s={[1.8, 0.02, 3.0]} c="#d8cfbd" sombra={false} />
			<B p={[0, 1.4, -1.0]} s={[1.8, 2.6, 0.05]} c="#efe6d0" />
			{/* anaqueles */}
			{[0.5, 1.1, 1.65].map((y) => (
				<B key={y} p={[0, y, -0.85]} s={[1.8, 0.04, 0.3]} c="#8a5a33" />
			))}
			{productos.map((q, i) =>
				q.t === 'bot' ? (
					<group key={i} position={[q.x, q.y + 0.02, -0.82]}>
						<Cil p={[0, 0, 0]} r={q.w / 2} h={q.h * 0.75} c={q.c} seg={10} />
						<Cil p={[0, q.h * 0.75, 0]} r={q.w * 0.22} h={q.h * 0.25} c={q.c} seg={8} />
					</group>
				) : (
					<B key={i} p={[q.x, q.y + 0.02 + q.h / 2, -0.82]} s={[q.w, q.h, 0.16]} c={q.c} />
				),
			)}
			{/* bodeguero */}
			<Persona position={[0.45, 0, -0.42]} colorPlayera="#ffffff" colorGorra="#d94b3f" />
			{/* murito bajo + reja con ventanilla */}
			<B p={[0, 0.5, -0.04]} s={[1.8, 0.8, 0.12]} c="#3d8f78" />
			<B p={[0, 2.25, -0.04]} s={[1.8, 0.1, 0.1]} m={fierro} />
			<B p={[0, 0.92, -0.04]} s={[1.8, 0.06, 0.1]} m={fierro} />
			{Array.from({length: 17}, (_, i) => -0.84 + i * 0.105).map((x) =>
				Math.abs(x - 0.0) < 0.36 ? (
					// ventanilla abierta: barrotes solo arriba
					<B key={x} p={[x, 1.98, -0.04]} s={[0.025, 0.46, 0.025]} m={fierro} />
				) : (
					<B key={x} p={[x, 1.58, -0.04]} s={[0.025, 1.3, 0.025]} m={fierro} />
				),
			)}
			<B p={[0, 1.74, -0.04]} s={[0.76, 0.05, 0.08]} m={fierro} />
			{/* mostrador (repisa de la ventanilla) */}
			<R p={[0, 1.02, 0.18]} s={[1.6, 0.08, 0.5]} r={0.02} c="#d9362b" />
			<B p={[0, 0.98, 0.42]} s={[1.6, 0.04, 0.02]} c="#a82a22" />
			{/* letrero BODEGA */}
			<group position={[0, 2.75, 0.06]}>
				<R p={[0, 0, 0]} s={[3.0, 0.72, 0.1]} r={0.03} c="#1e1e1e" />
				<Cartel p={[0, 0, 0.052]} w={2.86} h={0.6} clave="letreroBodega" tex={() => texLetrero('letreroBodega', 'BODEGA', '#f7d23e', '#1e1e1e', 1024, 214, 170)} />
			</group>
			{/* toldo */}
			<group position={[0, 2.32, 0.3]} rotation={[0.45, 0, 0]}>
				{Array.from({length: 8}, (_, i) => (
					<B key={i} p={[-1.4 + i * 0.4 + 0.2, 0, 0]} s={[0.4, 0.03, 0.62]} c={i % 2 ? '#ffffff' : '#d9362b'} />
				))}
			</group>
			{/* cartel pintado a mano */}
			<group position={[1.25, 1.35, 0.03]}>
				<Cartel p={[0, 0, 0]} w={0.6} h={0.7} clave="gaseosaHelada" tex={() =>
					texFija('gaseosaHelada', () =>
						lienzo(256, 300, (ctx) => {
							ctx.fillStyle = '#ffffff';
							ctx.fillRect(0, 0, 256, 300);
							ctx.strokeStyle = '#2f62c4';
							ctx.lineWidth = 12;
							ctx.strokeRect(6, 6, 244, 288);
							ctx.textAlign = 'center';
							ctx.fillStyle = '#d9362b';
							ctx.font = `900 58px ${FUENTE}`;
							ctx.fillText('HAY', 128, 75);
							ctx.fillStyle = '#1e1e1e';
							ctx.font = `900 46px ${FUENTE}`;
							ctx.fillText('GASEOSA', 128, 150);
							ctx.fillStyle = '#2f62c4';
							ctx.font = `900 54px ${FUENTE}`;
							ctx.fillText('HELADA', 128, 225);
							ctx.fillStyle = '#1e1e1e';
							ctx.font = `700 34px ${FUENTE}`;
							ctx.fillText('★ ★ ★', 128, 272);
						}),
					)
				} />
			</group>
			{/* segundo piso: ventana y fierros de construcción */}
			<group position={[0, 4.0, 0.0]}>
				<B p={[0, 0, 0.01]} s={[1.1, 0.9, 0.04]} c="#ffffff" />
				<B p={[0, 0, 0.03]} s={[0.98, 0.78, 0.02]} c="#2b4a6b" o={{r: 0.15}} />
				<B p={[0, 0, 0.045]} s={[0.04, 0.78, 0.02]} c="#ffffff" />
			</group>
			{[-1.4, -0.5, 0.5, 1.4].map((x) =>
				[-0.2, -3.0].map((z) => (
					<group key={`${x}${z}`}>
						{[-0.06, 0.06].map((d) => (
							<Cil key={d} p={[x + d, 5.4, z]} r={0.015} h={0.75} c="#6b4a3a" seg={6} sombra={false} />
						))}
					</group>
				)),
			)}
			{/* compras sobre el mostrador */}
			<Pop v={tramo(compras, 0, 0.6)} p={[-0.18, 1.06, 0.2]}>
				<group scale={1.4}>
					<Gaseosa />
				</group>
			</Pop>
			<Pop v={tramo(compras, 0.35, 1)} p={[0.2, 1.06, 0.22]} rotY={0.25}>
				<group scale={1.4}>
					<Galletas />
				</group>
			</Pop>
		</group>
	);
};

/** Poste de luz con cables (6 pm: la lámpara ya está prendida). */
const PosteLuz: React.FC<{p: V3; brillo?: number}> = ({p, brillo = 1}) => (
	<group position={p}>
		<Cil p={[0, 0, 0]} r={0.09} h={6.5} c="#9a9790" seg={10} />
		<B p={[0, 6.1, 0]} s={[1.4, 0.08, 0.08]} c="#6b6b6b" />
		<group position={[0, 5.3, 0]}>
			<B p={[0, 0, 0.55]} s={[0.06, 0.06, 1.1]} c="#6b6b6b" />
			<R p={[0, -0.06, 1.1]} s={[0.22, 0.1, 0.42]} r={0.04} c="#3a3a3a" />
			<B p={[0, -0.12, 1.1]} s={[0.16, 0.02, 0.34]} c="#fff1c8" o={{e: '#ffd890', ei: 1.5 * brillo}} sombra={false} />
			<pointLight position={[0, -0.4, 1.1]} color="#ffcf86" intensity={3 * brillo} distance={7} decay={2} />
		</group>
	</group>
);

/** Cable que cuelga entre dos puntos (catenaria aproximada). */
const Cable: React.FC<{clave: string; a: V3; b: V3; caida?: number}> = ({clave, a, b, caida = 0.5}) => {
	const puntos = Array.from({length: 9}, (_, i) => {
		const t = i / 8;
		return [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - caida * 4 * t * (1 - t), lerp(a[2], b[2], t)] as V3;
	});
	return <Tubo clave={clave} puntos={puntos} r={0.012} c="#1e1e1e" seg={24} />;
};

export type CalleTardeProps = {
	/** 0..1: el taxi llega desde la derecha (+X) y frena en TAXI_ALTO. */
	taxi?: number;
	/** 0..1: aparecen en el mostrador la gaseosa (0..0.6) y las galletas (0.35..1). */
	bodega?: number;
	/** Dibuja su propia pista y veredas (para usarla SIN <Barrio>). Por defecto false. */
	calle?: boolean;
};

/**
 * Calle limeña a las 6 pm, pensada para ir ENCIMA de `<Barrio>` (misma pista en z 4.2..7.8, vereda
 * hasta z 4.2) y con `<Luces tarde={0.8}>`. Ocupa |x| < 3.9 detrás de la vereda: bodega de esquina
 * (fachada en z = 1.9, x -1.6..1.6) con casas vecinas, poste de luz y cables. En la pista: combi repleta
 * en el carril cercano (z ≈ 6.9, a la izquierda, mirando a +X) y el taxi que llega por el carril de la
 * vereda (z ≈ 5.05) desde x = 17 hasta TAXI_ALTO. El Protagonista va en PARADA.
 */
export const CalleTarde: React.FC<CalleTardeProps> = ({taxi = 0, bodega = 0, calle = false}) => {
	const k = 1 - Math.pow(1 - clamp01(taxi), 3); // frena al llegar
	const tx = lerp(TAXI_DESDE_X, TAXI_ALTO[0], k);
	const rueda = (TAXI_DESDE_X - tx) / 0.33;
	return (
		<group>
			{calle ? (
				<group>
					<B p={[0, -0.05, -2]} s={[40, 0.1, 12]} c="#d8cdb2" sombra={false} />
					<B p={[0, 0.06, 3.7]} s={[40, 0.12, 1.0]} c="#cfcac0" />
					<B p={[0, 0.06, 4.22]} s={[40, 0.12, 0.08]} c="#e8c63b" />
					<B p={[0, -0.02, 6.0]} s={[40, 0.04, 3.6]} c="#55565c" sombra={false} />
					<B p={[0, 0.06, 8.3]} s={[40, 0.12, 1.0]} c="#cfcac0" />
				</group>
			) : null}
			{/* vereda ancha frente a la bodega (une la fachada con la vereda del Barrio) */}
			<B p={[0, 0.06, 2.55]} s={[7.8, 0.12, 1.3]} c="#cfcac0" />
			<Bodega position={[MOSTRADOR[0], 0, 1.9]} compras={bodega} />
			{/* vecinos */}
			<group>
				<B p={[-2.2, 1.6, 0.4]} s={[3.4, 3.2, 3.0]} c="#e85a8c" />
				<B p={[-2.2, 3.25, 1.85]} s={[3.5, 0.1, 0.1]} c="#ffffff" />
				<B p={[-3.1, 1.12, 1.91]} s={[0.8, 2.0, 0.04]} c="#6b3e1f" />
				<B p={[-1.3, 1.9, 1.91]} s={[0.7, 0.75, 0.04]} c="#2b4a6b" />
				<B p={[-1.3, 1.9, 1.93]} s={[0.04, 0.75, 0.02]} c="#ffffff" />
				<B p={[3.3, 1.4, 0.4]} s={[1.2, 2.8, 3.0]} c="#f2883a" />
				<B p={[3.3, 1.6, 1.91]} s={[0.7, 0.8, 0.04]} c="#2b4a6b" />
				<B p={[3.3, 1.6, 1.93]} s={[0.7, 0.04, 0.02]} c="#ffffff" />
				{[2.9, 3.7].map((x) => (
					<Cil key={x} p={[x, 2.8, 0.4]} r={0.015} h={0.7} c="#6b4a3a" seg={6} sombra={false} />
				))}
			</group>
			{/* poste de luz y cables */}
			<PosteLuz p={[-2.3, 0.12, 4.0]} />
			<Cable clave="cableA" a={[-2.3, 6.1, 4.0]} b={[-1.0, 4.6, 1.92]} caida={0.35} />
			<Cable clave="cableB" a={[-2.6, 6.1, 4.0]} b={[-14, 6.1, 4.0]} caida={0.8} />
			<Cable clave="cableC" a={[-2.0, 6.1, 4.0]} b={[14, 6.1, 4.0]} caida={0.9} />
			{/* combi repleta en el carril cercano */}
			<Combi position={[-1.7, 0, 6.85]} rotationY={Math.PI / 2} />
			{/* taxi que llega */}
			<group visible={taxi > 0.001}>
				<Taxi position={[tx, 0, TAXI_ALTO[2]]} rotationY={-Math.PI / 2} rueda={rueda} />
			</group>
			{/* marca en la pista donde frena el taxi */}
			<B p={[TAXI_ALTO[0] - 2.2, 0.005, TAXI_ALTO[2]]} s={[0.12, 0.01, 1.6]} c="#f1e6c0" sombra={false} />
		</group>
	);
};

// ============================================================
// 3. MESA NOCHE (pista 3: "yo pago toda la cuenta")
// ============================================================
/** Origen de un `<Protagonista sentado />` en MesaNoche, con rotationY = ROT_PROTA (mira a la mesa y a cámara). */
export const SILLA_PROTA: V3 = [1.3, 0, 0.14];
export const ROT_PROTA = -1.05;
/** Dónde termina el folder de la cuenta (frente al protagonista). */
export const CUENTA_FIN: V3 = [0.6, 0.79, 0.24];
const CUENTA_INI: V3 = [-0.35, 0.79, 0.12];

/** Pollo a la brasa entero con papas en su fuente. */
const PolloBrasa: React.FC<{p: V3}> = ({p}) => {
	const papas = useMemo(() => {
		const r = rng(5);
		return Array.from({length: 26}, () => {
			const a = r() * Math.PI * 2;
			const d = 0.13 + r() * 0.05;
			return {p: [Math.cos(a) * d * 1.3, 0.025 + r() * 0.02, Math.sin(a) * d] as V3, rot: [r() * 0.5, r() * 3, r() * 0.5] as V3};
		});
	}, []);
	const dorado = mat('#9a4f1f', {r: 0.35});
	return (
		<group position={p}>
			<mesh geometry={G.cil(28)} material={mat('#ffffff', {r: 0.35})} position={[0, 0.008, 0]} scale={[0.5, 0.016, 0.4]} castShadow receiveShadow />
			<Esf p={[0, 0.07, 0]} r={[0.11, 0.07, 0.085]} m={dorado} seg={20} />
			{[-1, 1].map((s) => (
				<group key={s}>
					<Esf p={[0.07, 0.06, s * 0.07]} r={[0.06, 0.04, 0.035]} m={dorado} seg={12} />
					<Cil p={[0.13, 0.05, s * 0.075]} r={0.009} h={0.04} c="#f5ead6" seg={6} rot={[0, 0, -1.3]} />
					<Esf p={[-0.06, 0.07, s * 0.08]} r={[0.04, 0.025, 0.03]} m={dorado} seg={10} />
				</group>
			))}
			{papas.map((q, i) => (
				<B key={i} p={q.p} s={[0.07, 0.016, 0.016]} rot={q.rot} c="#f6cf55" sombra={false} />
			))}
		</group>
	);
};

/** Botella grande de gaseosa amarilla genérica (sin marca). */
const BotellaAmarilla: React.FC<{p: V3}> = ({p}) => (
	<group position={p}>
		<mesh geometry={G.cil(20)} material={mat('#f2c81e', {r: 0.15})} position={[0, 0.13, 0]} scale={[0.1, 0.26, 0.1]} castShadow />
		<mesh geometry={G.cono(0.3, 20)} material={mat('#f2c81e', {r: 0.15})} position={[0, 0.3, 0]} scale={[0.1, 0.08, 0.1]} castShadow />
		<Cil p={[0, 0.34, 0]} r={0.018} h={0.03} c="#2f62c4" seg={10} />
		<Cil p={[0, 0.1, 0]} r={0.051} h={0.08} c="#2f62c4" seg={20} sombra={false} />
		<Cil p={[0, 0.13, 0]} r={0.052} h={0.02} c="#ffffff" seg={20} sombra={false} />
	</group>
);

const texCuenta = () =>
	texFija('folderCuenta', () =>
		lienzo(256, 384, (ctx) => {
			ctx.fillStyle = '#1d1d1d';
			ctx.fillRect(0, 0, 256, 384);
			ctx.strokeStyle = '#e9c46a';
			ctx.lineWidth = 8;
			ctx.strokeRect(16, 16, 224, 352);
			ctx.save();
			ctx.translate(128, 192);
			ctx.rotate(-Math.PI / 2);
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#f2d27a';
			ctx.font = `900 74px ${FUENTE}`;
			ctx.fillText('CUENTA', 0, 0);
			ctx.restore();
		}),
	);

/** Folder negro de la cuenta (≈0.2 × 0.3) con el ticket asomando. Origen en su base, centro. */
const FolderCuenta: React.FC<{p: V3; rotY?: number}> = ({p, rotY = 0}) => (
	<group position={p} rotation={[0, rotY, 0]}>
		<R p={[0, 0.012, 0]} s={[0.2, 0.024, 0.3]} r={0.008} c="#1d1d1d" o={{r: 0.45}} />
		<Cartel p={[0, 0.0245, 0]} w={0.19} h={0.29} rot={[-Math.PI / 2, 0, -Math.PI / 2]} clave="folderCuenta" tex={texCuenta} />
		{/* ticket */}
		<B p={[0.03, 0.013, -0.16]} s={[0.09, 0.006, 0.08]} c="#fbfaf4" sombra={false} />
		{[0, 1, 2].map((k) => (
			<B key={k} p={[0.03, 0.017, -0.175 - k * 0.015]} s={[0.06, 0.002, 0.004]} c="#9a9a9a" sombra={false} />
		))}
	</group>
);

const Foquitos: React.FC<{clave: string; a: V3; b: V3; caida: number; n: number; luz?: number}> = ({clave, a, b, caida, n, luz = 1}) => {
	const pt = (t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - caida * 4 * t * (1 - t), lerp(a[2], b[2], t)];
	const cable = Array.from({length: 11}, (_, i) => pt(i / 10));
	const colores = ['#ffd47a', '#ffe9b0', '#ffb85c'];
	return (
		<group>
			<Tubo clave={clave} puntos={cable} r={0.008} c="#1a1a1a" seg={32} />
			{Array.from({length: n}, (_, i) => {
				const q = pt((i + 0.5) / n);
				const c = colores[i % 3];
				return (
					<group key={i} position={[q[0], q[1] - 0.06, q[2]]}>
						<Cil p={[0, 0.03, 0]} r={0.012} h={0.03} c="#2a2a2a" seg={6} sombra={false} />
						<Esf p={[0, 0, 0]} r={[0.035, 0.045, 0.035]} c={c} o={{e: c, ei: 2.2 * luz, r: 0.3}} seg={10} sombra={false} />
					</group>
				);
			})}
		</group>
	);
};

export type MesaNocheProps = {
	/** 0..1: el folder "CUENTA" se desliza desde el centro de la mesa hasta el protagonista. */
	cuenta?: number;
	/** 0..1: los tres amigos levantan los brazos y celebran. */
	amigos?: number;
	/** Trae sus luces de noche (fondo azul, foquitos cálidos, luna). Por defecto true; false = pon las tuyas. */
	luces?: boolean;
};

/**
 * Noche en una pollería con terraza, centrada en el origen (≈7 × 6). Pared del fondo con letrero
 * "POLLERÍA" luminoso, tres tiras de foquitos, mesa con pollo a la brasa, platos, vasos y botella
 * amarilla genérica, tres amigos (Persona) sentados detrás de la mesa mirando al protagonista, y el
 * folder de la cuenta. El Protagonista va sentado en SILLA_PROTA con rotationY = ROT_PROTA.
 */
export const MesaNoche: React.FC<MesaNocheProps> = ({cuenta = 0, amigos = 0, luces = true}) => {
	const y = 0.78;
	const kc = suave(cuenta);
	const pc: V3 = [lerp(CUENTA_INI[0], CUENTA_FIN[0], kc), CUENTA_INI[1] + Math.sin(kc * Math.PI) * 0.03, lerp(CUENTA_INI[2], CUENTA_FIN[2], kc)];
	const mantel = matMapa('mantelNoche', () => texCuadrosMantel('mantelNoche', '#f6efdc', '#f2c53d', 10), {r: 0.8});
	const AMIGOS: {x: number; z: number; rot: number; playera: string; gorra: string; fase: number}[] = [
		{x: -0.72, z: -0.66, rot: 0.35, playera: '#2f62c4', gorra: '#f2c53d', fase: 0},
		{x: 0.0, z: -0.7, rot: 0.45, playera: '#e85a8c', gorra: '#1e1e1e', fase: 1.7},
		{x: 0.62, z: -0.66, rot: 0.6, playera: '#3fae5a', gorra: '#ffffff', fase: 3.1},
	];
	return (
		<group>
			{luces ? (
				<>
					<color attach="background" args={['#121833']} />
					<fog attach="fog" args={['#121833', 12, 40]} />
					<hemisphereLight args={['#6a78c0', '#3a2418', 0.55]} />
					<ambientLight intensity={0.3} color="#ffd9b0" />
					<directionalLight
						position={[3, 7, 6]}
						intensity={1.2}
						color="#ffe2b8"
						castShadow
						shadow-mapSize={[2048, 2048]}
						shadow-camera-left={-5}
						shadow-camera-right={5}
						shadow-camera-top={5}
						shadow-camera-bottom={-5}
						shadow-bias={-0.0006}
						shadow-normalBias={0.04}
					/>
					<directionalLight position={[-5, 4, -3]} intensity={0.35} color="#8fa2ff" />
					<pointLight position={[0, 2.3, 0]} color="#ffbf6e" intensity={3.5} distance={6} decay={2} />
					<pointLight position={[-1.8, 2.4, -1.2]} color="#ffbf6e" intensity={2.2} distance={5} decay={2} />
					<pointLight position={[1.8, 2.4, 1.0]} color="#ffbf6e" intensity={2.2} distance={5} decay={2} />
				</>
			) : null}
			{/* piso (grueso: esconde las piernas de los amigos "sentados") */}
			<mesh geometry={G.caja()} material={matMapa('baldosaNoche', () => texBaldosas('baldosaNoche', '#c9a27a', '#8a4b2e', 5))} position={[0, -0.3, 0]} scale={[7, 0.6, 6]} receiveShadow />
			{/* pared del fondo y letrero luminoso */}
			<B p={[0, 1.6, -2.6]} s={[7, 3.2, 0.14]} c="#8e3826" />
			<B p={[0, 0.45, -2.52]} s={[7, 0.9, 0.03]} c="#5c2a1e" />
			<group position={[-0.2, 2.45, -2.5]}>
				<R p={[0, 0, 0]} s={[2.5, 0.6, 0.08]} r={0.03} c="#1e1e1e" />
				<Cartel p={[0, 0, 0.042]} w={2.4} h={0.5} clave="letreroPolleria" tex={() => texLetrero('letreroPolleria', 'POLLERÍA', '#1e1e1e', '#ffd36a', 1024, 214, 160)} e={1.2} />
			</group>
			{/* ventana de noche con luna */}
			<group position={[2.2, 1.65, -2.52]}>
				<B p={[0, 0, 0]} s={[1.0, 0.9, 0.04]} c="#efe6d0" />
				<B p={[0, 0, 0.02]} s={[0.88, 0.78, 0.02]} c="#1b2550" />
				<Esf p={[0.2, 0.18, 0.035]} r={[0.08, 0.08, 0.01]} c="#fff6d8" o={{e: '#fff6d8', ei: 1.2}} sombra={false} />
			</group>
			{/* postes y tiras de foquitos */}
			{[-2.7, 2.7].map((x) => [-2.3, 1.6].map((z) => <Cil key={`${x}${z}`} p={[x, 0, z]} r={0.05} h={2.8} c="#5a3a20" seg={8} />))}
			<Foquitos clave="foq1" a={[-2.7, 2.75, -2.3]} b={[2.7, 2.75, -2.3]} caida={0.35} n={14} />
			<Foquitos clave="foq2" a={[-2.7, 2.75, -2.3]} b={[2.7, 2.75, 1.6]} caida={0.45} n={16} />
			<Foquitos clave="foq3" a={[2.7, 2.75, -2.3]} b={[-2.7, 2.75, 1.6]} caida={0.45} n={16} />
			<Foquitos clave="foq4" a={[-2.7, 2.75, 1.6]} b={[2.7, 2.75, 1.6]} caida={0.35} n={14} />
			{/* plantas */}
			{[-2.6, 2.9].map((x, i) => (
				<group key={x} position={[x, 0, -2.0]}>
					<Cil p={[0, 0, 0]} r={0.24} h={0.45} c="#c95f3c" seg={16} />
					{[0, 1, 2, 3].map((k) => (
						<Esf key={k} p={[Math.sin(k * 1.6 + i) * 0.16, 0.66 + (k % 2) * 0.16, Math.cos(k * 1.6) * 0.12]} r={[0.2, 0.26, 0.2]} c="#3e8f3a" seg={10} />
					))}
				</group>
			))}

			{/* mesa (mantel hasta casi el piso) */}
			<group>
				<B p={[-0.05, 0.75, 0]} s={[1.9, 0.04, 0.9]} c="#6b3e1f" />
				<mesh geometry={G.caja()} material={mantel} position={[-0.05, 0.772, 0]} scale={[1.96, 0.012, 0.96]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[-0.05, 0.42, 0.48]} scale={[1.96, 0.7, 0.01]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[-0.05, 0.42, -0.48]} scale={[1.96, 0.7, 0.01]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[0.93, 0.42, 0]} scale={[0.01, 0.7, 0.96]} castShadow receiveShadow />
				<mesh geometry={G.caja()} material={mantel} position={[-1.03, 0.42, 0]} scale={[0.01, 0.7, 0.96]} castShadow receiveShadow />
			</group>
			{/* sillas de los amigos y del protagonista */}
			{AMIGOS.map((a) => (
				<Silla key={a.x} p={[a.x, 0, a.z - 0.12]} rotY={a.rot * 0.5} c="#d9362b" />
			))}
			<Silla p={[SILLA_PROTA[0] + 0.05, 0, SILLA_PROTA[2] - 0.03]} rotY={ROT_PROTA} c="#d9362b" />
			{/* amigos (Persona hundida 0.33 = altura de sentado; el piso grueso y el mantel tapan las piernas) */}
			{AMIGOS.map((a) => (
				<Persona key={a.x} position={[a.x, -0.33, a.z]} rotationY={a.rot} colorPlayera={a.playera} colorGorra={a.gorra} celebra={amigos} fase={a.fase} />
			))}
			{/* comida y bebida */}
			<PolloBrasa p={[-0.25, y, 0.02]} />
			{AMIGOS.map((a) => (
				<group key={a.x}>
					<Plato p={[a.x + 0.05, y, -0.28]} r={0.11} />
					<Vaso p={[a.x + 0.2, y, -0.22]} liquido="#f2c81e" nivel={0.7} r={0.035} h={0.13} />
				</group>
			))}
			<Plato p={[0.62, y, -0.08]} r={0.11} />
			<Vaso p={[0.72, y, -0.28]} liquido="#f2c81e" nivel={0.5} r={0.035} h={0.13} />
			<BotellaAmarilla p={[0.3, y, -0.2]} />
			{/* ensalada y cremas */}
			<group position={[-0.8, y, 0.15]}>
				<mesh geometry={G.media(16)} material={mat('#ffffff', {r: 0.4, lado: THREE.DoubleSide})} position={[0, 0.07, 0]} rotation={[Math.PI, 0, 0]} scale={[0.2, 0.14, 0.2]} />
				{[0, 1, 2, 3, 4].map((k) => (
					<Esf key={k} p={[Math.sin(k * 1.3) * 0.05, 0.075, Math.cos(k * 1.3) * 0.05]} r={0.035} c={k % 2 ? '#d9362b' : '#6fc06a'} seg={8} />
				))}
			</group>
			{['#f2c53d', '#ffffff', '#3fae5a'].map((c, i) => (
				<group key={c} position={[0.05 + i * 0.07, y, 0.32]}>
					<Cil p={[0, 0, 0]} r={0.025} h={0.03} c="#ffffff" seg={12} />
					<Cil p={[0, 0.02, 0]} r={0.022} h={0.012} c={c} seg={12} sombra={false} />
				</group>
			))}
			{/* la cuenta */}
			<group position={pc} rotation={[0, lerp(0.5, -0.45, kc), 0]} scale={1.35}>
				<FolderCuenta p={[0, 0, 0]} />
			</group>
		</group>
	);
};

// ============================================================
// 4. SALCHIPAPA (delivery de medianoche)
// ============================================================
export type SalchipapaProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	/** 0 = caja cerrada · 1 = tapa abierta hacia atrás mostrando papas, salchicha y cremas. */
	abierta?: number;
	/** Muestra la bolsa de delivery al costado. Por defecto true. */
	bolsa?: boolean;
};

/**
 * Salchipapa de delivery: caja de tecnopor (0.26 × 0.08 × 0.22) que se abre hacia atrás mostrando papas
 * fritas, salchicha en rodajas y líneas de kétchup y mayonesa, dos cremitas al lado y la bolsa de
 * delivery genérica (`BolsaDelivery`) detrás a la derecha. Mira a +Z (la tapa se abre hacia −Z).
 */
export const Salchipapa: React.FC<SalchipapaProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, abierta = 1, bolsa = true}) => {
	const W = 0.26;
	const D = 0.22;
	const H = 0.07;
	const t = 0.006;
	const tecnopor = mat('#f8f8f3', {r: 0.95});
	const relleno = useMemo(() => {
		const r = rng(99);
		const papas = Array.from({length: 46}, () => ({
			p: [(r() - 0.5) * (W - 0.1), 0.03 + r() * 0.035, (r() - 0.5) * (D - 0.1)] as V3,
			rot: [(r() - 0.5) * 0.6, r() * Math.PI, (r() - 0.5) * 0.6] as V3,
			l: 0.05 + r() * 0.035,
			c: r() < 0.3 ? '#e9b13a' : '#f6cf55',
		}));
		const salchis = Array.from({length: 16}, () => ({
			p: [(r() - 0.5) * (W - 0.06), 0.06 + r() * 0.02, (r() - 0.5) * (D - 0.06)] as V3,
			rot: [(r() - 0.5) * 1.2, r() * Math.PI, (r() - 0.5) * 1.2] as V3,
		}));
		return {papas, salchis};
	}, []);
	const zig = (dz: number, n: number, y: number): V3[] =>
		Array.from({length: n}, (_, i) => [-(W - 0.06) / 2 + (i / (n - 1)) * (W - 0.06), y + (i % 2) * 0.004, dz + (i % 2 ? 0.04 : -0.04)] as V3);
	const ang = -1.95 * suave(abierta);
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* bandeja */}
			<B p={[0, t / 2, 0]} s={[W, t, D]} m={tecnopor} />
			<B p={[0, H / 2, D / 2 - t / 2]} s={[W, H, t]} m={tecnopor} />
			<B p={[0, H / 2, -D / 2 + t / 2]} s={[W, H, t]} m={tecnopor} />
			<B p={[W / 2 - t / 2, H / 2, 0]} s={[t, H, D]} m={tecnopor} />
			<B p={[-W / 2 + t / 2, H / 2, 0]} s={[t, H, D]} m={tecnopor} />
			{/* pestaña de cierre */}
			<B p={[0, H - 0.01, D / 2 + 0.012]} s={[0.06, 0.02, 0.02]} m={tecnopor} />
			{/* contenido */}
			<group visible={abierta > 0.02}>
				<B p={[0, 0.02, 0]} s={[W - 0.02, 0.03, D - 0.02]} c="#f2c14e" sombra={false} />
				{relleno.papas.map((q, i) => (
					<B key={i} p={q.p} s={[q.l, 0.013, 0.013]} rot={q.rot} c={q.c} sombra={false} />
				))}
				{relleno.salchis.map((q, i) => (
					<group key={i} position={q.p} rotation={q.rot}>
						<mesh geometry={G.cil(14)} material={mat('#a8442e', {r: 0.45})} scale={[0.036, 0.012, 0.036]} castShadow />
						<mesh geometry={G.disco(14)} material={mat('#e59a80', {r: 0.6})} position={[0, 0.0062, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.028, 0.028, 1]} />
					</group>
				))}
				<Tubo clave="ketchupSalchi" puntos={zig(-0.03, 7, 0.088)} r={0.0055} c="#c3241c" seg={60} />
				<Tubo clave="mayoSalchi" puntos={zig(0.04, 7, 0.09)} r={0.0055} c="#fffbe8" seg={60} />
			</group>
			{/* tapa con bisagra en el borde de atrás */}
			<group position={[0, H, -D / 2]} rotation={[ang, 0, 0]}>
				<group position={[0, 0, D / 2]}>
					<B p={[0, H * 0.6 - t / 2, 0]} s={[W, t, D]} m={tecnopor} />
					<B p={[0, H * 0.3, D / 2 - t / 2]} s={[W, H * 0.6, t]} m={tecnopor} />
					<B p={[0, H * 0.3, -D / 2 + t / 2]} s={[W, H * 0.6, t]} m={tecnopor} />
					<B p={[W / 2 - t / 2, H * 0.3, 0]} s={[t, H * 0.6, D]} m={tecnopor} />
					<B p={[-W / 2 + t / 2, H * 0.3, 0]} s={[t, H * 0.6, D]} m={tecnopor} />
					{/* nervaduras de la tapa */}
					{[-0.06, 0, 0.06].map((x) => (
						<B key={x} p={[x, H * 0.6 + 0.002, 0]} s={[0.01, 0.004, D - 0.04]} m={tecnopor} />
					))}
				</group>
			</group>
			{/* cremitas */}
			{[
				['#f2c53d', 0.19, 0.08],
				['#fffbe8', 0.2, -0.01],
			].map(([c, x, z]) => (
				<group key={c as string} position={[x as number, 0, z as number]}>
					<mesh geometry={G.cono(1.3, 16)} material={mat('#ffffff', {r: 0.8})} position={[0, 0.018, 0]} scale={[0.05, 0.036, 0.05]} castShadow />
					<Cil p={[0, 0.03, 0]} r={0.03} h={0.008} c={c as string} seg={16} sombra={false} />
				</group>
			))}
			{bolsa ? <BolsaDelivery position={[0.34, 0, -0.3]} rotationY={-0.5} escala={1.1} /> : null}
		</group>
	);
};
