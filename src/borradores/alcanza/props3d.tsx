// Props 3D del reel de Alcanza (app de control de gastos del creador), mismo estilo diorama que
// `../finanzas/escenarios.tsx`: primitivas de three.js con aristas redondeadas, sombreado suave,
// colores saturados y texturas dibujadas en canvas (sin archivos externos).
// Animación 100 % determinista: depende solo de props o de useCurrentFrame() (nada de Math.random).
// Convención: el origen de cada modelo está en su base (y = 0) y mira hacia +Z. Unidades ≈ metros.
//
// Marca: tinta #1E1E1E · salvia #6B9080 · terracota #D96B52 · miel #E9C46A · rojo #D9482F
// (la mascota usa gorro rojo con pompón, camisa crema y jeans).
import {useEffect, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';

type V3 = [number, number, number];

export const MARCA = {
	tinta: '#1E1E1E',
	salvia: '#6B9080',
	terracota: '#D96B52',
	miel: '#E9C46A',
	rojo: '#D9482F',
} as const;

// ============================================================
// utilidades
// ============================================================
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const suave = (v: number) => {
	const t = clamp01(v);
	return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

/** Textura que se rehace cuando cambia `clave` y libera la anterior. */
const useTextura = (clave: string, crear: () => THREE.Texture) => {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const tex = useMemo(crear, [clave]);
	useEffect(() => () => tex.dispose(), [tex]);
	return tex;
};

/** Textura fija compartida (se crea una vez por módulo). */
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

type OpcMat = {r?: number; m?: number; e?: string; ei?: number; lado?: THREE.Side; flat?: boolean; o?: number};
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
			flatShading: o.flat ?? false,
			transparent: o.o !== undefined,
			opacity: o.o ?? 1,
			depthWrite: o.o === undefined,
		});
		cacheMat.set(clave, m);
	}
	return m;
};
const matMapa = (clave: string, tex: () => THREE.Texture, o: {r?: number; lado?: THREE.Side; ei?: number} = {}) => {
	const k = `map|${clave}|${JSON.stringify(o)}`;
	let m = cacheMat.get(k);
	if (!m) {
		const t = tex();
		m = new THREE.MeshStandardMaterial({
			map: t,
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
const Cil: React.FC<{p: V3; r: number; h: number; c?: string; m?: THREE.Material; seg?: number; rot?: V3; o?: OpcMat}> = ({p, r, h, c = '#cccccc', m, seg = 24, rot, o}) => (
	<group position={p} rotation={rot}>
		<mesh geometry={G.cil(seg)} material={m ?? mat(c, o)} position={[0, h / 2, 0]} scale={[r * 2, h, r * 2]} castShadow receiveShadow />
	</group>
);
const Esf: React.FC<{p: V3; r: number | V3; c?: string; m?: THREE.Material; seg?: number; o?: OpcMat; sombra?: boolean}> = ({p, r, c = '#cccccc', m, seg = 20, o, sombra = true}) => (
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
/** Cilindro delgado entre dos puntos (patas, antenas). */
const Palo: React.FC<{a: V3; b: V3; r: number; m: THREE.Material; seg?: number}> = ({a, b, r, m, seg = 6}) => {
	const va = new THREE.Vector3(...a);
	const vb = new THREE.Vector3(...b);
	const d = vb.clone().sub(va);
	const largo = d.length();
	const q = new THREE.Quaternion().setFromUnitVectors(ARRIBA, d.normalize());
	const medio = va.add(vb).multiplyScalar(0.5);
	return <mesh geometry={G.cil(seg)} material={m} position={[medio.x, medio.y, medio.z]} quaternion={[q.x, q.y, q.z, q.w]} scale={[r * 2, largo, r * 2]} castShadow />;
};

const FUENTE = 'Arial, Helvetica, "DejaVu Sans", sans-serif';

// ============================================================
// Celular
// ============================================================
export type CelularProps = {
	position?: V3;
	rotation?: V3;
	escala?: number;
	/** Texto corto en grande en la pantalla (p. ej. "S/ 12.40"). */
	pantalla?: string;
	/** Brillo de la pantalla (emisivo). 1 por defecto; 0 = apagada. */
	brillo?: number;
};

const dibujarPantalla = (texto: string) => (ctx: CanvasRenderingContext2D) => {
	const W = 256;
	const H = 528;
	const g = ctx.createLinearGradient(0, 0, 0, H);
	g.addColorStop(0, '#fbf7ee');
	g.addColorStop(1, '#efe6d2');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	// cabecera salvia con el nombre de la app
	ctx.fillStyle = MARCA.salvia;
	ctx.fillRect(0, 0, W, 96);
	ctx.fillStyle = '#ffffff';
	ctx.font = `800 34px ${FUENTE}`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('Alcanza', W / 2, 58);
	// monto
	ctx.fillStyle = MARCA.tinta;
	let tam = 64;
	ctx.font = `900 ${tam}px ${FUENTE}`;
	while (ctx.measureText(texto).width > W - 24 && tam > 20) {
		tam -= 4;
		ctx.font = `900 ${tam}px ${FUENTE}`;
	}
	ctx.fillText(texto, W / 2, 180);
	// barras por categoría
	const barras: [string, number][] = [
		[MARCA.terracota, 0.82],
		[MARCA.miel, 0.58],
		[MARCA.salvia, 0.4],
		[MARCA.rojo, 0.25],
	];
	barras.forEach(([c, v], i) => {
		const y = 262 + i * 52;
		ctx.fillStyle = '#e2d8c3';
		ctx.beginPath();
		ctx.roundRect(28, y, W - 56, 28, 14);
		ctx.fill();
		ctx.fillStyle = c;
		ctx.beginPath();
		ctx.roundRect(28, y, (W - 56) * v, 28, 14);
		ctx.fill();
	});
	// botón "+"
	ctx.fillStyle = MARCA.rojo;
	ctx.beginPath();
	ctx.arc(W / 2, 486, 26, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(W / 2 - 13, 482, 26, 8);
	ctx.fillRect(W / 2 - 4, 473, 8, 26);
};

/**
 * Celular de pie, pantalla hacia +Z. Con escala 1 mide 0.16 × 0.33 × 0.02 (base en y = 0).
 * La pantalla es emisiva y muestra "Alcanza", el texto de `pantalla` y barras de categorías.
 */
export const Celular: React.FC<CelularProps> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1, pantalla = 'S/ 12.40', brillo = 1}) => {
	const tex = useTextura(`cel|${pantalla}`, () => lienzo(256, 528, dibujarPantalla(pantalla)));
	const pantallaM = useMemo(() => new THREE.MeshStandardMaterial({map: tex, emissiveMap: tex, emissive: new THREE.Color('#ffffff'), roughness: 0.3}), [tex]);
	useEffect(() => () => pantallaM.dispose(), [pantallaM]);
	pantallaM.emissiveIntensity = 0.15 + 0.95 * Math.max(0, brillo);
	pantallaM.color.setScalar(brillo > 0.02 ? 1 : 0.15);
	return (
		<group position={position} rotation={rotation} scale={escala}>
			<group position={[0, 0.165, 0]}>
				<mesh geometry={G.redonda(0.16, 0.33, 0.02, 0.022, 4)} material={mat(MARCA.tinta, {r: 0.35, m: 0.2})} castShadow receiveShadow />
				<mesh geometry={G.plano()} material={pantallaM} position={[0, 0, 0.0102]} scale={[0.145, 0.3, 1]} />
				{/* isla de la cámara frontal */}
				<mesh geometry={G.redonda(0.04, 0.009, 0.002, 0.0045)} material={mat('#000000', {r: 0.3})} position={[0, 0.138, 0.0112]} />
				{/* cámara trasera */}
				<mesh geometry={G.redonda(0.05, 0.05, 0.006, 0.014)} material={mat('#2b2b2b', {r: 0.4})} position={[-0.038, 0.11, -0.012]} />
				<Esf p={[-0.048, 0.12, -0.015]} r={[0.011, 0.011, 0.004]} c="#0d0d0d" seg={12} o={{r: 0.2}} sombra={false} />
				<Esf p={[-0.028, 0.1, -0.015]} r={[0.011, 0.011, 0.004]} c="#0d0d0d" seg={12} o={{r: 0.2}} sombra={false} />
				{/* botones laterales */}
				<B p={[0.081, 0.06, 0]} s={[0.004, 0.05, 0.008]} c="#333333" sombra={false} />
				<B p={[-0.081, 0.08, 0]} s={[0.004, 0.03, 0.008]} c="#333333" sombra={false} />
			</group>
		</group>
	);
};

// ============================================================
// Protagonista (mascota de Alcanza)
// ============================================================
export type AnimoProtagonista = 'normal' | 'confundido' | 'feliz' | 'panico' | 'serio';

export type ProtagonistaProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	caminando?: boolean;
	/** 0..1: brazos arriba y brinquitos. */
	celebra?: number;
	/** 'panico': ojos enormes con pupilas chicas, boca en "O", el gorro brinca y gotas de sudor. 'serio': ojos a media asta y boca plana. */
	animo?: AnimoProtagonista;
	/** 0..1: sube un celular en la mano derecha frente a la cara, con la pantalla encendida. */
	conCelular?: number;
	/** Texto de la pantalla del celular. */
	pantalla?: string;
	/** Pose sentada para un sillón con asiento a ≈0.45 de alto (el origen queda bajo la cadera). */
	sentado?: boolean;
	/** Con conCelular: true = estira el brazo y le muestra la pantalla a la cámara (+Z). */
	pantallaAlFrente?: boolean;
	/** Desfase del ciclo de caminar/respirar (radianes). */
	fase?: number;
	/** 0..1: lentes oscuros de detective. Entre 0 y 1 la mano derecha los sube desde abajo hasta la cara (de 1 a 0 se los quita). */
	lentes?: number;
	/** 0..1: las dos manos a la cabeza (desesperación). */
	manosCabeza?: number;
	/** 0..1: libreta en la mano izquierda y lápiz escribiendo en la derecha (mira la libreta). */
	anotando?: number;
	/** 0..1: vaso de agua en la mano derecha; 0.5 = a la altura del pecho, 1 = tomando. 0 = sin vaso. */
	vaso?: number;
	/** Pan francés en la mano izquierda. */
	pan?: boolean;
};

const texInterrogacion = () =>
	texFija('interrogacion', () =>
		lienzo(256, 256, (ctx) => {
			ctx.font = `900 220px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.lineJoin = 'round';
			ctx.lineWidth = 26;
			ctx.strokeStyle = MARCA.tinta;
			ctx.strokeText('?', 128, 140);
			ctx.fillStyle = MARCA.miel;
			ctx.fillText('?', 128, 140);
		}),
	);

// ---------- props de mano (también los usa ../detective/sets-cuarto.tsx) ----------
export type PropManoProps = {position?: V3; rotation?: V3; escala?: number};

/**
 * Lentes oscuros de detective (≈0.25 de ancho): micas negras brillantes, marco grueso arriba y patillas
 * hacia -Z. El origen es el centro del puente; miran a +Z. Hechos a la medida de la cara de la mascota.
 */
export const LentesOscuros: React.FC<PropManoProps & {patillas?: boolean}> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1, patillas = true}) => {
	const negro = mat('#0b0b0e', {r: 0.12, m: 0.35});
	const marco = mat('#141416', {r: 0.3, m: 0.2});
	const brillo = mat('#ffffff', {r: 0.2, o: 0.32});
	return (
		<group position={position} rotation={rotation} scale={escala}>
			{[-1, 1].map((s) => (
				<group key={s} position={[s * 0.058, 0, 0]} rotation={[0, s * 0.2, 0]}>
					<mesh geometry={G.redonda(0.094, 0.064, 0.016, 0.022, 3)} material={negro} castShadow />
					{/* barra gruesa de arriba */}
					<mesh geometry={G.redonda(0.104, 0.024, 0.024, 0.01, 2)} material={marco} position={[0, 0.03, 0.002]} castShadow />
					{/* reflejo diagonal */}
					<mesh geometry={G.plano()} material={brillo} position={[-0.012, -0.002, 0.0085]} rotation={[0, 0, 0.75]} scale={[0.012, 0.07, 1]} />
				</group>
			))}
			<B p={[0, 0.018, 0.004]} s={[0.034, 0.014, 0.014]} m={marco} sombra={false} />
			{patillas
				? [-1, 1].map((s) => <Palo key={s} a={[s * 0.106, 0.026, -0.006]} b={[s * 0.178, 0.022, -0.17]} r={0.008} m={marco} seg={6} />)
				: null}
		</group>
	);
};

const VASO_H = 0.13;
const VASO_R = 0.045;
const VASO_RB = 0.037;

/** Vaso de vidrio (≈0.09 de diámetro, 0.13 de alto, base en y = 0) con agua hasta `nivel` (0..1). */
export const VasoConAgua: React.FC<PropManoProps & {nivel?: number}> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1, nivel = 0.7}) => {
	const vidrio = useMemo(
		() => new THREE.MeshStandardMaterial({color: '#e8f6ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false}),
		[],
	);
	const agua = useMemo(() => new THREE.MeshStandardMaterial({color: '#4fa9ea', roughness: 0.1, transparent: true, opacity: 0.62, depthWrite: false, emissive: new THREE.Color('#1d6fb8'), emissiveIntensity: 0.15}), []);
	const superficie = useMemo(() => new THREE.MeshStandardMaterial({color: '#bfe6ff', roughness: 0.05, transparent: true, opacity: 0.75, depthWrite: false}), []);
	useEffect(
		() => () => {
			vidrio.dispose();
			agua.dispose();
			superficie.dispose();
		},
		[vidrio, agua, superficie],
	);
	const n = clamp01(nivel);
	const fondo = 0.012;
	const hAgua = (VASO_H - fondo - 0.008) * n;
	const rAgua = lerp(VASO_RB, VASO_R, n) - 0.004;
	const pared = geo('vasoPared', () => new THREE.CylinderGeometry(VASO_R, VASO_RB, VASO_H, 24, 1, true));
	return (
		<group position={position} rotation={rotation} scale={escala}>
			<mesh geometry={pared} material={vidrio} position={[0, VASO_H / 2, 0]} renderOrder={3} />
			<mesh geometry={G.cil(24)} material={vidrio} position={[0, fondo / 2, 0]} scale={[VASO_RB * 2, fondo, VASO_RB * 2]} renderOrder={3} />
			<mesh geometry={G.toro(VASO_R, 0.0025, Math.PI * 2, 4, 24)} material={vidrio} position={[0, VASO_H, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={3} />
			{n > 0.01 ? (
				<>
					<mesh geometry={geo('vasoAgua', () => new THREE.CylinderGeometry(1, VASO_RB / VASO_R, 1, 24))} material={agua} position={[0, fondo + hAgua / 2, 0]} scale={[rAgua, hAgua, rAgua]} renderOrder={2} />
					<mesh geometry={G.disco(24)} material={superficie} position={[0, fondo + hAgua + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[rAgua * 2, rAgua * 2, 1]} renderOrder={2} />
				</>
			) : null}
		</group>
	);
};

/** Pan francés peruano (≈0.18 × 0.12, base en y = 0): bollo dorado con la cresta del corte a lo largo de X. */
export const PanFrances: React.FC<PropManoProps> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1}) => {
	const corteza = mat('#c47f3a', {r: 0.72});
	const tostado = mat('#a8642a', {r: 0.75});
	const cresta = mat('#e7bb73', {r: 0.85});
	return (
		<group position={position} rotation={rotation} scale={escala}>
			<Esf p={[0, 0.042, 0]} r={[0.09, 0.046, 0.062]} m={corteza} seg={20} />
			<Esf p={[0, 0.06, 0]} r={[0.075, 0.032, 0.05]} m={tostado} seg={16} sombra={false} />
			{/* cresta del corte, más clarita */}
			<Esf p={[0.004, 0.082, 0.004]} r={[0.07, 0.016, 0.02]} m={cresta} seg={14} sombra={false} />
			<Esf p={[0.004, 0.079, -0.014]} r={[0.062, 0.01, 0.01]} m={tostado} seg={10} sombra={false} />
			{/* puntas */}
			{[-1, 1].map((s) => (
				<Esf key={s} p={[s * 0.082, 0.036, 0]} r={[0.022, 0.026, 0.03]} m={tostado} seg={10} sombra={false} />
			))}
		</group>
	);
};

const texLibreta = () =>
	texFija('libretaMano', () =>
		lienzo(128, 160, (ctx) => {
			ctx.fillStyle = '#fbf6ea';
			ctx.fillRect(0, 0, 128, 160);
			ctx.strokeStyle = '#9cc0e0';
			ctx.lineWidth = 2;
			for (let y = 26; y < 160; y += 16) {
				ctx.beginPath();
				ctx.moveTo(6, y);
				ctx.lineTo(122, y);
				ctx.stroke();
			}
			ctx.strokeStyle = '#2b2b3a';
			ctx.lineWidth = 2.5;
			const r = rng(11);
			for (let i = 0; i < 6; i++) {
				const y = 22 + i * 16;
				ctx.beginPath();
				ctx.moveTo(12, y);
				const fin = 40 + r() * 70;
				for (let x = 12; x < fin; x += 5) ctx.lineTo(x, y - 3 + r() * 6);
				ctx.stroke();
			}
		}),
	);

/** Libretita de bolsillo en la mano (0.13 × 0.17); origen en su centro, hoja hacia +Y. */
const LibretaMano: React.FC<{p: V3; rot: V3}> = ({p, rot}) => (
	<group position={p} rotation={rot}>
		<mesh geometry={G.redonda(0.135, 0.01, 0.175, 0.004)} material={mat('#5b3a29', {r: 0.7})} castShadow />
		<B p={[0, 0.009, 0]} s={[0.124, 0.008, 0.164]} c="#f3eee2" sombra={false} />
		<mesh geometry={G.plano()} material={matMapa('libretaMano', texLibreta, {r: 0.9})} position={[0, 0.0135, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.124, 0.164, 1]} />
		{/* espiral arriba */}
		{[-0.045, -0.015, 0.015, 0.045].map((x) => (
			<mesh key={x} geometry={G.toro(0.009, 0.002, Math.PI * 2, 4, 10)} material={mat('#9aa0a6', {r: 0.3, m: 0.7})} position={[x, 0.006, -0.087]} rotation={[0, Math.PI / 2, 0]} />
		))}
	</group>
);

/** Lápiz entre dos puntos (punta en `a`). */
const LapizMano: React.FC<{a: THREE.Vector3; b: THREE.Vector3}> = ({a, b}) => {
	const d = b.clone().sub(a);
	const largo = d.length();
	const q = new THREE.Quaternion().setFromUnitVectors(ARRIBA, d.clone().normalize());
	return (
		<group position={[a.x, a.y, a.z]} quaternion={[q.x, q.y, q.z, q.w]}>
			<mesh geometry={G.cono(0, 8)} material={mat('#2b2b2b', {r: 0.5})} position={[0, 0.006, 0]} scale={[0.006, 0.012, 0.006]} />
			<mesh geometry={G.cono(0.35, 8)} material={mat('#e8c9a0', {r: 0.8})} position={[0, 0.022, 0]} rotation={[Math.PI, 0, 0]} scale={[0.018, 0.024, 0.018]} />
			<mesh geometry={G.cil(6)} material={mat(MARCA.miel, {r: 0.55})} position={[0, 0.034 + (largo - 0.05) / 2, 0]} scale={[0.018, largo - 0.05, 0.018]} castShadow />
			<mesh geometry={G.cil(10)} material={mat('#b8bcc2', {r: 0.3, m: 0.7})} position={[0, largo - 0.01, 0]} scale={[0.019, 0.014, 0.019]} />
			<mesh geometry={G.cil(10)} material={mat('#e58a9a', {r: 0.8})} position={[0, largo + 0.006, 0]} scale={[0.018, 0.018, 0.018]} />
		</group>
	);
};

// ---------- cinemática del brazo (dos segmentos) ----------
const L_BRAZO = 0.27;
const L_ANTEBRAZO = 0.28;
type PoseBrazo = {q: THREE.Quaternion; codo: number};
const ATRAS = new THREE.Vector3(0, 0, -1);

/** Posición de la mano (marco del cuerpo) con el brazo en `q` y el codo doblado `codo`. */
const fkMano = (hombro: THREE.Vector3, q: THREE.Quaternion, codo: number) =>
	new THREE.Vector3(0, -L_BRAZO - L_ANTEBRAZO * Math.cos(codo), -L_ANTEBRAZO * Math.sin(codo)).applyQuaternion(q).add(hombro);

/** IK analítica de dos segmentos: la mano llega a `objetivo` y el codo apunta hacia `polo`. */
const ikBrazo = (hombro: THREE.Vector3, objetivo: THREE.Vector3, polo: THREE.Vector3): PoseBrazo => {
	const t = objetivo.clone().sub(hombro);
	const d = THREE.MathUtils.clamp(t.length(), 0.06, L_BRAZO + L_ANTEBRAZO - 0.002);
	const tn = t.lengthSq() > 1e-10 ? t.normalize() : new THREE.Vector3(0, -1, 0);
	const cosC = THREE.MathUtils.clamp((d * d - L_BRAZO * L_BRAZO - L_ANTEBRAZO * L_ANTEBRAZO) / (2 * L_BRAZO * L_ANTEBRAZO), -1, 1);
	const codo = -Math.acos(cosC);
	const local = new THREE.Vector3(0, -L_BRAZO - L_ANTEBRAZO * Math.cos(codo), -L_ANTEBRAZO * Math.sin(codo)).normalize();
	const q = new THREE.Quaternion().setFromUnitVectors(local, tn);
	const a = new THREE.Vector3(0, -1, 0).applyQuaternion(q);
	a.addScaledVector(tn, -a.dot(tn));
	const b = polo.clone().addScaledVector(tn, -polo.dot(tn));
	if (a.lengthSq() > 1e-8 && b.lengthSq() > 1e-8) {
		a.normalize();
		b.normalize();
		const ang = Math.atan2(tn.dot(a.clone().cross(b)), a.dot(b));
		q.premultiply(new THREE.Quaternion().setFromAxisAngle(tn, ang));
	}
	return {q, codo};
};

/** Punto del cuerpo (marco de hombros) de algo pegado a la cabeza en `local` (relativo al centro de la cabeza). */
const enCabeza = (local: V3, rot: THREE.Euler) => new THREE.Vector3(local[0], local[1] + 0.14, local[2]).applyEuler(rot).add(new THREE.Vector3(0, 1.42, 0));

/**
 * Mascota de Alcanza en el estilo de bloques de `Persona` (≈1.85 de alto con el pompón, mira a +Z):
 * gorro rojo con pompón, camisa crema con cuello y jeans. Hombros a y ≈ 1.36, cara a y ≈ 1.56.
 * Sentado: la cadera queda a y ≈ 0.53 y las rodillas ~0.42 hacia +Z; coloca el origen sobre el
 * asiento (p. ej. en el centro del sillón) a la altura del piso. Sentado, la cara queda a y ≈ 1.25.
 * Extras de detective: `lentes`, `manosCabeza`, `anotando`, `vaso`, `pan` y los ánimos 'panico' y 'serio'.
 */
export const Protagonista: React.FC<ProtagonistaProps> = ({
	position = [0, 0, 0],
	rotationY = 0,
	escala = 1,
	caminando = false,
	celebra = 0,
	animo = 'normal',
	conCelular = 0,
	pantalla = 'S/ 12.40',
	sentado = false,
	pantallaAlFrente = false,
	fase = 0,
	lentes = 0,
	manosCabeza = 0,
	anotando = 0,
	vaso = 0,
	pan = false,
}) => {
	const frame = useCurrentFrame();
	const camina = caminando && !sentado;
	const ph = camina ? (frame / 30) * Math.PI * 2 * 1.7 + fase : 0;
	const paso = camina ? Math.sin(ph) : 0;
	const respira = Math.sin(frame * 0.08 + fase) * 0.006;
	const rebote = camina ? Math.abs(Math.cos(ph)) * 0.04 : respira;
	const ce = suave(celebra);
	const conf = animo === 'confundido' ? 1 : 0;
	const feliz = animo === 'feliz';
	const panico = animo === 'panico';
	const serio = animo === 'serio';
	const brinco = sentado ? 0 : ce * Math.max(0, Math.sin(frame * 0.35)) * 0.06;
	const bajada = sentado ? -0.31 : 0;

	// pesos de las acciones nuevas
	const mc = suave(manosCabeza);
	const an = suave(anotando);
	const lz = clamp01(lentes);
	const vs = clamp01(vaso);
	const vsIn = vs > 0 ? suave(vs / 0.15) : 0; // aparece el vaso y la mano lo agarra
	const vsSube = suave(vs); // 0 = abajo, 1 = en la boca
	const vsToma = suave((vs - 0.55) / 0.45);
	const panW = pan ? 1 : 0;
	// lentes: hasta 0.8 viajan en la mano; de 0.8 a 1 ya están en la cara y la mano baja
	const LENTES_CARA = 0.8;
	const lentesEnCara = lz >= LENTES_CARA;
	const lentesMano = lz <= 0 || lz >= 1 ? 0 : lz < LENTES_CARA ? suave(lz / 0.15) : 1 - suave((lz - LENTES_CARA) / (1 - LENTES_CARA));
	// el celular se guarda si la mano derecha se ocupa en otra cosa
	const ocupadaDer = Math.max(mc, an, vsIn);
	const cel = suave(conCelular) * (1 - ocupadaDer);

	const piel = mat('#c98a5e', {r: 0.65});
	const camisa = mat('#f3e8d2', {r: 0.85});
	const mezclilla = mat('#3c5f9c', {r: 0.9});
	const zapato = mat('#2b2522', {r: 0.6});
	const rojo = mat(MARCA.rojo, {r: 0.8});
	const rojoOscuro = mat('#b63823', {r: 0.85});
	const ojo = mat('#1a1414', {r: 0.3});
	const cejaM = mat('#2a1d16', {r: 0.8});
	const labio = mat('#5a2620', {r: 0.5});

	// ---------- cabeza (rotación, se usa también para los lentes en la mano) ----------
	const inclinacion = conf * 0.24;
	const tiembla = panico ? Math.sin(frame * 2.1) * 0.012 : 0;
	const miraAbajo = cel * 0.12 + an * 0.2 - vsToma * 0.16 + tiembla;
	const rotCabeza = new THREE.Euler(miraAbajo, 0, inclinacion + (panico ? Math.sin(frame * 1.7) * 0.01 : 0));
	const LENTES_LOCAL: V3 = [0, 0.017, 0.172];

	// ---------- objetivos de las manos (marco de hombros: hombros a y = 1.36) ----------
	const libreta = new THREE.Vector3(0.0, 1.13, 0.3);
	const cicloLapiz = frame % 30;
	const lapizX = (cicloLapiz / 30 - 0.5) * 0.05 + Math.sin(frame * 1.6) * 0.004;
	const lapizZ = 0.012 - (Math.floor((frame % 90) / 30) * 0.014);
	const lapizY = cicloLapiz > 26 ? 0.018 : 0;
	const manoLapiz = libreta.clone().add(new THREE.Vector3(-0.03 + lapizX, 0.085 + lapizY, lapizZ - 0.01));
	const manoLibreta = libreta.clone().add(new THREE.Vector3(0.088, -0.025, -0.01));
	// vaso: abajo (al costado) → pecho → boca
	const vasoAbajo = new THREE.Vector3(-0.27, sentado ? 1.04 : 0.98, 0.2);
	const vasoPecho = new THREE.Vector3(-0.14, 1.16, 0.3);
	const vasoBoca = new THREE.Vector3(-0.03, 1.38, 0.29);
	const vasoBase = vsSube < 0.5 ? vasoAbajo.clone().lerp(vasoPecho, vsSube * 2) : vasoPecho.clone().lerp(vasoBoca, (vsSube - 0.5) * 2);
	const vasoTilt = -0.75 * vsToma;
	const manoVaso = vasoBase.clone().add(new THREE.Vector3(-0.06, 0.05, -0.005));
	// lentes en la mano: de abajo (pecho) a la cara
	const lentesCara = enCabeza(LENTES_LOCAL, rotCabeza);
	const lentesAbajo = new THREE.Vector3(-0.1, 1.02, 0.32);
	const lentesPos = lentesEnCara ? lentesCara : lentesAbajo.clone().lerp(lentesCara, suave(lz / LENTES_CARA));
	const manoLentes = lentesPos.clone().add(new THREE.Vector3(-0.172, -0.01, -0.02));
	const manoPan = new THREE.Vector3(0.27, sentado ? 1.06 : 1.02, 0.22);

	type Objetivo = [number, THREE.Vector3, THREE.Vector3];
	const objetivos = (lado: number): Objetivo[] =>
		lado < 0
			? [
					[an, manoLapiz, new THREE.Vector3(-0.7, -1, -0.1)],
					[vsIn, manoVaso, new THREE.Vector3(-0.8, -1, -0.2)],
					[mc, new THREE.Vector3(-0.205, 1.585, 0.01), new THREE.Vector3(-1, 0.1, 0.35)],
					[lentesMano, manoLentes, new THREE.Vector3(-0.8, -1, -0.1)],
				]
			: [
					[panW, manoPan, new THREE.Vector3(0.8, -1, -0.3)],
					[an, manoLibreta, new THREE.Vector3(0.8, -1, -0.1)],
					[mc, new THREE.Vector3(0.205, 1.585, 0.01), new THREE.Vector3(1, 0.1, 0.35)],
				];

	// ---------- piernas ----------
	const pierna = (lado: number) => {
		const muslo = sentado ? -Math.PI / 2 + 0.05 : lado * paso * 0.5;
		const rodilla = sentado ? Math.PI / 2 - 0.12 : camina ? Math.max(0, Math.sin(ph * 1 + (lado > 0 ? 0 : Math.PI) + 1.2)) * 0.55 : 0;
		return (
			<group key={`p${lado}`} position={[lado * 0.115, 0.84, 0]} rotation={[muslo, 0, sentado ? lado * 0.04 : 0]}>
				<mesh geometry={G.redonda(0.19, 0.44, 0.22, 0.06)} material={mezclilla} position={[0, -0.2, 0]} castShadow receiveShadow />
				<group position={[0, -0.42, 0]} rotation={[rodilla, 0, 0]}>
					<mesh geometry={G.redonda(0.18, 0.38, 0.2, 0.06)} material={mezclilla} position={[0, -0.17, 0]} castShadow receiveShadow />
					<mesh geometry={G.redonda(0.2, 0.1, 0.32, 0.04)} material={zapato} position={[0, -0.37, 0.045]} castShadow />
					<B p={[0, -0.415, 0.045]} s={[0.205, 0.015, 0.325]} c="#efe7da" sombra={false} />
				</group>
			</group>
		);
	};

	// ---------- brazos (dos segmentos) ----------
	// pose base
	const baseX = sentado ? -0.45 : 0;
	const baseCodo = sentado ? -0.85 : camina ? -0.25 : -0.12;
	const arm = (lado: number) => {
		// lado -1 = derecho (en -X), lado +1 = izquierdo
		const swing = (lado < 0 ? paso : -paso) * 0.55;
		let ux = baseX + swing;
		let uz = lado * 0.06;
		let codo = baseCodo;
		// encogerse de hombros (confundido)
		ux = lerp(ux, -0.25, conf);
		uz = lerp(uz, lado * 0.55, conf);
		codo = lerp(codo, -1.35, conf);
		// celular (solo mano derecha)
		if (lado < 0) {
			ux = lerp(ux, pantallaAlFrente ? -1.15 : -0.75, cel);
			uz = lerp(uz, pantallaAlFrente ? 0.2 : 0.3, cel);
			codo = lerp(codo, pantallaAlFrente ? -0.75 : -1.75, cel);
		}
		// celebrar
		const celebraZ = 2.6 + Math.sin(frame * 0.35) * 0.12;
		const ceA = lado < 0 ? ce * (1 - cel) : ce;
		ux = lerp(ux, 0, ceA);
		uz = lerp(uz, lado * celebraZ, ceA);
		codo = lerp(codo, -0.15, ceA);
		const hombro = new THREE.Vector3(lado * 0.31, 1.36 + conf * 0.045, 0);
		// acciones con objetivo: se mezclan sobre la pose base y se resuelven con IK
		let pose: PoseBrazo = {q: new THREE.Quaternion().setFromEuler(new THREE.Euler(ux, 0, uz)), codo};
		const lista = objetivos(lado).filter(([w]) => w > 1e-4);
		if (lista.length) {
			const T = fkMano(hombro, pose.q, codo);
			const P = ATRAS.clone().applyQuaternion(pose.q);
			for (const [w, obj, polo] of lista) {
				T.lerp(obj, w);
				P.lerp(polo.clone().normalize(), w);
			}
			pose = ikBrazo(hombro, T, P);
		}
		let telefono: React.ReactNode = null;
		if (lado < 0 && cel > 0.01) {
			const qCodo = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.codo, 0, 0));
			const q = pose.q.clone().multiply(qCodo).invert();
			const s = 0.75 * (0.3 + 0.7 * cel);
			telefono = (
				<group position={[0, -0.3, 0]} quaternion={[q.x, q.y, q.z, q.w]}>
					{/* marco del cuerpo: el celular queda frente a la cara con la pantalla hacia ella */}
					<group position={pantallaAlFrente ? [0.02, -0.04 * s, 0.075] : [0.05, -0.2 * s, 0.03]} rotation={pantallaAlFrente ? [-0.15, 0.15, 0] : [0.12, Math.PI + 0.3, 0]}>
						<Celular position={[0, 0, 0]} escala={s} pantalla={pantalla} brillo={cel} />
					</group>
					{/* luz de la pantalla sobre la cara */}
					<pointLight position={pantallaAlFrente ? [0.02, 0.15, -0.1] : [0.04, 0.08, -0.05]} color="#cfe9ff" intensity={(pantallaAlFrente ? 0.6 : 1.6) * cel} distance={1.2} decay={2} />
				</group>
			);
		}
		return (
			<group key={`b${lado}`} position={hombro} quaternion={pose.q}>
				<mesh geometry={G.redonda(0.15, 0.2, 0.17, 0.06)} material={camisa} position={[0, -0.07, 0]} castShadow />
				<mesh geometry={G.redonda(0.115, 0.16, 0.12, 0.05)} material={piel} position={[0, -0.2, 0]} castShadow />
				<group position={[0, -L_BRAZO, 0]} rotation={[pose.codo, 0, 0]}>
					<Esf p={[0, 0, 0]} r={0.058} m={piel} seg={12} />
					<mesh geometry={G.redonda(0.11, 0.26, 0.115, 0.05)} material={piel} position={[0, -0.12, 0]} castShadow />
					<Esf p={[0, -L_ANTEBRAZO, 0]} r={0.062} m={piel} seg={14} />
					{telefono}
				</group>
			</group>
		);
	};

	// ---------- cara ----------
	const zq = Math.sin(frame * 0.12 + fase);
	const ojosFelices = !panico && !serio && (feliz || ce > 0.5);
	const boca = (() => {
		if (panico)
			return (
				<group position={[0, -0.082, 0.147]} rotation={[-0.3, 0, 0]}>
					<mesh geometry={G.toro(0.024, 0.0085, Math.PI * 2, 6, 16)} material={labio} scale={[1, 1.3, 1]} />
					<mesh geometry={G.disco(16)} material={mat('#3a1512', {r: 0.7})} position={[0, 0, -0.002]} scale={[0.05, 0.065, 1]} />
				</group>
			);
		if (serio) return <mesh geometry={G.redonda(0.068, 0.012, 0.014, 0.005, 2)} material={labio} position={[0, -0.074, 0.146]} rotation={[-0.32, 0, 0]} />;
		if (conf) return <Esf p={[0.012, -0.075, 0.148]} r={[0.016, 0.013, 0.008]} m={labio} seg={10} sombra={false} />;
		if (ojosFelices)
			return (
				<group position={[0, -0.06, 0.14]}>
					<mesh geometry={G.toro(0.045, 0.011, Math.PI, 6, 14)} material={labio} rotation={[-0.25, 0, Math.PI]} />
					<mesh geometry={G.disco(16)} material={mat('#7a2f28', {r: 0.6})} position={[0, -0.012, 0.004]} rotation={[-0.25, 0, 0]} scale={[0.08, 0.05, 1]} />
				</group>
			);
		return <mesh geometry={G.toro(0.03, 0.008, Math.PI, 6, 12)} material={labio} position={[0, -0.06, 0.148]} rotation={[-0.25, 0, Math.PI]} />;
	})();
	const ojos = [-1, 1].map((s) => {
		if (panico)
			return (
				<group key={s}>
					<Esf p={[s * 0.064, 0.02, 0.143]} r={[0.032, 0.039, 0.016]} c="#ffffff" seg={14} o={{r: 0.35}} sombra={false} />
					<Esf p={[s * 0.062, 0.017, 0.158]} r={[0.0095, 0.0115, 0.005]} m={ojo} seg={10} sombra={false} />
				</group>
			);
		if (serio)
			return (
				<group key={s}>
					<Esf p={[s * 0.06, 0.006, 0.15]} r={[0.022, 0.012, 0.011]} m={ojo} seg={12} sombra={false} />
					{/* párpado a media asta */}
					<mesh geometry={G.redonda(0.054, 0.011, 0.014, 0.005, 2)} material={cejaM} position={[s * 0.06, 0.02, 0.153]} rotation={[-0.15, 0, 0]} />
				</group>
			);
		return ojosFelices ? (
			<mesh key={s} geometry={G.toro(0.02, 0.0075, Math.PI, 6, 10)} material={ojo} position={[s * 0.06, 0.012, 0.152]} rotation={[-0.15, 0, 0]} />
		) : (
			<group key={s}>
				<Esf p={[s * 0.06, 0.015, 0.15]} r={[0.02, 0.027, 0.012]} m={ojo} seg={12} sombra={false} />
				<Esf p={[s * 0.06 + 0.006, 0.026, 0.16]} r={0.006} c="#ffffff" seg={6} sombra={false} />
			</group>
		);
	});
	const cejas = [-1, 1].map((s) => {
		if (panico) return <B key={s} p={[s * 0.064, 0.085, 0.14]} s={[0.055, 0.013, 0.013]} rot={[-0.35, 0, -s * 0.32]} m={cejaM} sombra={false} />;
		const alza = conf ? (s > 0 ? 0.03 : -0.004) : feliz ? 0.012 : 0;
		const giro = conf ? (s > 0 ? -0.35 : 0.25) : serio ? 0 : s * -0.1;
		return <B key={s} p={[s * 0.062, 0.07 + alza, 0.145]} s={[0.055, 0.012, 0.012]} rot={[-0.3, 0, giro]} m={cejaM} sombra={false} />;
	});
	// gotas de sudor (pánico)
	const gotas = panico
		? (
				[
					[0.168, 0.05, 0.075, 0],
					[-0.15, 0.075, 0.1, 0.45],
				] as const
			).map(([x, y, z, k], i) => {
				const f = (frame * 0.022 + k) % 1;
				const e = 1 - f * f * f * f;
				return (
					<group key={i} position={[x, y - f * 0.07, z]} scale={0.9 + 0.2 * e}>
						<Esf p={[0, 0, 0]} r={0.016 * e} c="#8fd3ff" o={{r: 0.1, e: '#5fb8ff', ei: 0.3}} seg={12} sombra={false} />
						<mesh geometry={G.cono(0, 12)} material={mat('#8fd3ff', {r: 0.1, e: '#5fb8ff', ei: 0.3})} position={[0, 0.018 * e, 0]} scale={[0.031 * e, 0.03 * e, 0.031 * e]} />
					</group>
				);
			})
		: null;
	const gorroSalta = panico ? 0.05 + Math.abs(Math.sin(frame * 0.55)) * 0.018 : 0;

	// ---------- lo que va en las manos (marco de hombros) ----------
	const enManos: React.ReactNode[] = [];
	if (an > 0.01) {
		const sA = 0.4 + 0.6 * an;
		enManos.push(
			<group key="libreta" scale={sA} position={[libreta.x * (1 - sA), libreta.y * (1 - sA), libreta.z * (1 - sA)]}>
				<LibretaMano p={[libreta.x, libreta.y, libreta.z]} rot={[0.25, 0, 0.06]} />
				<LapizMano a={manoLapiz.clone().add(new THREE.Vector3(0.012, -0.075, 0.032))} b={manoLapiz.clone().add(new THREE.Vector3(-0.035, 0.05, -0.03))} />
			</group>,
		);
	}
	if (vsIn > 0.01) {
		enManos.push(<VasoConAgua key="vaso" position={[vasoBase.x, vasoBase.y - 0.02, vasoBase.z]} rotation={[vasoTilt, 0, vasoTilt * 0.2]} escala={vsIn} nivel={0.75 - 0.35 * vsToma} />);
	}
	if (pan) enManos.push(<PanFrances key="pan" position={[manoPan.x - 0.01, manoPan.y + 0.035, manoPan.z + 0.035]} rotation={[0.15, 0.5, 0.1]} />);
	if (lz > 0.001 && !lentesEnCara) {
		enManos.push(<LentesOscuros key="lentes" position={[lentesPos.x, lentesPos.y, lentesPos.z]} rotation={[rotCabeza.x, rotCabeza.y, rotCabeza.z]} escala={suave(lz / 0.12)} />);
	}

	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<group position={[0, rebote + brinco + bajada, 0]}>
				{pierna(1)}
				{pierna(-1)}
				{/* cadera y cinturón */}
				<mesh geometry={G.redonda(0.46, 0.16, 0.26, 0.05)} material={mezclilla} position={[0, 0.86, 0]} castShadow />
				<B p={[0, 0.95, 0]} s={[0.47, 0.04, 0.27]} c="#4a3426" />
				<B p={[0, 0.95, 0.137]} s={[0.06, 0.035, 0.01]} c={MARCA.miel} o={{m: 0.5, r: 0.4}} sombra={false} />
				{/* torso: camisa crema con botones */}
				<group rotation={[camina ? 0.05 : sentado ? -0.04 : 0, 0, 0]}>
					<mesh geometry={G.redonda(0.5, 0.48, 0.28, 0.08)} material={camisa} position={[0, 1.18, 0]} castShadow receiveShadow />
					{[1.1, 1.2].map((y) => (
						<Esf key={y} p={[0, y, 0.141]} r={[0.012, 0.012, 0.005]} c="#c9b48d" seg={8} sombra={false} />
					))}
					<B p={[0.13, 1.25, 0.141]} s={[0.1, 0.08, 0.006]} c="#e7d9bd" sombra={false} />
				</group>
				{/* cuello con cuello de camisa (sin bufanda) */}
				<Cil p={[0, 1.37, 0]} r={0.062} h={0.09} m={piel} seg={14} />
				<mesh geometry={G.toro(0.085, 0.022, Math.PI * 2, 8, 22)} material={camisa} position={[0, 1.415, -0.005]} rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 1.05, 1]} castShadow />
				{[-1, 1].map((l) => (
					<mesh
						key={l}
						geometry={G.redonda(0.1, 0.075, 0.016, 0.006)}
						material={camisa}
						position={[l * 0.05, 1.395, 0.105]}
						rotation={[-0.35, l * 0.35, l * 0.55]}
						castShadow
					/>
				))}
				<Esf p={[0, 1.37, 0.142]} r={[0.012, 0.012, 0.005]} c="#c9b48d" seg={8} sombra={false} />
				{/* cabeza (pivote en el cuello) */}
				<group position={[0, 1.42, 0]} rotation={rotCabeza}>
					<group position={[0, 0.14, 0]}>
						<Esf p={[0, 0, 0]} r={[0.165, 0.172, 0.16]} m={piel} seg={28} />
						{ojos}
						{cejas}
						<Esf p={[0, -0.03, 0.163]} r={[0.022, 0.026, 0.022]} m={piel} seg={10} />
						{boca}
						{/* cachetes */}
						{[-1, 1].map((s) => (
							<Esf key={s} p={[s * 0.1, -0.035, 0.125]} r={[0.03, 0.02, 0.012]} c="#e58a73" seg={10} sombra={false} />
						))}
						<Esf p={[-0.165, -0.01, 0]} r={[0.025, 0.04, 0.03]} m={piel} seg={8} />
						<Esf p={[0.165, -0.01, 0]} r={[0.025, 0.04, 0.03]} m={piel} seg={8} />
						{gotas}
						{lentesEnCara ? <LentesOscuros position={[LENTES_LOCAL[0], LENTES_LOCAL[1], LENTES_LOCAL[2]]} /> : null}
						{/* pelo bajo el gorro */}
						<Esf p={[0, 0.03, -0.03]} r={[0.17, 0.15, 0.165]} c="#2a1d16" seg={20} />
						{/* gorro rojo con doblez y pompón */}
						<group position={[0, 0.05 + gorroSalta, -0.008]} rotation={[-0.12 - gorroSalta * 1.5, 0, 0]}>
							<mesh scale={[0.18, 0.17, 0.178]} castShadow material={rojo}>
								<sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
							</mesh>
							<mesh geometry={G.toro(0.175, 0.035, Math.PI * 2, 10, 28)} material={rojoOscuro} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[1.02, 1, 1]} castShadow />
							{[-0.09, -0.03, 0.03, 0.09].map((x) => (
								<B key={x} p={[x, 0.01, Math.sqrt(0.205 * 0.205 - x * x) - 0.0]} s={[0.012, 0.06, 0.01]} m={rojo} rot={[0, Math.asin(x / 0.205), 0]} sombra={false} />
							))}
							<Esf p={[0, 0.2, 0]} r={0.06} c="#f6efe2" seg={14} o={{r: 1}} />
						</group>
					</group>
				</group>
				{arm(-1)}
				{arm(1)}
				{enManos}
			</group>
			{/* "?" flotante */}
			{conf ? (
				<sprite position={[0.12 + Math.sin(frame * 0.07) * 0.02, 2.2 + bajada + zq * 0.03, 0.05]} scale={[0.34, 0.34, 1]}>
					<spriteMaterial map={texInterrogacion()} transparent depthWrite={false} rotation={0.18 + Math.sin(frame * 0.09) * 0.12} />
				</sprite>
			) : null}
		</group>
	);
};

// ============================================================
// Moneda de sol (para las hormigas) y billetito
// ============================================================
const texMonedaSol = () =>
	texFija('monedaSol', () =>
		lienzo(256, 256, (ctx) => {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, 256, 256);
			ctx.beginPath();
			ctx.arc(128, 128, 104, 0, Math.PI * 2);
			ctx.lineWidth = 10;
			ctx.strokeStyle = '#d9c38f';
			ctx.stroke();
			ctx.font = `900 120px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#a8864a';
			ctx.fillText('S/', 134, 140);
			ctx.fillStyle = '#fff6da';
			ctx.fillText('S/', 126, 132);
		}),
	);

const MonedaSol: React.FC<{radio?: number}> = ({radio = 0.075}) => {
	const canto = mat('#f2b821', {r: 0.32, m: 0.35});
	const cara = useMemo(() => matMapa('monedaSol', texMonedaSol, {r: 0.35}), []);
	(cara as THREE.MeshStandardMaterial).color.set('#f6c32a');
	(cara as THREE.MeshStandardMaterial).metalness = 0.25;
	const gro = radio * 0.22;
	return (
		<group rotation={[Math.PI / 2, 0, 0]}>
			<mesh geometry={G.cil(28)} material={canto} scale={[radio * 2, gro, radio * 2]} castShadow />
			{[-1, 1].map((l) => (
				<mesh key={l} geometry={G.disco(28)} material={cara} position={[0, (l * gro) / 2 + l * 0.0005, 0]} rotation={[-l * Math.PI / 2, 0, l < 0 ? Math.PI : 0]} scale={radio * 1.82} />
			))}
		</group>
	);
};

const texBillete = () =>
	texFija('billete', () =>
		lienzo(256, 128, (ctx) => {
			ctx.fillStyle = '#7fc48a';
			ctx.fillRect(0, 0, 256, 128);
			ctx.strokeStyle = '#3f8a52';
			ctx.lineWidth = 8;
			ctx.strokeRect(10, 10, 236, 108);
			ctx.fillStyle = '#d7efd5';
			ctx.beginPath();
			ctx.ellipse(128, 64, 38, 38, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.font = `900 40px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#2f6e3f';
			ctx.fillText('S/', 128, 66);
			ctx.font = `800 26px ${FUENTE}`;
			ctx.fillText('10', 40, 38);
			ctx.fillText('10', 216, 92);
		}),
	);

/** Billete plano en XY (cara hacia +Z), centrado. */
const BilletePlano: React.FC<{w: number; h: number; p?: V3; rot?: V3}> = ({w, h, p = [0, 0, 0], rot}) => (
	<group position={p} rotation={rot}>
		<mesh geometry={G.caja()} material={mat('#5fae6d', {r: 0.9})} scale={[w, h, 0.004]} castShadow receiveShadow />
		<mesh geometry={G.plano()} material={matMapa('billete', texBillete, {r: 0.9})} position={[0, 0, 0.0025]} scale={[w * 0.99, h * 0.99, 1]} />
		<mesh geometry={G.plano()} material={matMapa('billete', texBillete, {r: 0.9})} position={[0, 0, -0.0025]} rotation={[0, Math.PI, 0]} scale={[w * 0.99, h * 0.99, 1]} />
	</group>
);

// ============================================================
// Hormiga y fila de hormigas
// ============================================================
export type CargaHormiga = 'moneda' | 'billete' | 'nada';
export type HormigaProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	/** Desfase del ciclo de caminar (radianes). */
	fase?: number;
	carga?: CargaHormiga;
	/** Si camina (patas animadas). Por defecto true. */
	caminando?: boolean;
};

// patas: [lado, índice] → z de enganche en el tórax
const PATAS: {lado: number; i: number; z: number; abre: number; grupo: number}[] = [-1, 1].flatMap((lado) =>
	[0, 1, 2].map((i) => ({lado, i, z: 0.032 - i * 0.022, abre: [-0.65, 0, 0.65][i], grupo: (i + (lado > 0 ? 0 : 1)) % 2})),
);

/**
 * Hormiga caricatura (≈0.25 de largo en Z, mira a +Z): cabeza con ojos grandes, tórax, abdomen,
 * 6 patas con paso en trípode y antenas. Lleva una moneda de sol de pie sobre el lomo (radio 0.075,
 * cara hacia ±X para que se lea de lado), un billetito doblado o nada. Alto con moneda ≈ 0.29.
 */
export const Hormiga: React.FC<HormigaProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, fase = 0, carga = 'moneda', caminando = true}) => {
	const frame = useCurrentFrame();
	const ph = caminando ? (frame / 30) * Math.PI * 2 * 2.6 + fase : 0;
	const cuerpo = mat('#3a2318', {r: 0.38});
	const cuerpoClaro = mat('#5a3624', {r: 0.42});
	const pata = mat('#2a1810', {r: 0.5});
	const rebote = caminando ? Math.abs(Math.sin(ph)) * 0.006 : 0;
	const meneo = caminando ? Math.sin(ph) * 0.05 : 0;
	const antena = Math.sin(frame * 0.25 + fase) * 0.012;
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<group position={[0, rebote, 0]}>
				<group position={[0, -0.022, 0]}>
				{/* abdomen */}
				<group position={[0, 0.078, -0.07]} rotation={[0.25, meneo * 0.5, 0]}>
					<Esf p={[0, 0, 0]} r={[0.052, 0.048, 0.072]} m={cuerpo} seg={18} />
					<Esf p={[0, 0.022, -0.012]} r={[0.03, 0.02, 0.04]} m={cuerpoClaro} seg={12} sombra={false} />
				</group>
				{/* pecíolo y tórax */}
				<Esf p={[0, 0.072, -0.012]} r={0.014} m={cuerpo} seg={10} />
				<Esf p={[0, 0.075, 0.025]} r={[0.026, 0.025, 0.038]} m={cuerpo} seg={14} />
				{/* cabeza */}
				<group position={[0, 0.09, 0.083]} rotation={[0, meneo, 0]}>
					<Esf p={[0, 0, 0]} r={[0.042, 0.039, 0.038]} m={cuerpo} seg={18} />
					{[-1, 1].map((s) => (
						<group key={s}>
							<Esf p={[s * 0.021, 0.008, 0.026]} r={0.016} c="#ffffff" seg={12} o={{r: 0.3}} sombra={false} />
							<Esf p={[s * 0.022, 0.009, 0.039]} r={0.009} c="#111111" seg={10} o={{r: 0.2}} sombra={false} />
							<Esf p={[s * 0.019, 0.013, 0.046]} r={0.0028} c="#ffffff" seg={6} sombra={false} />
							{/* antenas: dos tramos con bolita */}
							<Palo a={[s * 0.014, 0.03, 0.015]} b={[s * 0.03, 0.075 + antena * s, 0.03]} r={0.0035} m={pata} />
							<Palo a={[s * 0.03, 0.075 + antena * s, 0.03]} b={[s * 0.055, 0.085 - antena * s, 0.075]} r={0.003} m={pata} />
							<Esf p={[s * 0.055, 0.085 - antena * s, 0.075]} r={0.0075} m={cuerpoClaro} seg={8} />
							{/* mandíbulas */}
							<Esf p={[s * 0.012, -0.024, 0.03]} r={[0.008, 0.006, 0.01]} m={cuerpoClaro} seg={8} sombra={false} />
						</group>
					))}
				</group>
				</group>
				{/* patas */}
				{PATAS.map(({lado, i, z, abre, grupo}) => {
					const fasePata = ph + grupo * Math.PI;
					const swing = caminando ? Math.sin(fasePata) * 0.38 : 0;
					const alza = caminando ? Math.max(0, Math.cos(fasePata)) * 0.016 : 0;
					const yaw = lado > 0 ? abre + swing : Math.PI - abre - swing;
					return (
						<group key={`${lado}${i}`} position={[lado * 0.018, 0.05 + alza, z]} rotation={[0, yaw, 0]}>
							<Palo a={[0, 0, 0]} b={[0.034, 0.022, 0]} r={0.0068} m={pata} />
							<Esf p={[0.034, 0.022, 0]} r={0.0085} m={pata} seg={8} />
							<Palo a={[0.034, 0.022, 0]} b={[0.062, -0.047 - alza, 0]} r={0.006} m={pata} />
							<Esf p={[0.062, -0.047 - alza, 0]} r={0.0075} m={pata} seg={6} />
						</group>
					);
				})}
				{/* carga */}
				{carga === 'moneda' ? (
					<group position={[0, 0.106, -0.025]} rotation={[0.22, Math.PI / 2, 0.08 + meneo * 0.4]}>
						<group position={[0, 0.07, 0]}>
							<MonedaSol radio={0.078} />
						</group>
					</group>
				) : null}
				{carga === 'billete' ? (
					<group position={[0, 0.105, -0.03]} rotation={[0.12, 0, meneo * 0.4]}>
						<BilletePlano w={0.17} h={0.09} p={[0, 0.0, 0]} rot={[-Math.PI / 2 + 0.2, 0, 0]} />
						<BilletePlano w={0.17} h={0.09} p={[0, 0.02, -0.02]} rot={[-Math.PI / 2 + 0.45, 0, 0.08]} />
					</group>
				) : null}
			</group>
		</group>
	);
};

export type FilaHormigasProps = {
	desde: V3;
	hasta: V3;
	cantidad: number;
	/** 0..1: avance de la fila (0 = todas dentro de `desde`, 1 = todas entraron en `hasta`). */
	progreso: number;
	fase?: number;
	escala?: number;
	/** Cuánto se curva el camino (fracción del largo, signo = lado). Por defecto 0.18. */
	curva?: number;
	/** Fracción del camino que ocupa la fila a la vez. Por defecto 0.75. */
	largoFila?: number;
	/** Cada cuántas hormigas una lleva billete en vez de moneda (0 = nunca). Por defecto 4. */
	billeteCada?: number;
};

/**
 * Fila de hormigas que marchan de `desde` (p. ej. la Billetera) a `hasta` (el HoyoHormiga) por una
 * curva suave. Las hormigas salen creciendo en el origen y se hunden al llegar al hoyo.
 */
export const FilaHormigas: React.FC<FilaHormigasProps> = ({desde, hasta, cantidad, progreso, fase = 0, escala = 1, curva = 0.18, largoFila = 0.75, billeteCada = 4}) => {
	const p0 = new THREE.Vector3(...desde);
	const p2 = new THREE.Vector3(...hasta);
	const d = p2.clone().sub(p0);
	const largo = d.length();
	const perp = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(largo * curva);
	const p1 = p0.clone().add(p2).multiplyScalar(0.5).add(perp);
	const curvaQ = new THREE.QuadraticBezierCurve3(p0, p1, p2);
	const n = Math.max(0, Math.round(cantidad));
	const sep = n > 1 ? largoFila / (n - 1) : 0;
	const r = rng(77);
	const desfases = Array.from({length: n}, () => r());
	return (
		<group>
			{Array.from({length: n}, (_, i) => {
				const t = clamp01(progreso) * (1 + largoFila + 0.06) - 0.03 - i * sep;
				if (t <= 0 || t >= 1) return null;
				const pos = curvaQ.getPoint(t);
				const tan = curvaQ.getTangent(t);
				const entra = suave(t / 0.05);
				const sale = suave((1 - t) / 0.06);
				const s = escala * Math.min(entra, sale) * (0.92 + desfases[i] * 0.16);
				const hunde = (1 - sale) * -0.05 * escala;
				const carga: CargaHormiga = billeteCada > 0 && i % billeteCada === billeteCada - 1 ? 'billete' : 'moneda';
				return (
					<Hormiga key={i} position={[pos.x, pos.y + hunde, pos.z]} rotationY={Math.atan2(tan.x, tan.z)} escala={s} fase={fase + desfases[i] * 6.28} carga={carga} />
				);
			})}
		</group>
	);
};

// ============================================================
// Billetera
// ============================================================
export type BilleteraProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	/** 0..1: los billetes se hunden y desaparecen uno por uno. */
	vacia?: number;
};

// cuero con grano suave y costura punteada a `margen` px del borde (en un lienzo de w×h)
const texCuero = (w: number, h: number, base: string, margen: number, semilla: number, soloArriba = false) =>
	texFija(`cuero|${w}|${h}|${base}|${margen}|${semilla}|${soloArriba}`, () =>
		lienzo(w, h, (ctx) => {
			ctx.fillStyle = base;
			ctx.fillRect(0, 0, w, h);
			const r = rng(semilla);
			for (let i = 0; i < (w * h) / 90; i++) {
				ctx.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)';
				ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 2 + r() * 3);
			}
			// borde ligeramente más oscuro
			ctx.strokeStyle = 'rgba(40,18,6,0.35)';
			ctx.lineWidth = margen * 0.5;
			ctx.strokeRect(0, 0, w, h);
			ctx.strokeStyle = '#f1dcae';
			ctx.lineWidth = Math.max(3, margen * 0.28);
			ctx.lineCap = 'round';
			ctx.setLineDash([margen * 0.55, margen * 0.4]);
			ctx.beginPath();
			if (soloArriba) {
				ctx.moveTo(margen * 0.6, margen);
				ctx.lineTo(w - margen * 0.6, margen);
			} else ctx.rect(margen, margen, w - margen * 2, h - margen * 2);
			ctx.stroke();
		}),
	);

// billete partido en dos mitades (izquierda/derecha) para doblarlo en la V de la billetera
const texBilleteMitad = (color: 'verde' | 'teal', lado: 0 | 1) =>
	texFija(`billeteMitad|${color}|${lado}`, () => {
		const t = lienzo(256, 128, (ctx) => {
			const [fondo, borde, claro, tinta] = color === 'verde' ? ['#7fc48a', '#3f8a52', '#d7efd5', '#2f6e3f'] : ['#5fbfae', '#2c7f73', '#d2f0ea', '#1f6158'];
			ctx.fillStyle = fondo;
			ctx.fillRect(0, 0, 256, 128);
			ctx.strokeStyle = borde;
			ctx.lineWidth = 8;
			ctx.strokeRect(10, 10, 236, 108);
			ctx.fillStyle = claro;
			ctx.beginPath();
			ctx.ellipse(128, 64, 36, 36, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.font = `900 38px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = tinta;
			ctx.fillText('S/', 128, 66);
			ctx.font = `800 26px ${FUENTE}`;
			ctx.fillText(color === 'verde' ? '10' : '20', 40, 34);
			ctx.fillText(color === 'verde' ? '10' : '20', 216, 96);
		});
		t.repeat.set(0.5, 1);
		t.offset.set(lado * 0.5, 0);
		return t;
	});

/**
 * Billetera bifold de cuero café, abierta en V (≈105° entre las mitades) y parada sobre su canto en
 * y = 0, con el lomo atrás y la abertura hacia +Z para que se vea el interior: ranuras con tarjetas
 * (salvia, terracota, miel), costuras punteadas y billetes verdes/turquesa saliendo por arriba del
 * compartimento de billetes. ≈0.53 de ancho, ≈0.27 de alto (≈0.37 con billetes). Dos monedas al pie.
 * `vacia` 0..1: los billetes se hunden uno por uno; vacía sigue leyéndose como billetera abierta.
 */
export const Billetera: React.FC<BilleteraProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, vacia = 0}) => {
	const L = 0.32; // ancho de cada mitad
	const H = 0.27; // alto
	const T = 0.022; // grosor del cuero
	const ABRE = 0.66; // giro de cada mitad desde el plano frontal (≈38°, 105° entre mitades)
	const cueroBase = '#8a5232';
	const cuero = mat(cueroBase, {r: 0.6});
	const cueroOsc = mat('#6e3f25', {r: 0.65});
	const interior = matMapa('cueroInt', () => texCuero(340, 270, '#7a4529', 14, 3), {r: 0.7});
	const exterior = matMapa('cueroExt', () => texCuero(340, 270, cueroBase, 14, 9), {r: 0.6});
	const v = clamp01(vacia);
	// billetes: [mitad izquierda/derecha comparten el mismo billete doblado]
	const billetes: {color: 'verde' | 'teal'; sube: number; rz: number; dx: number}[] = [
		{color: 'verde', sube: 0.1, rz: 0.12, dx: -0.03},
		{color: 'teal', sube: 0.085, rz: -0.1, dx: 0.025},
		{color: 'verde', sube: 0.068, rz: 0.06, dx: 0.0},
		{color: 'teal', sube: 0.05, rz: -0.14, dx: -0.015},
	];
	const BH = 0.15; // alto del billete
	// ranuras: [alto del borde superior, color de la tarjeta]
	const ranuras: Record<number, [number, string][]> = {
		[-1]: [
			[0.2, MARCA.salvia],
			[0.155, MARCA.terracota],
			[0.11, MARCA.miel],
		],
		[1]: [
			[0.2, MARCA.miel],
			[0.155, MARCA.salvia],
			[0.11, MARCA.terracota],
		],
	};
	const tiraTex = (alto: number, i: number) => matMapa(`tira|${alto}|${i}`, () => texCuero(320, Math.round(320 * (alto / (L - 0.03))), i % 2 ? '#93593a' : '#9a5f3e', 12, 20 + i, true), {r: 0.6});
	const mitad = (lado: -1 | 1) => (
		<group key={lado} rotation={[0, -lado * ABRE, 0]}>
			{/* panel de cuero; cara interior = +Z local */}
			<mesh geometry={G.redonda(L, H, T, 0.008)} material={cuero} position={[(lado * L) / 2, H / 2, 0]} castShadow receiveShadow />
			<mesh geometry={G.plano()} material={exterior} position={[(lado * L) / 2, H / 2, -T / 2 - 0.0008]} rotation={[0, Math.PI, 0]} scale={[L - 0.006, H - 0.006, 1]} />
			<mesh geometry={G.plano()} material={interior} position={[(lado * L) / 2, H / 2, T / 2 + 0.0008]} scale={[L - 0.006, H - 0.006, 1]} />
			{/* billetes (detrás de las ranuras), mitad del billete doblado en esta hoja */}
			{billetes.map((b, i) => {
				const k = suave((v - i * 0.2) / 0.3);
				if (k >= 0.999) return null;
				const y = 0.11 + BH / 2 + b.sube - k * (b.sube + 0.12);
				const ancho = (L - 0.03) * (1 - Math.abs(b.rz) * 0.3);
				return (
					<group key={i} position={[lado * (0.012 + ancho / 2) + b.dx, y, T / 2 + 0.003 + i * 0.0025]} rotation={[0, 0, b.rz * (lado < 0 ? 1 : -1) * 0.5]}>
						<mesh geometry={G.caja()} material={mat(b.color === 'verde' ? '#5fae6d' : '#3fa192', {r: 0.9})} scale={[ancho, BH, 0.0015]} castShadow />
						<mesh geometry={G.plano()} material={matMapa(`bm|${b.color}|${lado}`, () => texBilleteMitad(b.color, lado < 0 ? 0 : 1), {r: 0.9})} position={[0, 0, 0.001]} scale={[ancho, BH, 1]} />
					</group>
				);
			})}
			{/* bolsa de ranuras: fondo + tiras escalonadas, cada una con su tarjeta asomando */}
			<mesh geometry={G.caja()} material={cueroOsc} position={[(lado * L) / 2, 0.11, T / 2 + 0.016]} scale={[L - 0.03, 0.2, 0.003]} castShadow receiveShadow />
			{ranuras[lado].map(([alto, color], i) => {
				const z = T / 2 + 0.02 + i * 0.006;
				return (
					<group key={i}>
						{/* tarjeta asomando */}
						<mesh geometry={G.redonda(L - 0.075, 0.1, 0.003, 0.008)} material={mat(color, {r: 0.45})} position={[lado * (L / 2 + 0.008), alto - 0.035, z - 0.003]} castShadow />
						<B p={[lado * (L / 2 + 0.008), alto + 0.007, z - 0.001]} s={[L - 0.09, 0.006, 0.001]} c="#ffffff" o={{r: 0.5, o: 0.35}} sombra={false} />
						{/* tira de cuero de la ranura */}
						<mesh geometry={G.redonda(L - 0.03, alto - 0.012, 0.004, 0.003)} material={cuero} position={[(lado * L) / 2, (alto - 0.012) / 2 + 0.006, z]} castShadow receiveShadow />
						<mesh geometry={G.plano()} material={tiraTex(alto - 0.012, i)} position={[(lado * L) / 2, (alto - 0.012) / 2 + 0.006, z + 0.0021]} scale={[L - 0.032, alto - 0.014, 1]} />
					</group>
				);
			})}
		</group>
	);
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* lomo (doblez) */}
			<Cil p={[0, 0, -0.004]} r={0.017} h={H} m={cuero} seg={14} />
			{mitad(-1)}
			{mitad(1)}
			{/* monedas al pie */}
			<group position={[-0.06, 0.004, 0.33]} rotation={[-Math.PI / 2, 0, 0]}>
				<MonedaSol radio={0.045} />
			</group>
			<group position={[0.07, 0.04, 0.34]} rotation={[-0.45, 0.3, 0]}>
				<MonedaSol radio={0.042} />
			</group>
		</group>
	);
};

