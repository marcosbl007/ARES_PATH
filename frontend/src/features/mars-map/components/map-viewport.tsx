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

export function MapViewport({
  layers,
  zoomLevel,
  onToggleLayer,
  onZoomChange,
  onResetView,
}: MapViewportProps) {
  return (
    <section className="map-stage" aria-label="Mars map viewport">
      <div className="map-stage__axis map-stage__axis--top" aria-hidden="true">
        <span>GRID / JEZERO / PROVISIONAL</span>
        <span>CRS: PENDING BACKEND METADATA</span>
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
            <span className="status-dot status-dot--demo" />
            SYNTHETIC SURFACE / UI PREVIEW
          </div>

          <div className="map-layer-dock" aria-label="Map layers">
            <div className="map-layer-dock__title">
              <Layers size={14} aria-hidden="true" />
              <span>Layers</span>
            </div>
            {layers.map((layer) => (
              <button
                className={`layer-chip${layer.active ? " layer-chip--active" : ""}`}
                key={layer.id}
                type="button"
                onClick={() => onToggleLayer(layer.id)}
                aria-pressed={layer.active}
              >
                <span className="layer-chip__swatch" style={{ backgroundColor: layer.color }} />
                {layer.label}
              </button>
            ))}
          </div>

          <div className="map-controls" aria-label="Map controls">
            <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => onZoomChange(Math.min(5, zoomLevel + 1))}>
              <Plus size={15} aria-hidden="true" />
            </button>
            <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => onZoomChange(Math.max(1, zoomLevel - 1))}>
              <Minus size={15} aria-hidden="true" />
            </button>
            <span className="map-controls__divider" />
            <button type="button" title="Reset view" aria-label="Reset view" onClick={onResetView}>
              <RotateCcw size={14} aria-hidden="true" />
            </button>
            <button type="button" title="Compass" aria-label="Compass">
              <Compass size={14} aria-hidden="true" />
            </button>
            <button type="button" title="Grid" aria-label="Toggle grid">
              <Grid2X2 size={14} aria-hidden="true" />
            </button>
            <button type="button" title="Measure" aria-label="Measure distance">
              <Ruler size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="map-graphic" style={{ transform: `scale(${1 + (zoomLevel - 1) * 0.045})` }}>
            <svg viewBox="0 0 1000 700" role="img" aria-label="Synthetic terrain illustration for layout preview">
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
                <linearGradient id="route-fill" x1="0" x2="1">
                  <stop offset="0" stopColor="#38bdf8" stopOpacity=".1" />
                  <stop offset="1" stopColor="#ffb703" stopOpacity=".05" />
                </linearGradient>
              </defs>
              <rect width="1000" height="700" fill="url(#map-ground)" />
              <rect width="1000" height="700" fill="url(#map-grid)" />
              <g className="map-contours" fill="none">
                {contourLines.map((path, index) => (
                  <path d={path} key={path} opacity={0.22 + index * 0.06} />
                ))}
              </g>
              <path className="map-route map-route--direct" d="M 145 545 L 805 172" />
              <path className="map-route map-route--adaptive" d="M 145 545 C 250 555, 260 455, 390 455 S 545 360, 625 340 S 745 230, 805 172" />
              <path className="map-route__fill" d="M 145 545 C 250 555, 260 455, 390 455 S 545 360, 625 340 S 745 230, 805 172 L 805 700 L 145 700 Z" fill="url(#route-fill)" />
              <circle className="map-point map-point--start" cx="145" cy="545" r="9" />
              <circle className="map-point map-point--goal" cx="805" cy="172" r="9" />
              <circle className="map-point__core" cx="145" cy="545" r="3" />
              <circle className="map-point__core map-point__core--goal" cx="805" cy="172" r="3" />
            </svg>
          </div>

          <div className="map-marker map-marker--start">
            <MapPin size={14} aria-hidden="true" />
            <span>ORIGIN / PENDING</span>
          </div>
          <div className="map-marker map-marker--goal">
            <MapPin size={14} aria-hidden="true" />
            <span>DESTINATION / PENDING</span>
          </div>

          <div className="map-legend" aria-label="Map legend">
            <span><i className="legend-line legend-line--adaptive" /> Adaptive route</span>
            <span><i className="legend-line legend-line--direct" /> Shortest route</span>
            <span><i className="legend-dot legend-dot--demo" /> Synthetic only</span>
          </div>
        </div>
      </div>

      <div className="map-stage__footer">
        <span><Route size={12} aria-hidden="true" /> Routes render from backend response</span>
        <span>ZOOM {zoomLevel} / 5</span>
        <span>COORDINATES: UNAVAILABLE</span>
      </div>
    </section>
  );
}
