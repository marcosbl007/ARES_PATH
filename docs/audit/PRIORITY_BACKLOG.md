# ARES PATH — Priority Backlog

Priorities are based on the audit evidence and the challenge demo risk. “Done”
means verified in this checkout; it does not mean production-ready.

## P0 — protect truth and demo reliability

| ID | Item | Acceptance evidence | Status |
|---|---|---|---|
| P0-01 | Keep every route/science output tied to real metadata and source IDs | Mission response includes `data_sources`, methodology and limitations; provenance document matches sidecars | Done |
| P0-02 | Prevent unsupported scientific navigation claims | Context target remains `position: null`, `is_navigable: false`; no target is fabricated | Done |
| P0-03 | Make the public HTTP path reproducible | Real integration test serves metadata, preview, GeoTIFF bytes and two routes | Done |
| P0-04 | Keep NASA WMTS alignment caveat visible | Catalog and UI state that CTX/HiRISE alignment to the local DTM is not independently verified | Done |
| P0-05 | Prepare the 5-minute demo and recovery path | Follow `docs/competition/DEMO_PLAN.md`; rehearse with backend and a saved pack | Open |

## P1 — competition-impacting gaps

| ID | Item | Acceptance evidence | Status |
|---|---|---|---|
| P1-01 | Complete browser acceptance for pointer-to-grid selection | Playwright map event at a centred local ROI coordinate populates the selected grid cell | Done; human pointer walkthrough remains recommended |
| P1-02 | Add offline acceptance test | Build/start production PWA, disconnect network, reload shell and open a saved pack | Done; Playwright production flow passes |
| P1-03 | Decide whether local preview/raster bytes should be bundled | Product decision plus measured package size; never silently imply WMTS is offline | Done; compact preview bundled, source raster/WMTS explicitly online-only |
| P1-04 | Improve frontend failure isolation | Backend metadata failure should still expose locally stored packs without hiding the whole workspace | Done for saved packs; new routes and uncached remote layers remain unavailable offline |
| P1-05 | Add accessible/visual states for pack save, delete and selection | Keyboard and screen-reader walkthrough with screenshots | Open |
| P1-06 | Rehearse with the exact submission browser and viewport | No clipping, no console errors caused by the app, deterministic route request | Open |

## P2 — scientific and engineering depth

| ID | Item | Acceptance evidence | Status |
|---|---|---|---|
| P2-01 | Independent visual/control-point review of DTM/ortho registration | Documented control points and residuals, not just shared PDS grid metadata | Open |
| P2-02 | Add a second independently sourced terrain/imagery region | New sidecar, checksum, CRS/unit review and real integration test | Open |
| P2-03 | Establish a scientific target with verified coordinates | Authoritative source and coordinate transformation reviewed by a domain owner | Blocked by missing target decision/data |
| P2-04 | Quantify resolution/projection uncertainty | Method note with Mars geodesy assumptions and sensitivity tests | Open |
| P2-05 | Replace deprecation warnings in dependencies | Upgrade Starlette/httpx/Affine usage without weakening tests | Open |

## P3 — post-demo product hardening

| ID | Item | Acceptance evidence | Status |
|---|---|---|---|
| P3-01 | Production deployment and observability | Public URL, health checks, logs and reproducible build | Not started |
| P3-02 | Add authentication/rate limits if exposed publicly | Threat model and configured controls | Not started |
| P3-03 | Expand service-worker strategy with versioned migration | Upgrade test and cache invalidation evidence | Partial |
| P3-04 | Add route/profile export formats beyond JSON | Product-approved schema and round-trip test | Open |

