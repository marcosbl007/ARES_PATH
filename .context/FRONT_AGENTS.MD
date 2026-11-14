# FRONT_AGENTS.MD — ARES PATH / Frontend

**Proyecto:** ARES PATH — Adaptive Route Evaluation System for Planetary Astronaut Traverses  
**Competencia:** NASA Space Apps Challenge 2026 · *Interplanetary Survival Guide: Martian Map*  
**Ámbito:** exclusivamente `frontend/` · **Gestor de paquetes: pnpm**  
**Estado:** guía de implementación y contratos (la identidad visual y el diseño de pantallas están **pendientes de definir**).

> Este documento rige la implementación del frontend y el comportamiento de sus agentes de programación. El archivo `.CONTEXT/AGENTS.md` del repositorio es la referencia de contexto del backend, los modelos científicos y sus contratos. Si hay diferencias, no cambiar silenciosamente ninguno: documentar la discrepancia, coordinar con la persona 4 del backend y actualizar el contrato acordado en ambos lugares.

---

## 0. Instrucciones obligatorias para personas y agentes

1. **No diseñar todavía el layout, la estética, la paleta, la tipografía, wireframes, navegación visual ni una distribución de paneles.** Aún no existe una decisión aprobada. Implementar infraestructura, componentes semánticos y funcionalidades sin imponer una propuesta de interfaz.
2. Trabajar solo en `frontend/` salvo cambios coordinados, revisados y explícitamente autorizados en contratos compartidos; no modificar archivos del backend para adaptar una pantalla.
3. **Usar `pnpm` exclusivamente.** No usar `npm install`, `yarn`, `bun` ni generar `package-lock.json`/`yarn.lock`/`bun.lockb`. Versionar `pnpm-lock.yaml` y fijar versión de `pnpm` mediante `packageManager` en `package.json` una vez configurado el entorno.
4. Tratar **Jezero Crater** como región elegida; `jezero_demo` es el ID de contrato actual, no el nombre científico de un dataset ni garantía de cobertura. La zona exacta, cuadrícula, CRS y capas dependerán de los metadatos que entregue backend.
5. No inventar resultados científicos, pendientes, longitudes, fotografías georreferenciadas ni objetivos de misión. Los mocks se limitan a tests/desarrollo y deben identificarse visiblemente como *synthetic/demo*.
6. No presentar ARES PATH como sistema de navegación operacional certificado: es un prototipo de apoyo a la planificación científica; las rutas no garantizan seguridad de un astronauta.
7. El backend calcula rutas, pendientes, transitabilidad y métricas. El frontend valida entradas, gestiona interacción, consume respuestas, transforma coordenadas **solo con metadatos correctos** y presenta los resultados.
8. Construir primero el flujo completo **seleccionar origen/destino → enviar misión → recibir dos rutas → visualizar comparación y fuentes**. Luego añadir objetivos científicos, PWA y guardado offline.
9. Aislar componentes comunes de la lógica de dominio; **no forzar todos los componentes dentro de Atomic Design**. Las piezas que conocen rutas, Marte o misiones viven en su feature.
10. Cada cambio debe incluir tipos estrictos, validación de datos externos, estado de error/carga/vacío, pruebas relevantes y ausencia de secretos en el cliente.
11. La versión funcional y los recursos científicos reales tienen prioridad sobre animaciones, 3D, chatbots o funcionalidades vistosas.
12. Documentar uso de asistencia de IA y licencias/créditos de material externo para el expediente NASA Space Apps 2026.

## 1. Contexto y alcance de ARES PATH

**Problema oficial:** las misiones robóticas de NASA han producido imágenes y datos diversos de Marte; una futura caminata humana requiere reunir información científica hiperlocal para planificar un recorrido con objetivos de exploración y restricciones ambientales/topográficas.

