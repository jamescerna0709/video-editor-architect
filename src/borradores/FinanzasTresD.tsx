// Borrador: reel de educación financiera con personajes 3D en un mundo 3D.
// Historia: ahorras $50 diarios → en un año tienes un fondo → la inflación le quita valor →
// lo pones en una cuenta que paga intereses → con interés compuesto crece solo.
// Todo se hace en código: modelos con primitivas de three.js y sonidos sintetizados
// (herramientas/borradores/sonidos-finanzas.ts los genera en proyectos/2026-11-15-finanzas-3d/sonidos/).
// Cifras de ejemplo, con la cuenta hecha: 50 × 365 = 18,250 · 18,250 / 1.05 = 17,381 ·
// 18,250 × 1.10 = 20,075 · 18,250 × 1.10^5 = 29,392.
import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {Banco, Calendario, Cerdito, Flecha, Frasco, Inflacion, Moneda, Suelo, TorreMonedas} from './finanzas/modelos';

const FPS = 30;
export const DURACION_FINANZAS = 32 * FPS;
const SONIDOS = 'p/2026-11-15-finanzas-3d/sonidos';

// ---------- utilidades ----------
const fijo = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const suave = Easing.inOut(Easing.cubic);
const tramo = (t: number, a: number, b: number, de: number, a2: number, easing = suave) =>
	interpolate(t, [a, b], [de, a2], {...fijo, easing});
const pesos = (v: number) => '$' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
type V3 = [number, number, number];
const mezcla = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
// arco de lanzamiento entre dos puntos
const arco = (a: V3, b: V3, k: number, alto: number): V3 => {
	const p = mezcla(a, b, k);
	return [p[0], p[1] + Math.sin(k * Math.PI) * alto, p[2]];
};

// ---------- guion de tiempos (segundos) ----------
const T = {
	diasMonedas: [1.0, 1.8, 2.6, 3.4, 4.2], // caen las monedas del día 1 al 5
	acelera: [5.2, 7.8], // el calendario vuela al día 365
	kaching1: 8.1,
	inflacionCae: 9.2,
	inflacionAterriza: 9.7,
	comeMonedas: [11.2, 11.8, 12.4],
	decidido: 14.6,
	inflacionSale: 15.2,
	camina: [15.8, 18.3],
	lanza: [18.5, 19.2],
	crece: [19.3, 21.0],
	anios: [23.2, 24.2, 25.2, 26.2], // años 2 a 5
	cierre: 28.0,
};
const VALOR_ANIO = [20075, 22083, 24291, 26720, 29392];
// altura de la torre: exagerada a partir de $15,000 para que se note cómo crece
const monedasPara = (pesos: number) => Math.max(0, (pesos - 15000) / 380);

// ---------- cámara por fotogramas clave ----------
type Clave = {t: number; pos: V3; mira: V3};
const CAMARA: Clave[] = [
	{t: 0, pos: [0, 3.6, 11], mira: [0, 1, 0]},
	{t: 2, pos: [0, 2.0, 7], mira: [0, 0.9, 0]},
	{t: 8.6, pos: [-0.2, 1.8, 6.2], mira: [-0.1, 0.9, 0]},
	{t: 9.6, pos: [0.3, 2.3, 8.2], mira: [0.3, 1, 0]},
	{t: 14.6, pos: [0.2, 1.9, 7.2], mira: [0.2, 1, 0]},
	{t: 15.8, pos: [0.0, 2.0, 7.4], mira: [0.1, 1, 0]},
	{t: 18.6, pos: [2.4, 2.4, 8.2], mira: [2.9, 1.2, -0.5]},
	{t: 21.6, pos: [3.0, 2.2, 7.4], mira: [3.3, 1.3, -0.6]},
	{t: 23.0, pos: [3.4, 3.4, 9.6], mira: [3.5, 1.8, -0.8]},
	{t: 27.6, pos: [3.2, 3.6, 9.9], mira: [3.5, 2.0, -0.8]},
	{t: 32, pos: [1.4, 5.6, 14], mira: [2.0, 1.4, -0.5]},
];
const camaraEn = (t: number) => {
	let i = 0;
	while (i < CAMARA.length - 2 && t > CAMARA[i + 1].t) i++;
	const a = CAMARA[i];
	const b = CAMARA[i + 1];
	const k = tramo(t, a.t, b.t, 0, 1);
	return {pos: mezcla(a.pos, b.pos, k), mira: mezcla(a.mira, b.mira, k)};
};

