# Estilo jamesr-cl-oficial

Perfil vivo del estilo. **Manda sobre el borrador del director y sobre lo que diga `/editar` cuando choquen.** Los valores que lee el código están en `perfil.json` (misma carpeta), sección `motor`.

- **Estado:** en-prueba
- **Versión:** 1
- **De dónde sale:** sus reels publicados en @jamesr_cl (4 reels, ver `fuentes.json`)
- **Reel de referencia:** ninguno todavía

## Reglas vigentes

Mezcla elegida por James: **subtítulos de sus reels de octubre + gancho escrito y tarjetas de palabra clave como en agosto.**

### Ritmo y cortes
- Velocidad: ×1.0. No medida (falta transcribir los reels publicados); se ajusta en la primera prueba.
- Qué se corta: silencios de más de 0.3 s, repeticiones y autocorrecciones.
- Cambios de encuadre: en octubre casi no hay cortes a otra toma (0–6.7 cortes/min, n=4), pero la cara cambia de tamaño entre frases → acercamientos de golpe (punch-in) entre frases.
- Duración: octubre ~17–18 s (n=3), agosto 32 s (n=1).

### Texto en pantalla
- Titular: gancho de 1–3 palabras en los primeros 3 s, arriba (como "Precio invisible" en Db_pDpPtJ6v). Es la mejora principal sobre octubre, que no tiene gancho escrito.
- Subtítulos: MAYÚSCULAS, 1–3 palabras, blancos con borde oscuro, a la altura del pecho (y = 1280 de 1920). **Una** palabra clave resaltada por subtítulo; el color se elige en cada reel (verde lima, azul violeta o cian son los que ya usó), uno solo por reel.
- Tarjetas de palabra clave: frases literales cortas (1–5 palabras), ~12 por minuto, sin emoji. En agosto iban arriba en blanco o con color ("Si lo usas mal" en rojo, "Pierdes oportunidades" en amarillo).
- Prompts dictados: se teclean.

### Stickers, logos y memes
- Zona segura x 135–945, y 220–1600. **Nada tapa boca, nariz ni ojos.**
- Stickers: íconos simples de apoyo (como el ⚠️ de agosto), ~2 por minuto, sin repetir.
- Origen: elementos de internet que Claude considere necesarios, **solo con licencia clara (CC0, OFL o propia)**, registrados en `biblioteca/LICENCIAS.md` y con el sí de James antes de bajar cada archivo.
- Memes: no aparecen en sus reels; solo si hay uno con licencia clara y encaja.

### Sonido
- Fuentes de SFX permitidas: ninguna todavía (falta decidir con `/sfx`).

### Demos de pantalla
- Tema oscuro.

## Lo que NO va
- Capas encima de boca, nariz u ojos.
- Assets sin licencia clara.
- Varios colores de resaltado en el mismo reel.

## Falta herramienta
- **Brillo (glow) en la palabra resaltada**, como el cian neón de De-NzVpMcf7. Los subtítulos (`EstiloSubtitulosEdl`) tienen color y escala de resaltado pero no brillo. Propuesta: agregar `resaltado.brillo_px` al esquema y un `text-shadow` del mismo color en el componente de subtítulos.
- **Objetos reales como recurso** (el vaso de agua en agosto): es de grabación, no de edición; queda como sugerencia al grabar.

## Números de referencia

| Qué | Valor | n | Fuente |
|---|---|---|---|
| Subtítulos y (centro, base 1920) | 1264 / 1295 → 1280 | 4 + 4 eventos, 2 reels | medir.ts en Db_pDpPtJ6v y De-NzVpMcf7 |
| Palabras por subtítulo (octubre) | 1 (p50) | 4 eventos, 1 reel | medir.ts en De-NzVpMcf7; en la hoja de De5CCmGOaPy y De2XGAORTJb se ven 1–3 |
| Palabras por subtítulo (agosto) | 3 (p50) | 4 eventos, 1 reel | medir.ts en Db_pDpPtJ6v |
| MAYÚSCULAS (octubre) | 100 % | 4 eventos, 1 reel | medir.ts en De-NzVpMcf7; se ven igual en los otros 2 de octubre |
| Color de resaltado cian | #2FEFEF | 4 eventos | medir.ts en De-NzVpMcf7 |
| Cortes de plano | 0 / 6.72 / 0 / 0 por min | 4 reels | referencia.ts (ritmo.json) |
| Tarjetas por minuto (agosto) | ~21 | 1 reel | conteo en la hoja de Db_pDpPtJ6v |
| Tarjetas por minuto (octubre) | 0 | 3 reels | hojas |
| Stickers por minuto | ~2 | 1 reel | conteo en la hoja de Db_pDpPtJ6v |
| Velocidad del habla | N/A | 0 | falta transcribir los reels publicados |
| Plays | N/A | 0 | yt-dlp no los trae; con Apify (de pago) sí |
| Likes | 61 (ago) · 6, 6, 4 (oct) | 4 | info.json de yt-dlp; no comparables: el de agosto lleva ~3 meses publicado y los de octubre ~3 semanas |

## Historial de entrenamiento
- 2026-11-12: "mejor aprende de mis reels y si hay algo que podamos mejorar me lo dices"
- 2026-11-12: "sigue con la 2" (seguir con 2 reels medidos y 4 vistos, sin medir los otros 2).
- 2026-11-12: base "Mezcla (Recomendado)"; color de resaltado "Cambiar por reel"; tapar la cara "No, nunca".
- 2026-11-12: stickers y memes: "utiliza elementos que consideres necesarios de internet, navegador u otras fuentes" (siempre con licencia clara).
