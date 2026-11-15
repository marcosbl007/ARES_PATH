# Scientific layer inventory

The layer explorer distinguishes visual context from the arrays that feed
terrain analysis. All local layers use the native projected Mars CRS of the
processed raster; they are not EPSG:3857.

| Layer | Data | Source | Resolution | Routing role |
| --- | --- | --- | --- | --- |
| `elevation` | Processed HiRISE DTM values in metres | MRO / HiRISE `DTEEC_002387_1985_003798_1985_A01` | 1.0096476466229 m/pixel | Direct terrain input |
| `orthoimage` | Registered HiRISE RED DN display raster | MRO / HiRISE `PSP_002387_1985_RED_C_01_ORTHO` | 1.0096476466229 m/pixel grid | Display only |
| `slope` | Derived slope in degrees | Derived from the validated DTM | Same grid spacing | Derived terrain input |
| Mars Trek CTX / HiRISE | Remote orbital WMTS imagery | NASA Mars Trek | Descriptor-reported mosaic resolution | Display only |

## Slope method

For each supported cell, row and column derivatives are calculated with
centered finite differences in the interior and one-sided differences on the
edges. A derivative is unsupported when a required neighbor is NoData. The
reported slope is:

`atan(sqrt((dz/dx)^2 + (dz/dy)^2))` in degrees.

The same elevation-derived terrain contract is consumed by the terrain-aware
route planner. Toggling a visual layer alone does not change A*; the route
request's terrain configuration controls the traversability mask and slope
weight.

## API

- `GET /api/data/regions/{region_id}/layers` returns metadata, coverage,
  attribution, processing method and limitations.
- `GET /api/data/regions/{region_id}/layers/{layer_id}/metadata` returns the
  native raster/derived-layer contract.
- `GET .../preview.png` and local tiles are display renderings only. The raw
  `raster` endpoint is reserved for source-backed GeoTIFF layers.
- `POST /api/terrain/sample` returns real elevation, slope, coverage and
  resolution for one valid `grid_row_col` cell.

## Limitations

The remote WMTS mosaics are not automatically asserted to be aligned with the
local 256 × 256 subset. Optical DN values are not converted into elevation,
geology or mineralogy. No geological/mineralogical layer is advertised unless
its source, coverage and georeferencing are verified.