**Propuesta acordada:** aplicación web progresiva (PWA) para explorar una zona seleccionada de **Jezero**, elegir origen y destino, consultar capas científicas, solicitar rutas al backend FastAPI y comparar la alternativa de menor distancia con una alternativa sensible al terreno. Posteriormente permitir guardar una misión previamente calculada con sus recursos para consultarla sin conexión (**Offline Mission Pack**).

**Alcance inicial del frontend:**
- Obtener regiones, capas y metadatos del área de trabajo desde FastAPI.
- Representar un mapa georreferenciado del sector de Jezero (motor sujeto a verificación de compatibilidad de proyección; OpenLayers es la opción inicial).
- Capturar puntos de inicio y destino, validar que son convertibles a celdas válidas y mostrar su estado de selección.
- Consultar y seleccionar objetivos científicos **verificados** y sus referencias si el backend los proporciona.
- Enviar planificación y renderizar *exactamente* las rutas y las métricas que retorne la API.
- Mostrar incertidumbres, limitaciones de resolución, fuentes y estados de errores de forma comprensible.
- Preparar instalación PWA; el guardado y la lectura offline de misiones constituyen una **fase posterior**, sin bloquear el flujo principal.

**Fuera del alcance inicial:** seguimiento de posición real de astronautas, GPS en Marte, predicción operacional de radiación, cálculo de nuevas rutas completamente offline, hazard detection de rocas pequeñas no resueltas por el DTM, simulador EVA certificado, sincronización compleja y autenticación innecesaria.

**Fuentes oficiales compartidas por el equipo:**
- Reto: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/
- Mars Trek: https://trek.nasa.gov/mars/
- USGS Mars interactive maps: https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars
- Curiosity's proposed path (referencia de narrativa, **no Jezero**): https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/
- NASA Worldview (referencia de interacción y capas, **centrada en Tierra**): https://worldview.earthdata.nasa.gov/
- Perseverance raw images: https://mars.nasa.gov/mars2020/multimedia/raw-images/

No suponer que una foto, mosaico visual o una tesela WMTS sea automáticamente un DTM/DEM con elevación numérica. La fuente exacta y su procedencia deben llegar desde el backend.

## 2. Stack y herramientas acordadas

- **Next.js con App Router**, **React**, **TypeScript** en `strict`, **Tailwind CSS**, **pnpm**.
- **OpenLayers (`ol`)** como candidata inicial para mapa raster/planetario; validar proyección y coordenadas antes de afirmar compatibilidad. No asumir EPSG:3857 terrestre.
- **Recharts** para datos y perfiles si encaja con los requisitos; no generar datos para rellenar gráficas.
- **Zod** (u otro validador pactado) para validar JSON de APIs y persistencia.
- **Lucide React** para iconos neutrales, sujeto al diseño final.
- **Vitest + React Testing Library** para unitarias y componentes; **Playwright** para E2E prioritarios.
- **Service worker + Cache Storage + IndexedDB** cuando se implemente Offline Mission Pack. `manifest.ts` puede prepararse antes, sin prometer offline.
- Cliente REST basado en `fetch`, unificado en `shared/api/http-client.ts`. Elegir librerías adicionales solo con justificación (no introducir Redux/Zustand/TanStack Query por defecto).

### Inicio del proyecto (pnpm)

Desde la raíz:

```bash
pnpm create next-app frontend --ts --tailwind --eslint --app --src-dir --import-alias '@/*'
cd frontend
pnpm add ol zod lucide-react recharts
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom playwright @playwright/test
```

> Fijar versiones compatibles en el lockfile; comprobar CLI y versiones efectivas de Next/React/pnpm al iniciar. Los comandos anteriores son la guía de arranque, no evidencia de paquetes ya instalados. Usar `pnpm exec playwright install` si se añaden pruebas de navegador.

```bash
pnpm dev
pnpm lint
pnpm exec tsc --noEmit
pnpm test           # configurar este script al instalar Vitest
pnpm build
pnpm exec playwright test  # cuando existan pruebas E2E
```

**Scripts esperados:** `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run`, `test:e2e`; no crear scripts que invoquen otro gestor de paquetes. No subir `.env.local`, `.next/`, `node_modules/`, `.turbo/` o cachés al repositorio.

