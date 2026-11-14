# Metodología de terreno y rutas — ARES PATH

Este módulo estima pendientes y perfiles sobre una cuadrícula de elevación. No interpreta las imágenes RGB como elevación y no declara una ruta operacionalmente segura. La región debe proporcionar elevaciones en metros, una máscara booleana de datos válidos y tamaños de celda horizontales comprobados en metros. Si no se conoce el CRS o sus unidades, no se debe ejecutar el análisis métrico.

## Pendiente

Para cada celda se estiman los gradientes `dz/dx` y `dz/dy` mediante diferencias centrales en el interior y diferencias unilaterales en el borde del raster. Se usan por separado `pixel_size_x_m` para columnas y `pixel_size_y_m` para filas, por lo que se admiten celdas rectangulares. La pendiente es:

`slope_deg = degrees(arctan(hypot(dz_dx, dz_dy)))`

Una pendiente queda sin valor (`NaN`) si su elevación no es válida o si falta cualquier vecino cardinal requerido dentro del raster. Esta regla conserva el límite de NoData y evita convertirlo en una superficie plana. En los bordes exteriores se usa una sola diferencia válida; por ello el método allí es de primer orden. No se rellenan huecos ni se extrapolan mediciones.

## Máscara y coste exploratorio

Una celda se considera transitable por el prototipo cuando tiene elevación y pendiente válidas y `slope_deg <= max_slope_deg`. El umbral es un parámetro ajustable para comparar escenarios; no es un límite médico, de movilidad del traje o de seguridad definido por NASA.

En celdas transitables, el multiplicador adimensional es `1 + slope_weight * (slope_deg / max_slope_deg) ** 2`. Así, el multiplicador es al menos 1 y aumenta con la pendiente hasta el umbral. Las celdas bloqueadas llevan multiplicador `NaN` y deben excluirse de los algoritmos de rutas. El coste resultante no equivale a metros, energía, duración de caminata ni consumo de soporte vital.

## Perfil de elevación

El perfil recibe una secuencia de celdas `[row, col]` dentro del raster, con pasos vecinos en una cuadrícula de ocho direcciones. La distancia horizontal de cada tramo se calcula como `hypot(delta_col * pixel_size_x_m, delta_row * pixel_size_y_m)`. El ascenso y el descenso acumulados suman por separado los cambios positivos y negativos de elevación. La pendiente máxima del perfil se estima con el cambio vertical de cada tramo frente a su distancia horizontal; esta métrica de muestra es distinta del mapa de pendientes centrado en cada celda.

Una ruta de un solo punto tiene distancia, ascenso, descenso y pendiente máxima iguales a cero. Rutas con índices fuera de rango, pasos no vecinos, celdas NoData o repeticiones consecutivas se rechazan con un error claro.

## Alcance de datos

La implementación opera sobre un `RegionData` validado y no crea observaciones de Marte. P1 ya identificó y preparó el DTM real `jezero_fan_256`; otros recortes deben aportar igualmente procedencia, cobertura, datum, proyección, unidad horizontal y resolución verificadas antes de presentar métricas como resultados de una región marciana.

## Interfaz para rutas e integración

`app.terrain.analyze_region(region, config)` recibe el `RegionData` de P1 y un `TerrainConfig` o diccionario con `max_slope_deg` y `slope_weight`. Devuelve `TerrainData` con `slope_deg`, `traversable` y `cost_multiplier` de la misma forma que `region.elevation_m`. P3 usa `traversable` como máscara obligatoria y `cost_multiplier` en el modo `terrain_aware`; el multiplicador es `NaN` donde la celda está bloqueada. La prueba de integración P2→P3 está en `tests/test_routing.py`. P4 puede llamar `get_terrain_statistics(region, config)` para obtener un resumen sin enviar el raster completo.

## Planificación de rutas con A*

`app.routing` consume el `RegionData` de P1 y el `TerrainData` de P2. `find_shortest_path` y `find_terrain_aware_path` devuelven un `RouteResult` con la secuencia `(row, col)`, sus métricas y el número de celdas expandidas. El motor A* no descarga datos ni modifica la topografía.

### Vecindad y función de coste

- Vecindad de ocho direcciones con longitudes físicas `hypot(delta_col * pixel_size_x_m, delta_row * pixel_size_y_m)`.
- Una diagonal solo es válida si las dos celdas ortogonales adyacentes también son transitables; no se atraviesan esquinas bloqueadas.
- Coste de cada tramo: `longitud_m * 0.5 * (multiplicador_actual + multiplicador_vecino)`.
- Heurística euclídea en metros. Es admisible y consistente porque todos los multiplicadores son mayores o iguales que 1.
- La máscara obligatoria es `terrain.traversable`. Las celdas `NoData` o con pendiente no calculable nunca se recorren.

### Modos

- `shortest`: usa la misma máscara base y multiplicador unitario. Su valor de `cost` coincide numéricamente con la distancia horizontal en metros.
- `terrain_aware`: usa la misma máscara base y `terrain.cost_multiplier` de P2, por lo que evita pendientes costosas cuando el desvío compensa. Su `cost` es adimensional.
- Si no existe ruta, se lanza `NoPathError` con código `NO_PATH`; no se devuelve una lista vacía.
- `max_expanded_cells` limita la búsqueda (un millón por defecto en el planificador). Al superarlo se lanza `SearchLimitExceeded` con código `SEARCH_LIMIT`.

### Métricas y comparación

