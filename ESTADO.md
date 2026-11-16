# ESTADO

Estado: repo unificado en el fork de James (jamescerna0709/video-editor-architect): su perfil y estilo `jamesr-cl-oficial`, el reel en papel cortado con su voz (v5, listo para subir) y los reels 3D/narrados hechos en la nube (Alcanza, Finanzas); el 3D ya renderiza en su Windows (GPU); falta rehacer aquí las voces/sonidos de los narrados y editar el primer reel con crudo.

## Qué se hizo

### Configuración y estilo (en la compu de James, Windows)
- 2026-11-12: idioma español. `creador.json` creado (nombre James, handle jamesr_cl, plataforma instagram).
- 2026-11-12: `.claude/settings.json` → `sandbox.allowUnsandboxedCommands: true` (pedido por James; Windows no tiene sandbox y con `false` no corría ningún comando). Se queda local, sin versionar.
- 2026-11-12: instalador: whisper.cpp b5454 instalado. Doctor: 13 de 13 obligatorios ✔ (avisos: faltan llaves de pago y ctc-forced-aligner, opcionales).
- Fuentes: TikTok Sans e Instrument Sans ok. Inter falló: la instancia Inter-SemiBold.ttf generada en Windows sale con otro sha256 (a9801cb4bc6c…).
- 2026-11-12: estilo desde sus propios reels. El perfil de Instagram no baja con yt-dlp (extractor roto); bajaron 4 reels sueltos a `referencias/propios/data/videos/`. `corpus.ts --muestra` no sirve sin plays (Apify), así que se midió por reel con `referencia.ts` + `medir.ts` (2 de 4 medidos; James pidió seguir así).
- 2026-11-12: estilo `estilo/estilos/jamesr-cl-oficial/` en prueba, registrado en `estilos.json` y puesto como `estilo_activo`. Mezcla: subtítulos de octubre + gancho y tarjetas de agosto.

### Reel en papel cortado (`PapelCortado`, Windows)
- 2026-11-13: James pidió un video "desde cero, con animaciones al estilo paper cut". Composición `PapelCortado` (`src/papel/PapelCortado.tsx`): 6 escenas con el mensaje de su reel De2XGAORTJb, solo formas en código + TikTok Sans (OFL).
- Render en Windows: Remotion no puede crear symlinks del `public/` (EPERM sin modo desarrollador) ni bajar su navegador. `herramientas/borradores/papel-cortado/render-papel.ts` usa un `public/` propio del proyecto (copia de la fuente) y el Chrome instalado. `herramientas/render.ts` tendría el mismo problema.
- v2 ("rehaz la parte de informacion sin accion porque no se entiende… dale más detalle a los objetos. agrega sonidos y una musica de fondo o ritmo"): escena 3 nueva (cabeza que se llena de contenido + barra RESULTADOS en 0 % + "= CERO RESULTADOS"), miniaturas de video detalladas, audio sintetizado por código (`herramientas/borradores/papel-cortado/audio.ts`: lo-fi 96 BPM + efectos; licencia propia).
- v3 ("al momento de cmabiar de escena hazlo ligeramente más rápido"): barrido de 20 → 14 cuadros, salida de escena 8 → 6.
- 2026-11-14: v4 con la voz de James (4 WAV; la toma 4 traía 3 frases y se cortó por silencios), textos re-sincronizados a la voz, voz con highpass + denoise + compresor a −16 LUFS, música con ducking bajo la voz.
- v5 ("despues de consumir no es aprender, y al mostrar solo el sobre de leer en verde, demora un poco en pasar a lo siguiente"): escena 2 de 90 → 60 cuadros, escena 4 de 105 → 75. Tiempos en `src/papel/tiempos.ts`, compartidos por la animación y `audio.ts`. `proyectos/2026-11-13-papel-cortado/salida/final-v5.mp4`: 525 cuadros (17.5 s), −14.8 LUFS, −2.5 dBTP. James lo va a subir.
- Cómo rehacerlo: `npx tsx herramientas/borradores/papel-cortado/render-papel.ts video N` → `salida/video-vN-mudo.mp4`; `npx tsx herramientas/borradores/papel-cortado/audio.ts N` → `audio/musica-vN.wav` y `sfx-vN.wav`; voz en `voz/voz-vN.wav` (cortes y retrasos por frase en el historial de la sesión del 2026-11-14); mezcla con ffmpeg: música con `sidechaincompress` por la voz, `amix` (pesos 1 / 0.8 / 1.15), `loudnorm=I=-14:TP=-2.5` + `alimiter=0.8`.

