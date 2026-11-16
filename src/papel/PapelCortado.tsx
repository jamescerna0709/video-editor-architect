/**
 * Reel hecho desde cero en estilo "papel cortado" (paper cut): capas de papel con bordes recortados irregulares,
 * sombras apiladas, textura de fibra y movimiento a pasos de stop-motion (12 cuadros por segundo de animación).
 * Todo se dibuja con SVG y CSS: no usa imágenes, música ni assets externos. Fuente: TikTok Sans (OFL-1.1).
 *
 * Guion (mensaje de @jamesr_cl, reel De2XGAORTJb): consumir contenido no es aprender; elige una cosa y ponla en
 * práctica hoy. Todo el texto queda dentro de la zona segura de Reels (x 135–945, y 220–1600 en 1080×1920).
 */
import {loadFont} from '@remotion/fonts';
import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {DURACIONES_ESCENAS, INICIOS_ESCENAS} from './tiempos';

// ───────────────────────── paleta y fuente ─────────────────────────

const C = {
	fondo: '#F1E6D2',
	papel: '#FFFBF3',
	tinta: '#1F2A37',
	marino: '#24364B',
	teal: '#2F7F7A',
	tealClaro: '#7FBFB4',
	naranja: '#E4774A',
	mostaza: '#E9B949',
	rosa: '#E89A8C',
	lima: '#B6FF3B',
	gris: '#B9B2A6',
};

const FAMILIA = 'Papel TikTok Sans';
let fuenteCargada = false;
function cargarFuente(): void {
	if (fuenteCargada || typeof window === 'undefined') return;
	fuenteCargada = true;
	loadFont({family: FAMILIA, url: staticFile('biblioteca/fuentes/tiktok-sans/TikTokSans-ExtraBold.ttf'), weight: '800', style: 'normal', display: 'block'});
}

export {DURACION_PAPEL} from './tiempos';

// ───────────────────────── utilidades ─────────────────────────

/** Número pseudoaleatorio estable en [0, 1) a partir de una semilla. */
function azar(semilla: number): number {
	let t = (semilla * 2654435761 + 0x6d2b79f5) >>> 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** El cuadro "a pasos": el movimiento avanza cada 2 cuadros, como stop-motion. */
const paso = (f: number): number => Math.floor(f / 2) * 2;

/** Pequeño temblor de recorte puesto a mano (cambia en cada paso). */
function temblor(f: number, semilla: number, grados = 0.6): number {
	return (azar(semilla * 97 + Math.floor(f / 2)) - 0.5) * grados;
}

/** Entrada con resorte desde el cuadro `desde`. */
function useEntrada(desde: number, amortiguacion = 13): number {
	const f = paso(useCurrentFrame());
	const {fps} = useVideoConfig();
	return spring({frame: f - desde, fps, config: {damping: amortiguacion, stiffness: 140, mass: 0.8}});
}

/** Borde recortado a tijera: un rectángulo con orillas irregulares. */
function caminoRecorte(w: number, h: number, semilla: number, mella = 5, pasoPx = 26): string {
	const pts: Array<[number, number]> = [];
	const lado = (x0: number, y0: number, x1: number, y1: number, s: number) => {
		const largo = Math.hypot(x1 - x0, y1 - y0);
		const n = Math.max(2, Math.round(largo / pasoPx));
		const nx = -(y1 - y0) / largo;
		const ny = (x1 - x0) / largo;
		for (let i = 0; i < n; i++) {
			const t = i / n;
			const d = (azar(s + i) - 0.5) * 2 * mella;
			pts.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d]);
		}
	};
	lado(0, 0, w, 0, semilla);
	lado(w, 0, w, h, semilla + 100);
	lado(w, h, 0, h, semilla + 200);
	lado(0, h, 0, 0, semilla + 300);
	return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} Z`;
}

/** Círculo recortado a tijera (orilla un poco irregular). */
function caminoCirculo(d: number, semilla: number, mella = 4): string {
	const r = d / 2;
	const n = 48;
	const pts: string[] = [];
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2;
		const rr = r - mella + (azar(semilla + i) - 0.5) * 2 * mella;
		pts.push(`${(r + Math.cos(a) * rr).toFixed(1)},${(r + Math.sin(a) * rr).toFixed(1)}`);
	}
	return `M${pts.join(' L')} Z`;
}

/** Colina de papel: orilla superior ondulada que llena hasta abajo. */
function caminoColina(w: number, h: number, semilla: number, amplitud: number, ondas: number): string {
	const n = 40;
	const fase = azar(semilla) * Math.PI * 2;
	const pts: string[] = [];
	for (let i = 0; i <= n; i++) {
		const x = (i / n) * w;
		const y = amplitud + Math.sin((i / n) * Math.PI * 2 * ondas + fase) * amplitud * 0.8 + (azar(semilla + i) - 0.5) * 6;
		pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
	}
	return `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
}