## 3. Organización híbrida: Atomic Design + Features

**Regla fundamental:** Shared UI se clasifica por composición visual genérica (atoms → molecules → organisms → templates); la lógica del negocio se agrupa por feature (carpetas independientes con hooks, servicios, esquemas, componentes del dominio). No crear `pages/` como capa Atomic Design: App Router representa las páginas.

```text
frontend/
├── AGENTS.md
├── public/
│   ├── icons/                    # assets autorizados para PWA
│   └── maps/                     # solo recursos cartográficos permitidos
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               # composición mínima, NO diseño predefinido
│   │   ├── globals.css
│   │   ├── manifest.ts            # fase PWA
│   │   ├── error.tsx
│   │   ├── loading.tsx
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── atoms/                 # UI básica genérica
│   │   ├── molecules/             # composición pequeña genérica
│   │   ├── organisms/             # bloques genéricos reutilizables
│   │   └── templates/             # SOLO tras aprobar estructura visual
│   ├── features/
│   │   ├── mars-map/
│   │   ├── mission-planning/
│   │   ├── route-analysis/
│   │   ├── science-targets/
│   │   ├── offline-missions/      # fase posterior
│   │   └── mission-reports/       # fase posterior
│   ├── shared/
│   │   ├── api/
│   │   ├── config/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── utils/
│   └── test/
│       ├── fixtures/
│       ├── mocks/
│       └── setup.ts
├── e2e/
├── .env.example
├── next.config.ts
├── pnpm-lock.yaml
├── package.json
└── README.md
```

> Esta es **arquitectura de código**, no propuesta de distribución visual. No precrear carpetas y componentes vacíos si todavía no se necesitan.

### 3.1 Atomic Design: qué va en cada capa

- **Atoms:** controles base (`Button`, `Input`, `Text`, `Spinner`) sin conocimiento de Marte, misiones ni API.
- **Molecules:** combinaciones reusables (`FormField`, `StatusIndicator`, `MetricItem`) con props genéricas, unidades explícitas.
- **Organisms:** agregados genéricos que pueden reutilizarse entre features. No introducir `RouteComparison` aquí.
- **Templates:** esqueletos de composición **solo después de una decisión explícita de diseño**; inicialmente pueden permanecer vacíos.

Si un componente conoce `mission_id`, `grid_path`, `terrain_config` o `scientific_targets`, debe vivir en una feature, aunque sea grande o pequeño. No usar Atomic Design como excusa para acoplar servicios al UI compartido.

### 3.2 Contrato interno de features

Estructura orientativa y **no obligatoria para todas las features**:

```text
features/<feature-name>/
├── components/          # UI de dominio
├── hooks/               # estado e interacción de esta feature
├── services/            # adaptadores a API/persistencia
├── schemas/             # validadores Zod
├── types/               # tipos propios, preferir inferencia desde schema
├── utils/               # funciones puras de dominio visual
└── index.ts             # API pública de la feature
```

- `mission-planning`: formulario lógico de misión, origen/destino, `terrain_config`, estado de envío, `POST /api/missions/plan`, orquestación.
- `mars-map`: motor de mapa, capas, gestos/selección, coordenadas y sobreimpresión de trayectorias; **no** A*.
- `route-analysis`: presentación de rutas, métricas, perfiles y advertencias recibidas, sin recalcular científicamente.
- `science-targets`: consulta, selección, contexto y fuentes de objetivos científicos verificados.
- `offline-missions`: persistencia e inspección de paquetes previamente calculados; no crear rutas nuevas offline.
- `mission-reports`: exportación/resumen futuro; no bloquear MVP.

Las features solo importan de `shared/` o del `index.ts` público de otra feature cuando el acoplamiento esté justificado. Prohibido importar rutas internas profundas de otras features. Evitar dependencias circulares; si hay tipos realmente transversales, moverlos a un módulo de contratos acordado en `shared/types/` o generado de OpenAPI.

