# ESTADO — BLACK MAMBA

Actualizado: 2026-10-28

## Publicado
- `https://facundocapello-blip.github.io/black-mamba/` — GitHub Actions
  (`.github/workflows/pages.yml`) publica la carpeta `v1.7m-staging`. HTTP 200 verificado.
- Último commit: `b4d3f01` (AGENTS.md).

## Abierto
- Probar el OCR con capturas reales de Betano (hoy solo se probó con el ejemplo).
- Decidir si V1.7M pasa a ser la versión estable y V1.5.2 queda archivada.

## Trampas
- Para volver a V1.5.2 hay que cambiar el `path` del workflow: no mover carpetas sin
  actualizarlo o el sitio publica vacío.
- El OCR usa Tesseract.js desde CDN: sin internet no lee cartas (el resto sí funciona).