const SOMBRA = 'drop-shadow(0 3px 0 rgba(60,40,20,0.18)) drop-shadow(0 10px 14px rgba(60,40,20,0.28))';
const SOMBRA_SUAVE = 'drop-shadow(0 2px 0 rgba(60,40,20,0.15)) drop-shadow(0 6px 8px rgba(60,40,20,0.2))';

// ───────────────────────── piezas de papel ─────────────────────────

/** Una pieza de papel recortada, con su textura de fibra. */
const Papel: React.FC<{w: number; h: number; color: string; semilla: number; mella?: number; sombra?: string; circulo?: boolean; children?: React.ReactNode}> = ({
	w,
	h,
	color,
	semilla,
	mella = 5,
	sombra = SOMBRA,
	circulo = false,
	children,
}) => {
	const id = `p${semilla}`;
	const d = circulo ? caminoCirculo(w, semilla, mella) : caminoRecorte(w, h, semilla, mella);
	return (
		<div style={{position: 'relative', width: w, height: h, filter: sombra}}>
			<svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				<defs>
					<clipPath id={`c${id}`}>
						<path d={d} />
					</clipPath>
				</defs>
				<path d={d} fill={color} />
				<rect width={w} height={h} clipPath={`url(#c${id})`} filter="url(#fibra)" opacity={0.35} style={{mixBlendMode: 'multiply'}} />
			</svg>
			<div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{children}</div>
		</div>
	);
};

