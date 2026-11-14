# AGENTS.md — ARES PATH

> **Documento de contexto e implementación para los cinco integrantes y los asistentes de programación.**
> NASA Space Apps Challenge 2026 · Guatemala · Edición 1.0 · 14 de noviembre de 2026.
>
> **Lectura obligatoria antes de crear código, editar interfaces, abrir un PR o integrar un módulo.** Si algo aquí contradice una decisión consensuada posterior, actualizar este archivo en el mismo PR que modifica la decisión.

---

## 0. Instrucciones obligatorias para cualquier agente de IA o integrante

1. Leer este archivo completo, especialmente el contrato de coordenadas, el modelo de datos y los criterios de aceptación del módulo asignado.
2. **No cambiar contratos públicos, nombres de campos, directorios ni convenciones sin acuerdo explícito de integración.** Registrar los cambios en la sección «Registro de decisiones».
3. No afirmar que una ruta es *segura para astronautas*: es un **prototipo científico y educativo de apoyo a la planificación**, no una herramienta operacional validada.
4. No inventar datos NASA, ubicaciones, pendientes, medidas, objetivos geológicos ni resultados experimentales. Datos simulados se permiten **solo en pruebas**, etiquetados `synthetic`, nunca como observaciones reales en la demo.
5. No confundir una imagen de mapa con un DTM/DEM: una imagen PNG/JPG/WMTS no contiene elevación métrica utilizable para calcular pendientes.
6. Priorizar un recorrido vertical completo con datos reales sobre funciones decorativas. El MVP se limita a **una región pequeña y validada**, con origen, destino, dos rutas calculadas, indicadores y procedencia de datos.
7. Aislar dependencias: el motor A* no descarga datos, el analizador de terreno no devuelve respuestas HTTP, y el módulo NASA no decide rutas.
8. Mantener interfaces internas tipadas, pruebas deterministas, errores explícitos, unidades, identificadores de fuente y documentación breve.
9. **La quinta persona debe tener una carga mínima**: endpoints de salud e información y pruebas básicas. No asignarle geoprocesamiento ni integración de módulos.
10. Cualquier asistencia de IA utilizada para generar código, texto, imágenes u otros materiales deberá declararse conforme a la guía 2026. El equipo debe tomar sus decisiones de diseño y verificar todos los resultados generados con IA.
11. Nunca agregar funcionalidades que dependan de credenciales privadas o servicios inestables si existe una opción reproducible con datos ya descargados. No exponer secretos en Git.
12. Al terminar cada tarea: ejecutar las pruebas del módulo, revisar tipos y README, y entregar al responsable de integración un ejemplo de uso real.

## 1. Identidad, problema y alcance

**Nombre:** ARES PATH.

**Nombre expandido de trabajo:** *Adaptive Route Evaluation System for Planetary Astronaut Traverses*.

**Lema de trabajo:** *Explore smarter. Navigate safer. Discover more.* El lema es narrativo; no implica garantía de seguridad.

**Reto oficial elegido:** *Interplanetary Survival Guide: Martian Map* (NASA Space Apps Challenge 2026).

**Enunciado central proporcionado por el equipo:** crear un mapa, herramienta o interfaz para una exploración de superficie marciana, integrando datos de varias misiones científicas de NASA para apoyar la preparación y ejecución de una caminata científica (*Marswalk*). El desafío permite incorporar información óptica, térmica, espectral, topográfica, geofísica, atmosférica, radiológica o química, según cobertura y viabilidad. Considerar tres clases de datos es una **sugerencia**, no una obligación textual absoluta.

**Problema de usuario:** una persona que planifica una excursión científica en Marte necesita conocer el relieve, visualizar puntos de interés y comparar rutas de distinto coste antes de salir desde una posición de partida hacia un objetivo de investigación.

**Solución elegida:** plataforma web de planificación exploratoria, centrada inicialmente en un **recorte de terreno marciano** compatible con un DTM real. Permite escoger origen y destino; calcular una ruta de mínima distancia y otra que penaliza pendientes; visualizar una o más capas científicas; comparar indicadores; mostrar procedencia, supuestos y limitaciones. Incluir **al menos un destino científico documentado** cuando haya evidencia verificable.

**Área piloto:** preferencia por un sector del cráter Jezero, por el material relacionado con Perseverance. **No es una elección irreversible**: si no existe un DTM accesible y compatible con la imagen de la región dentro del plazo, escoger un sector alternativo con datos más completos (por ejemplo un entorno de Mount Sharp/Gale). La decisión se basa en disponibilidad y calidad de datos, nunca solo en atractivo visual.

**Usuario de la demo:** planificador o astronauta ficticio; no afirmar uso por NASA, astronautas reales ni misiones activas.

**Objetivo competitivo:** presentar un flujo funcional, reproducible, comprensible en 30 segundos, con innovación en comparación explicable y uso demostrado de recursos NASA. Las cinco dimensiones de evaluación listadas en la guía aportada son *Impact, Creativity, Validity, Relevance, Presentation*.

### 1.1 Qué SÍ entregaremos en el MVP

- Aplicación pública y una API con documentación OpenAPI.
- Una región bien definida, con base cartográfica y **un DTM de elevaciones reales**, recortado y georreferenciado.
- Selección de origen y destino **dentro del raster válido**.
- Dos rutas: `shortest` y `terrain_aware` mediante A* (o equivalente validado).
- Métricas calculadas: longitud, ascenso/descenso acumulado, pendiente máxima a lo largo del trayecto, valor total de coste según función elegida, número de celdas o puntos.
- Perfil de elevación por ruta y comparación comprensible.
- Al menos una referencia de interés científico ligada a su fuente (si sus coordenadas y escala son verificables).
- Al menos dos capas científicas distintas, priorizando óptica y topográfica; una tercera capa (geológica, rugosidad o espectral) si existe cobertura compatible y tiempo. Debe quedar claro si una capa es solo contextual o entra en el cálculo.
- Proveniencia documental de datasets NASA realmente utilizados, con URLs, instrumento, resolución, licencia/atribución aplicable, proyección, transformaciones y fecha de descarga.
- Pruebas automáticas y documentación de limitaciones.

### 1.2 Fuera del MVP: NO prometer ni implementar inicialmente

- Navegación humana operacional, evaluación médica/biológica, rutas «100 % seguras».
- Predicción meteorológica o radiológica en tiempo real sin datos y modelo justificables.
- Cálculo de oxígeno, consumo real de traje, fatiga, duración EVA, soporte vital o riesgos de movilidad sin parámetros verificados.
- Aprendizaje automático, chatbot, 3D inmersivo, HUD, simulación orbital, optimización multiagente.
- Cobertura completa de Marte; descarga dinámica de terabytes de datos.
- Integración directa entre repositorios/servicios externos y cada endpoint durante la demo (preferir datos locales procesados).

### 1.3 Preguntas que debe responder el producto

1. ¿Qué región real de Marte se está analizando y qué misiones o instrumentos generaron los datos?
2. ¿Cuál es el recorrido más corto de A hasta B dentro del área válida?
3. ¿Cómo cambia el recorrido si se evita terreno muy inclinado?
4. ¿Qué distancia, perfil y pendientes calculadas tiene cada alternativa?
5. ¿Qué objetivo científico se pretende visitar y de dónde sale esa información?
6. ¿Qué conclusiones son válidas con estos datasets y cuáles no?

---

## 2. Referencias del desafío y de NASA

### 2.1 Material base aportado por el equipo

