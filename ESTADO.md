# ESTADO — BLACK MAMBA

Actualizado: 2026-11-04

## Publicado
- `https://facundocapello-blip.github.io/black-mamba/` — GitHub Actions publica `v1.7m-staging`; 200 y consola sin errores (verificado 02/11).
- Etiqueta visible: **V1.6M · STAGING** (motor V1.6M + capa OCR V1.7M integrada).
- Publicado: `origin/main` `22a4f21` (docs + smoke test encima de `f1f5f44`; sin cambios de producto).

## Abierto
- Probar el OCR con capturas reales de Betano (hoy solo con el ejemplo).
- Decidir si V1.7M pasa a ser la versión estable y V1.5.2 queda archivada.

## Trampas
- Para volver a V1.5.2 hay que cambiar el `path` del workflow: si no, el sitio publica una carpeta vacía.
- El OCR usa Tesseract.js desde CDN: sin internet no lee cartas (el resto sí funciona).
- `origin/main` avanzó desde otra máquina (commits de OCR `4c5e6de`, `f1f5f44`): no asumir que el local es la punta.

## Verificar
- `powershell -NoProfile -File qa/smoke.ps1` — HTTP 200, título, tamaño y que Tesseract siga referenciado.
