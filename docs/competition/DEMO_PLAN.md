# ARES PATH — Demo Plan

## Main story

**Problem:** a Mars map is not enough if a viewer cannot explain how terrain
changes a route decision.  
**Evidence:** ARES PATH loads a real HiRISE DTM, keeps its source/CRS visible,
and asks the backend to compare two route objectives.  
**Moment of proof:** the same grid endpoints produce two distinct paths with
distance, ascent, descent, sampled slope and model-cost metrics.  
**Honest boundary:** the output is a research comparison, not EVA navigation or
safety advice.

## 30-second spoken version

> “ARES PATH turns a documented Jezero HiRISE elevation cut into an explainable
> Mars route experiment. I select two cells in the real raster, then the
> FastAPI backend runs two A* objectives: physical shortest distance and a
> declared terrain-aware cost. The UI shows the paths, elevation profile,
> source IDs and limitations side by side. The point is not to claim a safe
> astronaut route; it is to make the data, assumptions and trade-offs visible.
> The saved Mission Pack preserves the response, elevation profile and compact
> local preview for offline review, while live NASA tiles remain explicitly
> online-only."

## Five-minute sequence

| Time | Action | Evidence to narrate |
|---:|---|---|
| 0:00–0:30 | Show title, challenge framing and disclaimer | Research prototype; not operational navigation. |
| 0:30–1:15 | Open region metadata and CTX/HiRISE map context | Real source IDs, Mars Trek visual descriptors, local CRS note. |
| 1:15–2:00 | Show DTM/ortho layers and click/type origin/destination cells | `grid_row_col`, 256×256 ROI, no invented geographic target. |
| 2:00–3:00 | Plan mission | Backend returns two routes from the real DTM; point to request/response status. |
| 3:00–3:45 | Compare cards and map overlays | Distance, ascent/descent, sampled max slope, expanded cells and declared cost. |
| 3:45–4:20 | Open elevation profile and provenance | Explain that the RED orthoimage is display-only and route cost is exploratory. |
| 4:20–4:45 | Save/select/import Mission Pack or export JSON | Mission response/profile and compact local preview are stored locally; WMTS and source GeoTIFF remain explicitly online-only. |
| 4:45–5:00 | Close with limitation and next step | Control-point review, second region, verified science target. |

## Fallbacks

1. If NASA WMTS is unavailable, continue with the local ROI and say “visual
   context unavailable; the route still comes from the local DTM.”
2. If the backend is unavailable after a previous run, select the saved
   Mission Pack and show the response/profile. Do not imply a new calculation
   occurred offline.
3. If the browser has no saved pack, use the recorded HTTP response and
   screenshots in the submission evidence folder; label them as recorded
   evidence.
4. If map pointer selection is unreliable in the demo browser, use the visible
   contract fields and state that the map-to-grid inverse is implemented but
   the fallback is intentional for determinism.

## Evidence checklist

- One screenshot of the real CTX/HiRISE map with local ROI.
- One screenshot of both route cards and the comparison matrix.
- One screenshot of the elevation profile/provenance/limitations.
- Terminal capture showing `72 passed` backend tests plus the passing frontend typecheck/lint/unit/E2E checks.
- `docs/science/DATA_PROVENANCE.md` and the two processed sidecars.
- JSON manifest exported from the exact demo response.
- Short note stating no verified scientific navigation target was asserted.

## Rehearsal acceptance

- [ ] Backend starts from the documented command.
- [ ] `/api/health`, `/api/data/regions` and `/api/missions/plan` return 200.
- [ ] Frontend shows `API / READY` and `MARS TREK / READY` when network is available.
- [ ] The same endpoint pair is used in the recording and in the exported manifest.
- [ ] No spoken or written line calls the route safe, certified or operational.
- [x] The offline fallback visibly distinguishes cached response/profile/preview data from live map tiles.

