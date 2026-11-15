// Copyright (c) 2026 Enrique Rocha (@soyenriquerocha)
// SPDX-License-Identifier: MIT
// id: er-2f298797
import {Composition} from 'remotion';
import {Reel} from './reel/Reel';
import {EdicionBase, edicionVacia, type Edicion} from './esquema/edicion';
import {Personajes3D} from './borradores/Personajes3D';
import {FinanzasTresD, DURACION_FINANZAS} from './borradores/FinanzasTresD';
import {FinanzasNarrado, FPS_NARRADO, RUTA_NARRACION, type Narracion, type PropsNarrado} from './borradores/FinanzasNarrado';
import {staticFile} from 'remotion';
import {AlcanzaNarrado, FPS_ALCANZA, RUTA_NARRACION_ALCANZA, type PropsAlcanza} from './borradores/AlcanzaNarrado';

/**
 * Una sola composición. La duración sale de la EDL (`duracion_s`) vía calculateMetadata,
 * así cada render dura lo que diga edicion-vN.json y no lo que diga este archivo.
 * Ojo: Remotion NO valida las props contra el schema al renderizar; eso lo hace herramientas/validar.ts.
 */
export const RemotionRoot: React.FC = () => (
	<>
	<Composition
		id="Reel"
		component={Reel}
		schema={EdicionBase}
		fps={30}
		width={1440}
		height={2560}
		durationInFrames={90}
		defaultProps={edicionVacia}
		calculateMetadata={({props}: {props: Edicion}) => ({
			durationInFrames: Math.max(1, Math.round(props.duracion_s * 30)),
		})}
	/>
	{/* Borrador independiente: personajes 2D en escena 3D (no usa la EDL). */}
	<Composition id="Personajes3D" component={Personajes3D} fps={30} width={1080} height={1920} durationInFrames={300} />
	{/* Borrador independiente: educación financiera con personajes y mundo 3D. */}
	<Composition id="Finanzas3D" component={FinanzasTresD} fps={30} width={1080} height={1920} durationInFrames={DURACION_FINANZAS} />
	{/* Borrador narrado (~100 s): la duración y los tiempos salen de la narración (voz-finanzas.ts). */}
	<Composition
		id="FinanzasNarrado"
		component={FinanzasNarrado}
		fps={FPS_NARRADO}
		width={1080}
		height={1920}
		durationInFrames={FPS_NARRADO * 10}
		defaultProps={{narracion: null} as PropsNarrado}
		calculateMetadata={async ({props}) => {
			let narracion = props.narracion;
			if (!narracion) {
				const r = await fetch(staticFile(RUTA_NARRACION));
				narracion = r.ok ? ((await r.json()) as Narracion) : null;
			}
			return {
				props: {narracion},
				durationInFrames: narracion ? Math.ceil((narracion.duracion_s + 2.5) * FPS_NARRADO) : FPS_NARRADO * 10,
			};
		}}
	/>
	{/* Reel de Alcanza (app del creador), narrado; la duración sale de su narración. */}
	<Composition
		id="AlcanzaNarrado"
		component={AlcanzaNarrado}
		fps={FPS_ALCANZA}
		width={1080}
		height={1920}
		durationInFrames={FPS_ALCANZA * 10}
		defaultProps={{narracion: null} as PropsAlcanza}
		calculateMetadata={async ({props}) => {
			let narracion = props.narracion;
			if (!narracion) {
				const r = await fetch(staticFile(RUTA_NARRACION_ALCANZA));
				narracion = r.ok ? ((await r.json()) as Narracion) : null;
			}
			return {
				props: {narracion},
				durationInFrames: narracion ? Math.ceil((narracion.duracion_s + 2.5) * FPS_ALCANZA) : FPS_ALCANZA * 10,
			};
		}}
	/>
	</>
);
