# Route interpretation

ARES PATH returns two declared alternatives over the same validated local
elevation grid:

- `shortest`: A* minimizes physical horizontal step length over cells accepted
  by the shared traversability mask.
- `terrain_aware`: A* applies the slope-derived cost multiplier configured in
  the mission request.

Both routes report distance, cumulative ascent, cumulative descent, maximum
sampled segment slope, internal planning cost and cell count. The cost is not
treated as a safety score, and the costs of the two modes are not directly
comparable when their objectives differ.

## Terrain restrictions

The configured maximum slope is a prototype planning parameter. Cells without
valid elevation/slope support or above the configured threshold are excluded
from the traversability mask. The API reports the resulting counts in terrain
statistics and the Mission Briefing.

## Evidence-based trade-offs

The briefing generates deterministic statements from response deltas only. It
may say that a route is longer/shorter or has a higher/lower sampled maximum
slope when the returned metrics support that relation. It does not say that a
route is safe for astronauts or that a slope threshold is an operational rule.

## Coordinate and data caveats

All route vertices are zero-based `(row, col)` cells. Elevation profiles are
sampled from the DTM values at those cells. Remote map imagery is contextual and
does not replace the DEM used by the planner. The local raster does not include
real-time atmospheric conditions, unknown obstacles, thermal constraints,
biological constraints or operational validation.