// ============================================================
// HoyoHormiga
// ============================================================
export type HoyoHormigaProps = {position?: V3; escala?: number; semilla?: number};

/** Montículo de tierra (radio ≈0.24, alto ≈0.09) con el hoyo arriba (radio 0.05, en y ≈ 0.09). */
export const HoyoHormiga: React.FC<HoyoHormigaProps> = ({position = [0, 0, 0], escala = 1, semilla = 5}) => {
	const tierra = mat('#b07a4f', {r: 0.95, flat: true});
	const tierraClara = mat('#c99566', {r: 0.95, flat: true});
	const migas = useMemo(() => {
		const r = rng(semilla);
		return Array.from({length: 14}, () => {
			const a = r() * Math.PI * 2;
			const d = 0.2 + r() * 0.16;
			return {x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.012 + r() * 0.02, claro: r() > 0.5};
		});
	}, [semilla]);
	return (
		<group position={position} scale={escala}>
			<mesh geometry={G.cono(0.32, 11)} material={tierra} position={[0, 0.045, 0]} scale={[0.5, 0.09, 0.48]} castShadow receiveShadow />
			<mesh geometry={G.cono(0.5, 9)} material={tierraClara} position={[0.03, 0.065, -0.01]} scale={[0.26, 0.05, 0.25]} rotation={[0, 0.4, 0]} castShadow receiveShadow />
			{/* hoyo: aro y fondo oscuro */}
			<mesh geometry={G.toro(0.05, 0.016, Math.PI * 2, 6, 14)} material={tierra} position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
			<mesh geometry={G.disco(18)} material={mat('#1c120c', {r: 1})} position={[0, 0.093, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.105} />
			{migas.map((m, i) => (
				<Esf key={i} p={[m.x, m.s * 0.4, m.z]} r={[m.s, m.s * 0.7, m.s]} m={m.claro ? tierraClara : tierra} seg={6} />
			))}
		</group>
	);
};

// ============================================================
// Gastos hormiga: café, delivery, taxi
// ============================================================
export type PropSimple = {position?: V3; rotationY?: number; escala?: number};

/** Vaso de café para llevar (≈0.36 de alto, vapor hasta ≈0.7) con manga terracota y tapa tinta. */
export const TazaCafe: React.FC<PropSimple & {vapor?: boolean; fase?: number}> = ({position = [0, 0, 0], rotationY = 0, escala = 1, vapor = true, fase = 0}) => {
	const frame = useCurrentFrame();
	const humos = useMemo(() => Array.from({length: 6}, () => new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1, transparent: true, depthWrite: false})), []);
	useEffect(() => () => humos.forEach((m) => m.dispose()), [humos]);
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<mesh geometry={G.cono(1.3, 28)} material={mat('#f6f1e7', {r: 0.7})} position={[0, 0.15, 0]} scale={[0.17, 0.3, 0.17]} castShadow receiveShadow />
			{/* manga */}
			<mesh geometry={G.cono(1.15, 28)} material={mat(MARCA.terracota, {r: 0.85})} position={[0, 0.15, 0]} scale={[0.198, 0.12, 0.198]} castShadow />
			{/* tapa */}
			<Cil p={[0, 0.3, 0]} r={0.118} h={0.028} c={MARCA.tinta} seg={28} o={{r: 0.5}} />
			<mesh geometry={G.cono(0.82, 28)} material={mat('#2c2c2c', {r: 0.5})} position={[0, 0.342, 0]} scale={[0.2, 0.03, 0.2]} castShadow />
			<B p={[0.045, 0.358, 0]} s={[0.03, 0.004, 0.012]} c="#000000" sombra={false} />
			{vapor
				? humos.map((m, k) => {
						const t = (frame / 50 + k / humos.length + fase) % 1;
						const col = k % 2 ? 1 : -1;
						m.opacity = Math.sin(Math.PI * t) * 0.75;
						const s = 0.035 + 0.05 * t;
						return <mesh key={k} geometry={G.esfera(12)} material={m} position={[col * 0.025 + Math.sin(t * 7 + k) * 0.03, 0.38 + t * 0.34, 0]} scale={[s * 2, s * 2, s * 2]} />;
					})
				: null}
		</group>
	);
};

