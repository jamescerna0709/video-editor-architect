// Escenarios 3D estilo "diorama" para el borrador de finanzas: barrio mexicano, casa en corte,
// alcancía, billete genérico, tiendita, gráfica, caja fuerte y la persona protagonista.
// Todo sale de primitivas de three.js y texturas dibujadas en canvas (no hay archivos externos).
// Animación 100 % determinista: depende solo de props o de useCurrentFrame() (nada de Math.random).
// Convención: el origen de cada modelo está en su base (y = 0) y mira hacia +Z. Unidades ≈ metros.
//
// Luces: `Barrio` NO trae luces; usa `<Luces tarde={…} />` (luz de día suave, sombras, cielo en
// degradado y niebla). Para sombras, el ThreeCanvas necesita la prop `shadows`; para colores
// vivos como en las referencias conviene `gl={{toneMapping: THREE.NeutralToneMapping}}`.
import {useEffect, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {TorreMonedas} from './modelos';

type V3 = [number, number, number];

// ============================================================
// utilidades compartidas
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

/** Textura que se rehace cuando cambia `clave` y libera la anterior. */
const useTextura = (clave: string, crear: () => THREE.Texture) => {
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const tex = useMemo(crear, [clave]);
	useEffect(() => () => tex.dispose(), [tex]);
	return tex;
};

// --- caché de geometrías y materiales (módulo): se crean una vez y se comparten ---
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
	esfera: (seg = 24) => geo(`esf${seg}`, () => new THREE.SphereGeometry(0.5, seg, Math.round(seg * 0.75))),
	redonda: (w: number, h: number, d: number, r: number, seg = 3) =>
		geo(`rb${w}|${h}|${d}|${r}|${seg}`, () => cajaRedonda(w, h, d, r, seg)),
};

/** Caja con aristas redondeadas (esquinas esféricas, normales suaves). k = segmentos por esquina. */
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

type OpcMat = {r?: number; m?: number; e?: string; ei?: number; lado?: THREE.Side; cc?: number; flat?: boolean; o?: number};
const cacheMat = new Map<string, THREE.Material>();
const mat = (color: string, o: OpcMat = {}) => {
	const clave = `${color}|${JSON.stringify(o)}`;
	let m = cacheMat.get(clave);
	if (!m) {
		const base = {
			color,
			roughness: o.r ?? 0.78,
			metalness: o.m ?? 0,
			emissive: new THREE.Color(o.e ?? '#000000'),
			emissiveIntensity: o.ei ?? 0,
			side: o.lado ?? THREE.FrontSide,
			flatShading: o.flat ?? false,
			transparent: o.o !== undefined,
			opacity: o.o ?? 1,
		};
		m = o.cc ? new THREE.MeshPhysicalMaterial({...base, clearcoat: o.cc, clearcoatRoughness: 0.12}) : new THREE.MeshStandardMaterial(base);
		cacheMat.set(clave, m);
	}
	return m;
};

/** Caja básica (escala la geometría unitaria compartida). Proyecta y recibe sombra. */
const B: React.FC<{p: V3; s: V3; c?: string; m?: THREE.Material; rot?: V3; o?: OpcMat; sombra?: boolean}> = ({p, s, c = '#cccccc', m, rot, o, sombra = true}) => (
	<mesh geometry={G.caja()} material={m ?? mat(c, o)} position={p} scale={s} rotation={rot} castShadow={sombra} receiveShadow />
);

/** Cilindro vertical con base en p (no en el centro). */
const Cil: React.FC<{p: V3; r: number; h: number; c?: string; m?: THREE.Material; seg?: number; rot?: V3; o?: OpcMat}> = ({p, r, h, c = '#cccccc', m, seg = 24, rot, o}) => (
	<group position={p} rotation={rot}>
		<mesh geometry={G.cil(seg)} material={m ?? mat(c, o)} position={[0, h / 2, 0]} scale={[r * 2, h, r * 2]} castShadow receiveShadow />
	</group>
);

const Esf: React.FC<{p: V3; r: number | V3; c?: string; m?: THREE.Material; seg?: number; o?: OpcMat}> = ({p, r, c = '#cccccc', m, seg = 24, o}) => (
	<mesh
		geometry={G.esfera(seg)}
		material={m ?? mat(c, o)}
		position={p}
		scale={typeof r === 'number' ? [r * 2, r * 2, r * 2] : [r[0] * 2, r[1] * 2, r[2] * 2]}
		castShadow
		receiveShadow
	/>
);

// ---------- texturas comunes ----------
const texLadrillo = () =>
	geoTex('ladrillo', () => {
		const t = lienzo(256, 256, (ctx) => {
			ctx.fillStyle = '#b9b9b6';
			ctx.fillRect(0, 0, 256, 256);
			ctx.strokeStyle = '#8f8f8c';
			ctx.lineWidth = 5;
			for (let fila = 0; fila < 8; fila++) {
				const y = fila * 32;
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(256, y);
				ctx.stroke();
				for (let k = 0; k < 4; k++) {
					const x = k * 64 + (fila % 2) * 32;
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x, y + 32);
					ctx.stroke();
				}
			}
		});
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		return t;
	});

const texPiso = () =>
	geoTex('piso', () => {
		const t = lienzo(256, 256, (ctx) => {
			ctx.fillStyle = '#e6e3dc';
			ctx.fillRect(0, 0, 256, 256);
			ctx.strokeStyle = '#c9c5bc';
			ctx.lineWidth = 4;
			for (let i = 0; i <= 4; i++) {
				ctx.beginPath();
				ctx.moveTo(i * 64, 0);
				ctx.lineTo(i * 64, 256);
				ctx.moveTo(0, i * 64);
				ctx.lineTo(256, i * 64);
				ctx.stroke();
			}
		});
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.repeat.set(3, 2);
		return t;
	});

const cacheTex = new Map<string, THREE.Texture>();
function geoTex(clave: string, crear: () => THREE.Texture) {
	let t = cacheTex.get(clave);
	if (!t) {
		t = crear();
		cacheTex.set(clave, t);
	}
	return t;
}

const matMapa = (clave: string, tex: () => THREE.Texture, o: {r?: number; color?: string} = {}) => {
	const k = `map|${clave}|${o.r ?? 0.85}|${o.color ?? '#ffffff'}`;
	let m = cacheMat.get(k);
	if (!m) {
		m = new THREE.MeshStandardMaterial({map: tex(), roughness: o.r ?? 0.85, color: o.color ?? '#ffffff'});
		cacheMat.set(k, m);
	}
	return m;
};

// ============================================================
// Luces (y cielo + niebla)
// ============================================================
export type LucesProps = {
	/** 0 = mediodía suave · 1 = atardecer cálido. */
	tarde?: number;
	/** Sombras proyectadas (necesita `shadows` en el ThreeCanvas). Por defecto true. */
	sombras?: boolean;
	/** Pinta el cielo en degradado y la niebla de distancia. Por defecto true. */
	cielo?: boolean;
};

const mezcla = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t));

export const Luces: React.FC<LucesProps> = ({tarde = 0, sombras = true, cielo = true}) => {
	const t = clamp01(tarde);
	const tq = Math.round(t * 20) / 20; // el cielo se rehace en pasos de 5 %
	const cieloTex = useTextura(`cielo${tq}`, () =>
		lienzo(16, 256, (ctx) => {
			const g = ctx.createLinearGradient(0, 0, 0, 256);
			g.addColorStop(0, `#${mezcla('#6fb2ea', '#5a6fb0', tq).getHexString()}`);
			g.addColorStop(0.6, `#${mezcla('#b8dcf6', '#f2a07a', tq).getHexString()}`);
			g.addColorStop(1, `#${mezcla('#e4f1f8', '#ffd7a0', tq).getHexString()}`);
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 16, 256);
		}),
	);
	const horizonte = mezcla('#dbe9ef', '#f4c39a', t);
	const sol = mezcla('#fff3e2', '#ffa25e', t);
	const alto = 12 - 8 * t;
	return (
		<>
			{cielo ? <primitive attach="background" object={cieloTex} /> : null}
			{cielo ? <fog attach="fog" args={[horizonte, 30, 85]} /> : null}
			<hemisphereLight args={[mezcla('#d6ebff', '#ffcfa8', t), mezcla('#a89878', '#8a5a48', t), 1.15 - 0.3 * t]} />
			<ambientLight intensity={0.25} color={mezcla('#ffffff', '#ffd2b0', t)} />
			<directionalLight
				position={[7 - 2 * t, alto, 8 - 3 * t]}
				intensity={2.3 - 0.6 * t}
				color={sol}
				castShadow={sombras}
				shadow-mapSize={[2048, 2048]}
				shadow-camera-left={-13}
				shadow-camera-right={13}
				shadow-camera-top={13}
				shadow-camera-bottom={-13}
				shadow-camera-near={1}
				shadow-camera-far={45}
				shadow-bias={-0.0006}
				shadow-normalBias={0.06}
				shadow-radius={4}
			/>
			{/* relleno frío desde atrás-izquierda para que las caras en sombra no queden planas */}
			<directionalLight position={[-8, 5, -4]} intensity={0.35} color={mezcla('#cfe2ff', '#b9a2d8', t)} />
		</>
	);
};

