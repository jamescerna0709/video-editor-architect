// Modelos 3D de caricatura para el borrador de finanzas (cerdito, inflación, monedas…).
// Todo sale de primitivas de three.js y texturas dibujadas en canvas: no hay archivos externos.
// Animación 100 % determinista: todo depende de useCurrentFrame() (nada de useFrame ni Math.random).
// Convención: el origen de cada modelo está en su base (y = 0) y mira hacia +Z.
import {useEffect, useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';

type V3 = [number, number, number];

// ---------- utilidades ----------
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** PRNG con semilla (mulberry32): mismo layout en cada frame y en cada render. */
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

const mezclar = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t));

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

/** Sombra suave bajo los pies (disco radial transparente). */
const useTexturaSombra = () =>
	useMemo(
		() =>
			lienzo(128, 128, (ctx) => {
				const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
				g.addColorStop(0, 'rgba(0,0,0,0.42)');
				g.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.fillStyle = g;
				ctx.fillRect(0, 0, 128, 128);
			}),
		[],
	);

const Sombra: React.FC<{radio: number; opacidad?: number}> = ({radio, opacidad = 1}) => {
	const tex = useTexturaSombra();
	return (
		<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} renderOrder={1}>
			<planeGeometry args={[radio * 2, radio * 2]} />
			<meshBasicMaterial map={tex} transparent depthWrite={false} opacity={opacidad} />
		</mesh>
	);
};

// ---------- ojo de caricatura ----------
type OjoProps = {
	position: V3;
	radio: number;
	mirarX?: number;
	mirarY?: number;
	pupila?: number; // escala de la pupila (1 = normal)
	parpado?: number; // 1 abierto · 0.1 cerrado
	blanco?: string;
	rotY?: number;
};

const Ojo: React.FC<OjoProps> = ({position, radio, mirarX = 0, mirarY = 0, pupila = 1, parpado = 1, blanco = '#ffffff', rotY = 0}) => {
	const rp = radio * 0.52 * pupila;
	const px = mirarX * radio * 0.32;
	const py = mirarY * radio * 0.25 - radio * 0.05;
	const pz = Math.sqrt(Math.max(0, radio * radio - px * px - py * py)) - rp * 0.22;
	return (
		<group position={position} rotation={[0, rotY, 0]} scale={[1, parpado, 1]}>
			<mesh>
				<sphereGeometry args={[radio, 24, 18]} />
				<meshPhysicalMaterial color={blanco} roughness={0.2} clearcoat={0.6} />
			</mesh>
			<mesh position={[px, py, pz]} scale={[1, 1.1, 0.55]}>
				<sphereGeometry args={[rp, 18, 14]} />
				<meshStandardMaterial color="#151018" roughness={0.25} />
			</mesh>
			<mesh position={[px + rp * 0.4, py + rp * 0.45, pz + rp * 0.45]}>
				<sphereGeometry args={[rp * 0.32, 10, 8]} />
				<meshBasicMaterial color="#ffffff" />
			</mesh>
		</group>
	);
};

// ============================================================
// 1. Cerdito (héroe)
// ============================================================
export type Animo = 'feliz' | 'triste' | 'sorprendido' | 'decidido';

export type CerditoProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	animo?: Animo;
	caminando?: boolean;
	salto?: number;
	brazosArriba?: number;
	mirarX?: number;
	fase?: number;
};

const ROSA = '#ff9ec4';
const ROSA_OSCURO = '#f0729f';
const ROSA_HOCICO = '#ffb6d3';
const PEZUNA = '#9b4a6b';

// centro y radio del cuerpo-cabeza (cerdito alcancía: una sola bola)
const CY = 0.86;
const CR = 0.6;
/** Punto sobre la superficie del cuerpo dados x, y (frente +Z). */
const sobreCuerpo = (x: number, y: number, extra = 0): V3 => {
	const dy = y - CY;
	const z = Math.sqrt(Math.max(0, CR * CR - x * x - dy * dy));
	return [x, y, z + extra];
};

const Boca: React.FC<{animo: Animo; color?: string}> = ({animo, color = '#5a1f35'}) => {
	const mat = <meshStandardMaterial color={color} roughness={0.4} />;
	if (animo === 'sorprendido') {
		return (
			<group>
				<mesh scale={[1, 1.25, 0.5]}>
					<sphereGeometry args={[0.07, 16, 12]} />
					{mat}
				</mesh>
				<mesh position={[0, -0.025, 0.02]} scale={[1, 0.6, 0.4]}>
					<sphereGeometry args={[0.04, 12, 8]} />
					<meshStandardMaterial color="#ff6f91" roughness={0.4} />
				</mesh>
			</group>
		);
	}
	if (animo === 'triste') {
		// arco hacia arriba (ceño): la mitad superior del toro
		return (
			<mesh position={[0, -0.04, 0]}>
				<torusGeometry args={[0.09, 0.018, 8, 20, Math.PI]} />
				{mat}
			</mesh>
		);
	}
	if (animo === 'decidido') {
		// media sonrisa ladeada
		return (
			<mesh rotation={[0, 0, Math.PI + 0.5]} position={[0.03, 0.015, 0]}>
				<torusGeometry args={[0.09, 0.018, 8, 20, Math.PI * 0.75]} />
				{mat}
			</mesh>
		);
	}
	// feliz: sonrisa abierta (media luna oscura + lengua)
	return (
		<group>
			<mesh rotation={[0, 0, Math.PI]} position={[0, 0.03, 0]}>
				<torusGeometry args={[0.1, 0.02, 8, 24, Math.PI]} />
				{mat}
			</mesh>
			<mesh rotation={[0, 0, Math.PI]} position={[0, 0.03, -0.005]} scale={[1, 1, 0.3]}>
				<circleGeometry args={[0.1, 20, 0, Math.PI]} />
				<meshStandardMaterial color="#7a2440" roughness={0.5} side={THREE.DoubleSide} />
			</mesh>
			<mesh position={[0, -0.04, 0.01]} scale={[1, 0.55, 0.35]}>
				<sphereGeometry args={[0.05, 12, 8]} />
				<meshStandardMaterial color="#ff6f91" roughness={0.4} />
			</mesh>
		</group>
	);
};

