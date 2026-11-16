// Reel narrado de Alcanza (la app del creador), ~95 s, con el estilo de las referencias: dioramas 3D low-poly,
// subtítulo de una palabra, etiquetas amarillas y, como novedad, el celular con las pantallas reales de la app.
//
// Todo se amarra a la narración (proyectos/2026-11-15-alcanza/voz/narracion.json, de
// herramientas/borradores/voz-finanzas.ts --guion src/borradores/alcanza/guion.json). Si cambia la voz, se reacomoda.
//
// Cámara: cada toma mira a un punto FIJO, hace un acercamiento corto (≤ 3 s) y luego se queda quieta.
// Así no se "resbala" de lado (comentario del creador sobre el reel anterior).
import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useLayoutEffect} from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {tiempos, type Narracion, type Tiempos} from './FinanzasNarrado';
import {Etiqueta, Lista, Subtitulos, Tarjeta} from './finanzas/capas';
import {Barrio, CasaCorte, Luces} from './finanzas/escenarios';
import {
	Billetera,
	BolsaDelivery,
	Cuaderno,
	FilaHormigas,
	HojaExcel,
	HoyoHormiga,
	LucesNoche,
	Protagonista,
	TaxiJuguete,
	TazaCafe,
} from './alcanza/props3d';
import {
	LogoAlcanza,
	PantallaAnotar,
	PantallaCategorias,
	PantallaInicio,
	PantallaLimites,
	PantallaNotificaciones,
	PantallaReporte,
	TarjetaCierre,
	Telefono,
} from './alcanza/telefono';

export const FPS_ALCANZA = 30;
const SONIDOS = 'p/2026-11-15-alcanza/sonidos';
export const RUTA_NARRACION_ALCANZA = 'p/2026-11-15-alcanza/voz/narracion.json';
export type PropsAlcanza = {narracion: Narracion | null};

type V3 = [number, number, number];
const fijo = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const tramo = (t: number, a: number, b: number, de: number, a2: number, easing = Easing.inOut(Easing.cubic)) =>
	b <= a ? (t >= b ? a2 : de) : interpolate(t, [a, b], [de, a2], {...fijo, easing});
const mezcla = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// ---------- tomas ----------
type SetId = 'sala' | 'calle' | 'app' | 'control' | 'fijas' | 'cierre';
/** de: posición inicial · a: posición final (acercamiento corto) · mira: punto fijo · dura: segundos del acercamiento */
type Toma = {desde: number; hasta: number; set: SetId; de: V3; a: V3; mira: V3; dura?: number};

const tomas = (T: Tiempos): Toma[] => {
	const {en, esc} = T;
	const lista: Omit<Toma, 'hasta'>[] = [
		// domingo de noche: la sala, luego cerca de la cara
		{desde: 0, set: 'sala', de: [3.4, 3.4, 10], a: [2.8, 2.9, 8.4], mira: [0.6, 1.6, -0.4], dura: 3.5},
		{desde: en('gancho', 'semana'), set: 'sala', de: [1.55, 1.55, 1.35], a: [1.45, 1.5, 1.0], mira: [1.15, 1.25, -0.8]},
		// gastos hormiga en la calle
		{desde: esc('hormiga').inicio, set: 'calle', de: [0.3, 3.6, 7.5], a: [0.2, 3.0, 6.2], mira: [0.2, 0.3, 0.3]},
		{desde: en('hormiga', 'hormiga'), set: 'calle', de: [0.5, 0.6, 2.4], a: [0.45, 0.5, 2.0], mira: [0.2, 0.12, 0.5]},
		{desde: en('hormiga', 'cuando'), set: 'calle', de: [-0.35, 1.0, 2.5], a: [-0.45, 0.9, 2.15], mira: [-0.85, 0.17, 0.8]},
		// entra Alcanza: el protagonista con el celular
		{desde: esc('alcanza').inicio, set: 'app', de: [0.2, 2.0, 5.2], a: [0.1, 1.8, 4.2], mira: [0, 1.3, 0.5]},
		// control: adiós Excel y cuaderno, luego caminando
		{desde: esc('control').inicio, set: 'control', de: [0, 1.8, 3.4], a: [0, 1.6, 2.8], mira: [0, 0.9, 0]},
		{desde: en('control', 'cuaderno'), set: 'control', de: [1.6, 1.3, 2.6], a: [1.5, 1.2, 2.2], mira: [1.3, 0.4, 0.2]},
		{desde: en('control', 'con'), set: 'control', de: [0, 2.4, 7.5], a: [0, 2.2, 6.8], mira: [0, 1.2, 0.6]},
		// las 3 fijas: un ángulo por fija
		{desde: esc('fijas').inicio, set: 'fijas', de: [-2.2, 2.4, 6.5], a: [-1.8, 2.1, 5.6], mira: [0, 1.2, 0.5]},
		{desde: en('fijas', 'dos'), set: 'fijas', de: [2.4, 2.0, 5.0], a: [2.0, 1.9, 4.4], mira: [0, 1.2, 0.5]},
		{desde: en('fijas', 'tres'), set: 'fijas', de: [0, 3.0, 6.5], a: [0, 2.6, 5.6], mira: [0, 1.2, 0.5]},
		// cierre: atardecer
		{desde: esc('cierre').inicio, set: 'cierre', de: [0.4, 1.9, 4.6], a: [0.6, 2.6, 6.4], mira: [0, 1.2, 0.5], dura: 5},
	];
	return lista.map((t, i) => ({...t, hasta: i + 1 < lista.length ? lista[i + 1].desde : Infinity}));
};
const tomaEn = (lista: Toma[], t: number) => lista.find((x) => t >= x.desde && t < x.hasta) ?? lista[lista.length - 1];

