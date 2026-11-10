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
- Pendiente real: probar el OCR con capturas de Betano de verdad, no con el ejemplo.

## Verificación
1. HTTP 200 en la URL.
2. Consola sin errores.
3. El botón "Ejemplo" calcula (PLANTARSE 21,3%).
4. Si se tocó el OCR, probarlo con una captura real.

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
