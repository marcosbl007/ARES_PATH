# ARES PATH — Guía de despliegue con Vercel + Render

**Tipo:** guía operativa de despliegue
**Arquitectura recomendada:** Vercel para el frontend y Render para el backend
**Estado:** preparada para el prototipo/demo actual; revisar los límites antes de producción
**Fecha:** 2026-11-15

Esta guía explica cómo publicar ARES PATH sin cambiar la arquitectura actual:

- Frontend Next.js en Vercel.
- Backend FastAPI + Rasterio en un contenedor Docker sobre Render.
- GeoTIFF y metadatos procesados incluidos en la imagen del backend.
- PWA servida desde Vercel mediante HTTPS.
- Mission Packs guardados en el navegador para consulta offline.

La guía no crea servicios, no configura cuentas y no hace commits. Es el procedimiento para que el equipo lo ejecute de forma repetible.

## 1. Arquitectura recomendada

    Navegador
       |
       | HTTPS
       v
    Vercel
    Next.js + OpenLayers + PWA
       |
       | NEXT_PUBLIC_API_URL
       v
    Render
    FastAPI + Rasterio + routing
       |
       v
    /app/data/processed
    GeoTIFF + JSON versionados en el contenedor

La separación es intencional:

- Vercel resuelve el build, CDN, HTTPS y entrega del frontend.
- Render ejecuta el proceso Python que lee GeoTIFF y calcula respuestas geoespaciales.
- El navegador recibe metadatos, previews, rutas y perfiles desde la API.
- El modo offline consulta Mission Packs que ya fueron guardados en el navegador.

Para el estado actual no es necesario agregar GCP o Azure. Conviene mantener Vercel + Render mientras los datasets procesados caben en la imagen y el equipo necesita una demo reproducible. GCP Cloud Run, Azure Container Apps o almacenamiento de objetos son opciones de evolución, no requisitos para publicar el prototipo.

### 1.1 Qué debe funcionar después del despliegue

La demo publicada debe permitir:

1. Abrir el mapa principal.
2. Consultar el estado de la API.
3. Listar y seleccionar un dataset regional.
4. Leer metadata, CRS, extent, shape y transform.
5. Cargar la ortoimagen y elevación del dataset activo.
6. Ajustar el área de análisis dentro del dataset.
7. Seleccionar origen y destino válidos.
8. Solicitar dos rutas: shortest y terrain_aware.
9. Ver mensajes explicativos cuando una ruta no sea válida.
10. Ver el perfil de elevación y la comparación.
11. Guardar un Mission Pack.
12. Exportar/importar el JSON del Mission Pack.
13. Volver a abrir el pack en modo offline.
14. Ver el botón de instalación de la PWA cuando el navegador exponga el prompt instalable.

### 1.2 Límites actuales del modo offline

Offline no significa que el navegador pueda recalcular cualquier ruta sin conexión. El comportamiento esperado es:

- Sí: consultar Mission Packs guardados localmente.
- Sí: abrir el shell de la aplicación y sus recursos cacheados.
- Sí: importar un pack JSON que ya contenga los datos de la misión.
- No: descargar una región nueva desde NASA sin red.
- No: pedir una ruta nueva al backend sin red.
- No: cargar un GeoTIFF completo nuevo si nunca se guardó o cacheó.
- No: garantizar que los WMTS remotos funcionen offline.

La interfaz debe comunicar claramente si el usuario está en modo offline y si está consultando datos almacenados o intentando una operación que requiere API.

## 2. Requisitos previos

Instala o confirma lo siguiente en el equipo de desarrollo:

- Repositorio remoto accesible desde GitHub.
- Rama de trabajo actualizada desde develop.
- Node.js LTS compatible con el frontend.
- pnpm habilitado.
- Python 3.12 recomendado para el backend.
- Docker Desktop iniciado para probar la imagen.
- Cuenta de Vercel.
- Cuenta de Render.
- Acceso a configurar variables de entorno en ambos servicios.
- Los GeoTIFF procesados y sus JSON dentro de backend/data/processed.