const Camara: React.FC<{toma: Toma; t: number}> = ({toma, t}) => {
	const {camera} = useThree();
	const dura = Math.min(toma.dura ?? 3, (toma.hasta - toma.desde) * 0.8);
	const k = tramo(t, toma.desde, toma.desde + dura, 0, 1, Easing.out(Easing.cubic));
	const pos = mezcla(toma.de, toma.a, k);
	useLayoutEffect(() => {
		camera.position.set(...pos);
		camera.lookAt(new THREE.Vector3(...toma.mira));
		camera.updateProjectionMatrix();
	});
	return null;
};

// ---------- decorados ----------
type PropsSet = {T: Tiempos; t: number};

const SetSala: React.FC<PropsSet> = ({T, t}) => (
	<>
		<LucesNoche intensidad={0.8} />
		<CasaCorte />
		<Protagonista
			position={[1.15, 0.2, -0.95]}
			sentado
			conCelular={1}
			animo={t >= T.en('gancho', 'saldo') ? 'confundido' : 'normal'}
		/>
	</>
);

const SetCalle: React.FC<PropsSet> = ({T, t}) => {
	const e = T.esc('hormiga');
	const vacia = tramo(t, T.en('hormiga', 'cuando'), T.finDe('hormiga', 'rastro'), 0, 1);
	return (
		<>
			<Luces />
			<Barrio />
			<Billetera position={[-0.85, 0, 0.8]} rotationY={0.4} vacia={vacia} />
			<FilaHormigas desde={[-0.65, 0, 0.8]} hasta={[1.6, 0, 0.2]} cantidad={9} progreso={tramo(t, e.inicio, e.fin, 0.1, 1, Easing.linear)} />
			<HoyoHormiga position={[1.6, 0, 0.2]} />
			<TazaCafe position={[-0.3, 0, -0.5]} />
			<BolsaDelivery position={[0.6, 0, -0.7]} rotationY={-0.3} />
			<TaxiJuguete position={[1.9, 0, 1.3]} rotationY={-0.8} />
			<Protagonista position={[-2.3, 0, -0.6]} rotationY={0.5} animo="confundido" />
		</>
	);
};

const SetApp: React.FC<PropsSet> = () => (
	<>
		<Luces />
		<Barrio />
		<Protagonista position={[0, 0, 0.5]} rotationY={0.1} conCelular={1} animo="feliz" />
	</>
);

const SetControl: React.FC<PropsSet> = ({T, t}) => {
	const caminando = t >= T.en('control', 'con');
	return (
		<>
			<Luces />
			<Barrio />
			{!caminando && (
				<>
					<HojaExcel position={[0, 0, 0]} arrugar={tramo(t, T.en('control', 'imposibles'), T.en('control', 'o'), 0, 1)} />
					<Cuaderno position={[1.3, 0, 0.2]} rotationY={-0.4} hojas={tramo(t, T.en('control', 'cuaderno'), T.finDe('control', 'perder'), 0, 1)} />
				</>
			)}
			{caminando && (
				<Protagonista
					position={[tramo(t, T.en('control', 'con'), T.esc('control').fin, -1.8, 1.2, Easing.linear), 0, 0.6]}
					rotationY={Math.PI / 2 - 0.35}
					caminando
					conCelular={1}
					animo="feliz"
				/>
			)}
		</>
	);
};

