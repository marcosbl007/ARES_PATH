"use client";

import {
  Compass,
  Layers,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Route,
  Ruler,
} from "lucide-react";

import { IconButton } from "@/components/atoms/icon-button";
import { StatusDot } from "@/components/atoms/status-dot";
import { LayerChip } from "@/components/molecules/layer-chip";
import { RasterTileLayer } from "@/features/mars-map/components/raster-tile-layer";
import type { MapLayer, MapLayerId } from "@/features/mars-map/types";
import type { MissionResponse, RegionMetadata } from "@/shared/types/api-contract";
import { gridPathToSvgPath, gridPointToSvg } from "@/features/mars-map/utils/grid-path";

type MapViewportProps = {
  layers: MapLayer[];
  zoomLevel: number;
  regionId: string;
  metadata: RegionMetadata | null;
  mission: MissionResponse | null;
  onToggleLayer: (layerId: MapLayerId) => void;
  onZoomChange: (nextZoom: number) => void;
  onResetView: () => void;
};

const viewport = { width: 1000, height: 1000, padding: 0 } as const;

function pointLabel(point: { row: number; col: number } | undefined, label: string) {
  return point ? `${label} / R${point.row} C${point.col}` : `${label} / NOT SET`;
}

function routeForMode(mission: MissionResponse | null, mode: "shortest" | "terrain_aware") {
  return mission?.routes.find((route) => route.mode === mode);
}

function rowAxisLabels(metadata: RegionMetadata | null) {
  if (!metadata) return ["ROW / PENDING"];

  const lastRow = metadata.shape[0] - 1;
  const middleRow = Math.floor(lastRow / 2);
  return [`ROW ${lastRow}`, `ROW ${middleRow}`, "ROW 0"];
}

export function MapViewport({
  layers,
  zoomLevel,
  regionId,
  metadata,
  mission,
  onToggleLayer,
  onZoomChange,
  onResetView,
}: MapViewportProps) {
  const shortest = routeForMode(mission, "shortest");
  const terrainAware = routeForMode(mission, "terrain_aware");
  const start = shortest?.grid_path[0] ?? terrainAware?.grid_path[0];
  const destination = shortest?.grid_path.at(-1) ?? terrainAware?.grid_path.at(-1);
  const startCoordinate = start ? gridPointToSvg(start, metadata?.shape, viewport) : null;
  const destinationCoordinate = destination ? gridPointToSvg(destination, metadata?.shape, viewport) : null;
  const activeLayers = layers.filter((layer) => layer.active);

  return (
    <section className="map-stage" aria-label="Mars native raster viewport">
      <div className="map-stage__axis map-stage__axis--top" aria-hidden="true">
        <span>RASTER / {regionId || "NO REGION"}</span>
        <span>{metadata ? "CRS: NATIVE MARS" : "CRS: PENDING"}</span>
      </div>

      <div className="map-stage__body">
        <div className="map-stage__axis map-stage__axis--left" aria-hidden="true">
          {rowAxisLabels(metadata).map((label) => <span key={label}>{label}</span>)}
        </div>

        <div className="map-canvas">
          <div className="map-canvas__vignette" aria-hidden="true" />
          <div className="map-canvas__demo-label">
            <StatusDot tone={metadata ? "blue" : "demo"} />
            {metadata ? "NATIVE RASTER / API RESPONSE" : "RASTER / METADATA PENDING"}
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
            )) : <span className="map-layer-dock__empty">Raster metadata pending</span>}
          </div>

          <div className="map-controls" aria-label="Map controls">
            <IconButton label="Zoom in" icon={Plus} size="sm" onClick={() => onZoomChange(Math.min(5, zoomLevel + 1))} />
            <IconButton label="Zoom out" icon={Minus} size="sm" onClick={() => onZoomChange(Math.max(1, zoomLevel - 1))} />
            <span className="map-controls__divider" />
            <IconButton label="Reset view" icon={RotateCcw} size="sm" onClick={onResetView} />
            <IconButton label="Compass" icon={Compass} size="sm" />
            <IconButton label="Measure distance" icon={Ruler} size="sm" />
          </div>

          <div className="map-graphic" style={{ transform: `scale(${1 + (zoomLevel - 1) * 0.045})` }}>
            <div className="map-surface">
              <div className="map-raster-stack" aria-label="Backend raster layers">
                {activeLayers.length > 0
                  ? activeLayers.map((layer) => (
                    <RasterTileLayer key={layer.id} layer={layer} zoomLevel={zoomLevel} />
                  ))
                  : <div className="map-raster-empty">SELECT A RASTER LAYER</div>}
              </div>

              <svg
                className="map-route-overlay"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                role="img"
                aria-label="Routes returned by the backend over the native raster"
              >
                {shortest ? <path className="map-route map-route--direct" d={gridPathToSvgPath(shortest.grid_path, metadata?.shape, viewport)} /> : null}
                {terrainAware ? <path className="map-route map-route--adaptive" d={gridPathToSvgPath(terrainAware.grid_path, metadata?.shape, viewport)} /> : null}
                {startCoordinate ? <><circle className="map-point map-point--start" cx={startCoordinate.x} cy={startCoordinate.y} r="9" /><circle className="map-point__core" cx={startCoordinate.x} cy={startCoordinate.y} r="3" /></> : null}
                {destinationCoordinate ? <><circle className="map-point map-point--goal" cx={destinationCoordinate.x} cy={destinationCoordinate.y} r="9" /><circle className="map-point__core map-point__core--goal" cx={destinationCoordinate.x} cy={destinationCoordinate.y} r="3" /></> : null}
              </svg>
            </div>
          </div>

          <div className="map-marker map-marker--start">
            <MapPin size={14} aria-hidden="true" />
            <span>{pointLabel(start, "ORIGIN")}</span>
          </div>
          <div className="map-marker map-marker--goal">
            <MapPin size={14} aria-hidden="true" />
            <span>{pointLabel(destination, "DESTINATION")}</span>
          </div>

          <div className="map-legend" aria-label="Map legend">
            {terrainAware ? <span><i className="legend-line legend-line--adaptive" /> Terrain-aware</span> : null}
            {shortest ? <span><i className="legend-line legend-line--direct" /> Shortest</span> : null}
            <span><i className="legend-dot legend-dot--raster" /> Native raster</span>
          </div>
        </div>
      </div>

      <div className="map-stage__footer">
        <span><Route size={12} aria-hidden="true" /> {mission ? `${mission.routes.length} routes from backend` : "No route response"}</span>
        <span>ZOOM {zoomLevel} / 5</span>
        <span>COORDINATES: GRID ROW/COL</span>
      </div>
    </section>
  );
}
