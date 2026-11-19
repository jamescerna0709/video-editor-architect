// Reel "El caso del yapeo fantasma" (Alcanza, app del creador), ~78 s, con la voz del creador.
// Todo se amarra a la narración: proyectos/2026-11-19-alcanza-detective/voz/narracion.json
// (herramientas/borradores/voz-finanzas.ts --audio … --guion src/borradores/detective/guion.json).
// Las tres pistas son flashbacks en blanco y negro (FiltroPorTiempos envuelve el lienzo 3D).
// Yape es marca de terceros: no se muestra; las pantallas de pagos son genéricas.
// Cámara: mira fija por toma, acercamiento corto y quieta.
import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useLayoutEffect} from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {tiempos, type Narracion, type Tiempos} from './FinanzasNarrado';
import {Etiqueta, Subtitulos} from './finanzas/capas';
import {Luces} from './finanzas/escenarios';
import {Protagonista} from './alcanza/props3d';
import {PantallaPagos, PantallaPasarGastos, Telefono, type MovimientoPago} from './alcanza/telefono';
import {CierreDetective, Expediente, FiltroPorTiempos, PistaTitulo, Sello} from './detective/capas-detective';
import {CAMA_SENTADO, ChorroAgua, Cocina, Cuarto, GRIFO, LAVADERO_FONDO, LucesCuarto, VasoAgua} from './detective/sets-cuarto';
import {CalleTarde, MesaNoche, PARADA, Restaurante, SILLA, SILLA_PROTA, Salchipapa} from './detective/sets-flashback';

export const FPS_DETECTIVE = 30;
const SONIDOS = 'p/2026-11-19-alcanza-detective/sonidos';
export const RUTA_NARRACION_DETECTIVE = 'p/2026-11-19-alcanza-detective/voz/narracion.json';
export type PropsDetective = {narracion: Narracion | null};

type V3 = [number, number, number];
const fijo = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const tramo = (t: number, a: number, b: number, de: number, a2: number, easing = Easing.inOut(Easing.cubic)) =>
	b <= a ? (t >= b ? a2 : de) : interpolate(t, [a, b], [de, a2], {...fijo, easing});
const mezcla = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const suma = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Pagos de ayer, del más nuevo al más viejo. Cuadra con el guion:
// 180 − 22 − 10 − 6 − 127.50 + 3 × 30 − 90 = 14.50
const MOVIMIENTOS: MovimientoPago[] = [
	{hora: '23:58', texto: 'Delivery salchipapa', monto: 'S/ 90.00', tipo: 'sale'},
	{hora: '21:42', texto: 'Te pagó Luis', monto: 'S/ 30.00', tipo: 'entra'},
	{hora: '21:41', texto: 'Te pagó Ana', monto: 'S/ 30.00', tipo: 'entra'},
	{hora: '21:40', texto: 'Te pagó Pedro', monto: 'S/ 30.00', tipo: 'entra'},
	{hora: '21:15', texto: 'Cena (toda la cuenta)', monto: 'S/ 127.50', tipo: 'sale'},
	{hora: '18:10', texto: 'Bodega: gaseosa y galletas', monto: 'S/ 6.00', tipo: 'sale'},
	{hora: '18:02', texto: 'Taxi', monto: 'S/ 10.00', tipo: 'sale'},
	{hora: '13:30', texto: 'Menú + chicha + postre', monto: 'S/ 22.00', tipo: 'sale'},
];

// ---------- tomas ----------
type SetId = 'cuarto' | 'restaurante' | 'calle' | 'noche' | 'salchipapa' | 'cocina';
type Toma = {desde: number; hasta: number; set: SetId; de: V3; a: V3; mira: V3; dura?: number};