/** Coloca una pieza en (x, y) = centro, con giro y escala. */
const En: React.FC<{x: number; y: number; giro?: number; escala?: number; opacidad?: number; children: React.ReactNode}> = ({
	x,
	y,
	giro = 0,
	escala = 1,
	opacidad = 1,
	children,
}) => (
	<div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) rotate(${giro}deg) scale(${escala})`, opacity: opacidad}}>
		{children}
	</div>
);

/** Tira de papel con texto (como letrero recortado). La palabra en `resalta` va sobre un parche lima. */
const Tira: React.FC<{texto: string; resalta?: string; tam?: number; semilla: number; color?: string; colorTexto?: string}> = ({
	texto,
	resalta,
	tam = 78,
	semilla,
	color = C.papel,
	colorTexto = C.tinta,
}) => {
	const palabras = texto.split(' ');
	// Orilla recortada en % (la tira se ajusta sola al ancho del texto).
	const puntos: string[] = [];
	const n = 18;
	for (let i = 0; i <= n; i++) puntos.push(`${((i / n) * 100).toFixed(1)}% ${(azar(semilla + i) * 7).toFixed(1)}%`);
	for (let i = 0; i <= 3; i++) puntos.push(`${(100 - azar(semilla + 40 + i) * 1.2).toFixed(1)}% ${((i / 3) * 100).toFixed(1)}%`);
	for (let i = n; i >= 0; i--) puntos.push(`${((i / n) * 100).toFixed(1)}% ${(100 - azar(semilla + 60 + i) * 7).toFixed(1)}%`);
	for (let i = 3; i >= 0; i--) puntos.push(`${(azar(semilla + 90 + i) * 1.2).toFixed(1)}% ${((i / 3) * 100).toFixed(1)}%`);
	return (
		<div style={{filter: SOMBRA}}>
			<div style={{position: 'relative', background: color, clipPath: `polygon(${puntos.join(', ')})`, padding: `${tam * 0.32}px ${tam * 0.45}px`}}>
				<svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
					<rect width="100%" height="100%" filter="url(#fibra)" opacity={0.35} style={{mixBlendMode: 'multiply'}} />
				</svg>
			<div style={{position: 'relative', fontFamily: FAMILIA, fontWeight: 800, fontSize: tam, lineHeight: 1.05, color: colorTexto, letterSpacing: -1, whiteSpace: 'nowrap', display: 'flex', gap: tam * 0.28, alignItems: 'center'}}>
				{palabras.map((p, i) =>
					resalta && p.replace(/[¿?¡!.,…]/g, '') === resalta ? (
						<span key={i} style={{position: 'relative', padding: `0 ${tam * 0.12}px`}}>
							<span style={{position: 'absolute', inset: `-${tam * 0.06}px -${tam * 0.02}px`, background: C.lima, transform: `rotate(${(azar(semilla + i) - 0.5) * 4}deg)`, boxShadow: '0 3px 0 rgba(60,40,20,0.18)'}} />
							<span style={{position: 'relative'}}>{p}</span>
						</span>
					) : (
						<span key={i}>{p}</span>
					),
				)}
			</div>
			</div>
		</div>
	);
};

// ───────────────────────── fondo ─────────────────────────

const Fondo: React.FC = () => {
	const f = paso(useCurrentFrame());
	const capas = [
		{color: C.tealClaro, y: 1450, amp: 40, ondas: 1.5, vel: 0.15},
		{color: C.teal, y: 1560, amp: 50, ondas: 1.2, vel: -0.25},
		{color: C.marino, y: 1690, amp: 36, ondas: 2, vel: 0.35},
	];
	return (
		<AbsoluteFill style={{background: C.fondo}}>
			<svg width={0} height={0} style={{position: 'absolute'}}>
				<filter id="fibra">
					<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={7} />
					<feColorMatrix type="saturate" values="0" />
				</filter>
			</svg>
			<svg width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
				<rect width={1080} height={1920} filter="url(#fibra)" opacity={0.18} style={{mixBlendMode: 'multiply'}} />
			</svg>
			{/* sol de papel asomándose detrás de las colinas */}
			<En x={800} y={1450 + Math.sin(f / 40) * 8}>
				<Papel w={240} h={240} color={C.mostaza} semilla={901} mella={4} sombra={SOMBRA_SUAVE} circulo />
			</En>
			{capas.map((c, i) => (
				<div key={i} style={{position: 'absolute', left: -60 + Math.sin(f / 30 + i) * 14 * c.vel * 4, top: c.y, filter: SOMBRA}}>
					<svg width={1200} height={1920 - c.y + 40}>
						<path d={caminoColina(1200, 1920 - c.y + 40, 500 + i * 13, c.amp, c.ondas)} fill={c.color} />
					</svg>
				</div>
			))}
		</AbsoluteFill>
	);
};

// ───────────────────────── barrido entre escenas ─────────────────────────

const Barrido: React.FC<{color: string; semilla: number}> = ({color, semilla}) => {
	const f = paso(useCurrentFrame());
	// La hoja (4000 px) tapa toda la pantalla mientras su orilla de arriba va de 0 a −2080: alrededor del cuadro 7, el corte.
	// v3: 14 cuadros en vez de 20 (James: "solo un poco más rápido").
	const y = interpolate(f, [0, 14], [2000, -4200], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<div style={{position: 'absolute', left: -200, top: y, transform: 'rotate(-6deg)'}}>
				<Papel w={1480} h={4000} color={color} semilla={semilla} mella={18} />
			</div>
		</AbsoluteFill>
	);
};

// ───────────────────────── escenas ─────────────────────────

/** Salida común: los últimos 8 cuadros todo se encoge un poco y se va hacia arriba. */
function useSalida(duracion: number): {y: number; o: number} {
	const f = useCurrentFrame();
	const t = interpolate(f, [duracion - 6, duracion], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return {y: -t * 60, o: 1 - t};
}

const TITULOS = [
	'5 HÁBITOS DE ÉXITO',
	'RUTINA DE LAS 5 AM',
	'CÓMO SER PRODUCTIVO',
	'10 TIPS DE ENFOQUE',
	'DEJA DE PROCRASTINAR',
	'MÉTODO POMODORO',
	'MENTALIDAD GANADORA',
	'ORGANIZA TU SEMANA',
	'LEE ESTO HOY',
];
const DURACIONES = ['8:12', '12:40', '5:07', '21:03', '9:58', '3:45', '15:20', '7:31', '11:09'];
const VISTAS = ['1.2 M', '845 K', '2.4 M', '310 K', '960 K', '1.7 M', '502 K', '88 K', '3.1 M'];
const ROJO = '#D9473B';

/**
 * Miniatura de video hecha de papel: arriba avatar + título (lo que se ve cuando están apiladas), abajo la imagen con
 * su paisajito, botón de play, duración, vistas y barra de progreso.
 */
const Miniatura: React.FC<{w: number; h: number; color: string; i: number; semilla: number; sombra?: string}> = ({w, h, color, i, semilla, sombra}) => {
	const fila = Math.round(h * 0.3);
	const tamTitulo = Math.round(fila * 0.42);
	const img = {x: Math.round(w * 0.05), y: fila + 4, w: Math.round(w * 0.9), h: h - fila - Math.round(h * 0.09)};
	const avatar = Math.round(fila * 0.62);
	const progreso = 0.2 + azar(semilla + 3) * 0.6;
	return (
		<Papel w={w} h={h} color={color} semilla={semilla} mella={4} sombra={sombra}>
			<div style={{position: 'absolute', inset: 0}}>
				{/* fila de arriba: avatar + título en tira de papel */}
				<div style={{position: 'absolute', left: img.x, top: Math.round((fila - avatar) / 2) + 2}}>
					<Papel w={avatar} h={avatar} color={[C.mostaza, C.rosa, C.tealClaro, C.naranja][i % 4]} semilla={semilla + 7} mella={2} sombra={SOMBRA_SUAVE} circulo />
				</div>
				<div style={{position: 'absolute', left: img.x + avatar + 10, top: Math.round(fila * 0.16), right: img.x, height: Math.round(fila * 0.68), background: C.papel, display: 'flex', alignItems: 'center', paddingLeft: 10, boxShadow: '0 2px 0 rgba(60,40,20,0.15)'}}>
					<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: tamTitulo, color: C.tinta, whiteSpace: 'nowrap', overflow: 'hidden'}}>{TITULOS[i % TITULOS.length]}</span>
				</div>
				{/* imagen del video */}
				<div style={{position: 'absolute', left: img.x, top: img.y, width: img.w, height: img.h, background: 'rgba(20,25,35,0.28)', overflow: 'hidden', boxShadow: 'inset 0 3px 0 rgba(0,0,0,0.12)'}}>
					<svg width={img.w} height={img.h} viewBox={`0 0 ${img.w} ${img.h}`} style={{position: 'absolute', inset: 0}}>
						<circle cx={img.w * (0.2 + azar(semilla + 5) * 0.2)} cy={img.h * 0.35} r={img.h * 0.16} fill={C.mostaza} opacity={0.9} />
						<path d={`M0 ${img.h} L${img.w * 0.3} ${img.h * 0.45} L${img.w * 0.5} ${img.h * 0.75} L${img.w * 0.72} ${img.h * 0.35} L${img.w} ${img.h} Z`} fill={C.papel} opacity={0.55} />
						{/* personita */}
						<circle cx={img.w * 0.82} cy={img.h * 0.5} r={img.h * 0.11} fill={C.marino} opacity={0.75} />
						<rect x={img.w * 0.82 - img.h * 0.15} y={img.h * 0.63} width={img.h * 0.3} height={img.h * 0.4} rx={img.h * 0.12} fill={C.marino} opacity={0.75} />
					</svg>
					{/* play */}
					<div style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)'}}>
						<Papel w={img.h * 0.48} h={img.h * 0.48} color={ROJO} semilla={semilla + 9} mella={2} sombra={SOMBRA_SUAVE} circulo>
							<svg width={img.h * 0.22} height={img.h * 0.22} viewBox="0 0 30 30">
								<path d="M9 5 L26 15 L9 25 Z" fill={C.papel} />
							</svg>
						</Papel>
					</div>
					{/* duración y vistas */}
					<div style={{position: 'absolute', right: 8, bottom: 12, background: C.tinta, color: C.papel, fontFamily: FAMILIA, fontWeight: 800, fontSize: Math.round(img.h * 0.15), padding: '2px 8px'}}>{DURACIONES[i % DURACIONES.length]}</div>
					<div style={{position: 'absolute', left: 8, bottom: 12, background: 'rgba(255,251,243,0.9)', color: C.tinta, fontFamily: FAMILIA, fontWeight: 800, fontSize: Math.round(img.h * 0.13), padding: '2px 8px'}}>{VISTAS[i % VISTAS.length]} vistas</div>
					{/* barra de progreso */}
					<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, background: 'rgba(255,255,255,0.35)'}}>
						<div style={{width: `${progreso * 100}%`, height: '100%', background: ROJO}} />
					</div>
				</div>
			</div>
		</Papel>
	);
};

/** 1 · Gancho: un celular de papel se llena de videos sin parar. */
const Escena1: React.FC = () => {
	const f = paso(useCurrentFrame());
	const tel = useEntrada(0);
	const t1 = useEntrada(6);
	const t2 = useEntrada(56); // v4: entra cuando la voz dice "y nada cambia"
	const sal = useSalida(DURACIONES_ESCENAS[0]);
	const n = Math.min(9, Math.floor(Math.max(0, f - 10) / 6));
	const colores = [C.naranja, C.teal, C.rosa, C.mostaza, C.tealClaro];
	const contador = Math.min(100, Math.round(interpolate(f, [10, 70], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})));
	return (
		<AbsoluteFill style={{transform: `translateY(${sal.y}px)`, opacity: sal.o}}>
			<En x={540} y={330 - (1 - t1) * 300} giro={-2 + temblor(f, 1)}>
				<Tira texto="¿VES CIENTOS DE VIDEOS" semilla={11} tam={62} />
			</En>
			<En x={540} y={445 - (1 - t1) * 400} giro={1.5 + temblor(f, 2)}>
				<Tira texto="DE PRODUCTIVIDAD…" semilla={12} tam={62} />
			</En>
			<En x={540} y={980 + (1 - tel) * 900} giro={3 + temblor(f, 3)}>
				<Papel w={430} h={760} color={C.marino} semilla={21} mella={4}>
					<div style={{position: 'absolute', left: 30, top: 60, width: 370, height: 620, overflow: 'hidden'}}>
						{Array.from({length: n}, (_, i) => (
							<div key={i} style={{position: 'absolute', left: 10 + (azar(i + 40) - 0.5) * 30, top: 470 - i * 52, transform: `rotate(${(azar(i + 60) - 0.5) * 10}deg)`}}>
								<Miniatura w={340} h={170} color={colores[i % colores.length]} i={i} semilla={30 + i} sombra={SOMBRA_SUAVE} />
							</div>
						))}
					</div>
				</Papel>
			</En>
			<En x={820} y={720} giro={8 + temblor(f, 4, 2)} escala={tel}>
				<Papel w={210} h={110} color={C.naranja} semilla={51} mella={5}>
					<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: 64, color: C.papel}}>{contador}</span>
				</Papel>
			</En>
			<En x={540} y={1490 + (1 - t2) * 500} giro={-2.5 + temblor(f, 5)} escala={0.9 + t2 * 0.1}>
				<Tira texto="…Y NADA CAMBIA?" resalta="NADA" semilla={13} tam={86} />
			</En>
		</AbsoluteFill>
	);
};

/** 2 · Consumir no es aprender: la pila de videos se cae. */
const Escena2: React.FC = () => {
	const f = paso(useCurrentFrame());
	const t1 = useEntrada(4);
	const t2 = useEntrada(26);
	const sal = useSalida(DURACIONES_ESCENAS[1]);
	const colores = [C.naranja, C.teal, C.rosa, C.mostaza, C.tealClaro, C.naranja, C.teal];
	return (
		<AbsoluteFill style={{transform: `translateY(${sal.y}px)`, opacity: sal.o}}>
			{colores.map((c, i) => {
				const cae = spring({frame: f - 2 - i * 4, fps: 30, config: {damping: 11, stiffness: 120}});
				const y = interpolate(cae, [0, 1], [-300, 1290 - i * 72]);
				return (
					<En key={i} x={540 + (azar(i + 70) - 0.5) * 140} y={y} giro={(azar(i + 80) - 0.5) * 20 + temblor(f, i + 10)}>
						<Miniatura w={440} h={240} color={c} i={i + 2} semilla={90 + i} />
					</En>
				);
			})}
			<En x={540} y={420 - (1 - t1) * 400} giro={-1.5 + temblor(f, 6)}>
				<Tira texto="CONSUMIR NO ES" semilla={14} tam={92} />
			</En>
			<En x={540} y={570} giro={2 + temblor(f, 7)} escala={t2}>
				<Tira texto="APRENDER" resalta="APRENDER" semilla={15} tam={120} />
			</En>
		</AbsoluteFill>
	);
};

/** 3 · Información sin acción = cero resultados: la cabeza se llena de contenido y la barra de resultados no se mueve. */
const CABEZA = 'M150 600 L150 470 C60 430 40 330 60 240 C90 100 220 20 340 40 C450 60 510 160 500 260 L540 340 C545 352 538 362 524 363 L500 366 L505 420 C507 446 490 460 465 458 L400 455 L395 600 Z';
const CONTENIDO = ['TIPS', 'LIBROS', 'PODCASTS', 'CURSOS', 'HILOS', 'VIDEOS'];
export const ENTRADA_CONTENIDO = (i: number): number => 8 + i * 4;

const Escena3: React.FC = () => {
	const f = paso(useCurrentFrame());
	const t1 = useEntrada(4);
	const cabeza = useEntrada(0, 12);
	const barra = useEntrada(32);
	const t2 = useEntrada(44); // v4: con la voz "es igual a cero resultados"
	const sal = useSalida(DURACIONES_ESCENAS[2]);
	const dentro = CONTENIDO.filter((_, i) => f >= ENTRADA_CONTENIDO(i) + 8).length;
	const llena = dentro === CONTENIDO.length;
	const hinchada = 1 + dentro * 0.012;
	// La barra "intenta" subir y se cae a 0: nunca pasa de un 8 %.
	const intento = f >= 40 ? Math.max(0, 0.1 * Math.sin((f - 40) / 5)) * Math.exp(-(f - 40) / 22) : 0;
	return (
		<AbsoluteFill style={{transform: `translateY(${sal.y}px)`, opacity: sal.o}}>
			<En x={540} y={330 - (1 - t1) * 300} giro={-2 + temblor(f, 8)}>
				<Tira texto="INFORMACIÓN SIN ACCIÓN" semilla={16} tam={58} />
			</En>
			{/* cabeza de perfil */}
			<En x={540} y={880 + (1 - cabeza) * 900} giro={temblor(f, 9, llena ? 3 : 1)} escala={hinchada}>
				<div style={{position: 'relative', width: 560, height: 600, filter: SOMBRA}}>
					<svg width={560} height={600} viewBox="0 0 560 600" style={{position: 'absolute', inset: 0}}>
						<defs>
							<clipPath id="cabeza">
								<path d={CABEZA} />
							</clipPath>
						</defs>
						<path d={CABEZA} fill={C.teal} />
						<rect width={560} height={600} clipPath="url(#cabeza)" filter="url(#fibra)" opacity={0.35} style={{mixBlendMode: 'multiply'}} />
						<circle cx={430} cy={250} r={14} fill={C.papel} />
						<circle cx={434} cy={252} r={7} fill={C.tinta} />
					</svg>
				</div>
			</En>
			{/* el contenido entra a la cabeza */}
			{CONTENIDO.map((t, i) => {
				const s = spring({frame: f - ENTRADA_CONTENIDO(i), fps: 30, config: {damping: 13, stiffness: 130}});
				const deIzq = i % 2 === 0;
				const x0 = deIzq ? -220 : 1300;
				const y0 = 560 + (i % 3) * 150;
				const x1 = 385 + (i % 3) * 165 + (azar(i + 300) - 0.5) * 16;
				const y1 = 678 + Math.floor(i / 3) * 90 + (azar(i + 310) - 0.5) * 12;
				const x = interpolate(s, [0, 1], [x0, x1]);
				const y = interpolate(s, [0, 1], [y0, y1]) - Math.sin(s * Math.PI) * 120;
				const giro = interpolate(s, [0, 1], [deIzq ? -40 : 40, (azar(i + 320) - 0.5) * 24]) + temblor(f, i + 330, llena ? 4 : 1);
				return (
					<En key={t} x={x} y={y} giro={giro} opacidad={f >= ENTRADA_CONTENIDO(i) ? 1 : 0}>
						<Papel w={158} h={68} color={[C.mostaza, C.rosa, C.papel, C.naranja, C.tealClaro, C.lima][i]} semilla={340 + i} mella={3} sombra={SOMBRA_SUAVE}>
							<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: t.length > 6 ? 25 : 31, color: C.tinta}}>{t}</span>
						</Papel>
					</En>
				);
			})}
			{/* barra de resultados atorada en 0 % */}
			<En x={540} y={1290 + (1 - barra) * 700} giro={-1.5 + temblor(f, 360)}>
				<Papel w={680} h={150} color={C.marino} semilla={361} mella={4}>
					<div style={{display: 'flex', alignItems: 'center', gap: 22}}>
						<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: 34, color: C.papel}}>RESULTADOS</span>
						<div style={{width: 260, height: 44, background: C.papel, position: 'relative', boxShadow: 'inset 0 3px 0 rgba(0,0,0,0.15)'}}>
							<div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${intento * 100}%`, background: C.lima}} />
						</div>
						<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: 48, color: C.lima}}>0%</span>
					</div>
				</Papel>
			</En>
			<En x={540} y={1500 + (1 - t2) * 500} giro={2 + temblor(f, 10)} escala={0.85 + t2 * 0.15}>
				<Tira texto="= CERO RESULTADOS" resalta="CERO" semilla={17} tam={76} />
			</En>
		</AbsoluteFill>
	);
};

