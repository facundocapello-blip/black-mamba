# BLACK MAMBA — reglas para trabajar acá

Leer `README.md` primero. Este repo existe porque el código vivía solo en un deploy.

## Estructura
| Carpeta | Qué es |
|---|---|
| `v1.5.2-publicada/` | Versión estable anterior, funciona. |
| `v1.7m-staging/` | Versión actual: motor V1.6M + capa OCR V1.7M. Es la que se publica. |

## Publicación
GitHub Actions (`.github/workflows/pages.yml`) toma la carpeta indicada en `path`. **Hoy apunta
a `v1.7m-staging`.**

Para volver a la V1.5.2: cambiar esa línea a `v1.5.2-publicada` y pushear. No mover las carpetas
sin actualizar el workflow, o el sitio publica una carpeta vacía.

URL: https://facundocapello-blip.github.io/black-mamba/

## Lo que hay que saber
- El OCR de respaldo usa **Tesseract.js desde CDN**: sin internet, la lectura de cartas no
  funciona (el resto de la app sí).
- El inventario viejo decía que el detector visual y el panel de revisión estaban pendientes.
  No es así: la V1.7M ya los trae integrados.
- El lector `BMV` y la lectura en vivo (`BMLive`, botón «Leer mesa» del modo PC) son para la mesa
  «Blackjack Ilimitado» de Betano. Cargan cartas sólo cuando la lectura es segura; si no, «Dudosa».
  No bajar los umbrales ni quitar la verificación contra el globo para «que lea más».
- Las capturas reales muestran saldo y pestañas personales: **no se suben**. Los recortes de
  `qa/fixtures/ilimitado/` sólo tienen globo y cartas.
- Pendiente real: probar la lectura en vivo jugando, y sumar capturas con 9, 10, 4 y 5.

## Verificación
1. HTTP 200 en la URL.
2. Consola sin errores.
3. El botón "Ejemplo" calcula (PEDIR CARTA 18,6%, motor exacto; antes la simulación daba PLANTARSE 21,3%).
4. `node qa/engine.mjs` pasa (motor exacto contra la simulación).
5. `node qa/vision.mjs` pasa (lector de la mesa «Blackjack Ilimitado» y lectura en vivo).
6. Si se tocó el OCR, probarlo con una captura real.

---

## Skills y plugins recomendados en DeepSeek Harness

Mapa curado para este proyecto. Las skills se cargan con la herramienta `skill`;
los plugins ya están instalados en el perfil de DSH.

**Skills**

- `impeccable` — La UI es todo el producto: tablero, panel móvil, legibilidad del OCR.
- `office` — Reportes de auditoría y documentación de estado.

**Plugins**

- **subagent-claude-code** — Auditorías técnicas y refactors de un solo archivo grande.
- **plugin-dock (Hub)** — Ruteo de pedidos hacia la IA correcta.

**Comandos**

`/arrancar` · `/estado` · `/revisar` · `/cerrar`