const tomas = (T: Tiempos): Toma[] => {
	const {en, esc} = T;
	const cara = suma(CAMA_SENTADO, [0, 1.25, 0]); // cara del protagonista sentado
	const lista: Omit<Toma, 'hasta'>[] = [
		// gancho: primer plano dramático en la cama, luego más abierto
		{desde: 0, set: 'cuarto', de: suma(cara, [0.15, 0.05, 1.0]), a: suma(cara, [0.1, 0.02, 0.8]), mira: suma(cara, [0, -0.08, 0]), dura: 3},
		{desde: en('gancho', 'así'), set: 'cuarto', de: suma(cara, [1.0, 0.4, 3.2]), a: suma(cara, [0.8, 0.3, 2.6]), mira: suma(cara, [0, -0.3, 0])},
		// pista 1: título en el cuarto, flashback en el restaurante
		{desde: esc('pista1').inicio, set: 'cuarto', de: suma(cara, [-0.6, 0.2, 2.2]), a: suma(cara, [-0.5, 0.15, 1.8]), mira: suma(cara, [0, -0.2, 0])},
		{desde: en('pista1', 'el'), set: 'restaurante', de: suma(SILLA, [1.6, 1.8, 3.6]), a: suma(SILLA, [1.3, 1.6, 3.0]), mira: suma(SILLA, [0.5, 0.8, 0])},
		{desde: en('pista1', 'pide', 2), set: 'restaurante', de: suma(SILLA, [0.9, 1.4, 1.8]), a: suma(SILLA, [0.8, 1.3, 1.5]), mira: suma(SILLA, [0.6, 0.85, -0.3])},
		// pista 2: título en el cuarto, flashback en la calle (taxi, luego bodega)
		{desde: esc('pista2').inicio, set: 'cuarto', de: suma(cara, [0.7, 0.25, 2.2]), a: suma(cara, [0.6, 0.2, 1.8]), mira: suma(cara, [0, -0.25, 0])},
		{desde: en('pista2', 'el'), set: 'calle', de: suma(PARADA, [1.5, 2.2, 6.5]), a: suma(PARADA, [1.2, 2.0, 5.6]), mira: suma(PARADA, [0.8, 1.0, -1.0])},
		{desde: en('pista2', 'de', 2), set: 'calle', de: suma(PARADA, [2.6, 1.8, 4.2]), a: suma(PARADA, [2.4, 1.6, 3.6]), mira: suma(PARADA, [2.8, 0.9, -0.8])},
		// pista 3: título en el cuarto (manos en la cabeza), flashback de noche y salchipapa
		{desde: esc('pista3').inicio, set: 'cuarto', de: suma(cara, [0, 0.3, 2.6]), a: suma(cara, [0, 0.25, 2.1]), mira: suma(cara, [0, -0.15, 0])},
		{desde: en('pista3', 'el'), set: 'noche', de: suma(SILLA_PROTA, [0.4, 2.2, 4.8]), a: suma(SILLA_PROTA, [0.3, 1.9, 4.0]), mira: suma(SILLA_PROTA, [0.6, 0.8, -0.8])},
		{desde: en('pista3', 'y', 2), set: 'salchipapa', de: [0.5, 0.9, 1.6], a: [0.4, 0.75, 1.25], mira: [0, 0.15, 0]},
		// cierre: noche en la cama, tranquilo
		{desde: esc('cierre').inicio, set: 'cuarto', de: suma(cara, [0.9, 0.3, 2.8]), a: suma(cara, [0.7, 0.2, 2.2]), mira: suma(cara, [0, -0.25, 0])},
		// remate: cocina, mirando a cámara
		{desde: esc('remate').inicio, set: 'cocina', de: suma(GRIFO, [0.2, -0.3, 2.6]), a: suma(GRIFO, [0.15, -0.35, 2.1]), mira: suma(GRIFO, [0.6, -0.55, 0.4])},
	];
	return lista.map((t, i) => ({...t, hasta: i + 1 < lista.length ? lista[i + 1].desde : Infinity}));
};
const tomaEn = (lista: Toma[], t: number) => lista.find((x) => t >= x.desde && t < x.hasta) ?? lista[lista.length - 1];