const texSticker = () =>
	texFija('stickerDelivery', () =>
		lienzo(128, 128, (ctx) => {
			ctx.fillStyle = MARCA.miel;
			ctx.beginPath();
			ctx.arc(64, 64, 62, 0, Math.PI * 2);
			ctx.fill();
			// tazón con vapor, sin marca
			ctx.fillStyle = '#ffffff';
			ctx.beginPath();
			ctx.arc(64, 66, 34, 0, Math.PI);
			ctx.fill();
			ctx.fillRect(26, 62, 76, 6);
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 6;
			ctx.lineCap = 'round';
			[48, 64, 80].forEach((x) => {
				ctx.beginPath();
				ctx.moveTo(x, 50);
				ctx.quadraticCurveTo(x - 8, 40, x, 30);
				ctx.stroke();
			});
		}),
	);

/** Bolsa de papel kraft de delivery (≈0.36 de alto + asas ≈0.45) con franja y sticker sin marca. */
export const BolsaDelivery: React.FC<PropSimple> = ({position = [0, 0, 0], rotationY = 0, escala = 1}) => {
	const kraft = mat('#c99a62', {r: 0.95});
	const kraftOsc = mat('#b4874f', {r: 0.95});
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<mesh geometry={G.redonda(0.3, 0.36, 0.18, 0.012)} material={kraft} position={[0, 0.18, 0]} castShadow receiveShadow />
			{/* pliegues laterales */}
			{[-1, 1].map((s) => (
				<B key={s} p={[s * 0.151, 0.2, 0]} s={[0.003, 0.3, 0.012]} m={kraftOsc} sombra={false} />
			))}
			{/* borde doblado arriba */}
			<mesh geometry={G.redonda(0.306, 0.05, 0.186, 0.01)} material={kraftOsc} position={[0, 0.34, 0]} castShadow />
			{/* franja terracota */}
			<B p={[0, 0.1, 0]} s={[0.302, 0.05, 0.182]} c={MARCA.terracota} />
			{/* sticker */}
			<mesh geometry={G.disco(24)} material={matMapa('stickerDelivery', texSticker, {r: 0.6})} position={[0, 0.215, 0.0915]} scale={0.13} />
			{/* asas de cuerda */}
			{[-1, 1].map((s) => (
				<mesh key={s} geometry={G.toro(0.065, 0.009, Math.PI, 6, 16)} material={mat('#8a5a33', {r: 0.9})} position={[0, 0.36, s * 0.06]} castShadow />
			))}
			{/* ticket engrapado */}
			<group position={[0.1, 0.33, 0.094]} rotation={[0.05, 0, -0.12]}>
				<B p={[0, -0.04, 0]} s={[0.06, 0.11, 0.003]} c="#fbfaf6" />
				{[0, 1, 2, 3].map((k) => (
					<B key={k} p={[-0.004 + (k % 2) * 0.006, -0.01 - k * 0.018, 0.002]} s={[0.036 - (k % 2) * 0.01, 0.005, 0.001]} c="#9a9a9a" sombra={false} />
				))}
				<B p={[0, 0.006, 0.003]} s={[0.018, 0.003, 0.002]} c="#bbbbbb" sombra={false} />
			</group>
		</group>
	);
};