export const Cerdito: React.FC<CerditoProps> = ({
	position = [0, 0, 0],
	rotationY = 0,
	escala = 1,
	animo = 'feliz',
	caminando = false,
	salto = 0,
	brazosArriba = 0,
	mirarX = 0,
	fase = 0,
}) => {
	const frame = useCurrentFrame();
	const f = frame + fase;
	const s = clamp01(salto);
	const arriba = clamp01(brazosArriba);

	const materiales = useMemo(
		() => ({
			piel: new THREE.MeshPhysicalMaterial({color: ROSA, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3}),
			oscuro: new THREE.MeshStandardMaterial({color: ROSA_OSCURO, roughness: 0.42}),
			hocico: new THREE.MeshPhysicalMaterial({color: ROSA_HOCICO, roughness: 0.35, clearcoat: 0.4}),
			pezuna: new THREE.MeshStandardMaterial({color: PEZUNA, roughness: 0.45}),
			cachete: new THREE.MeshStandardMaterial({color: '#ff6f9a', roughness: 0.6, transparent: true, opacity: 0.6}),
			ranura: new THREE.MeshStandardMaterial({color: '#3a1424', roughness: 0.6}),
		}),
		[],
	);

	const geoCola = useMemo(() => {
		const pts: THREE.Vector3[] = [];
		for (let i = 0; i <= 40; i++) {
			const t = i / 40;
			const a = t * Math.PI * 3.2;
			const r = 0.07 * (1 - t * 0.45);
			pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r + t * 0.04, -t * 0.16));
		}
		return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.022, 8, false);
	}, []);

	// idle: respiración + parpadeo cada ~3 s
	const respira = Math.sin(f * 0.11) * 0.018;
	const ciclo = ((f % 92) + 92) % 92;
	const parpado = ciclo < 3 ? 0.12 : ciclo < 5 ? 0.5 : 1;

	// caminar
	const paso = caminando ? Math.sin(f * 0.42) : 0;
	const bob = caminando ? Math.abs(Math.sin(f * 0.42)) * 0.07 : 0;
	const rollo = caminando ? paso * 0.06 : 0;

	// salto: sube y se estira
	const alto = s * 0.9 + bob;
	const estira = 1 + s * 0.14 + respira;
	const ancho = 1 / Math.sqrt(1 + s * 0.14);

	// expresión
	const ex = {
		feliz: {cejaRot: -0.12, cejaY: 0, pupila: 1, ojoY: 0},
		triste: {cejaRot: -0.45, cejaY: -0.01, pupila: 1.05, ojoY: -0.3},
		sorprendido: {cejaRot: 0.05, cejaY: 0.07, pupila: 1.25, ojoY: 0.1},
		decidido: {cejaRot: 0.45, cejaY: -0.025, pupila: 0.9, ojoY: 0},
	}[animo];

	// brazos: colgando (≈0.35 rad) → arriba (≈2.7 rad)
	const brazoRot = 0.35 + arriba * 2.35 + (caminando ? -paso * 0.35 : 0) + Math.sin(f * 0.11) * 0.03;

	// lágrima (triste): cae y se repite cada 45 cuadros
	const tCiclo = (((f % 45) + 45) % 45) / 45;

	const ojoPos = (lado: number) => sobreCuerpo(lado * 0.2, 1.05, -0.06);
	const cejaPos = (lado: number): V3 => {
		const p = sobreCuerpo(lado * 0.2, 1.2 + ex.cejaY, -0.005);
		return [p[0], p[1], p[2]];
	};

	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<Sombra radio={0.62} opacidad={1 - s * 0.6} />
			<group position={[0, alto, 0]} rotation={[0, 0, rollo]} scale={[ancho, estira, ancho]}>
				{/* piernas */}
				{[-1, 1].map((lado) => (
					<group key={lado} position={[lado * 0.24, 0.4, 0.02]} rotation={[lado * paso * 0.55 - s * 0.25, 0, 0]}>
						<mesh position={[0, -0.16, 0]} material={materiales.piel}>
							<cylinderGeometry args={[0.105, 0.115, 0.32, 14]} />
						</mesh>
						<mesh position={[0, -0.36, 0.0]} material={materiales.pezuna}>
							<cylinderGeometry args={[0.118, 0.12, 0.08, 14]} />
						</mesh>
					</group>
				))}

				{/* cuerpo-cabeza */}
				<mesh position={[0, CY, 0]} scale={[1.02, 0.96, 0.98]} material={materiales.piel}>
					<sphereGeometry args={[CR, 40, 30]} />
				</mesh>

				{/* ranura de alcancía arriba */}
				<mesh position={[0, CY + CR * 0.93, -0.2]} rotation={[-0.33, 0, 0]} material={materiales.ranura}>
					<boxGeometry args={[0.26, 0.04, 0.05]} />
				</mesh>

				{/* orejas */}
				{[-1, 1].map((lado) => (
					<group key={lado} position={[lado * 0.33, 1.34, 0.02]} rotation={[0.35, 0, -lado * 0.5]}>
						<mesh position={[0, 0.1, 0]} scale={[1, 1, 0.45]} material={materiales.piel}>
							<coneGeometry args={[0.15, 0.28, 16]} />
						</mesh>
						<mesh position={[0, 0.09, 0.045]} scale={[1, 1, 0.2]} material={materiales.oscuro}>
							<coneGeometry args={[0.095, 0.2, 16]} />
						</mesh>
					</group>
				))}

				{/* ojos */}
				{[-1, 1].map((lado) => (
					<Ojo
						key={lado}
						position={ojoPos(lado)}
						radio={0.125}
						mirarX={mirarX}
						mirarY={ex.ojoY}
						pupila={ex.pupila}
						parpado={parpado}
					/>
				))}

				{/* cejas (cápsula acostada; cejaRot > 0 = enojado, < 0 = preocupado) */}
				{[-1, 1].map((lado) => (
					<mesh key={lado} position={cejaPos(lado)} rotation={[0, lado * 0.3, Math.PI / 2 + lado * ex.cejaRot]} material={materiales.ranura}>
						<capsuleGeometry args={[0.024, 0.12, 4, 8]} />
					</mesh>
				))}

				{/* hocico */}
				<group position={sobreCuerpo(0, 0.83, -0.04)}>
					<mesh rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 1, 0.9]} material={materiales.hocico}>
						<cylinderGeometry args={[0.17, 0.18, 0.16, 28]} />
					</mesh>
					<mesh position={[0, 0, 0.081]} scale={[1.15, 0.9, 0.25]} material={materiales.hocico}>
						<sphereGeometry args={[0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
					</mesh>
					{[-1, 1].map((lado) => (
						<mesh key={lado} position={[lado * 0.065, 0, 0.115]} scale={[0.7, 1, 0.4]} material={materiales.ranura}>
							<sphereGeometry args={[0.042, 12, 10]} />
						</mesh>
					))}
				</group>

				{/* cachetes */}
				{[-1, 1].map((lado) => (
					<mesh key={lado} position={sobreCuerpo(lado * 0.36, 0.86, -0.02)} rotation={[0, lado * 0.6, 0]} scale={[1, 0.6, 0.3]} material={materiales.cachete}>
						<sphereGeometry args={[0.08, 14, 10]} />
					</mesh>
				))}

				{/* boca */}
				<group position={sobreCuerpo(0, 0.6, -0.005)} rotation={[0.45, 0, 0]}>
					<Boca animo={animo} />
				</group>

				{/* lágrima */}
				{animo === 'triste' ? (
					<mesh
						position={[ojoPos(1)[0] + 0.06, ojoPos(1)[1] - 0.12 - tCiclo * 0.28, ojoPos(1)[2] + 0.08 - tCiclo * 0.04]}
						scale={[0.8, 1.2 + tCiclo * 0.3, 0.8]}
					>
						<sphereGeometry args={[0.035, 12, 10]} />
						<meshPhysicalMaterial color="#6fc8ff" roughness={0.1} clearcoat={1} transparent opacity={1 - tCiclo * 0.6} />
					</mesh>
				) : null}

				{/* brazos */}
				{[-1, 1].map((lado) => (
					<group key={lado} position={[lado * 0.52, 0.86, 0.08]} rotation={[0, 0, lado * brazoRot]}>
						<mesh position={[0, -0.15, 0]} material={materiales.piel}>
							<capsuleGeometry args={[0.075, 0.18, 6, 12]} />
						</mesh>
						<mesh position={[0, -0.28, 0]} material={materiales.pezuna}>
							<sphereGeometry args={[0.078, 12, 10]} />
						</mesh>
					</group>
				))}

				{/* cola rizada */}
				<mesh position={[0, 0.78, -CR + 0.02]} geometry={geoCola} material={materiales.piel} rotation={[0, 0, Math.sin(f * 0.2) * 0.3]} />
			</group>
		</group>
	);
};

