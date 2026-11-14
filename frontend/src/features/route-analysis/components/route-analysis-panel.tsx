"use client";

import {
  Activity,
  BarChart3,
  Database,
  Download,
  Info,
  Route,
} from "lucide-react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { CollapsiblePanel } from "@/components/organisms/collapsible-panel";
import { PanelHeading } from "@/components/molecules/panel-heading";

type RouteAnalysisPanelProps = {
  open: boolean;
  onToggle: () => void;
};

const metrics = [
  ["Distance", "—", "—"],
  ["Ascent", "—", "—"],
  ["Descent", "—", "—"],
  ["Max slope", "—", "—"],
  ["Cells", "—", "—"],
];

export function RouteAnalysisPanel({ open, onToggle }: RouteAnalysisPanelProps) {
  return (
    <CollapsiblePanel open={open} onToggle={onToggle} side="right" label="Route analysis" className="route-analysis">
      <PanelHeading
        eyebrow="Route analysis"
        title="Comparative telemetry"
        eyebrowAccessory={<Activity size={13} aria-hidden="true" />}
        action={<StatusBadge tone="pending">NOT RUN</StatusBadge>}
      />

      <div className="panel-content">
        <div className="analysis-note">
          <Info size={15} aria-hidden="true" />
          <p>Metrics, profiles and route geometry will be rendered exactly from the backend mission response.</p>
        </div>

        <section className="route-card route-card--muted" aria-label="Shortest route placeholder">
          <div className="route-card__header">
            <div className="route-card__title"><span className="route-swatch route-swatch--direct" /><span>Shortest</span></div>
            <span className="mini-badge">route_id</span>
          </div>
          <p>Waiting for a valid origin and destination.</p>
        </section>

        <section className="route-card route-card--adaptive" aria-label="Terrain-aware route placeholder">
          <div className="route-card__header">
            <div className="route-card__title"><span className="route-swatch route-swatch--adaptive" /><span>Terrain-aware</span></div>
            <span className="mini-badge">route_id</span>
          </div>
          <p>Waiting for terrain configuration and route calculation.</p>
        </section>

        <section className="comparison-card" aria-label="Route comparison metrics">
          <div className="comparison-card__heading">
            <span><BarChart3 size={14} aria-hidden="true" /> Comparison matrix</span>
            <span className="field-status">MVP CONTRACT</span>
          </div>
          <div className="metric-table">
            <div className="metric-table__row metric-table__row--heading"><span>Metric</span><span>Shortest</span><span>Terrain-aware</span></div>
            {metrics.map(([label, shortest, adaptive]) => (
              <div className="metric-table__row" key={label}><span>{label}</span><span>{shortest}</span><span>{adaptive}</span></div>
            ))}
          </div>
        </section>

        <section className="profile-card" aria-label="Elevation profile placeholder">
          <div className="comparison-card__heading">
            <span><Route size={14} aria-hidden="true" /> Elevation profile</span>
            <span className="field-status">NO PATH</span>
          </div>
          <div className="profile-placeholder">
            <div className="profile-placeholder__grid" aria-hidden="true" />
            <span>Profile is unavailable until the backend returns a route.</span>
          </div>
        </section>

        <section className="source-card" aria-label="Data provenance placeholder">
          <div className="comparison-card__heading">
            <span><Database size={14} aria-hidden="true" /> Provenance</span>
            <span className="field-status">PENDING</span>
          </div>
          <p>NASA dataset IDs, instrument metadata, CRS and limitations will appear here.</p>
        </section>

        <div className="analysis-actions">
          <button type="button" disabled><Download size={14} aria-hidden="true" /> Offline pack</button>
          <button type="button" disabled>Export manifest</button>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