No subas secretos al repositorio:

- No subas backend/.env.
- No subas frontend/.env.local.
- No pongas claves privadas en variables NEXT_PUBLIC_*.
- No pongas tokens de NASA en el código.
- Revisa el diff antes de publicar.

## 3. Preparar el repositorio

Ejecuta desde la raíz del proyecto:

    git switch develop
    git pull origin develop
    git status

El árbol de trabajo debe estar limpio o los cambios locales deben estar identificados antes de empezar.

### 3.1 Validar el backend localmente

    cd backend
    & ./.venv/Scripts/Activate.ps1
    python -m pytest -q

Si no existe el entorno virtual en Windows PowerShell:

    py -3.12 -m venv .venv
    & ./.venv/Scripts/Activate.ps1
    python -m pip install -e ".[dev]"

Comprueba que los datos procesados existan:

    Get-ChildItem ./data/processed
    Get-ChildItem ./data/processed -Filter *.tif

No uses comandos de PowerShell en Git Bash. En Git Bash equivalentes:

    test -f data/processed/jezero_fan_256_elevation.tif
    ls -lah data/processed

### 3.2 Validar el frontend localmente

Desde otra terminal:

    cd frontend
    pnpm install --frozen-lockfile
    pnpm lint
    pnpm typecheck
    pnpm test:run
    pnpm build

Antes de producción, corrige errores de lint, tipos, pruebas y build. Los warnings de desarrollo de Next.js no sustituyen estas comprobaciones.

## 4. Preparar el backend para Render

La configuración recomendada es construir una imagen Docker con:

- El código de app.
- Las dependencias Python.
- Los GeoTIFF de backend/data/processed.
- Los JSON de metadata.
- Ningún archivo de backend/data/raw que no sea necesario para ejecutar la API.

### 4.1 Crear backend/Dockerfile

Crea backend/Dockerfile con este contenido:

    FROM python:3.12-slim

    ENV PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1 \
        PIP_NO_CACHE_DIR=1 \
        ARES_DATA_ROOT=/app/data \
        PORT=8000

    WORKDIR /app

    COPY pyproject.toml ./
    COPY app ./app
    COPY data/processed ./data/processed

    RUN python -m pip install --upgrade pip \
        && python -m pip install .

    EXPOSE 8000

    CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port $PORT"]

La variable PORT permite que Render indique el puerto del servicio. El valor 8000 es el fallback local.

Si el pyproject necesita archivos adicionales para instalar el paquete, inclúyelos en la imagen. No copies todo el repositorio a ciegas: evita incluir .venv, caches, tests innecesarios y data/raw.

### 4.2 Crear backend/.dockerignore

Crea backend/.dockerignore:

    .venv/
    .pytest_cache/
    .pytest-tmp/
    __pycache__/
    *.py[cod]
    tests/
    tmp/
    temp/
    data/raw/
    *.log

No ignores data/processed en Docker. Esos GeoTIFF son parte de la fuente local requerida por la API.

### 4.3 Probar la imagen localmente

Desde la raíz:

    docker build -t ares-path-api:local ./backend

Inicia el contenedor:

    docker run --rm -p 8000:8000 -e PORT=8000 ares-path-api:local

En otra terminal, valida:

    Invoke-RestMethod http://localhost:8000/api/health
    Invoke-RestMethod http://localhost:8000/api/data/regions

Si el endpoint real de health del proyecto cambia, usa el endpoint documentado por backend/app/main.py y conserva el mismo path en Render.

También puedes abrir:

    http://localhost:8000/docs

La imagen debe arrancar sin depender de una ruta de Windows ni de un .env local.

## 5. Crear el Web Service en Render

En Render:

1. Selecciona New.
2. Selecciona Web Service.
3. Conecta el repositorio de GitHub.
4. Selecciona la rama que se desplegará, normalmente develop para demo o main para una versión estable.
5. Define Root Directory como backend.
6. Selecciona Docker como Runtime.
7. Usa Dockerfile Path: Dockerfile.
8. Define el health check path: /api/health.
9. Activa Auto-Deploy solo si quieren desplegar automáticamente cada push.
10. Crea el servicio y espera el primer build.
11. Copia la URL HTTPS pública, por ejemplo https://ares-path-api.onrender.com.

