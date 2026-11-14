"use client";

import { useState } from "react";
import {
  Activity,
  BarChart3,
  Cloud,
  CloudDownload,
  Download,
  Globe2,
  Layers,
  Map as MapIcon,
  Route,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Target,
} from "lucide-react";

import { MapViewport, type MapLayer, type MapLayerId } from "@/features/mars-map/components/map-viewport";
import { MissionSetupPanel } from "@/features/mission-planning/components/mission-setup-panel";
import { RouteAnalysisPanel } from "@/features/route-analysis/components/route-analysis-panel";

const initialLayers: MapLayer[] = [
  { id: "elevation", label: "Elevation / pending", color: "#38bdf8", active: true },
  { id: "optical", label: "Optical / pending", color: "#a7f3d0", active: false },
  { id: "slope", label: "Slope / pending", color: "#ffb703", active: false },
  { id: "thermal", label: "Thermal / pending", color: "#fb7185", active: false },
];

const navigationItems = [
  { label: "Traverse", icon: MapIcon, active: true },
  { label: "Parameters", icon: SlidersHorizontal, active: false },
  { label: "Telemetry", icon: BarChart3, active: false },
  { label: "Offline", icon: CloudDownload, active: false },
];

const railItems = [
  { label: "Region", icon: Globe2 },
  { label: "Layers", icon: Layers },
  { label: "Routes", icon: Route },
  { label: "Targets", icon: Target },
  { label: "Telemetry", icon: Activity },
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

  const resetView = () => setZoomLevel(1);

  return (
    <div className="ares-shell">
      <div className="ares-shell__scanlines" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar__identity">
          <div className="brand-lockup">
            <span className="brand-lockup__icon"><Activity size={15} aria-hidden="true" /></span>
            <span className="brand-lockup__name">ARES PATH</span>
            <span className="brand-lockup__version">FOUNDATION</span>
          </div>
          <div className="mission-chip">
            <span className="status-dot status-dot--red" />
            <span>PROTOTYPE / NOT OPERATIONAL</span>
            <span className="mission-chip__divider">/</span>
            <strong>MISSION NOT LOADED</strong>
          </div>
        </div>

        <nav className="topnav" aria-label="Primary navigation">
          {navigationItems.map(({ label, icon: Icon, active }) => (
            <button className={`topnav__item${active ? " topnav__item--active" : ""}`} key={label} type="button" aria-current={active ? "page" : undefined}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="topbar__actions">
          <span className="relay-status"><Cloud size={13} aria-hidden="true" /> API / PENDING</span>
          <button className="toolbar-button" type="button" disabled title="Available after a mission is saved">
            <Download size={13} aria-hidden="true" /> Export pack
          </button>
          <span className="operator-badge" aria-label="Operator interface placeholder">UI</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="side-rail" aria-label="Workspace tools">
          <div className="side-rail__group">
            {railItems.map(({ label, icon: Icon }, index) => (
              <button className={`rail-button${index === 1 ? " rail-button--active" : ""}`} key={label} type="button" title={label} aria-label={label}>
                <Icon size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="side-rail__group">
            <button className="rail-button" type="button" title="Settings" aria-label="Settings"><Settings2 size={15} aria-hidden="true" /></button>
            <button className="rail-button rail-button--alert" type="button" title="Diagnostics" aria-label="Diagnostics"><ShieldAlert size={15} aria-hidden="true" /></button>
          </div>
        </aside>

        <MissionSetupPanel open={setupOpen} onToggle={() => setSetupOpen((current) => !current)} />

        <main className="main-stage">
          <MapViewport
            layers={layers}
            zoomLevel={zoomLevel}
            onToggleLayer={toggleLayer}
            onZoomChange={setZoomLevel}
            onResetView={resetView}
          />
        </main>

        <RouteAnalysisPanel open={analysisOpen} onToggle={() => setAnalysisOpen((current) => !current)} />
      </div>

      <footer className="statusbar">
        <span><span className="status-dot status-dot--blue" /> UI FOUNDATION / READY</span>
        <span>DATA SOURCES: PENDING</span>
        <span>CRS: PENDING</span>
        <span className="statusbar__right">NO SCIENTIFIC VALUES LOADED</span>
      </footer>
    </div>
  );
}