const Camara: React.FC = () => {
	const frame = useCurrentFrame();
	const {camera} = useThree();
	useLayoutEffect(() => {
		const {pos, mira} = camaraEn(frame / FPS);
		camera.position.set(...pos);
		camera.lookAt(new THREE.Vector3(...mira));
		camera.updateProjectionMatrix();
	}, [frame, camera]);
	return null;
};

// ---------- sombra de contacto (mancha suave en el piso) ----------
const useSombra = () =>
	useMemo(() => {
		const c = document.createElement('canvas');
		c.width = c.height = 128;
		const ctx = c.getContext('2d')!;
		const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
		g.addColorStop(0, 'rgba(0,0,0,0.42)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 128, 128);
		return new THREE.CanvasTexture(c);
	}, []);

const Sombra: React.FC<{tex: THREE.Texture; x: number; z: number; r: number; o?: number}> = ({tex, x, z, r, o = 1}) => (
	<mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, z]}>
		<planeGeometry args={[r * 2, r * 2]} />
		<meshBasicMaterial map={tex} transparent opacity={o} depthWrite={false} />
	</mesh>
);

// ---------- el mundo ----------
const Mundo: React.FC = () => {
	const frame = useCurrentFrame();
	const t = frame / FPS;
	const sombra = useSombra();

	// ----- escena 1 y 2: ahorro diario -----
	const diasCaidos = T.diasMonedas.filter((d) => t >= d).length;
	const dia =
		t < T.acelera[0]
			? Math.max(1, diasCaidos)
			: Math.round(tramo(t, T.acelera[0], T.acelera[1], 6, 365, Easing.in(Easing.quad)));
	const nivel = t < T.acelera[0] ? diasCaidos * 0.04 : tramo(t, T.acelera[0], T.acelera[1], 0.2, 1);
	const nivelFinal = nivel - tramo(t, T.comeMonedas[0], T.comeMonedas[2] + 0.5, 0, 0.15);
	const gris = tramo(t, 10.3, 13.2, 0, 1);

	// ----- cerdito -----
	const xCerdito = tramo(t, T.camina[0], T.camina[1], -1.0, 2.2);
	const caminando = t > T.camina[0] && t < T.camina[1] - 0.1;
	const rotCerdito =
		t < T.camina[0] - 0.4
			? 0.25
			: t < T.camina[1]
				? tramo(t, T.camina[0] - 0.4, T.camina[0], 0.25, Math.PI / 2)
				: tramo(t, T.camina[1], T.camina[1] + 0.5, Math.PI / 2, 0.15);
	const animo: 'feliz' | 'triste' | 'sorprendido' | 'decidido' =
		t < 9.4 ? 'feliz' : t < 10.6 ? 'sorprendido' : t < T.decidido ? 'triste' : t < 19.4 ? 'decidido' : 'feliz';
	const brinco = (inicio: number) => {
		const k = (t - inicio) / 0.55;
		return k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
	};
	const salto =
		brinco(T.kaching1 - 0.1) + brinco(21.0) + T.anios.reduce((s, a) => s + brinco(a), 0) + brinco(27.0) + brinco(29.2);
	const brazos = Math.max(
		tramo(t, 7.6, 8.1, 0, 1) * (t < 9.2 ? 1 : 0),
		t > 20.6 ? tramo(t, 20.6, 21.0, 0, 1) : 0,
	);

	// ----- frasco: en el piso, luego lo carga, luego vuela al banco -----
	const posFrascoPiso: V3 = [0.15, 0, 0.55];
	const posPuertaBanco: V3 = [4.6, 0.5, -1.8];
	const cargado: V3 = [xCerdito + 0.55, 0.55, 0.85];
	let posFrasco: V3 = posFrascoPiso;
	let escalaFrasco = 1;
	if (t >= T.camina[0] - 0.3 && t < T.lanza[0]) {
		const k = tramo(t, T.camina[0] - 0.3, T.camina[0] + 0.2, 0, 1);
		posFrasco = mezcla(posFrascoPiso, cargado, k);
		escalaFrasco = 1 - 0.35 * k;
	} else if (t >= T.lanza[0]) {
		const k = tramo(t, T.lanza[0], T.lanza[1], 0, 1, Easing.inOut(Easing.quad));
		posFrasco = arco([2.75, 0.55, 0.85], posPuertaBanco, k, 1.8);
		escalaFrasco = 0.65 * (1 - k * 0.9);
	}
	const frascoVisible = t < T.lanza[1];

	// ----- monedas que caen en el frasco -----
	const monedasCayendo: {p: V3; r: number}[] = [];
	const caida = (inicio: number, semilla: number) => {
		const k = (t - (inicio - 0.35)) / 0.35;
		if (k < 0 || k > 1) return;
		const dx = Math.sin(semilla * 12.9898) * 0.12;
		monedasCayendo.push({p: [posFrascoPiso[0] + dx, 2.6 - k * k * 1.6, posFrascoPiso[2]], r: semilla + k * 6});
	};
	T.diasMonedas.forEach((d, i) => caida(d, i));
	if (t > T.acelera[0] && t < T.acelera[1]) {
		for (let i = 0; i < 40; i++) caida(T.acelera[0] + 0.3 + i * 0.065, i + 10);
	}

	// ----- inflación -----
	const caeK = tramo(t, T.inflacionCae, T.inflacionAterriza, 0, 1, Easing.in(Easing.quad));
	const rebote = t > T.inflacionAterriza ? Math.max(0, Math.sin((t - T.inflacionAterriza) * 14) * 0.25 * Math.exp(-(t - T.inflacionAterriza) * 5)) : 0;
	const yInflacion = (1 - caeK) * 6 + rebote;
	const escalaInflacion = t < T.inflacionSale ? 0.95 : tramo(t, T.inflacionSale, T.inflacionSale + 0.45, 0.95, 0, Easing.in(Easing.back(2)));
	const inflacionVisible = t > T.inflacionCae && escalaInflacion > 0.01;
	const bocaInflacion = Math.max(0, ...T.comeMonedas.map((c) => tramo(t, c - 0.25, c, 0, 1) * tramo(t, c + 0.15, c + 0.4, 1, 0)));
	const posInflacion: V3 = [1.35, yInflacion, -0.45];
	const monedasComidas: {p: V3; r: number}[] = [];
	T.comeMonedas.forEach((c, i) => {
		const k = (t - (c - 0.5)) / 0.5;
		if (k < 0 || k > 1) return;
		monedasComidas.push({p: arco([0.15, 1.1, 0.55], [1.35, 1.25, -0.2], k, 0.7), r: i + k * 8});
	});

	// ----- calendario -----
	const escalaCalendario = t < 9.0 ? tramo(t, 0.2, 0.6, 0, 1, Easing.out(Easing.back(2))) : tramo(t, 9.0, 9.35, 1, 0);

	// ----- banco, torre y flecha -----
	const valor =
		t < T.anios[0] - 0.2
			? VALOR_ANIO[0]
			: VALOR_ANIO[Math.min(4, T.anios.filter((a) => t >= a - 0.2).length)];
	const valorPrevio = t < T.anios[0] ? VALOR_ANIO[0] : VALOR_ANIO[Math.max(0, T.anios.filter((a) => t >= a - 0.2).length - 1)];
	const ultimoAnio = [...T.anios].reverse().find((a) => t >= a - 0.2);
	const kAnio = ultimoAnio === undefined ? 1 : tramo(t, ultimoAnio - 0.2, ultimoAnio + 0.3, 0, 1, Easing.out(Easing.back(1.6)));
	const valorTorre = valorPrevio + (valor - valorPrevio) * kAnio;
	const cantidad = t < T.crece[0] ? 0 : tramo(t, T.crece[0], T.crece[1], 0, 1, Easing.out(Easing.cubic)) * monedasPara(valorTorre);
	const brilloBanco = tramo(t, T.lanza[1] - 0.1, T.lanza[1] + 0.3, 0, 1) * (0.7 + 0.3 * Math.sin(t * 6));
	const posTorre: V3 = [3.5, 0, 0.55];
	const escalaFlecha = tramo(t, 19.6, 20.1, 0, 1, Easing.out(Easing.back(2.5)));
	const altoTorre = cantidad * 0.06 + 0.3;

	return (
		<>
			<Camara />
			<color attach="background" args={['#8fd3ff']} />
			<fog attach="fog" args={['#bfe7ff', 14, 34]} />
			<hemisphereLight args={['#ffffff', '#7aa35f', 1.15]} />
			<directionalLight position={[4, 9, 7]} intensity={1.7} />
			<directionalLight position={[-6, 4, -3]} intensity={0.35} color="#ffd9a8" />
			<Suelo />

			{/* camino de la casa al banco */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.8, 0.006, 0.4]}>
				<planeGeometry args={[11, 1.9]} />
				<meshStandardMaterial color="#ecd7a6" />
			</mesh>

			<Sombra tex={sombra} x={xCerdito} z={0.5} r={0.75} o={1 - salto * 0.4} />
			<Cerdito
				position={[xCerdito, salto * 0.7, 0.5]}
				rotationY={rotCerdito}
				animo={animo}
				caminando={caminando}
				salto={salto}
				brazosArriba={caminando ? 0.55 : brazos}
				mirarX={t > 9.3 && t < T.inflacionSale ? 0.8 : 0}
			/>

			{frascoVisible && (
				<>
					{t < T.camina[0] && <Sombra tex={sombra} x={posFrascoPiso[0]} z={posFrascoPiso[2]} r={0.6} />}
					<group position={posFrasco} scale={escalaFrasco}>
						<Frasco nivel={Math.max(0, nivelFinal)} gris={gris} />
					</group>
				</>
			)}
			{[...monedasCayendo, ...monedasComidas].map((m, i) => (
				<Moneda key={i} position={m.p} rotation={[m.r, m.r * 0.7, 0]} gris={monedasComidas.length && i >= monedasCayendo.length ? gris : 0} />
			))}

			{escalaCalendario > 0.01 && (
				<group position={[1.25, 0, -0.25]} rotation={[0, -0.35, 0]} scale={escalaCalendario}>
					<Calendario texto={`Día ${dia}`} />
				</group>
			)}

			{inflacionVisible && (
				<>
					<Sombra tex={sombra} x={posInflacion[0]} z={posInflacion[2]} r={0.9 * escalaInflacion} o={caeK} />
					<group position={posInflacion} rotation={[0, -0.45 + (t > T.inflacionSale ? (t - T.inflacionSale) * 12 : 0), 0]} scale={escalaInflacion}>
						<Inflacion boca={bocaInflacion} />
					</group>
				</>
			)}

			<Banco position={[4.6, 0, -2.8]} rotationY={-0.2} escala={0.85} brillo={brilloBanco} />
			{cantidad > 0.01 && (
				<>
					<Sombra tex={sombra} x={posTorre[0]} z={posTorre[2]} r={0.5} />
					<TorreMonedas position={posTorre} cantidad={cantidad} />
				</>
			)}
			{escalaFlecha > 0.01 && (
				<group position={[posTorre[0], altoTorre + 0.4 + Math.sin(t * 4) * 0.08, posTorre[2]]} scale={escalaFlecha * 0.8}>
					<Flecha />
				</group>
			)}
		</>
	);
};