### 3.3 Límites de responsabilidad

- `app/`: rutas, layouts técnicos, metadatos, límites de error, ensamblaje; sin algoritmos de misión.
- `components/`: UI compartida sin llamadas directas a NASA/FastAPI.
- `features/`: lógica de presentación y servicios por caso de uso.
- `shared/api/`: `fetch` centralizado, timeouts/abort, errores, serialización, base URL.
- `shared/config/`: entorno y constantes no sensibles (no dimensiones de un DEM inventadas).
- `public/`: solo imágenes/cartografía con licencia, fuente y versión conocidas.

## 4. Contrato con FastAPI — fuente de verdad y compatibilidad

El backend tiene **autoridad** sobre valores científicos y contratos de dominio. Consumir la especificación OpenAPI de la persona 4 cuando esté disponible; generar tipos desde ella si es factible. Hasta entonces respetar el contrato provisional **existente en** `.CONTEXT/AGENTS.md` sección 4.6; no usar versiones antiguas o simplificadas de ejemplos del chat.

### 4.1 Endpoints relevantes

```text
GET  /api/health
GET  /api/system/info
GET  /api/data/regions
GET  /api/data/regions/{region_id}
GET  /api/data/regions/{region_id}/layers
GET  /api/missions/scientific-targets
POST /api/missions/plan
```

Rutas auxiliares de terrain/routing existen para depuración, pero el frontend prioriza `POST /api/missions/plan` como punto único de planificación. No enviar peticiones redundantes por cada componente si puede reutilizarse una respuesta.

### 4.2 Petición de misión: ejemplo de **estructura**, no de datos reales

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

**Todos los valores numéricos del ejemplo son sintéticos.** `row` y `col` son enteros de base cero, no latitud ni longitud. `max_slope_deg` es un **parámetro hipotético**, no un umbral de seguridad validado por NASA.

### 4.3 Respuesta de misión: ejemplo de **esquema**, no cálculo

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

**Nunca mostrar estas métricas `0.0` como resultados reales.** En producción la respuesta debe venir del motor y aportar las dos alternativas, o error/estado parcial documentado. Mantener nombres **`grid_path`, `route_id`, `ascent_m`, `limitations`, `coordinate_system: grid_row_col`**; no cambiarlos unilateralmente a `coordinates`, `elevation_gain_m`, `warnings` o `grid`.

### 4.4 Metadatos de raster y coordenadas (bloqueante para selección/dibujo)

Antes de conectar el mapa, acordar con la persona 1 y la persona 4:

1. Identificador de región y dimensiones `width`, `height` del raster válido.
2. Resoluciones de píxel y unidades físicas reales del sistema de coordenadas.
3. Transformación afín del raster o método de conversión ofrecido por API.
4. CRS planetario exacto y límites/área de cobertura; orientación y eje Y.
5. Máscara NoData, límites de selección y formato/CRS de la imagen que se dibujará.
6. Fuente científica, resolución, versión, licencia y URL del producto de cada capa.

**Selección:** evento del mapa → coordenadas de visualización → conversión explícita a `(row, col)` → validación de rango/NoData → solicitud a backend. **Dibujo:** `grid_path` → transformación inversa usando el *mismo* raster/CRS → polilínea. No confundir `x,y` con `row,col`, no aplicar Web Mercator terrestre por defecto, no extrapolar fuera del AOI, no redondear sin decisión técnica documentada. Si falta transformación fiable, deshabilitar selección por clic y usar entradas de cuadrícula validadas temporalmente.

### 4.5 HTTP, errores, cancelación y estados

