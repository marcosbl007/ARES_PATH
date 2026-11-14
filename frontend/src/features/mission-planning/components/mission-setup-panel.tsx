"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleDot,
  MapPinned,
  MousePointer2,
  SlidersHorizontal,
  Target,
} from "lucide-react";

type MissionSetupPanelProps = {
  open: boolean;
  onToggle: () => void;
};

export function MissionSetupPanel({ open, onToggle }: MissionSetupPanelProps) {
  const [selectionMode, setSelectionMode] = useState<"origin" | "destination">("origin");

  return (
    <aside className={`mission-setup${open ? " mission-setup--open" : " mission-setup--closed"}`} aria-label="Mission setup">
      <button className="panel-toggle panel-toggle--left" type="button" onClick={onToggle} aria-label={open ? "Collapse mission setup" : "Open mission setup"}>
        {open ? <ChevronLeft size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
      </button>

      <div className="panel-heading">
        <div>
          <p className="eyebrow"><span className="status-dot status-dot--blue" /> Mission setup</p>
          <h2>Traverse configuration</h2>
        </div>
        <SlidersHorizontal size={17} aria-hidden="true" />
      </div>

      <div className="panel-content">
        <div className="demo-callout">
          <span className="demo-callout__label">SYNTHETIC / DEMO</span>
          <p>Inputs stay disabled until region metadata and valid raster bounds arrive from FastAPI.</p>
        </div>

        <label className="field-label" htmlFor="region-id">Region contract</label>
        <div className="field-shell">
          <MapPinned size={15} aria-hidden="true" />
          <input id="region-id" readOnly value="jezero_demo" aria-describedby="region-note" />
          <span className="field-status">PENDING</span>
        </div>
        <p className="field-note" id="region-note">Provisional ID from the shared contract; not a verified dataset.</p>

        <div className="field-label-row">
          <span className="field-label">Coordinate system</span>
          <span className="mini-badge">grid_row_col</span>
        </div>

        <div className="selection-block">
          <div className="selection-block__header">
            <span className="field-label">Mission points</span>
            <span className="field-status">2 REQUIRED</span>
          </div>
          <div className="selection-tabs" role="tablist" aria-label="Point selection mode">
            <button className={selectionMode === "origin" ? "selection-tab selection-tab--active" : "selection-tab"} type="button" onClick={() => setSelectionMode("origin")} role="tab" aria-selected={selectionMode === "origin"}>
              <CircleDot size={14} aria-hidden="true" /> Origin
            </button>
            <button className={selectionMode === "destination" ? "selection-tab selection-tab--active" : "selection-tab"} type="button" onClick={() => setSelectionMode("destination")} role="tab" aria-selected={selectionMode === "destination"}>
              <Target size={14} aria-hidden="true" /> Destination
            </button>
          </div>
          <button className="coordinate-placeholder" type="button">
            <MousePointer2 size={15} aria-hidden="true" />
            <span>
              <strong>{selectionMode === "origin" ? "Select origin on map" : "Select destination on map"}</strong>
              <small>row — / col —</small>
            </span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="setup-divider" />

        <div className="selection-block">
          <div className="selection-block__header">
            <span className="field-label">Terrain criteria</span>
            <span className="field-status">BACKEND OWNED</span>
          </div>
          <div className="criteria-row"><span>Route mode</span><strong>COMPARE</strong></div>
          <div className="criteria-row"><span>Max slope</span><strong>— deg</strong></div>
          <div className="criteria-row"><span>Slope weight</span><strong>—</strong></div>
        </div>

        <button className="primary-action" type="button" disabled>
          <Target size={15} aria-hidden="true" />
          Plan mission
          <span className="primary-action__suffix">DATA REQUIRED</span>
        </button>
      </div>
    </aside>
  );
}