// ============================================================
// piezas de barrio
// ============================================================
/** Tinaco negro (≈0.62 de diámetro, 0.95 de alto) sobre su base. */
const Tinaco: React.FC<{p: V3; escala?: number}> = ({p, escala = 1}) => {
	const negro = mat('#1d1f22', {r: 0.42});
	return (
		<group position={p} scale={escala}>
			<Cil p={[0, 0, 0]} r={0.3} h={0.72} m={negro} seg={20} />
			{[0.18, 0.4].map((y) => (
				<mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={negro} castShadow>
					<torusGeometry args={[0.305, 0.018, 6, 20]} />
				</mesh>
			))}
			<mesh position={[0, 0.72, 0]} scale={[0.6, 0.34, 0.6]} geometry={G.esfera(20)} material={negro} castShadow />
			<Cil p={[0, 0.86, 0]} r={0.11} h={0.09} m={negro} seg={14} />
		</group>
	);
};

/** Ventana con marco azul en una fachada que mira a +Z (centro en p). */
const Ventana: React.FC<{p: V3; w?: number; h?: number; rotY?: number}> = ({p, w = 0.7, h = 0.75, rotY = 0}) => (
	<group position={p} rotation={[0, rotY, 0]}>
		<B p={[0, 0, 0.015]} s={[w + 0.1, h + 0.1, 0.05]} c="#2a5fc0" o={{r: 0.5}} sombra={false} />
		<B p={[0, 0, 0.03]} s={[w - 0.04, h - 0.04, 0.04]} c="#22324e" o={{r: 0.15, m: 0.2, cc: 1}} sombra={false} />
		<B p={[0, 0, 0.055]} s={[0.04, h - 0.04, 0.02]} c="#2a5fc0" sombra={false} />
	</group>
);

type CasaBarrio = {x: number; z: number; w: number; d: number; pisos: number; color: string; tinacos: number; varillas?: boolean; plantas?: boolean};

const ALTO_PISO = 1.45;

const CasaSimple: React.FC<{c: CasaBarrio; semilla: number}> = ({c, semilla}) => {
	const h = c.pisos * ALTO_PISO;
	const r = useMemo(() => rng(semilla), [semilla]);
	const extras = useMemo(() => {
		const out = {tx: [] as number[], tz: [] as number[], puerta: r() * 0.5 - 0.25, plantas: [] as {x: number; c: string}[]};
		for (let i = 0; i < c.tinacos; i++) {
			out.tx.push((i - (c.tinacos - 1) / 2) * 0.8 + (r() - 0.5) * 0.2);
			out.tz.push(-c.d / 2 + 0.6 + r() * 0.5);
		}
		const flores = ['#e84a5f', '#f6c445', '#ffffff'];
		for (let i = 0; i < 3; i++) out.plantas.push({x: -c.w / 2 + 0.3 + r() * (c.w - 0.6), c: flores[Math.floor(r() * 3)]});
		return out;
	}, [c, r]);
	const ventanas: V3[] = [];
	const cols = Math.max(1, Math.floor(c.w / 1.25));
	for (let piso = 0; piso < c.pisos; piso++) {
		for (let k = 0; k < cols; k++) {
			const x = (k - (cols - 1) / 2) * (c.w / cols);
			if (piso === 0 && k === 0 && cols > 1) continue; // ahí va la puerta
			ventanas.push([x, piso * ALTO_PISO + 0.85, c.d / 2]);
		}
	}
	const lateral: V3[] = [];
	for (let piso = 0; piso < c.pisos; piso++) lateral.push([c.x > 0 ? -c.w / 2 : c.w / 2, piso * ALTO_PISO + 0.85, 0]);
	const puertaX = cols > 1 ? (0 - (cols - 1) / 2) * (c.w / cols) : extras.puerta;
	return (
		<group position={[c.x, 0, c.z]}>
			{/* cuerpo */}
			<B p={[0, h / 2, 0]} s={[c.w, h, c.d]} c={c.color} />
			{/* banda de losa entre pisos */}
			{Array.from({length: c.pisos}, (_, i) => (
				<B key={i} p={[0, (i + 1) * ALTO_PISO - 0.06, 0]} s={[c.w + 0.06, 0.12, c.d + 0.06]} c="#d9d4ca" />
			))}
			{/* pretil */}
			<B p={[0, h + 0.12, c.d / 2 - 0.05]} s={[c.w + 0.06, 0.24, 0.1]} c={c.color} />
			<B p={[0, h + 0.12, -c.d / 2 + 0.05]} s={[c.w + 0.06, 0.24, 0.1]} c={c.color} />
			<B p={[-c.w / 2 + 0.05, h + 0.12, 0]} s={[0.1, 0.24, c.d]} c={c.color} />
			<B p={[c.w / 2 - 0.05, h + 0.12, 0]} s={[0.1, 0.24, c.d]} c={c.color} />
			<B p={[0, h + 0.005, 0]} s={[c.w - 0.1, 0.02, c.d - 0.1]} c="#c9563f" sombra={false} />
			{/* puerta */}
			<B p={[puertaX, 0.55, c.d / 2 + 0.02]} s={[0.55, 1.1, 0.05]} c="#7a4a2e" />
			{ventanas.map((v, i) => (
				<Ventana key={i} p={v} />
			))}
			{lateral.map((v, i) => (
				<Ventana key={`l${i}`} p={v} w={0.6} rotY={c.x > 0 ? -Math.PI / 2 : Math.PI / 2} />
			))}
			{/* tinacos sobre bloque */}
			{extras.tx.map((x, i) => (
				<group key={i}>
					<B p={[x, h + 0.15, extras.tz[i]]} s={[0.75, 0.3, 0.75]} m={matMapa('ladrillo', texLadrillo)} />
					<Tinaco p={[x, h + 0.3, extras.tz[i]]} />
				</group>
			))}
			{/* varillas de castillo (la casa "sigue creciendo") */}
			{c.varillas
				? [-1, 1].flatMap((sx) =>
						[-1, 1].map((sz) => (
							<group key={`${sx}${sz}`}>
								{[-0.05, 0.05].map((o) => (
									<Cil key={o} p={[sx * (c.w / 2 - 0.12) + o, h + 0.24, sz * (c.d / 2 - 0.12)]} r={0.012} h={0.7} c="#6d6458" o={{m: 0.4, r: 0.5}} seg={5} />
								))}
							</group>
						)),
					)
				: null}
			{/* macetas en la azotea */}
			{c.plantas
				? extras.plantas.map((pl, i) => (
						<group key={`p${i}`} position={[pl.x, h + 0.24, c.d / 2 - 0.08]}>
							<Cil p={[0, 0, 0]} r={0.07} h={0.11} c="#b5532e" seg={10} />
							<Esf p={[0, 0.16, 0]} r={0.09} c="#3e9a46" seg={8} o={{flat: true}} />
							<Esf p={[0.03, 0.22, 0.04]} r={0.03} c={pl.c} seg={6} />
						</group>
					))
				: null}
		</group>
	);
};

const Arbol: React.FC<{p: V3; s?: number; semilla?: number}> = ({p, s = 1, semilla = 1}) => {
	const bolas = useMemo(() => {
		const r = rng(semilla);
		return Array.from({length: 5}, (_, i) => {
			const a = (i / 5) * Math.PI * 2 + r();
			const d = i === 0 ? 0 : 0.45 + r() * 0.2;
			return {x: Math.cos(a) * d, z: Math.sin(a) * d, y: 1.7 + (i === 0 ? 0.45 : r() * 0.3), r: i === 0 ? 0.75 : 0.5 + r() * 0.2};
		});
	}, [semilla]);
	return (
		<group position={p} scale={s}>
			<Cil p={[0, 0, 0]} r={0.09} h={1.6} c="#7a5236" seg={7} />
			{bolas.map((b, i) => (
				<mesh key={i} position={[b.x, b.y, b.z]} scale={b.r} castShadow receiveShadow material={mat(i % 2 ? '#3f9c43' : '#4aab48', {flat: true, r: 0.85})}>
					<icosahedronGeometry args={[1, 1]} />
				</mesh>
			))}
		</group>
	);
};

