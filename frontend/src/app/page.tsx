"use client";

import { useState } from "react";

import { StatusDot } from "@/components/atoms/status-dot";
import { AppTopbar } from "@/components/organisms/app-topbar";
import { WorkspaceRail } from "@/components/organisms/workspace-rail";
import { MapViewport, type MapLayer, type MapLayerId } from "@/features/mars-map/components/map-viewport";
import { MissionSetupPanel } from "@/features/mission-planning/components/mission-setup-panel";
import { RouteAnalysisPanel } from "@/features/route-analysis/components/route-analysis-panel";

const initialLayers: MapLayer[] = [
  { id: "elevation", label: "Elevation / pending", color: "#38bdf8", active: true },
  { id: "optical", label: "Optical / pending", color: "#a7f3d0", active: false },
  { id: "slope", label: "Slope / pending", color: "#ffb703", active: false },
  { id: "thermal", label: "Thermal / pending", color: "#fb7185", active: false },
];

export default function Home() {
  const [layers, setLayers] = useState(initialLayers);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [setupOpen, setSetupOpen] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(true);

  const toggleLayer = (layerId: MapLayerId) => {
    setLayers((currentLayers) =>
      currentLayers.map((layer) => (layer.id === layerId ? { ...layer, active: !layer.active } : layer)),
    );
  };

  return (
    <div className="ares-shell" suppressHydrationWarning>
      <div className="ares-shell__scanlines" aria-hidden="true" />

      <AppTopbar />

      <div className="workspace">
        <WorkspaceRail />

        <MissionSetupPanel open={setupOpen} onToggle={() => setSetupOpen((current) => !current)} />

        <main className="main-stage">
          <MapViewport
            layers={layers}
            zoomLevel={zoomLevel}
            onToggleLayer={toggleLayer}
            onZoomChange={setZoomLevel}
            onResetView={() => setZoomLevel(1)}
          />
        </main>

        <RouteAnalysisPanel open={analysisOpen} onToggle={() => setAnalysisOpen((current) => !current)} />
      </div>

      <footer className="statusbar">
        <span>
          <StatusDot tone="blue" /> UI FOUNDATION / READY
        </span>
        <span>DATA SOURCES: PENDING</span>
        <span>CRS: PENDING</span>
        <span className="statusbar__right">NO SCIENTIFIC VALUES LOADED</span>
      </footer>
    </div>
  );
}
