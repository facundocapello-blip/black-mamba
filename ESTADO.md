# ESTADO — BLACK MAMBA

Actualizado: 2026-11-08

## Publicado
- `https://facundocapello-blip.github.io/black-mamba/` — GitHub Actions publica `v1.7m-staging`.
- Publicado: `origin/main` `36bde41`. Verificado en vivo el 2026-11-08: 200, 314 KB, consola sin errores, etiqueta **V1.7M** sin «STAGING», OCR lee A / K / 10, «Ejemplo» da PLANTARSE 21,3 % y el HTML publicado coincide byte a byte con el local (SHA-256 idéntico).
- Etiqueta visible: **V1.7M** (estable desde el 2026-11-07; se quitó «STAGING» del tablero y del panel móvil).
- Respaldo de la versión anterior: etiqueta `v1.6m-antes-modo-pc-20261107` (`81cf73f`).
- V1.5.2 queda **archivada** en `v1.5.2-publicada/` (246.562 bytes, hash en README). No se borra ni se toca.

## En rama, sin publicar (`motor-exacto-v1.8`, 2026-11-11)
- Motor exacto `BJX` dentro de `v1.7m-staging/index.html`: plantarse, pedir y doblar se calculan recorriendo el zapato restante, sin simulación ni ruido, y al instante. Pedir asume la mejor jugada después (antes: estrategia básica fija).
- Dividir: el EV es exacto (2 manos, sin volver a dividir); el % de ganar al dividir sigue saliendo de la simulación.
- La simulación original `BJ` queda como respaldo si el cálculo exacto falla.
- Motivo: con 20.000 simulaciones, 6 de 550 manos iniciales daban una recomendación distinta a la exacta (p. ej. 7+7 contra 8 decía DIVIDIR). Además, sin peek, la simulación doblaba tras dividir sólo cuando el crupier no tenía blackjack (sesgo optimista).
- **Cambia el botón «Ejemplo»**: ahora da PEDIR CARTA 18,6 % (antes PLANTARSE 21,3 %). Diferencia de EV 0,003: sale con la etiqueta «EV PARECIDOS».
- Prueba nueva: `node qa/engine.mjs` (sin navegador). `qa/pc-mode.mjs` actualizado al nuevo ejemplo.
- Modo PC más rápido (mismo día): la jugada sale al instante, sin «UN MOMENTO…» (también al dividir; el % de ganar al dividir se completa después). Fondo por acción: verde plantarse, rojo pedir, amarillo doblar, azul dividir. Guía «Si sale…» con qué hacer según la próxima carta cuando toca pedir.
- Teclado en modo PC: Espacio = nueva mano, Retroceso/Supr = borrar la última carta (pedidas → tu 2ª → crupier → tu 1ª). Espacio ya no activa el botón con foco; Enter sí.
- En el tablero cambió el color del texto de la jugada para coincidir: pedir en rojo, dividir en azul.
- `qa/pc-mode.mjs` suma 13 chequeos para todo esto (683 × 768 y 500 × 700 sin scroll).
- Falta: publicar (mergear a `main`) y verificar en vivo.

## Abierto
- Modo PC: se prepararon ajustes para mantener el foco con Tab y desactivar la simulación al abrir; verificados localmente con `node qa/pc-mode.mjs`.
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
- La simulación hipotética se desactiva al abrir el modo PC: las cartas cargadas allí son reales.

## Verificar
- `powershell -NoProfile -File qa/smoke.ps1` — HTTP 200, título, tamaño, etiqueta V1.7M, botón de modo PC y que Tesseract siga referenciado.
- `node qa/pc-mode.mjs` — modo PC sin scroll, carga, corrección (orden incluido), teclado con repintado y que «Ejemplo» siga en 21,3 %. `--headed` para verlo.
- `$env:BM_OCR_SHOT='<captura>'; node qa/ocr-cards.mjs` — detector de cartas sobre una captura real (sin versionar la imagen) y que el panel móvil no conserve lecturas viejas.
