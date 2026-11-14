# ESTADO

Estado: hay un borrador de 10 s con personajes 2D dentro de una escena 3D (composición "Personajes3D"), renderizado en local y sin costo.

## Qué se hizo

- 2026-11-14: composición `Personajes3D` (`src/borradores/Personajes3D.tsx`, registrada en `src/Root.tsx`): escena 3D low-poly con `@remotion/three` (piso, camino, árboles, casita, cubos que giran, cámara que entra y luego orbita) y dos personajes 2D planos dibujados en código (Lumi y Pip) que siempre miran a la cámara, caminan, parpadean y saltan, con globos de diálogo. 1080×1920, 30 fps, 10 s.
- Render: `proyectos/2026-11-14-personajes-3d/salida/borrador-v1.mp4`.

## Qué sigue

- Que el creador revise el borrador y diga qué cambiar (personajes, escena, textos, duración, ritmo).
- Falta `creador.json` (correr `/empezar`).

## Decisiones

- Idioma: español.
- 3D hecho en código con Remotion (gratis, sin servicios de pago). Sin assets externos: todo se dibuja en código.
- Render en Linux: `--gl=swangle` y el `chrome-headless-shell` de `/opt/pw-browsers` (Remotion no puede bajar el suyo).
