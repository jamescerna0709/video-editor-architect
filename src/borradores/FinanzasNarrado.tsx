// Reel narrado de educación financiera (~100 s) con el estilo de las referencias del creador:
// dioramas 3D low-poly, subtítulo de una palabra, etiquetas amarillas y tarjetas blancas con encabezado rojo.
//
// TODO se amarra a la narración: proyectos/2026-11-15-finanzas-3d/voz/narracion.json (lo hace
// herramientas/borradores/voz-finanzas.ts, con voz sintética --tts o con la voz del creador --audio).
// Las tomas, tarjetas, etiquetas y sonidos se ubican por palabra ("en tal palabra de tal escena"), así que
// si cambia la voz, el video se reacomoda solo.
import {Audio} from '@remotion/media';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useLayoutEffect} from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {Anios, Comparar, Contador, Dias, Etiqueta, Lista, Precio, Subtitulos, Tarjeta} from './finanzas/capas';
import {Alcancia, Barrio, Billete, CajaFuerte, CasaCorte, Grafica3D, Luces, MESA_CASA, Persona, Tienda} from './finanzas/escenarios';
import {Banco, Moneda, TorreMonedas} from './finanzas/modelos';

export const FPS_NARRADO = 30;
const SONIDOS = 'p/2026-11-15-finanzas-3d/sonidos';
export const RUTA_NARRACION = 'p/2026-11-15-finanzas-3d/voz/narracion.json';

export type Palabra = {i: number; mostrar: string; inicio: number; fin: number; escena: string};
export type Narracion = {
	fuente: string;
	audio: string;
	duracion_s: number;
	escenas: {id: string; inicio: number; fin: number}[];
	palabras: Palabra[];
};
export type PropsNarrado = {narracion: Narracion | null};

// ---------- utilidades ----------
type V3 = [number, number, number];
const fijo = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const suave = Easing.inOut(Easing.cubic);
const tramo = (t: number, a: number, b: number, de: number, a2: number, easing = suave) =>
	b <= a ? (t >= b ? a2 : de) : interpolate(t, [a, b], [de, a2], {...fijo, easing});
const mezcla = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const normal = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9$%,]/g, '');

/** Ubica momentos de la narración por escena y palabra. */
const tiempos = (n: Narracion) => {
	const esc = (id: string) => {
		const e = n.escenas.find((x) => x.id === id);
		if (!e) throw new Error(`La narración no tiene la escena "${id}"`);
		return e;
	};
	const de = (id: string) => n.palabras.filter((p) => p.escena === id);
	/** inicio de la palabra `texto` (la `vez`-ésima) dentro de la escena; si no está, el inicio de la escena. */
	const en = (id: string, texto: string, vez = 1) => {
		const lista = de(id).filter((p) => normal(p.mostrar) === normal(texto));
		return (lista[vez - 1] ?? lista[lista.length - 1])?.inicio ?? esc(id).inicio;
	};
	const finDe = (id: string, texto: string, vez = 1) => {
		const lista = de(id).filter((p) => normal(p.mostrar) === normal(texto));
		return (lista[vez - 1] ?? lista[lista.length - 1])?.fin ?? esc(id).fin;
	};
	return {esc, en, finDe};
};
type Tiempos = ReturnType<typeof tiempos>;

// ---------- tomas de cámara: cada una va de una pose a otra, con cortes secos entre tomas ----------
type Pose = {pos: V3; mira: V3};
type Toma = {desde: number; hasta: number; set: SetId; a: Pose; b: Pose};
type SetId = 'gancho' | 'casa' | 'tienda' | 'banco' | 'grafica' | 'cierre';

