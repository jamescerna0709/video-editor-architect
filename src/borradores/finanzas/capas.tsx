// Capas 2D del borrador de finanzas, calcadas de los reels de referencia (referencias/estilos/finanzas-3d):
// subtítulo de una palabra, etiquetas doradas en mayúsculas y tarjetas infográficas crema con barra roja.
// Todo es determinista: depende solo de useCurrentFrame() y los tiempos van en SEGUNDOS de la composición.
// Las coordenadas son de un lienzo 1080×1920; cada capa se escala sola al ancho real del video.
import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';

// ---------- paleta y tipografía ----------
export const COLORES = {
	crema: '#f7f3e6',
	tinta: '#1d1b1a',
	rojo: '#e2343a',
	oro: '#ffc93c',
	oroOscuro: '#3a2706',
	verde: '#2f9e44',
	verdeTexto: '#1f8a3c',
	gris: '#d9d4c4',
};

/** Montserrat si el creador la instala; si no, Inter (instalada en el Chromium de Linux) en peso pesado. */
export const FUENTE = "'Montserrat', 'Inter Display', 'Inter', 'Liberation Sans', 'DejaVu Sans', sans-serif";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const useSegundos = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return {t: frame / fps, frame, fps};
};

/** Lienzo de 1080×1920 escalado al ancho real (1080 o 1440). */
const Lienzo: React.FC<{children: React.ReactNode}> = ({children}) => {
	const {width} = useVideoConfig();
	const s = width / 1080;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, transform: `scale(${s})`, transformOrigin: '0 0'}}>
				{children}
			</div>
		</AbsoluteFill>
	);
};

/** Entrada con resorte desde `desde` y salida rápida (0.18 s) antes de `hasta`. */
const usePop = (desde: number, hasta: number, damping = 11) => {
	const {frame, fps, t} = useSegundos();
	const visible = t >= desde && t < hasta;
	const entra = spring({frame: frame - Math.round(desde * fps), fps, config: {damping, stiffness: 180, mass: 0.7}});
	const sale = clamp01((hasta - t) / 0.18);
	return {visible, escala: (0.55 + 0.45 * entra) * (0.75 + 0.25 * sale), opacidad: clamp01(entra * 3) * sale, entra};
};

/** Progreso de resorte (0→1) a partir de un instante en segundos. */
const useResorte = (desde: number, damping = 13) => {
	const {frame, fps} = useSegundos();
	return spring({frame: frame - Math.round(desde * fps), fps, config: {damping, stiffness: 170, mass: 0.6}});
};

// ---------- íconos ----------
/** Palomita verde en círculo; `p` (0..1) la hace aparecer y trazarse. */
export const Palomita: React.FC<{tam?: number; p: number}> = ({tam = 44, p}) => {
	const q = clamp01(p);
	if (q <= 0) return <div style={{width: tam, height: tam}} />;
	const trazo = clamp01((q - 0.3) / 0.7);
	return (
		<svg width={tam} height={tam} viewBox="0 0 40 40" style={{transform: `scale(${0.4 + 0.6 * Math.min(1, q * 1.6)})`, overflow: 'visible'}}>
			<circle cx="20" cy="20" r="18" fill={COLORES.verde} stroke={COLORES.tinta} strokeWidth="2.5" />
			<path d="M11 20.5 L17.5 27 L29 14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - trazo} />
		</svg>
	);
};

/** Tache rojo; `p` (0..1) lo traza. */
export const Tache: React.FC<{tam?: number; p: number}> = ({tam = 44, p}) => {
	const q = clamp01(p);
	const a = clamp01(q * 2);
	const b = clamp01(q * 2 - 1);
	return (
		<svg width={tam} height={tam} viewBox="0 0 40 40" style={{overflow: 'visible'}}>
			<path d="M8 8 L32 32" stroke={COLORES.rojo} strokeWidth="6" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - a} />
			<path d="M32 8 L8 32" stroke={COLORES.rojo} strokeWidth="6" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - b} />
		</svg>
	);
};

// ---------- 1. Subtítulos de una palabra ----------
type Palabra = {i: number; mostrar: string; inicio: number; fin: number; escena: string};