const texCuadros = () =>
	texFija('cuadrosTaxi', () => {
		const t = lienzo(256, 32, (ctx) => {
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, 256, 32);
			ctx.fillStyle = '#1e1e1e';
			for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * 16, j * 16, 16, 16);
		});
		return t;
	});
const texLetreroTaxi = () =>
	texFija('letreroTaxi', () =>
		lienzo(256, 96, (ctx) => {
			ctx.fillStyle = '#fff6d6';
			ctx.fillRect(0, 0, 256, 96);
			ctx.font = `900 72px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = MARCA.tinta;
			ctx.fillText('TAXI', 128, 52);
		}),
	);

/** Taxi de juguete genérico (≈0.62 de largo en Z, ≈0.32 de ancho, ≈0.4 de alto con letrero). */
export const TaxiJuguete: React.FC<PropSimple & {rueda?: number}> = ({position = [0, 0, 0], rotationY = 0, escala = 1, rueda = 0}) => {
	const amarillo = mat('#f4c22b', {r: 0.4});
	const vidrio = mat('#2d4566', {r: 0.15, m: 0.1});
	const llanta = mat('#222222', {r: 0.8});
	const rin = mat('#cfcfcf', {r: 0.35, m: 0.4});
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* carrocería */}
			<mesh geometry={G.redonda(0.32, 0.13, 0.62, 0.05)} material={amarillo} position={[0, 0.125, 0]} castShadow receiveShadow />
			{/* cabina: vidrios + techo */}
			<mesh geometry={G.redonda(0.285, 0.12, 0.33, 0.04)} material={vidrio} position={[0, 0.245, -0.03]} castShadow />
			<mesh geometry={G.redonda(0.295, 0.035, 0.31, 0.03)} material={amarillo} position={[0, 0.31, -0.035]} castShadow />
			{[-1, 1].map((s) => (
				<group key={s}>
					{/* postes */}
					<B p={[s * 0.138, 0.245, -0.03]} s={[0.016, 0.12, 0.025]} m={amarillo} />
					<B p={[s * 0.136, 0.245, 0.125]} s={[0.016, 0.11, 0.03]} m={amarillo} rot={[-0.35, 0, 0]} />
					<B p={[s * 0.136, 0.245, -0.185]} s={[0.016, 0.11, 0.03]} m={amarillo} rot={[0.35, 0, 0]} />
					{/* franja de cuadros */}
					<mesh geometry={G.plano()} material={matMapa('cuadrosTaxi', texCuadros, {r: 0.6})} position={[s * 0.1612, 0.14, 0]} rotation={[0, (s * Math.PI) / 2, 0]} scale={[0.5, 0.04, 1]} />
					{/* faros y calaveras */}
					<Esf p={[s * 0.1, 0.14, 0.31]} r={[0.03, 0.025, 0.012]} c="#fffbe8" o={{e: '#fff3c4', ei: 0.5, r: 0.2}} sombra={false} />
					<B p={[s * 0.11, 0.15, -0.311]} s={[0.05, 0.03, 0.006]} c={MARCA.rojo} o={{e: MARCA.rojo, ei: 0.2}} sombra={false} />
					{/* llantas */}
					{[0.19, -0.19].map((z) => (
						<group key={z} position={[s * 0.15, 0.065, z]} rotation={[rueda, 0, Math.PI / 2]}>
							<mesh geometry={G.cil(18)} material={llanta} scale={[0.13, 0.06, 0.13]} castShadow />
							<mesh geometry={G.cil(12)} material={rin} position={[0, s * -0.031, 0]} scale={[0.065, 0.004, 0.065]} />
						</group>
					))}
					{/* espejos */}
					<B p={[s * 0.175, 0.22, 0.1]} s={[0.035, 0.022, 0.015]} m={amarillo} />
				</group>
			))}
			{/* parachoques */}
			<mesh geometry={G.redonda(0.3, 0.035, 0.03, 0.012)} material={mat('#9a9a9a', {r: 0.4, m: 0.3})} position={[0, 0.075, 0.315]} castShadow />
			<mesh geometry={G.redonda(0.3, 0.035, 0.03, 0.012)} material={mat('#9a9a9a', {r: 0.4, m: 0.3})} position={[0, 0.075, -0.315]} castShadow />
			{/* parrilla */}
			<B p={[0, 0.115, 0.311]} s={[0.1, 0.03, 0.005]} c="#333333" sombra={false} />
			{/* letrero TAXI */}
			<group position={[0, 0.345, -0.03]}>
				<mesh geometry={G.redonda(0.13, 0.05, 0.05, 0.012)} material={mat('#fff6d6', {r: 0.5, e: '#fff1b0', ei: 0.25})} position={[0, 0.025, 0]} castShadow />
				{[-1, 1].map((s) => (
					<mesh key={s} geometry={G.plano()} material={matMapa('letreroTaxi', texLetreroTaxi, {r: 0.5})} position={[0, 0.025, s * 0.0256]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} scale={[0.11, 0.04, 1]} />
				))}
			</group>
		</group>
	);
};

// ============================================================
// Cuaderno y HojaExcel
// ============================================================
const NOTAS = [
	['pasaje', '1.50'],
	['menú', '12.00'],
	['café', '6.90'],
	['yape ??', '10'],
	['chifa', '18.50'],
	['galletas', '2.20'],
	['taxi', '9.00'],
	['¿?', '¿?'],
];
const dibujarPagina = (semilla: number) => (ctx: CanvasRenderingContext2D) => {
	const W = 256;
	const H = 340;
	ctx.fillStyle = '#fbf8ef';
	ctx.fillRect(0, 0, W, H);
	ctx.strokeStyle = '#a9c4e6';
	ctx.lineWidth = 2;
	for (let y = 46; y < H; y += 30) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(W, y);
		ctx.stroke();
	}
	ctx.strokeStyle = '#e59a9a';
	ctx.beginPath();
	ctx.moveTo(40, 0);
	ctx.lineTo(40, H);
	ctx.stroke();
	const r = rng(semilla);
	ctx.fillStyle = '#2f4f9a';
	ctx.textBaseline = 'alphabetic';
	for (let i = 0; i < 9; i++) {
		const n = NOTAS[(i + semilla) % NOTAS.length];
		const y = 42 + i * 30;
		ctx.save();
		ctx.translate(48 + r() * 6, y);
		ctx.rotate((r() - 0.5) * 0.08);
		ctx.font = `italic 600 ${19 + Math.round(r() * 4)}px ${FUENTE}`;
		ctx.fillText(n[0], 0, 0);
		ctx.fillText(n[1], 130, 0);
		if (r() > 0.7) {
			ctx.strokeStyle = '#2f4f9a';
			ctx.lineWidth = 2.5;
			ctx.beginPath();
			ctx.moveTo(-2, -6);
			ctx.lineTo(180, -8);
			ctx.stroke();
		}
		ctx.restore();
	}
	// garabato de suma
	ctx.strokeStyle = MARCA.rojo;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.ellipse(196, 316, 40, 16, -0.1, 0, Math.PI * 2);
	ctx.stroke();
	ctx.fillStyle = MARCA.rojo;
	ctx.font = `italic 800 20px ${FUENTE}`;
	ctx.fillText('= ???', 166, 323);
};

const PAGINA_W = 0.27;
const PAGINA_D = 0.36;

export type CuadernoProps = PropSimple & {
	/** Hojas pasadas (fraccionario = hoja a medio vuelo). Se agita al pasar. 0 por defecto. */
	hojas?: number;
	/** Total de hojas que se pueden pasar. Por defecto 8. */
	totalHojas?: number;
	color?: string;
};

/**
 * Cuaderno de espiral abierto sobre la mesa (≈0.58 × 0.38, alto ≈0.04), lomo a lo largo de Z en x = 0.
 * Las hojas tienen gastos escritos a mano y tachones. `hojas` las pasa de derecha a izquierda.
 */
export const Cuaderno: React.FC<CuadernoProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, hojas = 0, totalHojas = 8, color = MARCA.salvia}) => {
	const frame = useCurrentFrame();
	const pagA = useMemo(() => matMapa('pag1', () => texFija('pag1', () => lienzo(256, 340, dibujarPagina(1))), {r: 0.9}), []);
	const pagB = useMemo(() => matMapa('pag2', () => texFija('pag2', () => lienzo(256, 340, dibujarPagina(4))), {r: 0.9}), []);
	const papel = mat('#f3eee2', {r: 0.95});
	const tapa = mat(color, {r: 0.7});
	const h = Math.max(0, Math.min(totalHojas, hojas));
	const pasadas = Math.floor(h);
	const gR = 0.004 + 0.002 * (totalHojas - pasadas);
	const gL = 0.004 + 0.002 * pasadas;
	const vuelo = h - pasadas;
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* tapas (abiertas, planas) */}
			{[-1, 1].map((s) => (
				<mesh key={s} geometry={G.redonda(PAGINA_W + 0.015, 0.008, PAGINA_D + 0.02, 0.004)} material={tapa} position={[s * (PAGINA_W / 2 + 0.012), 0.004, 0]} castShadow receiveShadow />
			))}
			{/* bloques de hojas */}
			<B p={[PAGINA_W / 2 + 0.012, 0.008 + gR / 2, 0]} s={[PAGINA_W, gR, PAGINA_D]} m={papel} />
			<mesh geometry={G.plano()} material={pagA} position={[PAGINA_W / 2 + 0.012, 0.0085 + gR, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[PAGINA_W, PAGINA_D, 1]} receiveShadow />
			<B p={[-(PAGINA_W / 2 + 0.012), 0.008 + gL / 2, 0]} s={[PAGINA_W, gL, PAGINA_D]} m={papel} />
			<mesh geometry={G.plano()} material={pagB} position={[-(PAGINA_W / 2 + 0.012), 0.0085 + gL, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[PAGINA_W, PAGINA_D, 1]} receiveShadow />
			{/* hoja en vuelo */}
			{vuelo > 0.001 ? (
				<group position={[0, 0.012 + Math.max(gR, gL), 0]} rotation={[0, 0, suave(vuelo) * Math.PI + Math.sin(frame * 0.6) * 0.06 * Math.sin(vuelo * Math.PI)]}>
					<group position={[PAGINA_W / 2 + 0.012, 0, 0]} rotation={[0, 0, -Math.sin(vuelo * Math.PI) * 0.25]}>
						<mesh geometry={G.plano()} material={pagA} rotation={[-Math.PI / 2, 0, 0]} scale={[PAGINA_W, PAGINA_D, 1]} castShadow />
						<mesh geometry={G.plano()} material={pagB} rotation={[Math.PI / 2, 0, Math.PI]} scale={[PAGINA_W, PAGINA_D, 1]} />
					</group>
				</group>
			) : null}
			{/* espiral */}
			{Array.from({length: 11}, (_, i) => (
				<mesh key={i} geometry={G.toro(0.016, 0.0028, Math.PI * 2, 5, 14)} material={mat('#9aa0a6', {r: 0.3, m: 0.7})} position={[0, 0.018, -PAGINA_D / 2 + 0.02 + i * ((PAGINA_D - 0.04) / 10)]} castShadow />
			))}
			{/* lápiz */}
			<group position={[0.2, 0.024, 0.06]} rotation={[0, 0.5, Math.PI / 2]}>
				<mesh geometry={G.cil(6)} material={mat(MARCA.miel, {r: 0.6})} scale={[0.016, 0.2, 0.016]} castShadow />
				<mesh geometry={G.cono(0.01, 6)} material={mat('#e8c9a0', {r: 0.8})} position={[0, -0.115, 0]} rotation={[Math.PI, 0, 0]} scale={[0.016, 0.03, 0.016]} />
				<mesh geometry={G.cil(8)} material={mat('#e58a9a', {r: 0.8})} position={[0, 0.108, 0]} scale={[0.016, 0.018, 0.016]} />
			</group>
		</group>
	);
};

const texExcel = () =>
	texFija('excel', () =>
		lienzo(512, 704, (ctx) => {
			const W = 512;
			const H = 704;
			ctx.fillStyle = '#fdfcf8';
			ctx.fillRect(0, 0, W, H);
			const cols = 6;
			const filas = 22;
			const cw = (W - 40) / cols;
			const rh = (H - 40) / filas;
			// cabeceras
			ctx.fillStyle = '#e3e9e4';
			ctx.fillRect(0, 0, W, 40);
			ctx.fillRect(0, 0, 40, H);
			ctx.fillStyle = '#c9d7cd';
			ctx.fillRect(40, 40, W - 40, rh);
			ctx.font = `700 18px ${FUENTE}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillStyle = '#56645a';
			'ABCDEF'.split('').forEach((l, i) => ctx.fillText(l, 40 + cw * (i + 0.5), 21));
			for (let f = 0; f < filas; f++) ctx.fillText(String(f + 1), 20, 40 + rh * (f + 0.5));
			const r = rng(9);
			// celdas pintadas al azar (desorden)
			const relleno = ['#f6d3cb', '#fbecc0', '#d6e6dc', '#f2c4bd'];
			for (let k = 0; k < 16; k++) {
				ctx.fillStyle = relleno[k % relleno.length];
				const c = Math.floor(r() * cols);
				const f = 1 + Math.floor(r() * (filas - 1));
				ctx.fillRect(40 + c * cw, 40 + f * rh, cw * (1 + Math.floor(r() * 2)), rh);
			}
			ctx.strokeStyle = '#b9c2bc';
			ctx.lineWidth = 1.5;
			for (let c = 0; c <= cols; c++) {
				ctx.beginPath();
				ctx.moveTo(40 + c * cw, 0);
				ctx.lineTo(40 + c * cw, H);
				ctx.stroke();
			}
			for (let f = 0; f <= filas; f++) {
				ctx.beginPath();
				ctx.moveTo(0, 40 + f * rh);
				ctx.lineTo(W, 40 + f * rh);
				ctx.stroke();
			}
			ctx.fillStyle = '#2b3a33';
			ctx.font = `700 15px ${FUENTE}`;
			['Fecha', 'Gasto', 'Monto', 'Cat.', 'Total', '¿?'].forEach((t, i) => ctx.fillText(t, 40 + cw * (i + 0.5), 40 + rh * 0.5));
			ctx.font = `500 15px ${FUENTE}`;
			const raros = ['#####', '#REF!', '#¡VALOR!', '???', 'S/ ??', '=SUMA('];
			for (let f = 1; f < filas; f++) {
				for (let c = 0; c < cols; c++) {
					if (r() < 0.25) continue;
					const x = 40 + cw * (c + 0.5);
					const y = 40 + rh * (f + 0.5);
					let t: string;
					const q = r();
					if (q < 0.12) {
						ctx.fillStyle = MARCA.rojo;
						t = raros[Math.floor(r() * raros.length)];
					} else {
						ctx.fillStyle = '#2b3a33';
						t = (r() * 120).toFixed(r() > 0.5 ? 2 : 1);
					}
					ctx.fillText(t, x + (r() - 0.5) * 10, y);
				}
			}
			// garabatos a mano encima
			ctx.strokeStyle = MARCA.rojo;
			ctx.lineWidth = 5;
			ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.ellipse(330, 420, 90, 34, -0.15, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(120, 560);
			for (let i = 0; i < 9; i++) ctx.lineTo(140 + i * 26, 560 + (i % 2 ? -22 : 18));
			ctx.stroke();
			ctx.fillStyle = MARCA.rojo;
			ctx.font = `italic 900 46px ${FUENTE}`;
			ctx.save();
			ctx.translate(380, 640);
			ctx.rotate(-0.2);
			ctx.fillText('¿¿??', 0, 0);
			ctx.restore();
			// mancha de café
			ctx.strokeStyle = 'rgba(150, 100, 50, 0.35)';
			ctx.lineWidth = 9;
			ctx.beginPath();
			ctx.arc(110, 250, 50, 0.3, Math.PI * 1.9);
			ctx.stroke();
		}),
	);

export type HojaExcelProps = PropSimple & {
	/** 0..1: de hoja (con arrugas leves) a bolita de papel (radio ≈0.16) sobre el piso. */
	arrugar?: number;
	ancho?: number;
	alto?: number;
	semilla?: number;
};

const SEG_X = 22;
const SEG_Y = 30;

/**
 * Hoja de cálculo impresa, grande (0.8 × 1.1 por defecto), de pie con la base en y = 0 y la cara a +Z,
 * con números desordenados, errores (#REF!, #####) y garabatos rojos. `arrugar` la convierte en bola.
 */
export const HojaExcel: React.FC<HojaExcelProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, arrugar = 0, ancho = 0.8, alto = 1.1, semilla = 3}) => {
	const a = Math.round(clamp01(arrugar) * 100) / 100;
	const ruido = useMemo(() => {
		const r = rng(semilla);
		// ruido suave: rejilla gruesa interpolada + un poco de ruido fino (pliegues, no picos)
		const GX = 7;
		const GY = 9;
		const grueso = (k: number) => Array.from({length: (GX + 1) * (GY + 1)}, () => (r() - 0.5) * k);
		const gz = grueso(1);
		const gr = grueso(1);
		const muestra = (g: number[], u: number, v: number) => {
			const x = u * GX;
			const y = v * GY;
			const i = Math.min(GX - 1, Math.floor(x));
			const j = Math.min(GY - 1, Math.floor(y));
			const fx = x - i;
			const fy = y - j;
			const at = (a: number, b: number) => g[b * (GX + 1) + a];
			return lerp(lerp(at(i, j), at(i + 1, j), fx), lerp(at(i, j + 1), at(i + 1, j + 1), fx), fy);
		};
		const z: number[] = [];
		const rad: number[] = [];
		for (let iy = 0; iy <= SEG_Y; iy++)
			for (let ix = 0; ix <= SEG_X; ix++) {
				const u = ix / SEG_X;
				const v = 1 - iy / SEG_Y;
				z.push(muestra(gz, u, v) + (r() - 0.5) * 0.25);
				rad.push(0.5 + muestra(gr, u, v) + (r() - 0.5) * 0.2);
			}
		return {z, rad, pliegues: Array.from({length: 4}, () => [r(), r(), r() - 0.5] as const)};
	}, [semilla]);
	const geometria = useMemo(() => {
		const g = new THREE.PlaneGeometry(ancho, alto, SEG_X, SEG_Y);
		const pos = g.attributes.position;
		const uv = g.attributes.uv;
		const m = suave(a);
		const radio = 0.16;
		const centroY = lerp(alto / 2, radio * 0.95, m);
		const pico = Math.sin(Math.PI * Math.min(1, a * 1.4)) * (1 - m);
		for (let i = 0; i < pos.count; i++) {
			const u = uv.getX(i);
			const v = uv.getY(i);
			const x0 = pos.getX(i);
			const y0 = pos.getY(i);
			// pliegues leves de hoja manoseada
			let z0 = ruido.z[i] * (0.006 + 0.05 * pico);
			for (const [pu, pv, dir] of ruido.pliegues) {
				const dist = Math.abs((u - pu) * dir + (v - pv));
				z0 += Math.max(0, 0.06 - dist) * 0.25 * (dir > 0 ? 1 : -1);
			}
			const enc = 1 - 0.78 * m;
			const plano = new THREE.Vector3(x0 * enc, centroY + y0 * enc, z0 + ruido.z[i] * 0.12 * Math.sin(Math.PI * m));
			// destino en la bola: dirección desde el centro con mucho ruido en z (arrugado)
			const dir = new THREE.Vector3((x0 / (ancho / 2)) * 1.1, (y0 / (alto / 2)) * 1.1, ruido.z[i] * 2.2 + (u > 0.5 ? 0.2 : -0.2)).normalize();
			const rr = radio * (0.8 + clamp01(ruido.rad[i]) * 0.35);
			const bola = new THREE.Vector3(dir.x * rr, centroY + dir.y * rr, dir.z * rr);
			plano.lerp(bola, m);
			pos.setXYZ(i, plano.x, plano.y, plano.z);
		}
		g.computeVertexNormals();
		return g;
	}, [a, ancho, alto, ruido]);
	useEffect(() => () => geometria.dispose(), [geometria]);
	const hoja = useMemo(() => matMapa('excel', texExcel, {r: 0.92, lado: THREE.DoubleSide}), []);
	(hoja as THREE.MeshStandardMaterial).flatShading = true;
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<mesh geometry={geometria} material={hoja} castShadow receiveShadow />
		</group>
	);
};