Si Render solicita un puerto explícito, usa 8000. El proceso debe escuchar en 0.0.0.0, nunca solamente en 127.0.0.1.

### 5.1 Variables de entorno de Render

Configura estas variables en Render:

    ARES_DATA_ROOT=/app/data
    ARES_CORS_ORIGINS=https://ares-path.vercel.app

Sustituye https://ares-path.vercel.app por el dominio real de Vercel. Si habrá dominio propio, añade ambos orígenes separados por coma:

    ARES_CORS_ORIGINS=https://ares-path.vercel.app,https://app.ejemplo.com

Para pruebas locales temporales:

    ARES_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

Reglas:

- No pongas una barra final en el origen.
- No uses * en producción si la API procesa datos de misión.
- Si cambias CORS, reinicia o redeploya el servicio.
- Si agregas un dominio preview de Vercel, agrégalo solo cuando sea necesario.
- No mezcles la URL de la API dentro de ARES_CORS_ORIGINS.

### 5.2 Verificar el backend publicado

    $ApiUrl = "https://ares-path-api.onrender.com"

    Invoke-RestMethod "$ApiUrl/api/health"
    Invoke-RestMethod "$ApiUrl/api/system/info"
    Invoke-RestMethod "$ApiUrl/api/data/regions"

Revisa también:

    https://ares-path-api.onrender.com/docs

La respuesta debe ser HTTPS, contener JSON válido y listar los datasets que realmente están dentro de la imagen.

### 5.3 Persistencia de archivos en Render

El filesystem normal de un servicio Render es efímero. Por eso:

- No guardes el catálogo fuente o GeoTIFF nuevos dentro del contenedor durante una petición esperando que sobrevivan a un redeploy.
- Los GeoTIFF de la demo deben ir versionados y copiarse durante el Docker build.
- No uses un disco persistente como sustituto de un sistema de versionado.
- Si los datos crecen mucho, usa almacenamiento de objetos y un catálogo versionado.
- Un Persistent Disk de Render es una opción posterior y tiene coste, límites y disponibilidad propios.
- Mission Packs de usuario siguen viviendo en el navegador; no dependen del filesystem de Render.

## 6. Crear el proyecto de frontend en Vercel

En Vercel:

1. Selecciona Add New Project.
2. Importa el repositorio de GitHub.
3. Elige la rama que se publicará.
4. Define Root Directory como frontend.
5. Confirma Framework Preset: Next.js.
6. Usa el gestor pnpm.
7. Usa Install Command: pnpm install --frozen-lockfile.
8. Usa Build Command: pnpm build.
9. Deja el Output Directory con el valor por defecto de Next.js.
10. Selecciona una versión Node LTS compatible con package.json.
11. Crea el proyecto.

### 6.1 Variable de entorno de Vercel

Configura en Production y, si se desea probar previews, también en Preview:

    NEXT_PUBLIC_API_URL=https://ares-path-api.onrender.com

La URL debe ser la URL pública real del backend Render. No pongas localhost en producción.

Después de cambiar una variable NEXT_PUBLIC_*, crea un nuevo deployment. Estas variables se incorporan durante el build del frontend.

### 6.2 Verificar el frontend publicado

Abre el dominio de Vercel, por ejemplo:

    https://ares-path.vercel.app

Comprueba:

- La página carga sin error de hidratación.
- El encabezado muestra API / ONLINE cuando Render responde.
- El selector lista las regiones.
- La imagen del dataset activo está alineada.
- El botón Plan mission obtiene respuesta.
- No aparece un error CORS en DevTools.
- El manifest.webmanifest responde HTTP 200.
- Los iconos de la PWA responden HTTP 200.
- El Service Worker responde en la ruta que usa la aplicación.

Si el frontend sigue apuntando a localhost, revisa la variable en el proyecto correcto de Vercel y vuelve a desplegar.