const tomas = (T: Tiempos): Toma[] => {
	const e = T.esc;
	const lista: Omit<Toma, 'hasta'>[] = [
		// gancho: vista del barrio que baja hacia el billete
		{desde: 0, set: 'gancho', a: {pos: [0.6, 3.4, 8.5], mira: [0, 1.6, 0]}, b: {pos: [0.2, 1.9, 3.8], mira: [0, 1.7, 0]}},
		// ahorro: casa en corte, luego cerca de la alcancía
		{desde: e('ahorro').inicio, set: 'casa', a: {pos: [3.2, 4.2, 10], mira: [0, 2.2, 0]}, b: {pos: [1.6, 3.2, 7.5], mira: [0, 1.8, 0]}},
		{desde: T.en('ahorro', 'día'), set: 'casa', a: {pos: [MESA_CASA[0] + 1.4, MESA_CASA[1] + 0.9, MESA_CASA[2] + 3.2], mira: [MESA_CASA[0], MESA_CASA[1] + 0.3, MESA_CASA[2]]}, b: {pos: [MESA_CASA[0] + 0.6, MESA_CASA[1] + 0.7, MESA_CASA[2] + 2.6], mira: [MESA_CASA[0], MESA_CASA[1] + 0.25, MESA_CASA[2]]}},
		{desde: T.en('ahorro', 'al'), set: 'casa', a: {pos: [-2.5, 3.6, 9], mira: [0, 2, 0]}, b: {pos: [-1.2, 3.0, 8], mira: [0, 1.9, 0]}},
		// inflación: la tienda
		{desde: e('inflacion').inicio, set: 'tienda', a: {pos: [-3, 3.8, 9], mira: [0, 1.8, 0]}, b: {pos: [-1, 2.8, 6.8], mira: [0, 1.8, 0]}},
		{desde: T.en('inflacion', 'si'), set: 'tienda', a: {pos: [1.0, 2.5, 4.4], mira: [0, 2.1, 0]}, b: {pos: [0.4, 2.4, 3.8], mira: [0, 2.1, 0]}},
		{desde: T.en('inflacion', 'tus'), set: 'tienda', a: {pos: [2.5, 2.8, 6.5], mira: [0.4, 1.6, 0]}, b: {pos: [3.2, 3.2, 7.5], mira: [0.4, 1.7, 0]}},
		// intereses: el banco y la caja fuerte
		{desde: e('intereses').inicio, set: 'banco', a: {pos: [0, 6, 13], mira: [0, 1.6, -1]}, b: {pos: [-1, 3.2, 8.5], mira: [0.3, 1.4, -0.5]}},
		{desde: T.en('intereses', 'si'), set: 'banco', a: {pos: [3.2, 2.2, 5.5], mira: [1.6, 0.9, 0.5]}, b: {pos: [2.8, 2.0, 4.6], mira: [1.6, 0.9, 0.5]}},
		// compuesto: la gráfica que crece
		{desde: e('compuesto').inicio, set: 'grafica', a: {pos: [-3.5, 3.5, 8], mira: [0, 1.3, 0]}, b: {pos: [-1.5, 2.6, 6.5], mira: [0, 1.3, 0]}},
		{desde: T.en('compuesto', 'dos') - 0.4, set: 'grafica', a: {pos: [2.5, 2.4, 6], mira: [0.3, 1.4, 0]}, b: {pos: [3.5, 3.4, 7.5], mira: [0.3, 1.6, 0]}},
		// revisa: vuelta lenta al banco
		{desde: e('revisa').inicio, set: 'banco', a: {pos: [-4, 4, 9], mira: [0, 1.5, -1]}, b: {pos: [-2, 3.2, 10], mira: [0.5, 1.5, -1]}},
		// cierre: el barrio al atardecer
		{desde: e('cierre').inicio, set: 'cierre', a: {pos: [1, 2.4, 6], mira: [0, 1.2, 0]}, b: {pos: [0, 7.5, 15], mira: [0, 1.4, 0]}},
	];
	return lista.map((t, i) => ({...t, hasta: i + 1 < lista.length ? lista[i + 1].desde : Infinity}));
};

const tomaEn = (lista: Toma[], t: number) => lista.find((x) => t >= x.desde && t < x.hasta) ?? lista[lista.length - 1];

const Camara: React.FC<{toma: Toma; t: number; fin: number}> = ({toma, t, fin}) => {
	const {camera} = useThree();
	const hasta = Math.min(toma.hasta, fin);
	const k = tramo(t, toma.desde, hasta, 0, 1, Easing.inOut(Easing.sin));
	const pos = mezcla(toma.a.pos, toma.b.pos, k);
	const mira = mezcla(toma.a.mira, toma.b.mira, k);
	useLayoutEffect(() => {
		camera.position.set(...pos);
		camera.lookAt(new THREE.Vector3(...mira));
		camera.updateProjectionMatrix();
	});
	return null;
};