const SetFijas: React.FC<PropsSet> = () => (
	<>
		<Luces />
		<Barrio />
		<Protagonista position={[0, 0, 0.5]} rotationY={0.2} conCelular={1} animo="feliz" />
	</>
);

const SetCierre: React.FC<PropsSet> = ({T, t}) => {
	const e = T.esc('cierre');
	return (
		<>
			<Luces tarde={tramo(t, e.inicio, e.fin, 0.2, 0.9)} />
			<Barrio tarde={tramo(t, e.inicio, e.fin, 0.2, 0.9)} />
			<Protagonista position={[0, 0, 0.5]} rotationY={0.15} celebra={tramo(t, T.en('cierre', 'toma'), T.en('cierre', 'toma') + 0.4, 0, 1)} animo="feliz" />
		</>
	);
};

const Mundo: React.FC<{T: Tiempos; lista: Toma[]}> = ({T, lista}) => {
	const frame = useCurrentFrame();
	const t = frame / FPS_ALCANZA;
	const toma = tomaEn(lista, t);
	const p = {T, t};
	return (
		<>
			<Camara toma={toma} t={t} />
			{toma.set === 'sala' && <SetSala {...p} />}
			{toma.set === 'calle' && <SetCalle {...p} />}
			{toma.set === 'app' && <SetApp {...p} />}
			{toma.set === 'control' && <SetControl {...p} />}
			{toma.set === 'fijas' && <SetFijas {...p} />}
			{toma.set === 'cierre' && <SetCierre {...p} />}
		</>
	);
};

// ---------- capa 2D ----------
// El celular va chico y arriba para que el subtítulo (62 % del alto) quede libre debajo.
const CEL = {x: 540, y: 722, escala: 0.94}; // ~820 px de alto: de y≈310 a y≈1130

const Logo: React.FC<{desde: number; hasta: number}> = ({desde, hasta}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	if (frame < desde * fps || frame > hasta * fps) return null;
	const s = spring({frame: frame - desde * fps, fps, config: {damping: 11, stiffness: 160}});
	const sale = interpolate(frame, [hasta * fps - 6, hasta * fps], [1, 0], fijo);
	return (
		<AbsoluteFill style={{alignItems: 'center', paddingTop: 230}}>
			<div style={{transform: `scale(${s * sale})`}}>
				<LogoAlcanza size={150} />
			</div>
		</AbsoluteFill>
	);
};

const NOTIS = [
	{texto: 'Cafecito', monto: 'S/ 8.50'},
	{texto: 'Delivery', monto: 'S/ 24.90'},
	{texto: 'Taxi', monto: 'S/ 15.00'},
	{texto: 'Snack', monto: 'S/ 3.50'},
	{texto: 'Recarga', monto: 'S/ 10.00'},
];

