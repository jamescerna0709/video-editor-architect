// Teléfono genérico y pantallas de Alcanza (la app del creador) para el reel promocional.
//
// Todo sale de useCurrentFrame (determinista, 30 fps). Los tiempos (`desde`, `hasta`) van en SEGUNDOS absolutos
// del video. Diseñado sobre un lienzo de 1080×1920; cada pantalla mide 390×844 px CSS dentro del teléfono.
//
// La marca se copió del HTML de la app (piel cómic sobre papel crema: trazo #1E1E1E de 2px, sombra sólida 4px 4px,
// sage/terra/honey, Baloo 2 + Nunito). El compañero (`Buddy`) y el frasco (`Frasco`) son puertos a React de
// `financeBuddy` y `goalJar` de esa misma app. El texto dentro del teléfono va más grande que en la app real para
// que se lea en un reel visto en el celular.
//
// Las notificaciones de pago son GENÉRICAS (campana, tarjeta gris/blanca de sistema): ninguna marca de terceros.
import {loadFont} from '@remotion/fonts';
import React, {useId} from 'react';
import {AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

// ---------- fuentes (OFL-1.1, registradas en biblioteca/LICENCIAS.md) ----------
const FUENTES: {family: string; url: string; weight: string}[] = [
	{family: 'Baloo 2', url: 'biblioteca/fuentes/baloo-2/Baloo2-Bold.ttf', weight: '700'},
	{family: 'Baloo 2', url: 'biblioteca/fuentes/baloo-2/Baloo2-ExtraBold.ttf', weight: '800'},
	{family: 'Nunito', url: 'biblioteca/fuentes/nunito/Nunito-Regular.ttf', weight: '400'},
	{family: 'Nunito', url: 'biblioteca/fuentes/nunito/Nunito-SemiBold.ttf', weight: '600'},
	{family: 'Nunito', url: 'biblioteca/fuentes/nunito/Nunito-Bold.ttf', weight: '700'},
	{family: 'Nunito', url: 'biblioteca/fuentes/nunito/Nunito-ExtraBold.ttf', weight: '800'},
];
let fuentesListas: Promise<unknown> | null = null;
export function cargarFuentesAlcanza(): Promise<unknown> {
	if (!fuentesListas) {
		fuentesListas = Promise.all(
			FUENTES.map((f) => loadFont({family: f.family, url: staticFile(f.url), weight: f.weight, style: 'normal', display: 'block'})),
		);
	}
	return fuentesListas;
}
if (typeof document !== 'undefined') cargarFuentesAlcanza();

// ---------- marca ----------
export const C = {
	bg: '#FAF7F2',
	surface: '#FFFDF8',
	sunk: '#F3E9DC',
	ink: '#1E1E1E',
	muted: '#6B6258',
	sage: '#6B9080',
	terra: '#D96B52',
	honey: '#E9C46A',
	accent: '#3F6B5A',
	accentSoft: '#DCE9E2',
	good: '#3F6B5A',
	goodSoft: '#DDEBE3',
	warn: '#7A5A0E',
	warnSoft: '#F8EBC4',
	crit: '#A8432E',
	critSoft: '#F8DDD5',
	c0: '#2F7F8C',
	c4: '#6A5AA8',
	c5: '#9A5230',
	red: '#D9482F',
	redDark: '#B23A25',
} as const;
export const FD = "'Baloo 2', 'Trebuchet MS', sans-serif";
export const FB = "Nunito, 'Segoe UI', sans-serif";
const BORDE = `2.5px solid ${C.ink}`;
const SOMBRA = `4px 4px 0 ${C.ink}`;
const SOMBRA_S = `2px 2px 0 ${C.ink}`;
const PAPEL: React.CSSProperties = {
	backgroundColor: C.bg,
	backgroundImage: 'radial-gradient(rgba(30,30,30,.08) 1.2px, transparent 1.7px)',
	backgroundSize: '18px 18px',
};

export const ANCHO_PANTALLA = 390;
export const ALTO_PANTALLA = 844;

// ---------- utilidades ----------
const fijo = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const useT = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return {t: frame / fps, frame, fps};
};
const resorte = (t: number, desde: number, fps: number, damping = 14, mass = 0.8) =>
	t < desde ? 0 : spring({frame: (t - desde) * fps, fps, config: {damping, mass, stiffness: 140}});
const soles = (n: number) =>
	'S/ ' + n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const leerMonto = (s: string) => {
	const n = parseFloat(s.replace(/[^0-9.,-]/g, '').replace(',', '.'));
	return Number.isFinite(n) ? n : 0;
};
/** Entrada escalonada de un bloque: sube 24 px y aparece. */
const entra = (t: number, desde: number, fps: number, k = 0, paso = 0.08): React.CSSProperties => {
	const e = resorte(t, desde + k * paso, fps, 16);
	return {opacity: Math.min(1, e * 1.4), transform: `translateY(${(1 - e) * 26}px)`};
};

const ICONOS = {
	wallet: 'M4 7h14a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h10M16 13.500h.5',
	inicio: 'M3 11 12 4l9 7v9H3zM9 20v-6h6v6',
	plus: 'M12 6v12M6 12h12',
	historial: 'M5 7h14M5 12h14M5 17h9',
	plan: 'M4 19h16M6 16l4-5 3 3 5-7',
	check: 'M5 12.5l4.5 4.5L19 7.5',
	campana: 'M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0',
} as const;
const Icono: React.FC<{d: string; size: number; color?: string; grosor?: number}> = ({d, size, color = 'currentColor', grosor = 2}) => (
	<svg viewBox="0 0 24 24" width={size} height={size} style={{display: 'block'}}>
		<path d={d} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" />
	</svg>
);

// ======================================================================================
// Buddy: puerto de financeBuddy (viewBox 200×200)
// ======================================================================================
export type Animo = 'feliz' | 'atento' | 'nervioso' | 'buscando';