const CASAS: CasaBarrio[] = [
	{x: -5.3, z: -0.4, w: 2.8, d: 4.6, pisos: 2, color: '#e85a8c', tinacos: 1, plantas: true},
	{x: -8.4, z: -0.8, w: 3.0, d: 4.2, pisos: 3, color: '#f2c53d', tinacos: 2},
	{x: 5.3, z: -0.4, w: 2.8, d: 4.6, pisos: 2, color: '#ec6a3c', tinacos: 1, varillas: true},
	{x: 8.4, z: -1.0, w: 3.0, d: 4.0, pisos: 1, color: '#45b3c4', tinacos: 1, plantas: true},
	{x: -2.7, z: -5.0, w: 3.0, d: 3.6, pisos: 2, color: '#f2883a', tinacos: 2},
	{x: 0.6, z: -5.3, w: 3.2, d: 3.6, pisos: 2, color: '#9c72cf', tinacos: 1, varillas: true},
	{x: 3.9, z: -5.0, w: 2.8, d: 3.6, pisos: 2, color: '#efe1c2', tinacos: 2, plantas: true},
	{x: -6.6, z: -6.2, w: 3.0, d: 3.6, pisos: 2, color: '#d94b3f', tinacos: 1},
	{x: 7.2, z: -6.4, w: 3.2, d: 3.6, pisos: 2, color: '#6fc06a', tinacos: 2},
	{x: -1.6, z: -9.6, w: 3.4, d: 3.0, pisos: 4, color: '#e86fa8', tinacos: 2},
	{x: 3.6, z: -9.9, w: 3.2, d: 3.0, pisos: 3, color: '#4d86d6', tinacos: 1},
	{x: -5.8, z: -10.6, w: 3.0, d: 3.0, pisos: 3, color: '#f5a623', tinacos: 2},
	{x: 8.6, z: -10.2, w: 3.0, d: 3.0, pisos: 2, color: '#ef7c3a', tinacos: 1},
];

/** Altura del terreno lejano (sube en lomas detrás del barrio). */
const alturaLoma = (x: number, z: number) => {
	const t = Math.max(0, -z - 14);
	if (t <= 0) return 0;
	const sube = Math.min(1, t / 8);
	return sube * (t * 0.32 + 1.3 * Math.sin(x * 0.11 + 0.6) + 0.8 * Math.sin(x * 0.27 + z * 0.09));
};

const PALETA_LEJOS = ['#e85a8c', '#f2c53d', '#ec6a3c', '#45b3c4', '#9c72cf', '#efe1c2', '#d94b3f', '#6fc06a', '#4d86d6', '#f5a623', '#ffffff', '#e86fa8'];

const Lejanias: React.FC = () => {
	const terreno = useMemo(() => {
		const g = new THREE.PlaneGeometry(180, 120, 90, 60);
		g.rotateX(-Math.PI / 2);
		g.translate(0, 0, -45);
		const pos = g.attributes.position;
		const col = new Float32Array(pos.count * 3);
		const verde = new THREE.Color('#8fbf5a');
		const seco = new THREE.Color('#b9b47a');
		const c = new THREE.Color();
		for (let i = 0; i < pos.count; i++) {
			const x = pos.getX(i);
			const z = pos.getZ(i);
			pos.setY(i, alturaLoma(x, z) - 0.02);
			const k = 0.5 + 0.5 * Math.sin(x * 0.35) * Math.cos(z * 0.3);
			c.copy(verde).lerp(seco, k * 0.6);
			col[i * 3] = c.r;
			col[i * 3 + 1] = c.g;
			col[i * 3 + 2] = c.b;
		}
		g.setAttribute('color', new THREE.BufferAttribute(col, 3));
		g.computeVertexNormals();
		return g;
	}, []);
	const matTerreno = useMemo(() => new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.95}), []);

	// casitas lejanas instanciadas (cubren las lomas como en las referencias)
	const {casas, tinacos} = useMemo(() => {
		const r = rng(77);
		const N = 260;
		const geoC = new THREE.BoxGeometry(1, 1, 1);
		geoC.translate(0, 0.5, 0);
		const casasI = new THREE.InstancedMesh(geoC, new THREE.MeshStandardMaterial({roughness: 0.85}), N);
		const geoT = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 10);
		geoT.translate(0, 0.4, 0);
		const tinI = new THREE.InstancedMesh(geoT, new THREE.MeshStandardMaterial({color: '#1d1f22', roughness: 0.5}), N);
		const m = new THREE.Matrix4();
		const q = new THREE.Quaternion();
		const col = new THREE.Color();
		let nt = 0;
		let n = 0;
		let intentos = 0;
		while (n < N && intentos < 4000) {
			intentos++;
			const x = (r() - 0.5) * 90;
			const z = -13 - r() * 34;
			if (z > -16 && Math.abs(x) < 12) continue;
			const w = 1.6 + r() * 1.6;
			const d = 1.6 + r() * 1.4;
			const h = 1.2 + Math.floor(r() * 3) * 1.2;
			const y = alturaLoma(x, z);
			q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * 0.25);
			m.compose(new THREE.Vector3(x, y - 0.3, z), q, new THREE.Vector3(w, h + 0.3, d));
			casasI.setMatrixAt(n, m);
			casasI.setColorAt(n, col.set(PALETA_LEJOS[Math.floor(r() * PALETA_LEJOS.length)]));
			n++;
			if (r() < 0.6 && nt < N) {
				m.compose(new THREE.Vector3(x + (r() - 0.5) * w * 0.5, y + h, z), q, new THREE.Vector3(1, 1, 1));
				tinI.setMatrixAt(nt++, m);
			}
		}
		casasI.count = n;
		tinI.count = nt;
		casasI.castShadow = false;
		casasI.receiveShadow = true;
		return {casas: casasI, tinacos: tinI};
	}, []);

	// cerros al fondo (aplanados; la niebla los aclara)
	const cerros = [
		{x: -40, z: -78, s: [42, 13, 18]},
		{x: 5, z: -88, s: [55, 16, 20]},
		{x: 48, z: -76, s: [40, 12, 18]},
		{x: -12, z: -70, s: [30, 8, 14]},
	];
	return (
		<group>
			<mesh geometry={terreno} material={matTerreno} receiveShadow />
			<primitive object={casas} />
			<primitive object={tinacos} />
			{cerros.map((c, i) => (
				<mesh key={i} position={[c.x, -1, c.z]} scale={c.s as V3} geometry={G.esfera(28)} material={mat(i % 2 ? '#7f9a6b' : '#8aa476', {r: 1})} />
			))}
		</group>
	);
};

export type BarrioProps = {
	/** 0..1. Solo tiñe el asfalto/terreno un poco; la luz cálida la da `<Luces tarde>`. */
	tarde?: number;
};

/**
 * Barrio mexicano de fondo. Calle a lo largo de X frente al escenario (z 4.2..7.8), banqueta
 * (z 3.2..4.2), ~13 casas de colores con tinacos, árboles y lomas con casitas al fondo.
 * Deja libre el escenario |x| < 3.5, -2 < z < 3 (ahí va p. ej. CasaCorte en el origen).
 * NO incluye luces: añade `<Luces tarde={…} />`.
 */
export const Barrio: React.FC<BarrioProps> = ({tarde = 0}) => {
	const t = clamp01(tarde);
	const rayas = Array.from({length: 14}, (_, i) => -26 + i * 4);
	return (
		<group>
			{/* lote del barrio (tierra/concreto claro) */}
			<B p={[0, -0.05, -6]} s={[34, 0.1, 22]} c={`#${mezcla('#d8cdb2', '#e0b998', t).getHexString()}`} sombra={false} />
			{/* banqueta y guarnición */}
			<B p={[0, 0.06, 3.7]} s={[60, 0.12, 1.0]} c="#cfcac0" />
			<B p={[0, 0.06, 4.22]} s={[60, 0.12, 0.08]} c="#e8c63b" />
			{/* calle */}
			<B p={[0, -0.02, 6.0]} s={[60, 0.04, 3.6]} c="#55565c" sombra={false} />
			{rayas.map((x) => (
				<B key={x} p={[x, 0.005, 6.0]} s={[1.6, 0.01, 0.12]} c="#f1e6c0" sombra={false} />
			))}
			<B p={[0, 0.06, 8.3]} s={[60, 0.12, 1.0]} c="#cfcac0" />
			{/* pasto del frente, más allá de la calle */}
			<B p={[0, -0.06, 14]} s={[60, 0.1, 10]} c="#8fbf5a" sombra={false} />
			{CASAS.map((c, i) => (
				<CasaSimple key={i} c={c} semilla={100 + i} />
			))}
			<Arbol p={[-3.9, 0, -2.6]} s={0.9} semilla={3} />
			<Arbol p={[2.6, 0, -3.3]} s={1.75} semilla={21} />
			<Arbol p={[2.2, 0, -7.7]} s={1.2} semilla={5} />
			<Arbol p={[-4.3, 0, -8.2]} s={1.0} semilla={8} />
			<Arbol p={[10.5, 0, -3.5]} s={1.1} semilla={11} />
			<Arbol p={[-11, 0, -4]} s={1.2} semilla={13} />
			<Arbol p={[6.4, 0, 2.6]} s={0.8} semilla={17} />
			<Lejanias />
		</group>
	);
};

