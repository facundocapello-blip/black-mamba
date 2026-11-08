# ESTADO — BLACK MAMBA

Actualizado: 2026-11-08

## Publicado
- `https://facundocapello-blip.github.io/black-mamba/` — GitHub Actions publica `v1.7m-staging`.
- Publicado: `origin/main` `91bda7d`. Verificado en vivo el 2026-11-08: 200, 311 KB, consola sin errores, etiqueta **V1.7M** sin «STAGING», OCR lee A / K / 10 y «Ejemplo» da PLANTARSE 21,3 %.
- Etiqueta visible: **V1.7M** (estable desde el 2026-11-07; se quitó «STAGING» del tablero y del panel móvil).
- Respaldo de la versión anterior: etiqueta `v1.6m-antes-modo-pc-20261107` (`81cf73f`).
- V1.5.2 queda **archivada** en `v1.5.2-publicada/` (246.562 bytes, hash en README). No se borra ni se toca.

## Abierto
- Probar en vivo el modo PC con Betano al lado (683 × 768) y confirmar que sirve para jugar.
- El OCR ya lee la captura de referencia; falta probarlo con más capturas y encuadres antes de confiar en él.

## OCR (publicado)
- Parche de Gemini aplicado en `v1.7m-staging/index.html`: ventana más grande, recentrado sobre la tinta, lectura de palos rojos y negros, unión de componentes para el «10», PSM 8 y calibración persistente.
- Coordenadas base medidas sobre `USAR ESTA.png` (1366 × 768): A / K / 10. La prueba con la captura real da **3 de 3** en local; contra la URL publicada se verificó a mano con el mismo resultado (2026-11-08).
- Es experimental: una sola captura no prueba otros encuadres. Si cambia la mesa, usar «Ajustar posiciones» o «Restablecer».
- Guardas de aceptación (2026-11-08): margen mínimo sobre la segunda opción y área mínima de tinta relativa al recorte. Una calibración mala ya no precarga valores: queda «Dudosa».
- `$env:BM_OCR_SHOT='<captura>'; node qa/ocr-cards.mjs` — lee A, K y 10 en el orden de la mesa y verifica que el panel móvil no conserve lecturas viejas.

## Modo PC (publicado)
- Vista compacta sin scroll a 683 × 768: casillas TU 1ª / CRUPIER / TU 2ª, grilla A–K, recomendación y % de victoria en vivo.
- Tocar una casilla la vacía para corregir; tocar un valor agrega la carta en el orden 1ª → crupier → 2ª (y luego cartas pedidas).
- Nueva mano conserva el zapato. Los valores agotados se deshabilitan igual que en el tablero.
- Teclado propio del overlay: una tecla de carta carga y repinta la casilla; los atajos globales quedan bloqueados con el overlay abierto.
- Corregir «TU 1ª» con dos cartas conserva el orden (antes las intercambiaba).
- En escritorio el panel móvil ya no se abre solo, así el botón PC queda clickeable.
- Prueba reproducible: `node qa/pc-mode.mjs` (Edge headless, sin dependencias; `--headed` para verlo). Incluye 500 × 700, teclado con repintado, orden al corregir y el botón «Ejemplo» con 21,3 %.
- El modo móvil quedó intacto.

## Trampas
- Para volver a V1.5.2 hay que cambiar el `path` del workflow a `v1.5.2-publicada`: si no, el sitio publica una carpeta vacía. También se puede volver al commit `81cf73f` o a la etiqueta `v1.6m-antes-modo-pc-20261107`.
- El OCR usa Tesseract.js desde CDN: sin internet no lee cartas (el resto sí funciona).
- Las posiciones base del OCR están medidas para 1366 × 768 con el encuadre de `USAR ESTA.png`; con otro encuadre hay que calibrar. La calibración se guarda por tamaño exacto de imagen.
- La detección local sigue prefiriendo no leer antes que inventar: si el valor queda «Dudosa», hay que confirmarlo o cargarlo a mano.
- `origin/main` puede avanzar desde otra máquina: hacer `fetch` antes de mergear.
- `opencode.jsonc` está sin trackear a propósito (config local que enlaza `find-skills`).
- Con la simulación hipotética activa, el modo PC no muestra la carta fantasma: apagala antes de usarlo. El overlay todavía no atrapa el foco del teclado (Tab puede ir al tablero de atrás).

## Verificar
- `powershell -NoProfile -File qa/smoke.ps1` — HTTP 200, título, tamaño y que Tesseract siga referenciado.
- `node qa/pc-mode.mjs` — modo PC sin scroll, carga, corrección, teclado y que «Ejemplo» siga en 21,3 %.
- `$env:BM_OCR_SHOT='<captura>'; node qa/ocr-cards.mjs` — detector de cartas sobre una captura real (sin versionar la imagen).