// ---------- capa 2D: textos ----------
const ESTILO_TEXTO: React.CSSProperties = {
	fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
	fontWeight: 900,
	color: '#fff',
	textAlign: 'center',
	WebkitTextStroke: '14px #14110f',
	paintOrder: 'stroke fill',
	lineHeight: 1.05,
	letterSpacing: -1,
	textShadow: '0 10px 0 rgba(0,0,0,0.25)',
};

const Texto: React.FC<{desde: number; hasta: number; children: React.ReactNode; top?: number; tam?: number}> = ({
	desde,
	hasta,
	children,
	top = 250,
	tam = 104,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < desde * fps || frame > hasta * fps) return null;
	const entra = spring({frame: frame - desde * fps, fps, config: {damping: 11, stiffness: 180}});
	const sale = interpolate(frame, [hasta * fps - 5, hasta * fps], [1, 0], fijo);
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: top, paddingLeft: 60, paddingRight: 60}}>
			<div style={{...ESTILO_TEXTO, fontSize: tam, transform: `scale(${entra * sale}) rotate(${(1 - entra) * -6}deg)`}}>{children}</div>
		</AbsoluteFill>
	);
};

const Resalta: React.FC<{color: string; children: React.ReactNode}> = ({color, children}) => <span style={{color}}>{children}</span>;

