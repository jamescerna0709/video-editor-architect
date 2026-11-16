/**
 * Tiempos de las escenas del reel "PapelCortado" (cuadros a 30 fps). Los comparten la animación
 * (src/papel/PapelCortado.tsx) y el audio (proyectos/2026-11-13-papel-cortado/audio.ts), así nunca se desfasan.
 *
 * v5 (James: "despues de consumir no es aprender, y al mostrar solo el sobre de leer en verde, demora un poco en pasar
 * a lo siguiente"): escena 2 de 90 a 60 cuadros y escena 4 de 105 a 75.
 */
export const FPS_PAPEL = 30;
export const DURACIONES_ESCENAS = [90, 60, 105, 75, 105, 90] as const;
export const INICIOS_ESCENAS: number[] = DURACIONES_ESCENAS.map((_, i) => DURACIONES_ESCENAS.slice(0, i).reduce((a, b) => a + b, 0));
export const DURACION_PAPEL = DURACIONES_ESCENAS.reduce((a, b) => a + b, 0);
