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
  "scientific_target_ids": [],
  "analysis_window": {"row": 0, "col": 0, "height": 256, "width": 256}
}
```

The `jezero_fan_*` identifiers select one of the four validated HiRISE windows;
the `jezero_ctx_*_20m` identifiers select one of the four broad CTX regions.
`analysis_window` is optional; when present, it selects a rectangular window
inside the selected parent region. `start`, `destination` and returned
`grid_path` remain in the parent region's `grid_row_col` coordinates; the
backend crops the DTM before running both route alternatives, so routes cannot
leave the selected window or regional dataset. The same optional field is
accepted by the terrain sample and profile endpoints.

The response contains a deterministic `mission_id`, one or two route objects,
optional physical comparison deltas, source IDs, methodology version and
limitations. It also includes a backend-generated `briefing` containing the
mission overview, selected/user-defined objective, terrain assessment,
per-route elevation profiles, evidence-backed trade-offs, provenance and
limitations. Route metrics are calculated by P2/P3 from the loaded elevation
grid; the API does not fabricate fallback numbers.

`GET /api/missions/scientific-targets?region_id=...` returns only entries from
the local documented catalog. Contextual entries may have `position: null` and
`is_navigable: false` when a verified navigation coordinate is unavailable.
`GET /api/missions/scientific-targets/{target_id}` returns one catalog entry.

## Supporting endpoints

- P1 metadata: `GET /api/data/regions`, `GET /api/data/regions/{region_id}`,
  `GET /api/data/regions/{region_id}/layers`.
- Raster assets: `GET /api/data/regions/{region_id}/layers/{layer_id}/metadata`,
  `GET /api/data/regions/{region_id}/layers/{layer_id}/raster`,
  `GET /api/data/regions/{region_id}/layers/{layer_id}/preview.png` and
  `GET /api/data/regions/{region_id}/layers/{layer_id}/tiles/{zoom}/{column}/{row}.png`.
- Mars Trek descriptors: `GET /api/data/mars-trek/layers`.
- P2 summaries/profiles: `GET /api/terrain/{region_id}/summary`,
  `POST /api/terrain/elevation-profile`, `POST /api/terrain/traversability`,
  `POST /api/terrain/sample`.
- P3 routes: `POST /api/routes/calculate`, `POST /api/routes/compare`.

These endpoints return compact JSON and never transfer a complete raster.

`POST /api/terrain/sample` accepts a `region_id`, one `point` under the
`grid_row_col` contract and the terrain configuration. It returns the real DTM
elevation, finite-difference slope, NoData/coverage state, resolution, source
IDs and nearby routable catalog targets when such records exist.

The `raster` endpoint is the exception by design: it returns the original
processed GeoTIFF bytes with its numeric values and georeferencing. PNG
previews and local tiles are display-only renderings. Their tile matrix is
`local_native_xyz` in the source raster's projected Mars CRS; it is not
EPSG:3857 and must not be treated as the Mars Trek WMTS matrix.

## Error envelope

Expected errors use one shape:

```json
{
  "code": "NO_PATH",
  "message": "No continuous traversable route exists for the requested points and mode.",
  "details": {
    "point_affected": null,
    "reason": "No traversable path exists.",
    "suggestion": "Choose points closer together or expand the analysis window."
  }
}
```

Typical statuses are 400/422 for invalid inputs, 404 for missing regions or
targets, 409 for inconsistent data, 422 for `NON_TRAVERSABLE_POINT` or
`NO_PATH`, and 503 when a required local DTM is unavailable. Endpoint errors
include the affected point, the terrain reason and a user-facing suggestion;
internal traces are not returned to clients.
