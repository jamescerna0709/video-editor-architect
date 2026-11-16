// Borrador: personajes 2D (recortes planos tipo papel) dentro de una escena 3D.
// Todo se dibuja en código: no usa archivos externos ni assets con licencia.
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';

const FPS = 30;

// ---------- texturas 2D de los personajes (canvas, deterministas) ----------
type Dibujo = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const useTextura = (w: number, h: number, dibujar: Dibujo) =>
	useMemo(() => {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d')!;
		dibujar(ctx, w, h);
		const t = new THREE.CanvasTexture(c);
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 4;
		return t;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

const contorno = (ctx: CanvasRenderingContext2D, color: string, linea: string) => {
	ctx.fillStyle = color;
	ctx.fill();
	ctx.lineWidth = 18;
	ctx.strokeStyle = linea;
	ctx.stroke();
};

// Lumi: gota naranja redonda
const dibujarLumi: Dibujo = (ctx, w, h) => {
	ctx.beginPath();
	ctx.moveTo(w * 0.5, h * 0.06);
	ctx.bezierCurveTo(w * 0.95, h * 0.25, w * 0.98, h * 0.9, w * 0.5, h * 0.94);
	ctx.bezierCurveTo(w * 0.02, h * 0.9, w * 0.05, h * 0.25, w * 0.5, h * 0.06);
	contorno(ctx, '#ff8a3d', '#2b1a12');
	// panza
	ctx.beginPath();
	ctx.ellipse(w * 0.5, h * 0.7, w * 0.24, h * 0.17, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#ffd3a8';
	ctx.fill();
	// cachetes
	ctx.fillStyle = 'rgba(255,80,90,0.55)';
	ctx.beginPath(); ctx.ellipse(w * 0.27, h * 0.5, 30, 18, 0, 0, Math.PI * 2); ctx.fill();
	ctx.beginPath(); ctx.ellipse(w * 0.73, h * 0.5, 30, 18, 0, 0, Math.PI * 2); ctx.fill();
	// boca
	ctx.beginPath();
	ctx.arc(w * 0.5, h * 0.47, 40, 0.15 * Math.PI, 0.85 * Math.PI);
	ctx.lineWidth = 12; ctx.strokeStyle = '#2b1a12'; ctx.lineCap = 'round'; ctx.stroke();
};

// Pip: rectángulo azul alto con antena
const dibujarPip: Dibujo = (ctx, w, h) => {
	// antena
	ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.18); ctx.lineTo(w * 0.5, h * 0.05);
	ctx.lineWidth = 14; ctx.strokeStyle = '#121a2b'; ctx.stroke();
	ctx.beginPath(); ctx.arc(w * 0.5, h * 0.05, 26, 0, Math.PI * 2);
	contorno(ctx, '#ffe066', '#121a2b');
	// cuerpo
	const r = 70, x = w * 0.12, y = h * 0.17, bw = w * 0.76, bh = h * 0.78;
	ctx.beginPath(); ctx.roundRect(x, y, bw, bh, r);
	contorno(ctx, '#4d8dff', '#121a2b');
	// pantalla/cara
	ctx.beginPath(); ctx.roundRect(w * 0.22, h * 0.24, w * 0.56, h * 0.26, 40);
	ctx.fillStyle = '#dff1ff'; ctx.fill();
	// boca
	ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.44); ctx.lineTo(w * 0.6, h * 0.44);
	ctx.lineWidth = 12; ctx.strokeStyle = '#121a2b'; ctx.lineCap = 'round'; ctx.stroke();
	// botones
	['#ff5d73', '#5dffb0', '#ffe066'].forEach((c, i) => {
		ctx.beginPath(); ctx.arc(w * (0.35 + i * 0.15), h * 0.66, 24, 0, Math.PI * 2);
		contorno(ctx, c, '#121a2b');
	});
};

const dibujarOjo: Dibujo = (ctx, w, h) => {
	ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.42, h * 0.45, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#111'; ctx.stroke();
	ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.55, w * 0.2, h * 0.22, 0, 0, Math.PI * 2);
	ctx.fillStyle = '#111'; ctx.fill();
	ctx.beginPath(); ctx.arc(w * 0.62, h * 0.42, w * 0.07, 0, Math.PI * 2);
	ctx.fillStyle = '#fff'; ctx.fill();
};