- Entorno: `NEXT_PUBLIC_API_URL=http://localhost:8000` en `.env.example`; no versionar `.env.local`.
- CORS: la persona 4 habilita únicamente los orígenes necesarios (`http://localhost:3000`, URL de producción); el frontend no lo resuelve con `no-cors`.
- Cliente con `AbortSignal` para cancelar peticiones si cambian parámetros, región o navegación; prevenir resultados obsoletos sobrescribiendo otros más recientes.
- Errores previstos: HTTP 400 (solicitud), 404 (región/objetivo), 409/422 (`NO_PATH`/no datos compatibles), 422 (coordenadas), 503 (DTM no disponible). Mostrar mensaje orientado al usuario y permitir reintento cuando proceda.
- No exponer trazas ni datos internos. Tratar errores de red y respuestas con schema inválido por separado.
- Mostrar estados: `idle`, `selecting`, `loading`, `success`, `empty`, `error`, `offline_saved` cuando corresponda. No simular éxito.
- No volver a calcular métricas científicas en el browser. Se permiten conversiones de formato para UI (m a km) con unidad visible y redondeo solo para presentación.

### 4.6 Contratos/validación y ejemplos

- Validar petición antes de enviar y respuesta en el límite del cliente; preferir esquemas Zod y tipos inferidos o OpenAPI generado.
- Rechazar NaN, Infinity, números negativos donde no corresponda, índices no enteros, array de puntos vacío cuando se requiere ruta y unidades desconocidas.
- Mostrar `limitations`, `data_sources` y `methodology_version` como información disponible al usuario; no ocultar incertidumbre.
- Versionar fixtures sintéticos por contrato; establecer con P4 un ejemplo JSON real tan pronto exista la primera ejecución del backend.

## 5. Flujo MVP de extremo a extremo (sin decisiones visuales)

1. Cargar aplicación, consultar `/api/health` y `/api/data/regions`.
2. Cargar `jezero_demo`, metadatos, capas y referencias; si faltan, presentar estado informativo.
3. Elegir origen y destino únicamente dentro del área seleccionable.
4. Opcionalmente añadir IDs de objetivos científicos verificados.
5. Enviar una única petición `POST /api/missions/plan` (`mode=compare`) con parámetros válidos.
6. Validar respuesta; almacenar en estado de la feature sin modificar resultados.
7. Representar ambas rutas sobre el mismo sistema cartográfico y contrastar métricas y limitaciones.
8. Permitir revisar fuente científica y errores sin confundir datos simulados con observaciones.
9. Solo en fase posterior: guardar paquete offline y poder abrirlo desconectado.

**Criterio de aceptación:** una persona puede completar el flujo y explicar por qué las dos rutas difieren, de dónde vienen los datos y qué no garantiza la herramienta. Si no hay ruta, el producto debe mostrar un resultado honesto, no una línea ficticia.

## 6. Implementación progresiva y coordinación

### Fase A — Fundamentos
- Crear Next con pnpm; TS `strict`; lint, typecheck, tests básicos, alias `@/*`.
- Implementar HTTP client y configuración de entorno; fixtures de contrato con etiqueta synthetic.
- Añadir componentes compartidos mínimos, **sin asignar layout ni estilo definitivo**.
- Acordar con P4 los schemas y con P1 el contrato cartográfico.

### Fase B — Mapa y selección
- Cargar capa visual de Jezero cuya procedencia esté documentada.
- Implementar transformación entre mapa y cuadrícula, pruebas con puntos conocidos, límites NoData.
- Permitir seleccionar origen/destino con control de estados y accesibilidad alternativa al clic.

### Fase C — Conexión de planificación
- Conectar `POST /api/missions/plan`, loading/error/abort, validación de payload.
- Dibujar rutas devueltas y comparar sus métricas; pasar de fixtures a un backend real.
- Probar al menos tres puntos de control del mapa y dos peticiones con distinto terreno/criterio.

### Fase D — Contexto científico
- Integrar objetivos verificados y referencias NASA.
- Añadir información de dataset y limitaciones científicas.

### Fase E — PWA y Offline Mission Pack (si el MVP funciona)
- Manifest e instalación en un origen HTTPS (localhost en desarrollo).
- Guardar paquetes completos y consultarlos offline; sin rutas nuevas offline.
- Comprobar que los mapas/fuentes que requiere la misión **realmente están en caché**.