const Contador: React.FC<{desde: number; de: number; a: number; dura: number; color: string}> = ({desde, de, a, dura, color}) => {
	const frame = useCurrentFrame();
	const v = interpolate(frame / FPS, [desde, desde + dura], [de, a], {...fijo, easing: Easing.out(Easing.cubic)});
	return <Resalta color={color}>{pesos(v)}</Resalta>;
};

const ValorAnios: React.FC = () => {
	const frame = useCurrentFrame();
	const t = frame / FPS;
	const n = T.anios.filter((a) => t >= a).length; // 0..4
	const anio = n + 1;
	const ultimo = [...T.anios].reverse().find((a) => t >= a);
	const golpe = ultimo === undefined ? 0 : Math.max(0, 1 - (t - ultimo) * 4);
	const de = VALOR_ANIO[Math.max(0, n - 1)];
	const k = ultimo === undefined ? 1 : interpolate(t, [ultimo, ultimo + 0.4], [0, 1], {...fijo, easing: Easing.out(Easing.cubic)});
	return (
		<span>
			<span style={{fontSize: 88}}>Año {anio}</span>
			<br />
			<span style={{color: '#5dff8f', display: 'inline-block', transform: `scale(${1 + golpe * 0.18})`}}>{pesos(de + (VALOR_ANIO[n] - de) * k)}</span>
		</span>
	);
};

