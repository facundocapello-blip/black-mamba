# ESTADO — BLACK MAMBA

Actualizado: 2026-11-07

## Publicado
- `https://facundocapello-blip.github.io/black-mamba/` — GitHub Actions publica `v1.7m-staging`; 200 y consola sin errores (verificado 02/11).
- Etiqueta visible: **V1.6M · STAGING** (motor V1.6M + capa OCR V1.7M integrada).
- Publicado: `origin/main` `81cf73f` (docs + smoke test; sin cambios de producto).
- El modo PC **no está publicado**: vive en la rama `modo-pc`.

## Abierto
- Probar en vivo el modo PC con Betano al lado (683 × 768) y decidir si se publica.
- El OCR ya lee la captura de referencia; falta probarlo con más capturas y encuadres antes de confiar en él.
- Decidir si V1.7M pasa a ser la versión estable y V1.5.2 queda archivada.

## OCR (rama `modo-pc`, verificado local)
- Parche de Gemini aplicado en `v1.7m-staging/index.html`: ventana más grande, recentrado sobre la tinta, lectura de palos rojos y negros, unión de componentes para el «10», PSM 8 y calibración persistente.
- Coordenadas base medidas sobre `USAR ESTA.png` (1366 × 768): A / K / 10. La prueba con la captura real da **3 de 3**.
- Es experimental: una sola captura no prueba otros encuadres. Si cambia la mesa, usar «Ajustar posiciones».
- `node qa/ocr-cards.mjs` con `BM_OCR_SHOT=<captura>` — lee A, K y 10 en el orden de la mesa.

## Modo PC (rama `modo-pc`, verificado local)
- Vista compacta sin scroll a 683 × 768: casillas TU 1ª / CRUPIER / TU 2ª, grilla A–K, recomendación y % de victoria en vivo.
- Tocar una casilla la vacía para corregir; tocar un valor agrega la carta en el orden 1ª → crupier → 2ª (y luego cartas pedidas).
- Nueva mano conserva el zapato. Los valores agotados se deshabilitan igual que en el tablero.
- Prueba reproducible: `node qa/pc-mode.mjs` (Edge headless, sin dependencias). Incluye 500 × 700 y el botón «Ejemplo» con 21,3 %.
- El modo móvil quedó intacto.

## Trampas
- Para volver a V1.5.2 hay que cambiar el `path` del workflow: si no, el sitio publica una carpeta vacía.
- El OCR usa Tesseract.js desde CDN: sin internet no lee cartas (el resto sí funciona).
- Las posiciones base del OCR están medidas para 1366 × 768 con el encuadre de `USAR ESTA.png`; con otro encuadre hay que calibrar. La calibración se guarda por tamaño exacto de imagen.
- La detección local sigue prefiriendo no leer antes que inventar: si el valor queda «Dudosa», hay que confirmarlo o cargarlo a mano.
- `origin/main` avanzó desde otra máquina (commits de OCR `4c5e6de`, `f1f5f44`): no asumir que el local es la punta.

## Verificar
- `powershell -NoProfile -File qa/smoke.ps1` — HTTP 200, título, tamaño y que Tesseract siga referenciado.
- `node qa/pc-mode.mjs` — modo PC sin scroll, carga, corrección, teclado y que «Ejemplo» siga en 21,3 %.
- `$env:BM_OCR_SHOT='<captura>'; node qa/ocr-cards.mjs` — detector de cartas sobre una captura real (sin versionar la imagen).
