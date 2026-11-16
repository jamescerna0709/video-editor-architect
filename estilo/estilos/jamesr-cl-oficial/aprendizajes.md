# Aprendizajes del estilo jamesr-cl-oficial

Lo técnico que se aprendió entrenándolo. Las reglas finales están en `perfil.md`; aquí va **cómo se llegó a ellas** y **cómo se hace cada cosa**.

## Recorrido por versiones

| Versión | Qué cambió | Qué dijo el creador |
|---|---|---|
| 1 (2026-11-12) | Perfil inicial desde 4 reels propios (2 medidos, 4 vistos) | "Mezcla (Recomendado)" |

## Cómo se hace cada cosa
- Bajar reels propios: el perfil de Instagram no se puede leer con yt-dlp (extractor `instagram:user` roto, "Unable to extract data"); los reels sueltos sí bajan sin sesión.
- `corpus.ts` busca lo de yt-dlp en `<carpeta>/data/videos/*.info.json`, no en la raíz de la carpeta: los archivos se movieron a `referencias/propios/data/videos/`.
- `corpus.ts --muestra` necesita plays (solo Apify) y reels con 14 días o más: con yt-dlp solo, falla con código 2. Se usó el camino por reel: `referencia.ts` + `medir.ts`.
- El id de estilo no admite guion bajo en `referencia.ts`: el handle `jamesr_cl` quedó como `jamesr-cl-oficial`.

## Qué no funcionó
- `medir.ts` tarda 4–8 min por reel en Windows (RapidOCR); James paró la medición de los reels 3 y 4. Se siguió con 2 medidos.
- En De-NzVpMcf7, `medir.ts` descartó 27 de 30 eventos (palabra con brillo neón): los números de ese reel valen poco.

## Costos
Lo que se gastó (Apify, Gemini u otros), con la fecha y el sí del creador.

| Fecha | Servicio | Qué | Costo |
|---|---|---|---|
| 2026-11-12 | ninguno | yt-dlp y medición local | 0 |