export const Buddy: React.FC<{animo: Animo; size: number; saludar?: boolean; style?: React.CSSProperties}> = ({animo, size, saludar, style}) => {
	const {t} = useT();
	const INK = C.ink, SKIN = C.surface, RED = C.red, DARK = C.redDark;
	const s = {stroke: INK, strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
	const line = (d: string, sw = 5, k?: string) => <path key={k ?? d} d={d} fill="none" {...s} strokeWidth={sw} />;
	const dot = (x: number, y: number, r: number) => <circle key={`d${x}-${y}`} cx={x} cy={y} r={r} fill={INK} />;
	const hand = (x: number, y: number) => <circle key={`h${x}-${y}`} cx={x} cy={y} r={11} fill={SKIN} {...s} />;

	// animaciones (mismos periodos que el CSS de la app)
	const bob = 2 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 3.2));
	const fase = (t % 4.2) / 4.2;
	const parpadeo = fase < 0.92 ? 1 : fase < 0.96 ? interpolate(fase, [0.92, 0.96], [1, 0.1]) : interpolate(fase, [0.96, 1], [0.1, 1]);
	const ojos = (cy: number, hijos: React.ReactNode) => (
		<g transform={`translate(0 ${cy}) scale(1 ${parpadeo}) translate(0 ${-cy})`}>{hijos}</g>
	);
	const star = (x: number, y: number, r: number, retraso: number) => {
		const f = (((t - retraso) % 1.8) + 1.8) % 1.8 / 1.8;
		const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * f); // 0→1→0
		const sc = 1 - 0.45 * k, rot = 20 * k, op = 1 - 0.5 * k;
		const q = r * 0.3;
		const d = `M${x} ${y - r}L${x + q} ${y - q}L${x + r} ${y}L${x + q} ${y + q}L${x} ${y + r}L${x - q} ${y + q}L${x - r} ${y}L${x - q} ${y - q}Z`;
		return (
			<path key={`s${x}`} d={d} fill={C.honey} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" opacity={op}
				transform={`translate(${x} ${y}) rotate(${rot}) scale(${sc}) translate(${-x} ${-y})`} />
		);
	};
	const drop = (x: number, y: number, retraso: number) => {
		const f = (((t - retraso) % 1.5) + 1.5) % 1.5 / 1.5;
		const e = f * f; // ease-in
		const dy = -4 + 20 * e;
		const op = f < 0.25 ? f / 0.25 : 1 - (f - 0.25) / 0.75;
		const d = `M${x} ${y - 9}C${x + 7} ${y + 1} ${x + 6} ${y + 8} ${x} ${y + 8}C${x - 6} ${y + 8} ${x - 7} ${y + 1} ${x} ${y - 9}Z`;
		return <path key={`w${x}`} d={d} fill="#8CCBDD" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" opacity={op} transform={`translate(0 ${dy})`} />;
	};
	const cheeks = [
		<circle key="c1" cx={68} cy={108} r={8} fill={C.terra} opacity={0.35} />,
		<circle key="c2" cx={132} cy={108} r={8} fill={C.terra} opacity={0.35} />,
	];

	let face: React.ReactNode, arms: React.ReactNode, extra: React.ReactNode = null;
	let temblor = 0;
	if (animo === 'feliz') {
		const ang = saludar ? -10 + 16 * Math.sin((2 * Math.PI * t) / 0.8) : 0;
		face = (
			<>
				{cheeks}
				{ojos(92, [dot(82, 92, 5.5), dot(118, 92, 5.5)])}
				{line('M72 78q10-7 20-2')}
				{line('M108 76q10-5 20 2')}
				<path d="M82 108Q100 130 118 108Z" fill={DARK} {...s} />
			</>
		);
		arms = (
			<>
				<g transform={`rotate(${ang} 146 172)`}>
					{line('M146 172C162 164 170 146 172 128')}
					{hand(173, 118)}
				</g>
				{line('M54 176C46 184 44 192 44 198')}
			</>
		);
		extra = (
			<>
				{star(30, 62, 11, 0)}
				{star(170, 66, 8, 0.6)}
			</>
		);
	} else if (animo === 'atento') {
		face = (
			<>
				{ojos(92, [dot(88, 92, 5.5), dot(124, 92, 5.5)])}
				{line('M72 80h20')}
				{line('M108 72q11-7 22 0')}
				{line('M92 116q7-3 14 0')}
			</>
		);
		arms = (
			<>
				{line('M56 178C46 160 60 146 78 140')}
				{hand(86, 138)}
				{line('M146 176C154 184 156 192 156 198')}
			</>
		);
	} else if (animo === 'buscando') {
		const LENS = '#D6EEF5';
		const glass = (x: number) => <circle key={`g${x}`} cx={x} cy={92} r={14} fill={LENS} stroke={INK} strokeWidth={4.5} />;
		const k = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 2.6);
		face = (
			<>
				{line('M68 90L50 84', 4.5)}
				{line('M132 90L150 84', 4.5)}
				{glass(82)}
				{glass(118)}
				{line('M96 92h8', 4.5)}
				{ojos(94, [dot(86, 94, 4.5), dot(122, 94, 4.5)])}
				{line('M72 71q10-5 20-1')}
				{line('M108 70q10-4 20 1')}
				{line('M93 119q7 4 14 0')}
			</>
		);
		arms = (
			<>
				{line('M54 176C46 184 44 192 44 198')}
				{line('M146 174C158 170 164 160 165 150')}
				<g transform={`translate(${-7 * k} ${4 * k})`}>
					{line('M166 132L171 119', 6)}
					<circle cx={176} cy={104} r={15} fill={LENS} stroke={INK} strokeWidth={5} />
					<path d="M169 99q4-6 10-5" fill="none" stroke={SKIN} strokeWidth={3} strokeLinecap="round" />
					{hand(165, 140)}
				</g>
			</>
		);
	} else {
		temblor = Math.sin((2 * Math.PI * t) / 0.28) * 1.2;
		face = (
			<>
				{ojos(92, [
					<circle key="e1" cx={82} cy={92} r={10} fill={SKIN} stroke={INK} strokeWidth={3.5} />,
					<circle key="e2" cx={118} cy={92} r={10} fill={SKIN} stroke={INK} strokeWidth={3.5} />,
					dot(82, 93, 3.2),
					dot(118, 93, 3.2),
				])}
				{line('M70 78l20-8')}
				{line('M110 70l20 8')}
				{line('M80 118q5-7 10 0t10 0t10 0t10 0', 4.5)}
			</>
		);
		arms = (
			<>
				{line('M54 176C36 168 32 152 36 140')}
				{hand(38, 130)}
				{line('M146 176C164 168 168 152 164 140')}
				{hand(162, 130)}
			</>
		);
		extra = (
			<>
				{drop(30, 70, 0)}
				{drop(172, 56, 0.45)}
				{drop(180, 96, 0.9)}
			</>
		);
	}

	return (
		<svg viewBox="0 0 200 200" width={size} height={size} style={{display: 'block', overflow: 'visible', ...style}}>
			<g transform={`translate(0 ${bob})`}>
				<path d="M50 198C50 164 74 150 100 150C126 150 150 164 150 198Z" fill={SKIN} {...s} />
				<g transform={`translate(${temblor} 0)`}>
					<path d="M64 144l-18-6 6 20Z" fill={DARK} {...s} />
					<path d="M66 140Q100 162 134 140L114 182Q100 192 86 182Z" fill={RED} {...s} />
					<circle cx={100} cy={90} r={54} fill={SKIN} {...s} />
					<path d="M54 64C58 22 142 22 146 64C120 52 80 52 54 64Z" fill={RED} {...s} />
					<path d="M62 56C84 47 116 47 138 56" fill="none" stroke={DARK} strokeWidth={4} strokeLinecap="round" />
					<circle cx={100} cy={26} r={8} fill={RED} {...s} />
					{face}
				</g>
				{arms}
				{extra}
			</g>
		</svg>
	);
};

