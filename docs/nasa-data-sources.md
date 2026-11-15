# NASA Data Processing — Persona 1

Implementado con asistencia de Codex; selección científica y resultados requieren revisión del equipo.
Se leyó completamente `.context/AGENTS.md` (ruta real del documento solicitado).
Los módulos NASA y sus pruebas estaban vacíos; no había contratos implementados que reemplazar.
Se conserva `RegionData` de la sección 4.3 y el router relativo `/data` de P4.
No se modificaron main.py, router global, dependencias compartidas ni módulos ajenos.

## Fuente seleccionada y verificación

- HiRISE/MRO, University of Arizona: `DTEEC_002387_1985_003798_1985_A01`, versión 1.0.
- Dataset PDS: `MRO-M-HIRISE-5-DTM-V1.0`.
- [Página oficial](https://www.uahirise.org/dtm/PSP_002387_1985).
- [Descarga original PDS IMG](https://www.uahirise.org/PDS/DTM/PSP/ORB_002300_002399/PSP_002387_1985_PSP_003798_1985/DTEEC_002387_1985_003798_1985_A01.IMG).
- [Registro AWS de referencia](https://registry.opendata.aws/nasa-usgs-mars-hirise-dtms/).
- Acceso verificado sin autenticación el 14 de noviembre de 2026. Descargados 320045704 bytes.
- Se eligió el IMG PDS original: no se verificó una URL COG de ese producto en AWS.
  No se depende de Planetary Computer, cuentas, claves ni servicios externos durante la ejecución.
- Raster float32, 11538 filas × 6934 columnas; etiqueta PDS `MISSING_CONSTANT=16#FF7FFFFB#`.
  Rasterio reconoce ese valor como −3.4028226550889045e38. Se aplica también la máscara GDAL y se excluyen NaN/Inf.
- La etiqueta IMAGE NOTE documenta metros sobre la superficie equipotencial **Mars 2000 Datum**,
  Smith et al. (2001), escala vertical 1 y offset 0.
- Cobertura rectangular de la etiqueta: latitud planetocéntrica 18.392143429723–18.588734996352°;
  longitud positiva este 77.34394372–77.466254°. No garantiza datos válidos en todo el rectángulo.
- Proyección equirectangular, paralelo estándar 15°, meridiano central 77.41°,
  esfera local de radio 3394839.8133163 m. El WKT completo se conserva en el sidecar.
- La página indica resolución nominal 1 m/píxel; PDS y Rasterio indican
  **1.0096476466229 m/píxel** en ambos ejes. Se utiliza esta última.
- Atribución: NASA/JPL-Caltech/University of Arizona. El registro AWS declara CC0 para su colección;
  el archivo empleado procede directamente de PDS: conservar la atribución de HiRISE.

## Preparación y reproducción (PowerShell desde backend)

El pyproject.toml compartido está vacío y pertenece a P4. Instalar explícitamente:

```powershell
python -m venv data/.venv
data/.venv/Scripts/python -m pip install numpy rasterio fastapi pytest httpx
```

Validado con Python 3.14, NumPy 2.5.4, Rasterio 1.5.2, FastAPI 0.163.0,
Pytest 9.2.0 y httpx 0.28.1. El equipo recomienda Python 3.11+; no se verificaron aquí todas esas versiones.

Descarga reproducible sin credenciales:

```powershell
$catalog = Get-Content data/sources.json -Raw | ConvertFrom-Json
$source = $catalog.sources.DTEEC_002387_1985_003798_1985_A01
Invoke-WebRequest -Uri $source.download_url -OutFile data/raw/DTEEC_002387_1985_003798_1985_A01.IMG
data/.venv/Scripts/python -m app.nasa_data.processor data/raw/DTEEC_002387_1985_003798_1985_A01.IMG --region-id jezero_fan_256 --source-id DTEEC_002387_1985_003798_1985_A01 --window 3200 5500 256 256
data/.venv/Scripts/python -m pytest tests -q
```

La ventana es `(columna, fila, ancho, alto)` del raster original, sin interpolación,
sin remuestreo y sin reproyección. Los índices de uso interno siguen siendo `(fila, columna)`.
Los identificadores de región son inmutables: si ya existe el resultado, usar un ID nuevo para otro procesamiento.
Además de `jezero_fan_256`, el mismo DTM se preparó como datasets regionales
`jezero_fan_512`, `jezero_fan_1024` y `jezero_fan_2048`; son cuatro tamaños
del mismo sector, no cobertura libre de todo Marte. El ROI de una misión debe
permanecer dentro del dataset regional seleccionado.
Cada tamaño tiene su `elevation.tif` y su `orthoimage.tif` (con sus respectivos
`.json`) en `data/processed/`.

## Mosaico CTX amplio de Jezero

Para ampliar la zona explorable se incorporó el mosaico oficial de investigación
CTX de Jezero publicado por USGS. El DTM tiene 20 m/píxel y la ortoimagen
asociada 5 m/píxel; ambos cubren una extensión mucho mayor que el recorte
HiRISE local. Se conservaron los archivos fuente en `data/raw/` y se generaron
cuatro regiones de 2530 × 2221 celdas sobre la cobertura común:

- `jezero_ctx_northwest_20m`
- `jezero_ctx_northeast_20m`
- `jezero_ctx_southwest_20m`
- `jezero_ctx_southeast_20m`

Fuentes oficiales y productos usados:

- [USGS CTX DTM mosaic, DOI P906QQT8](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-ctx-dtm-mosaic).
- [USGS CTX orthoimage mosaic, DOI P9GV1ND3](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-context-camera-orthorectified-image-mosaic).
- [Índice de archivos GeoTIFF del repositorio USGS/NASA](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/index.html).

Cada región tiene `*_elevation.tif`, `*_elevation.json`,
`*_orthoimage.tif` y `*_orthoimage.json`. La ortoimagen de 5 m se remuestrea
con promedio a la cuadrícula de 20 m del DTM para que el overlay esté alineado;
no participa en la pendiente ni en el cálculo de rutas.

La preparación reproducible se ejecuta desde `backend/`:

```powershell
python -m app.nasa_data.mosaic_processor --data-dir data
```

Los insumos grandes de `data/raw/` no se ignoran; `.gitattributes` los entrega
a Git LFS para que puedan versionarse sin convertirlos en blobs normales de
Git. El backend no descarga datos durante una petición: usa los GeoTIFF
procesados y sus hashes locales.
El IMG fuente está visible para Git y los archivos grandes se gestionan con Git LFS;
los TIFF procesados de esta región están versionados porque la demo y las pruebas HTTP
dependen de ellos. El catálogo y los sidecar JSON también son versionables. Otro checkout
puede descargar y procesar los insumos para reproducirlos.
La API lista únicamente regiones cuyo TIFF y sidecar están presentes.
`ARES_DATA_DIR` permite configurar otra raíz de datos con la misma estructura.

## Entrega a Persona 2

```python
from app.nasa_data.repository import RegionRepository

repo = RegionRepository()
region = repo.get_region('jezero_fan_256')
elevation = region.elevation_m      # ndarray float64 (256, 256), metros
valid = region.valid_mask          # ndarray bool; excluir False del cálculo de rutas
dx, dy = region.pixel_size_x_m, region.pixel_size_y_m
x, y = region.cell_center(0, 0)     # coordenadas métricas de mapa marciano
assert region.map_to_cell(x, y) == (0, 0)
original = region.metadata         # fuente, WKT, ventana, hashes, unidades
```

También disponibles: `get_elevation_grid`, `get_region_metadata`, `get_available_layers`
(métodos y funciones del repositorio), y `load_elevation_data(path, region_id=..., source_ids=...)`
para lectura explícita de un archivo local. La unidad vertical debe estar en la banda o proceder
de una fuente documentada mediante `vertical_units='m'`; nunca se infiere del CRS horizontal.
`get_region` verifica SHA256 y consistencia del raster con su sidecar.

Resultado real comprobado: 65536 celdas válidas; rango −2430.74951171875 a −2422.804443359375 m.
Centro de celda (0,0): (−550.7627912327919, 1095851.8675153868) en metros del CRS original.
La matriz preserva las diferencias verticales originales, sin redondeo adicional.

## Integración para Persona 4

Antes de incluir el router raíz en FastAPI, agregar en el punto de composición de P4:

```python
from app.api.router import register_router
from app.nasa_data.repository import router as nasa_router
register_router(nasa_router)
```

Publica GET `/api/data/regions`, `/api/data/regions/{region_id}` y
`/api/data/regions/{region_id}/layers`. No serializa matrices.
Errores con `detail={code,message,details}`: 404 región desconocida, 503 TIFF ausente,
409 datos inválidos. `create_router(repo)` permite inyección y pruebas aisladas.

## Validación y límites pendientes

### Evidencia de validación local — 2026-11-14

Persona 1 ejecutó las pruebas en su equipo: **15 passed, 5 warnings in 1.53s**.
Los avisos corresponden a deprecaciones de Starlette/httpx y Affine. Se resolvió
el bloqueo de permisos de la carpeta temporal de pytest utilizando una carpeta
nueva dentro del repositorio y desactivando su caché. Desde `backend`:

```powershell
New-Item -ItemType Directory -Path tmp -Force | Out-Null
$nasaTestTemp = Join-Path (Get-Location) ('tmp/pytest-nasa-' + [guid]::NewGuid().ToString('N'))
data/.venv/Scripts/python -m pytest tests/test_nasa_data.py -v -p no:cacheprovider --basetemp "$nasaTestTemp"
```

Persona 1 también confirmó la lectura del DTM real mediante `RegionRepository`:

```text
Dimensiones: (256, 256)
Celdas válidas: 65536
Resolución: 1.0096476466229 1.0096476466229
Rango: -2430.74951171875 -2422.804443359375
```

Se instaló Uvicorn 0.54.0 en el entorno local y se comprobó por HTTP una aplicación
temporal en `127.0.0.1:8001`, sin modificar `main.py` ni el router global.
Para reproducir esta comprobación desde `backend`:

```powershell
data/.venv/Scripts/python -m pip install uvicorn
data/.venv/Scripts/python -c "from fastapi import FastAPI; from app.nasa_data.repository import router; import uvicorn; app = FastAPI(); app.include_router(router, prefix='/api'); uvicorn.run(app, host='127.0.0.1', port=8001)"
```

Abrir `http://127.0.0.1:8001/docs`; detener con `Ctrl+C` al finalizar.

| Consulta HTTP | Resultado comprobado |
|---|---|
| `GET /docs` | 200 |
| `GET /api/data/regions` | 200 |
| `GET /api/data/regions/jezero_fan_256` | 200; shape `[256, 256]` |
| `GET /api/data/regions/jezero_fan_256/layers` | 200; capa elevation, unidades m y fuente HiRISE seleccionada |
| `GET /api/data/regions/no_existe` | 404 |

Esta evidencia valida el módulo aislado. La integración en la aplicación principal
y la validación cartográfica con ortoimagen siguen pendientes. La selección del
DTM se registró en la sección 12 de [AGENTS.md](../.context/AGENTS.md).

### Cobertura de pruebas y límites científicos

15 pruebas offline pasan: carga, dimensiones, máscara NoData/NaN, unidades,
resolución anisótropa, centros/inversa, ventanas inválidas, falta de archivo/CRS,
CRS geográfico o terrestre, cobertura vacía, persistencia, integridad, metadata y endpoints.
Se ejecutó la suite completa disponible; los demás archivos de tests estaban vacíos.
También se procesó y recargó el recorte NASA real desde disco.
Hay avisos de deprecación de Starlette/httpx y Affine; no fallos.

La resolución es distancia en el plano de proyección: equirectangular no es una proyección
equidistante en todas las direcciones. Alrededor de 18.49° la escala este/oeste difiere
aproximadamente un 1.8% respecto de la distancia sobre la esfera al usar paralelo 15°.
Las pendientes que use P2 con dx/dy serán pendientes en ese plano; para mayor precisión
se requiere tratamiento geodésico marciano explícito. No se hizo ninguna conversión terrestre.
No se soportan CRS en grados, unidades no métricas, grids rotados ni rasters multibanda.
No se rellenan huecos ni se detectan automáticamente errores fotogramétricos finitos.
Resolución nominal no equivale a exactitud vertical ni garantiza detectar obstáculos pequeños.

Pendiente de P4: registrar router y acordar dependencias compartidas.
Pendiente del equipo: validar alineación con ortoimagen y puntos de control,
seleccionar destino científico y ejecutar integración P1→P2→P3→P4.
La incorporación de la ortoimagen asociada se documenta a continuación; no se usa para calcular pendientes o rutas.
No es una herramienta operacional de navegación EVA.

## Mejora: ortoimagen RED asociada a la región

Se descargó `PSP_002387_1985_RED_C_01_ORTHO.JP2` (30941086 bytes) y su etiqueta
PDS `.LBL` desde el mismo directorio oficial que el DTM. La página del DTM enlaza
ambos productos. La etiqueta identifica explícitamente el DTM como `SOURCE_PRODUCT_ID`.
Es una imagen monocromática del filtro RED, no una imagen RGB ni un raster de elevación.
Las URLs exactas están registradas en `backend/data/sources.json`.

### Discrepancia de georreferenciación y criterio aplicado

El JP2 incrusta una representación del CRS diferente de su etiqueta PDS: declara
`latitude_of_origin=15` y `standard_parallel_1=0`, mientras el DTM y las etiquetas
PDS documentan paralelo estándar 15° y meridiano central 77.41°. Además, el origen
incrustado difiere del interpretado por GDAL para el IMG original en +1.51447147 m
en X y −1.51447147 m en Y (1.5 píxeles).

Por ello no se reproyectó usando ciegamente el CRS incrustado. `process_orthoimage`
valida que la etiqueta PDS tenga la misma asociación de producto, radios, proyección,
escala, dimensiones y offsets de cuadrícula que el DTM. Interpreta las esquinas
de píxel con la misma convención que GDAL usa para el IMG original:
`x_origin=-(SAMPLE_PROJECTION_OFFSET+0.5)*MAP_SCALE` y
`y_origin=(LINE_PROJECTION_OFFSET+0.5)*MAP_SCALE`.
Con ese criterio ambos productos describen la misma cuadrícula PDS y se extrae
la misma ventana entera. El TIFF óptico recibe el CRS y la transformación del DTM;
la georreferenciación original del JP2 queda preservada en el sidecar para auditoría.
Esta es una corrección explícita de metadatos bajo el marco PDS compartido,
sin interpolar ni cambiar los valores de los píxeles de la imagen o del DTM.

### Resultados y alcance de la verificación

- TIFF óptico: `data/processed/jezero_fan_256_orthoimage.tif`, 256 × 256,
  una banda uint8 en DN. Misma extensión, resolución, transformación y CRS que el DTM.
- PDS declara DN 0 como NULL y 1/255 como saturados; se excluyen con máscara interna.
- El sidecar registra hashes de JP2, etiqueta, TIFF y DTM, radiometría
  `I/F = DN * 0.0002616083304924 + 0.0598125686258066`, y tres verificaciones
  numéricas de cuadrícula: esquina superior izquierda, centro y esquina inferior derecha.
- Esas tres comprobaciones son controles de coordenadas derivados de metadatos,
  no puntos de control geodésicos independientes. No miden el error de registro fotogramétrico.
- La API agrega `orthoimage` a `/layers` solo si existen TIFF y sidecar y pasan
  las verificaciones de integridad y cuadrícula. `used_for_routing=false`.
- El DTM conserva su hash; no se modificó la matriz de elevaciones.
- Se ejecutaron **19 pruebas aprobadas** sobre `tests`: las 15 anteriores y
  cuatro casos para registro óptico, máscaras/saturación, capas y rechazo de
  discrepancias de proyección, offsets o identificador de producto.

### Reproducir la preparación óptica

Desde `backend`, después de preparar el DTM:

```powershell
$catalog = Get-Content data/sources.json -Raw | ConvertFrom-Json
$source = $catalog.sources.PSP_002387_1985_RED_C_01_ORTHO
Invoke-WebRequest -Uri $source.download_url -OutFile data/raw/PSP_002387_1985_RED_C_01_ORTHO.JP2
Invoke-WebRequest -Uri $source.label_url -OutFile data/raw/PSP_002387_1985_RED_C_01_ORTHO.LBL
@'
from app.nasa_data.processor import process_orthoimage, create_alignment_preview
sid = 'PSP_002387_1985_RED_C_01_ORTHO'
print(process_orthoimage('data/raw/' + sid + '.JP2', 'data/raw/' + sid + '.LBL',
                         'jezero_fan_256', sid))
print(create_alignment_preview('jezero_fan_256'))
'@ | data/.venv/Scripts/python -
```

Si ya existen los resultados, no repetir `process_orthoimage`: protege los archivos
existentes. `create_alignment_preview` puede ejecutarse de nuevo por separado.
No se agregaron dependencias nuevas. Los TIFF procesados están versionados para esta región;
los rasters fuente de gran tamaño son visibles y se gestionan con Git LFS. El catálogo y el
sidecar son versionables.

### Inspección visual y trabajo pendiente

`data/processed/jezero_fan_256_alignment_preview.png` muestra tres paneles,
de izquierda a derecha: ortoimagen RED, sombreado calculado del DTM y superposición
50/50. El sombreado utiliza iluminación arbitraria desde el noroeste y estiramiento
de percentiles 2–98 para inspección. No representa una observación óptica medida.
El PNG es un montaje diagnóstico sin georreferenciación y no debe usarse como mapa;
el TIFF óptico sí conserva la georreferenciación.

La inspección visual inicial muestra texturas ópticas y relieve, pero no permite
certificar precisión absoluta o subpíxel. Sigue pendiente que el equipo identifique
rasgos inequívocos compartidos y referencias independientes para revisar el ajuste.
El estado publicado es `PDS grid verified; independent visual review pending`.
P4 deberá decidir cómo servir el TIFF o teselas al frontend; el endpoint `/layers`
publica metadatos y no entrega los bytes de imagen. No se modificó `main.py` ni
el router global y no se incorporaron cálculos de pendientes al módulo de Persona 2.
