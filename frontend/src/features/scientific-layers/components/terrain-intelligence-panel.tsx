"use client";

import { Activity, MapPinned, Mountain, Ruler } from "lucide-react";

import type { AsyncStatus } from "@/features/mission-planning/hooks/use-mission-planning";
import type { TerrainSampleResponse } from "@/shared/types/api-contract";

type TerrainIntelligencePanelProps = {
  sample: TerrainSampleResponse | null;
  status: AsyncStatus;
  errorMessage: string | null;
};

function valueOrPending(value: number | null | undefined, suffix: string) {
  return value === null || value === undefined ? "—" : `${value.toFixed(2)} ${suffix}`;
}

export function TerrainIntelligencePanel({
  sample,
  status,
  errorMessage,
}: TerrainIntelligencePanelProps) {
  return (
    <section className="terrain-intelligence" aria-label="Terrain intelligence">
      <div className="selection-block__header">
        <span className="field-label"><Activity size={14} aria-hidden="true" /> Terrain intelligence</span>
        <span className="field-status">
          {status === "loading" ? "QUERYING" : sample ? sample.coverage_status.toUpperCase() : "CLICK MAP"}
        </span>
      </div>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      {!sample && status !== "loading" ? (
        <p className="field-note">Select a valid cell on the map to query the real DTM elevation and derived slope.</p>
      ) : null}
      {status === "loading" ? <p className="field-note">Reading the backend terrain sample…</p> : null}
      {sample ? (
        <>
          <div className="terrain-sample-coordinate">
            <MapPinned size={13} aria-hidden="true" />
            <span>R{sample.point.row} / C{sample.point.col}</span>
            <small>{sample.map_x_m.toFixed(2)} m, {sample.map_y_m.toFixed(2)} m</small>
          </div>
          <div className="terrain-sample-grid">
            <span><Mountain size={13} aria-hidden="true" /><small>Elevation</small><strong>{valueOrPending(sample.elevation_m, "m")}</strong></span>
            <span><Activity size={13} aria-hidden="true" /><small>Slope</small><strong>{valueOrPending(sample.slope_deg, "°")}</strong></span>
            <span><Ruler size={13} aria-hidden="true" /><small>Resolution</small><strong>{sample.pixel_size_x_m.toFixed(2)} m</strong></span>
          </div>
          <p className="field-note">
            {sample.no_data
              ? "This cell has no valid elevation value."
              : sample.slope_exceeds_threshold
                ? "The sampled slope exceeds the configured planning threshold."
                : `Cell is ${sample.traversable ? "inside" : "outside"} the configured traversability mask.`}
          </p>
          {sample.nearby_scientific_targets.length ? (
            <p className="field-note">Nearby documented targets: {sample.nearby_scientific_targets.map((target) => target.name).join(", ")}</p>
          ) : null}
          <ul className="limitation-list">
            {sample.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </>
      ) : null}
    </section>
  );
}