## 7. Orden recomendado de publicación

Usa este orden para reducir diagnósticos ambiguos:

1. Ejecuta las pruebas del backend local.
2. Construye y ejecuta la imagen Docker local.
3. Verifica /api/health y /api/data/regions localmente.
4. Publica el Web Service en Render.
5. Verifica Render desde una terminal externa.
6. Configura CORS con el dominio de Vercel.
7. Publica el frontend en Vercel.
8. Configura NEXT_PUBLIC_API_URL.
9. Redeploya Vercel.
10. Ejecuta el smoke test desde el navegador y guarda un Mission Pack.

No intentes arreglar un error de frontend antes de confirmar que el backend público responde directamente.

## 8. Smoke test del backend publicado

### 8.1 Health y CORS

En PowerShell:

    $ApiUrl = "https://ares-path-api.onrender.com"
    $FrontendOrigin = "https://ares-path.vercel.app"
    curl.exe -i -H "Origin: $FrontendOrigin" "$ApiUrl/api/health"

La respuesta debe incluir 200 y un header Access-Control-Allow-Origin compatible con el dominio del frontend.

### 8.2 Catálogo y metadata

    $Regions = Invoke-RestMethod "$ApiUrl/api/data/regions"
    $Regions

Selecciona un region_id que aparezca en esa respuesta. No inventes el identificador en el frontend.

Consulta metadata usando la ruta documentada por la API, por ejemplo:

    Invoke-RestMethod "$ApiUrl/api/data/regions/<REGION_ID>"

Valida en la respuesta:

- elevation.tif presente.
- orthoimage.tif presente.
- CRS consistente.
- transform consistente.
- shape consistente.
- bounds/extent consistente.
- tamaño y resolución coherentes.
- dataset activo identificado sin duplicados.

### 8.3 Previews o tiles

Usa las rutas reales de la API documentadas en backend/app/main.py. Una forma genérica de comprobar una imagen es:

    Invoke-WebRequest "$ApiUrl/api/data/regions/<REGION_ID>/preview.png" -OutFile ./preview.png

Si la aplicación usa tiles en vez de preview.png, comprueba una URL de tile válida desde Network del navegador. La respuesta no debe ser un HTML de error disfrazado de imagen.

### 8.4 Misión válida

Usa puntos que estén dentro del dataset y dentro del analysis_window inicial. Ejemplo de estructura:

    $Body = @{
      region_id = "jezero_fan_256"
      coordinate_system = "grid_row_col"
      start = @{
        row = 10
        col = 20
      }
      destination = @{
        row = 80
        col = 65
      }
      mode = "compare"
      terrain_config = @{
        max_slope_deg = 20.0
        slope_weight = 2.0
      }
      scientific_target_ids = @()
    } | ConvertTo-Json -Depth 6

    Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/missions/plan" -ContentType "application/json" -Body $Body

La respuesta válida debe contener las dos alternativas esperadas:

- shortest.
- terrain_aware.

Si los nombres de ruta o la estructura exacta del body difieren, usa el contrato vigente de backend/docs y actualiza este ejemplo junto con el código.

### 8.5 Puntos inválidos

Prueba al menos:

- fila o columna fuera de bounds;
- punto fuera del analysis_window;
- celda sin elevación;
- pendiente superior a max_slope_deg;
- origen igual a destino si el contrato lo rechaza;
- región inexistente.

La API debe devolver un error estructurado con:

- code;
- message humano;
- reason;
- affected point;
- suggestion.

La interfaz debe mostrar el mensaje útil. No debe enseñar únicamente NO_PATH al usuario.

## 9. Smoke test del frontend y PWA

En la aplicación publicada:

1. Abre DevTools y confirma que no hay errores rojos.
2. Confirma que la llamada a /api/health usa el dominio Render.
3. Selecciona una región.
4. Mueve o redimensiona el ROI dentro del dataset.
5. Selecciona origen y destino válidos.
6. Pulsa Plan mission.
7. Comprueba shortest y terrain_aware.
8. Guarda el Mission Pack.
9. Exporta el JSON.
10. Importa el mismo JSON.
11. Cambia a Offline.
12. Recarga la página.
13. Abre el Mission Pack guardado.
14. Confirma que el contenido se consulta sin llamar al endpoint de planificación.
15. Reconecta y comprueba que el indicador vuelve a API / ONLINE.