// ============================================================
// 2. Inflación (villano)
// ============================================================
export type InflacionProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	boca?: number;
	fase?: number;
};

// perfil de gomita (radio, altura) para el torno; el cuerpo se aplasta en Z ×0.9
const PERFIL_BLOB: [number, number][] = [
	[0.0, 0.0],
	[0.82, 0.02],
	[0.95, 0.16],
	[0.93, 0.45],
	[0.82, 0.85],
	[0.64, 1.2],
	[0.4, 1.46],
	[0.15, 1.58],
	[0.0, 1.6],
];
const Z_BLOB = 0.9;
const puntosBlob = new THREE.SplineCurve(PERFIL_BLOB.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(40);
/** Radio del cuerpo a la altura y. */
const radioBlob = (y: number) => {
	for (let i = 1; i < puntosBlob.length; i++) {
		const a = puntosBlob[i - 1];
		const b = puntosBlob[i];
		if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
	}
	return 0;
};
/** z de la superficie frontal del cuerpo en (x, y). */
const zBlob = (x: number, y: number) => Math.sqrt(Math.max(0, radioBlob(y) ** 2 - x * x)) * Z_BLOB;

export const Inflacion: React.FC<InflacionProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, boca = 0, fase = 0}) => {
	const frame = useCurrentFrame();
	const f = frame + fase;
	const b = clamp01(boca);

	const mats = useMemo(
		() => ({
			piel: new THREE.MeshPhysicalMaterial({color: '#9b4fd1', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2}),
			baba: new THREE.MeshPhysicalMaterial({color: '#7ee04a', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15}),
			manchas: new THREE.MeshPhysicalMaterial({color: '#9be65f', roughness: 0.3, clearcoat: 0.8}),
			boca: new THREE.MeshStandardMaterial({color: '#3b0b2e', roughness: 0.6, side: THREE.DoubleSide}),
			lengua: new THREE.MeshStandardMaterial({color: '#e8507a', roughness: 0.45}),
			diente: new THREE.MeshPhysicalMaterial({color: '#fffbe8', roughness: 0.25, clearcoat: 0.6}),
			ceja: new THREE.MeshStandardMaterial({color: '#2a0a24', roughness: 0.5}),
		}),
		[],
	);
	const geoCuerpo = useMemo(() => new THREE.LatheGeometry(puntosBlob, 44), []);

	const charcos = useMemo(() => {
		const r = rng(7);
		return Array.from({length: 7}, (_, i) => {
			const a = (i / 7) * Math.PI * 2 + r() * 0.5;
			const d = 0.75 + r() * 0.2;
			return {x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.16 + r() * 0.1, ph: r() * 6};
		});
	}, []);

	// gelatina: X/Z vs Y en contrafase
	const w = Math.sin(f * 0.16) * 0.035 + Math.sin(f * 0.37) * 0.012;
	const sy = 1 + w + b * 0.05;
	const sxz = 1 - w * 0.8 + b * 0.04;
	const inclina = Math.sin(f * 0.08) * 0.04;

	// boca: borde superior recto en y = Y_BOCA, se abre hacia abajo
	const Y_BOCA = 0.8;
	const alto = 0.13 + b * 0.32;
	const anchoBoca = 0.5;
	// la media elipsoide asoma del cuerpo; los dientes van sobre su frente
	const RX = anchoBoca * 1.15;
	const RZ = 0.3;
	const zCentro = zBlob(0, Y_BOCA - alto * 0.6) - 0.1;
	const zBoca = (x: number, y: number) => zCentro + RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2 - ((y - Y_BOCA) / alto) ** 2));
	const nArriba = 6;
	const nAbajo = 5;

	const manchas: [number, number, number][] = [
		[0.62, 0.55, 0.09],
		[-0.7, 0.4, 0.08],
		[0.78, 0.28, 0.06],
	];

	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<Sombra radio={1.15} />
			{/* charco de baba verde */}
			<mesh position={[0, 0.0, 0]} scale={[1, 0.1, 1]} material={mats.baba}>
				<sphereGeometry args={[1.0, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
			</mesh>
			{charcos.map((c, i) => (
				<mesh key={i} position={[c.x, 0.0, c.z]} scale={[1, 0.35 + Math.sin(f * 0.1 + c.ph) * 0.05, 1]} material={mats.baba}>
					<sphereGeometry args={[c.s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
				</mesh>
			))}

			<group rotation={[0, 0, inclina]} scale={[sxz, sy, sxz]}>
				<mesh geometry={geoCuerpo} scale={[1, 1, Z_BLOB]} material={mats.piel} />
				{/* copete */}
				<mesh position={[0.05, 1.68, -0.02]} rotation={[0, 0, -0.35 + Math.sin(f * 0.16 + 1) * 0.08]} material={mats.piel}>
					<coneGeometry args={[0.16, 0.3, 16]} />
				</mesh>
				<mesh position={[0.13 + Math.sin(f * 0.16 + 1) * 0.02, 1.83, -0.02]} material={mats.piel}>
					<sphereGeometry args={[0.065, 12, 10]} />
				</mesh>

				{/* manchas verdes que escurren (a los lados, lejos de la cara) */}
				{manchas.map(([x, y, r], i) => {
					const z = zBlob(x, y);
					const rotY = Math.atan2(x, z);
					return (
						<group key={i} position={[x * 0.98, y, z * 0.98]} rotation={[0, rotY, 0]}>
							<mesh scale={[1, 0.8, 0.45]} material={mats.manchas}>
								<sphereGeometry args={[r, 14, 10]} />
							</mesh>
							<mesh position={[0, -r * 1.1 - Math.sin(f * 0.07 + i) * 0.02, 0.0]} scale={[0.5, 1.4, 0.4]} material={mats.manchas}>
								<sphereGeometry args={[r * 0.6, 10, 8]} />
							</mesh>
						</group>
					);
				})}

				{/* ojos enojados (uno un poco más grande) */}
				<Ojo position={[-0.25, 1.16, zBlob(-0.25, 1.16) - 0.1]} radio={0.17} blanco="#fff6a8" pupila={0.75} mirarX={0.2} rotY={-0.3} />
				<Ojo position={[0.25, 1.13, zBlob(0.25, 1.13) - 0.09]} radio={0.15} blanco="#fff6a8" pupila={0.75} mirarX={-0.2} rotY={0.3} />
				{/* cejas en V */}
				<mesh position={[-0.23, 1.36, zBlob(-0.23, 1.36) + 0.02]} rotation={[-0.35, -0.3, -0.5]} material={mats.ceja}>
					<boxGeometry args={[0.32, 0.075, 0.08]} />
				</mesh>
				<mesh position={[0.23, 1.33, zBlob(0.23, 1.33) + 0.02]} rotation={[-0.35, 0.3, 0.5]} material={mats.ceja}>
					<boxGeometry args={[0.3, 0.075, 0.08]} />
				</mesh>

				{/* boca: media elipsoide oscura hundida en el cuerpo (solo asoma el frente) */}
				<mesh position={[0, Y_BOCA, zCentro]} scale={[RX / 0.5, alto / 0.5, RZ / 0.5]} material={mats.boca}>
					<sphereGeometry args={[0.5, 32, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
				</mesh>
				{b > 0.15 ? (
					<mesh position={[0, Y_BOCA - alto * 0.72, zBoca(0, Y_BOCA - alto * 0.72) - 0.02]} scale={[1.7, 0.45 + b * 0.2, 0.6]} material={mats.lengua}>
						<sphereGeometry args={[0.12, 14, 10]} />
					</mesh>
				) : null}
				{Array.from({length: nArriba}, (_, i) => {
					const t = (i + 0.5) / nArriba - 0.5;
					const x = t * anchoBoca * 1.6;
					const y = Y_BOCA - 0.075;
					return (
						<mesh key={`a${i}`} position={[x, y, Math.max(zBoca(x, Y_BOCA - 0.02), zBlob(x, Y_BOCA)) - 0.03]} rotation={[Math.PI - 0.2, Math.atan2(x, 1), 0]} material={mats.diente}>
							<coneGeometry args={[0.07, 0.15, 4]} />
						</mesh>
					);
				})}
				{Array.from({length: nAbajo}, (_, i) => {
					const t = (i + 0.5) / nAbajo - 0.5;
					const x = t * anchoBoca * 1.3;
					const borde = Math.sqrt(Math.max(0, 1 - (x / RX) ** 2));
					const yb = Y_BOCA - alto * borde * 0.85;
					return (
						<mesh key={`b${i}`} position={[x, yb + 0.06, zBoca(x, yb) - 0.02]} rotation={[0.2, Math.atan2(x, 1), 0]} material={mats.diente}>
							<coneGeometry args={[0.045, 0.13, 4]} />
						</mesh>
					);
				})}

				{/* bracitos rechonchos */}
				{[-1, 1].map((lado) => (
					<group key={lado} position={[lado * 0.84, 0.72, 0.12]} rotation={[0, 0, lado * (0.95 + Math.sin(f * 0.18 + lado) * 0.25 + b * 0.55)]}>
						<mesh position={[0, -0.14, 0]} material={mats.piel}>
							<capsuleGeometry args={[0.1, 0.16, 6, 12]} />
						</mesh>
						{[-1, 0, 1].map((k) => (
							<mesh key={k} position={[k * 0.06, -0.3, 0.02]} material={mats.piel}>
								<sphereGeometry args={[0.045, 10, 8]} />
							</mesh>
						))}
					</group>
				))}
			</group>
		</group>
	);
};

// ============================================================
// Monedas (compartido)
// ============================================================
const ORO = '#f7c325';
const GRIS = '#857a6a';

/** Textura de cara de moneda en tonos claros: el color real lo da el material (multiplica). */
const useTexturaMoneda = () =>
	useMemo(
		() =>
			lienzo(256, 256, (ctx) => {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, 256, 256);
				// anillo interior
				ctx.beginPath();
				ctx.arc(128, 128, 104, 0, Math.PI * 2);
				ctx.lineWidth = 8;
				ctx.strokeStyle = '#d9cfb8';
				ctx.stroke();
				// "$" en relieve: sombra oscura desplazada + luz
				ctx.font = '900 170px Arial, Helvetica, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillStyle = '#a8935c';
				ctx.fillText('$', 134, 142);
				ctx.fillStyle = '#fff8e0';
				ctx.fillText('$', 124, 132);
				ctx.fillStyle = '#e9dcb4';
				ctx.fillText('$', 128, 137);
			}),
		[],
	);

const colorMoneda = (gris: number) => mezclar(ORO, GRIS, gris);

const useMaterialesMoneda = (gris: number) => {
	const tex = useTexturaMoneda();
	const mats = useMemo(
		() => ({
			canto: new THREE.MeshStandardMaterial({color: ORO, metalness: 0.3, roughness: 0.35}),
			cara: new THREE.MeshStandardMaterial({color: ORO, metalness: 0.25, roughness: 0.38, map: tex}),
		}),
		[tex],
	);
	const g = clamp01(gris);
	const c = colorMoneda(g);
	mats.canto.color.copy(c).multiplyScalar(0.92);
	mats.cara.color.copy(c);
	mats.canto.metalness = 0.3 - g * 0.25;
	mats.cara.metalness = 0.25 - g * 0.2;
	mats.canto.roughness = 0.35 + g * 0.45;
	mats.cara.roughness = 0.38 + g * 0.45;
	return mats;
};

export type MonedaProps = {
	position?: V3;
	rotation?: V3;
	escala?: number;
	gris?: number;
};

/**
 * Moneda de pie mirando a +Z (radio 0.25, grosor 0.06). El origen está en su canto inferior;
 * `rotation` gira alrededor del CENTRO de la moneda (y = 0.25).
 */
export const Moneda: React.FC<MonedaProps> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1, gris = 0}) => {
	const mats = useMaterialesMoneda(gris);
	return (
		<group position={position} scale={escala}>
			<group position={[0, 0.25, 0]} rotation={rotation}>
				<group rotation={[Math.PI / 2, 0, 0]}>
					<mesh material={mats.canto}>
						<cylinderGeometry args={[0.25, 0.25, 0.04, 36]} />
					</mesh>
					{[-1, 1].map((lado) => (
						<group key={lado}>
							<mesh position={[0, lado * 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.canto}>
								<torusGeometry args={[0.232, 0.018, 8, 36]} />
							</mesh>
							<mesh position={[0, lado * 0.0205, 0]} rotation={[lado * -Math.PI / 2, 0, lado > 0 ? Math.PI : 0]} material={mats.cara}>
								<circleGeometry args={[0.218, 36]} />
							</mesh>
						</group>
					))}
				</group>
			</group>
		</group>
	);
};

/** Pila de monedas acostadas (uso interno de TorreMonedas y Frasco). */
const Pila: React.FC<{cantidad: number; radio?: number; gris: number; semilla?: number; desorden?: number}> = ({
	cantidad,
	radio = 0.25,
	gris,
	semilla = 1,
	desorden = 0.012,
}) => {
	const mats = useMaterialesMoneda(gris);
	const geoCanto = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 30), []);
	const geoCara = useMemo(() => new THREE.CircleGeometry(1, 30), []);
	const offsets = useMemo(() => {
		const r = rng(semilla);
		return Array.from({length: 64}, () => [(r() - 0.5) * 2, (r() - 0.5) * 2, r() * Math.PI * 2] as const);
	}, [semilla]);
	const n = Math.max(0, cantidad);
	const llenas = Math.floor(n);
	const frac = n - llenas;
	const grosor = 0.06;
	const total = Math.min(64, llenas + (frac > 0.001 ? 1 : 0));
	return (
		<group>
			{Array.from({length: total}, (_, i) => {
				const ultima = i === llenas; // la fraccionaria
				const k = ultima ? frac : 1;
				// la moneda parcial cae desde arriba y crece
				const caida = ultima ? (1 - k) * 0.6 : 0;
				const sc = ultima ? 0.4 + 0.6 * k : 1;
				const [ox, oz, rot] = offsets[i];
				const esTope = i === total - 1;
				return (
					<group key={i} position={[ox * desorden, grosor * (i + 0.5) + caida, oz * desorden]} rotation={[0, rot, 0]} scale={[sc, sc, sc]}>
						<mesh geometry={geoCanto} material={mats.canto} scale={[radio, grosor * 0.96, radio]} />
						{esTope ? <mesh geometry={geoCara} material={mats.cara} position={[0, grosor * 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={radio * 0.92} /> : null}
					</group>
				);
			})}
		</group>
	);
};

// ============================================================
// 4. Frasco
// ============================================================
export type FrascoProps = {
	position?: V3;
	escala?: number;
	nivel: number;
	gris?: number;
};

const MAX_FRASCO = 14;

export const Frasco: React.FC<FrascoProps> = ({position = [0, 0, 0], escala = 1, nivel, gris = 0}) => {
	const geoVidrio = useMemo(() => {
		const p = [
			[0.0, 0.0],
			[0.44, 0.0],
			[0.5, 0.06],
			[0.52, 0.2],
			[0.52, 1.0],
			[0.48, 1.1],
			[0.4, 1.15],
			[0.4, 1.2],
		].map(([x, y]) => new THREE.Vector2(x, y));
		return new THREE.LatheGeometry(p, 40);
	}, []);
	const n = clamp01(nivel) * MAX_FRASCO;
	// 4 pilas con alturas un poco distintas (semilla fija) para que la superficie no sea plana
	const pilas: {x: number; z: number; k: number; s: number}[] = [
		{x: -0.15, z: -0.13, k: 1.0, s: 3},
		{x: 0.16, z: -0.12, k: 0.93, s: 5},
		{x: -0.13, z: 0.16, k: 0.96, s: 8},
		{x: 0.15, z: 0.15, k: 0.88, s: 11},
	];
	return (
		<group position={position} scale={escala}>
			<Sombra radio={0.7} />
			{pilas.map((p, i) => (
				<group key={i} position={[p.x, 0.02, p.z]}>
					<Pila cantidad={n * p.k} radio={0.2} gris={gris} semilla={p.s} desorden={0.015} />
				</group>
			))}
			{/* vidrio */}
			<mesh geometry={geoVidrio} renderOrder={5}>
				<meshPhysicalMaterial color="#cfefff" roughness={0.05} metalness={0} clearcoat={1} transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
			</mesh>
			{/* brillo vertical del vidrio */}
			<mesh position={[-0.3, 0.6, 0.41]} rotation={[0, -0.6, 0]} renderOrder={6}>
				<planeGeometry args={[0.07, 0.75]} />
				<meshBasicMaterial color="#ffffff" transparent opacity={0.45} depthWrite={false} />
			</mesh>
			{/* tapa */}
			<mesh position={[0, 1.25, 0]}>
				<cylinderGeometry args={[0.44, 0.44, 0.13, 36]} />
				<meshPhysicalMaterial color="#e74c3c" roughness={0.35} clearcoat={0.6} />
			</mesh>
			<mesh position={[0, 1.315, 0]}>
				<cylinderGeometry args={[0.4, 0.44, 0.03, 36]} />
				<meshPhysicalMaterial color="#ff6b5b" roughness={0.35} clearcoat={0.6} />
			</mesh>
		</group>
	);
};

// ============================================================
// 6. Torre de monedas
// ============================================================
export type TorreMonedasProps = {
	position?: V3;
	cantidad: number;
	escala?: number;
	gris?: number;
};

export const TorreMonedas: React.FC<TorreMonedasProps> = ({position = [0, 0, 0], cantidad, escala = 1, gris = 0}) => (
	<group position={position} scale={escala}>
		<Sombra radio={0.42} />
		<Pila cantidad={cantidad} gris={gris} semilla={21} />
	</group>
);

// ============================================================
// 5. Banco
// ============================================================
export type BancoProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	brillo?: number;
};

export const Banco: React.FC<BancoProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, brillo = 0}) => {
	const br = clamp01(brillo);
	const texDolar = useMemo(
		() =>
			lienzo(256, 256, (ctx) => {
				ctx.clearRect(0, 0, 256, 256);
				ctx.font = '900 220px Arial, Helvetica, sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.lineWidth = 16;
				ctx.strokeStyle = '#7a5200';
				ctx.strokeText('$', 128, 138);
				ctx.fillStyle = '#ffd23f';
				ctx.fillText('$', 128, 138);
			}),
		[],
	);
	const geoFronton = useMemo(() => {
		const s = new THREE.Shape();
		s.moveTo(-1.5, 0);
		s.lineTo(1.5, 0);
		s.lineTo(0, 0.78);
		s.closePath();
		const g = new THREE.ExtrudeGeometry(s, {depth: 1.5, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1});
		g.translate(0, 0, -1.5);
		return g;
	}, []);
	const mats = useMemo(
		() => ({
			pared: new THREE.MeshStandardMaterial({color: '#fff1d6', roughness: 0.55}),
			columna: new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.4, clearcoat: 0.3}),
			escalon: new THREE.MeshStandardMaterial({color: '#cfd6e6', roughness: 0.6}),
			techo: new THREE.MeshPhysicalMaterial({color: '#3d8fe0', roughness: 0.4, clearcoat: 0.4}),
			puerta: new THREE.MeshStandardMaterial({color: '#8a4b2a', roughness: 0.5}),
		}),
		[],
	);
	const emis = new THREE.Color('#ffcf40');
	const ventana = mezclar('#5f8fb8', '#fff3a0', br);
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<Sombra radio={2.0} />
			{/* escalones */}
			{[0, 1, 2].map((i) => (
				<mesh key={i} position={[0, 0.06 + i * 0.12, 0.25 - i * 0.12]} material={mats.escalon}>
					<boxGeometry args={[3.1 - i * 0.2, 0.12, 2.1 - i * 0.24]} />
				</mesh>
			))}
			{/* muro */}
			<mesh position={[0, 0.36 + 0.82, -0.25]} material={mats.pared}>
				<boxGeometry args={[2.5, 1.64, 1.2]} />
			</mesh>
			{/* columnas */}
			{[-1.08, -0.36, 0.36, 1.08].map((x) => (
				<group key={x} position={[x, 0.36, 0.6]}>
					<mesh position={[0, 0.05, 0]} material={mats.columna}>
						<boxGeometry args={[0.36, 0.1, 0.36]} />
					</mesh>
					<mesh position={[0, 0.84, 0]} material={mats.columna}>
						<cylinderGeometry args={[0.13, 0.15, 1.48, 12]} />
					</mesh>
					<mesh position={[0, 1.62, 0]} material={mats.columna}>
						<boxGeometry args={[0.38, 0.1, 0.38]} />
					</mesh>
				</group>
			))}
			{/* puerta */}
			<mesh position={[0, 0.36 + 0.5, 0.36]} material={mats.puerta}>
				<boxGeometry args={[0.5, 1.0, 0.04]} />
			</mesh>
			<mesh position={[0, 0.36 + 1.0, 0.36]} rotation={[0, 0, 0]} material={mats.puerta}>
				<cylinderGeometry args={[0.25, 0.25, 0.04, 20, 1, false, -Math.PI / 2, Math.PI]} />
			</mesh>
			<mesh position={[0.15, 0.36 + 0.5, 0.39]}>
				<sphereGeometry args={[0.035, 10, 8]} />
				<meshStandardMaterial color="#ffd23f" metalness={0.6} roughness={0.3} />
			</mesh>
			{/* ventanas */}
			{[-0.72, 0.72].map((x) => (
				<group key={x} position={[x, 1.25, 0.36]}>
					<mesh position={[0, 0, -0.005]} material={mats.columna}>
						<boxGeometry args={[0.42, 0.62, 0.03]} />
					</mesh>
					<mesh position={[0, 0, 0.012]}>
						<planeGeometry args={[0.32, 0.52]} />
						<meshStandardMaterial color={ventana} emissive={emis} emissiveIntensity={br * 0.9} roughness={0.2} />
					</mesh>
					<mesh position={[0, 0, 0.015]} material={mats.columna}>
						<boxGeometry args={[0.03, 0.52, 0.01]} />
					</mesh>
				</group>
			))}
			{/* arquitrabe */}
			<mesh position={[0, 2.08, 0.05]} material={mats.techo}>
				<boxGeometry args={[2.9, 0.18, 1.7]} />
			</mesh>
			<mesh position={[0, 1.98, 0.06]} material={mats.columna}>
				<boxGeometry args={[2.8, 0.05, 1.62]} />
			</mesh>
			{/* frontón */}
			<mesh geometry={geoFronton} position={[0, 2.17, 0.85]} material={mats.techo} />
			{/* tímpano claro + $ */}
			<mesh position={[0, 2.19, 0.885]}>
				<shapeGeometry
					args={[
						(() => {
							const s = new THREE.Shape();
							s.moveTo(-1.2, 0.04);
							s.lineTo(1.2, 0.04);
							s.lineTo(0, 0.64);
							s.closePath();
							return s;
						})(),
					]}
				/>
				<meshStandardMaterial color="#fff1d6" roughness={0.55} />
			</mesh>
			<mesh position={[0, 2.43, 0.9]}>
				<planeGeometry args={[0.5, 0.5]} />
				<meshStandardMaterial map={texDolar} transparent alphaTest={0.1} emissive={emis} emissiveMap={texDolar} emissiveIntensity={0.05 + br * 1.6} roughness={0.3} metalness={0.2} />
			</mesh>
		</group>
	);
};