### Fase F — Entrega
- `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm build`, `pnpm test:e2e` (si configurado).
- E2E con backend real, comprobación de despliegue público sin login y demo reproducible.
- Documentar licencias, datos NASA, asistencia de IA, versiones y limitaciones.

**Regla de prioridad:** si el backend y su mapa aún no están integrados, no emplear tiempo en animaciones, instalación PWA, exportación ni interfaces alternativas.

## 7. PWA / Offline Mission Pack: contrato previsto, no implementado

**Objetivo:** misión calculada online → usuario la guarda → navegador desconectado → misión y mapa precargados siguen disponibles para consulta. No afirmar capacidad de navegación autónoma en Marte ni recálculo sin conexión.

**Contenido mínimo del paquete:**
- `package_id`, `schema_version`, `saved_at`, región e `id` de misión.
- Request original, rutas completas, métricas, objetivos y `limitations`.
- `data_sources`, `methodology_version`, referencia de capas y versión de dataset.
- Recursos de mapa necesarios (teselas/imágenes) cacheados con el mismo CRS/extensión, o un mapa estático georreferenciado apto para uso offline.
- Información clara de disponibilidad, tamaño y fecha de los datos. Diferenciar *contenido guardado* de *condiciones actuales*.

**Persistencia:** IndexedDB para metadatos y paquetes JSON; Cache Storage para recursos servibles por service worker. Manejar `QuotaExceededError`, versiones de esquema, duplicados, integridad del paquete y posibilidad de borrar/actualizar.

**Comportamiento requerido:**
- `Save for Offline` solo confirma éxito después de persistir datos y recursos críticos.
- Al estar offline, no llamar a FastAPI esperando éxito; acceder al paquete local.
- Si falta una tesela/imagen, mostrar estado explícito, no una base cartográfica engañosa.
- No cachear indiscriminadamente todos los datos de Mars Trek; respetar términos de acceso y límites de almacenamiento.
- Probar desconexión real con DevTools/Playwright, recargar desde cero y reabrir misión guardada.

**No implementar service worker con caché general indiscriminada de respuestas de API**, especialmente si el contenido puede estar incompleto o desactualizado. Definir estrategia por tipo de recurso.

## 8. Pruebas por feature y criterios de aceptación

### 8.1 Shared UI / Atomic Design
- RTL: `Button` accesible por teclado, disabled y loading; controles con etiquetas legibles.
- Pruebas de props, mensajes, foco visible, ausencia de dependencias a servicios.
- Evitar snapshots gigantes de estilos no aprobados.

### 8.2 `mars-map`
- Unitarias: `grid ↔ map` con transformación conocida; ida y vuelta sin desplazamiento sistemático.
- Bordes: fuera de AOI, celda negativa, NoData, rotación/escala y orientación de filas.
- Integración: ruta `[row,col]` cae sobre píxeles correctos; al menos tres puntos de control respaldados por metadatos.
- Error: sin CRS compatible o sin raster, no fingir que el mapa es georreferenciado.

### 8.3 `mission-planning`
- Validar índices enteros y dentro de región, presencia de origen/destino y selección de modo.
- `AbortController`: cambiar destino mientras hay una solicitud pendiente no debe mostrar ruta vieja.
- Petición: body JSON coincide **exactamente** con sección 4.2; respuesta inválida es error, no estado exitoso.
- Error de red y `NO_PATH` no deben producir polilíneas artificiales.

### 8.4 `route-analysis`
- Con fixtures: las dos rutas se distinguen por `route_id` sin asumir que siempre cambia el coste.
- Distancias en metros o convertidas visiblemente a kilómetros; pendientes en grados.
- No tratar `cost` como distancia ni `max_slope_deg` como seguridad operacional.
- Soportar respuesta con una sola alternativa/error parcial si el backend lo documenta.
- Mostrar limitaciones y procedencia en un lugar accesible (posición visual se decide después).

