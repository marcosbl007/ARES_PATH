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
- `GET /api/missions/scientific-targets?region_id=...`
- `POST /api/missions/plan`
- `GET /api/terrain/{region_id}/summary`
- `POST /api/terrain/elevation-profile`
- `POST /api/terrain/traversability`
- `POST /api/routes/calculate`
- `POST /api/routes/compare`

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
