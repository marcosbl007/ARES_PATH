"use client";

import { useState } from "react";
import {
  CircleDot,
  MapPinned,
  SlidersHorizontal,
  Target,
} from "lucide-react";

import { StatusDot } from "@/components/atoms/status-dot";
import { PanelHeading } from "@/components/molecules/panel-heading";
import { CollapsiblePanel } from "@/components/organisms/collapsible-panel";
import type { AsyncStatus } from "@/features/mission-planning/hooks/use-mission-planning";
import type { RegionMetadata, ScientificTarget } from "@/shared/types/api-contract";

export type PointDraft = {
  row: string;
  col: string;
};

type MissionSetupPanelProps = {
  open: boolean;
  onToggle: () => void;
  regions: RegionMetadata[];
  selectedRegionId: string;
  onRegionChange: (regionId: string) => void;
  metadata: RegionMetadata | null;
  regionStatus: AsyncStatus;
  scientificTargets: ScientificTarget[];
  selectedTargetIds: string[];
  onTargetToggle: (targetId: string) => void;
  start: PointDraft;
  destination: PointDraft;
  onPointChange: (point: "start" | "destination", axis: keyof PointDraft, value: string) => void;
  maxSlopeDeg: string;
  slopeWeight: string;
  onMaxSlopeChange: (value: string) => void;
  onSlopeWeightChange: (value: string) => void;
  planStatus: AsyncStatus;
  canPlan: boolean;
  validationMessage: string | null;
  errorMessage: string | null;
  onPlan: () => void;
};

function pointSummary(point: PointDraft) {
  if (point.row === "" || point.col === "") {
    return "row — / col —";
  }

  return `row ${point.row} / col ${point.col}`;
}
function regionStateLabel(status: AsyncStatus, metadata: RegionMetadata | null) {
  if (status === "loading") return "LOADING";
  if (status === "error") return "ERROR";
  return metadata ? "READY" : "PENDING";
}