/** 4 · Elige una cosa: cinco tarjetas, cuatro salen volando y una se queda. */
const Escena4: React.FC = () => {
	const f = paso(useCurrentFrame());
	const t1 = useEntrada(2);
	const sal = useSalida(DURACIONES_ESCENAS[3]);
	const opciones = ['LEER', 'GYM', 'IDIOMA', 'AHORRAR', 'MADRUGAR'];
	const elegida = 0;
	const vuela = spring({frame: f - 40, fps: 30, config: {damping: 20, stiffness: 90}});
	const crece = spring({frame: f - 52, fps: 30, config: {damping: 10, stiffness: 140}});
	return (
		<AbsoluteFill style={{transform: `translateY(${sal.y}px)`, opacity: sal.o}}>
			<En x={540} y={360 - (1 - t1) * 400} giro={-2 + temblor(f, 11)}>
				<Tira texto="ELIGE UNA COSA" resalta="UNA" semilla={18} tam={88} />
			</En>
			{opciones.map((o, i) => {
				const entra = spring({frame: f - 6 - i * 4, fps: 30, config: {damping: 12, stiffness: 140}});
				const angAbanico = (i - 2) * 12;
				const baseX = 540 + (i - 2) * 120;
				const baseY = 1050 + Math.abs(i - 2) * 40;
				const esElegida = i === elegida;
				const dir = i % 2 === 0 ? -1 : 1;
				const x = esElegida ? interpolate(vuela, [0, 1], [baseX, 540]) : baseX + dir * vuela * 1100;
				const y = esElegida ? interpolate(vuela, [0, 1], [baseY, 1050]) : baseY - vuela * 700;
				const giro = esElegida ? interpolate(vuela, [0, 1], [angAbanico, -3]) : angAbanico + dir * vuela * 80;
				const escala = esElegida ? entra * (1 + crece * 0.35) : entra;
				return (
					<En key={o} x={x} y={y + (1 - entra) * 900} giro={giro + temblor(f, i + 30)} escala={escala}>
						<Papel w={260} h={360} color={esElegida && crece > 0.1 ? C.lima : [C.rosa, C.teal, C.mostaza, C.naranja, C.tealClaro][i]} semilla={160 + i} mella={5}>
							<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: o.length > 6 ? 40 : 52, color: C.tinta, transform: 'rotate(-90deg)', whiteSpace: 'nowrap'}}>{o}</span>
						</Papel>
					</En>
				);
			})}
		</AbsoluteFill>
	);
};

