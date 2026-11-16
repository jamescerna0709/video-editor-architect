# ESTADO

Estado: /empezar casi listo: instalación ok (13/13), perfil completo y estilo `jamesr-cl-oficial` creado en prueba; falta probarlo en un crudo (paso 5) y resolver fuentes antes del primer render.

## Qué se hizo
- 2026-11-12: idioma español. `creador.json` creado (nombre James, handle jamesr_cl, plataforma instagram).
- 2026-11-12: `.claude/settings.json` → `sandbox.allowUnsandboxedCommands: true` (pedido por James; Windows no tiene sandbox y con `false` no corría ningún comando).
- 2026-11-12: instalador: whisper.cpp b5454 instalado. Doctor: 13 de 13 obligatorios ✔ (avisos: faltan llaves de pago y ctc-forced-aligner, opcionales).
- Fuentes: TikTok Sans e Instrument Sans ok. Inter falló: la instancia Inter-SemiBold.ttf generada en Windows sale con otro sha256 (a9801cb4bc6c…).
- 2026-11-12: estilo desde sus propios reels. El perfil de Instagram no baja con yt-dlp (extractor roto); bajaron 4 reels sueltos a `referencias/propios/data/videos/`. `corpus.ts --muestra` no sirve sin plays (Apify), así que se midió por reel con `referencia.ts` + `medir.ts` (2 de 4 medidos; James pidió seguir así).
- 2026-11-12: estilo `estilo/estilos/jamesr-cl-oficial/` en prueba, registrado en `estilos.json` y puesto como `estilo_activo`. Mezcla: subtítulos de octubre + gancho y tarjetas de agosto.

- 2026-11-13: James pidió un video "desde cero, con animaciones al estilo paper cut". Composición nueva `PapelCortado` (`src/papel/PapelCortado.tsx`, registrada en `src/Root.tsx`): 19.5 s, 6 escenas con el mensaje de su reel De2XGAORTJb, solo formas en código + TikTok Sans (OFL), sin audio. Render: `proyectos/2026-11-13-papel-cortado/salida/final-v1.mp4` (585/585 cuadros).
- Render en Windows: Remotion no puede crear symlinks del `public/` (EPERM) ni bajar su navegador (sin red a storage.googleapis.com). El script `proyectos/2026-11-13-papel-cortado/render-papel.ts` usa un `public/` propio con copia de la fuente y el Chrome instalado. `herramientas/render.ts` tendría el mismo problema.

- 2026-11-13: v2 del papel cortado, por pedido de James ("rehaz la parte de informacion sin accion porque no se entiende… dale más detalle a los objetos. agrega sonidos y una musica de fondo o ritmo"): escena 3 nueva (cabeza que se llena de contenido + barra RESULTADOS en 0 % + "= CERO RESULTADOS"), miniaturas de video detalladas en escenas 1 y 2, y audio sintetizado por código (`proyectos/2026-11-13-papel-cortado/audio.ts`: lo-fi 96 BPM + efectos sincronizados; licencia propia). `salida/final-v2.mp4`: 585 cuadros, −14.8 LUFS, pico −2.2 dBTP.

- 2026-11-13: v3 ("al momento de cmabiar de escena hazlo ligeramente más rápido"): barrido de 20 → 14 cuadros, salida de escena 8 → 6. `salida/final-v3.mp4` (585 cuadros, −14.9 LUFS, −2.0 dBTP). Voz: James eligió grabarla él (Windows no tiene voces en español).

- 2026-11-14: v4 con la voz de James (4 WAV subidos; la toma 4 traía 3 frases y se cortó por silencios). Textos re-sincronizados a la voz ("…Y NADA CAMBIA?" en 56; escena 3: tarjetas cada 4 cuadros, barra en 32, "= CERO RESULTADOS" en 44). Voz: highpass + denoise + compresor, −16 LUFS; música con ducking (sidechain) bajo la voz. `salida/final-v4.mp4`: 585 cuadros, −14.9 LUFS, −2.5 dBTP; la transcripción del audio final sale completa y en su lugar.

- 2026-11-14: v5 ("despues de consumir no es aprender, y al mostrar solo el sobre de leer en verde, demora un poco en pasar a lo siguiente"): escena 2 de 90 → 60 cuadros y escena 4 de 105 → 75. Tiempos de escena en `src/papel/tiempos.ts`, compartidos por la animación y `audio.ts` (efectos en cuadros locales de su escena). Voz recolocada. `salida/final-v5.mp4`: 525 cuadros (17.5 s), −14.8 LUFS, −2.5 dBTP.

## Qué sigue
- Correcciones de James a la v5. Posible: la escena de "HOY" también se queda ~1.7 s quieta después de la voz.
- Arreglar `herramientas/render.ts` para Windows (symlinks de public/ y navegador) antes del primer reel con crudo.
- Paso 5 de /empezar: pedir un crudo y correr `/editar` con `jamesr-cl-oficial`.
- Resolver las fuentes que faltan (Inter, JetBrains Mono, Press Start 2P, Instrument Serif, Anton, Caveat) antes del primer render.
- Elegir fuentes de SFX permitidas (`/sfx`).
- Opcional: medir los reels De5CCmGOaPy y De2XGAORTJb (4–8 min cada uno).

## Decisiones
- Sandbox: comandos sin sandbox permitidos en Windows (decisión de James).
- Estilo: mezcla; color de resaltado por reel; nada tapa la cara; stickers/elementos de internet solo con licencia clara (CC0, OFL o propia) y con su sí antes de bajar cada uno.
