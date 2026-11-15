"use client";

import { Eye, EyeOff, Info, Layers3 } from "lucide-react";

import type { MapLayer, MapLayerId } from "@/features/mars-map/types";

type ScientificLayerExplorerProps = {
  layers: MapLayer[];
  onToggle: (layerId: MapLayerId) => void;
  onOpacityChange: (layerId: MapLayerId, opacity: number) => void;
};

function roleLabel(layer: MapLayer) {
  if (layer.routingRole === "derived_input") return "derived routing input";
  if (layer.routingRole === "input") return "routing input";
  return "display only";
}

function layerSummary(layer: MapLayer) {
  const source = [layer.mission, layer.instrument].filter(Boolean).join(" / ");
  const resolution = layer.spatialResolutionM
    ? `${layer.spatialResolutionM.toFixed(2)} m`
    : "resolution not reported";
  return `${source || "NASA catalog"} · ${resolution}`;
}

export function ScientificLayerExplorer({
  layers,
  onToggle,
  onOpacityChange,
}: ScientificLayerExplorerProps) {
  return (
    <section className="scientific-layer-explorer" aria-label="Scientific layer explorer">
      <div className="selection-block__header">
        <span className="field-label"><Layers3 size={14} aria-hidden="true" /> Scientific layers</span>
        <span className="field-status">{layers.length} CATALOGED</span>
      </div>

      <div className="scientific-layer-list">
        {layers.map((layer) => (
          <details className="scientific-layer" key={layer.id} open={layer.active}>
            <summary className="scientific-layer__summary">
              <button
                type="button"
                className="scientific-layer__visibility"
                aria-label={`${layer.active ? "Hide" : "Show"} ${layer.label}`}
                onClick={(event) => {
                  event.preventDefault();
                  onToggle(layer.id);
                }}
              >
                {layer.active ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
              </button>
              <span className="scientific-layer__swatch" style={{ backgroundColor: layer.color }} />
              <span>
                <strong>{layer.name ?? layer.label}</strong>
                <small>{layerSummary(layer)}</small>
              </span>
            </summary>
            <div className="scientific-layer__body">
              <p><strong>Coverage:</strong> {layer.coverageDescription ?? layer.coverageStatus ?? "Not reported"}</p>
              <p><strong>Role:</strong> {roleLabel(layer)}</p>
              {layer.routingRole === "derived_input" && layer.derivationMethod ? (
                <p><strong>Method:</strong> {layer.derivationMethod}</p>
              ) : null}
              {layer.attribution ? <p><strong>Attribution:</strong> {layer.attribution}</p> : null}
              {layer.sourceUrls?.length ? (
                <p className="scientific-layer__sources">
                  <strong>Sources:</strong>{" "}
                  {layer.sourceUrls.map((url) => <a href={url} key={url} target="_blank" rel="noreferrer">NASA source</a>)}
                </p>
              ) : null}
              {layer.limitations?.length ? (
                <ul className="limitation-list">
                  {layer.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              ) : null}
              <label className="layer-opacity">
                <span>Opacity {Math.round((layer.opacity ?? 1) * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={layer.opacity ?? 1}
                  onChange={(event) => onOpacityChange(layer.id, Number(event.target.value))}
                  aria-label={`${layer.label} opacity`}
                />
              </label>
            </div>
          </details>
        ))}
        {layers.length === 0 ? <p className="field-note">No verified layer descriptors are available.</p> : null}
      </div>
      <p className="field-note"><Info size={12} aria-hidden="true" /> Visual layers do not automatically change the route calculation.</p>
    </section>
  );
}