// ============================================================
// CasaCorte
// ============================================================
/** Punto del mundo sobre la cubierta de la mesa de CasaCorte (escala 1, en el origen, sin girar). */
export const MESA_CASA: V3 = [-0.75, 1.0, 0.15];

export type CasaCorteProps = {position?: V3; rotationY?: number; escala?: number; color?: string};

/**
 * Casa de 2 pisos en corte (sin muro frontal). Medidas con escala 1:
 * ancho x ∈ [-2, 2], fondo z ∈ [-1.5, 1.5], losa de planta baja y ∈ [0, 0.2],
 * planta baja (sala) de y 0.2 a 2.2, entrepiso 2.2..2.4, recámara 2.4..4.4, azotea 4.4..4.6,
 * pretil hasta 4.85 y tinaco hasta ≈ 5.95. Mesa: cubierta a y = 1.0, centrada en (-0.75, 0.15),
 * 1.2 × 0.75 (ver MESA_CASA). Sillón a la derecha (x ≈ 1.1, z ≈ -0.95).
 */
export const CasaCorte: React.FC<CasaCorteProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, color = '#ef7a45'}) => {
	const W = 4;
	const D = 3;
	const e = 0.16; // grosor de muros
	const concreto = mat('#d7d3cb', {r: 0.9});
	const exterior = mat(color, {r: 0.85});
	const pisoM = matMapa('piso', texPiso, {r: 0.6});
	const interiorPB = mat('#eef3ea', {r: 0.9, e: '#eef3ea', ei: 0.22});
	const interiorPA = mat('#f6efe3', {r: 0.9, e: '#f6efe3', ei: 0.22});
	const azul = '#2f62c4';
	const madera = '#a8703f';
	const pisos = [
		{y0: 0.2, h: 2.0, interior: interiorPB},
		{y0: 2.4, h: 2.0, interior: interiorPA},
	];
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* losas (canto en concreto, cara superior con piso) */}
			{[0, 2.2, 4.4].map((y, i) => (
				<group key={y}>
					<B p={[0, y + 0.1, 0]} s={[W, 0.2, D]} m={concreto} />
					{i < 2 ? <B p={[0, y + 0.201, -0.0]} s={[W - 2 * e, 0.004, D - e]} m={pisoM} sombra={false} /> : null}
				</group>
			))}
			{/* azotea impermeabilizada (rojo terracota como en las referencias) */}
			<B p={[0, 4.602, 0]} s={[W - 0.02, 0.006, D - 0.02]} c="#c9533b" sombra={false} />
			{/* muros: trasero e laterales; exterior pintado, interior claro, cantos de concreto */}
			{pisos.map((pz, i) => (
				<group key={i}>
					{/* trasero */}
					<B p={[0, pz.y0 + pz.h / 2, -D / 2 + e / 2]} s={[W, pz.h, e]} m={concreto} />
					<B p={[0, pz.y0 + pz.h / 2, -D / 2 - 0.004]} s={[W + 0.01, pz.h + 0.2, 0.01]} m={exterior} sombra={false} />
					<B p={[0, pz.y0 + pz.h / 2, -D / 2 + e + 0.002]} s={[W - 2 * e, pz.h, 0.004]} m={pz.interior} sombra={false} />
					{/* laterales */}
					{[-1, 1].map((sx) => (
						<group key={sx}>
							<B p={[sx * (W / 2 - e / 2), pz.y0 + pz.h / 2, 0]} s={[e, pz.h, D]} m={concreto} />
							<B p={[sx * (W / 2 + 0.004), pz.y0 + pz.h / 2, 0]} s={[0.01, pz.h + 0.2, D + 0.01]} m={exterior} sombra={false} />
							<B p={[sx * (W / 2 - e - 0.002), pz.y0 + pz.h / 2, -e / 2]} s={[0.004, pz.h, D - e]} m={pz.interior} sombra={false} />
						</group>
					))}
					{/* franja azul en el muro del fondo (como los baños/cocinas de las referencias) */}
					<B p={[0, pz.y0 + 1.15, -D / 2 + e + 0.006]} s={[W - 2 * e, 0.07, 0.006]} c={azul} sombra={false} />
				</group>
			))}
			{/* pretil de la azotea */}
			<B p={[0, 4.72, -D / 2 + 0.06]} s={[W, 0.25, 0.12]} m={exterior} />
			{[-1, 1].map((sx) => (
				<B key={sx} p={[sx * (W / 2 - 0.06), 4.72, 0]} s={[0.12, 0.25, D]} m={exterior} />
			))}
			<B p={[0, 4.72, D / 2 - 0.06]} s={[W, 0.25, 0.12]} m={concreto} />
			{/* ventanas: fondo de cada piso y en el muro lateral derecho (se ven por fuera) */}
			<Ventana p={[0.9, 1.45, -D / 2 + e + 0.01]} w={0.9} h={0.8} />
			<Ventana p={[-1.0, 3.6, -D / 2 + e + 0.01]} w={0.9} h={0.8} />
			<Ventana p={[W / 2 + 0.01, 1.4, 0.2]} w={0.8} h={0.8} rotY={Math.PI / 2} />
			<Ventana p={[W / 2 + 0.01, 3.6, 0.2]} w={0.8} h={0.8} rotY={Math.PI / 2} />
			<Ventana p={[-W / 2 - 0.01, 3.6, 0.2]} w={0.8} h={0.8} rotY={-Math.PI / 2} />

			{/* ---------- planta baja: sala-comedor ---------- */}
			{/* tapete */}
			<B p={[-0.75, 0.207, 0.1]} s={[1.9, 0.01, 1.4]} c="#d2603f" sombra={false} />
			{/* mesa: cubierta 1.2 × 0.75, superficie a y = 1.0 */}
			<group position={[MESA_CASA[0], 0.2, MESA_CASA[2]]}>
				<mesh geometry={G.redonda(1.2, 0.06, 0.75, 0.02)} material={mat(madera, {r: 0.55})} position={[0, 0.77, 0]} castShadow receiveShadow />
				{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * 0.52, 0.37, sz * 0.3]} s={[0.06, 0.74, 0.06]} c="#7d4f2a" />))}
				{/* sillas */}
				{[-1, 1].map((sx) => (
					<group key={sx} position={[sx * 0.85, 0, 0]} rotation={[0, sx * Math.PI / 2, 0]}>
						<B p={[0, 0.45, 0]} s={[0.42, 0.05, 0.42]} c="#3b7fd0" />
						<B p={[0, 0.75, 0.19]} s={[0.42, 0.55, 0.05]} c="#3b7fd0" />
						{[-1, 1].flatMap((a) => [-1, 1].map((b) => <B key={`${a}${b}`} p={[a * 0.17, 0.22, b * 0.17]} s={[0.04, 0.44, 0.04]} c="#2a4f86" />))}
					</group>
				))}
			</group>
			{/* sillón */}
			<group position={[1.15, 0.2, -0.95]}>
				<mesh geometry={G.redonda(1.3, 0.42, 0.7, 0.08)} material={mat('#3aa18c', {r: 0.9})} position={[0, 0.25, 0]} castShadow receiveShadow />
				<mesh geometry={G.redonda(1.3, 0.55, 0.22, 0.08)} material={mat('#3aa18c', {r: 0.9})} position={[0, 0.6, -0.25]} castShadow receiveShadow />
				{[-1, 1].map((s) => (
					<mesh key={s} geometry={G.redonda(0.2, 0.55, 0.7, 0.07)} material={mat('#2f8a77', {r: 0.9})} position={[s * 0.6, 0.35, 0]} castShadow receiveShadow />
				))}
				<mesh geometry={G.redonda(0.32, 0.28, 0.12, 0.05)} material={mat('#f2c53d', {r: 0.9})} position={[-0.3, 0.6, -0.08]} rotation={[-0.2, 0.2, 0.1]} castShadow />
			</group>
			{/* lámpara de piso y planta */}
			<group position={[1.7, 0.2, 0.7]}>
				<Cil p={[0, 0, 0]} r={0.18} h={0.24} c="#c4643a" seg={12} />
				<Esf p={[0, 0.48, 0]} r={0.3} c="#3f9c43" seg={10} o={{flat: true}} />
				<Esf p={[0.12, 0.75, 0.05]} r={0.2} c="#4aab48" seg={10} o={{flat: true}} />
			</group>
			{/* foco */}
			<Cil p={[0, 2.08, 0]} r={0.012} h={0.12} c="#333333" seg={6} />
			<Esf p={[0, 2.05, 0]} r={0.06} c="#fff6d8" o={{e: '#fff1c0', ei: 0.8}} />

			{/* ---------- planta alta: recámara ---------- */}
			<group position={[-0.7, 2.4, -0.35]}>
				{/* cama */}
				<B p={[0, 0.17, 0]} s={[1.5, 0.34, 2.0]} c="#a8703f" />
				<mesh geometry={G.redonda(1.44, 0.18, 1.94, 0.06)} material={mat('#f4f1ea', {r: 0.95})} position={[0, 0.43, 0]} castShadow receiveShadow />
				<mesh geometry={G.redonda(1.48, 0.1, 1.25, 0.05)} material={mat('#2f62c4', {r: 0.95})} position={[0, 0.5, 0.36]} castShadow receiveShadow />
				{[-0.36, 0.36].map((x) => (
					<mesh key={x} geometry={G.redonda(0.55, 0.14, 0.32, 0.06)} material={mat('#ffffff', {r: 0.95})} position={[x, 0.58, -0.75]} castShadow />
				))}
				<B p={[0, 0.55, -1.0]} s={[1.5, 1.1, 0.08]} c="#8a5a33" />
			</group>
			{/* buró con lamparita */}
			<group position={[0.35, 2.4, -1.05]}>
				<B p={[0, 0.25, 0]} s={[0.45, 0.5, 0.4]} c="#c08a55" />
				<Cil p={[0, 0.5, 0]} r={0.05} h={0.2} c="#444444" seg={8} />
				<Cil p={[0, 0.66, 0]} r={0.12} h={0.16} c="#f6e3b0" seg={12} o={{e: '#ffe2a0', ei: 0.3}} />
			</group>
			{/* ropero */}
			<group position={[1.45, 2.4, -0.65]}>
				<B p={[0, 0.85, 0]} s={[0.75, 1.7, 0.6]} c="#d6a46c" />
				<B p={[-0.005, 0.85, 0.302]} s={[0.012, 1.6, 0.01]} c="#8a5a33" sombra={false} />
				{[-0.08, 0.08].map((x) => (
					<B key={x} p={[x, 0.9, 0.31]} s={[0.03, 0.18, 0.03]} c="#444444" sombra={false} />
				))}
			</group>
			{/* cuadrito */}
			<B p={[0.9, 3.55, -D / 2 + e + 0.02]} s={[0.5, 0.38, 0.03]} c="#f2c53d" sombra={false} />
			<B p={[0.9, 3.55, -D / 2 + e + 0.04]} s={[0.4, 0.28, 0.01]} c="#4d86d6" sombra={false} />

			{/* ---------- azotea: tinaco sobre base de block y tubería ---------- */}
			<B p={[0.9, 4.85, -0.6]} s={[0.95, 0.5, 0.95]} m={matMapa('ladrillo', texLadrillo)} />
			<Tinaco p={[0.9, 5.1, -0.6]} escala={1.05} />
			<Cil p={[1.55, 0.2, -1.25]} r={0.035} h={5.0} c="#e8e8e8" seg={8} />
			<B p={[1.25, 5.18, -0.75]} s={[0.6, 0.07, 0.07]} c="#e8e8e8" />
			<Cil p={[-1.7, 4.6, -1.2]} r={0.012} h={0.9} c="#6d6458" seg={5} />
			<Cil p={[-1.6, 4.6, -1.2]} r={0.012} h={0.9} c="#6d6458" seg={5} />
			{/* macetas en el pretil */}
			{[-1.4, -1.0].map((x, i) => (
				<group key={x} position={[x, 4.85, D / 2 - 0.08]}>
					<Cil p={[0, 0, 0]} r={0.08} h={0.12} c="#b5532e" seg={10} />
					<Esf p={[0, 0.17, 0]} r={0.1} c="#3e9a46" seg={8} o={{flat: true}} />
					<Esf p={[0.03, 0.24, 0.05]} r={0.035} c={i ? '#f6c445' : '#e84a5f'} seg={6} />
				</group>
			))}
		</group>
	);
};