const Capas: React.FC<{T: Tiempos; fin: number}> = ({T, fin}) => {
	const frame = useCurrentFrame();
	const t = frame / FPS_ALCANZA;
	const {en, esc} = T;
	const fe = (id: string) => esc(id).fin;
	const notis = tramo(t, en('gancho', 'pagaste', 1), en('gancho', 'y'), 0, NOTIS.length, Easing.linear);
	const tecleo = (desde: number, hasta: number, texto: string) => texto.slice(0, Math.round(tramo(t, desde, hasta, 0, texto.length, Easing.linear)));
	const fijaDesde = en('fijas', 'uno') - 0.2;
	return (
		<>
			{/* gancho */}
			<Telefono desde={en('gancho', 'pagaste', 1) - 0.4} hasta={en('gancho', 'estás')} {...CEL}>
				<PantallaNotificaciones desde={en('gancho', 'pagaste', 1)} items={NOTIS} visibles={notis} />
			</Telefono>
			<Etiqueta texto="FIN DE MES" desde={0.1} hasta={en('gancho', 'pagaste', 1) - 0.4} x={540} y={330} pildora />
			<Etiqueta texto="¿Y MI DINERO?" desde={en('gancho', 'saldo')} hasta={fe('gancho')} x={540} y={330} tam={84} />

			{/* gastos hormiga */}
			<Etiqueta texto="GASTOS HORMIGA" desde={en('hormiga', 'gastos')} hasta={en('hormiga', 'S/ 1')} x={540} y={330} pildora />
			<Etiqueta texto="S/ 1" desde={en('hormiga', 'S/ 1')} hasta={en('hormiga', 'y')} x={360} y={420} tam={96} />
			<Etiqueta texto="S/ 10" desde={en('hormiga', 'S/ 10')} hasta={en('hormiga', 'y')} x={720} y={520} tam={96} />
			<Etiqueta texto="¡SE ESFUMÓ!" desde={en('hormiga', 'esfumó')} hasta={fe('hormiga')} x={540} y={330} tam={84} />

			{/* entra Alcanza */}
			<Logo desde={en('alcanza', 'alcanza')} hasta={en('alcanza', 'registras') - 0.2} />
			<Telefono desde={en('alcanza', 'registras') - 0.3} hasta={fe('alcanza') + 0.3} {...CEL}>
				{t < en('alcanza', 'organizas') ? (
					<PantallaInicio desde={en('alcanza', 'registras')} saldo={1240} gastado={1050} />
				) : (
					<PantallaCategorias desde={en('alcanza', 'organizas')} progreso={tramo(t, en('alcanza', 'organizas'), en('alcanza', 'mes'), 0, 1)} />
				)}
			</Telefono>
			<Etiqueta texto="AL INSTANTE" desde={en('alcanza', 'instante') - 0.1} hasta={en('alcanza', 'organizas')} x={540} y={250} pildora />
			<Etiqueta texto="¿EN QUÉ GASTÉ TANTO?" desde={en('alcanza', 'preguntándote')} hasta={fe('alcanza') + 0.3} x={540} y={250} tam={70} />

			{/* control */}
			<Etiqueta texto="ADIÓS EXCEL" desde={en('control', 'excel')} hasta={en('control', 'cuaderno')} x={540} y={330} />
			<Etiqueta texto="¿Y EL CUADERNO?" desde={en('control', 'cuaderno')} hasta={en('control', 'con')} x={540} y={330} />
			<Telefono desde={en('control', 'llevar') - 0.3} hasta={fe('control') + 0.3} {...CEL}>
				{t < en('control', 'ves') ? (
					<PantallaAnotar desde={en('control', 'llevar')} monto={tecleo(en('control', 'mandar'), en('control', 'texto'), '8.50')} categoria="Comida" guardado={tramo(t, en('control', 'texto') + 0.2, en('control', 'texto') + 0.6, 0, 1)} />
				) : (
					<PantallaCategorias desde={en('control', 'ves')} progreso={tramo(t, en('control', 'ves'), en('control', 'más'), 0, 1)} />
				)}
			</Telefono>
			<Etiqueta texto="COMO UN MENSAJE" desde={en('control', 'fácil')} hasta={en('control', 'ves')} x={540} y={250} pildora />

			{/* 3 fijas */}
			<Tarjeta titulo="3 CLAVES" desde={esc('fijas').inicio} hasta={fijaDesde} y={640} ancho={820}>
				<Lista desde={esc('fijas').inicio} items={['Registra al instante', 'Ponle límites a tus categorías', 'Revisa tus hábitos']} marcados={0} />
			</Tarjeta>
			<Etiqueta texto="1 · REGISTRA AL INSTANTE" desde={fijaDesde} hasta={en('fijas', 'dos')} x={540} y={250} tam={60} pildora />
			<Etiqueta texto="2 · PONLE LÍMITES" desde={en('fijas', 'dos')} hasta={en('fijas', 'tres')} x={540} y={250} tam={60} pildora />
			<Etiqueta texto="3 · REVISA TUS HÁBITOS" desde={en('fijas', 'tres')} hasta={fe('fijas')} x={540} y={250} tam={60} pildora />
			<Telefono desde={fijaDesde + 0.1} hasta={fe('fijas') + 0.3} {...CEL}>
				{t < en('fijas', 'dos') ? (
					<PantallaAnotar desde={fijaDesde} monto={tecleo(en('fijas', 'gasto'), en('fijas', 'almuerzo'), '18.00')} categoria="Comida" guardado={tramo(t, en('fijas', 'almuerzo') + 0.2, en('fijas', 'almuerzo') + 0.6, 0, 1)} />
				) : t < en('fijas', 'tres') ? (
					<PantallaLimites desde={en('fijas', 'dos')} progreso={tramo(t, en('fijas', 'dos'), en('fijas', 'salidas'), 0, 1)} />
				) : (
					<PantallaReporte desde={en('fijas', 'tres')} progreso={tramo(t, en('fijas', 'tres'), en('fijas', 'recortar'), 0, 1)} />
				)}
			</Telefono>

			{/* cierre */}
			<Etiqueta texto="DINERO QUE NO SE ANOTA…" desde={esc('cierre').inicio} hasta={en('cierre', 'evapora')} x={540} y={330} tam={64} />
			<Etiqueta texto="…SE EVAPORA" desde={en('cierre', 'evapora')} hasta={en('cierre', 'descarga')} x={540} y={330} tam={84} />
			<TarjetaCierre desde={en('cierre', 'descarga') - 0.2} hasta={fin + 5} />
		</>
	);
};

