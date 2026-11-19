// Capas 2D del reel "El caso del yapeo fantasma" (Alcanza, app del creador): flashback en blanco y negro,
// expedientes de sospechoso, sello, título de pista con reloj, lupa y tarjeta de cierre.
//
// Todo es determinista: depende solo de useCurrentFrame() (30 fps) y los tiempos van en SEGUNDOS absolutos.
// Las coordenadas son de un lienzo 1080×1920; cada capa se escala sola al ancho real del video (como capas.tsx).
// La franja y 1100–1300 queda libre para los subtítulos.
//
// Yape es marca de terceros: aquí no se dibuja su logo, sus colores ni su interfaz.
import React, {useId} from 'react';
import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Buddy, C, FB, FD, LogoAlcanza} from '../alcanza/telefono';

// ---------- utilidades ----------
/** Máquina de escribir: Courier en macOS/Windows, Courier 10 Pitch / Liberation Mono en Linux. */
export const FM = "'Courier Prime', 'Courier New', 'Courier 10 Pitch', 'Liberation Mono', 'DejaVu Sans Mono', monospace";
const ROJO = '#C8102E';
const KRAFT = '#D8B47A';
const KRAFT_OSC = '#B98F52';

const fijo = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const useT = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return {t: frame / fps, frame, fps};
};
const resorte = (t: number, desde: number, fps: number, damping = 13, stiffness = 170, mass = 0.7) =>
	t < desde ? 0 : spring({frame: (t - desde) * fps, fps, config: {damping, stiffness, mass}});
/** Pseudoaleatorio estable en [0,1). */
const azar = (i: number, s = 0) => {
	const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
	return x - Math.floor(x);
};
/** Texto que se teclea: `cps` caracteres por segundo desde `desde`. */
const tecleado = (texto: string, t: number, desde: number, cps = 28) => texto.slice(0, Math.max(0, Math.floor((t - desde) * cps)));