// ---------- sonido ----------
const Sfx: React.FC<{en: number; nombre: string; vol?: number}> = ({en, nombre, vol = 0.8}) => (
	<Sequence from={Math.round(en * FPS)} layout="none">
		<Audio src={staticFile(`${SONIDOS}/${nombre}.wav`)} volume={vol * 0.6} />
	</Sequence>
);

const Sonidos: React.FC = () => (
	<>
		<Audio src={staticFile(`${SONIDOS}/musica.wav`)} volume={0.32} />
		<Sfx en={0.2} nombre="pop" />
		{T.diasMonedas.map((d) => (
			<Sfx key={d} en={d} nombre="moneda" vol={0.7} />
		))}
		<Sfx en={5.0} nombre="whoosh" />
		<Sfx en={5.4} nombre="monedas" vol={0.7} />
		<Sfx en={6.6} nombre="monedas" vol={0.7} />
		<Sfx en={5.0} nombre="pop" vol={0.6} />
		<Sfx en={T.kaching1} nombre="kaching" />
		<Sfx en={9.0} nombre="whoosh" vol={0.6} />
		<Sfx en={T.inflacionAterriza} nombre="golpe" vol={1} />
		<Sfx en={9.4} nombre="pop" vol={0.6} />
		{T.comeMonedas.map((c) => (
			<Sfx key={c} en={c} nombre="moneda" vol={0.55} />
		))}
		<Sfx en={12.0} nombre="pop" vol={0.6} />
		<Sfx en={12.5} nombre="triste" vol={0.75} />
		<Sfx en={T.inflacionSale} nombre="boing" />
		<Sfx en={15.2} nombre="pop" vol={0.6} />
		<Sfx en={T.lanza[0]} nombre="whoosh" />
		<Sfx en={18.6} nombre="pop" vol={0.6} />
		<Sfx en={T.lanza[1]} nombre="sube" />
		<Sfx en={21.0} nombre="kaching" vol={0.75} />
		<Sfx en={22.6} nombre="pop" vol={0.6} />
		{T.anios.map((a) => (
			<Sfx key={a} en={a} nombre="monedas" vol={0.55} />
		))}
		<Sfx en={27.0} nombre="kaching" />
		<Sfx en={T.cierre} nombre="whoosh" vol={0.6} />
		<Sfx en={T.cierre} nombre="pop" vol={0.6} />
		<Sfx en={29.0} nombre="pop" vol={0.6} />
		<Sfx en={29.2} nombre="boing" vol={0.5} />
	</>
);