const dibujarSombra: Dibujo = (ctx, w, h) => {
	const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
	g.addColorStop(0, 'rgba(0,0,0,0.45)');
	g.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
};

// ---------- cámara controlada por frame ----------
const camaraEn = (f: number): {pos: THREE.Vector3; mira: THREE.Vector3} => {
	const t = f / FPS;
	// 0-3 s: empuje desde lejos · 3-6.5 s: casi quieta · 6.5-10 s: órbita
	const dist = interpolate(t, [0, 3, 6.5, 10], [16, 9, 8, 9], {
		easing: Easing.inOut(Easing.cubic),
		extrapolateRight: 'clamp',
	});
	const ang = interpolate(t, [0, 3, 6.5, 10], [-0.35, 0, 0.05, 1.1], {
		easing: Easing.inOut(Easing.cubic),
		extrapolateRight: 'clamp',
	});
	const alto = interpolate(t, [0, 3, 10], [7, 3.2, 4.5], {extrapolateRight: 'clamp'});
	return {
		pos: new THREE.Vector3(Math.sin(ang) * dist, alto, Math.cos(ang) * dist),
		mira: new THREE.Vector3(0, 1.4, 0),
	};
};

const Camara: React.FC = () => {
	const frame = useCurrentFrame();
	const {camera} = useThree();
	useLayoutEffect(() => {
		const {pos, mira} = camaraEn(frame);
		camera.position.copy(pos);
		camera.lookAt(mira);
		camera.updateProjectionMatrix();
	}, [frame, camera]);
	return null;
};

// ---------- personaje 2D en el mundo 3D ----------
type PersonajeProps = {
	cuerpo: THREE.Texture;
	ojo: THREE.Texture;
	sombra: THREE.Texture;
	ancho: number;
	alto: number;
	ojos: [number, number][]; // posiciones relativas (x, y) en unidades del cuerpo
	tamOjo: number;
	x: number;
	z: number;
	caminando: boolean;
	salto: number; // 0..1
	parpadeoCada: number;
	fase: number;
};

const Personaje: React.FC<PersonajeProps> = (p) => {
	const frame = useCurrentFrame();
	const {pos: cam} = camaraEn(frame);
	// billboard solo en Y: el recorte siempre mira a la cámara, como cartón en un diorama
	const rotY = Math.atan2(cam.x - p.x, cam.z - p.z);
	const paso = p.caminando ? Math.abs(Math.sin((frame + p.fase) * 0.45)) : 0;
	const respira = Math.sin((frame + p.fase) * 0.12) * 0.03;
	const y = paso * 0.25 + p.salto * 1.6;
	const squash = 1 + respira - paso * 0.06 + p.salto * 0.12;
	const inclina = p.caminando ? Math.sin((frame + p.fase) * 0.45) * 0.08 : 0;
	const ciclo = (frame + p.fase) % p.parpadeoCada;
	const parpado = ciclo < 4 ? 0.12 : 1;

	return (
		<group position={[p.x, 0, p.z]}>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={1 - p.salto * 0.4}>
				<planeGeometry args={[p.ancho * 1.1, p.ancho * 0.55]} />
				<meshBasicMaterial map={p.sombra} transparent depthWrite={false} />
			</mesh>
			<group rotation={[0, rotY, 0]}>
				<group position={[0, y, 0]} rotation={[0, 0, inclina]} scale={[1 / Math.sqrt(squash), squash, 1]}>
					<mesh position={[0, p.alto / 2, 0]}>
						<planeGeometry args={[p.ancho, p.alto]} />
						<meshBasicMaterial map={p.cuerpo} transparent alphaTest={0.05} side={THREE.DoubleSide} />
					</mesh>
					{p.ojos.map(([ox, oy], i) => (
						<mesh key={i} position={[ox * p.ancho, oy * p.alto, 0.02]} scale={[1, parpado, 1]}>
							<planeGeometry args={[p.tamOjo, p.tamOjo * 1.15]} />
							<meshBasicMaterial map={p.ojo} transparent alphaTest={0.05} />
						</mesh>
					))}
				</group>
			</group>
		</group>
	);
};