/** Lienzo de 1080×1920 escalado al ancho real (1080 o 1440). */
const Lienzo: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => {
	const {width} = useVideoConfig();
	const s = width / 1080;
	return (
		<AbsoluteFill style={{pointerEvents: 'none', ...style}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${s})`, transformOrigin: '0 0'}}>{children}</div>
		</AbsoluteFill>
	);
};

// ======================================================================================
// 1. Flashback (blanco y negro de película) — envuelve a sus hijos (p. ej. el ThreeCanvas)
// ======================================================================================
export type RangoFlashback = {desde: number; hasta: number; hora: string};

const ENTRADA = 0.3; // destello + rebobinado
const SALIDA = 0.25; // vuelta al color

/**
 * Aplica el look de flashback cuando t cae dentro de cualquier rango. Los hijos quedan SIEMPRE montados en el
 * mismo árbol (no se remonta el canvas 3D): fuera de los rangos se ven intactos.
 */
export const FiltroPorTiempos: React.FC<{rangos: RangoFlashback[]; children: React.ReactNode}> = ({rangos, children}) => {
	const {t, frame} = useT();
	const r = rangos.find((x) => t >= x.desde && t <= x.hasta);
	let k = 0; // intensidad del look 0..1
	let flash = 0;
	let wob = 0; // 1 → 0 durante el rebobinado
	if (r) {
		const dt = t - r.desde;
		k = Math.min(interpolate(dt, [0, 0.1], [0, 1], fijo), interpolate(t, [r.hasta - SALIDA, r.hasta], [1, 0], fijo));
		flash = dt < ENTRADA ? interpolate(dt, [0, 0.04, ENTRADA], [0.6, 1, 0], fijo) : 0;
		wob = dt < ENTRADA ? 1 - dt / ENTRADA : 0;
	}
	const parpadeo = k > 0 ? 1.02 + (azar(frame, 1) - 0.5) * 0.07 : 1;
	const filtro = k > 0 ? `grayscale(${k}) contrast(${1 + 0.15 * k}) brightness(${1 + (parpadeo - 1) * k}) sepia(${0.08 * k})` : 'none';
	const dx = wob > 0 ? Math.sin(frame * 2.7) * 26 * wob : k > 0 ? (azar(frame, 7) - 0.5) * 2.5 : 0;
	const dy = k > 0 && wob <= 0 ? (azar(frame, 9) - 0.5) * 2 : 0;
	const transformacion = wob > 0 ? `translate(${dx}px, 0) skewX(${Math.sin(frame * 1.9) * 3 * wob}deg) scale(${1 + 0.04 * wob})` : k > 0 ? `translate(${dx}px, ${dy}px) scale(1.012)` : 'none';
	return (
		<AbsoluteFill>
			<AbsoluteFill style={{filter: filtro, transform: transformacion}}>{children}</AbsoluteFill>
			{r && k > 0 ? <PeliculaVieja k={k} wob={wob} flash={flash} hora={r.hora} desde={r.desde} /> : null}
		</AbsoluteFill>
	);
};

/** Un solo rango de flashback. */
export const Flashback: React.FC<{desde: number; hasta: number; hora: string; children: React.ReactNode}> = ({desde, hasta, hora, children}) => (
	<FiltroPorTiempos rangos={[{desde, hasta, hora}]}>{children}</FiltroPorTiempos>
);

const PeliculaVieja: React.FC<{k: number; wob: number; flash: number; hora: string; desde: number}> = ({k, wob, flash, hora, desde}) => {
	const {t, frame} = useT();
	const id = 'gr' + useId().replace(/[^a-zA-Z0-9]/g, '');
	// rayas verticales: cambian de sitio cada 3–5 cuadros
	const tramo = Math.floor(frame / 4);
	const rayas = [0, 1].map((i) => ({
		x: 80 + azar(tramo, 11 + i) * 920,
		op: azar(tramo, 21 + i) > 0.25 ? 0.35 + azar(tramo, 31 + i) * 0.4 : 0,
		w: 1.5 + azar(tramo, 41 + i) * 2.5,
		claro: i === 0,
	}));
	const polvo = Array.from({length: 6}, (_, i) => ({
		x: azar(frame, 50 + i) * 1080,
		y: azar(frame, 60 + i) * 1920,
		r: 2 + azar(frame, 70 + i) * 5,
		on: azar(frame, 80 + i) > 0.55,
	}));
	const etiqueta = Easing.out(Easing.back(1.8))(clamp01((t - desde - 0.12) / 0.25));
	const texto = tecleado(`FLASHBACK · ${hora}`, t, desde + 0.18, 32);
	return (
		<Lienzo>
			{/* viñeta */}
			<div style={{position: 'absolute', inset: 0, opacity: k, background: 'radial-gradient(ellipse 75% 62% at 50% 48%, transparent 45%, rgba(0,0,0,.35) 75%, rgba(0,0,0,.78) 100%)'}} />
			{/* grano animado */}
			<svg width={1080} height={1920} style={{position: 'absolute', inset: 0, opacity: 0.3 * k, mixBlendMode: 'overlay'}}>
				<filter id={id} x="0" y="0" width="100%" height="100%">
					<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 97} stitchTiles="stitch" />
					<feColorMatrix type="saturate" values="0" />
				</filter>
				<rect width={1080} height={1920} filter={`url(#${id})`} />
			</svg>
			{/* rayas y polvo */}
			{rayas.map((r, i) =>
				r.op > 0 ? (
					<div key={i} style={{position: 'absolute', left: r.x, top: 0, width: r.w, height: 1920, opacity: r.op * k, background: r.claro ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.8)'}} />
				) : null,
			)}
			{polvo.map((p, i) => (p.on ? <div key={`p${i}`} style={{position: 'absolute', left: p.x, top: p.y, width: p.r, height: p.r * 1.4, borderRadius: '50%', background: 'rgba(20,20,20,.7)', opacity: k}} /> : null))}
			{/* parpadeo de proyector */}
			<div style={{position: 'absolute', inset: 0, background: '#000', opacity: k * (azar(frame, 3) * 0.06)}} />
			{/* bandas de rebobinado */}
			{wob > 0
				? [0, 1, 2].map((i) => {
						const y = ((frame * 173 + i * 640) % 1920) - 40;
						return <div key={`b${i}`} style={{position: 'absolute', left: 0, right: 0, top: y, height: 22 + i * 10, background: 'rgba(255,255,255,.5)', opacity: wob, filter: 'blur(2px)'}} />;
					})
				: null}
			{/* sello FLASHBACK · hora */}
			<div
				style={{
					position: 'absolute',
					left: 56,
					top: 205,
					transform: `rotate(-3deg) scale(${0.4 + 0.6 * etiqueta})`,
					transformOrigin: '0% 50%',
					opacity: Math.min(1, etiqueta * 2) * k,
					background: 'rgba(245,240,228,.95)',
					border: '5px solid #151515',
					outline: '2px solid #151515',
					outlineOffset: 5,
					padding: '10px 22px 8px',
					fontFamily: FM,
					fontWeight: 700,
					fontSize: 46,
					letterSpacing: 2,
					color: '#151515',
					whiteSpace: 'nowrap',
					boxShadow: '8px 8px 0 rgba(0,0,0,.55)',
					minWidth: 120,
				}}
			>
				{texto}
				<span style={{opacity: Math.floor(t * 3) % 2 === 0 ? 1 : 0}}>▌</span>
			</div>
			{/* destello blanco */}
			{flash > 0 ? <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash}} /> : null}
		</Lienzo>
	);
};