- Reto: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- Guía oficial adjunta en la conversación: `Submit guide.pdf` / *Project Submission Guide 2026*, 16 páginas. **No está incluida automáticamente en el repositorio**; conservar copia de acuerdo con permisos del equipo.
- NASA Mars Trek: https://trek.nasa.gov/mars/
- Documentación de servicios de capas Trek: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- Ejemplo de mapa de itinerario de Curiosity: https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/
- NASA Worldview: https://worldview.earthdata.nasa.gov/
- Galería de imágenes originales Perseverance: https://mars.nasa.gov/mars2020/multimedia/raw-images/
- Planetary Data System: https://pds.nasa.gov/
- USGS Astrogeology: https://www.usgs.gov/centers/astrogeology-science-center
- Brief de propuesta ARES PATH adjunto por el equipo: sugiere explorar productos MOLA/PDS y modelos de terreno HiRISE; como el propio documento aclara, es una propuesta del equipo y no una especificación oficial de NASA. Candidato de catálogo HiRISE DTM: https://registry.opendata.aws/nasa-usgs-mars-hirise-dtms/. Verificar el producto, cobertura, CRS, datum, escala, licencia y metadatos antes de incorporarlo; la referencia no confirma que haya un DTM compatible con la región piloto.

**Nota de uso:** Worldview está orientado primordialmente a observación terrestre; se considera **referencia de diseño de interfaz de capas**, no fuente automática de topografía marciana. La animación de Curiosity constituye un **ejemplo de comunicación de rutas científicas**, no un DTM descargable. Las fotografías de Perseverance son un recurso visual y científico cuya geolocalización exacta se debe comprobar antes de colocarlas como marcadores. Mars Trek ofrece servicios de mosaicos WMTS y otras capas; la presencia de una capa de imagen no garantiza disponibilidad de un archivo DTM o de valores por píxel.

### 2.2 Fuente de verdad y jerarquía

1. Enunciado oficial y recursos específicos publicados en la página del reto (pueden actualizarse).
2. Guía oficial de entrega 2026.
3. Metadatos, documentación y archivos originales NASA/PDS/USGS.
4. Decisiones técnicas registradas en este documento.
5. Prototipos, ejemplos de conversación o sugerencias de IA (no son evidencia científica).

Si dos fuentes discrepan, registrar el desacuerdo; no silenciarlo ni presentar una interpretación como hecho confirmado.

### 2.3 Reglas de entrega que afectan al desarrollo

Según la guía 2026 aportada:

- Proyecto con **nombre**, *high-level project summary*, enlace a demostración y explicación detallada.
- Demostración mediante video de **máximo 30 segundos** o diapositivas de **máximo 7** (según instrucciones del formulario); preparar una alternativa accesible públicamente.
- Idioma inglés obligatorio para los campos de entrega y las diapositivas; video en otro idioma necesita subtítulos en inglés.
- Recursos NASA/espaciales: **identificar explícitamente al menos un dataset NASA utilizado**, con enlace verificable y relación con la solución; es condición de elegibilidad global según la guía.
- Declarar la asistencia de IA en lo que corresponda; atribuir código, imágenes, librerías y recursos externos.
- Público sin claves ni registro obligatorio; permisos de acceso abiertos.
- Confirmar plazo, reglas locales y funcionamiento del formulario en la sede; no asumir que un link guardado equivale a una entrega validada.
- El trabajo original y la ideación corresponden al equipo. Corregir cualquier contenido generado automáticamente antes de enviarlo.

Los integrantes de backend **no deben esperar al cierre para documentar fuentes ni dependencias**: entregar esos metadatos con el código.

---

## 3. Decisiones de stack, estructura y flujo

### 3.1 Stack acordado para el MVP

- **Python 3.11+** (elegir y fijar versión exacta en el entorno del equipo; recomendación 3.11).
- **FastAPI** + Pydantic v2 + Uvicorn para API.
- **NumPy** para matrices; **Rasterio** para GeoTIFF/DTM; **SciPy** opcional para operaciones numéricas. Evitar instalar dependencias pesadas si no se necesitan.
- **Pytest** y `httpx` para pruebas.
- **A*** propio y acotado sobre rejilla, con costes positivos y heurística admisible; no se necesita IA ni un servicio comercial.
- Frontend previsto: React/Next.js con un visualizador geoespacial que acepte la proyección escogida; **el frontend queda fuera de la asignación actual de cinco módulos**, aunque la API se diseña para él.
- Persistencia del MVP: archivos precalculados, JSON metadata y datos locales; sin PostgreSQL obligatorio.

### 3.2 Árbol de carpetas — propiedad por persona

```text
/
├── .CONTEXT/
│   └── AGENTS.md                      # Todos leen; cambios de contrato: P4 coordina
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # P4
│   │   ├── api/
│   │   │   └── router.py              # P4
│   │   ├── nasa_data/                 # P1, exclusivo
│   │   │   ├── __init__.py
│   │   │   ├── loader.py
│   │   │   ├── processor.py
│   │   │   ├── repository.py
│   │   │   └── schemas.py
│   │   ├── terrain/                   # P2, exclusivo
│   │   │   ├── __init__.py
│   │   │   ├── elevation.py
│   │   │   ├── slope.py
│   │   │   ├── traversability.py
│   │   │   ├── analyzer.py
│   │   │   └── schemas.py
│   │   ├── routing/                   # P3, exclusivo
│   │   │   ├── __init__.py
│   │   │   ├── astar.py
│   │   │   ├── cost_function.py
│   │   │   ├── route_planner.py
│   │   │   ├── route_comparator.py
│   │   │   └── schemas.py
│   │   ├── missions/                  # P4, exclusivo
│   │   │   ├── __init__.py
│   │   │   ├── mission_service.py
│   │   │   ├── mission_builder.py
│   │   │   ├── scientific_targets.py
│   │   │   └── schemas.py
│   │   └── system/                    # P5, exclusivo
│   │       ├── __init__.py
│   │       ├── router.py
│   │       └── schemas.py
│   ├── data/
│   │   ├── raw/                       # P1, no archivos enormes en Git
│   │   ├── processed/                 # P1, DTM preparado
│   │   └── sources.json               # P1
│   ├── tests/
│   │   ├── fixtures/                  # P1/P2/P3: muestras pequeñas
│   │   ├── test_nasa_data.py          # P1
│   │   ├── test_terrain.py            # P2
│   │   ├── test_routing.py            # P3
│   │   ├── test_missions.py           # P4
│   │   └── test_system.py             # P5
│   ├── pyproject.toml                 # P4 coordina dependencias
│   └── README.md                      # P4 coordina
├── docs/
│   ├── nasa-data-sources.md           # P1
│   ├── methodology.md                 # P2/P3, P4 integra
│   ├── limitations.md                 # Todos aportan, P4 integra
│   ├── api-contract.md                # P4
│   ├── validation.md                  # P1/P2/P3/P4
│   └── demo-notes.md                  # P4
└── .gitignore
```

**Si el repositorio ya tiene una estructura propia, adaptar las rutas antes de implementar y registrar la decisión; no crear duplicados `backend/backend` o múltiples aplicaciones FastAPI.**

### 3.3 Control de versiones

- `main`: estable y desplegable; `develop` opcional si ya se estableció, no inventar ramas compartidas duplicadas.
- P1 `feature/nasa-data-processing`; P2 `feature/terrain-analysis`; P3 `feature/mars-route-planning`; P4 `feature/mission-planning-api`; P5 `feature/system-health-metadata`.
- Rama propia por persona; PR pequeño con descripción, comandos y evidencias de pruebas.
- **P4 es integrador de contratos y `main.py`**, no dueño exclusivo del proyecto. No editar simultáneamente los archivos centrales.
- No forzar `push --force` sobre ramas ajenas, no subir `.env`, tokens, archivos de varias centenas de MB, mapas de baja trazabilidad ni resultados falsos.
- Mensajes de commit en inglés: `feat(routing): add slope-aware A* planner`, `test(terrain): cover nodata and slope thresholds`.
- Añadir al PR: objetivo, archivos, inputs/outputs, casos probados, dependencias, límites, evidencia (`pytest`) y posibles incompatibilidades.

---

## 4. Contratos técnicos innegociables

**Leer antes de escribir funciones. Son decisiones propuestas para garantizar interoperabilidad; si el equipo adopta otras, actualizar esta sección primero.**

### 4.1 Marco de coordenadas