// ============================================================
// Alcancía
// ============================================================
export type AlcanciaProps = {position?: V3; rotationY?: number; escala?: number; sacudida?: number};

/** Alcancía de cerámica rosa (≈0.45 de alto, 0.5 de largo en Z). La trompa mira a +Z. */
export const Alcancia: React.FC<AlcanciaProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, sacudida = 0}) => {
	const frame = useCurrentFrame();
	const s = clamp01(sacudida);
	const bamboleo = Math.sin(frame * 0.95) * 0.16 * s;
	const brinco = Math.abs(Math.sin(frame * 0.95)) * 0.035 * s;
	const ceramica = mat('#f28aa3', {r: 0.28, cc: 1});
	const oscuro = mat('#d86a86', {r: 0.35, cc: 0.6});
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<group position={[0, brinco, 0]} rotation={[0, 0, bamboleo]}>
				{/* cuerpo */}
				<Esf p={[0, 0.245, 0]} r={[0.205, 0.2, 0.255]} m={ceramica} seg={40} />
				{/* patas */}
				{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Cil key={`${sx}${sz}`} p={[sx * 0.1, 0, sz * 0.12]} r={0.05} h={0.08} m={ceramica} seg={16} />))}
				{/* trompa */}
				<group position={[0, 0.26, 0.235]} rotation={[Math.PI / 2, 0, 0]}>
					<mesh geometry={G.cil(24)} material={ceramica} scale={[0.13, 0.08, 0.11]} castShadow />
				</group>
				<Esf p={[-0.022, 0.262, 0.277]} r={[0.012, 0.016, 0.006]} c="#8c3550" seg={10} />
				<Esf p={[0.022, 0.262, 0.277]} r={[0.012, 0.016, 0.006]} c="#8c3550" seg={10} />
				{/* ojitos pintados */}
				<Esf p={[-0.075, 0.33, 0.2]} r={0.013} c="#2a1a20" seg={10} o={{r: 0.2}} />
				<Esf p={[0.075, 0.33, 0.2]} r={0.013} c="#2a1a20" seg={10} o={{r: 0.2}} />
				{/* orejas */}
				{[-1, 1].map((sx) => (
					<mesh key={sx} position={[sx * 0.105, 0.415, 0.1]} rotation={[0.5, 0, sx * -0.5]} scale={[1, 1, 0.45]} material={oscuro} castShadow>
						<coneGeometry args={[0.06, 0.08, 14]} />
					</mesh>
				))}
				{/* ranura para monedas */}
				<B p={[0, 0.438, -0.02]} s={[0.022, 0.012, 0.11]} c="#4a1d2b" sombra={false} rot={[-0.08, 0, 0]} />
				{/* colita */}
				<mesh position={[0, 0.28, -0.25]} rotation={[0, Math.PI / 2, 0]} material={ceramica}>
					<torusGeometry args={[0.025, 0.009, 8, 16, Math.PI * 1.6]} />
				</mesh>
			</group>
		</group>
	);
};

// ============================================================
// Billete genérico
// ============================================================
export type BilleteProps = {
	position?: V3;
	rotation?: V3;
	escala?: number;
	/** 0..1: encoge hasta 55 % y se desatura (inflación). */
	encoge?: number;
	valor?: string;
};