const capitalizar = (s: string) => {
	const limpio = s.trim();
	const k = limpio.search(/\p{L}|\d/u);
	if (k < 0) return limpio;
	return limpio.slice(0, k) + limpio.charAt(k).toLocaleUpperCase('es') + limpio.slice(k + 1);
};

const HUECO_GRANDE = 0.5;

export const Subtitulos: React.FC<{palabras: Palabra[]; ocultarEn?: [number, number][]}> = ({palabras, ocultarEn = []}) => {
	const {t, frame, fps} = useSegundos();
	if (ocultarEn.some(([a, b]) => t >= a && t < b)) return null;
	const orden = [...palabras].sort((a, b) => a.inicio - b.inicio);
	let k = -1;
	for (let j = 0; j < orden.length; j++) {
		if (orden[j].inicio <= t) k = j;
		else break;
	}
	if (k < 0) return null;
	const p = orden[k];
	const sig = orden[k + 1];
	const fin = sig && sig.inicio - p.fin <= HUECO_GRANDE ? sig.inicio : p.fin + 0.25;
	if (t >= fin) return null;
	const f0 = Math.round(p.inicio * fps);
	const escala = interpolate(frame - f0, [0, 3], [0.9, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
	return (
		<Lienzo>
			<div
				style={{
					position: 'absolute',
					left: 0,
					width: 1080,
					top: 1920 * 0.62,
					display: 'flex',
					justifyContent: 'center',
					transform: `translateY(-50%) scale(${escala})`,
				}}
			>
				<span
					style={{
						fontFamily: FUENTE,
						fontWeight: 800,
						fontSize: 88,
						lineHeight: 1,
						color: '#fff',
						letterSpacing: 0.3,
						WebkitTextStroke: `2.5px ${COLORES.tinta}`,
						paintOrder: 'stroke fill',
						textShadow: '0 4px 0 rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.55)',
						whiteSpace: 'nowrap',
					}}
				>
					{capitalizar(p.mostrar)}
				</span>
			</div>
		</Lienzo>
	);
};

// ---------- 2. Etiqueta dorada ----------
/** Contorno oscuro con sombras en 16 direcciones (más fiable que text-stroke para letras pesadas). */
const contorno = (r: number, color: string) => {
	const partes: string[] = [];
	for (let a = 0; a < 16; a++) {
		const ang = (a / 16) * Math.PI * 2;
		partes.push(`${(Math.cos(ang) * r).toFixed(2)}px ${(Math.sin(ang) * r).toFixed(2)}px 0 ${color}`);
	}
	return partes.join(', ');
};

export const Etiqueta: React.FC<{
	texto: string;
	desde: number;
	hasta: number;
	x: number;
	y: number;
	flecha?: {x: number; y: number};
	pildora?: boolean;
	tam?: number;
}> = ({texto, desde, hasta, x, y, flecha, pildora = false, tam = 64}) => {
	const {visible, escala, opacidad} = usePop(desde, hasta);
	const traza = useResorte(desde + 0.12, 20);
	if (!visible) return null;
	const textoMay = texto.toLocaleUpperCase('es');

	let linea: React.ReactNode = null;
	if (flecha) {
		// Sale del borde de la etiqueta más cercano al objetivo.
		const medioAncho = (textoMay.length * tam * 0.66) / 2 + (pildora ? 30 : 0);
		const medioAlto = tam * 0.62 + (pildora ? 16 : 0);
		const dx = flecha.x - x;
		const dy = flecha.y - y;
		const sx = Math.abs(dx) * medioAlto > Math.abs(dy) * medioAncho ? x + Math.sign(dx) * medioAncho : x + (dy === 0 ? 0 : (dx / Math.abs(dy)) * medioAlto);
		const sy = Math.abs(dx) * medioAlto > Math.abs(dy) * medioAncho ? y + (dx === 0 ? 0 : (dy / Math.abs(dx)) * medioAncho) : y + Math.sign(dy) * medioAlto;
		const ex = sx + (flecha.x - sx) * traza;
		const ey = sy + (flecha.y - sy) * traza;
		linea = (
			<svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, opacity: opacidad, overflow: 'visible'}}>
				<line x1={sx} y1={sy} x2={ex} y2={ey} stroke={COLORES.tinta} strokeWidth={10} strokeLinecap="round" />
				<line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#fff" strokeWidth={5} strokeLinecap="round" />
				{traza > 0.9 && <circle cx={flecha.x} cy={flecha.y} r={9 * clamp01((traza - 0.9) * 10)} fill="#fff" stroke={COLORES.tinta} strokeWidth={4} />}
			</svg>
		);
	}

	return (
		<Lienzo>
			{linea}
			<div
				style={{
					position: 'absolute',
					left: x,
					top: y,
					transform: `translate(-50%, -50%) scale(${escala})`,
					opacity: opacidad,
					fontFamily: FUENTE,
					fontWeight: 900,
					fontSize: tam,
					lineHeight: 1,
					color: COLORES.oro,
					whiteSpace: 'nowrap',
					letterSpacing: 0.5,
					textShadow: pildora ? '0 3px 0 rgba(0,0,0,0.4)' : `${contorno(3.5, COLORES.oroOscuro)}, 0 6px 14px rgba(0,0,0,0.45)`,
					...(pildora
						? {
								background: 'rgba(22,20,18,0.88)',
								padding: `${tam * 0.24}px ${tam * 0.45}px`,
								borderRadius: 999,
								border: `4px solid ${COLORES.tinta}`,
								boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
							}
						: {}),
				}}
			>
				{textoMay}
			</div>
		</Lienzo>
	);
};