**Interno de cómputo:** índices de raster `[row, col]` (filas de arriba a abajo, columnas de izquierda a derecha); `row`/`col` son enteros de base cero, no latitud/longitud.

**Externo geográfico:** latitud y longitud planetarias solo cuando el producto fuente y su CRS estén verificados. No asumir EPSG terrestre, WGS84, mismo radio que la Tierra, ni mezclar longitudes `[-180, 180]` con `[0, 360]` sin conversión explícita.

**Visualización:** la respuesta puede entregar `grid_path` para tests y `map_path` en unidades del CRS del raster o coordenadas planetarias transformadas **solo si se conoce el CRS**. Aclarar siempre `coordinate_system`.

- La transformación pixel→coordenada de centro de celda se realiza con la transformación afín: `transform * (col + 0.5, row + 0.5)`.
- Transformación inversa para coordenadas del mapa→pixel con validación de límites.
- Verificar origen de raster, orientación e índices (las imágenes suelen tener origen arriba a la izquierda).
- Los puntos `[row, col]` de entrada se comprueban antes de calcular; valores fuera de rango provocan error claro, no recorte silencioso.
- Prohibido usar grados lat/long como si fueran metros.

### 4.2 Convenciones de magnitud y unidades

- Elevación `float32` o `float64` en **metros** relativos al datum del DTM (documentar cuál).
- Tamaños de celda `pixel_size_x_m`, `pixel_size_y_m` positivos **solo si el raster está en CRS proyectado con unidades métricas**, o se cuenta con conversión geodésica apropiada.
- Distancia calculada en **metros**; presentación opcional en kilómetros.
- Pendiente base en **radianes o razón de elevación/distancia** dentro de algoritmos; representación API en **grados** (`slope_deg`). Registrar toda conversión (`degrees(arctan(gradient))`).
- Sin datos (`NoData`, `NaN`, máscara): **no transitable** por defecto. Nunca reemplazar `NoData` por 0 m.
- No redondear antes de optimizar; redondear solo al presentar.
- Coste interno de A*: **adimensional y no necesariamente equivalente a metros**. Si se quiere valor comparable en metros, definir y documentar la función exacta.

### 4.3 Formato de `RegionData` (P1 → P2/P3/P4)

```python
@dataclass(frozen=True)
class RegionData:
    region_id: str
    elevation_m: np.ndarray       # 2D float, NaN donde no hay datos
    valid_mask: np.ndarray        # 2D bool, True si elevación válida
    transform: object             # rasterio Affine u objeto definido y documentado
    crs_wkt: str                  # CRS exacto del raster
    pixel_size_x_m: float        # positivo solo si está medido correctamente en m
    pixel_size_y_m: float
    source_ids: tuple[str, ...]  # ids presentes en sources.json
```

**Restricciones:** todas las matrices comparten forma `(height, width)`, valores finitos donde `valid_mask=True`, resolución mayor que cero, DTM estático en una proyección compatible con distancia; `region_id` identifica inmutablemente el recorte. Las funciones internas reciben `RegionData`, no rutas de archivo mágicas ni URLs NASA.

### 4.4 Formato de `TerrainData` (P2 → P3/P4)

```python
@dataclass(frozen=True)
class TerrainData:
    slope_deg: np.ndarray        # 2D float, NaN si no disponible
    traversable: np.ndarray      # 2D bool
    cost_multiplier: np.ndarray  # 2D float >= 1 en celdas transitables
    config: dict                 # threshold, alpha, método y versión
```

- `traversable = valid_mask & finite(slope_deg) & (slope_deg <= threshold_deg)` para el criterio local elegido; documentar cómo se calcula la pendiente en bordes.
- Nunca inferir «seguridad» física a partir de un umbral arbitrario: es una restricción **configurable del prototipo**.
- Para la ruta `shortest`, la política de restricciones debe estar declarada: puede usar la misma máscara base que la ruta de terreno para comparación justa. Evitar que una ruta cruce `NoData` solo porque es corta.
- `cost_multiplier = 1 + alpha * f(slope_deg)` para celdas transitables, con `alpha >= 0` y `f >= 0`; documentar f y parámetros.

### 4.5 Contrato de A* (P3)

**Función sugerida:**

```python
def plan_path(
    start: tuple[int, int],
    goal: tuple[int, int],
    traversable: np.ndarray,
    pixel_size_x_m: float,
    pixel_size_y_m: float,
    cost_multiplier: np.ndarray | None = None,
) -> list[tuple[int, int]]:
    ...
```

- Vecindad de **8 direcciones** (4 cardinales + 4 diagonales).
- Paso horizontal en metros: `hypot(delta_col * pixel_size_x_m, delta_row * pixel_size_y_m)`.
- Evitar «corner cutting»: una diagonal es válida solo si las dos celdas ortogonales adyacentes también son transitables.
- Paso con penalización positiva: `step_length_m * average(multiplier[current], multiplier[next])` (o fórmula consensuada y documentada).
- Heurística euclídea en metros, admisible porque multiplicadores `>= 1`. Prohibida una heurística sobredimensionada si se proclama óptimo.
- A* **no** se ejecuta sobre imágenes RGB ni inventa topografía.
- Usar prioridad heap, `g_score`, reconstrucción de camino, conjunto cerrado si es correcto, manejo de `start==goal`, y límite de tamaño/tiempo si procede.
- Si no existe camino, devolver una condición tipada; no `[]` como si fuera una ruta válida.

**Comparación:**

- `shortest`: máscara de transitabilidad base, multiplicador unitario.
- `terrain_aware`: misma máscara base, multiplicador por pendientes y/o umbral más estricto **declarado**.
- Registrar si los modos usan máscaras diferentes; comparar coste entre rutas solo bajo la misma función objetivo, o explicar que son costes de criterios distintos.
- Métricas comparables: longitud física, ascenso/descenso, pendiente máxima, cantidad de celdas. «Más segura» NO es una métrica validada.

### 4.6 Modelo HTTP único (P4 publica; todos consumen)

**Prefijo `/api` y JSON UTF-8.** Convención `snake_case` para campos. Pydantic para entradas y salidas. Todos los endpoints de cálculo validan límites y devuelven errores con `code`, `message`, `details` (sin trazas internas en producción).

**Endpoints del MVP:**

| Ruta | Responsable | Función |
|---|---|---|
| `GET /api/health` | P5 | Proceso disponible (sin prometer integridad de datasets) |
| `GET /api/system/info` | P5 | Nombre, versión, estado de MVP |
| `GET /api/data/regions` | P1 | Listar regiones listas |
| `GET /api/data/regions/{region_id}` | P1 | Extensión, forma, resolución, CRS y fuentes |
| `GET /api/data/regions/{region_id}/layers` | P1 | Capas disponibles, tipo y procedencia |
| `GET /api/terrain/{region_id}/summary` | P2 | Estadísticas topográficas calculadas |
| `POST /api/terrain/elevation-profile` | P2 | Perfil para una polilínea válida |
| `POST /api/terrain/traversability` | P2 | Resumen de parámetros de transitabilidad, sin transferir raster enorme |
| `POST /api/routes/calculate` | P3 | Calcular modo indicado |
| `POST /api/routes/compare` | P3 | Comparar dos modos |
| `GET /api/missions/scientific-targets` | P4 | Objetivos científicos verificados |
| `POST /api/missions/plan` | P4 | **Contrato principal del frontend** |

**Evitar duplicar lógica HTTP:** los módulos P1/P2/P3 proporcionan funciones de servicio y un `router` opcional aprobado por P4; `app/main.py` únicamente compone rutas. Si hace falta reducir alcance, priorizar `GET /regions`, `POST /routes/compare`, `POST /missions/plan`, `GET /health`.

**Solicitud de misión (contrato de MVP, coordenadas internas):**

```json
{
  "region_id": "jezero_demo",
  "coordinate_system": "grid_row_col",
  "start": {"row": 10, "col": 20},
  "destination": {"row": 80, "col": 65},
  "mode": "compare",
  "terrain_config": {"max_slope_deg": 20.0, "slope_weight": 2.0},
  "scientific_target_ids": []
}
```