/** 5 · Ponla en práctica hoy: una lista de papel y la palomita se dibuja. */
const Escena5: React.FC = () => {
	const f = paso(useCurrentFrame());
	const hoja = useEntrada(0);
	const t1 = useEntrada(4);
	const t2 = useEntrada(46);
	const sal = useSalida(DURACIONES_ESCENAS[4]);
	const trazo = interpolate(f, [22, 40], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
	return (
		<AbsoluteFill style={{transform: `translateY(${sal.y}px)`, opacity: sal.o}}>
			<En x={540} y={340 - (1 - t1) * 400} giro={-1.5 + temblor(f, 12)}>
				<Tira texto="Y PONLA EN PRÁCTICA" semilla={19} tam={68} />
			</En>
			<En x={540} y={1000 + (1 - hoja) * 900} giro={-4 + temblor(f, 13)}>
				<Papel w={640} h={640} color={C.papel} semilla={180} mella={5}>
					<div style={{position: 'absolute', left: 60, top: 70, display: 'flex', flexDirection: 'column', gap: 46}}>
						{['LEER 10 MIN', 'MAÑANA', 'LUEGO'].map((t, i) => (
							<div key={t} style={{display: 'flex', alignItems: 'center', gap: 34, opacity: i === 0 ? 1 : 0.35}}>
								<div style={{position: 'relative', width: 110, height: 110}}>
									<Papel w={110} h={110} color={i === 0 ? C.lima : C.gris} semilla={190 + i} mella={3} sombra={SOMBRA_SUAVE} />
									{i === 0 && (
										<svg width={150} height={150} viewBox="0 0 150 150" style={{position: 'absolute', left: -10, top: -40, overflow: 'visible'}}>
											<path d="M20 85 L60 125 L140 20" stroke={C.tinta} strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={trazo} />
										</svg>
									)}
								</div>
								<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: 58, color: C.tinta, textDecoration: i === 0 ? 'none' : 'line-through'}}>{t}</span>
							</div>
						))}
					</div>
				</Papel>
			</En>
			<En x={540} y={1500 + (1 - t2) * 500} giro={3 + temblor(f, 14)} escala={0.8 + t2 * 0.2}>
				<Tira texto="HOY" resalta="HOY" semilla={20} tam={150} />
			</En>
		</AbsoluteFill>
	);
};