// ---------- 3. Tarjeta ----------
export const Tarjeta: React.FC<{
	titulo: string;
	desde: number;
	hasta: number;
	x?: number;
	y?: number;
	ancho?: number;
	children: React.ReactNode;
}> = ({titulo, desde, hasta, x = 540, y = 600, ancho = 640, children}) => {
	const {visible, escala, opacidad} = usePop(desde, hasta, 12);
	if (!visible) return null;
	return (
		<Lienzo>
			<div
				style={{
					position: 'absolute',
					left: x,
					top: y,
					width: ancho,
					transform: `translate(-50%, -50%) scale(${escala})`,
					opacity: opacidad,
					background: COLORES.crema,
					border: `6px solid ${COLORES.tinta}`,
					borderRadius: 26,
					padding: 20,
					boxSizing: 'border-box',
					boxShadow: '0 14px 30px rgba(0,0,0,0.35)',
					fontFamily: FUENTE,
					color: COLORES.tinta,
				}}
			>
				{titulo ? (
					<div
						style={{
							background: COLORES.rojo,
							borderRadius: 12,
							height: 56,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: '#fff',
							fontWeight: 900,
							fontSize: 36,
							letterSpacing: 1,
							marginBottom: 18,
						}}
					>
						{titulo.toLocaleUpperCase('es')}
					</div>
				) : null}
				{children}
			</div>
		</Lienzo>
	);
};

// ---------- 4. Contenidos de tarjeta ----------
const Chip: React.FC<{tam: number; fondo?: string; children?: React.ReactNode; style?: React.CSSProperties}> = ({tam, fondo = COLORES.crema, children, style}) => (
	<div
		style={{
			width: tam,
			height: tam,
			borderRadius: tam * 0.16,
			border: `4px solid ${COLORES.tinta}`,
			background: fondo,
			boxSizing: 'border-box',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			fontWeight: 900,
			fontSize: tam * 0.48,
			position: 'relative',
			...style,
		}}
	>
		{children}
	</div>
);

/** Pila de monedas que crece con `n` (puede ser fraccionario). */
const PilaMonedas: React.FC<{n: number; max: number}> = ({n, max}) => {
	const alto = 22;
	const paso = Math.min(16, 150 / Math.max(1, max));
	const monedas = Math.ceil(n);
	return (
		<svg width={130} height={190} viewBox="0 0 130 190" style={{overflow: 'visible'}}>
			<ellipse cx={65} cy={176} rx={56} ry={10} fill="rgba(0,0,0,0.12)" />
			{Array.from({length: monedas}, (_, i) => {
				const p = clamp01(n - i);
				const cy = 166 - i * paso - (1 - p) * 40;
				return (
					<g key={i} opacity={p}>
						<rect x={15} y={cy - alto / 2} width={100} height={alto / 2 + 2} fill="#d99a14" stroke={COLORES.tinta} strokeWidth={3.5} />
						<ellipse cx={65} cy={cy + alto / 2} rx={50} ry={alto / 2} fill="#d99a14" stroke={COLORES.tinta} strokeWidth={3.5} />
						<rect x={16.8} y={cy - alto / 2} width={96.4} height={alto / 2 + 2} fill="#d99a14" />
						<ellipse cx={65} cy={cy - alto / 2} rx={50} ry={alto / 2} fill={COLORES.oro} stroke={COLORES.tinta} strokeWidth={3.5} />
						<ellipse cx={65} cy={cy - alto / 2} rx={30} ry={alto / 4} fill="none" stroke="#d99a14" strokeWidth={3} />
					</g>
				);
			})}
			{monedas === 0 && <ellipse cx={65} cy={160} rx={50} ry={11} fill="none" stroke={COLORES.tinta} strokeWidth={3.5} strokeDasharray="8 7" />}
		</svg>
	);
};