const Camara: React.FC<{toma: Toma; t: number}> = ({toma, t}) => {
	const {camera} = useThree();
	const dura = Math.min(toma.dura ?? 2.5, (toma.hasta - toma.desde) * 0.8);
	const pos = mezcla(toma.de, toma.a, tramo(t, toma.desde, toma.desde + dura, 0, 1, Easing.out(Easing.cubic)));
	useLayoutEffect(() => {
		camera.position.set(...pos);
		camera.lookAt(new THREE.Vector3(...toma.mira));
		camera.updateProjectionMatrix();
	});
	return null;
};

// ---------- decorados ----------
type PropsSet = {T: Tiempos; t: number};

const SetCuarto: React.FC<PropsSet> = ({T, t}) => {
	const {en, esc} = T;
	const noche = t >= esc('cierre').inicio ? 1 : 0;
	// lentes: se los pone en "detective" y se los quita en "caso cerrado"
	const lentes = t < esc('cierre').inicio ? tramo(t, en('gancho', 'detective'), en('gancho', 'detective') + 0.6, 0, 1) : tramo(t, en('cierre', 'caso'), en('cierre', 'caso') + 0.7, 1, 0);
	const enPista = (id: string) => t >= esc(id).inicio && t < esc(id).fin;
	const animo = t < en('gancho', 'así') ? 'panico' : t >= esc('cierre').inicio ? 'normal' : 'serio';
	return (
		<>
			<LucesCuarto noche={noche} />
			<Cuarto noche={noche} />
			<Protagonista
				position={CAMA_SENTADO}
				sentado
				animo={animo}
				lentes={lentes}
				conCelular={t < en('gancho', 'así') || t >= esc('cierre').inicio ? 1 : 0}
				anotando={enPista('pista1') || enPista('pista2') ? 1 : 0}
				manosCabeza={enPista('pista3') ? tramo(t, esc('pista3').inicio, esc('pista3').inicio + 0.4, 0, 1) : 0}
			/>
		</>
	);
};

const SetRestaurante: React.FC<PropsSet> = ({T, t}) => (
	<>
		<Luces />
		<Restaurante chicha={tramo(t, T.en('pista1', 'chicha') - 0.1, T.en('pista1', 'chicha') + 0.3, 0, 1)} postre={tramo(t, T.en('pista1', 'postre') - 0.1, T.en('pista1', 'postre') + 0.3, 0, 1)} />
		<Protagonista position={SILLA} sentado animo="feliz" />
	</>
);

const SetCalle: React.FC<PropsSet> = ({T, t}) => (
	<>
		<Luces tarde={0.8} />
		<CalleTarde taxi={tramo(t, T.en('pista2', 'un'), T.en('pista2', 'S/ 10'), 0, 1)} bodega={tramo(t, T.en('pista2', 'gaseosa') - 0.2, T.en('pista2', 'galletas') + 0.2, 0, 1)} />
		<Protagonista position={PARADA} rotationY={0.3} animo="normal" />
	</>
);

const SetNoche: React.FC<PropsSet> = ({T, t}) => (
	<>
		<LucesCuarto noche={1} />
		<MesaNoche cuenta={tramo(t, T.en('pista3', 'muchachos'), T.en('pista3', 'cuenta'), 0, 1)} amigos={tramo(t, T.en('pista3', 'ustedes'), T.en('pista3', 'yapean') + 0.3, 0, 1)} />
		<Protagonista position={SILLA_PROTA} sentado animo="feliz" celebra={tramo(t, T.en('pista3', 'muchachos'), T.en('pista3', 'muchachos') + 0.4, 0, 1)} />
	</>
);

