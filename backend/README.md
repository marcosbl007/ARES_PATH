# ARES PATH backend

FastAPI backend for the ARES PATH research prototype. It exposes documented
NASA-region metadata, terrain summaries, route calculations, mission planning,
and minimal process metadata. It is not operational EVA navigation or safety
guidance.

## Run locally

From `backend/`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
python -m uvicorn app.main:app --reload
```

The interactive API documentation is available at `http://127.0.0.1:8000/docs`.
The data root can be changed with `ARES_DATA_ROOT`; CORS origins are configured
with the comma-separated `ARES_CORS_ORIGINS` variable.

## Public MVP routes

- `GET /api/health`
- `GET /api/system/info`
- `GET /api/data/regions`
- `GET /api/data/regions/{region_id}`
- `GET /api/data/regions/{region_id}/layers`
- `GET /api/data/mars-trek/layers`
- `GET /api/data/regions/{region_id}/layers/{layer_id}/metadata`
- `GET /api/data/regions/{region_id}/layers/{layer_id}/raster`
- `GET /api/data/regions/{region_id}/layers/{layer_id}/preview.png`
- `GET /api/data/regions/{region_id}/layers/{layer_id}/tiles/{zoom}/{column}/{row}.png`
- `GET /api/missions/scientific-targets?region_id=...`
- `POST /api/missions/plan`
- `GET /api/terrain/{region_id}/summary`
- `POST /api/terrain/elevation-profile`
- `POST /api/terrain/traversability`
- `POST /api/routes/calculate`
- `POST /api/routes/compare`

Raster assets are exposed without turning them into JSON. The `raster` route
returns the processed GeoTIFF bytes, preserving the numeric DTM values and
georeferencing. `preview.png` and `tiles/...png` are display-only RGBA
renderings; they must not be used for terrain calculations. Local tiles use an
AOI-local XYZ matrix in the native projected Mars CRS: zoom `0` covers the
whole 256 x 256 region, and higher zooms subdivide that same extent. This is
not EPSG:3857 and is separate from the global Mars Trek WMTS matrix.

The Mars Trek endpoint returns the two verified Jezero visual WMTS descriptors
(CTX and HiRISE), including capabilities URLs and the explicit warning that
their CRS/alignment must be validated before overlaying the local DTM.

Example raster requests from `backend/`:

```powershell
Invoke-WebRequest `
  -Uri http://127.0.0.1:8000/api/data/regions/jezero_fan_256/layers/orthoimage/preview.png `
  -OutFile .\tmp\jezero-ortho-preview.png

Invoke-WebRequest `
  -Uri http://127.0.0.1:8000/api/data/regions/jezero_fan_256/layers/elevation/raster `
  -OutFile .\tmp\jezero-elevation.tif
```

## Mission example

The coordinates below are schema examples only; they are not NASA target
coordinates or safety thresholds.

```powershell
$body = @{
  region_id = "jezero_fan_256"
  coordinate_system = "grid_row_col"
  start = @{ row = 10; col = 20 }
  destination = @{ row = 80; col = 65 }
  mode = "compare"
  terrain_config = @{ max_slope_deg = 20.0; slope_weight = 2.0 }
  scientific_target_ids = @()
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/missions/plan `
  -ContentType "application/json" `
  -Body $body
```

## Tests

```powershell
python -m pytest -q
```

The tests use synthetic in-memory grids where possible. The real DTM remains a
local reproducible asset and is not committed to Git.
