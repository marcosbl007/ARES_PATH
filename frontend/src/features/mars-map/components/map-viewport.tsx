"use client";

import { useRef, useState } from "react";
import {
  Compass,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Route,
  Ruler,
} from "lucide-react";

import { IconButton } from "@/components/atoms/icon-button";
import { StatusDot } from "@/components/atoms/status-dot";
import { LayerChip } from "@/components/molecules/layer-chip";
import { OpenLayersMap } from "@/features/mars-map/components/openlayers-map";
import type { MapLayer, MapLayerId, MarsMapController, MarsMapStatus } from "@/features/mars-map/types";
import type { MissionResponse, RegionMetadata } from "@/shared/types/api-contract";

type MapViewportProps = {
  layers: MapLayer[];
  regionId: string;
  metadata: RegionMetadata | null;
  mission: MissionResponse | null;
  onToggleLayer: (layerId: MapLayerId) => void;
};

function rowAxisLabels(metadata: RegionMetadata | null) {
  if (!metadata) return ["ROW / PENDING"];

  const lastRow = metadata.shape[0] - 1;
  const middleRow = Math.floor(lastRow / 2);
  return [`ROW ${lastRow}`, `ROW ${middleRow}`, "ROW 0"];
}

function statusLabel(status: MarsMapStatus) {
  if (status === "ready") return "MARS TREK / READY";
  if (status === "warning") return "LOCAL CRS / CHECK ALIGNMENT";
  if (status === "error") return "MARS TREK / TILE ERROR";
  return "MARS TREK / LOADING";
}

export function MapViewport({
  layers,
  regionId,
  metadata,
  mission,
  onToggleLayer,
}: MapViewportProps) {
  const controllerRef = useRef<MarsMapController | null>(null);
  const [mapStatus, setMapStatus] = useState<MarsMapStatus>("loading");
  const activeLayers = layers.filter((layer) => layer.active);
  const activeLayerLabels = activeLayers
    .filter((layer) => layer.sourceKind === "mars-trek")
    .map((layer) => layer.id === "hirise" ? "HiRISE" : "CTX");

  return (
    <section className="map-stage" aria-label="Mars Trek orbital map and computational overlays">
      <div className="map-stage__axis map-stage__axis--top" aria-hidden="true">
        <span>JEZERO / {regionId || "NO REGION"}</span>
        <span>{metadata ? "CRS: MARS TREK + LOCAL TRANSFORM" : "CRS: PENDING"}</span>
      </div>

      <div className="map-stage__body">
        <div className="map-stage__axis map-stage__axis--left" aria-hidden="true">
          {rowAxisLabels(metadata).map((label) => <span key={label}>{label}</span>)}
        </div>

        <div className="map-canvas">
          <div className="map-canvas__vignette" aria-hidden="true" />
          <div className="map-canvas__demo-label">
            <StatusDot tone={mapStatus === "error" ? "red" : mapStatus === "warning" ? "demo" : "blue"} />
            {statusLabel(mapStatus)}
          </div>

          <div className="map-layer-dock" aria-label="Map layers">
            <div className="map-layer-dock__title">
              <Layers size={14} aria-hidden="true" />
              <span>Layers</span>
            </div>
            {layers.length > 0 ? layers.map((layer) => (
              <LayerChip
                key={layer.id}
                label={layer.label}
                color={layer.color}
                active={layer.active}
                onToggle={() => onToggleLayer(layer.id)}
              />
            )) : <span className="map-layer-dock__empty">NASA catalog pending</span>}
          </div>

          <div className="map-controls" aria-label="Map controls">
            <IconButton label="Zoom in" icon={Plus} size="sm" onClick={() => controllerRef.current?.zoomIn()} />
            <IconButton label="Zoom out" icon={Minus} size="sm" onClick={() => controllerRef.current?.zoomOut()} />
            <span className="map-controls__divider" />
            <IconButton label="Reset regional view" icon={RotateCcw} size="sm" onClick={() => controllerRef.current?.resetView()} />
            <IconButton label="Reset map rotation" icon={Compass} size="sm" onClick={() => controllerRef.current?.resetRotation()} />
            <IconButton label="Center computational ROI" icon={Ruler} size="sm" onClick={() => controllerRef.current?.fitComputationalExtent()} />
          </div>

          <OpenLayersMap
            layers={layers}
            metadata={metadata}
            mission={mission}
            regionId={regionId}
            controllerRef={controllerRef}
            onStatusChange={setMapStatus}
          />

          <div className="map-legend" aria-label="Map legend">
            {activeLayerLabels.map((label) => (
              <span key={label}><i className="legend-dot legend-dot--orbital" /> {label} orbital</span>
            ))}
            {mission?.routes.some((route) => route.mode === "terrain_aware") ? (
              <span><i className="legend-line legend-line--adaptive" /> Terrain-aware</span>
            ) : null}
            {mission?.routes.some((route) => route.mode === "shortest") ? (
              <span><i className="legend-line legend-line--direct" /> Shortest</span>
            ) : null}
            {metadata ? <span><i className="legend-dot legend-dot--roi" /> Computational ROI</span> : null}
          </div>
        </div>
      </div>

      <div className="map-stage__footer">
        <span><Route size={12} aria-hidden="true" /> {mission ? `${mission.routes.length} routes from backend` : "No route response"}</span>
        <span>{activeLayerLabels.length > 0 ? `${activeLayerLabels.join(" + ")} / WMTS` : "NASA / PENDING"}</span>
        <span>{metadata ? `LOCAL ROI ${metadata.shape[1]} × ${metadata.shape[0]} CELLS` : "LOCAL ROI / PENDING"}</span>
        <span>MAP / PAN + ZOOM</span>
      </div>
    </section>
  );
}