const SetSalchipapa: React.FC<PropsSet> = ({T, t}) => (
	<>
		<LucesCuarto noche={1} />
		<Salchipapa abierta={tramo(t, T.en('pista3', 'salchipapa') - 0.2, T.en('pista3', 'salchipapa') + 0.4, 0, 1)} />
	</>
);

const SetCocina: React.FC<PropsSet> = ({T, t}) => {
	const agua = T.en('remate', 'toma');
	return (
		<>
			<LucesCuarto noche={0} lampara={null} />
			<Cocina />
			<ChorroAgua position={GRIFO} activo={tramo(t, T.esc('remate').inicio, T.esc('remate').inicio + 0.3, 0, 1) * tramo(t, agua - 0.3, agua, 1, 0)} />
			<VasoAgua position={LAVADERO_FONDO} nivel={tramo(t, T.esc('remate').inicio, agua, 0.2, 0.9)} />
			{/* sostiene otro vaso a la altura del pecho y bebe en "agüita" (vaso=1 le tapa la boca, así que solo un momento) */}
			<Protagonista
				position={[GRIFO[0] + 0.6, 0, GRIFO[2] + 0.6]}
				rotationY={0}
				animo="serio"
				vaso={0.5 + 0.5 * tramo(t, T.en('remate', 'agüita') - 0.1, T.en('remate', 'agüita') + 0.3, 0, 1) * tramo(t, T.en('remate', 'y', 1) + 0.2, T.en('remate', 'reflexiona'), 1, 0)}
				pan
			/>
		</>
	);
};

const Mundo: React.FC<{T: Tiempos; lista: Toma[]}> = ({T, lista}) => {
	const frame = useCurrentFrame();
	const t = frame / FPS_DETECTIVE;
	const toma = tomaEn(lista, t);
	const p = {T, t};
	return (
		<>
			<Camara toma={toma} t={t} />
			{toma.set === 'cuarto' && <SetCuarto {...p} />}
			{toma.set === 'restaurante' && <SetRestaurante {...p} />}
			{toma.set === 'calle' && <SetCalle {...p} />}
			{toma.set === 'noche' && <SetNoche {...p} />}
			{toma.set === 'salchipapa' && <SetSalchipapa {...p} />}
			{toma.set === 'cocina' && <SetCocina {...p} />}
		</>
	);
};

// ---------- capa 2D ----------
const CEL = {x: 540, y: 722, escala: 0.94};