// ---------- el mundo: un decorado por toma ----------
const Mundo: React.FC<{T: Tiempos; lista: Toma[]; fin: number}> = ({T, lista, fin}) => {
	const frame = useCurrentFrame();
	const t = frame / FPS_NARRADO;
	const toma = tomaEn(lista, t);
	const e = T.esc;
	const tarde = toma.set === 'cierre' ? tramo(t, e('cierre').inicio, e('cierre').fin, 0.3, 1) : 0;

	return (
		<>
			<Camara toma={toma} t={t} fin={fin} />
			<Luces tarde={tarde} />
			<Barrio tarde={tarde} />
			{toma.set === 'gancho' && <SetGancho T={T} t={t} />}
			{toma.set === 'casa' && <SetCasa T={T} t={t} />}
			{toma.set === 'tienda' && <SetTienda T={T} t={t} />}
			{toma.set === 'banco' && <SetBanco T={T} t={t} />}
			{toma.set === 'grafica' && <SetGrafica T={T} t={t} />}
			{toma.set === 'cierre' && <SetCierre T={T} t={t} />}
		</>
	);
};

type PropsSet = {T: Tiempos; t: number};

const SetGancho: React.FC<PropsSet> = ({T, t}) => {
	const encoge = tramo(t, T.en('gancho', 'encogiendo'), T.finDe('gancho', 'menos'), 0, 1);
	return (
		<>
			<group position={[0, 1.7 + Math.sin(t * 1.5) * 0.06, 0]} rotation={[0.1, Math.sin(t * 0.6) * 0.5, 0]}>
				<Billete escala={2.6} encoge={encoge} valor="$100" />
			</group>
			<Persona position={[-1.6, 0, 0.8]} rotationY={0.5} />
		</>
	);
};

const SetCasa: React.FC<PropsSet> = ({T, t}) => {
	const [mx, my, mz] = MESA_CASA;
	// monedas que caen en la alcancía en "día uno", "día diez" y a lo largo del año
	const golpes = [T.en('ahorro', '$50'), T.en('ahorro', 'día', 1), T.en('ahorro', 'día', 2), T.en('ahorro', '$18,250')];
	const caidas: number[] = [...golpes];
	const iniAnio = T.en('ahorro', 'al');
	for (let i = 0; i < 10; i++) caidas.push(iniAnio + i * 0.18);
	const fondo = T.en('ahorro', 'felicidades');
	return (
		<>
			<CasaCorte />
			<Alcancia position={[mx, my, mz]} rotationY={0.5} escala={1.4} sacudida={Math.max(0, ...caidas.map((c) => tramo(t, c, c + 0.12, 0, 1) * tramo(t, c + 0.12, c + 0.45, 1, 0)))} />
			{caidas.map((c, i) => {
				const k = (t - (c - 0.4)) / 0.4;
				if (k < 0 || k > 1) return null;
				return <Moneda key={i} position={[mx + 0.02, my + 1.4 - k * k * 0.9, mz]} rotation={[Math.PI / 2, 0, k * 4]} escala={0.6} />;
			})}
			<Persona position={[mx - 1.0, 0.2, mz + 0.5]} rotationY={0.9} senala={tramo(t, golpes[0] - 0.3, golpes[0], 0, 1) * tramo(t, golpes[2] + 0.4, golpes[2] + 0.8, 1, 0)} celebra={tramo(t, fondo, fondo + 0.4, 0, 1)} />
		</>
	);
};

const SetTienda: React.FC<PropsSet> = ({T, t}) => {
	const sube = T.en('inflacion', '$105');
	const precio = t < sube ? '$100' : '$105';
	const encoge = tramo(t, T.en('inflacion', 'alcanzan'), T.finDe('inflacion', 'menos'), 0, 1);
	const ganchoBillete = T.en('inflacion', 'tus');
	return (
		<>
			<Tienda precio={precio} resaltar={tramo(t, sube - 0.1, sube + 0.2, 0, 1) * tramo(t, sube + 1.2, sube + 1.8, 1, 0)} />
			<Persona position={[-1.3, 0, 1.3]} rotationY={0.7} senala={tramo(t, T.en('inflacion', '$100') - 0.3, T.en('inflacion', '$100'), 0, 1)} />
			{t >= ganchoBillete - 2 && (
				<group position={[1.1, 1.4 + Math.sin(t * 2) * 0.05, 1.2]} rotation={[0.2, -0.4, 0.1]}>
					<Billete escala={1.3} encoge={encoge} valor="$100" />
				</group>
			)}
		</>
	);
};

