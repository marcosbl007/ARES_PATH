# Challenge alignment

ARES PATH addresses NASA Space Apps Challenge 2026’s **Interplanetary
Survival Guide: Martian Map** through a reproducible Marswalk-planning flow.

## Where?

The application identifies a real Jezero raster subset, preserves its native
Mars projection, and exposes scientific context from the HiRISE DTM catalog.
Catalog records without verified point coordinates remain contextual and are
not moved into the computational grid.

## Why?

The target explorer explains the source-backed depositional-fan context and
links the official product reference. When no target coordinate is verified,
the user-selected destination is labeled `user_defined` rather than presented
as a NASA-certified sample site.

## How?

The backend calculates shortest and terrain-aware routes with A* over the
validated elevation-derived terrain contract. The map shows real returned
paths, and the briefing reports physical metrics, slope method, restrictions
and route trade-offs.

## What do we know?

The layer explorer separates HiRISE DTM elevation, registered optical DN,
derived slope and remote Mars Trek visual layers. Each descriptor includes
source, coverage, resolution, routing role and limitations.

## What are the limitations?

This is a research prototype, not certified astronaut navigation or safety
guidance. It does not model real-time atmosphere, radiation, thermal state,
unknown obstacles, suit constraints or operational validation. Remote WMTS
alignment with the local DTM is not asserted automatically.

Official challenge page: <https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/>