const Capas: React.FC<{T: Tiempos; fin: number}> = ({T, fin}) => {
	const frame = useCurrentFrame();
	const t = frame / FPS_DETECTIVE;
	const {en, esc} = T;
	const fe = (id: string) => esc(id).fin;
	// el celular de la mañana: el saldo
	const celGancho: [number, number] = [en('gancho', 'ayer') - 0.3, en('gancho', 'así')];
	// cierre: historial y luego Alcanza
	const celCierre: [number, number] = [en('cierre', 'ahora'), fe('cierre') + 0.4];
	// "tres sí le yapearon": pagos que entran
	const celSpoiler: [number, number] = [en('pista3', 'spoiler') - 0.2, en('pista3', 'y', 2)];
	return (
		<>
			{/* gancho */}
			<Etiqueta texto="99% SEGURO" desde={en('gancho', '99%')} hasta={en('gancho', 'ayer') - 0.3} x={540} y={300} pildora />
			<Telefono desde={celGancho[0]} hasta={celGancho[1]} {...CEL}>
				<PantallaPagos desde={celGancho[0]} saldo="S/ 14.50" movimientos={MOVIMIENTOS} visibles={tramo(t, en('gancho', 'S/ 14.50'), en('gancho', 'así'), 0, 6, Easing.linear)} />
			</Telefono>
			<Etiqueta texto="MODO DETECTIVE" desde={en('gancho', 'detective')} hasta={fe('gancho') + 0.4} x={540} y={300} />

			{/* pista 1 */}
			<PistaTitulo desde={esc('pista1').inicio} hasta={en('pista1', 'el') - 0.05} numero={1} hora="1:30 PM" />
			<Etiqueta texto="MENÚ S/ 12" desde={en('pista1', 'S/ 12')} hasta={en('pista1', 'pide', 2)} x={540} y={300} pildora />
			<Expediente desde={en('pista1', 'merece') - 0.3} hasta={fe('pista1') + 0.3} numero="1" titulo={'El "me lo merezco"'} subtitulo="−S/ 22" />

			{/* pista 2 */}
			<PistaTitulo desde={esc('pista2').inicio} hasta={en('pista2', 'el') - 0.05} numero={2} hora="6:00 PM" />
			<Etiqueta texto="MICRO LLENO" desde={en('pista2', 'micro')} hasta={en('pista2', 'un')} x={540} y={300} pildora />
			<Etiqueta texto="TAXI: S/ 10" desde={en('pista2', 'S/ 10')} hasta={en('pista2', 'de', 2)} x={540} y={300} />
			<Expediente desde={en('pista2', 'otros') - 0.2} hasta={fe('pista2') + 0.3} numero="2" titulo={'El "son solo 10 soles"'} subtitulo="−S/ 16" />

			{/* pista 3 */}
			<PistaTitulo desde={esc('pista3').inicio} hasta={en('pista3', 'el') - 0.05} numero={3} hora="9:00 PM" />
			<Etiqueta texto="YO PAGO TODO" desde={en('pista3', 'yo')} hasta={en('pista3', 'spoiler') - 0.2} x={540} y={300} pildora />
			<Telefono desde={celSpoiler[0]} hasta={celSpoiler[1]} {...CEL}>
				<PantallaPagos desde={celSpoiler[0]} saldo="S/ 104.50" movimientos={MOVIMIENTOS.slice(1)} visibles={tramo(t, en('pista3', 'tres'), en('pista3', 'yapearon') + 0.4, 0, 3, Easing.linear)} resaltar={0} />
			</Telefono>
			<Expediente desde={en('pista3', 'salchipapa')} hasta={esc('cierre').inicio + 0.5} culpable titulo="Yo mismo" subtitulo="Culpable confirmado" />

			{/* cierre */}
			<Sello desde={en('cierre', 'cerrado')} hasta={en('cierre', 'como')} texto="CASO CERRADO" y={760} />
			<Etiqueta texto="AMNESIA FINANCIERA" desde={en('cierre', 'amnesia')} hasta={en('cierre', 'como')} x={540} y={300} pildora />
			<Telefono desde={celCierre[0]} hasta={celCierre[1]} {...CEL}>
				{t < en('cierre', 'paso') ? (
					<PantallaPagos desde={celCierre[0]} saldo="S/ 14.50" movimientos={MOVIMIENTOS} visibles={6} />
				) : (
					<PantallaPasarGastos desde={en('cierre', 'paso')} progreso={tramo(t, en('cierre', 'paso'), en('cierre', 'frenar') + 0.3, 0, 1, Easing.linear)} />
				)}
			</Telefono>

			{/* remate y cierre de marca */}
			<CierreDetective desde={en('remate', 'reflexiona') + 0.2} hasta={fin + 5} />
		</>
	);
};

// ---------- sonido ----------
const Sfx: React.FC<{en: number; nombre: string; vol?: number}> = ({en, nombre, vol = 0.35}) => (
	<Sequence from={Math.max(0, Math.round(en * FPS_DETECTIVE))} layout="none">
		<Audio src={staticFile(`${SONIDOS}/${nombre}.wav`)} volume={vol} />
	</Sequence>
);