// ============================================================
// 7. Calendario
// ============================================================
export type CalendarioProps = {
	position?: V3;
	rotationY?: number;
	escala?: number;
	texto: string;
};

export const Calendario: React.FC<CalendarioProps> = ({position = [0, 0, 0], rotationY = 0, escala = 1, texto}) => {
	const tex = useMemo(
		() =>
			lienzo(512, 512, (ctx) => {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, 512, 512);
				ctx.fillStyle = '#1f2a44';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				const lineas = texto.split('\n');
				const larga = Math.max(...lineas.map((l) => l.length), 1);
				let tam = Math.min(300 / lineas.length, (460 / larga) * 1.7, 260);
				ctx.font = `900 ${tam}px Arial, Helvetica, sans-serif`;
				// ajusta al ancho real
				const anchoMax = Math.max(...lineas.map((l) => ctx.measureText(l).width), 1);
				if (anchoMax > 450) {
					tam = (tam * 450) / anchoMax;
					ctx.font = `900 ${tam}px Arial, Helvetica, sans-serif`;
				}
				const alto = tam * 1.05;
				lineas.forEach((l, i) => ctx.fillText(l, 256, 270 + (i - (lineas.length - 1) / 2) * alto));
				// rayita inferior
				ctx.fillStyle = '#e3e7ef';
				ctx.fillRect(60, 470, 392, 8);
			}),
		[texto],
	);
	useEffect(() => () => tex.dispose(), [tex]);
	return (
		<group position={position} rotation={[0, rotationY, 0]} scale={escala}>
			<Sombra radio={0.55} />
			{/* bloque de hojas */}
			<mesh position={[0, 0.33, 0]}>
				<boxGeometry args={[0.7, 0.66, 0.22]} />
				<meshStandardMaterial color="#f4efe4" roughness={0.7} />
			</mesh>
			{/* hoja del frente con el texto */}
			<mesh position={[0, 0.33, 0.112]}>
				<planeGeometry args={[0.66, 0.62]} />
				<meshStandardMaterial map={tex} roughness={0.6} />
			</mesh>
			{/* encabezado rojo */}
			<mesh position={[0, 0.73, 0]}>
				<boxGeometry args={[0.74, 0.16, 0.25]} />
				<meshPhysicalMaterial color="#e74c3c" roughness={0.38} clearcoat={0.5} />
			</mesh>
			{/* argollas */}
			{[-0.2, 0.2].map((x) => (
				<mesh key={x} position={[x, 0.83, 0]} rotation={[0, Math.PI / 2, 0]}>
					<torusGeometry args={[0.05, 0.014, 8, 18]} />
					<meshStandardMaterial color="#c9ced6" metalness={0.7} roughness={0.3} />
				</mesh>
			))}
		</group>
	);
};