### 9.1 Instalación de la PWA

Para que el navegador permita instalar ARES PATH:

- La aplicación debe servirse por HTTPS; localhost es la excepción para desarrollo.
- manifest.webmanifest debe responder 200.
- El manifest debe tener name o short_name, start_url, display e iconos válidos.
- Los iconos deben responder 200 y tener tamaños/mime types coherentes.
- El Service Worker debe registrarse y no fallar.
- El navegador debe soportar instalación.
- La aplicación no debe estar instalada ya bajo el mismo perfil.
- El usuario puede estar en una ventana incógnito o en un navegador que no expone beforeinstallprompt.

El evento beforeinstallprompt no se muestra siempre. El botón Install App debe:

- estar deshabilitado u oculto cuando el prompt no está disponible;
- guardar el evento cuando el navegador lo entregue;
- llamar prompt() solo después de una acción del usuario;
- manejar accepted y dismissed;
- no mostrar una instrucción falsa como única acción;
- ofrecer instrucciones manuales solo como fallback claramente etiquetado.

Para probarlo, usa una pestaña normal de Chrome/Edge en HTTPS, borra la instalación anterior si existe, recarga y revisa Application > Manifest y Application > Service Workers.
+
## 10. Seguridad, datos y responsabilidad

Antes de anunciar una URL como pública:

- Mantén HTTPS activado en Vercel y Render.
- Usa CORS restringido al dominio real del frontend.
- No expongas rutas internas del filesystem.
- No publiques backend/data/raw si no es necesario.
- No presentes datos sintéticos como datos científicos reales.
- Conserva la atribución de NASA, JPL y USGS cuando corresponda.
- Indica que ARES PATH es un prototipo de planificación y no un sistema operacional EVA.
- Mantén visible la procedencia del dataset activo.
- Revisa la licencia y condiciones de cada fuente externa.
- No guardes información personal del usuario en Mission Packs sin avisarlo.
- No pongas claves, tokens o credenciales en el frontend.

Los WMTS de NASA deben ser opcionales. Si una capa remota no comparte CRS, transform, extent y resolución con el raster local, debe permanecer desactivada por defecto para no volver a crear bloques desplazados.

## 11. Rendimiento y límites que deben vigilarse

### 11.1 Render

Render puede tener cold starts o suspensión según el plan. Para una demo:

- Muestra un estado de conexión mientras la API despierta.
- Usa timeout y mensajes de reintento en el frontend.
- No declares API / ONLINE hasta recibir una respuesta válida.
- Revisa los logs del servicio si el contenedor reinicia.
- No calcules mosaicos enormes durante una petición interactiva.

### 11.2 Tamaño de la imagen

Cada GeoTIFF incluido en Docker aumenta:

- tiempo de build;
- tiempo de subida;
- tiempo de despliegue;
- espacio de la imagen;
- tiempo de arranque y memoria disponible.

Antes de agregar más regiones:

1. Mide el tamaño de cada TIFF.
2. Comprueba que elevation y orthoimage compartan metadata.
3. Decide qué regiones son obligatorias para la demo.
4. Mantén un catálogo con versión y checksum.
5. Considera object storage cuando el conjunto crezca.

### 11.3 Vercel

- Las variables NEXT_PUBLIC_* se consumen en el build.
- Un cambio de variable requiere un nuevo deployment.
- No uses Vercel como servidor para el proceso Rasterio.
- El frontend debe pedir a la API solo el tamaño de respuesta necesario.
- No intentes transferir un GeoTIFF completo al navegador para cada interacción.

## 12. Diagnóstico rápido

### El frontend muestra API / OFFLINE