// ---------- composición ----------
export const FinanzasTresD: React.FC = () => {
	const {width, height} = useVideoConfig();
	const frame = useCurrentFrame();
	const aviso = interpolate(frame / FPS, [T.cierre, T.cierre + 0.4], [0, 1], fijo);
	return (
		<AbsoluteFill style={{backgroundColor: '#8fd3ff'}}>
			<ThreeCanvas width={width} height={height} camera={{fov: 50, near: 0.1, far: 100}} gl={{antialias: true, preserveDrawingBuffer: true}}>
				<Mundo />
			</ThreeCanvas>

			<Texto desde={0.2} hasta={4.9}>
				¿Ahorras <Resalta color="#ffd23f">$50</Resalta>
				<br />
				todos los días?
			</Texto>
			<Texto desde={5.0} hasta={8.9}>
				En 1 año juntas
				<br />
				<Contador desde={5.2} de={0} a={18250} dura={2.8} color="#ffd23f" />
			</Texto>
			<Texto desde={9.4} hasta={11.95}>
				Pero la <Resalta color="#c77dff">inflación</Resalta>
				<br />
				se come su valor
			</Texto>
			<Texto desde={12.0} hasta={15.0} tam={92}>
				Con 5% de inflación,
				<br />
				en 1 año vale como
				<br />
				<Resalta color="#ff5d5d">$17,381</Resalta>
			</Texto>
			<Texto desde={15.2} hasta={18.45}>
				Mejor ponlo
				<br />a <Resalta color="#5dff8f">trabajar</Resalta>
			</Texto>
			<Texto desde={18.6} hasta={22.45} tam={92}>
				Cuenta que paga
				<br />
				<Resalta color="#5dff8f">10% al año</Resalta>
				<br />1 año: <Contador desde={19.3} de={18250} a={20075} dura={1.7} color="#5dff8f" />
			</Texto>
			<Texto desde={22.6} hasta={27.9} tam={96}>
				Si lo dejas 5 años…
				<br />
				<ValorAnios />
			</Texto>
			<Texto desde={T.cierre} hasta={32.1} tam={92}>
				El dinero quieto
				<br />
				<Resalta color="#ff5d5d">pierde</Resalta>.
			</Texto>
			<Texto desde={29.0} hasta={32.1} tam={92} top={520}>
				El que trabaja,
				<br />
				<Resalta color="#5dff8f">crece</Resalta>.
			</Texto>
			<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 330, opacity: aviso}}>
				<div style={{fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: 34, color: '#14110f', background: 'rgba(255,255,255,0.8)', padding: '12px 26px', borderRadius: 20}}>
					Cifras de ejemplo. No es asesoría financiera.
				</div>
			</AbsoluteFill>

			<Sonidos />
		</AbsoluteFill>
	);
};