export const Dias: React.FC<{desde: number; total?: number; llenos: number; monedas?: boolean}> = ({desde, total = 10, llenos, monedas = true}) => {
	const {t} = useSegundos();
	const tam = 76;
	return (
		<div style={{display: 'flex', alignItems: 'center', gap: 18}}>
			<div style={{display: 'grid', gridTemplateColumns: `repeat(5, ${tam}px)`, gap: 12, flex: 'none'}}>
				{Array.from({length: total}, (_, i) => {
					const entra = clamp01((t - desde - 0.04 - i * 0.025) / 0.15);
					const lleno = clamp01(llenos - i);
					return (
						<Chip key={i} tam={tam} fondo={lleno > 0 ? COLORES.oro : COLORES.crema} style={{transform: `scale(${(0.6 + 0.4 * entra) * (1 + 0.12 * Math.sin(lleno * Math.PI))})`, opacity: entra}}>
							{i + 1}
							{lleno > 0 && (
								<div style={{position: 'absolute', right: -14, top: -14}}>
									<Palomita tam={34} p={lleno} />
								</div>
							)}
						</Chip>
					);
				})}
			</div>
			{monedas && (
				<div style={{flex: 1, display: 'flex', justifyContent: 'center'}}>
					<PilaMonedas n={Math.max(0, Math.min(total, llenos))} max={total} />
				</div>
			)}
		</div>
	);
};

export const Precio: React.FC<{desde: number; antes: string; despues: string; cambio: number}> = ({desde, antes, despues, cambio}) => {
	const entra = useResorte(desde);
	const c = Easing.inOut(Easing.cubic)(clamp01(cambio));
	const alto = 132;
	return (
		<div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, transform: `scale(${0.7 + 0.3 * entra})`}}>
			<div style={{height: alto, overflow: 'hidden', position: 'relative'}}>
				<div style={{transform: `translateY(${-c * alto}px)`}}>
					{[{s: antes, color: COLORES.tinta}, {s: despues, color: COLORES.rojo}].map(({s, color}, k) => (
						<div key={k} style={{height: alto, display: 'flex', alignItems: 'center', fontSize: 118, fontWeight: 900, color, letterSpacing: -2, lineHeight: 1, whiteSpace: 'nowrap'}}>
							{s}
						</div>
					))}
				</div>
			</div>
			<svg width={84} height={110} viewBox="0 0 84 110" style={{opacity: clamp01(c * 2), transform: `translateY(${(1 - c) * 30}px) scale(${0.5 + 0.5 * c})`}}>
				<path d="M42 6 L80 50 L56 50 L56 104 L28 104 L28 50 L4 50 Z" fill={COLORES.rojo} stroke={COLORES.tinta} strokeWidth={5} strokeLinejoin="round" />
			</svg>
		</div>
	);
};

export const Lista: React.FC<{desde: number; items: string[]; marcados: number}> = ({desde, items, marcados}) => {
	const {t} = useSegundos();
	return (
		<div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
			{items.map((it, i) => {
				const entra = clamp01((t - desde - 0.12 - i * 0.07) / 0.2);
				const m = clamp01(marcados - i);
				return (
					<div key={i} style={{display: 'flex', alignItems: 'center', gap: 18, opacity: entra, transform: `translateX(${(1 - entra) * -30}px)`}}>
						<Chip tam={56} fondo={m >= 1 ? COLORES.oro : COLORES.crema}>
							{i + 1}
						</Chip>
						<div style={{flex: 1, fontSize: 36, fontWeight: 800, color: m >= 1 ? COLORES.verdeTexto : COLORES.tinta, lineHeight: 1.1}}>{it.toLocaleUpperCase('es')}</div>
						<Palomita tam={48} p={m} />
					</div>
				);
			})}
		</div>
	);
};