1. Abre Network.
2. Comprueba el valor de NEXT_PUBLIC_API_URL en el deployment.
3. Abre directamente la URL de Render.
4. Revisa que Render esté escuchando en 0.0.0.0.
5. Revisa CORS.
6. Reinicia Render si cambiaste variables.
7. Redeploya Vercel si cambiaste NEXT_PUBLIC_API_URL.

### Error CORS

Confirma que el origen del navegador coincide exactamente:

    https://ares-path.vercel.app

No confundas:

- http con https;
- dominio preview con dominio production;
- localhost con la URL pública;
- una URL con barra final con una URL sin barra final.

### Render devuelve 502 o no inicia

Comprueba:

- Dockerfile en el Root Directory correcto.
- pyproject.toml copiado.
- app copiada.
- data/processed copiada.
- dependencia uvicorn instalada.
- PORT usado por el proceso.
- host 0.0.0.0.
- endpoint de health correcto.
- logs de build y runtime.

### La API devuelve un catálogo vacío

Comprueba:

- ARES_DATA_ROOT=/app/data.
- En la imagen existe /app/data/processed.
- Los TIFF no fueron excluidos por .dockerignore.
- Los nombres de archivos cumplen el patrón del repository.
- El build realmente usó el commit que contiene los datos.
- El endpoint /api/data/regions no está leyendo una ruta local de Windows.

### La ruta devuelve NO_PATH

Primero valida el punto, no cambies silenciosamente sus coordenadas:

- region_id correcto;
- fila y columna dentro del dataset;
- punto dentro del analysis_window;
- elevación no nula;
- pendiente menor o igual al límite;
- componente traversable conectada.

Si los puntos son válidos pero la componente no conecta ambos extremos, muestra al usuario la sugerencia de acercar puntos o ampliar el área. El backend debe conservar el código estructurado y el frontend debe mostrar el mensaje humano.

### El botón Install App no aparece

Puede ser normal si:

- la aplicación ya está instalada;
- el navegador no soporta el evento;
- la página está en HTTP fuera de localhost;
- el manifest o los iconos fallan;
- el Service Worker no está activo;
- el navegador todavía no considera la app instalable.

No conviertas el botón en una descarga falsa. Si no hay prompt nativo, presenta una instrucción manual separada y claramente marcada.

### El mapa vuelve a mostrar bloques desplazados

- Desactiva WMTS remotos.
- Deja elevation y orthoimage locales como capas principales.
- Limpia las fuentes y capas al cambiar de región.
- Recalcula extent y centro usando solo el dataset activo.
- Comprueba que orthoimage y elevation compartan CRS, transform y shape.
- No reutilices el extent de una región anterior.
- No uses imágenes hardcodeadas.

## 13. Rollback

### 13.1 Vercel

En el proyecto de Vercel:

1. Abre Deployments.
2. Selecciona el último deployment estable.
3. Promuévelo como producción usando la opción de rollback.
4. Verifica la URL y la variable NEXT_PUBLIC_API_URL.
5. Repite el smoke test.

### 13.2 Render

En Render:

1. Abre Events o Deploys.
2. Identifica el último deploy estable.
3. Revisa si el proveedor permite redeploy desde ese commit.
4. Si no, revierte el commit en una rama de reparación y despliega esa rama.
5. Comprueba /api/health, /api/data/regions y /docs.
6. Comprueba que Vercel siga usando la URL correcta.

Nunca hagas un reset destructivo del repositorio para resolver un rollback. Usa el historial y una reversión revisable.

## 14. Evolución futura: GCP o Azure

Vercel + Render es suficiente para la demo actual. Considera migrar cuando aparezca alguno de estos casos:

- muchos más GeoTIFF o mosaicos;
- descargas concurrentes altas;
- necesidad de trabajos asíncronos de mosaico;
- almacenamiento versionado de decenas o cientos de GB;
- autenticación, IAM, auditoría o redes privadas;
- métricas y alertas empresariales;
- presupuesto para una arquitectura administrada más compleja.

### 14.1 Alternativa GCP

    Navegador
       |
       v
    Vercel
       |
       v
    Cloud Run: FastAPI + Rasterio
       |
       v
    Cloud Storage: GeoTIFF, COG, metadata y Mission Pack catalog

