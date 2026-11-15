# ARES PATH — Data Provenance

**Inventory date:** 2026-11-14  
**Purpose:** record what is observed, what is derived, what is only visual
context, and what must not be presented as a scientific or safety conclusion.

## Provenance rules

- Every numeric terrain result must come from a checked local DTM, never from a
  display PNG, orthoimage DN, or synthetic test fixture.
- Every map layer must declare its source, CRS/coverage metadata and whether it
  participates in routing.
- Shared grid alignment is evidence of a reproducible processing convention;
  it is not an independent accuracy or control-point measurement.
- No scientific target coordinate is created from a visual impression.

## Versioned local assets

### Elevation DTM

| Field | Value |
|---|---|
| File | `backend/data/processed/jezero_fan_256_elevation.tif` |
| Region | `jezero_fan_256` |
| Source product | `DTEEC_002387_1985_003798_1985_A01` |
| Dataset | `MRO-M-HIRISE-5-DTM-V1.0`, Mars Reconnaissance Orbiter / HiRISE |
| Producer | University of Arizona |
| Source page | [HiRISE DTM page](https://www.uahirise.org/dtm/PSP_002387_1985) |
| Original download | [PDS IMG](https://www.uahirise.org/PDS/DTM/PSP/ORB_002300_002399/PSP_002387_1985_PSP_003798_1985/DTEEC_002387_1985_003798_1985_A01.IMG) |
| Processed SHA256 | `a549d37a629324eb8b08b16cd662a49ffc735b64a116bb6829d5b89a4364687e` |
| Grid | 256×256; 65,536 valid cells |
| Numeric values | float32 source; loaded as float64; vertical units metres |
| Vertical reference | Mars 2000 equipotential surface, per PDS IMAGE NOTE |
| Pixel size | 1.0096476466229 m × 1.0096476466229 m |
| CRS | Mars equirectangular; standard parallel 15°, central meridian 77.41°, radius 3,394,839.8133163 m |
| Transform | `[1.0096476466229, 0, -551.2676150561033, 0, -1.0096476466229, 1095852.37233921]` |
| Valid range inspected | -2430.7495 m to -2422.8044 m |
| Routing role | **Yes** — elevation, slope, traversability and route cost |

The sidecar `jezero_fan_256_elevation.json` is the authoritative in-repository
record for transform, WKT, source hash, window, units and processed hash.

### Associated RED orthoimage

| Field | Value |
|---|---|
| File | `backend/data/processed/jezero_fan_256_orthoimage.tif` |
| Source product | `PSP_002387_1985_RED_C_01_ORTHO` |
| Instrument/filter | HiRISE RED, Mars Reconnaissance Orbiter |
| Source page | [HiRISE DTM/ortho page](https://www.uahirise.org/dtm/PSP_002387_1985) |
| Processed SHA256 | `4541611605f34d529e73fcb368ecf231d7a1ba950c3bfdb5071ea5bb3e45a6fb` |
| Grid | 256×256; uint8 DN; invalid DN catalogued as 0, 1 and 255 |
| Alignment | Same shape, transform, CRS and bounds as DTM; PDS grid verified |
| Routing role | **No** — display/context only |
| Remaining limitation | Independent visual/control-point review is pending |

The sidecar records the DTM hash, source/label hashes, radiometric conversion
and three grid checkpoints. It does not establish independent photogrammetric
registration accuracy.

## Remote visual context

The backend stores two Mars Trek descriptors from the NASA Mars Trek service:

| Layer | Role | CRS/matrix | Verification |
|---|---|---|---|
| Jezero CTX controlled mosaic | Regional orbital visual context | EPSG:104905 / `default028mm` | Capabilities returned HTTP 200 with PNG/default matrix on 2026-11-14 |
| Jezero HiRISE controlled mosaic | Higher-resolution orbital visual context | EPSG:104905 / `default028mm` | Same capabilities check |

The descriptors and exact WMTS URLs are in `backend/app/nasa_data/mars_trek.py`.
The service documentation is [NASA Mars Trek tile API documentation](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars).
These layers are visual context, not elevation, and are marked
`not_verified_against_jezero_fan_256`. They require network access at runtime.

## Scientific target inventory

`backend/data/scientific_targets.json` contains one documented contextual
entry: `jezero_depositional_fan_context`. It has `position: null`,
`coordinate_status: contextual_only`, and `is_navigable: false`. This is
intentional: the project does not invent a route destination from a label or
image. A verified target requires an authoritative coordinate and review.

## Derived products and semantics

- Slope uses finite differences over the DTM, scaled by the physical pixel
  sizes in metres.
- `shortest` uses the traversability mask and physical horizontal distance.
- `terrain_aware` uses the declared slope-weighted multiplier. Its cost is an
  exploratory model quantity, not metres, energy, time, or safety.
- The frontend renders local PNG previews and WMTS tiles for visualization. It
  never treats those display bytes as numeric elevation input.
- The API's raster endpoint preserves GeoTIFF bytes and georeferencing; tile
  and preview endpoints are display representations.

## Reproducible real-data observation

The public HTTP smoke test sends `(row=10,col=20)` to
`(row=80,col=65)` with `max_slope_deg=20` and `slope_weight=2`. It returns two
routes over the real DTM. The observed distance is approximately 89.495 m for
both routes; the terrain-aware route has a model cost of approximately 92.532.
The routes differ and the terrain-aware route's sampled maximum slope is not
lower in this run. These are properties of this recut and parameter set, not a
mission recommendation.