type Lado = {titulo: string; valor: string; color?: string};

export const Comparar: React.FC<{desde: number; izq: Lado; der: Lado; ganador?: 'izq' | 'der'}> = ({desde, izq, der, ganador}) => {
	const {t} = useSegundos();
	const entra = useResorte(desde + 0.05);
	const marca = clamp01((t - desde - 0.6) / 0.35);
	const col = (l: Lado, lado: 'izq' | 'der') => (
		<div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '4px 8px'}}>
			<div style={{fontSize: 30, fontWeight: 900, color: '#57524a', letterSpacing: 0.5, textAlign: 'center'}}>{l.titulo.toLocaleUpperCase('es')}</div>
			<div style={{fontSize: 70, fontWeight: 900, color: l.color ?? COLORES.tinta, letterSpacing: -1.5, lineHeight: 1.05, whiteSpace: 'nowrap', transform: `scale(${0.6 + 0.4 * entra})`}}>{l.valor}</div>
			<div style={{height: 52, display: 'flex', alignItems: 'center'}}>{ganador ? ganador === lado ? <Palomita tam={52} p={marca} /> : <Tache tam={44} p={marca} /> : null}</div>
		</div>
	);
	return (
		<div style={{display: 'flex', alignItems: 'stretch'}}>
			{col(izq, 'izq')}
			<div style={{width: 5, background: COLORES.tinta, borderRadius: 3, margin: '6px 4px', transform: `scaleY(${entra})`}} />
			{col(der, 'der')}
		</div>
	);
};

const miles = (n: number) => {
	const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return n < 0 ? `-${s}` : s;
};

export const Contador: React.FC<{desde: number; de: number; a: number; dura: number; prefijo?: string; sufijo?: string; color?: string}> = ({
	desde,
	de,
	a,
	dura,
	prefijo = '',
	sufijo = '',
	color = COLORES.tinta,
}) => {
	const {t} = useSegundos();
	const entra = useResorte(desde);
	const p = Easing.out(Easing.cubic)(clamp01((t - desde) / Math.max(0.01, dura)));
	const valor = de + (a - de) * p;
	const golpe = p >= 1 ? 1 + 0.08 * Math.max(0, 1 - (t - desde - dura) / 0.25) : 1;
	return (
		<div style={{display: 'flex', justifyContent: 'center', transform: `scale(${(0.7 + 0.3 * entra) * golpe})`}}>
			<span style={{fontSize: 124, fontWeight: 900, color, letterSpacing: -2, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>
				{prefijo}
				{miles(valor)}
				{sufijo}
			</span>
		</div>
	);
};

export const Anios: React.FC<{desde: number; activos: number; valores: string[]}> = ({desde, activos, valores}) => {
	const {t} = useSegundos();
	const n = valores.length;
	const tam = Math.min(104, (560 - (n - 1) * 12) / Math.max(1, n));
	return (
		<div style={{display: 'flex', justifyContent: 'center', gap: 12}}>
			{valores.map((v, i) => {
				const entra = clamp01((t - desde - 0.1 - i * 0.06) / 0.2);
				const act = clamp01(activos - i);
				return (
					<div key={i} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: entra, transform: `translateY(${(1 - entra) * 20}px)`}}>
						<Chip tam={tam} fondo={act > 0.5 ? COLORES.verde : COLORES.crema} style={{flexDirection: 'column', color: act > 0.5 ? '#fff' : COLORES.tinta, transform: `scale(${1 + 0.12 * Math.sin(act * Math.PI)})`, lineHeight: 1}}>
							<span style={{fontSize: tam * 0.2, fontWeight: 800}}>AÑO</span>
							<span style={{fontSize: tam * 0.44, fontWeight: 900}}>{i + 1}</span>
						</Chip>
						<div style={{fontSize: Math.max(22, tam * 0.27), fontWeight: 900, color: act > 0.5 ? COLORES.verdeTexto : '#6b655a', whiteSpace: 'nowrap'}}>{v}</div>
					</div>
				);
			})}
		</div>
	);
};