const dibujarBillete = (ctx: CanvasRenderingContext2D, valor: string, gris: boolean) => {
	const W = 512;
	const H = 240;
	if (gris) ctx.filter = 'grayscale(1) brightness(0.92)';
	const g = ctx.createLinearGradient(0, 0, W, H);
	g.addColorStop(0, '#7fd3b0');
	g.addColorStop(0.5, '#4fb79a');
	g.addColorStop(1, '#3e9c8a');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, W, H);
	// trama geométrica de líneas finas
	ctx.strokeStyle = 'rgba(255,255,255,0.18)';
	ctx.lineWidth = 2;
	for (let x = -H; x < W; x += 14) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x + H, H);
		ctx.stroke();
	}
	// marco
	ctx.strokeStyle = '#1f6b5c';
	ctx.lineWidth = 8;
	ctx.strokeRect(14, 14, W - 28, H - 28);
	ctx.lineWidth = 2;
	ctx.strokeRect(26, 26, W - 52, H - 52);
	// círculo concéntrico (no imita ningún billete real)
	ctx.strokeStyle = 'rgba(20,80,68,0.55)';
	for (let r = 18; r <= 70; r += 9) {
		ctx.beginPath();
		ctx.arc(120, H / 2, r, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.fillStyle = '#1f6b5c';
	ctx.beginPath();
	ctx.arc(120, H / 2, 14, 0, Math.PI * 2);
	ctx.fill();
	// rombos pequeños en esquinas
	for (const [x, y] of [
		[50, 50],
		[W - 50, 50],
		[50, H - 50],
		[W - 50, H - 50],
	]) {
		ctx.beginPath();
		ctx.moveTo(x, y - 12);
		ctx.lineTo(x + 12, y);
		ctx.lineTo(x, y + 12);
		ctx.lineTo(x - 12, y);
		ctx.closePath();
		ctx.fill();
	}
	// valor grande
	ctx.fillStyle = '#0f4a3f';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	let fs = 120;
	ctx.font = `900 ${fs}px sans-serif`;
	while (ctx.measureText(valor).width > 270 && fs > 40) {
		fs -= 6;
		ctx.font = `900 ${fs}px sans-serif`;
	}
	ctx.fillText(valor, 340, H / 2 + 6);
};

/** Billete genérico ≈ 0.7 × 0.33, curvado; plano en XY mirando a +Z, centrado en su posición. */
export const Billete: React.FC<BilleteProps> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1, encoge = 0, valor = '$100'}) => {
	const k = clamp01(encoge);
	const texColor = useTextura(`billete-c-${valor}`, () => lienzo(512, 240, (ctx) => dibujarBillete(ctx, valor, false)));
	const texGris = useTextura(`billete-g-${valor}`, () => lienzo(512, 240, (ctx) => dibujarBillete(ctx, valor, true)));
	const geometria = useMemo(() => {
		const g = new THREE.PlaneGeometry(0.7, 0.33, 24, 4);
		const p = g.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i);
			p.setZ(i, -1.1 * x * x + 0.02 * Math.sin(x * 9));
		}
		g.computeVertexNormals();
		return g;
	}, []);
	useEffect(() => () => geometria.dispose(), [geometria]);
	const matC = useMemo(() => new THREE.MeshStandardMaterial({map: texColor, roughness: 0.8, side: THREE.DoubleSide}), [texColor]);
	const matG = useMemo(
		() => new THREE.MeshStandardMaterial({map: texGris, roughness: 0.9, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: -2}),
		[texGris],
	);
	useEffect(() => () => matC.dispose(), [matC]);
	useEffect(() => () => matG.dispose(), [matG]);
	matG.opacity = suave(k);
	const s = escala * (1 - 0.45 * suave(k));
	return (
		<group position={position} rotation={rotation} scale={s}>
			<mesh geometry={geometria} material={matC} castShadow receiveShadow />
			{k > 0.001 ? <mesh geometry={geometria} material={matG} renderOrder={2} /> : null}
		</group>
	);
};

// ============================================================
// Tienda (anaquel de la tiendita)
// ============================================================
export type TiendaProps = {position?: V3; rotationY?: number; escala?: number; precio: string; resaltar?: number};

type Producto = {tipo: 'lata' | 'caja' | 'botella'; x: number; c: string; c2: string; h: number; w: number};

/**
 * Anaquel de tiendita (1.8 de ancho × ≈2.3 de alto con toldo × 0.55 de fondo) con latas, cajas y
 * botellas, y un letrero de precio grande arriba (texto de `precio`). `resaltar` 0..1 lo hace latir.
 */
export const Tienda: React.FC<TiendaProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, precio, resaltar = 0}) => {
	const frame = useCurrentFrame();
	const W = 1.8;
	const D = 0.55;
	const repisas = [0.12, 0.62, 1.12, 1.62];
	const productos = useMemo(() => {
		const r = rng(42);
		const colores = [
			['#d8312f', '#ffffff'],
			['#f2c53d', '#d8312f'],
			['#2f62c4', '#ffffff'],
			['#3aa14a', '#f2e6c0'],
			['#f07a2a', '#ffffff'],
			['#7b3fb5', '#f2c53d'],
		];
		return repisas.slice(0, 3).map((_, fila) => {
			const out: Producto[] = [];
			let x = -W / 2 + 0.1;
			while (x < W / 2 - 0.15) {
				const tipo = (['lata', 'caja', 'botella'] as const)[(fila + Math.floor(r() * 3)) % 3];
				const [c, c2] = colores[Math.floor(r() * colores.length)];
				const w = tipo === 'caja' ? 0.22 + r() * 0.08 : tipo === 'lata' ? 0.12 : 0.1;
				const h = tipo === 'caja' ? 0.3 + r() * 0.1 : tipo === 'lata' ? 0.18 : 0.34;
				const n = tipo === 'caja' ? 1 : 2;
				for (let i = 0; i < n && x + w < W / 2 - 0.05; i++) {
					out.push({tipo, x: x + w / 2, c, c2, h, w});
					x += w + 0.025;
				}
				x += 0.03;
			}
			return out;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
	const texPrecio = useTextura(`precio-${precio}`, () =>
		lienzo(512, 288, (ctx) => {
			ctx.fillStyle = '#ffd43b';
			ctx.beginPath();
			ctx.roundRect(8, 8, 496, 272, 36);
			ctx.fill();
			ctx.lineWidth = 14;
			ctx.strokeStyle = '#d8312f';
			ctx.stroke();
			ctx.fillStyle = '#1b1b1b';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			let fs = 170;
			ctx.font = `900 ${fs}px sans-serif`;
			while (ctx.measureText(precio).width > 440 && fs > 40) {
				fs -= 6;
				ctx.font = `900 ${fs}px sans-serif`;
			}
			ctx.fillText(precio, 256, 152);
		}),
	);
	const matPrecio = useMemo(() => new THREE.MeshStandardMaterial({map: texPrecio, roughness: 0.6}), [texPrecio]);
	useEffect(() => () => matPrecio.dispose(), [matPrecio]);
	const rz = clamp01(resaltar);
	const pulso = 1 + rz * (0.12 + 0.06 * Math.sin(frame * 0.4));
	matPrecio.emissive.set('#ffe680');
	matPrecio.emissiveMap = texPrecio;
	matPrecio.emissiveIntensity = 0.35 * rz;
	const metal = mat('#e9e9ea', {r: 0.4, m: 0.3});
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* postes */}
			{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (W / 2 - 0.02), 0.95, sz * (D / 2 - 0.02)]} s={[0.04, 1.9, 0.04]} m={metal} />))}
			{/* fondo */}
			<B p={[0, 0.95, -D / 2 + 0.01]} s={[W, 1.9, 0.02]} c="#f4efe4" />
			{/* repisas con borde rojo */}
			{repisas.map((y) => (
				<group key={y}>
					<B p={[0, y, 0]} s={[W, 0.04, D]} m={metal} />
					<B p={[0, y - 0.01, D / 2 - 0.01]} s={[W, 0.07, 0.02]} c="#d8312f" />
				</group>
			))}
			{/* productos */}
			{productos.map((fila, i) =>
				fila.map((pr, j) => {
					const y = repisas[i] + 0.02;
					const z = 0.02;
					if (pr.tipo === 'lata')
						return (
							<group key={`${i}-${j}`} position={[pr.x, y, z]}>
								<Cil p={[0, 0, 0]} r={pr.w / 2} h={pr.h} c={pr.c} seg={18} o={{r: 0.35, m: 0.3}} />
								<Cil p={[0, pr.h * 0.35, 0]} r={pr.w / 2 + 0.002} h={pr.h * 0.3} c={pr.c2} seg={18} o={{r: 0.4}} />
								<Cil p={[0, pr.h, 0]} r={pr.w / 2 - 0.006} h={0.008} c="#cfd2d6" seg={18} o={{r: 0.3, m: 0.7}} />
							</group>
						);
					if (pr.tipo === 'botella')
						return (
							<group key={`${i}-${j}`} position={[pr.x, y, z]}>
								<Cil p={[0, 0, 0]} r={pr.w / 2} h={pr.h * 0.62} c={pr.c} seg={16} o={{r: 0.15, cc: 1}} />
								<mesh position={[0, pr.h * 0.7, 0]} scale={[pr.w, pr.h * 0.18, pr.w]} geometry={G.esfera(16)} material={mat(pr.c, {r: 0.15, cc: 1})} castShadow />
								<Cil p={[0, pr.h * 0.7, 0]} r={pr.w * 0.18} h={pr.h * 0.25} c={pr.c} seg={10} o={{r: 0.15, cc: 1}} />
								<Cil p={[0, pr.h * 0.94, 0]} r={pr.w * 0.2} h={0.03} c={pr.c2} seg={10} />
								<Cil p={[0, pr.h * 0.2, 0]} r={pr.w / 2 + 0.003} h={pr.h * 0.22} c={pr.c2} seg={16} />
							</group>
						);
					return (
						<group key={`${i}-${j}`} position={[pr.x, y, z]}>
							<mesh geometry={G.redonda(pr.w, pr.h, 0.16, 0.012, 2)} material={mat(pr.c, {r: 0.6})} position={[0, pr.h / 2, 0]} castShadow receiveShadow />
							<B p={[0, pr.h * 0.55, 0.081]} s={[pr.w * 0.8, pr.h * 0.35, 0.004]} c={pr.c2} sombra={false} />
						</group>
					);
				}),
			)}
			{/* toldo a rayas */}
			<group position={[0, 2.0, D / 2 + 0.08]} rotation={[0.45, 0, 0]}>
				{Array.from({length: 8}, (_, i) => (
					<B key={i} p={[-W / 2 - 0.05 + (i + 0.5) * ((W + 0.1) / 8), 0, 0]} s={[(W + 0.1) / 8, 0.03, 0.5]} c={i % 2 ? '#ffffff' : '#d8312f'} />
				))}
			</group>
			<B p={[0, 1.92, 0]} s={[W + 0.04, 0.06, D]} m={metal} />
			{/* letrero de precio */}
			<group position={[0, 2.62, 0.15]} scale={pulso}>
				<B p={[0, -0.35, -0.03]} s={[0.04, 0.4, 0.04]} m={metal} />
				<mesh geometry={G.redonda(1.0, 0.56, 0.05, 0.03)} material={mat('#c8262a', {r: 0.5})} castShadow />
				<mesh position={[0, 0, 0.027]} material={matPrecio}>
					<planeGeometry args={[0.96, 0.54]} />
				</mesh>
			</group>
		</group>
	);
};