// ---------- escenario 3D ----------
const Escenario: React.FC = () => {
	const frame = useCurrentFrame();
	const arboles = useMemo(
		() =>
			Array.from({length: 18}, (_, i) => {
				const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.2;
				const r = 7 + (i % 4) * 1.6;
				return {x: Math.cos(a) * r, z: Math.sin(a) * r - 2, h: 1.2 + (i % 5) * 0.45, c: i % 2 ? '#3fae6a' : '#2f8f57'};
			}).filter((a) => a.z < 0.5), // nada entre la cámara y los personajes
		[],
	);
	return (
		<>
			<color attach="background" args={['#9fd8ff']} />
			<fog attach="fog" args={['#bfe6ff', 12, 30]} />
			<hemisphereLight args={['#ffffff', '#6a8f5a', 1.1]} />
			<directionalLight position={[5, 10, 6]} intensity={1.6} />
			{/* piso */}
			<mesh rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[30, 64]} />
				<meshStandardMaterial color="#8fd16f" />
			</mesh>
			{/* camino */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
				<planeGeometry args={[14, 2.2]} />
				<meshStandardMaterial color="#e9d2a0" />
			</mesh>
			{/* árboles low-poly */}
			{arboles.map((a, i) => (
				<group key={i} position={[a.x, 0, a.z]}>
					<mesh position={[0, a.h * 0.3, 0]}>
						<cylinderGeometry args={[0.12, 0.16, a.h * 0.6, 6]} />
						<meshStandardMaterial color="#7a4e2d" flatShading />
					</mesh>
					<mesh position={[0, a.h * 0.6 + 0.6, 0]} rotation={[0, i, 0]}>
						<coneGeometry args={[0.7, a.h + 0.6, 6]} />
						<meshStandardMaterial color={a.c} flatShading />
					</mesh>
				</group>
			))}
			{/* casita */}
			<group position={[0, 0, -4.5]}>
				<mesh position={[0, 1, 0]}>
					<boxGeometry args={[2.6, 2, 2]} />
					<meshStandardMaterial color="#fff4e0" flatShading />
				</mesh>
				<mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 4, 0]}>
					<coneGeometry args={[2.1, 1.3, 4]} />
					<meshStandardMaterial color="#e2574c" flatShading />
				</mesh>
				<mesh position={[0, 0.6, 1.01]}>
					<planeGeometry args={[0.6, 1.2]} />
					<meshStandardMaterial color="#6b3e26" />
				</mesh>
			</group>
			{/* cubos flotantes que giran (para que se note el 3D) */}
			{[-3, 3].map((x, i) => (
				<mesh
					key={x}
					position={[x, 3.2 + Math.sin(frame * 0.06 + i * 2) * 0.3, -1.5]}
					rotation={[frame * 0.02, frame * 0.03 + i, 0]}
				>
					<icosahedronGeometry args={[0.45, 0]} />
					<meshStandardMaterial color={i ? '#ffd23f' : '#b48cff'} flatShading />
				</mesh>
			))}
		</>
	);
};

