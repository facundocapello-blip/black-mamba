# ESTADO — BLACK MAMBA

Actualizado: 2026-11-05

## Publicado
- `https://facundocapello-blip.github.io/black-mamba/` — GitHub Actions publica `v1.7m-staging`; 200 y consola sin errores (verificado 02/11).
- Etiqueta visible: **V1.6M · STAGING** (motor V1.6M + capa OCR V1.7M integrada).
- Publicado: `origin/main` `81cf73f` (docs + smoke test; sin cambios de producto).
- El modo PC **no está publicado**: vive en la rama `modo-pc`.

## Abierto
- Probar en vivo el modo PC con Betano al lado (683 × 768) y decidir si se publica.
- El OCR automático falla con capturas reales: probado con dos capturas de Betano, una dio 4/4/J (mal) y otra solo 10. No usar como lectura confiable.
- Decidir si V1.7M pasa a ser la versión estable y V1.5.2 queda archivada.

## Modo PC (rama `modo-pc`, verificado local)
- Vista compacta sin scroll a 683 × 768: casillas TU 1ª / CRUPIER / TU 2ª, grilla A–K, recomendación y % de victoria en vivo.
- Tocar una casilla la vacía para corregir; tocar un valor agrega la carta en el orden 1ª → crupier → 2ª (y luego cartas pedidas).
- Nueva mano conserva el zapato. Los valores agotados se deshabilitan igual que en el tablero.
- Prueba reproducible: `node qa/pc-mode.mjs` (Edge headless, sin dependencias). 32 comprobaciones, incluye 500 × 700 y el botón «Ejemplo» con 21,3 %.
- El modo móvil y el OCR quedaron intactos.

## Trampas
- Para volver a V1.5.2 hay que cambiar el `path` del workflow: si no, el sitio publica una carpeta vacía.
- El OCR usa Tesseract.js desde CDN: sin internet no lee cartas (el resto sí funciona).
- Las posiciones de recorte del OCR son fijas (coordenadas de 1366 × 768): si cambia el encuadre, recortan otra zona.
- `origin/main` avanzó desde otra máquina (commits de OCR `4c5e6de`, `f1f5f44`): no asumir que el local es la punta.

## Verificar
- `powershell -NoProfile -File qa/smoke.ps1` — HTTP 200, título, tamaño y que Tesseract siga referenciado.
- `node qa/pc-mode.mjs` — modo PC sin scroll, carga, corrección, teclado y que «Ejemplo» siga en 21,3 %.