// ============================================================
// 8. Flecha
// ============================================================
export type FlechaProps = {
	position?: V3;
	rotation?: V3;
	escala?: number;
	color?: string;
};

export const Flecha: React.FC<FlechaProps> = ({position = [0, 0, 0], rotation = [0, 0, 0], escala = 1, color = '#2ecc71'}) => {
	const geo = useMemo(() => {
		const s = new THREE.Shape();
		s.moveTo(-0.15, 0);
		s.lineTo(0.15, 0);
		s.lineTo(0.15, 0.55);
		s.lineTo(0.36, 0.55);
		s.lineTo(0, 1.0);
		s.lineTo(-0.36, 0.55);
		s.lineTo(-0.15, 0.55);
		s.closePath();
		const g = new THREE.ExtrudeGeometry(s, {depth: 0.16, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3});
		g.translate(0, 0.035, -0.08);
		return g;
	}, []);
	return (
		<group position={position} rotation={rotation} scale={escala}>
			<mesh geometry={geo}>
				<meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.25} />
			</mesh>
		</group>
	);
};

// ============================================================
// Suelo
// ============================================================
export const Suelo: React.FC<{color?: string}> = ({color = '#8fd16f'}) => {
	const props = useMemo(() => {
		const r = rng(2026);
		const out: {tipo: 'roca' | 'arbusto'; x: number; z: number; s: number; rot: number; c: string}[] = [];
		let intentos = 0;
		while (out.length < 22 && intentos < 400) {
			intentos++;
			const a = r() * Math.PI * 2;
			const d = 4 + r() * 11;
			const x = Math.cos(a) * d;
			const z = Math.sin(a) * d;
			if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
			// delante (hacia la cámara típica en +Z) solo a los lados, para no tapar
			if (z > 2 && Math.abs(x) < 5) continue;
			const roca = r() < 0.4;
			out.push({
				tipo: roca ? 'roca' : 'arbusto',
				x,
				z,
				s: roca ? 0.25 + r() * 0.35 : 0.45 + r() * 0.45,
				rot: r() * Math.PI * 2,
				c: roca ? (r() < 0.5 ? '#b8b4c4' : '#a7a2b5') : r() < 0.5 ? '#4cbf6a' : '#3aa65a',
			});
		}
		return out;
	}, []);
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[30, 64]} />
				<meshStandardMaterial color={color} roughness={0.9} />
			</mesh>
			{props.map((p, i) =>
				p.tipo === 'roca' ? (
					<mesh key={i} position={[p.x, p.s * 0.35, p.z]} rotation={[p.rot * 0.3, p.rot, 0]} scale={[p.s * 1.3, p.s * 0.8, p.s]}>
						<dodecahedronGeometry args={[1, 0]} />
						<meshStandardMaterial color={p.c} roughness={0.7} flatShading />
					</mesh>
				) : (
					<group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]} scale={p.s}>
						<mesh position={[0, 0.5, 0]}>
							<icosahedronGeometry args={[0.6, 0]} />
							<meshStandardMaterial color={p.c} roughness={0.6} flatShading />
						</mesh>
						<mesh position={[0.5, 0.35, 0.1]}>
							<icosahedronGeometry args={[0.42, 0]} />
							<meshStandardMaterial color={p.c} roughness={0.6} flatShading />
						</mesh>
						<mesh position={[-0.45, 0.3, -0.05]}>
							<icosahedronGeometry args={[0.38, 0]} />
							<meshStandardMaterial color={p.c} roughness={0.6} flatShading />
						</mesh>
					</group>
				),
			)}
		</group>
	);
};