const SetBanco: React.FC<PropsSet> = ({T, t}) => {
	const enIntereses = t < T.esc('revisa').inicio;
	const abre = enIntereses ? tramo(t, T.en('intereses', 'trabajar'), T.en('intereses', 'trabajar') + 0.8, 0, 1) : 1;
	const camina = enIntereses && t < T.en('intereses', 'si');
	const xPersona = enIntereses ? tramo(t, T.esc('intereses').inicio, T.en('intereses', 'si'), -2.4, 0.4) : 0.4;
	const gana = T.en('intereses', 'ganaste');
	return (
		<>
			<Banco position={[0, 0, -2.2]} escala={1} brillo={tramo(t, T.en('intereses', 'intereses'), T.en('intereses', 'intereses') + 0.5, 0, 1)} />
			<CajaFuerte position={[1.6, 0, 0.5]} rotationY={-0.4} abierta={abre} />
			<Persona position={[xPersona, 0, 1.2]} rotationY={camina ? Math.PI / 2 : 0.3} caminando={camina} celebra={enIntereses ? tramo(t, gana, gana + 0.4, 0, 1) : 0} />
		</>
	);
};

const VALORES = [18250, 20075, 22083, 24291, 26720, 29392];
const SetGrafica: React.FC<PropsSet> = ({T, t}) => {
	const e = T.esc('compuesto');
	const marcas = [e.inicio + 0.3, T.en('compuesto', 'interés') + 0.4, T.en('compuesto', 'dos'), T.en('compuesto', 'tres'), T.en('compuesto', 'cinco'), T.en('compuesto', '$29,392')];
	const barras = marcas.filter((m) => t >= m).length;
	const ultima = marcas[Math.max(0, barras - 1)];
	const progreso = (barras - 1 + tramo(t, ultima, ultima + 0.5, 0, 1)) / VALORES.length;
	const celebra = tramo(t, marcas[5], marcas[5] + 0.4, 0, 1);
	return (
		<>
			<Grafica3D valores={VALORES} etiquetas={['Hoy', 'Año 1', 'Año 2', 'Año 3', 'Año 4', 'Año 5']} progreso={Math.max(0, progreso)} />
			<Persona position={[-2.1, 0, 1.0]} rotationY={0.6} senala={tramo(t, e.inicio + 1, e.inicio + 1.5, 0, 1) * (1 - celebra)} celebra={celebra} />
		</>
	);
};

const SetCierre: React.FC<PropsSet> = ({T, t}) => {
	const crece = T.en('cierre', 'crece');
	return (
		<>
			<TorreMonedas position={[0.6, 0, 0]} cantidad={tramo(t, T.esc('cierre').inicio, crece + 0.5, 8, 30)} escala={1.6} />
			<Alcancia position={[-0.5, 0, 0.4]} rotationY={0.6} escala={1.6} />
			<Persona position={[-1.4, 0, 0.6]} rotationY={0.5} celebra={tramo(t, crece, crece + 0.4, 0, 1)} />
		</>
	);
};

