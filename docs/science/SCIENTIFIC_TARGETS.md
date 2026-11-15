# Scientific targets and points of interest

ARES PATH keeps the scientific-target catalog server-owned. The frontend may
filter and focus records, but it does not contain a second catalog or create
scientific claims.

## Current verified catalog

| ID | Record | Evidence | Routable locally |
| --- | --- | --- | --- |
| `jezero_depositional_fan_context` | Context of the HiRISE DTM product titled “Depositional fan in Jezero Crater” | Verified source product and source reference; no point coordinate asserted | No |

The target is deliberately `contextual_only`, `geometry_type: polygon`, and has
`position: null`. The available 256 × 256 raster is a computational subset,
but the catalog does not provide a verified point-level waypoint inside that
subset. ARES PATH therefore does not move the target or invent a sample site.

## API behavior

- `GET /api/missions/scientific-targets?region_id=...` lists the documented
  records for a known region.
- `GET /api/missions/scientific-targets/{target_id}` returns one record and
  accepts an optional `region_id` filter.
- `POST /api/missions/plan` accepts target IDs as scientific context. A target
  with no verified navigation coordinate cannot be used as an A* destination.
- A destination without a selected catalog target is reported as a
  `user_defined` observation point in the Mission Briefing.

## Source

The current record points to the official HiRISE product page:

<https://www.uahirise.org/dtm/PSP_002387_1985>

The local DTM source ID is `DTEEC_002387_1985_003798_1985_A01`. The source
catalog and limitations are maintained in `backend/data/sources.json` and the
JSON response, not inferred from image colors.