**Valores 10/20/80/65 y umbrales anteriores son ficticios; solo ilustran el esquema.** No son coordenadas reales de Jezero ni límites de seguridad de NASA. Parámetros deben validarse según reglas definidas y rango admisible.

**Respuesta sugerida:**

```json
{
  "mission_id": "demo-001",
  "region_id": "jezero_demo",
  "coordinate_system": "grid_row_col",
  "routes": [
    {
      "route_id": "shortest",
      "mode": "shortest",
      "grid_path": [{"row": 10, "col": 20}, {"row": 11, "col": 21}],
      "metrics": {
        "distance_m": 0.0,
        "ascent_m": 0.0,
        "descent_m": 0.0,
        "max_slope_deg": 0.0,
        "cost": 0.0
      }
    }
  ],
  "scientific_targets": [],
  "data_sources": ["dtm_dataset_id"],
  "methodology_version": "mvp-1",
  "limitations": ["Research prototype; not operational EVA navigation"]
}
```

**Atención:** todos los números y `grid_path` de ese ejemplo son **placeholders de esquema**, no una respuesta coherente generada por un algoritmo. Los tests deben exigir que métricas reales sean calculadas a partir de la ruta completa y del raster válido. Para la demo real, `routes` debe incluir las dos alternativas, salvo caso sin ruta (error explícito/parcialidad documentada).

**Errores HTTP:** 400 entrada inválida; 404 región/objetivo inexistente; 409 región sin datasets compatibles; 422 coordenadas o parámetros inválidos; 503 DTM no cargado; 422 o 409 con código `NO_PATH` cuando no hay ruta; 500 solo para fallos inesperados, registrando trazas internamente. P4 decidirá una convención consistente si FastAPI usa 422 por validación.

**CORS:** permitir únicamente dominios de desarrollo y despliegue configurados, no credenciales abiertas indiscriminadamente.

---

## 5. Distribución por persona (trabajo de backend)

**Carga aproximada deseada:** P1 25 %, P2 25 %, P3 25 %, P4 20 %, P5 5 %. Es una referencia de reparto, **no una estimación de horas** ni una equivalencia de dificultad (P3 es especialmente complejo). Todos desarrollan backend por módulos, no se reparte frontend ni pitching por áreas en esta fase.

### PERSONA 1 — NASA Data / Ingesta y procesamiento (25 %)

**Objetivo:** entregar un recorte real georreferenciado con elevaciones y sus metadatos, utilizable sin conexión por P2 y P3.

**Archivos a crear/modificar:** `app/nasa_data/{loader,processor,repository,schemas}.py`, `backend/data/{raw,processed,sources.json}`, `docs/nasa-data-sources.md`, `tests/test_nasa_data.py`.

**Orden de ejecución:**

1. Investigar las capas en Mars Trek y productos PDS/USGS **sin asumir** que el WMTS permite obtener alturas.
2. Priorizar un DTM de Jezero (CTX/HiRISE/HRSC si existe cobertura del sector) en formato con valores de elevación y CRS/datum documentados. Si falla, informar inmediatamente y proponer región alternativa respaldada por datos concretos.
3. Descargar solo la extensión necesaria o una muestra recortable; guardar URL, ID de producto, misión, instrumento, versión, unidades, resolución nominal, fecha de acceso y cualquier restricción.
4. Leer raster con Rasterio, inspeccionar `shape`, `dtype`, `count`, `nodata`, CRS, `transform`, rango y proporción de píxeles válidos.
5. Verificar que la unidad horizontal permite metros y documentar transformación/proyección planetaria. Si la capa está en grados, **no fabricar** tamaño de píxel en metros; reproyectar apropiadamente o bloquear el algoritmo hasta resolverlo.
6. Recortar AOI y generar `processed/{region_id}_elevation.tif` más metadatos JSON, preferiblemente con hash SHA256 del archivo original/recorte.
7. Crear `RegionData` y un repositorio de regiones con validación de shape, máscara y metadatos.
8. Publicar endpoints de listado/metadatos mediante servicio consumido por P4; evitar servir matrices grandes como JSON.
9. Entregar a P2 un DTM real pequeño y a P3 un fixture sintético con igual estructura.
10. Documentar las capas contextuales que realmente se van a mostrar, su alineación y el grado de relación con la misión.

**Funciones sugeridas:** `load_elevation_data(region_id)`, `get_region_metadata(region_id)`, `get_elevation_grid(region_id)`, `get_available_layers(region_id)`.

**Criterios de aceptación:** `RegionData` válido; elevaciones y dimensiones verificables; NoData preservado; proyección y unidades conocidas; datos NASA con enlaces precisos; un ejemplo de lectura sin red; archivo de muestra apto para pruebas y documentación de cobertura.

**Pruebas específicas / tips:**

- Crear raster sintético 5×5 en `tmp_path` con valores conocidos, transform afín y 1 celda NoData. Verificar que la carga devuelve exactamente la matriz/máscara.
- Probar un archivo inexistente, raster vacío, raster sin CRS y raster en grados sin conversión métrica: exigir errores claros.
- Revisar con `rio info` o `rasterio.open()` dimensiones y `res`; comparar manualmente coordenada central de dos celdas con `transform`.
- Comprobar que `nan` no pasa como terreno válido y que se mantiene orientación `[row, col]`.
- Validar un AOI donde haya *ambas* coberturas (imagen + DTM); conservar captura/mapa y enlaces originales como evidencia.
- Ejecutar `python -m pytest tests/test_nasa_data.py -q` desde `backend/`.
- **No subir** un PNG como `elevation.tif`, no interpolar extensas áreas NoData como si fueran mediciones.

**Bloqueante crítico:** ausencia de DTM métrico utilizable. Escalar al grupo y cambiar AOI antes de construir funcionalidades ficticias.

### PERSONA 2 — Terrain / Elevación, pendiente y transitabilidad (25 %)

**Objetivo:** producir matrices de pendiente/coste y métricas topográficas a partir de `RegionData`.

**Archivos:** `app/terrain/{elevation,slope,traversability,analyzer,schemas}.py`, `tests/test_terrain.py`, aportes a `docs/methodology.md`.

**Orden de ejecución:**

1. Crear fixtures de arrays de elevación en metros de 3×3 y 5×5; iniciar sin depender de P1.
2. Implementar gradientes en ejes correctos con `np.gradient(elevation_m, pixel_size_y_m, pixel_size_x_m)` respetando filas/columnas.
3. Calcular `slope_deg = degrees(arctan(hypot(dz_dx, dz_dy)))` donde sea numéricamente válido; documentar tratamiento de borde y celdas vecinas NoData.
4. Mantener máscara de validez; evitar que `NaN` contamine silenciosamente celdas vecinas o cree falsas superficies planas.
5. Generar `traversable` y `cost_multiplier` con umbral y penalización configurables. Validar parámetros (`threshold > 0`, `alpha >= 0`, etc.).
6. Calcular perfil de elevación para `grid_path`, ascenso y descenso sumando diferencias sucesivas, pendiente máxima y estadísticos básicos.
7. Proporcionar API interna estable para P3; acordar si los costes se aplican al centro de la celda o al segmento entre celdas.
8. Opcional: endpoint de resumen geográfico de un raster sin enviar arrays gigantes.

**Funciones:** `calculate_slope(region)`, `generate_terrain_cost_grid(region, config)`, `calculate_elevation_profile(region, grid_path)`, `get_terrain_statistics(region)`.

**Criterios de aceptación:** terreno plano da pendiente ~0; un plano inclinado produce pendiente esperada; NoData no transitable; todas las matrices tienen la misma forma y no contienen multiplicadores negativos; perfil correcto; parámetros documentados.

**Pruebas específicas / tips:**

