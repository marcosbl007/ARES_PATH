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

The catalog exposes four validated HiRISE Jezero windows of `256 x 256`,
`512 x 512`, `1024 x 1024` and `2048 x 2048` cells. They share the same local
HiRISE DTM source. It also exposes four broad CTX regions:
`jezero_ctx_northwest_20m`, `jezero_ctx_northeast_20m`,
`jezero_ctx_southwest_20m` and `jezero_ctx_southeast_20m`. Each CTX region is
`2530 x 2221` cells at 20 m/pixel and has an aligned CTX orthoimage resampled
from the 5 m source. Every HiRISE window also has an aligned RED orthoimage.
Mission requests can additionally provide an `analysis_window` rectangle
inside the selected regional dataset; coordinates remain relative to that
parent region while the backend crops the DTM before routing. The API rejects
points and windows outside the selected region, so a route cannot silently
leave the loaded dataset.
The raw NASA sources stay in `data/raw/` and are intentionally visible to Git;
Git LFS tracks these large inputs. The processed windows and metadata are the
reproducible assets used by the API.

Raster assets are exposed without turning them into JSON. The `raster` route
returns the processed GeoTIFF bytes, preserving the numeric DTM values and
georeferencing. `preview.png` and `tiles/...png` are display-only RGBA
renderings; they must not be used for terrain calculations. Local tiles use an
AOI-local XYZ matrix in the native projected Mars CRS: zoom `0` covers the
whole 256 x 256 region, and higher zooms subdivide that same extent. This is
not EPSG:3857 and is separate from the global Mars Trek WMTS matrix.

The Mars Trek endpoint returns the two verified Jezero visual WMTS descriptors
(CTX and HiRISE), including capabilities URLs and the explicit warning that
their CRS/alignment must be validated before overlaying the local DTM. They are
disabled by default in the frontend; the local elevation and orthoimage layers
are the authoritative map reference. A `NO_PATH` response includes the
affected endpoints, reason and suggestion; a blocked endpoint is reported as
`NON_TRAVERSABLE_POINT` before A* starts.

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

The tests use synthetic in-memory grids where possible and include an HTTP
smoke test against the versioned GeoTIFF assets. The processed DTMs and the
raw source inputs are visible to Git; large raw files are handled by Git LFS.
Reproduction details are in `docs/nasa-data-sources.md`.