// ============================================================
// Grafica3D
// ============================================================
export type Grafica3DProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	valores: number[];
	/** 0..1: las barras crecen de izquierda a derecha. Por defecto 1. */
	progreso?: number;
	etiquetas?: string[];
	color?: string;
};

const Etiqueta: React.FC<{texto: string; p: V3; w: number}> = ({texto, p, w}) => {
	const tex = useTextura(`etq-${texto}`, () =>
		lienzo(256, 96, (ctx) => {
			ctx.fillStyle = '#1b1b1b';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			let fs = 64;
			ctx.font = `800 ${fs}px sans-serif`;
			while (ctx.measureText(texto).width > 240 && fs > 20) {
				fs -= 4;
				ctx.font = `800 ${fs}px sans-serif`;
			}
			ctx.fillText(texto, 128, 50);
		}),
	);
	const m = useMemo(() => new THREE.MeshBasicMaterial({map: tex, transparent: true, toneMapped: false}), [tex]);
	useEffect(() => () => m.dispose(), [m]);
	return (
		<mesh position={p} material={m}>
			<planeGeometry args={[w, w * 0.375]} />
		</mesh>
	);
};

/**
 * Gráfica de barras sobre una base blanca. Barras de 0.34 de ancho cada 0.5; la más alta mide 2.2.
 * Base: ancho = n·0.5 + 0.3, fondo 0.8, alto 0.14, centrada en el origen. Etiquetas en el canto frontal.
 */
export const Grafica3D: React.FC<Grafica3DProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, valores, progreso = 1, etiquetas, color = '#2fbf71'}) => {
	const n = Math.max(1, valores.length);
	const max = Math.max(1e-6, ...valores.map((v) => Math.abs(v)));
	const paso = 0.5;
	const anchoBase = n * paso + 0.3;
	const p = clamp01(progreso);
	const cTope = `#${new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.25).getHexString()}`;
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<mesh geometry={G.redonda(anchoBase, 0.14, 0.8, 0.04)} material={mat('#f5f3ee', {r: 0.6})} position={[0, 0.07, 0]} castShadow receiveShadow />
			{valores.map((v, i) => {
				const ti = suave(p * n - i * 0.85);
				const h = Math.max(0.001, (Math.abs(v) / max) * 2.2 * ti);
				const x = (i - (n - 1) / 2) * paso;
				return (
					<group key={i} position={[x, 0.14, 0]}>
						<mesh position={[0, h / 2, 0]} scale={[0.34, h, 0.34]} geometry={G.caja()} material={mat(color, {r: 0.45})} castShadow receiveShadow />
						<mesh position={[0, h + 0.005, 0]} scale={[0.34, 0.01, 0.34]} geometry={G.caja()} material={mat(cTope, {r: 0.4})} />
						{etiquetas?.[i] ? <Etiqueta texto={etiquetas[i]} p={[0, -0.07, 0.402]} w={0.46} /> : null}
					</group>
				);
			})}
		</group>
	);
};

// ============================================================
// CajaFuerte
// ============================================================
export type CajaFuerteProps = {position?: V3; rotationY?: number; escala?: number; abierta?: number};