- **Plano:** raster con todos los valores 100 m → slope 0° dentro de tolerancia.
- **Rampa X:** elevación aumenta 1 m por cada 1 m horizontal → pendiente `arctan(1)=45°`; verificar que no se mezclan ejes.
- **Rampa Y:** verificar gradiente en filas con signo/distancias correctos.
- **Anisotropía:** `pixel_size_x_m=2`, `pixel_size_y_m=5`: comprobar cálculo distinto y correcto.
- **NoData:** inyectar NaN en centro y bordes, verificar que no genera un falso corredor transitable.
- **Umbral:** celdas > `max_slope_deg` deben bloquearse según regla exacta (`>` versus `>=`); probar el caso igual al umbral.
- **Perfil:** elevaciones `[10, 15, 12, 20]` dan ascenso acumulado 13 m y descenso 3 m; probar ruta de un punto y fuera de límites.
- Ejecutar `python -m pytest tests/test_terrain.py -q`; incluir tests con tolerancias `pytest.approx`.
- No mostrar `slope` como riesgo absoluto ni convertir automáticamente topografía en «astronaut safety score».

**Bloqueante crítico:** unidades horizontales desconocidas del DTM. No aplicar gradiente hasta tener metros fiables.

### PERSONA 3 — Routing / A*, rutas y comparación (25 %)

**Objetivo:** generar dos alternativas de recorrido basadas en una rejilla de datos válida y devolver sus métricas comparables.

**Archivos:** `app/routing/{astar,cost_function,route_planner,route_comparator,schemas}.py`, `tests/test_routing.py`, aportes a `docs/methodology.md`.

**Orden de ejecución:**

1. Implementar A* puro contra arrays sintéticos 5×5: comenzar sin API ni archivos NASA.
2. Establecer vecindad de 8, distancias horizontales y diagonales reales, restricción sin atravesar esquinas bloqueadas.
3. Validar `start`, `goal`, máscara, dimensiones y multiplicadores.
4. Construir lista de `(row, col)` incluyendo extremos, `g_score`, reconstrucción correcta y manejo `NO_PATH`.
5. Heurística euclídea consistente con pesos ≥1; comprobar contra Dijkstra de referencia en tests pequeños si es posible.
6. Implementar `shortest` con peso 1 y `terrain_aware` con multiplicadores de P2.
7. Permitir distinta penalización configurable; documentar parámetros y comprobar que el algoritmo modifica trayectorias cuando los costes favorecen el desvío.
8. Integrar métricas a partir de los valores reales del DTM de P1/P2, no de los índices de pasos solos.
9. Exponer funciones a P4 y pruebas de contrato con la interfaz de P2.
10. Aplicar límites de área/celdas para evitar solicitudes que consuman memoria de forma excesiva.

**Funciones:** `find_shortest_path(...)`, `find_terrain_aware_path(...)`, `calculate_route_metrics(...)`, `compare_routes(...)`.

**Criterios de aceptación:** A* no atraviesa obstáculos, NoData ni esquinas inválidas; primer y último punto correctos; longitud física con unidades; ruta de menor distancia realmente mínima en pruebas pequeñas; ruta topográfica responde a pesos; retorno explícito cuando no hay ruta.

**Pruebas específicas / tips:**

- **Rejilla libre 3×3:** `(0,0) → (2,2)` con diagonales: distancia `2*sqrt(2)*pixel_m` cuando tamaño x=y.
- **Obstáculo:** bloquear la celda central; verificar desvío y ausencia de «corner cutting».
- **Sin ruta:** encerrar objetivo con celdas no transitables; `NO_PATH` explícito.
- **Inicio igual al destino:** ruta de una celda, longitud 0, métricas consistentes.
- **Coste:** crear franja central con multiplicadores muy altos y alternativa libre; `terrain_aware` debe evitarla cuando compense.
- **Consistencia óptima:** comparar coste final de A* contra Dijkstra de referencia en 10 cuadrículas aleatorias pequeñas con semilla fija.
- **Anisotropía:** distancia diagonal `sqrt(dx^2 + dy^2)` con píxeles rectangulares, no `sqrt(2)` universal.
- **Escala:** probar raster 100×100 y registrar tiempo/memoria sin prometer rendimiento de todo Marte.
- Ejecutar `python -m pytest tests/test_routing.py -q`. Añadir un test de integración P2→P3.
- No comparar numéricamente `cost` de modos con funciones distintas como si fueran la misma unidad.

**Bloqueante crítico:** ruta visual sin DTM y sin métricas verificadas. No sustituir el motor por líneas dibujadas manualmente.

### PERSONA 4 — Missions + Integración de FastAPI (20 %)

**Objetivo:** conectar módulos y proveer el flujo end-to-end a frontend, incluyendo objetivos científicos verificados.

**Archivos:** `app/main.py`, `app/api/router.py`, `app/missions/{mission_service,mission_builder,scientific_targets,schemas}.py`, `tests/test_missions.py`, `backend/README.md`, `docs/api-contract.md`, `docs/demo-notes.md`.

**Orden de ejecución:**

1. Crear proyecto ejecutable FastAPI, estructura y contratos de modelos sin esperar implementaciones finales.
2. Configurar ruta `/docs`, manejo uniforme de errores, CORS y configuración de ruta de datasets por variable de entorno.
3. Definir DTOs Pydantic para `MissionRequest`, `RouteResponse`, `MissionResponse`, `APIError` conforme a sección 4.6.
4. Crear catálogo JSON de objetivos científicos **documentados**, con `target_id`, nombre, `region_id`, posición comprobada, misión/instrumento y URL. Si no hay coordenadas verificables, mostrar solo referencia contextual o desactivar navegación al punto.
5. Inyectar dependencias de servicios (`RegionRepository`, `TerrainAnalyzer`, `RoutePlanner`) en `mission_service`, evitando importaciones circulares.
6. Implementar `POST /api/missions/plan`: validar región, cargar datos, preparar terreno, pedir ambas rutas, calcular métricas, adjuntar fuentes/limitaciones y serializar respuesta.
7. Incluir rutas P1/P2/P3/P5 desde `main.py`; no duplicar sus algoritmos en controladores.
8. Empezar pruebas con stubs in-memory y finalmente probar con el raster real de P1.
9. Publicar README de ejecución y una muestra reproducible `curl` o script demo; verificar frontend externo pueda consumir API.
10. Coordinar merges y congelar contratos antes de la presentación.

**Funciones:** `get_scientific_targets(region_id)`, `create_mission_plan(request)`, `build_mission_response(result)`.

**Criterios de aceptación:** `uvicorn app.main:app --reload` inicia; `/docs` disponible; endpoint devuelve dos rutas con campos tipados y fuentes; errores útiles cuando faltan datos; despliegue accesible; no CORS bloqueante; no depende de archivos personales fuera del repo.

**Pruebas específicas / tips:**

- `TestClient` + inyección de repositorio ficticio: misión válida devuelve código 200 y dos rutas.
- Región inexistente → 404; coordenadas fuera de raster → 422; DTM no cargado → 503; destino inaccesible → respuesta `NO_PATH` consistente.
- Asegurar serialización de `np.float32`, `np.int64`, NaN: convertirlos a Python nativo y **no enviar NaN/Infinity en JSON**.
- Confirmar que `/api/missions/plan` no devuelve valores de ejemplo cuando el algoritmo real falla.
- Verificar que `data_sources` de la respuesta corresponde a IDs de `sources.json` reales.
- Prueba de humo: levantar servidor, consultar `/api/health`, `/api/data/regions`, ejecutar `POST /api/missions/plan` con punto válido.
- Verificar CORS desde el frontend real y que la URL desplegada responda sin autenticación.
- Ejecutar `python -m pytest tests/test_missions.py -q` y suite completa.
- Documentar contratos y pruebas en PR para que nadie dependa de mensajes de chat que puedan perderse.

**Bloqueante crítico:** imposibilidad de ensamblar módulos por contratos incompatibles. Ante conflicto, detener cambios de interfaz y actualizar sección 4 antes de seguir.

