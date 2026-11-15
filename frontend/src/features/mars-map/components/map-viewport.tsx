"use client";

import {
  Compass,
  Grid2X2,
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
import type { MissionResponse, RegionMetadata } from "@/shared/types/api-contract";
import { gridPathToSvgPath, gridPointToSvg } from "@/features/mars-map/utils/grid-path";

export type MapLayerId = "elevation" | "optical" | "slope" | "thermal";

export type MapLayer = {
  id: MapLayerId;
  label: string;
  color: string;
  active: boolean;
};

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

const contourLines = [
  "M 40 520 C 150 410, 230 535, 360 430 S 620 340, 960 420",
  "M 30 470 C 170 360, 275 470, 390 380 S 640 285, 990 365",
  "M 45 410 C 150 325, 270 420, 420 330 S 650 230, 970 305",
  "M 65 345 C 185 270, 290 350, 450 270 S 680 180, 950 240",
  "M 90 280 C 215 220, 330 290, 480 220 S 710 135, 930 180",
];

const viewport = { width: 1000, height: 700, padding: 44 } as const;

function pointLabel(point: { row: number; col: number } | undefined, label: string) {
  return point ? `${label} / R${point.row} C${point.col}` : `${label} / NOT SET`;
}
function routeForMode(mission: MissionResponse | null, mode: "shortest" | "terrain_aware") {
  return mission?.routes.find((route) => route.mode === mode);
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

  return (
    <section className="map-stage" aria-label="Mars grid route viewport">
      <div className="map-stage__axis map-stage__axis--top" aria-hidden="true">
        <span>GRID / {regionId || "NO REGION"}</span>
        <span>CRS: {metadata ? "LOADED" : "PENDING"}</span>
      </div>

      <div className="map-stage__body">
        <div className="map-stage__axis map-stage__axis--left" aria-hidden="true">
          <span>R04</span>
          <span>R03</span>
          <span>R02</span>
          <span>R01</span>
        </div>

        <div className="map-canvas">
          <div className="map-canvas__vignette" aria-hidden="true" />
          <div className="map-canvas__demo-label">
            <StatusDot tone={mission ? "blue" : "demo"} />
            {mission ? "GRID ROUTES / API RESPONSE" : "GRID PREVIEW / RASTER IMAGE NOT SERVED"}
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
            )) : <span className="map-layer-dock__empty">Metadata pending</span>}
          </div>

          <div className="map-controls" aria-label="Map controls">
            <IconButton label="Zoom in" icon={Plus} size="sm" onClick={() => onZoomChange(Math.min(5, zoomLevel + 1))} />
            <IconButton label="Zoom out" icon={Minus} size="sm" onClick={() => onZoomChange(Math.max(1, zoomLevel - 1))} />
            <span className="map-controls__divider" />
            <IconButton label="Reset view" icon={RotateCcw} size="sm" onClick={onResetView} />
            <IconButton label="Compass" icon={Compass} size="sm" />
            <IconButton label="Toggle grid" icon={Grid2X2} size="sm" />
            <IconButton label="Measure distance" icon={Ruler} size="sm" />
          </div>

          <div className="map-graphic" style={{ transform: `scale(${1 + (zoomLevel - 1) * 0.045})` }}>
            <svg viewBox="0 0 1000 700" role="img" aria-label="Grid preview with routes returned by the backend">
              <defs>
                <pattern id="map-grid" width="54" height="54" patternUnits="userSpaceOnUse">
                  <path d="M 54 0 L 0 0 0 54" fill="none" stroke="rgba(92, 180, 255, .13)" strokeWidth="1" />
                  <circle cx="0" cy="0" r="2" fill="rgba(255, 183, 3, .35)" />
                </pattern>
                <linearGradient id="map-ground" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#111b2b" />
                  <stop offset="0.52" stopColor="#0a111d" />
                  <stop offset="1" stopColor="#1c160e" />
                </linearGradient>
              </defs>
              <rect width="1000" height="700" fill="url(#map-ground)" />
              <rect width="1000" height="700" fill="url(#map-grid)" />
              <g className="map-contours" fill="none" aria-hidden="true">
                {contourLines.map((path, index) => <path d={path} key={path} opacity={0.22 + index * 0.06} />)}
              </g>
              {shortest ? <path className="map-route map-route--direct" d={gridPathToSvgPath(shortest.grid_path, metadata?.shape, viewport)} /> : null}
              {terrainAware ? <path className="map-route map-route--adaptive" d={gridPathToSvgPath(terrainAware.grid_path, metadata?.shape, viewport)} /> : null}
              {startCoordinate ? <><circle className="map-point map-point--start" cx={startCoordinate.x} cy={startCoordinate.y} r="9" /><circle className="map-point__core" cx={startCoordinate.x} cy={startCoordinate.y} r="3" /></> : null}
              {destinationCoordinate ? <><circle className="map-point map-point--goal" cx={destinationCoordinate.x} cy={destinationCoordinate.y} r="9" /><circle className="map-point__core map-point__core--goal" cx={destinationCoordinate.x} cy={destinationCoordinate.y} r="3" /></> : null}
            </svg>
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
            <span><i className="legend-line legend-line--adaptive" /> Terrain-aware</span>
            <span><i className="legend-line legend-line--direct" /> Shortest</span>
            <span><i className="legend-dot legend-dot--demo" /> Grid preview</span>
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