const Mundo: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const lumi = useTextura(512, 512, dibujarLumi);
	const pip = useTextura(400, 640, dibujarPip);
	const ojo = useTextura(128, 128, dibujarOjo);
	const sombra = useTextura(128, 128, dibujarSombra);

	const t = frame / fps;
	// caminan hacia el centro 0.5-3.5 s
	const xL = interpolate(t, [0.5, 3.5], [-6, -1.1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
	const xP = interpolate(t, [0.8, 3.8], [6, 1.1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
	const caminaL = t > 0.5 && t < 3.4;
	const caminaP = t > 0.8 && t < 3.7;
	const salto = (inicio: number) => {
		const s = spring({frame: frame - inicio * fps, fps, config: {damping: 9, stiffness: 120}, durationInFrames: 24});
		return Math.sin(Math.min(1, s) * Math.PI) * (frame >= inicio * fps ? 1 : 0);
	};

	return (
		<>
			<Camara />
			<Escenario />
			<Personaje
				cuerpo={lumi} ojo={ojo} sombra={sombra}
				ancho={1.8} alto={1.8} ojos={[[-0.15, 0.62], [0.15, 0.62]]} tamOjo={0.42}
				x={xL} z={0.2} caminando={caminaL} salto={salto(6.6) + salto(8.2)}
				parpadeoCada={70} fase={0}
			/>
			<Personaje
				cuerpo={pip} ojo={ojo} sombra={sombra}
				ancho={1.5} alto={2.4} ojos={[[-0.13, 0.66], [0.13, 0.66]]} tamOjo={0.34}
				x={xP} z={-0.1} caminando={caminaP} salto={salto(7.0) + salto(8.6)}
				parpadeoCada={83} fase={17}
			/>
		</>
	);
};

// ---------- capa 2D encima (globos de diálogo y título) ----------
const Globo: React.FC<{texto: string; desde: number; hasta: number; x: string; y: string; color: string}> = ({texto, desde, hasta, x, y, color}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < desde * fps || frame > hasta * fps) return null;
	const s = spring({frame: frame - desde * fps, fps, config: {damping: 12}});
	const sale = interpolate(frame, [hasta * fps - 6, hasta * fps], [1, 0], {extrapolateLeft: 'clamp'});
	return (
		<div
			style={{
				position: 'absolute', left: x, top: y, transform: `translate(-50%, -100%) scale(${s * sale})`,
				transformOrigin: '50% 100%', background: '#fff', border: `8px solid ${color}`, borderRadius: 48,
				padding: '26px 40px', fontFamily: 'sans-serif', fontWeight: 900, fontSize: 64, color: '#1b1b1b',
				boxShadow: '0 12px 0 rgba(0,0,0,0.18)', whiteSpace: 'nowrap',
			}}
		>
			{texto}
		</div>
	);
};

export const Personajes3D: React.FC = () => {
	const {width, height} = useVideoConfig();
	const frame = useCurrentFrame();
	const titulo = interpolate(frame, [0, 12, 70, 85], [0, 1, 1, 0], {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill>
			<ThreeCanvas width={width} height={height} camera={{fov: 50, near: 0.1, far: 100}} gl={{antialias: true, preserveDrawingBuffer: true}}>
				<Mundo />
			</ThreeCanvas>
			<AbsoluteFill style={{alignItems: 'center', paddingTop: 260, opacity: titulo}}>
				<div style={{fontFamily: 'sans-serif', fontWeight: 900, fontSize: 96, color: '#fff', textAlign: 'center', WebkitTextStroke: '6px #1b1b1b', paintOrder: 'stroke'}}>
					2D en un
					<br />
					mundo 3D
				</div>
			</AbsoluteFill>
			<Globo texto="¡Hola, Pip!" desde={3.6} hasta={5.2} x="32%" y="44%" color="#ff8a3d" />
			<Globo texto="¿Saltamos?" desde={5.0} hasta={6.5} x="68%" y="40%" color="#4d8dff" />
			<Globo texto="¡Wiii!" desde={7.0} hasta={9.6} x="50%" y="30%" color="#ffd23f" />
		</AbsoluteFill>
	);
};