// ---------- capa 2D: etiquetas y tarjetas amarradas a palabras ----------
const Capas: React.FC<{T: Tiempos}> = ({T}) => {
	const frame = useCurrentFrame();
	const t = frame / FPS_NARRADO;
	const {en, finDe, esc} = T;
	const fin = (id: string) => esc(id).fin;
	const precioCambio = tramo(t, en('inflacion', '$105') - 0.1, en('inflacion', '$105') + 0.3, 0, 1);
	const diasLlenos = t < en('ahorro', 'día', 1) ? 0 : t < en('ahorro', 'día', 2) ? 1 : Math.round(tramo(t, en('ahorro', 'día', 2), en('ahorro', '$500'), 1, 10));
	const marcados = [en('revisa', 'uno'), en('revisa', 'dos'), en('revisa', 'tres', 2)].filter((m) => t >= m).length;
	const aniosActivos = 1 + (t >= en('compuesto', 'dos') ? 1 : 0) + (t >= en('compuesto', 'tres') ? 1 : 0) + (t >= en('compuesto', 'cinco') ? 2 : 0);
	return (
		<>
			{/* gancho */}
			<Etiqueta texto="SE ENCOGE" desde={en('gancho', 'encogiendo')} hasta={en('gancho', 'aunque')} x={540} y={360} />
			<Etiqueta texto="COMPRA MENOS" desde={en('gancho', 'compra')} hasta={en('gancho', 'te')} x={540} y={360} pildora />

			{/* ahorro */}
			<Etiqueta texto="$50 DIARIOS" desde={en('ahorro', '$50')} hasta={en('ahorro', 'día')} x={540} y={360} />
			<Tarjeta titulo="DÍAS" desde={en('ahorro', 'día')} hasta={en('ahorro', 'al')} y={640}>
				<Dias desde={en('ahorro', 'día')} total={10} llenos={diasLlenos} />
			</Tarjeta>
			<Tarjeta titulo="EN 1 AÑO" desde={en('ahorro', 'tienes')} hasta={en('ahorro', 'felicidades') + 0.6} y={640}>
				<Contador desde={en('ahorro', 'tienes')} de={0} a={18250} dura={Math.max(0.8, finDe('ahorro', '$18,250') - en('ahorro', 'tienes'))} prefijo="$" />
			</Tarjeta>
			<Etiqueta texto="¡YA TIENES UN FONDO!" desde={en('ahorro', 'fondo') - 0.3} hasta={fin('ahorro')} x={540} y={360} />

			{/* inflación */}
			<Etiqueta texto="INFLACIÓN" desde={en('inflacion', 'inflación')} hasta={en('inflacion', 'si')} x={540} y={360} pildora />
			<Tarjeta titulo="PRECIO" desde={en('inflacion', '$100')} hasta={en('inflacion', 'tus')} y={640}>
				<Precio desde={en('inflacion', '$100')} antes="$100" despues="$105" cambio={precioCambio} />
			</Tarjeta>
			<Tarjeta titulo="EN 1 AÑO" desde={en('inflacion', 'en')} hasta={en('inflacion', 'perdiste')} y={640} ancho={760}>
				<Comparar desde={en('inflacion', 'en')} izq={{titulo: 'Hoy', valor: '$18,250'}} der={{titulo: 'Vale como', valor: '$17,381', color: '#e8423a'}} ganador="izq" />
			</Tarjeta>
			<Etiqueta texto="-$869" desde={en('inflacion', 'perdiste')} hasta={fin('inflacion')} x={540} y={360} tam={130} />

			{/* intereses */}
			<Etiqueta texto="INTERESES" desde={en('intereses', 'intereses')} hasta={en('intereses', 'si')} x={540} y={360} pildora />
			<Tarjeta titulo="10% AL AÑO" desde={en('intereses', 'si')} hasta={en('intereses', 'le')} y={640}>
				<Contador desde={en('intereses', '$20,075')} de={18250} a={20075} dura={0.9} prefijo="$" color="#21a65b" />
			</Tarjeta>
			<Tarjeta titulo="¿QUIÉN GANA?" desde={en('intereses', 'le')} hasta={fin('intereses')} y={640} ancho={760}>
				<Comparar desde={en('intereses', 'le')} izq={{titulo: 'Inflación', valor: '5%'}} der={{titulo: 'Tu cuenta', valor: '10%', color: '#21a65b'}} ganador="der" />
			</Tarjeta>

			{/* compuesto */}
			<Etiqueta texto="INTERÉS COMPUESTO" desde={en('compuesto', 'interés')} hasta={en('compuesto', 'dos') - 0.4} x={540} y={360} />
			<Tarjeta titulo="SIN METER MÁS" desde={en('compuesto', 'dos') - 0.3} hasta={fin('compuesto')} y={640} ancho={860}>
				<Anios desde={en('compuesto', 'dos') - 0.3} activos={aniosActivos} valores={['$20,075', '$22,083', '$24,291', '$26,720', '$29,392']} />
			</Tarjeta>

			{/* revisa */}
			<Tarjeta titulo="REVISA" desde={en('revisa', 'revisa')} hasta={fin('revisa')} y={640} ancho={800}>
				<Lista desde={en('revisa', 'revisa')} items={['Que esté regulada', 'Cuánto paga al año con comisiones', 'Si puedes sacar tu dinero']} marcados={marcados} />
			</Tarjeta>

			{/* cierre */}
			<Etiqueta texto="PIERDE VALOR" desde={en('cierre', 'pierde')} hasta={en('cierre', 'el', 3)} x={540} y={360} pildora />
			<Etiqueta texto="¡CRECE!" desde={en('cierre', 'crece')} hasta={fin('cierre') + 3} x={540} y={360} tam={130} />
		</>
	);
};

// ---------- sonido: efectos amarrados a palabras ----------
const Sfx: React.FC<{en: number; nombre: string; vol?: number}> = ({en, nombre, vol = 0.5}) => (
	<Sequence from={Math.max(0, Math.round(en * FPS_NARRADO))} layout="none">
		<Audio src={staticFile(`${SONIDOS}/${nombre}.wav`)} volume={vol} />
	</Sequence>
);