// ======================================================================================
// Frasco: puerto de goalJar (viewBox 100×125; nivel 0 % en y=118, 100 % en y=44)
// ======================================================================================
export const Frasco: React.FC<{pct: number; size: number}> = ({pct, size}) => {
	const {t} = useT();
	const id = 'gj' + useId().replace(/[^a-zA-Z0-9]/g, '');
	const p = Math.max(0, Math.min(100, pct));
	const h = (size * 125) / 100;
	const JAR = 'M36 25V33C36 39 14 37 14 51V104C14 112 20 118 28 118H72C80 118 86 112 86 104V51C86 37 64 39 64 33V25Z';
	const ln = {stroke: C.ink, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
	const pop = (m: number) => {
		const k = interpolate(p, [m, m + 6], [0, 1], fijo);
		return k <= 0 ? 0 : k < 1 ? Easing.out(Easing.back(2.2))(k) : 1;
	};
	const coin = (m: number, x: number, y: number) => {
		const k = pop(m);
		return (
			<g key={m} opacity={k > 0 ? 1 : 0} transform={`translate(${x} ${y}) scale(${k}) translate(${-x} ${-y})`}>
				<circle cx={x} cy={y} r={9} fill={C.honey} {...ln} strokeWidth={3} />
				<path d={`M${x} ${y - 3.5}v7`} fill="none" {...ln} strokeWidth={2.5} />
			</g>
		);
	};
	const tick = (m: number) => (
		<rect key={`t${m}`} x={71} y={115 - (m * 74) / 100} width={14} height={6} rx={3} fill={p >= m ? C.honey : C.surface} {...ln} strokeWidth={2.5} />
	);
	const liq = p <= 0 ? 80 : (100 - p) * 0.74;
	const ola = -((t / 5) % 1) * 24;
	const kStar = pop(100);
	return (
		<svg viewBox="0 0 100 125" width={size} height={h} style={{display: 'block', overflow: 'visible'}}>
			<defs>
				<clipPath id={id}>
					<path d={JAR} />
				</clipPath>
			</defs>
			<path d={JAR} fill={C.surface} />
			<g clipPath={`url(#${id})`}>
				<g transform={`translate(${ola} ${liq})`}>
					<path fill={C.sage} {...ln} strokeWidth={2.5}
						d="M2 44q6-3 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0V130H2Z" />
				</g>
				{coin(25, 36, 105)}
				{coin(50, 57, 105)}
				{coin(75, 46.5, 88.5)}
				{tick(25)}
				{tick(50)}
				{tick(75)}
				{tick(100)}
			</g>
			<path d="M22 58V86M22 94v1" fill="none" stroke="#FFFFFF" strokeLinecap="round" strokeWidth={4} />
			<path d={JAR} fill="none" {...ln} strokeWidth={4.5} />
			<rect x={30} y={15} width={40} height={12} rx={4} fill="#D9A066" {...ln} strokeWidth={4.5} />
			<path d="M44 21h12" fill="none" {...ln} strokeWidth={3} />
			<path opacity={kStar > 0 ? 1 : 0} transform={`translate(50 10) scale(${kStar}) translate(-50 -10)`} fill={C.honey} {...ln} strokeWidth={2.5}
				d="M50 1.5L52.5 7.1 58.6 7.7 54 11.8 55.3 17.8 50 14.7 44.7 17.8 46 11.8 41.4 7.7 47.5 7.1Z" />
		</svg>
	);
};

// ======================================================================================
// Logo: marca miel con la billetera de la app + "Alcanza" en Baloo 2 800 con trazo y sombra cómic
// ======================================================================================
export const LogoAlcanza: React.FC<{size: number; style?: React.CSSProperties}> = ({size, style}) => {
	const b = Math.max(2, size * 0.045); // grosor del trazo
	const sh = Math.max(3, size * 0.07); // sombra
	const fs = size * 0.86;
	const palabra = 'Alcanza';
	const capa = (color: string, extra: React.CSSProperties): React.CSSProperties => ({
		fontFamily: FD,
		fontWeight: 800,
		fontSize: fs,
		lineHeight: 1,
		letterSpacing: '-0.01em',
		color,
		WebkitTextStroke: `${b * 2}px ${C.ink}`,
		paintOrder: 'stroke fill',
		whiteSpace: 'nowrap',
		...extra,
	});
	return (
		<div style={{display: 'inline-flex', alignItems: 'center', gap: size * 0.24, ...style}}>
			<div
				style={{
					width: size,
					height: size,
					flex: 'none',
					borderRadius: size * 0.34,
					background: C.honey,
					border: `${b}px solid ${C.ink}`,
					boxShadow: `${sh}px ${sh}px 0 ${C.ink}`,
					display: 'grid',
					placeItems: 'center',
					color: C.ink,
				}}
			>
				<Icono d={ICONOS.wallet} size={size * 0.56} grosor={2.1} />
			</div>
			<div style={{position: 'relative', paddingTop: fs * 0.08}}>
				<span style={capa(C.ink, {position: 'absolute', left: sh, top: fs * 0.08 + sh})}>{palabra}</span>
				<span style={capa(C.surface, {position: 'relative'})}>{palabra}</span>
			</div>
		</div>
	);
};

// ======================================================================================
// Teléfono genérico
// ======================================================================================
const BISEL = 14;
export const Telefono: React.FC<{
	desde: number;
	hasta: number;
	x?: number;
	y?: number;
	escala?: number;
	inclinar?: number;
	children: React.ReactNode;
}> = ({desde, hasta, x = 540, y = 900, escala, inclinar = 0, children}) => {
	const {t, fps} = useT();
	if (t < desde || t > hasta + 0.05) return null;
	const W = ANCHO_PANTALLA + BISEL * 2;
	const H = ALTO_PANTALLA + BISEL * 2;
	const esc = escala ?? 1150 / H;
	const e = resorte(t, desde, fps, 15, 0.9);
	const sal = t < hasta - 0.4 ? 0 : interpolate(t, [hasta - 0.4, hasta], [0, 1], {...fijo, easing: Easing.in(Easing.cubic)});
	const dy = (1 - e) * 1500 + sal * 1600;
	const rot = inclinar + (1 - e) * 8 - sal * 6;
	return (
		<div
			style={{
				position: 'absolute',
				left: x,
				top: y,
				width: W,
				height: H,
				transform: `translate(-50%, -50%) translateY(${dy}px) rotate(${rot}deg) scale(${esc})`,
				borderRadius: 64,
				background: 'linear-gradient(145deg, #2B2B2E, #0E0E10 55%, #1C1C1F)',
				boxShadow: '0 0 0 2px #3A3A3E inset, 0 40px 80px -30px rgba(0,0,0,.55), 10px 12px 0 rgba(30,30,30,.9)',
			}}
		>
			{/* botones laterales */}
			{[
				{l: -4, top: 170, h: 34},
				{l: -4, top: 230, h: 62},
				{l: -4, top: 305, h: 62},
				{l: W - 1, top: 250, h: 96},
			].map((b, i) => (
				<div key={i} style={{position: 'absolute', left: b.l, top: b.top, width: 5, height: b.h, borderRadius: 3, background: '#1A1A1C'}} />
			))}
			<div
				style={{
					position: 'absolute',
					left: BISEL,
					top: BISEL,
					width: ANCHO_PANTALLA,
					height: ALTO_PANTALLA,
					borderRadius: 50,
					overflow: 'hidden',
					background: C.bg,
					isolation: 'isolate',
				}}
			>
				{children}
				{/* isla */}
				<div style={{position: 'absolute', left: (ANCHO_PANTALLA - 112) / 2, top: 11, width: 112, height: 32, borderRadius: 20, background: '#000', zIndex: 50}} />
			</div>
		</div>
	);
};

// barra de estado genérica
const BarraEstado: React.FC<{clara?: boolean}> = ({clara}) => {
	const col = clara ? '#FFFFFF' : C.ink;
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 30px 0 38px', zIndex: 40, color: col}}>
			<span style={{fontFamily: FB, fontWeight: 800, fontSize: 17}}>9:41</span>
			<svg width={74} height={14} viewBox="0 0 74 14">
				{[0, 1, 2, 3].map((i) => (
					<rect key={i} x={i * 5.5} y={10 - i * 3} width={3.6} height={4 + i * 3} rx={1} fill={col} />
				))}
				<path d="M30 5.5a10 10 0 0114 0M33 8.5a5.5 5.5 0 018 0" fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" />
				<circle cx={37} cy={11.5} r={1.6} fill={col} />
				<rect x={49} y={1.5} width={21} height={11} rx={3.5} fill="none" stroke={col} strokeWidth={1.4} opacity={0.6} />
				<rect x={51} y={3.5} width={15} height={7} rx={2} fill={col} />
				<rect x={71} y={5} width={2} height={4} rx={1} fill={col} opacity={0.6} />
			</svg>
		</div>
	);
};