/** 6 · Cierre: sígueme. */
const Escena6: React.FC = () => {
	const f = paso(useCurrentFrame());
	const t1 = useEntrada(2);
	const t2 = useEntrada(12);
	const t3 = useEntrada(26, 9);
	return (
		<AbsoluteFill>
			<En x={540} y={560 - (1 - t1) * 500} giro={-2 + temblor(f, 15)}>
				<Tira texto="SÍGUEME PARA" semilla={21} tam={96} />
			</En>
			<En x={540} y={720 - (1 - t2) * 700} giro={1.5 + temblor(f, 16)}>
				<Tira texto="APRENDER A APLICARLO" resalta="APLICARLO" semilla={22} tam={62} />
			</En>
			<En x={540} y={1060} giro={-3 + temblor(f, 17, 1.2)} escala={t3}>
				<Papel w={600} h={170} color={C.marino} semilla={230} mella={5}>
					<span style={{fontFamily: FAMILIA, fontWeight: 800, fontSize: 84, color: C.lima}}>@jamesr_cl</span>
				</Papel>
			</En>
			<En x={540} y={1300 + Math.sin(f / 5) * 12} giro={temblor(f, 18, 3)} escala={t3}>
				<svg width={120} height={140} viewBox="0 0 120 140" style={{filter: SOMBRA, transform: 'rotate(180deg)'}}>
					<path d="M60 8 L112 70 L80 70 L80 132 L40 132 L40 70 L8 70 Z" fill={C.naranja} />
				</svg>
			</En>
		</AbsoluteFill>
	);
};

