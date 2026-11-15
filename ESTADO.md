# ESTADO

Estado: hay dos borradores 3D hechos en código: "Personajes3D" (10 s) y "Finanzas3D" (32 s, educación financiera con personajes 3D y sonido), ambos renderizados en local y sin costo.

## Qué se hizo

- 2026-11-14: composición `Personajes3D` (`src/borradores/Personajes3D.tsx`, registrada en `src/Root.tsx`): escena 3D low-poly con `@remotion/three` (piso, camino, árboles, casita, cubos que giran, cámara que entra y luego orbita) y dos personajes 2D planos dibujados en código (Lumi y Pip) que siempre miran a la cámara, caminan, parpadean y saltan, con globos de diálogo. 1080×1920, 30 fps, 10 s.
- Render: `proyectos/2026-11-14-personajes-3d/salida/borrador-v1.mp4`.
- 2026-11-15: composición `Finanzas3D` (`src/borradores/FinanzasTresD.tsx` + modelos en `src/borradores/finanzas/modelos.tsx`): cerdito 3D, monstruo "Inflación", frasco, banco, torre de monedas, flecha y calendario, todo con primitivas de three.js. Historia: $50 diarios → $18,250 en un año → con 5% de inflación vale como $17,381 → cuenta al 10% anual: $20,075 → 5 años: $29,392. Cierra con "Cifras de ejemplo. No es asesoría financiera." 1080×1920, 30 fps, 32 s.
- Sonidos y música sintetizados en código: `npx tsx herramientas/borradores/sonidos-finanzas.ts` → `proyectos/2026-11-15-finanzas-3d/sonidos/` (hay que correrlo antes de renderizar en una máquina nueva).
- Render: `proyectos/2026-11-15-finanzas-3d/salida/borrador-v1.mp4`.

## Qué sigue

- Que el creador revise el borrador y diga qué cambiar (personajes, escena, textos, duración, ritmo).
- Que el creador revise `Finanzas3D` (personajes, ritmo, textos, sonidos, si quiere voz en off con su propia voz).
- El estilo de las cuentas de referencia (eresunanimal, loconstruiste) no se ha visto: el borrador se basa en una descripción general. Para aprenderlo de verdad hay que entrenar un estilo con sus reels (`/entrenar-estilo`, puede costar créditos de Apify) o que el creador comparta algunos reels.
- Falta `creador.json` (correr `/empezar`).

## Decisiones

- Idioma: español.
- 3D hecho en código con Remotion (gratis, sin servicios de pago). Sin assets externos: todo se dibuja en código.
- Render en Linux: `--gl=swangle` y el `chrome-headless-shell` de `/opt/pw-browsers` (Remotion no puede bajar el suyo).
- Cifras financieras del reel: de ejemplo, con la cuenta comprobada (interés compuesto anual) y aviso en pantalla.
- Sonidos: sintetizados en código (propios, sin licencia de terceros), no salen de `biblioteca/sfx/`.