### 8.5 `science-targets`
- Objetivo referenciado existe; imagen y fuente corresponden al mismo lugar y misión.
- No georreferenciar automáticamente fotos de rover sin metadatos.
- Selecciones inválidas o objetivos fuera del AOI provocan mensajes claros.

### 8.6 `offline-missions` (fase posterior)
- Guardar → desconectar → recargar → abrir paquete completo sin red.
- Test de integridad de capas, limpieza de caché y datos expirados/incompletos.
- Fallo de cuota, archivo ausente o versión incompatible produce error explícito.

### 8.7 Pruebas E2E críticas
1. Iniciar con backend y datasets disponibles, seleccionar dos puntos válidos.
2. Enviar planificación, confirmar una llamada correcta a `POST /api/missions/plan`.
3. Visualizar las dos rutas retornadas y sus métricas sin valores hardcodeados.
4. Probar región sin datos / `NO_PATH` / backend desconectado.
5. Probar navegación por teclado en los controles principales.
6. En fase PWA, instalar/guardar/reabrir offline.

**Matriz de prueba:** navegador Chromium obligatorio; Firefox/WebKit si hay tiempo y compatibilidad. Resolución móvil/tablet/escritorio se evaluará una vez se apruebe la estrategia visual; la funcionalidad no dependerá de hover.

## 9. Trabajo en paralelo, Git y PRs

Ramas sugeridas (frontend):
- `feature/frontend-foundation`: configuración, scripts, UI compartida mínima.
- `feature/frontend-mars-map`: mapa, sistema de coordenadas y selección.
- `feature/frontend-mission-planning`: form/request y orquestación.
- `feature/frontend-route-analysis`: rutas, métricas y estados.
- `feature/frontend-science-targets`: puntos científicos.
- `feature/frontend-offline-missions`: PWA/offline (solo tras MVP).

**Reglas:**
1. Una feature por PR; no editar masivamente features ajenas.
2. `src/app/page.tsx` y configuración compartida tienen responsable de integración; cambios coordinados.
3. No agregar librerías duplicadas para el mismo problema.
4. Actualizar `pnpm-lock.yaml` cuando cambien dependencias.
5. PR debe indicar: qué cambia, contrato afectado, cómo probar (`pnpm ...`), datos de fixture vs. reales, capturas solo cuando exista UI aprobada.
6. Nunca romper el proyecto para cambiar nombres internos del backend; abrir coordinación con P4 y documentar decisión.
7. Commits en inglés, claros y concretos, por ejemplo `feat(frontend): add typed mission planning client`.
8. Si se usa IA para desarrollar, revisar manualmente el código y registrar su asistencia para la entrega.

### Checklist antes de merge

- [ ] Compila y typecheck correcto.
- [ ] `pnpm lint` y pruebas correspondientes pasan.
- [ ] Schemas coinciden con OpenAPI/acuerdo vigente.
- [ ] No hay coordenadas, tamaños de raster ni datos NASA hardcodeados como hechos.
- [ ] Estados de error/vacío/loading están cubiertos.
- [ ] No hay datos científicos inventados en runtime.
- [ ] No contiene credenciales ni dependencias de servicios privados para la demo.
- [ ] README/documentación actualizados si cambió comportamiento.

## 10. Seguridad, accesibilidad, rendimiento y despliegue

- No almacenar credenciales de NASA ni tokens privados en `NEXT_PUBLIC_*`; usar un backend intermediario autorizado cuando haga falta.
- Controlar tamaño de raster/mapa para no cargar GeoTIFFs enormes directamente al navegador; servir imágenes/teselas adaptadas con metadatos.
- Evitar renderizar miles de puntos como nodos DOM: usar capas vectoriales del mapa y simplificación **solo visual** sin modificar cálculos científicos.
- Manejar latencia con indicadores, cancelación y mensajes útiles; evitar refrescar todas las capas ante cada cambio.
- Proveer textos de ayuda y equivalentes por teclado para controles de mapa; considerar usuarios con visión reducida y no codificar información exclusivamente por color.
- Documentar términos/licencias y atribuciones visibles de NASA/USGS sin sugerir patrocinio o aval de NASA.
- Ejecutar build de producción, verificar URL pública, HTTPS, llamadas a FastAPI y CORS real; no depender de localhost para la demo.
- La demo debe funcionar sin login o secretos requeridos por el evaluador; datos ya preparados o endpoints públicos operativos.

