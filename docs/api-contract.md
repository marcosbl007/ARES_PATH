# ARES PATH API contract

The API uses the `/api` prefix, JSON UTF-8, `snake_case`, and Pydantic v2
models. Coordinates are zero-based raster cells under `grid_row_col`:
`row` increases downward and `col` increases to the right. They are not
latitude/longitude values.

## System

`GET /api/health`

```json
{"status":"ok"}
```

`GET /api/system/info` returns the public project name, version, challenge,
prototype scope and warning. It does not report dataset integrity as process
health.

## Mission planning

`POST /api/missions/plan`

```json
{
  "region_id": "jezero_fan_256",
  "coordinate_system": "grid_row_col",
  "start": {"row": 10, "col": 20},
  "destination": {"row": 80, "col": 65},
  "mode": "compare",
  "terrain_config": {"max_slope_deg": 20.0, "slope_weight": 2.0},
  "scientific_target_ids": []
}
```

The response contains a deterministic `mission_id`, one or two route objects,
optional physical comparison deltas, source IDs, methodology version and
limitations. Route metrics are calculated by P2/P3 from the loaded elevation
grid; the API does not fabricate fallback numbers.

`GET /api/missions/scientific-targets?region_id=...` returns only entries from
the local documented catalog. Contextual entries may have `position: null` and
`is_navigable: false` when a verified navigation coordinate is unavailable.

## Supporting endpoints

- P1 metadata: `GET /api/data/regions`, `GET /api/data/regions/{region_id}`,
  `GET /api/data/regions/{region_id}/layers`.
- P2 summaries/profiles: `GET /api/terrain/{region_id}/summary`,
  `POST /api/terrain/elevation-profile`, `POST /api/terrain/traversability`.
- P3 routes: `POST /api/routes/calculate`, `POST /api/routes/compare`.

These endpoints return compact JSON and never transfer a complete raster.

## Error envelope

Expected errors use one shape:

```json
{
  "code": "NO_PATH",
  "message": "No traversable route exists for the requested points and mode.",
  "details": {}
}
```

Typical statuses are 400/422 for invalid inputs, 404 for missing regions or
targets, 409 for inconsistent data, 422 for `NO_PATH`, and 503 when a required
local DTM is unavailable. Internal traces are not returned to clients.
