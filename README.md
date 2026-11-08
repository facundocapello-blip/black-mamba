# BLACK MAMBA — analizador de Blackjack

Repositorio de rescate y control de versiones de **BLACK MAMBA**, analizador de
Blackjack para iPhone.

Existe porque el código nunca estuvo en un repositorio: vivía en el deploy de
`chatgpt.site` y en ZIPs sueltos. Si el sitio se caía, el proyecto se perdía.

## Publicación

**https://facundocapello-blip.github.io/black-mamba/**

Repo: https://github.com/facundocapello-blip/black-mamba

Se publica con GitHub Actions (`.github/workflows/pages.yml`), que toma la carpeta
indicada en `path`. Hoy apunta a `v1.7m-staging`, que es la **versión estable**.
Para volver a la V1.5.2, cambiar esa línea a `v1.5.2-publicada` y pushear; también
se puede volver al tag `v1.6m-antes-modo-pc-20261107`.

## Versiones

| Carpeta | Versión | Origen | Estado |
|---|---|---|---|
| `v1.5.2-publicada/` | V1.5.2 (con CSS V1.5.3 en progreso) | Deploy público | Archivada (respaldo) |
| `v1.7m-staging/` | V1.7M (motor V1.6M + OCR y modo PC) | `BLACK_MAMBA_V1_7M_ORIGINAL.zip` | **Estable, publicada** |

La carpeta conserva el nombre `staging` por historia del deploy; no es un estado, es
el nombre del directorio. No renombrarla sin actualizar el `path` del workflow.

## Hallazgo importante sobre V1.7M

El inventario del proyecto decía que la integración del detector visual y el panel
de revisión estaba **pendiente**. No es así: la V1.7M ya los tiene integrados y
funcionando. El flujo completo está:

1. Sacar captura en Betano.
2. Elegirla desde Fotos (`input[type=file][accept=image/*]`).
3. Detector local intenta leer las tres cartas.
4. Si el recorte falla, «Ajustar posiciones» permite tocar cada símbolo en la foto.
5. Confirmar las tres cartas a mano antes de calcular.
6. El motor estadístico (el mismo de V1.6) da la recomendación.

## Lo que NO es cierto del todo

La UI dice **«100% local»**. El motor de cálculo y el detector de símbolos sí son
locales, pero el OCR de respaldo **descarga Tesseract.js desde un CDN**:

```
https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js
https://unpkg.com/tesseract.js@5/dist/tesseract.min.js
```

Sin internet, el OCR no funciona (el resto de la app sí). El propio panel lo avisa:
«Cargando motor OCR (requiere Internet)».

## Procedencia

| Versión | Archivo | Bytes | SHA-256 |
|---|---|---|---|
| V1.5.2 | `v1.5.2-publicada/index.html` | 246.562 | `E4C6DD1C4A64D89D8A6E52AC70861150B6523C881F42D136017F9515AFFFDE32` |
| V1.7M | `v1.7m-staging/index.html` | 321.771 | `BFDB9BB20878C9EA3A578A554E449168D76648423CFBF7103623FC34258F69BA` |

- V1.5.2: bajada de https://black-mamba.facucape.chatgpt.site/ el 2026-10-28.
  El tag `v1.5.2-rescatada` conserva el archivo original sin tocar; el commit
  siguiente le quitó un script de detección de bots de Cloudflare que no es parte
  de la aplicación.
- V1.7M: provista por el autor el 2026-10-28. Desde entonces se le agregaron el modo
  PC compacto, el parche de OCR y un favicon vacío; el hash de arriba corresponde a
  esa versión publicada.

## Verificación realizada

| Prueba | V1.5.2 | V1.7M |
|---|---|---|
| Carga local | OK, 0 errores | OK, 0 errores |
| Codificación | UTF-8 correcta | UTF-8 correcta |
| Peticiones de red al abrir | 0 | 0 |
| Botón «Ejemplo» | Carga mesa y calcula (PLANTARSE 21,3%) | PLANTARSE 21,3% |
| Panel OCR | no existe | lee A / K / 10 en la captura de referencia |
| Modo PC (683 × 768) | no existe | sin scroll, carga y corrección (2026-11-07) |

## Cómo correrlo

Cada carpeta es un sitio estático independiente:

```powershell
npx --yes serve v1.7m-staging
```

o abrir el `index.html` directamente en el navegador.

## Pendientes

- [ ] Probar el OCR con más capturas reales de Betano y anotar sus cartas; una sola
      captura no prueba otros encuadres.
- [x] Decidir si V1.7M reemplaza a V1.5.2 en producción: **sí, desde el 2026-11-07**.
- [ ] Separar el bundle en archivos (`css/`, `js/`) para poder mantenerlo.
- [ ] Evaluar empaquetar Tesseract en local y dejar el OCR sin internet.
- [ ] Probar en Safari de iPhone 15 Pro Max.

## Nota

Ambas versiones son **archivos únicos empaquetados**, no la fuente original. Están
minificados: los números de línea no sirven para depurar. Cuando se retome el
desarrollo en serio, conviene extraer el JS y el CSS a archivos separados.
