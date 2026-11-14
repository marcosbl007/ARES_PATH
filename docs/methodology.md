# Metodología de terreno — ARES PATH

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

La implementación prepara las operaciones sobre un `RegionData` validado, pero no crea observaciones de Marte ni presupone que el proyecto ya tenga un DTM real. La procedencia, cobertura, datum, proyección, unidad horizontal y resolución deben documentarse junto al raster concreto por el módulo de ingesta antes de presentar métricas como resultados de una región marciana.

## Interfaz para rutas e integración

`app.terrain.analyze_region(region, config)` recibe el `RegionData` de P1 y un `TerrainConfig` o diccionario con `max_slope_deg` y `slope_weight`. Devuelve `TerrainData` con `slope_deg`, `traversable` y `cost_multiplier` de la misma forma que `region.elevation_m`. P3 debe usar `traversable` como máscara obligatoria; el multiplicador es `NaN` donde la celda está bloqueada. La política de coste por paso del planificador debe seguir el contrato de A* de `AGENTS.md` y quedar acordada con P3 antes de integrar rutas. P4 puede llamar `get_terrain_statistics(region, config)` para obtener un resumen sin enviar el raster completo.