export function MissionSetupPanel({
  open,
  onToggle,
  regions,
  selectedRegionId,
  onRegionChange,
  metadata,
  regionStatus,
  scientificTargets,
  selectedTargetIds,
  onTargetToggle,
  start,
  destination,
  onPointChange,
  maxSlopeDeg,
  slopeWeight,
  onMaxSlopeChange,
  onSlopeWeightChange,
  planStatus,
  canPlan,
  validationMessage,
  errorMessage,
  onPlan,
}: MissionSetupPanelProps) {
  const [selectionMode, setSelectionMode] = useState<"origin" | "destination">("origin");
  const activePoint = selectionMode === "origin" ? start : destination;

  return (
    <CollapsiblePanel open={open} onToggle={onToggle} side="left" label="Mission setup" className="mission-setup">
      <PanelHeading
        eyebrow="Mission setup"
        title="Traverse configuration"
        eyebrowAccessory={<StatusDot tone="blue" />}
        action={<SlidersHorizontal size={17} aria-hidden="true" />}
      />

      <div className="panel-content">
        <div className="demo-callout">
          <span className="demo-callout__label">BACKEND CONNECTED</span>
          <p>Coordinates are raster cells. The backend owns terrain analysis, routing and scientific values.</p>
        </div>

        <label className="field-label" htmlFor="region-id">Region dataset</label>
        <div className="field-shell">
          <MapPinned size={15} aria-hidden="true" />
          <select
            id="region-id"
            className="field-select"
            value={selectedRegionId}
            onChange={(event) => onRegionChange(event.target.value)}
            disabled={regions.length === 0}
            aria-describedby="region-note"
          >
            {regions.length === 0 ? <option value="">No regions available</option> : null}
            {regions.map((region) => (
              <option key={region.region_id} value={region.region_id}>
                {region.region_id}
              </option>
            ))}
          </select>
          <span className="field-status">{regionStateLabel(regionStatus, metadata)}</span>
        </div>
        <p className="field-note" id="region-note">
          {metadata
            ? `${metadata.shape[1]} × ${metadata.shape[0]} cells · ${metadata.valid_cells} valid cells`
            : "Waiting for region metadata from FastAPI."}
        </p>

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
            <button
              className={selectionMode === "origin" ? "selection-tab selection-tab--active" : "selection-tab"}
              type="button"
              onClick={() => setSelectionMode("origin")}
              role="tab"
              aria-selected={selectionMode === "origin"}
            >
              <CircleDot size={14} aria-hidden="true" /> Origin
            </button>
            <button
              className={selectionMode === "destination" ? "selection-tab selection-tab--active" : "selection-tab"}
              type="button"
              onClick={() => setSelectionMode("destination")}
              role="tab"
              aria-selected={selectionMode === "destination"}
            >
              <Target size={14} aria-hidden="true" /> Destination
            </button>
          </div>

          <div className="coordinate-editor" aria-label={`${selectionMode} grid coordinate`}>
            <span className="coordinate-editor__label">Editing {selectionMode}</span>
            <div className="coordinate-editor__fields">
              {(["row", "col"] as const).map((axis) => (
                <label key={axis}>
                  <span>{axis}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={activePoint[axis]}
                    onChange={(event) => onPointChange(selectionMode === "origin" ? "start" : "destination", axis, event.target.value)}
                    aria-label={`${selectionMode} ${axis}`}
                    placeholder="—"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="coordinate-summary">
            <span><CircleDot size={12} aria-hidden="true" /> Origin: {pointSummary(start)}</span>
            <span><Target size={12} aria-hidden="true" /> Destination: {pointSummary(destination)}</span>
          </div>
        </div>

        <div className="setup-divider" />

        <div className="selection-block">
          <div className="selection-block__header">
            <span className="field-label">Terrain criteria</span>
            <span className="field-status">BACKEND OWNED</span>
          </div>
          <div className="criteria-input-row">
            <label htmlFor="max-slope">Max slope / deg</label>
            <input id="max-slope" type="number" min="0.1" max="90" step="0.1" value={maxSlopeDeg} onChange={(event) => onMaxSlopeChange(event.target.value)} />
          </div>
          <div className="criteria-input-row">
            <label htmlFor="slope-weight">Slope weight</label>
            <input id="slope-weight" type="number" min="0" step="0.1" value={slopeWeight} onChange={(event) => onSlopeWeightChange(event.target.value)} />
          </div>
        </div>

        <div className="selection-block target-selector">
          <div className="selection-block__header">
            <span className="field-label">Scientific context</span>
            <span className="field-status">{scientificTargets.length} AVAILABLE</span>
          </div>
          {scientificTargets.length === 0 ? (
            <p className="field-note">No documented target entries were returned for this region.</p>
          ) : (
            <div className="target-list">
              {scientificTargets.map((target) => (
                <label className="target-option" key={target.target_id}>
                  <input
                    type="checkbox"
                    checked={selectedTargetIds.includes(target.target_id)}
                    onChange={() => onTargetToggle(target.target_id)}
                  />
                  <span>
                    <strong>{target.name}</strong>
                    <small>{target.is_navigable ? "verified coordinate" : "contextual only"} · {target.instrument}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {validationMessage || errorMessage ? (
          <p className="form-error" role="alert">{validationMessage ?? errorMessage}</p>
        ) : null}

        <button className="primary-action" type="button" disabled={!canPlan || planStatus === "loading"} onClick={onPlan}>
          <Target size={15} aria-hidden="true" />
          {planStatus === "loading" ? "Planning mission" : "Plan mission"}
          <span className="primary-action__suffix">
            {planStatus === "loading" ? "REQUESTING" : canPlan ? "READY" : "DATA REQUIRED"}
          </span>
        </button>
      </div>
    </CollapsiblePanel>
  );
}
