# ESTADO — BLACK MAMBA

Actualizado: 2026-11-07

## Publicado
- `https://facundocapello-blip.github.io/black-mamba/` — GitHub Actions publica `v1.7m-staging`.
- Publicado: `origin/main` `e921125` (modo PC + parche OCR + favicon vacío). Verificado en vivo: 200, 311 KB, consola sin errores, OCR lee A / K / 10 y el botón «Ejemplo» da PLANTARSE 21,3 %.
- Etiqueta visible: **V1.6M · STAGING** (motor V1.6M + capa OCR V1.7M integrada).
- Respaldo de la versión anterior: etiqueta `v1.6m-antes-modo-pc-20261107` (`81cf73f`).

## Abierto
- Probar en vivo el modo PC con Betano al lado (683 × 768) y confirmar que sirve para jugar.
- El OCR ya lee la captura de referencia; falta probarlo con más capturas y encuadres antes de confiar en él.
- Decidir si V1.7M pasa a ser la versión estable y V1.5.2 queda archivada.

## OCR (publicado)
- Parche de Gemini aplicado en `v1.7m-staging/index.html`: ventana más grande, recentrado sobre la tinta, lectura de palos rojos y negros, unión de componentes para el «10», PSM 8 y calibración persistente.
- Coordenadas base medidas sobre `USAR ESTA.png` (1366 × 768): A / K / 10. La prueba con la captura real da **3 de 3**, también contra la URL publicada.
- Es experimental: una sola captura no prueba otros encuadres. Si cambia la mesa, usar «Ajustar posiciones».
- `$env:BM_OCR_SHOT='<captura>'; node qa/ocr-cards.mjs` — lee A, K y 10 en el orden de la mesa.

## Modo PC (publicado)
- Vista compacta sin scroll a 683 × 768: casillas TU 1ª / CRUPIER / TU 2ª, grilla A–K, recomendación y % de victoria en vivo.
- Tocar una casilla la vacía para corregir; tocar un valor agrega la carta en el orden 1ª → crupier → 2ª (y luego cartas pedidas).
- Nueva mano conserva el zapato. Los valores agotados se deshabilitan igual que en el tablero.
- Prueba reproducible: `node qa/pc-mode.mjs` (Edge headless, sin dependencias). Incluye 500 × 700 y el botón «Ejemplo» con 21,3 %.
- El modo móvil quedó intacto.

## Trampas
- Para volver a V1.5.2 hay que cambiar el `path` del workflow a `v1.5.2-publicada`: si no, el sitio publica una carpeta vacía. También se puede volver al commit `81cf73f` o a la etiqueta `v1.6m-antes-modo-pc-20261107`.
- El OCR usa Tesseract.js desde CDN: sin internet no lee cartas (el resto sí funciona).
- Las posiciones base del OCR están medidas para 1366 × 768 con el encuadre de `USAR ESTA.png`; con otro encuadre hay que calibrar. La calibración se guarda por tamaño exacto de imagen.
- La detección local sigue prefiriendo no leer antes que inventar: si el valor queda «Dudosa», hay que confirmarlo o cargarlo a mano.
- `origin/main` puede avanzar desde otra máquina: hacer `fetch` antes de mergear.
- `opencode.jsonc` está sin trackear a propósito (config local que enlaza `find-skills`).

## Verificar
- `powershell -NoProfile -File qa/smoke.ps1` — HTTP 200, título, tamaño y que Tesseract siga referenciado.
- `node qa/pc-mode.mjs` — modo PC sin scroll, carga, corrección, teclado y que «Ejemplo» siga en 21,3 %.
- `$env:BM_OCR_SHOT='<captura>'; node qa/ocr-cards.mjs` — detector de cartas sobre una captura real (sin versionar la imagen).
