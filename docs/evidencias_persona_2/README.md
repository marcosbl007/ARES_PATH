# Evidencias de Persona 2 — Terrain

Estas imágenes son láminas generadas a partir de ejecuciones locales y del DTM real preparado por P1. No son capturas directas de una ventana de terminal. Los registros de `pytest` usados para la primera lámina se conservan aquí sin modificar.

| Archivo | Qué demuestra |
|---|---|
| `01_pruebas_persona_2.png` | Las 16 pruebas del módulo P2 pasaron; también resume las 35 pruebas conjuntas P1+P2. |
| `02_mapa_pendientes_jezero.png` | Matriz de pendientes calculada sobre `jezero_fan_256`, con escala en grados, resolución y estadísticas del recorte. |
| `03_formula_pendiente_real.png` | Cálculo reproducible de `dz/dx`, `dz/dy` y pendiente en la celda `(128,128)` usando cuatro elevaciones del DTM. |
| `pruebas_terreno.txt` | Salida completa de `pytest tests/test_terrain.py -v --disable-warnings`. |
| `resultado_pruebas.txt` | Salida de la ejecución conjunta `pytest tests/test_terrain.py tests/test_nasa_data.py -q --disable-warnings`. |

El producto de elevación utilizado por P1 es HiRISE `DTEEC_002387_1985_003798_1985_A01`, no el DEM global MOLA/HRSC discutido antes. El IMG original y el TIFF procesado se comprobaron frente a los SHA256 de `backend/data/processed/jezero_fan_256_elevation.json`. El TIFF es local y está excluido de Git; la descarga y preparación reproducibles están descritas en `docs/nasa-data-sources.md`. La fórmula, parámetros, valores exactos y limitaciones están en `docs/methodology.md`.

Para repetir las pruebas desde `backend/` con el entorno instalado:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_terrain.py -v --disable-warnings
.\.venv\Scripts\python.exe -m pytest tests/test_terrain.py tests/test_nasa_data.py -q --disable-warnings
```

**Alcance:** estas evidencias prueban el módulo interno de P2 y su compatibilidad con `RegionData` de P1. La integración de rutas con P3 y los endpoints HTTP coordinados por P4 siguen pendientes. La máscara de transitabilidad usa un umbral exploratorio; no acredita seguridad de una caminata marciana.
