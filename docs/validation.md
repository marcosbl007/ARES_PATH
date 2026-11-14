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

La suite completa del repositorio no se recolectó en este entorno porque `tests/test_nasa_data.py` requiere `rasterio` y una prueba de terreno requiere `affine`; esas dependencias pertenecen a P1/P2 y no se modificaron. La ruta sobre el DTM real `jezero_fan_256` queda pendiente de ejecutar en el entorno que tenga el TIFF local y `rasterio`.