// ============================================================
// Sofa y LucesNoche
// ============================================================
export type SofaProps = PropSimple & {color?: string; cojin?: string};

/** Sillón de 2 plazas (≈1.7 de ancho, 0.82 de fondo); asiento a y = 0.45, respaldo hasta 0.88. */
export const Sofa: React.FC<SofaProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, color = MARCA.salvia, cojin = MARCA.miel}) => {
	const tela = mat(color, {r: 0.92});
	const telaOsc = mat(new THREE.Color(color).multiplyScalar(0.82).getStyle(), {r: 0.92});
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* base */}
			<mesh geometry={G.redonda(1.5, 0.24, 0.8, 0.06)} material={telaOsc} position={[0, 0.2, 0]} castShadow receiveShadow />
			{/* cojines del asiento */}
			{[-1, 1].map((s) => (
				<mesh key={s} geometry={G.redonda(0.68, 0.14, 0.62, 0.06)} material={tela} position={[s * 0.36, 0.38, 0.07]} castShadow receiveShadow />
			))}
			{/* respaldo */}
			<mesh geometry={G.redonda(1.5, 0.56, 0.22, 0.08)} material={telaOsc} position={[0, 0.6, -0.29]} castShadow receiveShadow />
			{[-1, 1].map((s) => (
				<mesh key={s} geometry={G.redonda(0.68, 0.36, 0.14, 0.06)} material={tela} position={[s * 0.36, 0.62, -0.15]} rotation={[-0.1, 0, 0]} castShadow receiveShadow />
			))}
			{/* brazos */}
			{[-1, 1].map((s) => (
				<mesh key={s} geometry={G.redonda(0.18, 0.5, 0.8, 0.07)} material={telaOsc} position={[s * 0.79, 0.33, 0]} castShadow receiveShadow />
			))}
			{/* patas */}
			{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Cil key={`${sx}${sz}`} p={[sx * 0.75, 0, sz * 0.33]} r={0.025} h={0.08} c="#5a3a22" seg={8} />))}
			{/* cojín decorativo */}
			<mesh geometry={G.redonda(0.32, 0.3, 0.12, 0.06)} material={mat(cojin, {r: 0.9})} position={[0.52, 0.6, -0.08]} rotation={[-0.25, -0.25, 0.12]} castShadow />
		</group>
	);
};