## 11. Riesgos y decisiones pendientes

**Confirmado:** Jezero; Next.js/React/TypeScript; Tailwind; pnpm; Atomic Design + Features; FastAPI REST; análisis de dos rutas; PWA/offline como extensión.

**Pendiente de confirmar con el backend:**
- Sector concreto de Jezero, ID real, extensión geográfica, raster/capa de referencia, CRS y transformación.
- Contrato OpenAPI definitivo de regiones/capas/objetivos; respuesta real de `/api/missions/plan` y casos de error.
- Disponibilidad de rutas y perfiles de elevación; procedencia y unidades exactas.
- URL de imagen/cartografía servida al frontend y permisos de almacenamiento/caché.

**Pendiente de decisión de producto (NO implementar sin consenso):**
- Layout, distribución de componentes, navegación, flujo exacto entre pantallas.
- Colores, tipografías, iconografía final, estética, componentes visuales avanzados.
- Si la PWA presentará una segunda vista para consulta offline y cómo se navegará a ella.

**Regla de cambio:** documentar una decisión de arquitectura en este archivo y, si afecta al backend, actualizar también `.CONTEXT/AGENTS.md` tras acuerdo. No completar huecos mediante supuestos silenciosos.

## 12. Entrega de MVP: definición de terminado

La entrega frontend queda lista cuando:

- [ ] El proyecto arranca con `pnpm install --frozen-lockfile && pnpm build`.
- [ ] Puede consultar los metadatos reales del sector de Jezero y sus fuentes.
- [ ] Captura origen y destino en el marco de coordenadas correcto.
- [ ] Ejecuta `POST /api/missions/plan` contra FastAPI real.
- [ ] Presenta las rutas reales devueltas, sus métricas y las limitaciones sin alterar resultados.
- [ ] Gestiona errores, `NO_PATH`, dataset no disponible y resultados vacíos.
- [ ] Tiene pruebas para transformación espacial y contrato de misiones.
- [ ] Está desplegado en URL accesible públicamente para el jurado.
- [ ] Está documentado el origen de recursos NASA/USGS y el carácter no operacional del prototipo.
- [ ] Si se anuncia PWA/offline: la instalación y una misión guardada pasan la prueba real sin red; de lo contrario, describirlo solo como función futura.

**Prioridad de las próximas horas:** cerrar el contrato y los metadatos cartográficos con backend, implementar mapa y cliente de misiones con fixtures explícitos, integrar una misión real y solo entonces invertir tiempo en PWA y presentación visual.

---

## 13. Resumen para un agente que se incorpore

> Se trabaja en el **frontend** de ARES PATH, prototipo NASA Space Apps Challenge 2026 para planificar caminatas científicas en **Jezero, Marte**. Stack acordado: Next.js App Router, React, TypeScript estricto, Tailwind, OpenLayers candidato, **pnpm**, Atomic Design únicamente para UI común y organización por features para lógica de producto. Backend: FastAPI, contrato actual en `.CONTEXT/AGENTS.md`, especialmente sección 4.6 (`grid_row_col`, `grid_path`, `POST /api/missions/plan`, dos rutas y métricas). No inventar datos científicos ni calcular rutas en el navegador. PWA y Offline Mission Pack están previstos como fase posterior, para consultar misiones precalculadas sin red. **No existe todavía una decisión sobre layout o diseño visual**: no proponer ni implementar estructura visual sin una instrucción nueva. Ante incertidumbre de coordenadas, datasets, URLs o contrato: detener esa integración concreta, usar fixtures etiquetados en pruebas y coordinar con el responsable del backend.