`calculate_route_metrics` reutiliza el perfil de elevación de P2 y calcula `distance_m`, `ascent_m`, `descent_m`, `max_slope_deg`, `cost` y `cell_count` sobre la ruta completa. `max_slope_deg` es la pendiente máxima de los tramos muestreados, distinta del mapa de pendientes por celda.

`compare_routes` devuelve las diferencias `terrain_aware - shortest` de distancia, ascenso, descenso, pendiente máxima y número de celdas, además de `same_path`. Por defecto `cost_comparable` es `False`: los dos modos optimizan funciones distintas. La comparación no genera una recomendación de seguridad.

### Uso desde P4

```python
from app.routing import RoutePlanner
from app.terrain import analyze_region

terrain = analyze_region(region, {"max_slope_deg": 20.0, "slope_weight": 2.0})
planner = RoutePlanner()
shortest = planner.plan(region, terrain, (10, 20), (80, 65), mode="shortest")
terrain_aware = planner.plan(region, terrain, (10, 20), (80, 65), mode="terrain_aware")
comparison = planner.compare(region, terrain, (10, 20), (80, 65))
```

Las coordenadas del ejemplo son ficticias y solo ilustran la interfaz. P4 debe validar región, límites y error `NO_PATH` antes de publicar la respuesta HTTP.

### Pruebas del planificador

`tests/test_routing.py` contiene 23 pruebas deterministas sobre matrices sintéticas: diagonal 3×3 de distancia conocida, píxeles anisótropos, obstáculo central, prohibición de atravesar esquinas, destino encerrado sin ruta, inicio igual al destino, franja de coste alto, comparador, flujo P2→P3, entradas inválidas, límite de expansión, diez rejillas aleatorias con semilla fija comparadas contra Dijkstra y rejilla libre de 100×100. No se usan observaciones NASA ni resultados hardcodeados.

## Comprobación con el recorte real de Jezero

P1 seleccionó `jezero_fan_256`, asociado al producto HiRISE `DTEEC_002387_1985_003798_1985_A01`. Se descargó de nuevo el IMG indicado en `backend/data/sources.json` y se reprodujo el recorte de 256 × 256 celdas. Los SHA256 del IMG y del TIFF reconstruido coincidieron exactamente con los valores del sidecar `jezero_fan_256_elevation.json`. El TIFF es local y está excluido de Git; un nuevo checkout debe reproducirlo según `docs/nasa-data-sources.md`.

Para una celda interior `(row=128, col=128)`, las elevaciones originales en metros son: izquierda `-2425.36181640625`, derecha `-2425.353271484375`, arriba `-2425.40966796875` y abajo `-2425.2978515625`. Con `pixel_size_x_m = pixel_size_y_m = 1.0096476466229`, la demostración del cálculo es:

```text
dz/dx = (z_derecha - z_izquierda) / (2 * pixel_size_x_m) = 0.00423163561247
dz/dy = (z_abajo - z_arriba) / (2 * pixel_size_y_m) = 0.05537397458609
pendiente = degrees(atan(hypot(dz/dx, dz/dy))) = 3.17868046266 grados
```

El resultado manual coincide con `calculate_slope(region)[128, 128]`. En todo el recorte, bajo los parámetros exploratorios predeterminados `max_slope_deg=20` y `slope_weight=2`, hay 65 536 celdas válidas y transitables según **este criterio del prototipo**; la pendiente calculada va de `0.0097966557°` a `17.3470597057°` y la media es `2.8937817499°`. El multiplicador de coste va de `1.0000004799` a `2.5046024022`. Estos números describen únicamente este recorte y esta fórmula; no identifican obstáculos menores que la resolución del DTM ni validan la seguridad de una caminata.

Uso para P3/P4 desde `backend/`, una vez preparado el TIFF local:

```python
from app.nasa_data.repository import RegionRepository
from app.terrain import analyze_region, get_terrain_statistics

region = RegionRepository().get_region("jezero_fan_256")
config = {"max_slope_deg": 20.0, "slope_weight": 2.0}
terrain = analyze_region(region, config)
summary = get_terrain_statistics(region, config)
# P3 consume terrain.traversable y terrain.cost_multiplier junto con
# region.pixel_size_x_m y region.pixel_size_y_m.
```

## Estado de entrega y pendientes

El núcleo de P2 está implementado y probado: pendiente, máscara de transitabilidad, multiplicadores de coste, perfil y estadísticas. La suite de terreno pasó 16 pruebas y la suite conjunta P1+P2 pasó 35 pruebas el 14 de noviembre de 2026. Sobre el recorte real, el mapa completo de pendientes coincidió con el cálculo de referencia de `np.gradient` en todas las celdas válidas (diferencia máxima 0°). Un perfil real de tres celdas `(128,128) → (128,129) → (129,130)` produjo 2.4375050417 m de distancia horizontal, 0.051025390625 m de ascenso y 0 m de descenso; es una comprobación del cálculo, no una ruta optimizada.

Queda pendiente ejecutar una ruta sobre el DTM real `jezero_fan_256` y publicar los endpoints HTTP de P3; el entorno actual de pruebas no tiene `rasterio` ni el TIFF local, por lo que la validación de P3 es sintética y la integración P2→P3 usa terreno sintético con la misma estructura de contrato. P3 ya consume `terrain.traversable`, `terrain.cost_multiplier` y los tamaños de píxel de `RegionData`. P4 debe coordinar los modelos HTTP y decidir el registro de los endpoints de rutas y de los tres endpoints de terreno definidos en `AGENTS.md`; todavía no están publicados. La dependencia de ejecución del DTM real sigue siendo el TIFF local reproducible descrito en `docs/nasa-data-sources.md`, excluido de Git.
