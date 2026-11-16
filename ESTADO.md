# ESTADO

Estado: el reel principal es "AlcanzaNarrado" (~97 s, promo narrada de la app Alcanza del creador, estilo de sus referencias), renderizado en local y sin costo; también están "FinanzasNarrado" y dos borradores 3D anteriores.

## Qué se hizo

- 2026-11-14: composición `Personajes3D` (`src/borradores/Personajes3D.tsx`, registrada en `src/Root.tsx`): escena 3D low-poly con `@remotion/three` (piso, camino, árboles, casita, cubos que giran, cámara que entra y luego orbita) y dos personajes 2D planos dibujados en código (Lumi y Pip) que siempre miran a la cámara, caminan, parpadean y saltan, con globos de diálogo. 1080×1920, 30 fps, 10 s.
- Render: `proyectos/2026-11-14-personajes-3d/salida/borrador-v1.mp4`.
- 2026-11-15: composición `Finanzas3D` (`src/borradores/FinanzasTresD.tsx` + modelos en `src/borradores/finanzas/modelos.tsx`): cerdito 3D, monstruo "Inflación", frasco, banco, torre de monedas, flecha y calendario, todo con primitivas de three.js. Historia: $50 diarios → $18,250 en un año → con 5% de inflación vale como $17,381 → cuenta al 10% anual: $20,075 → 5 años: $29,392. Cierra con "Cifras de ejemplo. No es asesoría financiera." 1080×1920, 30 fps, 32 s.
- Sonidos y música sintetizados en código: `npx tsx herramientas/borradores/sonidos-finanzas.ts` → `proyectos/2026-11-15-finanzas-3d/sonidos/` (hay que correrlo antes de renderizar en una máquina nueva).
- Render: `proyectos/2026-11-15-finanzas-3d/salida/borrador-v1.mp4`.
- 2026-11-15: el creador pasó 3 reels de referencia (Instagram Dfue1S-ACmN, DfvqL4TgFc9, DfdTW8zBrqQ), bajados gratis con yt-dlp y medidos con `herramientas/estilo/referencia.ts --estilo finanzas-3d` (en `referencias/`, no se versiona). Estilo visto: narración de principio a fin, dioramas 3D low-poly (barrio mexicano, casas en corte), subtítulo de UNA palabra blanco al ~62 % de alto, etiquetas en mayúsculas amarillas, tarjetas blancas con borde negro y encabezado rojo, cámara lenta, 4.6–9.9 cortes/min (toma mediana 4.4–9.7 s, n=3 reels, fuente ritmo.json), 78–115 s.
- Composición `FinanzasNarrado` (`src/borradores/FinanzasNarrado.tsx`): guion en `src/borradores/finanzas/guion.json`, escenarios 3D en `finanzas/escenarios.tsx`, capas 2D en `finanzas/capas.tsx`. Tomas, tarjetas, etiquetas y sonidos se amarran a palabras de la narración, así que se reacomoda si cambia la voz.
- Voz: `npx tsx herramientas/borradores/voz-finanzas.ts --tts` (Piper `es_MX-ald-medium`, dominio público) → `proyectos/2026-11-15-finanzas-3d/voz/narracion.{wav,json}`. Con la voz del creador: `--audio <grabación>` (mismo guion). Después: `npx tsx herramientas/borradores/sonidos-finanzas.ts` (rehace `musica-larga.wav` con las escenas) y renderizar.
- Render: `proyectos/2026-11-15-finanzas-3d/salida/narrado-v1.mp4`; con el audio normalizado a −14 LUFS / −1.5 dBTP (ffmpeg loudnorm): `final-v1.mp4`.
- 2026-11-15: reel de Alcanza (app del creador): guion del creador en `src/borradores/alcanza/guion.json` (español de Perú, casi literal), composición `AlcanzaNarrado` (`src/borradores/AlcanzaNarrado.tsx`), celular con las pantallas de la app en `alcanza/telefono.tsx` (copiadas de su artifact: cómic sobre papel crema, salvia/terracota/miel, Baloo 2 + Nunito, compañero y frasco), objetos 3D en `alcanza/props3d.tsx`. Cámara nueva: mira fija, acercamiento corto y quieta (el creador notó que en el reel anterior la cámara se desviaba).
- Voz: `npx tsx herramientas/borradores/voz-finanzas.ts --tts --guion src/borradores/alcanza/guion.json --salida proyectos/2026-11-15-alcanza/voz` (94.1 s). Música: `npx tsx herramientas/borradores/sonidos-finanzas.ts --musica-para proyectos/2026-11-15-alcanza/voz/narracion.json --secciones B=hormiga,C=alcanza --destino proyectos/2026-11-15-alcanza/sonidos` (copiar ahí también los efectos de `proyectos/2026-11-15-finanzas-3d/sonidos/`).
- Render: `proyectos/2026-11-15-alcanza/salida/narrado-v1.mp4`; con audio normalizado (−14 LUFS / −1.5 dBTP): `final-v1.mp4`.
- 2026-11-16: correcciones del creador: español neutro (sin "caserito" ni regionalismos), billetera rehecha (bifold de cuero), sin bufanda. Render: `proyectos/2026-11-15-alcanza/salida/final-v2.mp4` (95 s).

## Qué sigue

- Que el creador revise el reel de Alcanza. Pendientes que decide él: logo oficial (se armó uno con elementos de la app), si mantiene "yapeaste" en la locución (Yape es marca de terceros; no se muestra su logo ni UI, las notificaciones son genéricas), y grabar la voz con acento peruano (`--audio`).
- Fuentes Baloo 2 y Nunito: los .ttf no se versionan y no hay script que los baje; en otra máquina hay que regenerarlos (fuente y método en `biblioteca/LICENCIAS.md`).
- Que el creador revise el borrador y diga qué cambiar (personajes, escena, textos, duración, ritmo).
- Que el creador revise `FinanzasNarrado` (y si quiere grabar su voz con el guion).
- Que el creador revise `Finanzas3D` (personajes, ritmo, textos, sonidos, si quiere voz en off con su propia voz).
- Si el creador quiere, guardar lo aprendido de las referencias como estilo formal (`/entrenar-estilo`, perfil en `estilo/estilos/`).
- Falta `creador.json` (correr `/empezar`).

## Decisiones

- Idioma: español.
- 3D hecho en código con Remotion (gratis, sin servicios de pago). Sin assets externos: todo se dibuja en código.
- Render en Linux: `--gl=swangle` y el `chrome-headless-shell` de `/opt/pw-browsers` (Remotion no puede bajar el suyo).
- Cifras financieras del reel: de ejemplo, con la cuenta comprobada (interés compuesto anual) y aviso en pantalla.
- Sonidos: sintetizados en código (propios, sin licencia de terceros), no salen de `biblioteca/sfx/`.
- Alineación de palabras con `jonatasgrosman/wav2vec2-large-xlsr-53-spanish` (Apache-2.0); el MMS del repo es CC-BY-NC (no comercial) y queda solo como opción `--modelo mms`.
- Piper no es determinista: rehacer `--tts` mueve los tiempos unas décimas; la composición se reacomoda sola.