### Reels 3D y narrados (sesión en la nube, Linux)
- 2026-11-14: composición `Personajes3D` (`src/borradores/Personajes3D.tsx`): escena 3D low-poly con `@remotion/three` y dos personajes 2D (Lumi y Pip). 1080×1920, 30 fps, 10 s. Render: `proyectos/2026-11-14-personajes-3d/salida/borrador-v1.mp4`.
- 2026-11-15: composición `Finanzas3D` (`src/borradores/FinanzasTresD.tsx` + `finanzas/modelos.tsx`): cerdito 3D, monstruo "Inflación", frasco, banco, torre de monedas. Historia: $50 diarios → $18,250 en un año → con 5% de inflación vale como $17,381 → cuenta al 10% anual: $20,075 → 5 años: $29,392, con aviso "Cifras de ejemplo. No es asesoría financiera." 32 s.
- Sonidos y música sintetizados en código: `npx tsx herramientas/borradores/sonidos-finanzas.ts` → `proyectos/2026-11-15-finanzas-3d/sonidos/` (hay que correrlo antes de renderizar en una máquina nueva).
- 2026-11-15: 3 reels de referencia (Instagram Dfue1S-ACmN, DfvqL4TgFc9, DfdTW8zBrqQ), medidos con `referencia.ts --estilo finanzas-3d`. Estilo visto: narración de principio a fin, dioramas 3D low-poly, subtítulo de UNA palabra blanco al ~62 % de alto, etiquetas amarillas en mayúsculas, tarjetas blancas con borde negro y encabezado rojo, cámara lenta, 4.6–9.9 cortes/min (n=3 reels, ritmo.json), 78–115 s.
- Composición `FinanzasNarrado` (`src/borradores/FinanzasNarrado.tsx`): tomas, tarjetas, etiquetas y sonidos amarrados a palabras de la narración.
- Voz: `npx tsx herramientas/borradores/voz-finanzas.ts --tts` (Piper `es_MX-ald-medium`, dominio público) o `--audio <grabación>` con la voz del creador; alinea por palabra.
- 2026-11-15: reel de Alcanza (app del creador): `src/borradores/AlcanzaNarrado.tsx`, guion en `alcanza/guion.json`, celular con las pantallas de la app en `alcanza/telefono.tsx`, objetos 3D en `alcanza/props3d.tsx`, cámara de mira fija.
- 2026-11-16: correcciones: español neutro, billetera bifold de cuero, sin bufanda. Render: `proyectos/2026-11-15-alcanza/salida/final-v2.mp4` (95 s).

### Unificación (2026-11-16)
- La carpeta local venía del repo original (Hainrixz) y el fork de James tenía los reels 3D en la rama `claude/great-einstein-8fc4wj`. Se juntaron: `origin` = fork de James, `upstream` = repo original. Identidad de git local: James <jamescerna0709@users.noreply.github.com> (sin su correo real).
- `npm install` agregó three, @react-three/fiber y @remotion/three. `tsc` limpio.
- Fuentes Baloo 2 y Nunito regeneradas en Windows desde google/fonts (commit fijo, sha256 del variable verificado) con fonttools 4.63.0: las 6 instancias salen idénticas a las de `biblioteca/LICENCIAS.md`.
- 3D en Windows: `npx tsx herramientas/borradores/render-windows.ts <Composicion> stills|video … --public <carpeta> --gl angle` (Chrome instalado + GPU, ~3.7 s por cuadro en Personajes3D). El `--public` lleva copias reales (no enlaces) de lo que pide la composición: `biblioteca/fuentes/` siempre (AlcanzaNarrado carga Baloo/Nunito al empezar, aunque se renderice otra composición) y, para los narrados, `p/<proyecto>/voz` y `sonidos`.
- Pruebas (`npx vitest run`): 1408 pasan, 22 fallan en 17 archivos; todas por Windows (rutas con `\`, permisos 666/700, symlinks EPERM) y fallan igual sin `creador.json`. No las causó la unión.

## Qué sigue
- Rehacer en esta compu los videos narrados (Alcanza, Finanzas): sus voces, sonidos y renders están en la sesión de la nube (`proyectos/` no se versiona); aquí hay que correr `voz-finanzas.ts` y `sonidos-finanzas.ts` antes de renderizar.
- Que las pruebas pasen en Windows (rutas y permisos) o marcarlas como solo-POSIX.
- Arreglar `herramientas/render.ts` para Windows (symlinks de public/ y navegador) antes del primer reel con crudo.
- Paso 5 de /empezar: pedir un crudo y correr `/editar` con `jamesr-cl-oficial`.
- Resolver las fuentes que faltan (Inter, JetBrains Mono, Press Start 2P, Instrument Serif, Anton, Caveat; y Baloo 2 + Nunito de los reels 3D: no hay script que las baje, método en `biblioteca/LICENCIAS.md`).
- Que James revise los reels 3D (Alcanza, FinanzasNarrado, Finanzas3D, Personajes3D) y decida logo oficial y voz.
- Elegir fuentes de SFX permitidas (`/sfx`).
- Opcional: la escena de "HOY" del papel cortado se queda ~1.7 s quieta después de la voz; medir los reels De5CCmGOaPy y De2XGAORTJb.

## Decisiones
- Idioma: español.
- Sandbox: comandos sin sandbox permitidos en Windows (decisión de James).
- Estilo: mezcla; color de resaltado por reel; nada tapa la cara; stickers/elementos de internet solo con licencia clara (CC0, OFL o propia) y con su sí antes de bajar cada uno.
- 3D y animaciones hechos en código con Remotion (gratis). Sin assets externos: todo se dibuja en código.
- Sonidos y música: sintetizados en código (propios), no salen de `biblioteca/sfx/`.
- Voz: la del creador cuando la graba; si no, Piper `es_MX-ald` (dominio público). Windows no trae voces en español.
- Render en Linux: `--gl=swangle` y el `chrome-headless-shell` de `/opt/pw-browsers`. Render en Windows: Chrome instalado y `public/` propio por proyecto.
- Cifras financieras: de ejemplo, con la cuenta comprobada y aviso en pantalla.
- Alineación de palabras con `jonatasgrosman/wav2vec2-large-xlsr-53-spanish` (Apache-2.0); el MMS es CC-BY-NC (no comercial) y queda solo como opción `--modelo mms`.
- Piper no es determinista: rehacer `--tts` mueve los tiempos unas décimas; la composición se reacomoda sola.
