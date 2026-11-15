# ARES PATH — Judging Readiness

This is an internal readiness assessment, not an official NASA score. The
official challenge context is the [2026 Interplanetary Survival Guide:
Martian Map challenge](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/?tab=teams).
The [NASA Space Apps 2026 event page](https://www.spaceappschallenge.org/2026/)
is the source of event/submission timing; the repository did not contain a
2026 judging guide attachment, so exact weights and award decisions must not be
assumed.

## Internal scorecard

Scale: 1 = weak evidence, 3 = credible prototype, 5 = competition-ready with
strong evidence. Scores are planning signals only.

| Criterion | Internal score | Evidence already available | Gap that can lower the score |
|---|---:|---|---|
| Impact | 3/5 | Explainable route comparison and an honest science/provenance layer address a meaningful Mars planning problem. | No user study, no operational validation, no demonstrated decision impact. Keep the claim as “research prototype.” |
| Creativity | 3/5 | Real HiRISE DTM + Mars Trek context + side-by-side shortest/terrain-aware explanation. | The story and interaction need a distinctive 30-second hook; the current cost model is still a prototype abstraction. |
| Validity | 4/5 | 74 backend tests, real HTTP smoke test, checksums, CRS/transform alignment, typed API contracts and deterministic A*. | Independent registration/control points, uncertainty analysis and second region are missing. |
| Relevance | 4/5 | Directly uses Mars map data and exposes a map-to-route workflow aligned with the challenge. | Only contextual science target exists; no verified destination/feature coordinate has been selected. |
| Presentation | 3/5 | Working Next.js map shell, route cards, profile, provenance, PWA shell and demo plan. | Needs rehearsal, clean screenshot/recording, browser acceptance of map click, and a clear fallback if WMTS/network fails. |

**Internal total: 17/25.** This is not an official judging result.

## Readiness by likely award narrative

These are narrative fits, not promises of award categories. The [official 2025
awards page](https://www.spaceappschallenge.org/2025/awards/) shows examples of
NASA Space Apps award themes such as science/data/technology, mission concept,
storytelling and impact; the active year may differ.

| Narrative | Readiness | What to show |
|---|---|---|
| Best use of science/data/technology | Strongest fit | Source IDs, DTM/ortho checks, real route response, test command and limitation card. |
| Mission concept | Plausible | One operator story: select two raster cells, compare route objectives, inspect elevation profile. |
| Storytelling | Needs rehearsal | Use the script and evidence sequence in `DEMO_PLAN.md`; avoid a generic dashboard tour. |
| Galactic/community impact | Early | Explain future value without claiming operational deployment or safety. |

## Submission guardrails

- Say “exploratory terrain-aware cost,” not “safe route,” “optimal EVA route,”
  or “NASA-certified.”
- Say “visual context from Mars Trek,” not “independently aligned map,” until
  control-point review is complete.
- Say “offline mission response/profile and compact preview review,” not
  “offline Mars maps,” because WMTS and backend GeoTIFF bytes are online-only.
- Show the source IDs and the explicit `position: null` contextual target if
  scientific targets are mentioned.
- Include the exact demo date/environment and a visible fallback plan.