// ======================================================================================
// 2. Expediente de sospechoso
// ======================================================================================
const Clip: React.FC<{x: number; y: number}> = ({x, y}) => (
	<svg width={60} height={130} viewBox="0 0 60 130" style={{position: 'absolute', left: x, top: y, overflow: 'visible', transform: 'rotate(8deg)'}}>
		<path d="M18 120V22a12 12 0 0124 0v86a7 7 0 01-14 0V34" fill="none" stroke="#1E1E1E" strokeWidth={11} strokeLinecap="round" />
		<path d="M18 120V22a12 12 0 0124 0v86a7 7 0 01-14 0V34" fill="none" stroke="#C9CDD2" strokeWidth={6} strokeLinecap="round" />
		<path d="M20 30v70" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
	</svg>
);

/** Silueta de ficha policial con líneas de estatura. `marca` (0..1) traza un círculo rojo y una X encima. */
const Ficha: React.FC<{marca: number; numero: string}> = ({marca, numero}) => {
	const circ = clamp01(marca * 1.6);
	const x1 = clamp01((marca - 0.55) / 0.22);
	const x2 = clamp01((marca - 0.77) / 0.23);
	return (
		<svg width={210} height={250} viewBox="0 0 210 250" style={{display: 'block', overflow: 'visible'}}>
			<rect x={4} y={4} width={202} height={242} rx={6} fill="#E9E4D8" stroke="#1E1E1E" strokeWidth={5} />
			{[40, 80, 120, 160, 200].map((y) => (
				<g key={y}>
					<line x1={4} y1={y} x2={206} y2={y} stroke="#9A9284" strokeWidth={2} />
					<line x1={4} y1={y + 20} x2={24} y2={y + 20} stroke="#9A9284" strokeWidth={2} />
				</g>
			))}
			<circle cx={105} cy={102} r={40} fill="#2B2B2B" />
			<path d="M35 246c4-56 34-86 70-86s66 30 70 86Z" fill="#2B2B2B" />
			<rect x={58} y={196} width={94} height={34} rx={3} fill="#151515" stroke="#E9E4D8" strokeWidth={2} />
			<text x={105} y={220} textAnchor="middle" fill="#F2EEE4" style={{fontFamily: FM, fontWeight: 700, fontSize: 19}}>
				N° {numero}
			</text>
			{marca > 0 ? (
				<g>
					<ellipse cx={105} cy={125} rx={98} ry={112} fill="none" stroke={ROJO} strokeWidth={11} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - circ} transform="rotate(-8 105 125)" />
					<path d="M40 50L170 205" fill="none" stroke={ROJO} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - x1} />
					<path d="M170 50L40 205" fill="none" stroke={ROJO} strokeWidth={13} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - x2} />
				</g>
			) : null}
		</svg>
	);
};