Cloud Run encaja si se quiere ejecutar el mismo contenedor con escala automática. Cloud Storage encaja mejor que guardar muchos TIFF dentro de la imagen. El repository deberá evolucionar para leer objetos, cachearlos y validar checksums. No migres solo por tener un proveedor más grande: agrega complejidad de IAM, regiones, facturación y observabilidad.

### 14.2 Alternativa Azure

    Navegador
       |
       v
    Vercel o Static Web Apps
       |
       v
    Container Apps: FastAPI + Rasterio
       |
       v
    Blob Storage: GeoTIFF, COG y metadata

Azure Container Apps puede ejecutar el contenedor del backend y Blob Storage puede alojar datasets grandes. Azure Static Web Apps no es obligatorio si ya se usa Vercel; la elección debe basarse en el equipo, presupuesto y necesidades de integración.

## 15. Checklist final antes de compartir la URL

### Backend

- [ ] Render construye la imagen sin errores.
- [ ] El proceso escucha en 0.0.0.0.
- [ ] PORT se respeta.
- [ ] ARES_DATA_ROOT apunta a /app/data.
- [ ] ARES_CORS_ORIGINS contiene solo orígenes necesarios.
- [ ] /api/health responde 200.
- [ ] /api/data/regions devuelve los datasets esperados.
- [ ] Cada región tiene elevation.tif y orthoimage.tif.
- [ ] Metadata, CRS, transform, shape y extent son coherentes.
- [ ] La ruta válida devuelve shortest y terrain_aware.
- [ ] Los errores de puntos inválidos son estructurados.
- [ ] No hay secretos ni rutas locales de Windows en producción.

### Frontend

- [ ] Vercel usa Root Directory frontend.
- [ ] NEXT_PUBLIC_API_URL apunta a Render.
- [ ] El build termina sin errores.
- [ ] No hay error de hidratación.
- [ ] El mapa usa el dataset regional activo.
- [ ] Las capas remotas no alineadas están apagadas por defecto.
- [ ] Plan mission funciona con puntos de ejemplo válidos.
- [ ] El mensaje de error de NO_PATH es humano y accionable.
- [ ] Mission Pack se puede guardar, exportar e importar.
- [ ] Offline consulta packs guardados.
- [ ] manifest.webmanifest responde 200.
- [ ] Service Worker está activo.
- [ ] Los iconos ARES PATH responden 200.
- [ ] La instalación nativa se prueba en HTTPS.

### Demo

- [ ] La URL se abre desde una ventana limpia.
- [ ] El primer request no muestra una pantalla rota mientras Render despierta.
- [ ] El usuario puede seleccionar una región.
- [ ] El usuario puede mover y ampliar el ROI sin salir del dataset.
- [ ] El usuario puede planear una misión.
- [ ] La UI muestra procedencia y limitaciones.
- [ ] El flujo offline se explica antes de desconectar la red.
- [ ] Se conserva un Mission Pack de respaldo para la presentación.

## Referencias oficiales

- Vercel y Next.js: https://vercel.com/docs/frameworks/full-stack/nextjs
- Deployments en Vercel: https://vercel.com/docs/deployments
- Variables de entorno en Vercel: https://vercel.com/docs/environment-variables
- Docker en Render: https://render.com/docs/docker
- Web Services en Render: https://render.com/docs/web-services
- Discos persistentes en Render: https://render.com/docs/disks
- Despliegue en Cloud Run: https://docs.cloud.google.com/run/docs/deploying
- Quickstart de Cloud Run: https://docs.cloud.google.com/run/docs/quickstarts/deploy-container
- Azure Container Apps: https://learn.microsoft.com/en-us/azure/container-apps/containerapp-up
- Azure Blob Storage: https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blobs-overview
- Next.js en Azure Static Web Apps: https://learn.microsoft.com/en-us/azure/static-web-apps/nextjs
- Manifest instalable de una PWA: https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest/
- Prompt de instalación de PWA: https://web.dev/learn/pwa/installation-prompt