### PERSONA 5 — System Health & Metadata (5 %; mínimo trabajo)

**Objetivo:** dos endpoints sencillos y sus pruebas. **No asignar a P5 cálculos, procesamiento NASA, integración ni arquitectura.**

**Archivos:** `app/system/{router,schemas}.py`, `tests/test_system.py`.

**Orden de ejecución:**

1. Crear `APIRouter(prefix="/api")` sin tocar `main.py`.
2. Implementar `GET /health` devolviendo `{"status": "ok"}` o un modelo simple acordado, que significa «servidor responde», no «todos los datos cargados».
3. Implementar `GET /system/info` devolviendo nombre `ARES PATH`, versión `0.1.0`, reto, alcance y una advertencia de prototipo, sin poner datos personales.
4. Crear 2–4 pruebas con `TestClient` sobre router aislado.
5. Comunicar a P4 la línea de `include_router` y abrir PR con `pytest` exitoso.

**Criterios de aceptación:** dos endpoints HTTP 200 con JSON válido y pruebas sin depender de NASA, GPU ni red.

**Pruebas específicas / tips:**

- Probar status code 200, `content-type: application/json`, `status == "ok"`, `project == "ARES PATH"`.
- Confirmar que las respuestas **no contienen secretos**, rutas locales ni nombres reales.
- Probar con router aislado para evitar dependencia de trabajo incompleto de P4.
- Ejecutar `python -m pytest tests/test_system.py -q`.
- Si termina pronto, **no asumir otras tareas**; apoyar en revisión manual de documentación solo si el equipo lo solicita, manteniendo la carga mínima.

---

## 6. Protocolo para avanzar en paralelo sin bloqueos

### 6.1 Primera sincronización (acuerdo de 15–20 minutos)

P4 comparte estructura, versiones y `MissionRequest`/`MissionResponse`. P1 confirma candidatos de DTM y CRS. P2 y P3 ratifican contratos de matrices. P5 recibe solo su módulo. Fijar región provisional y plan B.

**Entregables de interfaz desde el inicio (antes de datasets completos):**

- P1 publica un `RegionData` sintético 10×10 con campos correctos y función `get_region(...)`.
- P2 implementa `analyze_region(region: RegionData, config) -> TerrainData` con array sintético.
- P3 implementa `plan_path(...)` de sección 4.5, sin imports de P1.
- P4 crea `POST /api/missions/plan` con dependencias inyectadas y stub comprobable; desactivar ese stub en producción.
- P5 entrega `/api/health` y `/api/system/info` de forma autónoma.

### 6.2 Secuencia de integración

```text
NASA DTM real (P1) ──> RegionData ──> TerrainData (P2)
                             │              │
                             │              └──> A* y métricas (P3)
                             │                         │
                             └─────────────────────────┴──> Mission Service (P4)
                                                                    │
                                                             FastAPI / frontend
P5: health/info ──────────────────────────────────────────────> FastAPI (P4)
```

**Puntos de integración:**

- **Gate A:** P1 entrega DTM y metadatos verificables; P2/P3 ya pasan tests sintéticos.
- **Gate B:** P2 genera `TerrainData` en el raster real y lo compara contra un recorte pequeño manual.
- **Gate C:** P3 calcula dos rutas sobre el DTM real, sin `NaN`, pasando pruebas.
- **Gate D:** P4 devuelve ambas rutas y fuentes vía API y frontend las dibuja sobre la región correcta.
- **Gate E:** demo pública y documentación entregables, con límites científicos explícitos.

**Regla de desbloqueo:** si un gate falla, resolver el menor experimento que pruebe el problema. No avanzar a 3D, IA o efectos de UI para ocultar una falta de datos.

### 6.3 Plan de contingencia

- **No aparece DTM en Jezero:** cambiar a una región de Gale/Mount Sharp u otra con datos métricos verificables, documentar decisión y actualizar `region_id` y rutas.
- **DTM demasiado grande:** recortar más y/o reducir resolución con tratamiento correcto; documentar remuestreo y pérdida de detalle. Nunca usar píxeles de imagen óptica como elevación.
- **No hay tercera capa georreferenciable:** entregar óptica + topografía; agregar información geológica referenciada como ficha contextual, etiquetando que no es una tercera capa raster alineada.
- **Rutas idénticas:** crear una demostración sobre otra pareja de puntos real donde las penalizaciones produzcan cambios, sin manipular datos; si son idénticas, explicarlo como resultado legítimo.
- **Modo `terrain_aware` sin camino:** devolver `NO_PATH`; explicar efecto de umbrales y permitir valores configurables dentro de límites razonables.
- **Frontend no listo:** conservar una demo reproducible desde `/docs` o notebook mínimo que muestre rutas sobre el mapa, sin inventar rutas.
- **Despliegue bloqueado:** usar plataforma que exponga API pública; no exigir usuarios ni credenciales para jurado.

---

## 7. Pruebas compartidas y calidad científica

### 7.1 Pirámide de pruebas

1. **Unitarias rápidas:** sintéticas, sin red, deterministas por módulo.
2. **Integración:** P1→P2→P3→P4 sobre recorte real pequeño.
3. **Contrato API:** Pydantic, HTTP, respuesta JSON sin `NaN`, manejo de errores.
4. **End-to-end:** usuario selecciona puntos, genera dos rutas, ve valores correctos en mapa.
5. **Validación científica:** revisión de gradientes, georreferenciación, resolución y límites del modelo.

### 7.2 Comandos sugeridos

```bash
cd backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -e '.[dev]'       # si pyproject.toml define extras dev
python -m pytest -q
uvicorn app.main:app --reload
```

Si se elige `requirements.txt` en vez de extras, documentar `pip install -r requirements.txt`; **no conservar dos listas de dependencias divergentes**.

Ejemplo de smoke test cuando el servidor esté arriba:

```bash
curl -s http://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/data/regions
curl -s http://127.0.0.1:8000/openapi.json
```

### 7.3 Casos mínimos de aceptación total

- [ ] El DTM real está identificado y su sistema de coordenadas es comprobable.
- [ ] El mapa óptico coincide espacialmente con el recorte de elevación (control visual con puntos de referencia).
- [ ] El backend distingue `synthetic` de `NASA` y no expone ejemplos falsos en producción.
- [ ] No se calculan rutas fuera del raster ni a través de celdas inválidas.
- [ ] A* valida longitud y obstáculos frente a un caso de resultado conocido.
- [ ] `shortest` y `terrain_aware` funcionan con parámetros definidos.
- [ ] Todas las estadísticas salen de elevación y rutas reales; no hay cifras hardcodeadas.
- [ ] La comparación muestra ventajas y compromisos, no garantías de seguridad.
- [ ] Hay al menos una fuente NASA usada efectivamente y citada con URL directa/ID.
- [ ] API y frontend funcionan desde enlaces accesibles al jurado.
- [ ] Todos los tests unitarios/integración pasan en una instalación limpia.
- [ ] Se registra el uso de IA, librerías y otras fuentes externas.

### 7.4 Criterios para gráficos y explicaciones

- Todo número presentado debe tener unidad, fuente y método de obtención.
- No confundir *elevation*, *slope*, *roughness*, *thermal* y *radiation*: son variables distintas.
- «Terrain-aware» es un criterio de ingeniería del prototipo, no una probabilidad de supervivencia.
- Imágenes de superficie solo pueden situarse en un punto exacto si existe geolocalización suficientemente respaldada.
- La resolución del DTM limita la detección de obstáculos pequeños. Un píxel suavizado no implica que el terreno sea transitable.
- Registrar incertidumbres de datos, huecos, cobertura y omisiones del modelo.

---

## 8. Guía para sincronizar frontend y backend, aunque frontend NO esté asignado aún

El backend debe proporcionar al futuro frontend:

- `GET /api/data/regions` para seleccionar región.
- Metadatos de imagen/capa y extensión geográfica o matriz de referencia; no exponer solo índices arbitrarios sin transformación visual.
- `POST /api/missions/plan` con `grid_path`, métricas y fuentes; opcional `map_path` transformado al mismo CRS del mapa (solo si es correcto).
- Contrato estable de coordenadas: al hacer clic en el mapa, frontend debe convertir posición a `[row, col]` usando la transformación del raster o pedir al backend que la convierta.
- Mensajes de error específicos para clic fuera del AOI, zona sin datos y ruta imposible.

**No dibujar en coordenadas terrestres por defecto.** Definir claramente CRS de visualización y aplicar la transformación adecuada; verificar visualmente 3 puntos de control. No reconstruir rutas por interpolación arbitraria en el navegador: dibujar la secuencia que calculó el backend.

Recomendación de demo: panel de misión izquierda, mapa central, comparación derecha; incluir leyenda de capas y enlace visible «NASA data & limitations». Mantener todo accesible con teclado y legible en video de 30 segundos.

---

## 9. Estrategia de demo, presentación y entrega

**Historia central:** «Una persona debe caminar desde una base ficticia a un objetivo científico en Marte. ARES PATH integra datos NASA y compara una ruta de mínima distancia con otra que evita pendientes desfavorables, explicando el compromiso entre recorrido y terreno».

### Guion visual recomendado para 30 segundos

- **0–5 s:** problema y región: "Planning a Marswalk requires more than a map."
- **5–12 s:** alternar capas NASA y seleccionar origen + objetivo.
- **12–21 s:** calcular y mostrar dos rutas distintas (si realmente difieren) con cifras verificadas de distancia y pendiente.
- **21–27 s:** mostrar explicación basada en datos y ficha del objetivo científico.
- **27–30 s:** «ARES PATH — explainable Marswalk planning using NASA open data» + enlace o identidad del proyecto.

**No usar estos textos como evidencia de funcionalidad antes de que existan.** La demo final debe mostrar el software real y contener únicamente afirmaciones verificadas.

### Presentación máxima de siete diapositivas (si se elige ese formato)

1. Problema y misión científica.
2. Qué es ARES PATH y para quién.
3. Fuentes NASA utilizadas realmente, con identificadores.
4. Metodología: raster, pendiente, A*, criterios.
5. Demostración: comparación de rutas real.
6. Validación, límites y aplicaciones.
7. Equipo, continuación, GitHub y demo pública.

**Documentación de entrega:** título; *summary* en inglés; descripción detallada; URL demo; URL repo; datos NASA; referencias/licencias; declaración de IA; términos y envío. Ajustar a campos exactos del portal actual.

### Uso responsable de asistentes IA

- Se pueden usar para borradores de código y documentación, pero los integrantes deben validar lógica, pruebas y exactitud.
- Registrar qué herramientas se usaron y en qué partes; incluir información necesaria en el apartado de IA del formulario.
- No presentar ninguna imagen generada como foto de Marte ni crear screenshots falsos de funcionalidad que no existe.
- Las decisiones científicas, selección de datos, pruebas y conclusiones pertenecen al equipo.

---

## 10. Riesgos que deben ser visibles para todos

| Riesgo | Señal de alerta | Mitigación | Responsable principal |
|---|---|---|---|
| Falta de DTM compatible | Solo aparecen PNG/WMTS | Conseguir producto PDS con elevaciones o cambiar AOI | P1 |
| Distancias incorrectas | Se usa lat/long como metros | Validar CRS, unidad y transformaciones | P1/P2 |
| Pendientes erróneas | Plano inclinado falla test | Tests numéricos con rampa y píxeles anisótropos | P2 |
| Rutas que atraviesan obstáculos | Path pasa NoData o diagonales bloqueadas | Máscara y tests de esquina | P3 |
| Integración fallida | Respuestas usan claves distintas | Congelar DTOs; P4 coordina | P4 |
| Demo falsa o incompleta | Se muestran resultados hardcodeados | Ruta real end-to-end o mostrar limitación | Todos |
| Falta de evidencias NASA | «Usamos Mars Trek» sin dataset concreto | IDs, URLs, metadata, pasos de uso | P1/P4 |
| Exceso de alcance | IA, 3D y tiempo real antes de A* | Congelar MVP; extras solo tras Gates A–E | Todos |
| Entrega inaccesible | Link privado o necesita login | Verificación desde incógnito/dispositivo externo | P4 |

---

## 11. Checklist de cierre por integrante

**P1:** [ ] DTM real descargado [ ] CRS/unidades [ ] AOI [ ] NoData [ ] sources.json [ ] tests [ ] entrega a P2.

**P2:** [x] pendiente [x] máscara [x] costes [x] perfil [x] tests plano/rampa/NoData [x] integración de entrega a P3 [ ] endpoints HTTP de terreno coordinados con P4. La interfaz y un ejemplo de consumo están documentados en `docs/methodology.md`; la prueba P2→P3 usa `analyze_region` y terreno sintético en `tests/test_routing.py`.

**P3:** [x] A* [x] obstáculos [x] dos modos [x] métricas [x] tests de optimalidad/bordes [ ] entrega a P4. Implementado en `backend/app/routing/` con 23 pruebas aprobadas sobre datos sintéticos; falta ejecutar una ruta sobre el DTM real y publicar los endpoints HTTP coordinados con P4.

**P4:** [ ] servicio de misión [ ] endpoints [ ] DTOs [ ] integración [ ] README [ ] CORS [ ] smoke [ ] demo pública.

**P5:** [ ] `/health` [ ] `/system/info` [ ] tests simples [ ] PR. **Nada más obligatorio.**

**Todos:** [ ] PR y tests [ ] registro de cambios [ ] sin datos inventados [ ] créditos y fuentes [ ] límites científicos.

---

## 12. Registro de decisiones (actualizar durante el evento)

| Decisión | Estado inicial | Cuándo actualizar |
|---|---|---|
| Desafío | `Interplanetary Survival Guide: Martian Map` confirmado | Solo si el equipo cambia de reto |
| Nombre de solución | `ARES PATH` acordado | Si cambia nombre público |
| Área piloto | Recorte `jezero_fan_256` del abanico deposicional de Jezero; DTM descargado y procesado | Tras validar alineación con ortoimagen y puntos de control |
| Plan B geográfico | Gale/Mount Sharp u otra AOI con DTM validado | Si Jezero no es viable |
| Backend | Python / FastAPI / NumPy / Rasterio | Al fijar versiones |
| Algoritmo base | A* en rejilla de 8 vecinos | Si se prueba otra opción |
| Criterios | Distancia y penalización de pendiente | Tras tests científicos |
| Datos NASA concretos | HiRISE/MRO `DTEEC_002387_1985_003798_1985_A01`, PDS original público; CRS y unidades conservados | Ante otro producto o recorte; detalles en `docs/nasa-data-sources.md` |
| Frontend | React/Next.js previsto, no asignado en este plan | Al definir interfaz real |
| Fuente de verdad | Guía oficial + NASA + AGENTS.md | Ante cambios oficiales |
| P5 | Trabajo mínimo | Mantener mínimo |

**Formato para nueva decisión:** fecha/hora, quiénes acordaron, qué cambia, motivo, contratos afectados, tests que cambian, enlace al PR. No cambiar comportamiento y documentarlo días después.

### 2026-11-14 — Selección y validación del DTM por Persona 1

Persona 1 autorizó la selección de datos NASA reales sin autenticación ni claves y el registro de esta actualización. Se seleccionó el DTM HiRISE/MRO `DTEEC_002387_1985_003798_1985_A01`, del abanico deposicional de Jezero, descargado desde PDS. Se generó `jezero_fan_256`, de 256 × 256 celdas, sin remuestreo ni reproyección. Se conserva el CRS marciano equirectangular original, con resolución de 1.0096476466229 m/píxel y elevaciones en metros sobre Mars 2000 Datum.

