# ARES PATH demo notes

## Reproducible flow

1. Start the backend with `python -m uvicorn app.main:app --reload` from
   `backend/`.
2. Open `/docs` and call `/api/health` to show that the process responds.
3. Call `/api/data/regions` and select a region that has its local processed
   DTM and sidecar metadata available.
4. Submit `/api/missions/plan` with two grid cells inside the valid raster.
5. Show `shortest` and `terrain_aware`, their physical metrics, the comparison,
   NASA source IDs, and the explicit prototype limitations.

The sample cells in the README are contract examples, not verified scientific
targets. A target without a verified grid coordinate remains contextual and
must not be presented as a navigable destination.

## Public wording

Use “exploratory terrain-aware route” and “research prototype”. Do not say that
the route is safe for astronauts, operationally validated, medically suitable,
or a NASA mission recommendation.

## Data limitation

The HiRISE DTM and associated orthoimage are local reproducible assets. A clean
checkout must prepare them using `docs/nasa-data-sources.md`; the API returns
metadata and source identifiers but does not download NASA data during a
request.
