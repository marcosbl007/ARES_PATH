"use client";

import { BookOpen, Download, FileText, Printer } from "lucide-react";

import type { MissionBriefing, MissionResponse } from "@/shared/types/api-contract";

type MissionBriefingPanelProps = {
  mission: MissionResponse | null;
  onExport: () => void;
  onPrint: () => void;
};

function formatMeters(value: number) {
  return `${value.toFixed(2)} m`;
}

function profileRange(profile: MissionBriefing["route_comparison"][number]["elevation_profile"]) {
  const minimum = Math.min(...profile.elevation_m);
  const maximum = Math.max(...profile.elevation_m);
  return `${minimum.toFixed(2)} to ${maximum.toFixed(2)} m`;
}

export function MissionBriefingPanel({ mission, onExport, onPrint }: MissionBriefingPanelProps) {
  const briefing = mission?.briefing;

  return (
    <section className="mission-briefing" aria-label="Mission briefing">
      <div className="comparison-card__heading">
        <span><BookOpen size={14} aria-hidden="true" /> Mission briefing</span>
        <span className="field-status">{briefing ? "BACKEND REPORT" : "PENDING"}</span>
      </div>
      {!briefing ? (
        <p className="field-note">The deterministic report will appear after FastAPI returns a mission plan.</p>
      ) : (
        <>
          <div className="briefing-overview">
            <div><small>Mission</small><strong>{briefing.mission_overview.mission_id}</strong></div>
            <div><small>Region</small><strong>{briefing.mission_overview.region_id}</strong></div>
            <div><small>Generated (UTC)</small><strong>{briefing.mission_overview.generated_at_utc.replace("T", " ")}</strong></div>
            <div><small>Objective</small><strong>{briefing.mission_overview.objective}</strong></div>
          </div>

          <section className="briefing-section">
            <h4><FileText size={13} aria-hidden="true" /> Scientific objective</h4>
            {briefing.scientific_objectives.map((objective) => (
              <article className="briefing-objective" key={objective.target_id ?? objective.name}>
                <strong>{objective.name}</strong>
                <p>{objective.description}</p>
                {objective.scientific_importance ? <p><strong>Why it matters:</strong> {objective.scientific_importance}</p> : null}
                <small>{objective.evidence_status} · {objective.source_references.length} source reference(s)</small>
              </article>
            ))}
          </section>

          <section className="briefing-section">
            <h4><BookOpen size={13} aria-hidden="true" /> Terrain assessment</h4>
            <div className="briefing-metric-grid">
              <span><small>Coverage</small><strong>{briefing.terrain_assessment.coverage_status}</strong></span>
              <span><small>Resolution</small><strong>{briefing.terrain_assessment.resolution_x_m.toFixed(2)} m</strong></span>
              <span><small>Start → destination</small><strong>{formatMeters(briefing.terrain_assessment.elevation_start_m ?? 0)} → {formatMeters(briefing.terrain_assessment.elevation_destination_m ?? 0)}</strong></span>
              <span><small>Route max slope</small><strong>{briefing.terrain_assessment.maximum_route_slope_deg.toFixed(2)}°</strong></span>
              <span><small>Valid cells</small><strong>{briefing.terrain_assessment.valid_cell_count}</strong></span>
              <span><small>Excluded cells</small><strong>{briefing.terrain_assessment.non_traversable_cell_count}</strong></span>
            </div>
            <p className="field-note">{briefing.terrain_assessment.slope_method}</p>
          </section>

          <section className="briefing-section">
            <h4><BookOpen size={13} aria-hidden="true" /> Route comparison</h4>
            <div className="briefing-route-list">
              {briefing.route_comparison.map((route) => (
                <article className="briefing-route" key={route.route_id}>
                  <div><strong>{route.mode === "terrain_aware" ? "Terrain-aware" : "Shortest"}</strong><span>{route.metrics.cell_count} cells</span></div>
                  <div className="briefing-metric-grid">
                    <span><small>Distance</small><strong>{formatMeters(route.metrics.distance_m)}</strong></span>
                    <span><small>Ascent</small><strong>{formatMeters(route.metrics.ascent_m)}</strong></span>
                    <span><small>Descent</small><strong>{formatMeters(route.metrics.descent_m)}</strong></span>
                    <span><small>Max slope</small><strong>{route.metrics.max_slope_deg.toFixed(2)}°</strong></span>
                    <span><small>Profile range</small><strong>{profileRange(route.elevation_profile)}</strong></span>
                  </div>
                </article>
              ))}
            </div>
            <div className="briefing-tradeoffs">
              {briefing.route_tradeoffs.map((tradeoff) => <p key={tradeoff.statement}>{tradeoff.statement}</p>)}
            </div>
          </section>

          <section className="briefing-section">
            <h4><FileText size={13} aria-hidden="true" /> Data provenance</h4>
            <ul className="briefing-provenance">
              {briefing.data_provenance.map((source) => (
                <li key={`${source.role}-${source.source_id}`}>
                  <strong>{source.title}</strong><small>{source.role} · {source.source_id}</small>
                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer">Open source</a> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="briefing-section briefing-section--limitations">
            <h4>Limitations & uncertainty</h4>
            <ul className="limitation-list">
              {briefing.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            </ul>
          </section>

          <div className="briefing-actions">
            <button type="button" onClick={onPrint}><Printer size={14} aria-hidden="true" /> Print report</button>
            <button type="button" onClick={onExport}><Download size={14} aria-hidden="true" /> Export JSON</button>
          </div>
        </>
      )}
    </section>
  );
}