// pestañas de la app (Inicio / Mi plata / Anotar / Historial / Plan)
type Pestana = 'inicio' | 'plata' | 'historial' | 'plan' | null;
const Pestanas: React.FC<{activa: Pestana}> = ({activa}) => {
	const items: {id: Exclude<Pestana, null> | 'anotar'; label: string; d: string}[] = [
		{id: 'inicio', label: 'Inicio', d: ICONOS.inicio},
		{id: 'plata', label: 'Mi plata', d: ICONOS.wallet},
		{id: 'anotar', label: 'Anotar', d: ICONOS.plus},
		{id: 'historial', label: 'Historial', d: ICONOS.historial},
		{id: 'plan', label: 'Plan', d: ICONOS.plan},
	];
	return (
		<div style={{position: 'absolute', left: 12, right: 12, bottom: 22, zIndex: 30}}>
			<div style={{display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', background: C.surface, border: BORDE, borderRadius: 24, boxShadow: SOMBRA, padding: '5px 5px'}}>
				{items.map((it) => {
					const on = it.id === activa;
					const plus = it.id === 'anotar';
					return (
						<div key={it.id} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 0 7px', borderRadius: 18, background: on ? C.honey : 'transparent', boxShadow: on ? `inset 0 0 0 2.5px ${C.ink}` : 'none', color: on ? C.ink : C.muted}}>
							{plus ? (
								<div style={{width: 36, height: 36, marginTop: -4, borderRadius: 13, background: C.terra, border: BORDE, boxShadow: SOMBRA_S, display: 'grid', placeItems: 'center', color: C.surface}}>
									<Icono d={it.d} size={22} grosor={2.6} />
								</div>
							) : (
								<Icono d={it.d} size={26} grosor={2} />
							)}
							<span style={{fontFamily: FB, fontWeight: 800, fontSize: 13.5, color: on ? C.ink : C.muted}}>{it.label}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
};

const Ceja: React.FC<{children: React.ReactNode; color?: string; style?: React.CSSProperties}> = ({children, color = C.muted, style}) => (
	<div style={{fontFamily: FB, fontWeight: 800, fontSize: 14, letterSpacing: '.08em', textTransform: 'uppercase', color, ...style}}>{children}</div>
);
const Tarjeta: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
	<div style={{background: C.surface, border: BORDE, borderRadius: 22, boxShadow: SOMBRA, padding: 16, ...style}}>{children}</div>
);
const Pastilla: React.FC<{children: React.ReactNode; tipo: 'warn' | 'crit' | 'good'; style?: React.CSSProperties}> = ({children, tipo, style}) => {
	const m = {warn: [C.warnSoft, C.warn], crit: [C.critSoft, C.crit], good: [C.goodSoft, C.good]}[tipo];
	return (
		<span style={{fontFamily: FB, fontWeight: 800, fontSize: 14, padding: '4px 11px', borderRadius: 99, border: `2px solid ${C.ink}`, background: m[0], color: m[1], whiteSpace: 'nowrap', ...style}}>{children}</span>
	);
};
const Barra: React.FC<{pct: number; color?: string; alto?: number}> = ({pct, color = C.sage, alto = 16}) => (
	<div style={{height: alto, borderRadius: 99, border: BORDE, background: C.surface, overflow: 'hidden'}}>
		<div style={{height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRight: pct > 0 && pct < 100 ? `2px solid ${C.ink}` : 'none'}} />
	</div>
);
const Pantalla: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
	<AbsoluteFill style={{...PAPEL, color: C.ink, fontFamily: FB, fontVariantNumeric: 'tabular-nums', ...style}}>{children}</AbsoluteFill>
);

// ======================================================================================
// Pantallas
// ======================================================================================

// --- Notificaciones de pago genéricas (pantalla bloqueada) ---
export const PantallaNotificaciones: React.FC<{desde: number; items: {texto: string; monto: string}[]; visibles: number}> = ({desde, items, visibles}) => {
	const {t, fps} = useT();
	const ALTO = 88, GAP = 8;
	const prog = items.map((_, i) => {
		const p = Math.max(0, Math.min(1, visibles - i));
		return p;
	});
	const total = items.reduce((s, it, i) => s + (prog[i] >= 0.5 ? leerMonto(it.monto) : 0), 0);
	const reloj = entra(t, desde, fps, 0);
	const badgeOn = resorte(t, desde + 0.2, fps, 12);
	const fr = visibles - Math.floor(visibles);
	const latido = fr >= 0.5 && fr < 0.85 ? 1 + 0.08 * Math.sin(((fr - 0.5) / 0.35) * Math.PI) : 1;
	return (
		<Pantalla style={{background: 'linear-gradient(170deg, #4E5A63 0%, #2F363D 45%, #1D2126 100%)', fontFamily: FB}}>
			<BarraEstado clara />
			<div style={{position: 'absolute', top: 62, left: 0, right: 0, textAlign: 'center', color: '#FFFFFF', ...reloj}}>
				<div style={{fontWeight: 600, fontSize: 19, opacity: 0.85}}>viernes 30 de mayo</div>
				<div style={{fontFamily: FD, fontWeight: 700, fontSize: 84, lineHeight: 1, letterSpacing: '-0.02em'}}>9:41</div>
			</div>
			<div style={{position: 'absolute', top: 196, left: 14, right: 14, bottom: 0}}>
				{items.map((it, i) => {
					const p = prog[i];
					if (p <= 0) return null;
					let yy = 0;
					for (let j = i + 1; j < items.length; j++) yy += prog[j] * (ALTO + GAP);
					const e = Easing.out(Easing.back(1.4))(p);
					return (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: 0,
								right: 0,
								top: yy,
								height: ALTO,
								transform: `translateY(${(1 - e) * -30}px) scale(${0.92 + 0.08 * e})`,
								opacity: Math.min(1, p * 2.5),
								background: '#F2F2F4',
								borderRadius: 24,
								display: 'flex',
								alignItems: 'center',
								gap: 14,
								padding: '0 16px',
								boxShadow: '0 8px 24px -10px rgba(0,0,0,.5)',
							}}
						>
							<div style={{width: 50, height: 50, borderRadius: 14, background: '#8E8E93', display: 'grid', placeItems: 'center', color: '#FFFFFF', flex: 'none'}}>
								<Icono d={ICONOS.campana} size={28} grosor={2.2} />
							</div>
							<div style={{flex: 1, minWidth: 0}}>
								<div style={{display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#6E6E73', fontWeight: 700}}>
									<span>PAGOS</span>
									<span>ahora</span>
								</div>
								<div style={{fontWeight: 800, fontSize: 22, color: '#111', lineHeight: 1.15}}>Pagaste {it.monto}</div>
								<div style={{fontWeight: 600, fontSize: 18, color: '#333', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{it.texto}</div>
							</div>
						</div>
					);
				})}
			</div>
			<div style={{position: 'absolute', left: 0, right: 0, bottom: 34, display: 'flex', justifyContent: 'center', zIndex: 20}}>
				<div
					style={{
						transform: `scale(${badgeOn * latido}) rotate(-2deg)`,
						background: C.honey,
						border: `3px solid ${C.ink}`,
						boxShadow: `5px 5px 0 ${C.ink}`,
						borderRadius: 99,
						padding: '10px 26px',
						fontFamily: FD,
						fontWeight: 800,
						fontSize: 34,
						color: C.ink,
						whiteSpace: 'nowrap',
						fontVariantNumeric: 'tabular-nums',
					}}
				>
					Total: {soles(total)}
				</div>
			</div>
		</Pantalla>
	);
};

// --- Inicio ---
const MOVIMIENTOS = [
	{n: 'Cafecito', c: 'Comida', m: 8.5},
	{n: 'Pasaje', c: 'Transporte', m: 2.5},
	{n: 'Chifa', c: 'Comida', m: 18},
	{n: 'Cine', c: 'Salidas', m: 15},
];
export const PantallaInicio: React.FC<{desde: number; saldo: number; gastado: number}> = ({desde, saldo, gastado}) => {
	const {t, fps} = useT();
	const cuenta = interpolate(t, [desde + 0.25, desde + 1.4], [0, 1], {...fijo, easing: Easing.out(Easing.cubic)});
	const total = saldo + gastado;
	const usado = total > 0 ? (gastado / total) * 100 : 0;
	return (
		<Pantalla>
			<BarraEstado />
			<div style={{position: 'absolute', top: 58, left: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 14}}>
				<div style={{display: 'flex', alignItems: 'center', gap: 12, ...entra(t, desde, fps, 0)}}>
					<div style={{width: 58, height: 58, borderRadius: '50%', background: C.honey, border: BORDE, overflow: 'hidden', display: 'grid', placeItems: 'center', flex: 'none'}}>
						<Buddy animo="feliz" size={64} style={{marginTop: 10}} />
					</div>
					<div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.15}}>
						<b style={{fontFamily: FD, fontWeight: 800, fontSize: 27}}>¡Hola!</b>
						<span style={{fontSize: 17, color: C.muted, fontWeight: 600}}>Viernes 30 de mayo</span>
					</div>
				</div>
				<div style={{background: C.surface, border: BORDE, borderRadius: 24, boxShadow: SOMBRA, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8, ...entra(t, desde, fps, 1)}}>
					<Ceja>Te queda este mes</Ceja>
					<div style={{fontFamily: FD, fontWeight: 800, fontSize: 58, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 4}}>{soles(saldo * cuenta)}</div>
					<Barra pct={usado * cuenta} alto={18} />
					<div style={{fontSize: 17, fontWeight: 600}}>
						Gastaste <b>{soles(gastado * cuenta)}</b> de {soles(total)}
					</div>
				</div>
				<div style={{display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9, ...entra(t, desde, fps, 2)}}>
					{[
						{n: 'Vivir', v: saldo * 0.62, c: C.c0, p: 62},
						{n: 'Deudas', v: saldo * 0.18, c: '#A06A14', p: 35},
						{n: 'Ahorro', v: saldo * 0.2, c: C.crit, p: 50},
					].map((b) => (
						<div key={b.n} style={{background: C.surface, border: BORDE, borderRadius: 18, boxShadow: SOMBRA, padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 4}}>
							<Ceja color={b.c} style={{fontSize: 13}}>
								<span style={{display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: b.c, marginRight: 5, verticalAlign: 1}} />
								{b.n}
							</Ceja>
							<b style={{fontFamily: FD, fontWeight: 800, fontSize: 20, lineHeight: 1.05}}>{soles(Math.round(b.v * cuenta))}</b>
							<div style={{height: 10, borderRadius: 99, border: `2px solid ${C.ink}`, overflow: 'hidden', background: C.surface}}>
								<div style={{height: '100%', width: `${b.p * cuenta}%`, background: b.c}} />
							</div>
						</div>
					))}
				</div>
				<div style={{...entra(t, desde, fps, 3)}}>
					<div style={{fontFamily: FD, fontWeight: 800, fontSize: 23, marginBottom: 6}}>Últimos movimientos</div>
					<Tarjeta style={{padding: '4px 16px'}}>
						{MOVIMIENTOS.map((m, i) => (
							<div key={m.n} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < MOVIMIENTOS.length - 1 ? `2px dashed ${C.muted}` : 'none'}}>
								<div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.15}}>
									<span style={{fontWeight: 800, fontSize: 19}}>{m.n}</span>
									<span style={{fontSize: 15, color: C.muted, fontWeight: 600}}>{m.c} · hoy</span>
								</div>
								<span style={{fontFamily: FD, fontWeight: 800, fontSize: 21, color: C.crit}}>-{soles(m.m)}</span>
							</div>
						))}
					</Tarjeta>
				</div>
			</div>
			<Pestanas activa="inicio" />
		</Pantalla>
	);
};

// --- Categorías (dona) ---
const CATEGORIAS = [
	{n: 'Comida', v: 420, c: C.terra},
	{n: 'Salidas', v: 290, c: C.honey},
	{n: 'Transporte', v: 160, c: C.sage},
	{n: 'Servicios', v: 120, c: C.c0},
	{n: 'Otros', v: 60, c: C.c4},
];
export const PantallaCategorias: React.FC<{desde: number; progreso: number}> = ({desde, progreso}) => {
	const {t, fps} = useT();
	const tot = CATEGORIAS.reduce((s, c) => s + c.v, 0);
	const R = 40, CIRC = 2 * Math.PI * R;
	const dibujado = Math.max(0, Math.min(1, progreso)) * CIRC;
	const resalta = interpolate(progreso, [0.85, 1], [0, 1], fijo);
	let off = 0;
	const segs = CATEGORIAS.map((c, i) => {
		const len = (c.v / tot) * CIRC;
		const vis = Math.max(0, Math.min(len, dibujado - off));
		const el =
			vis > 0 && !(i === 0 && resalta > 0) ? (
				<circle key={c.n} cx={60} cy={60} r={R} fill="none" stroke={c.c} strokeWidth={18}
					strokeDasharray={`${vis} ${CIRC - vis}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />
			) : null;
		off += len;
		return el;
	});
	return (
		<Pantalla>
			<BarraEstado />
			<div style={{position: 'absolute', top: 60, left: 18, right: 18, display: 'flex', flexDirection: 'column', gap: 12}}>
				<div style={entra(t, desde, fps, 0)}>
					<div style={{fontFamily: FD, fontWeight: 800, fontSize: 34, lineHeight: 1.05}}>En qué se fue</div>
					<div style={{fontSize: 18, color: C.muted, fontWeight: 700}}>Mayo · gasto por categoría</div>
				</div>
				<Tarjeta style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '14px 14px 12px', position: 'relative', ...entra(t, desde, fps, 1)}}>
					<svg viewBox="0 0 120 120" width={222} height={222} style={{display: 'block', overflow: 'visible'}}>
						<circle cx={60} cy={60} r={R} fill="none" stroke={C.sunk} strokeWidth={18} />
						{segs}
						<circle cx={60} cy={60} r={50} fill="none" stroke={C.ink} strokeWidth={2.5} />
						<circle cx={60} cy={60} r={30} fill={C.surface} stroke={C.ink} strokeWidth={2.5} />
						{resalta > 0 ? (() => {
							const a1 = (CATEGORIAS[0].v / tot) * Math.PI * 2;
							const mid = a1 / 2, d = 7 * Easing.out(Easing.back(2))(resalta);
							const pt = (rr: number, a: number) => `${60 + rr * Math.sin(a)} ${60 - rr * Math.cos(a)}`;
							const big = a1 > Math.PI ? 1 : 0;
							const path = `M${pt(50, 0)}A50 50 0 ${big} 1 ${pt(50, a1)}L${pt(30, a1)}A30 30 0 ${big} 0 ${pt(30, 0)}Z`;
							return (
								<path d={path} fill={CATEGORIAS[0].c} stroke={C.ink} strokeWidth={2.5} strokeLinejoin="round"
									transform={`translate(${d * Math.sin(mid)} ${-d * Math.cos(mid)})`} />
							);
						})() : null}
						<text x={60} y={60} textAnchor="middle" style={{fontFamily: FD, fontWeight: 800, fontSize: 14}} fill={C.ink}>
							{soles(Math.round(tot * Math.min(1, progreso))).replace('.00', '')}
						</text>
						<text x={60} y={73} textAnchor="middle" style={{fontFamily: FB, fontWeight: 800, fontSize: 9}} fill={C.muted}>
							gastado
						</text>
					</svg>
				</Tarjeta>
				<div style={{display: 'flex', flexDirection: 'column', gap: 7, ...entra(t, desde, fps, 2)}}>
					{CATEGORIAS.map((c, i) => {
						const on = i === 0 ? resalta : 0;
						const pct = Math.round((c.v / tot) * 100);
						const ap = interpolate(progreso, [i * 0.12, i * 0.12 + 0.3], [0, 1], fijo);
						return (
							<div
								key={c.n}
								style={{
									display: 'grid',
									gridTemplateColumns: 'auto 1fr auto',
									alignItems: 'center',
									gap: 10,
									padding: '7px 12px',
									borderRadius: 16,
									border: `2.5px solid ${on > 0 ? C.ink : 'transparent'}`,
									background: on > 0 ? `rgba(233,196,106,${on})` : 'transparent',
									boxShadow: on > 0 ? `${4 * on}px ${4 * on}px 0 ${C.ink}` : 'none',
									transform: `scale(${1 + 0.03 * on})`,
									opacity: ap,
								}}
							>
								<i style={{width: 18, height: 18, borderRadius: 5, border: `2px solid ${C.ink}`, background: c.c}} />
								<span style={{fontWeight: 800, fontSize: 21}}>
									{c.n} <span style={{color: on > 0 ? C.ink : C.muted, fontSize: 17}}>{pct} %</span>
								</span>
								<span style={{fontFamily: FD, fontWeight: 800, fontSize: 22}}>{soles(c.v)}</span>
							</div>
						);
					})}
				</div>
			</div>
			{/* globo "Aquí se te va más" */}
			<div
				style={{
					position: 'absolute',
					right: 26,
					top: 222,
					transform: `scale(${Easing.out(Easing.back(2))(resalta)}) rotate(-4deg)`,
					transformOrigin: '0% 50%',
					textAlign: 'center',
					lineHeight: 1.05,
					background: C.terra,
					color: C.surface,
					border: `3px solid ${C.ink}`,
					boxShadow: SOMBRA,
					borderRadius: 16,
					padding: '6px 14px',
					fontFamily: FD,
					fontWeight: 800,
					fontSize: 21,
					whiteSpace: 'nowrap',
					zIndex: 5,
				}}
			>
				¡Aquí se
				<br />
				te va
				<br />
				más!
				<span style={{position: 'absolute', left: -11, top: 'calc(50% - 8px)', width: 16, height: 16, background: C.terra, borderLeft: `3px solid ${C.ink}`, borderBottom: `3px solid ${C.ink}`, transform: 'rotate(45deg)'}} />
			</div>
			<Pestanas activa="plata" />
		</Pantalla>
	);
};

// --- Anotar (hoja rápida) ---
const CATS_APP = ['Comida', 'Transporte', 'Vivienda', 'Servicios', 'Salidas', 'Otros'];
export const PantallaAnotar: React.FC<{desde: number; monto: string; categoria?: string; guardado?: number}> = ({desde, monto, categoria, guardado = 0}) => {
	const {t, fps} = useT();
	const hoja = resorte(t, desde, fps, 18);
	const limpio = monto.replace(/^\s*S\/\s*/, '');
	const caret = Math.floor((t - desde) / 0.5) % 2 === 0 && guardado <= 0;
	const pulsa = guardado > 0 && guardado < 0.25 ? Math.sin((guardado / 0.25) * Math.PI) : 0;
	const aviso = interpolate(guardado, [0.15, 0.55], [0, 1], {...fijo, easing: Easing.out(Easing.back(1.3))});
	const chip = (txt: string, on: boolean) => (
		<span key={txt} style={{display: 'inline-block', padding: '9px 15px', borderRadius: 99, border: BORDE, boxShadow: SOMBRA_S, background: on ? C.ink : C.surface, color: on ? C.surface : C.ink, fontWeight: 800, fontSize: 19}}>
			{txt}
		</span>
	);
	return (
		<Pantalla>
			<BarraEstado />
			{/* fondo: el inicio detrás del velo */}
			<div style={{position: 'absolute', top: 70, left: 16, right: 16, opacity: 0.5}}>
				<div style={{height: 54, width: 220, borderRadius: 16, background: C.sunk}} />
				<div style={{height: 170, marginTop: 16, borderRadius: 24, background: C.surface, border: BORDE}} />
			</div>
			<AbsoluteFill style={{background: `rgba(30,30,30,${0.45 * hoja})`}} />
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 0,
					height: 690,
					transform: `translateY(${(1 - hoja) * 700}px)`,
					...PAPEL,
					border: BORDE,
					borderBottom: 0,
					borderRadius: '28px 28px 0 0',
					padding: '20px 18px',
					display: 'flex',
					flexDirection: 'column',
					gap: 14,
				}}
			>
				<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
					<div style={{fontFamily: FD, fontWeight: 800, fontSize: 32}}>Anotar</div>
					<span style={{padding: '5px 12px', borderRadius: 11, border: BORDE, boxShadow: SOMBRA_S, background: C.surface, fontWeight: 800, fontSize: 16}}>Cerrar</span>
				</div>
				<div style={{display: 'flex', gap: 9}}>
					{chip('Gasté', true)}
					{chip('Me pagaron', false)}
				</div>
				<div>
					<div style={{fontSize: 16, fontWeight: 800, color: C.muted, marginBottom: 6}}>Monto</div>
					<div style={{display: 'flex', alignItems: 'center', gap: 10, background: C.surface, border: BORDE, borderRadius: 22, boxShadow: SOMBRA, padding: '6px 20px', height: 92, outline: `3px solid ${C.accent}`, outlineOffset: 3}}>
						<b style={{fontFamily: FD, fontSize: 32, color: C.muted, fontWeight: 800}}>S/</b>
						<span style={{fontFamily: FD, fontWeight: 800, fontSize: 60, lineHeight: 1, color: limpio ? C.ink : '#B5AC9E', letterSpacing: '-0.01em'}}>{limpio || '0.00'}</span>
						<span style={{width: 4, height: 54, background: C.accent, borderRadius: 2, opacity: caret ? 1 : 0, marginLeft: limpio ? -4 : -120}} />
					</div>
				</div>
				<div>
					<Ceja style={{marginBottom: 8}}>En qué</Ceja>
					<div style={{display: 'flex', flexWrap: 'wrap', gap: 9}}>{CATS_APP.map((c) => chip(c, c === categoria))}</div>
				</div>
				<div>
					<div style={{fontSize: 16, fontWeight: 800, color: C.muted, marginBottom: 6}}>Pagaste con</div>
					<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.surface, border: BORDE, borderRadius: 16, padding: '11px 16px', fontWeight: 700, fontSize: 20}}>
						Efectivo
						<svg width={16} height={10} viewBox="0 0 16 10"><path d="M2 2l6 6 6-6" fill="none" stroke={C.ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
					</div>
				</div>
				<div style={{marginTop: 'auto', marginBottom: 26}}>
					<div
						style={{
							textAlign: 'center',
							background: C.honey,
							border: BORDE,
							borderRadius: 18,
							boxShadow: pulsa > 0 ? `${4 - 3 * pulsa}px ${4 - 3 * pulsa}px 0 ${C.ink}` : SOMBRA,
							transform: `translate(${3 * pulsa}px, ${3 * pulsa}px)`,
							padding: '16px 0',
							fontFamily: FD,
							fontWeight: 800,
							fontSize: 28,
						}}
					>
						Guardar
					</div>
				</div>
			</div>
			{/* aviso "Anotado ✓" */}
			<div style={{position: 'absolute', left: 12, right: 12, top: 56, zIndex: 45, transform: `translateY(${(1 - aviso) * -190}px)`, opacity: aviso > 0 ? 1 : 0}}>
				<div style={{background: C.goodSoft, border: BORDE, borderRadius: 22, boxShadow: SOMBRA, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14}}>
					<div style={{width: 52, height: 52, borderRadius: '50%', background: C.sage, border: BORDE, display: 'grid', placeItems: 'center', color: C.surface, flex: 'none'}}>
						<Icono d={ICONOS.check} size={32} grosor={3.2} />
					</div>
					<div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.15}}>
						<b style={{fontFamily: FD, fontWeight: 800, fontSize: 28, color: C.good}}>Anotado ✓</b>
						<span style={{fontWeight: 700, fontSize: 18}}>
							Gasto S/ {limpio || '0.00'}
							{categoria ? ` · ${categoria}` : ''}
						</span>
					</div>
				</div>
			</div>
		</Pantalla>
	);
};

// --- Reporte semanal ---
const SEMANA = [
	{d: 'Lun', v: 22},
	{d: 'Mar', v: 48},
	{d: 'Mié', v: 18},
	{d: 'Jue', v: 35},
	{d: 'Vie', v: 62},
	{d: 'Sáb', v: 85},
	{d: 'Dom', v: 30},
];
export const PantallaReporte: React.FC<{desde: number; progreso: number}> = ({desde, progreso}) => {
	const {t, fps} = useT();
	const LIM = 40, TOP = 92;
	const altoGraf = 250;
	const tip = interpolate(progreso, [0.7, 0.95], [0, 1], {...fijo, easing: Easing.out(Easing.back(1.6))});
	const total = SEMANA.reduce((s, x) => s + x.v, 0);
	const pasados = SEMANA.filter((x) => x.v > LIM).length;
	return (
		<Pantalla>
			<BarraEstado />
			<div style={{position: 'absolute', top: 60, left: 18, right: 18, display: 'flex', flexDirection: 'column', gap: 14}}>
				<div style={entra(t, desde, fps, 0)}>
					<div style={{fontFamily: FD, fontWeight: 800, fontSize: 34, lineHeight: 1.05}}>Tu semana</div>
					<div style={{fontSize: 18, color: C.muted, fontWeight: 700}}>24 – 30 de mayo</div>
				</div>
				<Tarjeta style={{padding: '18px 14px 12px', ...entra(t, desde, fps, 1)}}>
					<div style={{position: 'relative', height: altoGraf, display: 'flex', alignItems: 'flex-end', gap: 9, borderBottom: `3px solid ${C.ink}`}}>
						{SEMANA.map((x, i) => {
							const k = interpolate(progreso, [i * 0.07, i * 0.07 + 0.45], [0, 1], {...fijo, easing: Easing.out(Easing.back(1.2))});
							const over = x.v > LIM;
							return (
								<div key={x.d} style={{flex: 1, height: `${(x.v / TOP) * 100 * k}%`, background: over ? C.terra : C.sage, border: `2.5px solid ${C.ink}`, borderBottom: 0, borderRadius: '8px 8px 0 0', position: 'relative'}}>
									{k > 0.9 && over ? (
										<span style={{position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', fontFamily: FD, fontWeight: 800, fontSize: 17, color: C.crit}}>{x.v}</span>
									) : null}
								</div>
							);
						})}
						<div style={{position: 'absolute', left: -4, right: -4, bottom: `${(LIM / TOP) * 100}%`, borderTop: `3px dashed ${C.ink}`, opacity: interpolate(progreso, [0, 0.15], [0, 1], fijo)}}>
							<span style={{position: 'absolute', left: 2, top: 6, background: C.surface, border: `2px solid ${C.ink}`, borderRadius: 99, padding: '0 9px', fontWeight: 800, fontSize: 15}}>Límite S/ {LIM}</span>
						</div>
					</div>
					<div style={{display: 'flex', gap: 9, paddingTop: 6}}>
						{SEMANA.map((x) => (
							<span key={x.d} style={{flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 16}}>{x.d}</span>
						))}
					</div>
					<div style={{display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: `2px dashed ${C.ink}`, fontSize: 18, fontWeight: 700}}>
						<span>Gastaste</span>
						<b style={{fontFamily: FD, fontSize: 22}}>{soles(Math.round(total * Math.min(1, progreso)))}</b>
					</div>
					<div style={{display: 'flex', gap: 14, marginTop: 6, fontSize: 15, fontWeight: 700, color: C.muted}}>
						<span><i style={{display: 'inline-block', width: 12, height: 12, background: C.sage, border: `2px solid ${C.ink}`, borderRadius: 3, marginRight: 5, verticalAlign: -1}} />Dentro</span>
						<span><i style={{display: 'inline-block', width: 12, height: 12, background: C.terra, border: `2px solid ${C.ink}`, borderRadius: 3, marginRight: 5, verticalAlign: -1}} />Te pasaste ({pasados} días)</span>
					</div>
				</Tarjeta>
				<div style={{display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'center', opacity: tip > 0 ? 1 : 0, transform: `translateY(${(1 - tip) * 40}px) scale(${0.9 + 0.1 * tip})`}}>
					<div style={{background: C.sunk, border: BORDE, borderRadius: 18, padding: 4}}>
						<Buddy animo="atento" size={96} />
					</div>
					<div style={{position: 'relative', background: C.surface, border: BORDE, borderRadius: 18, boxShadow: SOMBRA, padding: '12px 14px', fontWeight: 800, fontSize: 21, lineHeight: 1.25}}>
						Recorta en <span style={{color: C.crit}}>Salidas</span> y ahorras <span style={{background: C.honey, padding: '0 4px', borderRadius: 6}}>S/ 40</span>
						<span style={{position: 'absolute', left: -10, top: 30, width: 16, height: 16, background: C.surface, borderLeft: BORDE, borderBottom: BORDE, transform: 'rotate(45deg)'}} />
					</div>
				</div>
			</div>
			<Pestanas activa="historial" />
		</Pantalla>
	);
};

// --- Límites por categoría ---
const LIMITES = [
	{n: 'Comida', g: 280, l: 400},
	{n: 'Transporte', g: 70, l: 120},
	{n: 'Salidas', g: 92, l: 100},
	{n: 'Servicios', g: 95, l: 150},
	{n: 'Otros', g: 18, l: 50},
];
export const PantallaLimites: React.FC<{desde: number; progreso: number}> = ({desde, progreso}) => {
	const {t, fps} = useT();
	return (
		<Pantalla>
			<BarraEstado />
			<div style={{position: 'absolute', top: 60, left: 18, right: 18, display: 'flex', flexDirection: 'column', gap: 12}}>
				<div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...entra(t, desde, fps, 0)}}>
					<div>
						<div style={{fontFamily: FD, fontWeight: 800, fontSize: 34, lineHeight: 1.05}}>Tus límites</div>
						<div style={{fontSize: 18, color: C.muted, fontWeight: 700}}>Lo que puedes gastar en mayo</div>
					</div>
					<div style={{opacity: interpolate(progreso, [0.6, 0.8], [0, 1], fijo), marginRight: 4}}>
						<Buddy animo="nervioso" size={78} />
					</div>
				</div>
				<Tarjeta style={{padding: '6px 16px', ...entra(t, desde, fps, 1)}}>
					{LIMITES.map((c, i) => {
						const k = interpolate(progreso, [i * 0.08, i * 0.08 + 0.5], [0, 1], {...fijo, easing: Easing.out(Easing.cubic)});
						const pct = (c.g / c.l) * 100;
						const casi = pct >= 85;
						const pill = casi ? interpolate(progreso, [0.6, 0.8], [0, 1], {...fijo, easing: Easing.out(Easing.back(2))}) : 0;
						return (
							<div key={c.n} style={{display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 0', borderBottom: i < LIMITES.length - 1 ? `2px dashed ${C.muted}` : 'none'}}>
								<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8}}>
									<span style={{fontWeight: 800, fontSize: 21}}>{c.n}</span>
									{casi ? (
										<Pastilla tipo="warn" style={{transform: `scale(${pill})`, fontSize: 15}}>¡Casi al límite!</Pastilla>
									) : (
										<span style={{fontFamily: FD, fontWeight: 800, fontSize: 19, color: C.muted}}>{Math.round(pct * k)} %</span>
									)}
								</div>
								<Barra pct={pct * k} color={casi ? C.terra : C.sage} alto={18} />
								<div style={{fontSize: 16, fontWeight: 700, color: C.muted}}>
									<b style={{color: C.ink}}>{soles(Math.round(c.g * k))}</b> de {soles(c.l)}
								</div>
							</div>
						);
					})}
				</Tarjeta>
			</div>
			<Pestanas activa="plan" />
		</Pantalla>
	);
};

// ======================================================================================
// Tarjeta de cierre (lienzo 1080×1920)
// ======================================================================================
const azar = (i: number, s: number) => {
	const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
	return x - Math.floor(x);
};
const Confeti: React.FC<{desde: number; cx: number; cy: number; n?: number}> = ({desde, cx, cy, n = 34}) => {
	const {t} = useT();
	const dt = t - desde;
	if (dt < 0 || dt > 2.6) return null;
	const cols = [C.honey, C.terra, C.sage, C.ink, C.c0];
	return (
		<>
			{Array.from({length: n}, (_, i) => {
				const a = ((i + azar(i, 1) * 0.8) / n) * Math.PI * 2;
				const v = 700 + azar(i, 2) * 650; // px/s
				const k = 1 - Math.exp(-dt * 3.2);
				const x = cx + (Math.cos(a) * v * k) / 3.2;
				const y = cy + (Math.sin(a) * v * k) / 3.2 + 260 * dt * dt;
				const r = (azar(i, 3) - 0.5) * 900 * dt;
				const sz = 26 + azar(i, 4) * 22;
				const op = dt < 0.08 ? dt / 0.08 : interpolate(dt, [1.6, 2.6], [1, 0], fijo);
				const forma = i % 3;
				return (
					<svg key={i} viewBox="-7 -7 14 14" width={sz} height={sz} style={{position: 'absolute', left: x - sz / 2, top: y - sz / 2, transform: `rotate(${r}deg)`, opacity: op, overflow: 'visible'}}>
						{forma === 0 ? (
							<rect x={-5} y={-3} width={10} height={6} rx={1} fill={cols[i % 5]} stroke={C.ink} strokeWidth={1.4} />
						) : forma === 1 ? (
							<circle r={4} fill={cols[i % 5]} stroke={C.ink} strokeWidth={1.4} />
						) : (
							<path d="M0-6L1.7-1.7 6 0 1.7 1.7 0 6-1.7 1.7-6 0-1.7-1.7Z" fill={cols[i % 5]} stroke={C.ink} strokeWidth={1.4} strokeLinejoin="round" />
						)}
					</svg>
				);
			})}
		</>
	);
};

export const TarjetaCierre: React.FC<{desde: number; hasta: number}> = ({desde, hasta}) => {
	const {t, fps} = useT();
	if (t < desde || t > hasta + 0.05) return null;
	const fondo = interpolate(t, [desde, desde + 0.25], [0, 1], fijo) * interpolate(t, [hasta - 0.3, hasta], [1, 0], fijo);
	const logo = resorte(t, desde + 0.1, fps, 10);
	const buddy = resorte(t, desde + 0.3, fps, 12);
	const lema = resorte(t, desde + 0.55, fps, 14);
	const cta = resorte(t, desde + 0.8, fps, 10);
	const latido = 1 + 0.035 * Math.sin(Math.max(0, t - desde - 1.2) * Math.PI * 2 * 0.9);
	return (
		<AbsoluteFill style={{...PAPEL, backgroundSize: '40px 40px', backgroundImage: 'radial-gradient(rgba(30,30,30,.09) 2.5px, transparent 3.2px)', opacity: fondo, overflow: 'hidden'}}>
			<Confeti desde={desde + 0.25} cx={540} cy={560} />
			<div style={{position: 'absolute', top: 380, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${logo}) rotate(${(1 - logo) * -8}deg)`}}>
				<LogoAlcanza size={170} />
			</div>
			<div style={{position: 'absolute', top: 640, left: 80, right: 80, textAlign: 'center', fontFamily: FD, fontWeight: 800, fontSize: 84, lineHeight: 1.05, color: C.ink, opacity: lema, transform: `translateY(${(1 - lema) * 40}px)`}}>
				Finanzas claras,
				<br />
				<span style={{background: C.honey, border: `4px solid ${C.ink}`, boxShadow: `6px 6px 0 ${C.ink}`, borderRadius: 18, padding: '0 18px', display: 'inline-block', marginTop: 14, transform: 'rotate(-1.5deg)'}}>vida tranquila</span>
			</div>
			<div style={{position: 'absolute', top: 950, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `translateY(${(1 - buddy) * 500}px)`}}>
				<div style={{background: C.sunk, border: `5px solid ${C.ink}`, borderRadius: 60, boxShadow: `10px 10px 0 ${C.ink}`, padding: 26}}>
					<Buddy animo="feliz" size={420} saludar />
				</div>
			</div>
			<div style={{position: 'absolute', top: 1530, left: 0, right: 0, display: 'flex', justifyContent: 'center', transform: `scale(${cta * latido})`}}>
				<div style={{display: 'flex', alignItems: 'center', gap: 22, background: C.terra, color: C.surface, border: `5px solid ${C.ink}`, boxShadow: `9px 9px 0 ${C.ink}`, borderRadius: 999, padding: '26px 60px', fontFamily: FD, fontWeight: 800, fontSize: 72, whiteSpace: 'nowrap'}}>
					<svg viewBox="0 0 24 24" width={64} height={64}>
						<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" fill="none" stroke={C.surface} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					Descarga Alcanza
				</div>
			</div>
		</AbsoluteFill>
	);
};