const Sonidos: React.FC<{n: Narracion; T: Tiempos; lista: Toma[]}> = ({n, T, lista}) => {
	const {en, esc} = T;
	const pops = [
		en('gancho', 'encogiendo'), en('gancho', 'compra'), en('ahorro', '$50'), en('ahorro', 'día'), en('ahorro', 'tienes'),
		en('inflacion', 'inflación'), en('inflacion', '$100'), en('inflacion', 'en'), en('intereses', 'intereses'), en('intereses', 'si'),
		en('intereses', 'le'), en('compuesto', 'interés'), en('compuesto', 'dos') - 0.3, en('revisa', 'revisa'), en('revisa', 'uno'),
		en('revisa', 'dos'), en('revisa', 'tres', 2), en('cierre', 'pierde'),
	];
	const cortes = lista.slice(1).filter((x, i) => x.set !== lista[i].set).map((x) => x.desde);
	return (
		<>
			<Audio src={staticFile(n.audio)} volume={1} />
			<Audio src={staticFile(`${SONIDOS}/musica-larga.wav`)} volume={0.1} />
			{pops.map((p, i) => (
				<Sfx key={`p${i}`} en={p} nombre="pop" vol={0.35} />
			))}
			{cortes.map((c, i) => (
				<Sfx key={`w${i}`} en={c - 0.15} nombre="whoosh" vol={0.3} />
			))}
			{[en('ahorro', '$50'), en('ahorro', 'día', 1), en('ahorro', 'día', 2)].map((m, i) => (
				<Sfx key={`m${i}`} en={m} nombre="moneda" vol={0.4} />
			))}
			<Sfx en={en('ahorro', 'al')} nombre="monedas" vol={0.4} />
			<Sfx en={en('ahorro', 'felicidades')} nombre="kaching" vol={0.45} />
			<Sfx en={en('inflacion', '$105')} nombre="boing" vol={0.35} />
			<Sfx en={en('inflacion', 'perdiste')} nombre="triste" vol={0.4} />
			<Sfx en={en('intereses', 'trabajar')} nombre="golpe" vol={0.4} />
			<Sfx en={en('intereses', '$20,075')} nombre="kaching" vol={0.45} />
			{[en('compuesto', 'dos'), en('compuesto', 'tres'), en('compuesto', '$29,392')].map((m, i) => (
				<Sfx key={`a${i}`} en={m} nombre="monedas" vol={0.35} />
			))}
			<Sfx en={en('compuesto', '$29,392') + 0.3} nombre="sube" vol={0.4} />
			<Sfx en={en('cierre', 'crece')} nombre="sube" vol={0.45} />
			<Sfx en={esc('cierre').fin + 0.2} nombre="kaching" vol={0.4} />
		</>
	);
};

// ---------- composición ----------
export const FinanzasNarrado: React.FC<PropsNarrado> = ({narracion}) => {
	const {width, height} = useVideoConfig();
	const frame = useCurrentFrame();
	if (!narracion) {
		return (
			<AbsoluteFill style={{backgroundColor: '#222', color: '#fff', justifyContent: 'center', alignItems: 'center', fontSize: 48, padding: 80, textAlign: 'center', fontFamily: 'sans-serif'}}>
				Falta la narración: corre npx tsx herramientas/borradores/voz-finanzas.ts --tts
			</AbsoluteFill>
		);
	}
	const T = tiempos(narracion);
	const lista = tomas(T);
	const fin = narracion.duracion_s + 1.5;
	const aviso = interpolate(frame / FPS_NARRADO, [T.esc('cierre').inicio, T.esc('cierre').inicio + 0.4], [0, 1], fijo);
	return (
		<AbsoluteFill style={{backgroundColor: '#9fd3ef'}}>
			<ThreeCanvas width={width} height={height} shadows camera={{fov: 42, near: 0.1, far: 300}} gl={{antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping}}>
				<Mundo T={T} lista={lista} fin={fin} />
			</ThreeCanvas>
			<Capas T={T} />
			<Subtitulos palabras={narracion.palabras} />
			<AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 250, opacity: aviso}}>
				<div style={{fontFamily: 'sans-serif', fontWeight: 700, fontSize: 32, color: '#14110f', background: 'rgba(255,255,255,0.85)', padding: '10px 24px', borderRadius: 18}}>
					Cifras de ejemplo. No es asesoría financiera.
				</div>
			</AbsoluteFill>
			<Sonidos n={narracion} T={T} lista={lista} />
		</AbsoluteFill>
	);
};