// ───────────────────────── composición ─────────────────────────

const ESCENAS: Array<{desde: number; dur: number; C: React.FC; barrido: string}> = [
	{desde: INICIOS_ESCENAS[0], dur: DURACIONES_ESCENAS[0], C: Escena1, barrido: C.naranja},
	{desde: INICIOS_ESCENAS[1], dur: DURACIONES_ESCENAS[1], C: Escena2, barrido: C.teal},
	{desde: INICIOS_ESCENAS[2], dur: DURACIONES_ESCENAS[2], C: Escena3, barrido: C.mostaza},
	{desde: INICIOS_ESCENAS[3], dur: DURACIONES_ESCENAS[3], C: Escena4, barrido: C.rosa},
	{desde: INICIOS_ESCENAS[4], dur: DURACIONES_ESCENAS[4], C: Escena5, barrido: C.marino},
	{desde: INICIOS_ESCENAS[5], dur: DURACIONES_ESCENAS[5], C: Escena6, barrido: C.naranja},
];

export const PapelCortado: React.FC = () => {
	cargarFuente();
	return (
		<AbsoluteFill style={{background: C.fondo, overflow: 'hidden'}}>
			<Fondo />
			{ESCENAS.map(({desde, dur, C: Escena}, i) => (
				<Sequence key={i} from={desde} durationInFrames={dur}>
					<Escena />
				</Sequence>
			))}
			{ESCENAS.slice(1).map(({desde, barrido}, i) => (
				<Sequence key={`b${i}`} from={desde - 7} durationInFrames={16}>
					<Barrido color={barrido} semilla={700 + i} />
				</Sequence>
			))}
		</AbsoluteFill>
	);
};