const Sonidos: React.FC<{n: Narracion; T: Tiempos; flash: {desde: number}[]}> = ({n, T, flash}) => {
	const {en, esc} = T;
	return (
		<>
			<Audio src={staticFile(n.audio)} volume={1} />
			<Audio src={staticFile(`${SONIDOS}/musica-detective.wav`)} volume={0.12} />
			<Sfx en={en('gancho', 'clonaron')} nombre="dun" vol={0.3} />
			<Sfx en={en('gancho', 'ayer') - 0.2} nombre="notif" vol={0.35} />
			<Sfx en={en('gancho', 'detective')} nombre="pop" vol={0.3} />
			{['pista1', 'pista2', 'pista3'].map((p) => (
				<Sfx key={p} en={esc(p).inicio} nombre="maquina" vol={0.3} />
			))}
			{flash.map((f, i) => (
				<Sfx key={`r${i}`} en={f.desde - 0.1} nombre="rebobinar" vol={0.35} />
			))}
			<Sfx en={en('pista1', 'chicha')} nombre="pop" vol={0.3} />
			<Sfx en={en('pista1', 'postre')} nombre="pop" vol={0.3} />
			<Sfx en={en('pista1', 'S/ 22')} nombre="moneda" />
			<Sfx en={en('pista2', 'taxi')} nombre="whoosh" vol={0.3} />
			<Sfx en={en('pista2', 'S/ 16')} nombre="moneda" />
			<Sfx en={en('pista3', 'tres')} nombre="notif" vol={0.3} />
			<Sfx en={en('pista3', 'yapearon')} nombre="notif" vol={0.3} />
			<Sfx en={en('pista3', 'salchipapa')} nombre="dun" vol={0.35} />
			<Sfx en={en('cierre', 'cerrado')} nombre="sello" vol={0.45} />
			<Sfx en={en('cierre', 'frenar')} nombre="kaching" vol={0.3} />
			<Sfx en={en('remate', 'no', 1)} nombre="grillos" vol={0.25} />
			<Sfx en={en('remate', 'agüita')} nombre="glup" vol={0.4} />
		</>
	);
};

// ---------- composición ----------
export const DetectiveNarrado: React.FC<PropsDetective> = ({narracion}) => {
	const {width, height} = useVideoConfig();
	if (!narracion) {
		return (
			<AbsoluteFill style={{backgroundColor: '#222', color: '#fff', justifyContent: 'center', alignItems: 'center', fontSize: 44, padding: 80, textAlign: 'center', fontFamily: 'sans-serif'}}>
				Falta la narración: npx tsx herramientas/borradores/voz-finanzas.ts --audio &lt;voz&gt; --guion src/borradores/detective/guion.json --salida proyectos/2026-11-19-alcanza-detective/voz
			</AbsoluteFill>
		);
	}
	const T = tiempos(narracion);
	const lista = tomas(T);
	const fin = narracion.duracion_s;
	// flashbacks: desde que empieza el recuerdo ("El sospechoso…") hasta el fin de cada pista
	const flash = [
		{desde: T.en('pista1', 'el'), hasta: T.esc('pista1').fin + 0.3, hora: '1:30 PM'},
		{desde: T.en('pista2', 'el'), hasta: T.esc('pista2').fin + 0.3, hora: '6:00 PM'},
		{desde: T.en('pista3', 'el'), hasta: T.esc('pista3').fin + 0.3, hora: '9:00 PM'},
	];
	return (
		<AbsoluteFill style={{backgroundColor: '#1b2333'}}>
			<FiltroPorTiempos rangos={flash}>
				<ThreeCanvas width={width} height={height} shadows camera={{fov: 42, near: 0.05, far: 300}} gl={{antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping}}>
					<Mundo T={T} lista={lista} />
				</ThreeCanvas>
			</FiltroPorTiempos>
			<Capas T={T} fin={fin} />
			<Subtitulos palabras={narracion.palabras} ocultarEn={[[T.en('remate', 'reflexiona') + 0.2 + 0.9, fin + 10]]} />
			<Sonidos n={narracion} T={T} flash={flash} />
		</AbsoluteFill>
	);
};
