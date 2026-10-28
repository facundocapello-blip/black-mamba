# Black Mamba — rescate del código publicado

Rescate del bundle publicado de **BLACK MAMBA**, analizador de Blackjack.
Este repositorio existe porque el código fuente nunca estuvo en un repositorio: solo
en el deploy. Si el sitio se caía, el proyecto se perdía.

## Procedencia

| Dato | Valor |
|---|---|
| Origen | https://black-mamba.facucape.chatgpt.site/ |
| Fecha de captura | 2026-10-28 |
| Archivo | `index.html` |
| Tamaño | 246.657 bytes |
| SHA-256 | `6D27F6A8C0DB08AA56D10F966C29D4793DF0C4CC383F0C963529FAAF5D5213CD` |
| Versión en pantalla | V1.5.2 |
| Versión en CSS | V1.5.3 (en progreso) |

## Estado del rescate

- Aplicación **monoarchivo**: todo el HTML, CSS, JavaScript e imágenes (sprites en base64)
  viven dentro de `index.html`.
- **Cero dependencias externas**: 0 `src=`, 0 `href=`, 0 `url(http…)`, 0 `@import`,
  0 `iframe`. No hace ninguna petición de red. Funciona sin internet.
- No hay build, ni `package.json`, ni módulos. No hay que instalar nada.

## Limpieza aplicada

El HTML original traía, inyectado por Cloudflare, un script de detección de bots: un
`iframe` oculto de 1×1 que cargaba `/cdn-cgi/challenge-platform/scripts/jsd/main.js`.
No es parte de la aplicación, no funciona fuera del dominio original y generaba un 404
en cada carga. Fue eliminado (commit posterior al tag de captura, que conserva el
archivo tal cual se bajó).

Resultado: `index.html` queda realmente autocontenido.

## Verificación

| Prueba | Resultado |
|---|---|
| Carga desde servidor local | OK, sin errores de consola |
| Peticiones de red | 0 |
| Codificación | UTF-8 correcta (♠ ⚙ × —) |
| Botón "Ejemplo" | Carga mesa: crupier K-10, mano 10-6, 3 jugadores |
| Cálculo | Responde **PLANTARSE — 21,3%** |

## Cómo correrlo

Abrir `index.html` en el navegador, o servirlo en local:

```powershell
npx --yes serve .
```

## Advertencias

- Esto es **código compilado/empaquetado**, no la fuente original. Para mantenerlo hay
  que trabajar sobre el bundle o reescribirlo a partir de él.
- El HTML está minificado: los números de línea no son útiles para depurar.
- No se pudo recuperar la versión **V1.7M** mencionada en el historial del proyecto.
  Si aparece el ZIP original, debe reemplazar este rescate.

## Qué falta

- [ ] Confirmar si la UI corresponde a V1.5.2 o a un estado intermedio hacia V1.5.3.
- [ ] Recuperar (si existe) la V1.7M y comparar.
- [ ] Extraer el JS/CSS del bundle a archivos separados para poder mantenerlo.
- [ ] Probar en Safari de iPhone 15 Pro Max.