export type LucesNocheProps = {
	/** Multiplica todas las luces. 1 por defecto. */
	intensidad?: number;
	/** Dónde va la lámpara de pie (modelo + luz cálida). null = sin lámpara. */
	lampara?: V3 | null;
	/** Punto de brillo azulado extra (p. ej. donde está el celular). null = sin él. */
	brilloCelular?: V3 | null;
	/** Pinta el fondo azul noche y la niebla. Por defecto true. */
	cielo?: boolean;
	/** Sombras de la lámpara y la luna. Por defecto true. */
	sombras?: boolean;
};

/**
 * Luces de sala un domingo en la noche: ambiente azul oscuro, luna fría por la ventana, lámpara de pie
 * cálida (con su modelo, ≈1.5 de alto) y un brillo opcional de celular. Úsalo en lugar de `Luces`.
 */
export const LucesNoche: React.FC<LucesNocheProps> = ({intensidad = 1, lampara = [-1.1, 0, -0.3], brilloCelular = null, cielo = true, sombras = true}) => {
	const k = Math.max(0, intensidad);
	return (
		<>
			{cielo ? <color attach="background" args={['#141a33']} /> : null}
			{cielo ? <fog attach="fog" args={['#141a33', 14, 45]} /> : null}
			<hemisphereLight args={['#5468b0', '#1d1828', 0.75 * k]} />
			<ambientLight intensity={0.18 * k} color="#6a7cc0" />
			<directionalLight
				position={[-6, 7, 6]}
				intensity={0.55 * k}
				color="#9fb3f0"
				castShadow={sombras}
				shadow-mapSize={[1024, 1024]}
				shadow-camera-left={-6}
				shadow-camera-right={6}
				shadow-camera-top={6}
				shadow-camera-bottom={-6}
				shadow-bias={-0.0006}
				shadow-normalBias={0.05}
			/>
			{lampara ? (
				<group position={lampara}>
					<Cil p={[0, 0, 0]} r={0.16} h={0.03} c="#2b2b2b" seg={20} o={{r: 0.4, m: 0.4}} />
					<Cil p={[0, 0.03, 0]} r={0.015} h={1.22} c="#2b2b2b" seg={8} o={{r: 0.4, m: 0.4}} />
					<mesh geometry={G.cono(0.62, 24)} material={mat('#ffe2b0', {r: 0.9, e: '#ffc477', ei: 1.0 * k, lado: THREE.DoubleSide})} position={[0, 1.36, 0]} scale={[0.4, 0.3, 0.4]} />
					<Esf p={[0, 1.3, 0]} r={0.05} c="#fff3d0" o={{e: '#fff1c8', ei: 2}} sombra={false} />
					<pointLight
						position={[0, 1.3, 0]}
						color="#ffb362"
						intensity={2.2 * k}
						distance={5}
						decay={2}
						castShadow={sombras}
						shadow-mapSize={[1024, 1024]}
						shadow-bias={-0.002}
						shadow-normalBias={0.04}
					/>
				</group>
			) : null}
			{brilloCelular ? <pointLight position={brilloCelular} color="#a8dcff" intensity={1.4 * k} distance={2.2} decay={2} /> : null}
		</>
	);
};
