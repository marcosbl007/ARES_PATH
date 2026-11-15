# Mission Briefing

The Mission Briefing is returned inside the successful response from
`POST /api/missions/plan` as `briefing`. It is assembled on the backend from
the same request, loaded region, terrain analysis, route metrics and scientific
catalog records. The frontend renders the returned structure and does not
recalculate scientific values.

## Sections

1. **Mission overview** — deterministic mission ID, region, UTC generation
   time, origin, destination, objective and planning status.
2. **Scientific objectives** — selected catalog context or an explicit
   `user_defined` observation point, evidence status, references and
   limitations.
3. **Terrain assessment** — DEM coverage, valid/NoData cells, metre
   resolution, vertical datum when documented, route elevation endpoints,
   sampled slope, configured threshold and excluded cells.
4. **Route comparison** — route metrics and an elevation profile for each
   alternative.
5. **Route trade-offs** — deterministic, metric-backed explanations; no
   generative model is used.
6. **Data provenance** — visual map sources, DEM, selected objective sources
   and routing methodology.
7. **Limitations & uncertainty** — data and operational boundaries are kept in
   the response and shown in the UI.

The frontend offers a print view and a JSON export of this exact `briefing`
object. Export preserves units, coordinates, timestamps, source references and
limitations. An incomplete or failed mission is not exported as a completed
briefing.
