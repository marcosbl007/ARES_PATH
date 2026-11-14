# Validación — ARES PATH

Este documento registra comprobaciones reproducibles por módulo. Los resultados describen el prototipo y no constituyen validación operacional.

## P3 — Planificación de rutas

Fecha: 14 de noviembre de 2026.

Comando desde `backend/`:

```bash
python -m pytest tests/test_routing.py -q
```

Resultado en el entorno disponible (Python 3.14, NumPy y Pytest): **23 pruebas aprobadas**.

Casos verificados con matrices sintéticas:

- Rejilla libre 3×3: `(0,0) → (2,2)` mide `2 * sqrt(2)` con celdas de 1 m.
- Píxeles anisótropos: la diagonal usa `hypot(delta_col * pixel_x, delta_row * pixel_y)` y no `sqrt(2)` universal.
- Obstáculo central: la ruta se desvía y no atraviesa la celda bloqueada.
- Diagonal con una ortogonal bloqueada: se prohíbe el cruce de esquina.
- Destino encerrado: se lanza `NoPathError` con código `NO_PATH`; no se devuelve `[]`.
- Inicio igual al destino: una celda, distancia, ascenso, descenso, pendiente y coste iguales a cero.
- Métricas: ascenso, descenso y pendiente máxima coinciden con el perfil de elevación de P2 sobre elevaciones conocidas.
- Franja de coste alto: `terrain_aware` se desvía, reduce el coste ponderado y aumenta la distancia respecto a `shortest`.
- Comparador: reporta deltas físicos, `same_path` y advierte que los costes de ambos modos no son directamente comparables.
- Integración P2→P3: `analyze_region` alimenta al planificador y las rutas solo usan celdas transitables.
- Diez rejillas aleatorias 8×8 con semilla fija: el coste de A* coincide con una implementación de referencia de Dijkstra.
- Rejilla libre 100×100: ruta diagonal conocida de `99 * sqrt(2)` m.

En el entorno original de P3 no se recolectó la suite completa porque faltaban `rasterio`, `affine` y el TIFF local. La integración posterior con el DTM real se registra a continuación.

## P1 → P2 → P3 — Comprobación con el DTM real

Fecha: 14 de noviembre de 2026. Desde `backend/`, con el TIFF local `jezero_fan_256_elevation.tif` verificado por P1 y Python 3.11.9, se ejecutaron conjuntamente `tests/test_nasa_data.py`, `tests/test_terrain.py` y `tests/test_routing.py`: **58 pruebas aprobadas**. Los 86 avisos son de deprecación/georreferenciación de dependencias y no hicieron fallar la suite.

Se cargó `RegionData` mediante `RegionRepository().get_region("jezero_fan_256")`, se generó `TerrainData` con `analyze_region(region, {"max_slope_deg": 20.0, "slope_weight": 2.0})` y se llamó a `RoutePlanner().compare(region, terrain, (10, 20), (80, 65))`. Estas son celdas internas de prueba del recorte, no coordenadas geográficas ni puntos recomendados para una misión.

- Las matrices miden 256 × 256; las 65 536 celdas son transitables bajo ese umbral exploratorio.
- Ambas rutas incluyen los extremos pedidos y solo usan celdas marcadas como transitables por P2.
- Las dos rutas tienen 71 celdas y una distancia horizontal de aproximadamente 89.495 m; las secuencias de celdas son distintas.
- Evaluada con **la misma** función ponderada de P2, la ruta `shortest` cuesta 94.075194 y la ruta `terrain_aware` cuesta 92.531768, una reducción de 1.543426 unidades de coste del modelo. El `cost` informado directamente por el modo `shortest` usa pesos unitarios y no se comparó con el del otro modo.
- La pendiente máxima por tramo fue 5.277° para `shortest` y 5.654° para `terrain_aware`. El segundo modo minimiza el coste acumulado definido; no garantiza reducir cada métrica individual ni certifica seguridad.

Esta ejecución completa Gate C para el recorte y los puntos probados. El TIFF sigue excluido de Git; otro checkout debe reconstruirlo según `docs/nasa-data-sources.md`. Aún faltan la integración HTTP y la demo completa de P4.