// ---------- sonido ----------
const Sfx: React.FC<{en: number; nombre: string; vol?: number}> = ({en, nombre, vol = 0.35}) => (
	<Sequence from={Math.max(0, Math.round(en * FPS_ALCANZA))} layout="none">
		<Audio src={staticFile(`${SONIDOS}/${nombre}.wav`)} volume={vol} />
	</Sequence>
);

const Sonidos: React.FC<{n: Narracion; T: Tiempos; lista: Toma[]}> = ({n, T, lista}) => {
	const {en, esc} = T;
	const ini = en('gancho', 'pagaste', 1);
	const fin = en('gancho', 'y');
	const notis = NOTIS.map((_, i) => ini + ((fin - ini) * (i + 0.5)) / NOTIS.length);
	const pops = [
		0.1, en('gancho', 'saldo'), en('hormiga', 'gastos'), en('hormiga', 'esfumó'), en('alcanza', 'instante'), en('alcanza', 'preguntándote'),
		en('control', 'excel'), en('control', 'cuaderno'), en('control', 'fácil'), esc('fijas').inicio, en('fijas', 'uno'), en('fijas', 'dos'),
		en('fijas', 'tres'), esc('cierre').inicio, en('cierre', 'evapora'),
	];
	const cortes = lista.slice(1).filter((x, i) => x.set !== lista[i].set).map((x) => x.desde);
	return (
		<>
			<Audio src={staticFile(n.audio)} volume={1} />
			<Audio src={staticFile(`${SONIDOS}/musica-larga.wav`)} volume={0.1} />
			{notis.map((x, i) => (
				<Sfx key={`n${i}`} en={x} nombre="pop" vol={0.3} />
			))}
			{pops.map((x, i) => (
				<Sfx key={`p${i}`} en={x} nombre="pop" vol={0.3} />
			))}
			{cortes.map((x, i) => (
				<Sfx key={`w${i}`} en={x - 0.15} nombre="whoosh" vol={0.25} />
			))}
			<Sfx en={en('hormiga', 'S/ 1')} nombre="moneda" />
			<Sfx en={en('hormiga', 'S/ 10')} nombre="moneda" />
			<Sfx en={en('hormiga', 'esfumó')} nombre="triste" vol={0.35} />
			<Sfx en={en('alcanza', 'alcanza')} nombre="sube" vol={0.4} />
			<Sfx en={en('control', 'imposibles') + 0.2} nombre="golpe" vol={0.35} />
			<Sfx en={en('control', 'texto') + 0.3} nombre="kaching" vol={0.35} />
			<Sfx en={en('fijas', 'almuerzo') + 0.3} nombre="kaching" vol={0.35} />
			<Sfx en={en('cierre', 'descarga') - 0.1} nombre="sube" vol={0.4} />
		</>
	);
};

// ---------- composición ----------
export const AlcanzaNarrado: React.FC<PropsAlcanza> = ({narracion}) => {
	const {width, height} = useVideoConfig();
	if (!narracion) {
		return (
			<AbsoluteFill style={{backgroundColor: '#222', color: '#fff', justifyContent: 'center', alignItems: 'center', fontSize: 44, padding: 80, textAlign: 'center', fontFamily: 'sans-serif'}}>
				Falta la narración: npx tsx herramientas/borradores/voz-finanzas.ts --tts --guion src/borradores/alcanza/guion.json --salida proyectos/2026-11-15-alcanza/voz
			</AbsoluteFill>
		);
	}
	const T = tiempos(narracion);
	const lista = tomas(T);
	const fin = narracion.duracion_s;
	return (
		<AbsoluteFill style={{backgroundColor: '#9fd3ef'}}>
			<ThreeCanvas width={width} height={height} shadows camera={{fov: 42, near: 0.05, far: 300}} gl={{antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping}}>
				<Mundo T={T} lista={lista} />
			</ThreeCanvas>
			<Capas T={T} fin={fin} />
			<Subtitulos palabras={narracion.palabras} ocultarEn={[[T.en('cierre', 'descarga') - 0.2, fin + 10]]} />
			<Sonidos n={narracion} T={T} lista={lista} />
		</AbsoluteFill>
	);
};
