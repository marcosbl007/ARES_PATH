# ARES PATH — Project Status Audit

**Audit date:** 2026-11-14  
**Status:** **PARTIAL — evidence-backed MVP demo, not operational navigation**  
**Scope:** repository, local backend/frontend execution, tracked geospatial assets, automated tests, and competition readiness.

## Status vocabulary

| Label | Meaning in this audit |
|---|---|
| Verified | Reproduced in this checkout with a command, test, HTTP response, file inspection, or source record. |
| Partial | Implemented, but missing an acceptance check, production hardening, or an important dependency. |
| Mock / fixture | Synthetic or UI-only data used by tests; it is not evidence about Mars. |
| Missing | Required capability or evidence is not present in the repository. |
| Blocked | Cannot be responsibly verified without an external dependency, user decision, or new data. |

## Executive result

The project has a credible end-to-end research-prototype slice:

1. The backend loads and integrity-checks the real `jezero_fan_256` elevation
   GeoTIFF and associated RED orthoimage.
2. The public FastAPI surface serves metadata, binary raster bytes, display
   previews, local raster tiles, terrain profiles and a shortest/terrain-aware
   route comparison.
3. A real mission request using grid cells `(10,20)` to `(80,65)` returns two
   routes and physical metrics. The terrain-aware route optimizes the declared
   exploratory cost; it is not a safety score and does not guarantee lower
   slope or shorter distance.
4. The frontend renders real Mars Trek CTX/HiRISE descriptors, local raster
   overlays, backend route geometry, provenance and typed error/loading states.
5. The frontend now has map-to-grid selection code, an IndexedDB Mission Pack,
   an installable PWA shell, JSON import/export and a production offline
   acceptance flow. A pack contains the saved response/profile and a compact
   local raster preview; source GeoTIFF bytes and remote WMTS remain explicitly
   online-only.

This is strong enough for a transparent competition demo, but not enough to
claim operational field use, scientific target navigation, independent
geodetic registration, or production offline mapping.

## Verified evidence

| Area | Evidence | Result |
|---|---|---|
| Backend suite | `.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.pytest-tmp` | **74 passed**, 34 dependency warnings; no failed test. |
| Real public HTTP path | `backend/tests/test_real_dataset_integration.py` | Health, region metadata, layers, PNG preview, GeoTIFF bytes and two-route mission response all return expected status/content. |
| DTM | `backend/data/processed/jezero_fan_256_elevation.tif` plus sidecar | 256×256, float64 after load, metres, 65,536 valid cells, Mars equirectangular CRS, SHA256 checked by repository. |
| Orthoimage | `backend/data/processed/jezero_fan_256_orthoimage.tif` plus sidecar | 256×256 uint8 RED DN, aligned shape/transform/CRS/bounds with DTM; display-only. |
| Route algorithm | `backend/tests/test_routing.py` and real smoke request | 8-neighbour A*, no diagonal corner cutting, physical pixel distances, NoData exclusion and deterministic metrics covered. |
| Frontend unit suite | `pnpm test:run` | **5 passed** across 4 files. |
| Frontend static checks | `pnpm typecheck`, `pnpm lint` | Passed. |
| Browser route flow | `frontend/e2e/mission-planning.spec.ts` with local backend/server | Covers real metadata, map-to-grid point selection, POST mission plan, two route cards, comparison panel and manifest availability. |
| Mars Trek descriptors | Backend catalog and capabilities verification record | CTX and HiRISE descriptors are stored with endpoint, CRS, tile matrix and alignment warning. |

The E2E dispatches a browser map click after centering the computational ROI;
the inverse affine transformation and a real grid point are asserted before the
mission request. A final human pointer walkthrough is still recommended because
CSS overlays and browser hit-testing vary by viewport.

## Capability matrix

| Capability | State | Notes |
|---|---|---|
| FastAPI app starts | Verified | Requires the backend virtual environment/dependencies. |
| Real DTM load and checksum | Verified | `RegionRepository` rejects missing, mismatched or invalid assets. |
| Real orthoimage alignment checks | Verified | PDS-grid alignment checks exist; independent visual registration review remains pending. |
| Mars Trek global visual context | Verified / external | Catalog descriptors and WMTS requests are external-network dependent. |
| Map route overlays | Verified / partial | Geometry is transformed from `grid_row_col`; browser E2E covers ROI-centred map selection, while a human pointer walkthrough remains recommended. |
| A* shortest route | Verified | Tested on synthetic cases and real DTM request. |
| Terrain-aware route | Verified as declared cost | Cost units are exploratory and not directly comparable to shortest-route cost. |
| Scientific target layer | Partial | Only a contextual, non-navigable entry is present; no verified target coordinate is invented. |
| Provenance in UI/API | Verified | Source IDs, methodology and limitations are surfaced. |
| PWA shell | Verified / browser-dependent install prompt | Manifest, service worker, install affordance and production shell reload pass the local Chromium acceptance flow. Native install UI is controlled by the browser. |
| Offline Mission Pack | Verified / scoped | IndexedDB stores/imports/exports the mission, profile and compact local preview; production reload works without the backend. WMTS and source raster bytes remain online-only. |
| Export manifest | Verified | Browser downloads a JSON representation of the current response/pack. |
| Production deployment | Missing | No deployment configuration or public URL was requested or verified. |
| Safety/operational certification | Not claimed | Explicitly out of scope. |

## Known environment constraints

- The global Python executable did not have `pytest`; the project `.venv` was
  used for backend verification.
- In this managed Windows environment, pytest's default user temp directory
  was not writable. The passing command set `TEMP`/`TMP` to ignored
  `backend/tmp` and disabled pytest's cache plugin.
- NASA WMTS and any live backend process are network/process dependencies; a
  disconnected browser can review a saved Mission Pack but cannot fetch new
  map tiles or calculate a new route. The app reports these resources as
  online-only instead of presenting an incomplete map as cached science.
- No official 2026 judging guide was present in the repository. The competition
  assessment in `JUDGING_READINESS.md` is therefore an internal readiness
  assessment, not an official NASA score.

## Recommended release statement

> “ARES PATH is a research prototype that combines a documented HiRISE DTM,
> NASA Mars Trek visual context and explainable grid-based route comparisons.
> Its outputs are exploratory and are not operational EVA navigation or safety
> guidance.”