Se mantiene el contrato `RegionData` de la sección 4.3, con índices internos `(fila, columna)` y máscara de validez. Validación: 15 pruebas unitarias aprobadas, lectura local del recorte real y consultas HTTP con router aislado (200 para los tres endpoints de datos y 404 para región inexistente). No se cambiaron contratos de otros módulos. La hora exacta no se registró y no se creó PR ni commit automáticamente.

Pendientes: P4 debe registrar el router y coordinar dependencias; el equipo debe validar alineación con ortoimagen y puntos de control, y ejecutar la integración P1→P2→P3→P4. Procedencia, comandos reproducibles, evidencia y limitaciones en [NASA Data Processing](../docs/nasa-data-sources.md).

---

### 2026-11-14 — Ortoimagen asociada al DTM de Jezero

Persona 1 solicitó incorporar una ortoimagen compatible. Se descargó `PSP_002387_1985_RED_C_01_ORTHO` y su etiqueta PDS desde el directorio oficial del DTM. Se preparó un TIFF óptico 256 × 256 sobre la cuadrícula de `jezero_fan_256`, sin remuestrear ni modificar el DTM. Se mantiene `RegionData`; `/layers` puede anunciar la imagen como capa contextual, con `used_for_routing=false`.

Se detectaron diferencias entre la georreferenciación incrustada del JP2 y la etiqueta PDS (parámetros del CRS y origen desplazado 1.5 píxeles). Se adoptó explícitamente la cuadrícula PDS compartida, interpretada con la convención de GDAL del IMG original, conservando los metadatos discrepantes para auditoría. Se verificaron tres posiciones de cuadrícula y se generó una comparación visual. Esto no constituye control geodésico independiente: el estado es `PDS grid verified; independent visual review pending`. Validación actual: 19 pruebas aprobadas y `/layers` HTTP 200 con ambas capas. P4 debe integrar el router y definir cómo servir la imagen; el equipo debe revisar rasgos y referencias independientes. Comandos y limitaciones en [NASA Data Processing](../docs/nasa-data-sources.md). Sin PR ni commit automático; hora exacta no registrada.

---

### 2026-11-14 12:43 (Guatemala) — Estado del módulo de terreno, Persona 2

En `feature/terrain-analysis` se fusionó `develop` (`ecfe884`) y se comprobó que el `RegionData` de P1 funciona directamente con `analyze_region(region, config) -> TerrainData`. P2 entrega `slope_deg`, `traversable` y `cost_multiplier`, además de perfil de elevación y resumen estadístico. El cálculo usa distancias de píxel en metros, diferencias centrales en el interior, unilaterales en bordes, NoData no transitable y coste exploratorio `1 + slope_weight * (slope_deg / max_slope_deg) ** 2`. Los valores predeterminados son `max_slope_deg=20` y `slope_weight=2`; son parámetros del prototipo, no límites de seguridad. No se cambiaron los contratos de las secciones 4.3–4.6.

Validación: 16 pruebas de terreno y 35 pruebas conjuntas P1+P2 aprobadas el 14 de noviembre de 2026. Cubren plano, rampas X/Y de 45°, píxeles anisótropos, NoData, umbral inclusivo, costes, perfiles y compatibilidad con el `RegionData` concreto de P1. Se descargó de nuevo el IMG HiRISE `DTEEC_002387_1985_003798_1985_A01`; tanto su SHA256 como el del TIFF reconstruido coinciden con el sidecar de P1. El TIFF local está excluido de Git. Sobre `jezero_fan_256` (256 × 256, 1.0096476466229 m/píxel), las 65 536 celdas son válidas y, con umbral 20°, transitables según el criterio elegido. La pendiente calculada tiene media 2.8937817499° y máximo 17.3470597057°. En `(row=128, col=128)`, el cálculo manual da 3.17868046266°, igual al módulo. En este recorte sin NoData, la matriz completa coincidió con el cálculo de referencia de `np.gradient` (diferencia máxima 0°). La fórmula, los valores de entrada, la procedencia y el ejemplo de consumo están en [Metodología de terreno](../docs/methodology.md). Codex ayudó con código, pruebas y documentación; el equipo debe revisar los resultados antes de usarlos en la entrega.

Pendiente para cerrar la integración: P3 debe consumir `terrain.traversable`, `terrain.cost_multiplier` y los tamaños de píxel de `RegionData`, acordando con P2 la fórmula de coste por paso antes de comparar rutas; falta una prueba P2→P3 con ruta real. P4 debe coordinar los modelos de solicitud/respuesta y decidir el registro de los endpoints `/api/terrain/...` listados en 4.6. Hoy el módulo P2 expone servicios internos, pero esos endpoints HTTP aún no están publicados. El `pyproject.toml` compartido sigue vacío y P4 coordina las dependencias. No presentar la clasificación de celdas como garantía de movilidad o seguridad, ni tratar la ortoimagen como datos de elevación. Las imágenes y registros verificables para comunicar el trabajo de P2 están en [Evidencias de Persona 2](../docs/evidencias_persona_2/README.md).

### 2026-11-14 — Módulo de rutas, Persona 3

Se implementó P3 en `backend/app/routing/{astar,cost_function,route_planner,route_comparator,schemas}.py`, con pruebas en `backend/tests/test_routing.py`. El contrato de A* de la sección 4.5 se mantiene: vecindad de ocho direcciones, rechazo de diagonales que cruzan esquinas bloqueadas, longitud física por eje y coste de tramo `longitud_m * 0.5 * (multiplicador_actual + multiplicador_vecino)`. La heurística es euclídea en metros y admisible porque los multiplicadores son mayores o iguales que 1.

`shortest` usa la máscara `traversable` de P2 con multiplicador unitario; `terrain_aware` usa la misma máscara y `cost_multiplier` de P2. Sin ruta se lanza `NoPathError` con código `NO_PATH`; el límite de expansión predeterminado es un millón de celdas y se señala con `SearchLimitExceeded` y código `SEARCH_LIMIT`. Las métricas se calculan con el perfil de elevación de P2 y no con índices de pasos. `compare_routes` devuelve deltas físicos, `same_path` y `cost_comparable=False` por defecto, sin emitir juicios de seguridad. No se cambiaron los contratos de las secciones 4.3–4.6.

Validación: 23 pruebas de rutas aprobadas el 14 de noviembre de 2026, incluyendo diagonal 3×3, píxeles anisótropos, obstáculo central, ausencia de cruce de esquinas, destino encerrado, inicio igual al destino, franja de coste alto, comparador, integración P2→P3, entradas inválidas, diez rejillas aleatorias con semilla fija contra Dijkstra y rejilla de 100×100. Las pruebas son sintéticas; no se ejecutó una ruta sobre `jezero_fan_256` porque el entorno disponible no tiene `rasterio` ni el TIFF local. Detalles y comandos en [Metodología](../docs/methodology.md) y [Validación](../docs/validation.md).

Pendiente: P4 debe coordinar los DTOs y publicar `POST /api/routes/calculate` y `POST /api/routes/compare`; el equipo debe ejecutar Gate C sobre el DTM real en un entorno con `rasterio`. Asistencia de IA: el agente de OpenCode (DeepSeek V4.1 Flash Free) apoyó con código, pruebas y documentación; el equipo debe revisar y validar los resultados. Sin PR ni commit automático.

---

## 13. Mensaje de contexto que cualquier integrante debe poder explicar

> ARES PATH es un prototipo de planificación de recorridos científicos en Marte. Integrará datos reales de observación orbital y topografía de NASA para comparar, dentro de una región piloto, una ruta de mínima distancia con una ruta que considera la dificultad del terreno. El software explicará sus criterios y limitaciones, permitirá inspeccionar objetivos científicos documentados y no afirmará garantizar la seguridad de astronautas. La prioridad es un MVP funcional y reproducible que pueda demostrarse públicamente durante NASA Space Apps Challenge 2026 y, posteriormente, ampliarse como trabajo de investigación sobre rutas multicriterio.

**Prioridad absoluta:** primero *datos métricos reales*, luego *algoritmo validado*, después *API integrada*, finalmente *experiencia y presentación*. **No invertir ese orden.**