/** Caja fuerte 1.0 × 1.2 × 0.9 (origen en la base). Bisagra en el canto frontal izquierdo; `abierta` 0..1 abre ~110°. */
export const CajaFuerte: React.FC<CajaFuerteProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, abierta = 0}) => {
	const W = 1.0;
	const H = 1.2;
	const D = 0.9;
	const e = 0.08;
	const acero = mat('#5f6f80', {r: 0.38, m: 0.25});
	const aceroClaro = mat('#8593a3', {r: 0.32, m: 0.3});
	const interior = mat('#3a4552', {r: 0.7, m: 0.1});
	const dorado = mat('#d9a93b', {r: 0.3, m: 0.85});
	const ang = -suave(abierta) * 1.95;
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			{/* patas */}
			{[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} p={[sx * (W / 2 - 0.1), 0.03, sz * (D / 2 - 0.1)]} s={[0.12, 0.06, 0.12]} c="#22272e" />))}
			<group position={[0, 0.06, 0]}>
				{/* cascarón */}
				<B p={[0, e / 2, 0]} s={[W, e, D]} m={acero} />
				<B p={[0, H - e / 2, 0]} s={[W, e, D]} m={acero} />
				<B p={[-W / 2 + e / 2, H / 2, 0]} s={[e, H, D]} m={acero} />
				<B p={[W / 2 - e / 2, H / 2, 0]} s={[e, H, D]} m={acero} />
				<B p={[0, H / 2, -D / 2 + e / 2]} s={[W, H, e]} m={acero} />
				{/* interior oscuro y repisa */}
				<B p={[0, H / 2, -D / 2 + e + 0.002]} s={[W - 2 * e, H - 2 * e, 0.004]} m={interior} sombra={false} />
				<B p={[0, H * 0.52, 0]} s={[W - 2 * e, 0.03, D - e - 0.04]} m={aceroClaro} />
				{/* contenido: monedas y fajos */}
				<TorreMonedas position={[-0.22, e, 0.05]} cantidad={7} escala={0.42} />
				<TorreMonedas position={[-0.05, e, -0.12]} cantidad={4} escala={0.42} />
				{[0, 1, 2].map((i) => (
					<group key={i} position={[0.18, e + 0.045 + i * 0.09, 0.02]} rotation={[0, (i - 1) * 0.12, 0]}>
						<B p={[0, 0, 0]} s={[0.34, 0.085, 0.18]} c="#4fb79a" o={{r: 0.85}} />
						<B p={[0, 0, 0]} s={[0.07, 0.088, 0.183]} c="#f4efe4" sombra={false} />
					</group>
				))}
				{[0, 1].map((i) => (
					<group key={`a${i}`} position={[-0.12 + i * 0.26, H * 0.52 + 0.06, 0.02]} rotation={[0, (i - 0.5) * 0.3, 0]}>
						<B p={[0, 0, 0]} s={[0.34, 0.085, 0.18]} c="#4fb79a" o={{r: 0.85}} />
						<B p={[0, 0, 0]} s={[0.07, 0.088, 0.183]} c="#f4efe4" sombra={false} />
					</group>
				))}
				<mesh position={[0.2, H * 0.52 + 0.1, -0.2]} geometry={G.redonda(0.26, 0.12, 0.12, 0.02)} material={dorado} castShadow />
				{/* puerta con bisagra en x = -W/2, z = D/2 */}
				<group position={[-W / 2, H / 2, D / 2]} rotation={[0, ang, 0]}>
					<group position={[W / 2, 0, 0.05]}>
						<mesh geometry={G.redonda(W, H, 0.1, 0.03)} material={acero} castShadow receiveShadow />
						<mesh geometry={G.redonda(W - 0.16, H - 0.16, 0.02, 0.02)} material={aceroClaro} position={[0, 0, 0.055]} castShadow />
						{/* disco de la combinación */}
						<group position={[0.12, 0.18, 0.07]} rotation={[Math.PI / 2, 0, 0]}>
							<mesh geometry={G.cil(32)} material={mat('#d5dae1', {r: 0.25, m: 0.4})} scale={[0.24, 0.04, 0.24]} castShadow />
							<mesh geometry={G.cil(24)} material={mat('#2a2f36', {r: 0.4, m: 0.4})} position={[0, 0.025, 0]} scale={[0.1, 0.02, 0.1]} />
						</group>
						{/* manija de 3 rayos */}
						<group position={[0.12, -0.2, 0.08]}>
							<mesh geometry={G.cil(16)} material={mat('#d5dae1', {r: 0.25, m: 0.4})} rotation={[Math.PI / 2, 0, 0]} scale={[0.07, 0.06, 0.07]} castShadow />
							{[0, 1, 2].map((k) => (
								<group key={k} rotation={[0, 0, (k * Math.PI * 2) / 3 + 0.3]}>
									<B p={[0, 0.09, 0.02]} s={[0.025, 0.18, 0.025]} m={mat('#d5dae1', {r: 0.25, m: 0.4})} />
									<Esf p={[0, 0.18, 0.02]} r={0.022} m={mat('#d5dae1', {r: 0.25, m: 0.4})} seg={10} />
								</group>
							))}
						</group>
						{/* bisagras */}
						{[-0.38, 0.38].map((y) => (
							<Cil key={y} p={[-W / 2 + 0.01, y - 0.09, -0.04]} r={0.03} h={0.18} m={aceroClaro} seg={10} />
						))}
						{/* pernos (cara interior) */}
						{[-0.3, 0, 0.3].map((y) => (
							<group key={y} position={[W / 2 - 0.06, y, -0.07]} rotation={[0, 0, Math.PI / 2]}>
								<mesh geometry={G.cil(10)} material={aceroClaro} scale={[0.05, 0.08, 0.05]} />
							</group>
						))}
					</group>
				</group>
			</group>
		</group>
	);
};

// ============================================================
// Persona
// ============================================================
export type PersonaProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	caminando?: boolean;
	/** 0..1: sube el brazo derecho apuntando al frente (+Z). */
	senala?: number;
	/** 0..1: los dos brazos arriba. */
	celebra?: number;
	/** Desfase del ciclo de caminar (radianes). */
	fase?: number;
	colorPlayera?: string;
	colorGorra?: string;
};

/** Persona de bloques ≈ 1.72 de alto (con gorra), mira a +Z. Hombros a y ≈ 1.36. */
export const Persona: React.FC<PersonaProps> = ({
	position = [0, 0, 0],
	rotationY = 0,
	escala = 1,
	caminando = false,
	senala = 0,
	celebra = 0,
	fase = 0,
	colorPlayera = '#f07a2a',
	colorGorra = '#2f62c4',
}) => {
	const frame = useCurrentFrame();
	const ph = caminando ? (frame / 30) * Math.PI * 2 * 1.7 + fase : 0;
	const paso = caminando ? Math.sin(ph) : 0;
	const rebote = caminando ? Math.abs(Math.cos(ph)) * 0.04 : Math.sin(frame * 0.08 + fase) * 0.006;
	const sn = suave(senala);
	const ce = suave(celebra);
	const piel = mat('#c98a5e', {r: 0.65});
	const playera = mat(colorPlayera, {r: 0.85});
	const mezclilla = mat('#3c5f9c', {r: 0.9});
	const zapato = mat('#2b2522', {r: 0.6});
	const gorra = mat(colorGorra, {r: 0.7});
	const ojo = mat('#1a1414', {r: 0.3});
	const brinco = ce * Math.max(0, Math.sin(frame * 0.35)) * 0.06;
	// brazos: rotación en X (balanceo / señalar) y en Z (celebrar)
	const brazoDerX = paso * 0.55 * (1 - sn) * (1 - ce) - sn * 1.5;
	const brazoIzqX = -paso * 0.55 * (1 - ce);
	const celebraZ = ce * (2.65 + Math.sin(frame * 0.35) * 0.12);
	const pierna = (lado: number, giro: number) => (
		<group key={`p${lado}`} position={[lado * 0.115, 0.84, 0]} rotation={[giro, 0, 0]}>
			<mesh geometry={G.redonda(0.19, 0.78, 0.22, 0.05)} material={mezclilla} position={[0, -0.39, 0]} castShadow receiveShadow />
			<mesh geometry={G.redonda(0.2, 0.1, 0.32, 0.04)} material={zapato} position={[0, -0.8, 0.045]} castShadow />
		</group>
	);
	const brazo = (lado: number, rx: number, rz: number) => (
		<group key={`b${lado}`} position={[lado * 0.31, 1.36, 0]} rotation={[rx, 0, rz]}>
			<mesh geometry={G.redonda(0.14, 0.3, 0.16, 0.05)} material={playera} position={[0, -0.12, 0]} castShadow />
			<mesh geometry={G.redonda(0.115, 0.34, 0.12, 0.05)} material={piel} position={[0, -0.4, 0]} castShadow />
			<Esf p={[0, -0.6, 0]} r={0.062} m={piel} seg={14} />
		</group>
	);
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<group position={[0, rebote + brinco, 0]}>
				{pierna(1, paso * 0.5)}
				{pierna(-1, -paso * 0.5)}
				{/* cadera y cinturón */}
				<mesh geometry={G.redonda(0.46, 0.16, 0.26, 0.05)} material={mezclilla} position={[0, 0.86, 0]} castShadow />
				<B p={[0, 0.95, 0]} s={[0.47, 0.04, 0.27]} c="#4a3426" />
				{/* torso */}
				<mesh geometry={G.redonda(0.5, 0.48, 0.28, 0.08)} material={playera} position={[0, 1.18, 0]} rotation={[caminando ? 0.05 : 0, 0, 0]} castShadow receiveShadow />
				{/* cuello y cabeza */}
				<Cil p={[0, 1.38, 0]} r={0.06} h={0.08} m={piel} seg={12} />
				<Esf p={[0, 1.56, 0]} r={[0.165, 0.172, 0.16]} m={piel} seg={28} />
				<Esf p={[-0.06, 1.575, 0.15]} r={[0.018, 0.024, 0.01]} m={ojo} seg={10} />
				<Esf p={[0.06, 1.575, 0.15]} r={[0.018, 0.024, 0.01]} m={ojo} seg={10} />
				<Esf p={[0, 1.53, 0.163]} r={[0.022, 0.026, 0.022]} m={piel} seg={10} />
				<Esf p={[-0.165, 1.55, 0]} r={[0.025, 0.04, 0.03]} m={piel} seg={8} />
				<Esf p={[0.165, 1.55, 0]} r={[0.025, 0.04, 0.03]} m={piel} seg={8} />
				{/* pelo bajo la gorra */}
				<Esf p={[0, 1.58, -0.025]} r={[0.168, 0.15, 0.165]} c="#2a1d16" seg={20} />
				{/* gorra */}
				<group position={[0, 1.62, 0]}>
					<mesh scale={[0.176, 0.135, 0.174]} castShadow material={gorra}>
						<sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
					</mesh>
					<mesh position={[0, 0.005, 0.17]} rotation={[0.1, 0, 0]} scale={[0.3, 0.014, 0.24]} geometry={G.cil(20)} material={gorra} castShadow />
					<Esf p={[0, 0.13, 0]} r={0.018} m={gorra} seg={8} />
				</group>
				{brazo(-1, brazoDerX * (1 - ce), -celebraZ)}
				{brazo(1, brazoIzqX, celebraZ)}
			</group>
		</group>
	);
};