export const Expediente: React.FC<{
	desde: number;
	hasta: number;
	numero?: string;
	titulo: string;
	subtitulo?: string;
	/** Borde superior de la carpeta en el lienzo 1080×1920. */
	y?: number;
	culpable?: boolean;
}> = ({desde, hasta, numero = '1', titulo, subtitulo, y = 330, culpable = false}) => {
	const {t, fps} = useT();
	if (t < desde || t >= hasta) return null;
	const e = resorte(t, desde, fps, 12, 150, 0.8);
	const sal = interpolate(t, [hasta - 0.25, hasta], [0, 1], {...fijo, easing: Easing.in(Easing.cubic)});
	const dx = (1 - e) * -1150 + sal * 1250;
	const rot = -2 + (1 - e) * -10 + sal * 8;
	const cab = culpable ? 'CULPABLE\nCONFIRMADO' : `SOSPECHOSO #${numero}`;
	const cabTxt = tecleado(cab, t, desde + 0.3, 30);
	const tituloIn = resorte(t, desde + 0.45, fps, 11);
	const sub = subtitulo ? tecleado(subtitulo, t, desde + 0.75, 34) : '';
	const marca = culpable ? clamp01((t - desde - 0.7) / 0.7) : 0;
	const W = 900;
	return (
		<Lienzo>
			<div style={{position: 'absolute', left: (1080 - W) / 2, top: y, width: W, transform: `translateX(${dx}px) rotate(${rot}deg)`, transformOrigin: '50% 0%'}}>
				{/* pestaña de la carpeta */}
				<div style={{position: 'absolute', left: 40, top: -46, width: 300, height: 64, background: KRAFT_OSC, border: '5px solid #1E1E1E', borderBottom: 0, borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', paddingLeft: 24, fontFamily: FM, fontWeight: 700, fontSize: 26, color: '#2A1E0E', letterSpacing: 2, boxSizing: 'border-box'}}>
					CASO #0099
				</div>
				{/* hoja asomando */}
				<div style={{position: 'absolute', right: 70, top: -26, width: 380, height: 120, background: '#FBF8F1', border: '4px solid #1E1E1E', borderRadius: 6, transform: 'rotate(3deg)', backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 22px, rgba(60,90,160,.25) 22px 24px)'}} />
				<div
					style={{
						position: 'relative',
						background: KRAFT,
						backgroundImage: 'radial-gradient(rgba(90,60,20,.13) 1.5px, transparent 2px), linear-gradient(180deg, rgba(255,255,255,.12), rgba(0,0,0,.06))',
						backgroundSize: '14px 14px, 100% 100%',
						border: '5px solid #1E1E1E',
						borderRadius: 22,
						boxShadow: '12px 12px 0 #1E1E1E',
						padding: '30px 34px 30px 30px',
						display: 'flex',
						gap: 30,
						alignItems: 'center',
					}}
				>
					<div style={{flex: 'none', transform: 'rotate(-2deg)', background: '#FBF8F1', padding: 10, border: '4px solid #1E1E1E', boxShadow: '5px 5px 0 rgba(30,30,30,.85)'}}>
						<Ficha marca={marca} numero={culpable ? '000' : numero.padStart(3, '0')} />
					</div>
					<div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10}}>
						<div style={{fontFamily: FM, fontWeight: 700, fontSize: culpable ? 54 : 46, letterSpacing: 2, color: ROJO, lineHeight: 1.05, minHeight: culpable ? 114 : 48, whiteSpace: 'pre-line', textShadow: '0 0 1px rgba(200,16,46,.6)'}}>
							{cabTxt}
						</div>
						<div style={{height: 4, background: '#1E1E1E', opacity: 0.85, borderRadius: 2, width: `${Math.min(1, tituloIn * 1.2) * 100}%`}} />
						<div
							style={{
								fontFamily: FD,
								fontWeight: 800,
								fontSize: titulo.length > 16 ? 66 : 80,
								lineHeight: 1,
								color: '#1E1E1E',
								transform: `scale(${0.6 + 0.4 * tituloIn})`,
								transformOrigin: '0% 50%',
								opacity: clamp01(tituloIn * 2),
								paddingTop: 8,
							}}
						>
							{titulo}
						</div>
						{subtitulo ? (
							<div style={{fontFamily: FM, fontWeight: 700, fontSize: 30, lineHeight: 1.2, color: '#3A2A12', minHeight: 36}}>{sub}</div>
						) : null}
					</div>
				</div>
				<Clip x={W - 96} y={-64} />
			</div>
		</Lienzo>
	);
};

// ======================================================================================
// 3. Sello de goma
// ======================================================================================
export const Sello: React.FC<{desde: number; hasta: number; texto: string; x?: number; y?: number; color?: string}> = ({desde, hasta, texto, x = 540, y = 760, color = ROJO}) => {
	const {t} = useT();
	const id = 'tinta' + useId().replace(/[^a-zA-Z0-9]/g, '');
	if (t < desde || t >= hasta) return null;
	const dt = t - desde;
	const baja = clamp01(dt / 0.16);
	const esc = 2 - Easing.in(Easing.quad)(baja); // 2 → 1
	const rebote = baja >= 1 ? 1 + 0.05 * Math.exp(-(dt - 0.16) * 18) * Math.cos((dt - 0.16) * 60) : 1;
	const temblor = baja >= 1 && dt < 0.35 ? Math.sin(dt * 90) * 6 * (1 - (dt - 0.16) / 0.19) : 0;
	const sal = interpolate(t, [hasta - 0.2, hasta], [1, 0], fijo);
	return (
		<Lienzo>
			<svg width={0} height={0} style={{position: 'absolute'}}>
				<filter id={id} x="-10%" y="-10%" width="120%" height="120%">
					<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={7} result="ruido" />
					<feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.85" result="huecos" />
					<feComposite in="SourceGraphic" in2="huecos" operator="in" result="gastado" />
					<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={3} result="onda" />
					<feDisplacementMap in="gastado" in2="onda" scale={6} />
				</filter>
			</svg>
			<div
				style={{
					position: 'absolute',
					left: x,
					top: y,
					transform: `translate(-50%, -50%) translateX(${temblor}px) rotate(${-11 + (1 - baja) * -8}deg) scale(${esc * rebote})`,
					opacity: Math.min(1, baja * 1.5) * sal * (baja < 1 ? 0.75 : 0.93),
					filter: `url(#${id})`,
				}}
			>
				<div style={{border: `11px solid ${color}`, borderRadius: 22, padding: 8}}>
					<div
						style={{
							border: `5px solid ${color}`,
							borderRadius: 12,
							padding: '14px 40px 8px',
							fontFamily: FD,
							fontWeight: 800,
							fontSize: 116,
							lineHeight: 1,
							letterSpacing: 6,
							color,
							whiteSpace: 'nowrap',
							textTransform: 'uppercase',
						}}
					>
						{texto}
					</div>
				</div>
			</div>
		</Lienzo>
	);
};

// ======================================================================================
// 4. Título de pista con reloj
// ======================================================================================
const leerHora = (hora: string) => {
	const m = hora.match(/(\d{1,2})(?::(\d{2}))?/);
	const h = m ? parseInt(m[1], 10) : 12;
	const min = m && m[2] ? parseInt(m[2], 10) : 0;
	return {h: h % 12, min};
};

const Reloj: React.FC<{hora: string; p: number; size: number}> = ({hora, p, size}) => {
	const {h, min} = leerHora(hora);
	const vueltas = 2; // el minutero da 2 vueltas extra antes de clavarse
	const e = Easing.out(Easing.cubic)(clamp01(p));
	const aMin = (min * 6 + 360 * vueltas) * e;
	const aHor = (h * 30 + min * 0.5 + 360 * (vueltas / 12)) * e;
	return (
		<svg width={size} height={size} viewBox="0 0 100 100" style={{display: 'block', overflow: 'visible'}}>
			<circle cx={50} cy={50} r={44} fill="#FBF8F1" stroke={C.honey} strokeWidth={7} />
			{Array.from({length: 12}, (_, i) => {
				const a = (i * Math.PI) / 6;
				const r1 = i % 3 === 0 ? 30 : 34;
				return <line key={i} x1={50 + Math.sin(a) * r1} y1={50 - Math.cos(a) * r1} x2={50 + Math.sin(a) * 38} y2={50 - Math.cos(a) * 38} stroke="#1E1E1E" strokeWidth={i % 3 === 0 ? 5 : 3} strokeLinecap="round" />;
			})}
			<line x1={50} y1={50} x2={50} y2={27} stroke="#1E1E1E" strokeWidth={7} strokeLinecap="round" transform={`rotate(${aHor} 50 50)`} />
			<line x1={50} y1={50} x2={50} y2={16} stroke={ROJO} strokeWidth={4.5} strokeLinecap="round" transform={`rotate(${aMin} 50 50)`} />
			<circle cx={50} cy={50} r={5} fill="#1E1E1E" />
		</svg>
	);
};

export const PistaTitulo: React.FC<{desde: number; hasta: number; numero: number; hora: string; y?: number}> = ({desde, hasta, numero, hora, y = 330}) => {
	const {t, fps} = useT();
	if (t < desde || t >= hasta) return null;
	const barra = Easing.out(Easing.cubic)(clamp01((t - desde) / 0.28));
	const sal = Easing.in(Easing.cubic)(interpolate(t, [hasta - 0.25, hasta], [0, 1], fijo));
	const reloj = resorte(t, desde + 0.12, fps, 10);
	const giro = clamp01((t - desde - 0.15) / 0.9);
	const titulo = tecleado(`PISTA #${numero}`, t, desde + 0.18, 26);
	const horaIn = resorte(t, desde + 0.5, fps, 12);
	const H = 230;
	return (
		<Lienzo>
			<div
				style={{
					position: 'absolute',
					left: 0,
					top: y,
					width: 1080,
					height: H,
					clipPath: `inset(-40px ${(1 - barra) * 100}% -40px ${sal * 100}%)`,
				}}
			>
				{/* cinta "escena del crimen" detrás */}
				<div style={{position: 'absolute', left: -40, right: -40, top: -16, height: 34, background: C.honey, transform: 'rotate(-1.6deg)', borderTop: '4px solid #1E1E1E', borderBottom: '4px solid #1E1E1E', backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 26px, #1E1E1E 26px 44px)'}} />
				<div style={{position: 'absolute', left: -40, right: -40, bottom: -16, height: 34, background: C.honey, transform: 'rotate(1.2deg)', borderTop: '4px solid #1E1E1E', borderBottom: '4px solid #1E1E1E', backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 26px, #1E1E1E 26px 44px)'}} />
				<div style={{position: 'absolute', inset: '18px 0', background: '#121212', boxShadow: '0 14px 30px rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', gap: 40, padding: '0 90px'}}>
					<div style={{flex: 'none', transform: `scale(${reloj}) rotate(${(1 - reloj) * -90}deg)`}}>
						<Reloj hora={hora} p={giro} size={150} />
					</div>
					<div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
						<div style={{fontFamily: FM, fontWeight: 700, fontSize: 92, lineHeight: 1, letterSpacing: 4, color: C.honey, whiteSpace: 'nowrap', minHeight: 92}}>{titulo}</div>
						<div style={{fontFamily: FM, fontWeight: 700, fontSize: 60, lineHeight: 1, letterSpacing: 3, color: '#F4EFE4', opacity: clamp01(horaIn * 2), transform: `translateY(${(1 - horaIn) * 20}px)`, whiteSpace: 'nowrap'}}>{hora}</div>
					</div>
				</div>
			</div>
		</Lienzo>
	);
};

// ======================================================================================
// 5. Lupa
// ======================================================================================
export const Lupa: React.FC<{desde: number; hasta: number; x: number; y: number; tam?: number}> = ({desde, hasta, x, y, tam = 260}) => {
	const {t, fps} = useT();
	if (t < desde || t >= hasta) return null;
	const e = resorte(t, desde, fps, 11);
	const sal = interpolate(t, [hasta - 0.2, hasta], [1, 0], fijo);
	const dt = t - desde;
	// entra barriendo desde la derecha y luego ronda en un ocho pequeño
	const ox = (1 - e) * 380 + Math.sin(dt * 2.6) * 26;
	const oy = (1 - e) * 140 + Math.sin(dt * 5.2) * 14;
	const rot = -18 + Math.sin(dt * 2.6) * 6;
	const brillo = 0.5 + 0.5 * Math.sin(dt * 4);
	return (
		<Lienzo>
			<div style={{position: 'absolute', left: x + ox, top: y + oy, width: tam, height: tam, transform: `translate(-38%, -38%) rotate(${rot}deg) scale(${(0.5 + 0.5 * e) * (0.7 + 0.3 * sal)})`, opacity: sal}}>
				<svg viewBox="0 0 100 100" width={tam} height={tam} style={{overflow: 'visible', display: 'block'}}>
					<g transform="translate(5 5)">
						<path d="M62 62L90 90" stroke="#1E1E1E" strokeWidth={17} strokeLinecap="round" />
						<circle cx={38} cy={38} r={30} fill="none" stroke="#1E1E1E" strokeWidth={10} />
					</g>
					<path d="M62 62L90 90" stroke="#1E1E1E" strokeWidth={17} strokeLinecap="round" />
					<path d="M64 64L89 89" stroke={C.c5} strokeWidth={10} strokeLinecap="round" />
					<circle cx={38} cy={38} r={30} fill="rgba(214,238,245,.42)" stroke="#1E1E1E" strokeWidth={10} />
					<circle cx={38} cy={38} r={30} fill="none" stroke={C.honey} strokeWidth={4.5} />
					<path d="M22 30a18 18 0 0114-12" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" opacity={0.6 + 0.4 * brillo} />
					<circle cx={50} cy={22} r={2.6} fill="#FFFFFF" opacity={brillo} />
				</svg>
			</div>
		</Lienzo>
	);
};

// ======================================================================================
// 6. Cierre
// ======================================================================================
const IconoCelular: React.FC<{size: number}> = ({size}) => (
	<svg viewBox="0 0 40 56" width={size * (40 / 56)} height={size} style={{display: 'inline-block', verticalAlign: '-0.12em', overflow: 'visible'}}>
		<rect x={7} y={7} width={30} height={47} rx={7} fill="#1E1E1E" />
		<rect x={3} y={3} width={30} height={47} rx={7} fill={C.surface} stroke="#1E1E1E" strokeWidth={4} />
		<rect x={8} y={10} width={20} height={30} rx={3} fill={C.sage} stroke="#1E1E1E" strokeWidth={2.5} />
		<path d="M12 27l4 4 8-9" fill="none" stroke={C.surface} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
		<circle cx={18} cy={45} r={2.4} fill="#1E1E1E" />
	</svg>
);

export const CierreDetective: React.FC<{desde: number; hasta: number}> = ({desde, hasta}) => {
	const {t, fps} = useT();
	if (t < desde || t > hasta + 0.05) return null;
	const fondo = interpolate(t, [desde, desde + 0.25], [0, 1], fijo) * interpolate(t, [hasta - 0.3, hasta], [1, 0], fijo);
	const logo = resorte(t, desde + 0.1, fps, 10, 150, 0.8);
	const lema = resorte(t, desde + 0.4, fps, 14);
	const cta = resorte(t, desde + 0.75, fps, 10);
	const buddy = resorte(t, desde + 0.3, fps, 13);
	const latido = 1 + 0.035 * Math.sin(Math.max(0, t - desde - 1.2) * Math.PI * 2 * 0.9);
	return (
		<Lienzo style={{opacity: fondo}}>
			<div style={{position: 'absolute', inset: 0, backgroundColor: C.bg, backgroundImage: 'radial-gradient(rgba(30,30,30,.09) 2.5px, transparent 3.2px)', backgroundSize: '40px 40px', fontFamily: FB, color: C.ink}} />
			<div style={{position: 'absolute', top: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${logo}) rotate(${(1 - logo) * -8}deg)`}}>
				<LogoAlcanza size={150} />
			</div>
			<div style={{position: 'absolute', top: 540, left: 70, right: 70, textAlign: 'center', fontFamily: FD, fontWeight: 800, fontSize: 94, lineHeight: 1.04, color: C.ink, opacity: clamp01(lema * 1.5), transform: `translateY(${(1 - lema) * 40}px)`}}>
				Ordena tus pagos diarios
				<br />
				<span style={{display: 'inline-flex', alignItems: 'center', gap: 22, marginTop: 18}}>
					con
					<span style={{background: C.honey, border: `5px solid ${C.ink}`, boxShadow: `8px 8px 0 ${C.ink}`, borderRadius: 20, padding: '0 22px', display: 'inline-block', transform: 'rotate(-1.5deg)'}}>Alcanza</span>
					<IconoCelular size={96} />
				</span>
			</div>
			<div style={{position: 'absolute', top: 905, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${cta * latido})`}}>
				<div style={{background: C.terra, color: C.surface, border: `5px solid ${C.ink}`, boxShadow: `9px 9px 0 ${C.ink}`, borderRadius: 999, padding: '20px 56px', fontFamily: FD, fontWeight: 800, fontSize: 62, whiteSpace: 'nowrap'}}>
					Link en el perfil
				</div>
			</div>
			<div style={{position: 'absolute', top: 1330, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - buddy) * 600}px)`}}>
				<div style={{background: C.sunk, border: `5px solid ${C.ink}`, borderRadius: 56, boxShadow: `10px 10px 0 ${C.ink}`, padding: 20}}>
					<Buddy animo="buscando" size={300} />
				</div>
			</div>
		</Lienzo>
	);
};
