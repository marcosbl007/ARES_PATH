"use client";

import {
  Activity,
  BarChart3,
  CloudDownload,
  Database,
  Download,
  FileJson,
  Info,
  Route,
  Smartphone,
  Trash2,
  Upload,
  WifiOff,
} from "lucide-react";

import { StatusBadge } from "@/components/atoms/status-badge";
import { CollapsiblePanel } from "@/components/organisms/collapsible-panel";
import { PanelHeading } from "@/components/molecules/panel-heading";
import { MissionBriefingPanel } from "@/features/mission-reports/components/mission-briefing-panel";
import type { AsyncStatus } from "@/features/mission-planning/hooks/use-mission-planning";
import type { OfflinePackStatus } from "@/features/offline-missions/hooks/use-offline-missions";
import type { MissionPack } from "@/features/offline-missions/types";
import type {
  ElevationProfileResponse,
  MissionResponse,
  RouteResponse,
} from "@/shared/types/api-contract";

type RouteAnalysisPanelProps = {
  open: boolean;
  onToggle: () => void;
  mission: MissionResponse | null;
  profile: ElevationProfileResponse | null;
  status: AsyncStatus;
  errorMessage: string | null;
  profileErrorMessage: string | null;
  offlinePacks: MissionPack[];
  selectedOfflinePackId: string | null;
  offlinePackStatus: OfflinePackStatus;
  offlinePackError: string | null;
  isOnline: boolean;
  onSaveOfflinePack: () => void;
  onSelectOfflinePack: (packageId: string) => void;
  onDeleteOfflinePack: (packageId: string) => void;
  onUseLiveWorkspace: () => void;
  onExportManifest: () => void;
  onImportPack: (file: File) => void;
  onExportBriefing: () => void;
  onPrintBriefing: () => void;
  canInstall: boolean;
  isInstalled: boolean;
  onInstall: () => void;
};

function formatMeters(value: number) {
  return `${value.toFixed(2)} m`;
}
function formatDegrees(value: number) {
  return `${value.toFixed(2)}°`;
}

function formatDelta(value: number, unit: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}${unit}`;
}

function routeDescription(route: RouteResponse) {
  return `${route.metrics.cell_count} cells · ${route.expanded_cells} expanded`;
}

function RouteCard({ route }: { route: RouteResponse }) {
  const isAdaptive = route.mode === "terrain_aware";

  return (
    <section className={`route-card ${isAdaptive ? "route-card--adaptive" : "route-card--shortest"}`} aria-label={`${route.mode} route`}>
      <div className="route-card__header">
        <div className="route-card__title">
          <span className={`route-swatch ${isAdaptive ? "route-swatch--adaptive" : "route-swatch--direct"}`} />
          <span>{isAdaptive ? "Terrain-aware" : "Shortest"}</span>
        </div>
        <span className="mini-badge">{route.route_id}</span>
      </div>
      <p>{routeDescription(route)}</p>
      <div className="route-metrics">
        <span><small>Distance</small><strong>{formatMeters(route.metrics.distance_m)}</strong></span>
        <span><small>Max slope</small><strong>{formatDegrees(route.metrics.max_slope_deg)}</strong></span>
        <span><small>Cost</small><strong>{route.metrics.cost.toFixed(2)}</strong></span>
      </div>
    </section>
  );
}
function ProfileSummary({ profile }: { profile: ElevationProfileResponse }) {
  const minimum = Math.min(...profile.elevation_m);
  const maximum = Math.max(...profile.elevation_m);
  const range = maximum - minimum;

  return (
    <div className="profile-data">
      <div className="profile-data__summary">
        <span>{profile.elevation_m.length} samples</span>
        <span>{formatMeters(profile.distance_m)}</span>
        <span>{formatDegrees(profile.max_slope_deg)} max</span>
      </div>
      <div className="profile-bars" aria-label="Elevation profile samples">
        {profile.elevation_m.map((elevation, index) => (
          <span
            key={`${index}-${elevation}`}
            style={{ height: `${range === 0 ? 50 : 12 + ((elevation - minimum) / range) * 88}%` }}
            title={`Sample ${index + 1}: ${elevation.toFixed(2)} m`}
          />
        ))}
      </div>
      <div className="profile-data__summary">
        <span>Min {minimum.toFixed(2)} m</span>
        <span>Max {maximum.toFixed(2)} m</span>
        <span>Ascent {formatMeters(profile.ascent_m)}</span>
      </div>
    </div>
  );
}
export function RouteAnalysisPanel({
  open,
  onToggle,
  mission,
  profile,
  status,
  errorMessage,
  profileErrorMessage,
  offlinePacks,
  selectedOfflinePackId,
  offlinePackStatus,
  offlinePackError,
  isOnline,
  onSaveOfflinePack,
  onSelectOfflinePack,
  onDeleteOfflinePack,
  onUseLiveWorkspace,
  onExportManifest,
  onImportPack,
  onExportBriefing,
  onPrintBriefing,
  canInstall,
  isInstalled,
  onInstall,
}: RouteAnalysisPanelProps) {
  const comparison = mission?.comparison;
  const statusLabel = status === "loading" ? "REQUESTING" : mission ? "READY" : status === "error" ? "ERROR" : "NOT RUN";
  const statusTone = status === "error" ? "pending" : mission ? "ready" : "pending";

  return (
    <CollapsiblePanel open={open} onToggle={onToggle} side="right" label="Route analysis" className="route-analysis" id="route-analysis-panel">
      <PanelHeading
        eyebrow="Route analysis"
        title="Comparative telemetry"
        eyebrowAccessory={<Activity size={13} aria-hidden="true" />}
        action={<StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>}
      />

      <div className="panel-content">
        <div className="analysis-note">
          <Info size={15} aria-hidden="true" />
          <p>Metrics and route geometry below are rendered from the FastAPI mission response.</p>
        </div>

        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}

        {mission ? (
          mission.routes.map((route) => <RouteCard key={route.route_id} route={route} />)
        ) : (
          <section className="route-card route-card--muted" aria-label="Route response status">
            <div className="route-card__header">
              <div className="route-card__title"><span className="route-swatch route-swatch--direct" /><span>Backend route response</span></div>
              <span className="mini-badge">{statusLabel}</span>
            </div>
            <p>Enter valid grid points and request one mission plan to load both route alternatives.</p>
          </section>
        )}

        <section id="route-comparison" className="comparison-card" aria-label="Route comparison metrics">
          <div className="comparison-card__heading">
            <span><BarChart3 size={14} aria-hidden="true" /> Comparison matrix</span>
            <span className="field-status">{comparison ? mission?.methodology_version : "AWAITING RESPONSE"}</span>
          </div>
          {comparison && mission ? (
            <div className="metric-table">
              <div className="metric-table__row metric-table__row--heading"><span>Metric</span><span>Δ aware − shortest</span><span>State</span></div>
              <div className="metric-table__row"><span>Distance</span><span>{formatDelta(comparison.distance_delta_m, " m")}</span><span>{comparison.same_path ? "same path" : "different"}</span></div>
              <div className="metric-table__row"><span>Ascent</span><span>{formatDelta(comparison.ascent_delta_m, " m")}</span><span>physical</span></div>
              <div className="metric-table__row"><span>Descent</span><span>{formatDelta(comparison.descent_delta_m, " m")}</span><span>physical</span></div>
              <div className="metric-table__row"><span>Max slope</span><span>{formatDelta(comparison.max_slope_delta_deg, "°")}</span><span>physical</span></div>
              <div className="metric-table__row"><span>Cells</span><span>{comparison.cell_count_delta > 0 ? "+" : ""}{comparison.cell_count_delta}</span><span>grid</span></div>
            </div>
          ) : (
            <p className="field-note">No comparison is available until the backend returns a mission response.</p>
          )}
        </section>

        <section className="profile-card" aria-label="Elevation profile">
          <div className="comparison-card__heading">
            <span><Route size={14} aria-hidden="true" /> Elevation profile</span>
            <span className="field-status">{profile ? "LOADED" : "PENDING"}</span>
          </div>
          {profile ? <ProfileSummary profile={profile} /> : <p className="field-note">{profileErrorMessage ?? "The profile will load after a route response."}</p>}
        </section>

        <section className="source-card" aria-label="Data provenance and limitations">
          <div className="comparison-card__heading">
            <span><Database size={14} aria-hidden="true" /> Provenance</span>
            <span className="field-status">{mission ? "REPORTED" : "PENDING"}</span>
          </div>
          {mission ? (
            <>
              <p><strong>Sources:</strong> {mission.data_sources.join(", ") || "none reported"}</p>
              <p><strong>Method:</strong> {mission.methodology_version}</p>
              <ul className="limitation-list">
                {mission.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            </>
          ) : (
            <p>NASA source IDs, methodology and limitations will appear in the mission response.</p>
          )}
        </section>

        <MissionBriefingPanel
          mission={mission}
          onExport={onExportBriefing}
          onPrint={onPrintBriefing}
        />

        <section id="offline-mission-packs" className="offline-pack-card" aria-label="Offline mission packs">
          <div className="comparison-card__heading">
            <span><CloudDownload size={14} aria-hidden="true" /> Offline Mission Pack</span>
            <span className="field-status">{offlinePackStatus === "saving" ? "SAVING" : `${offlinePacks.length} STORED`}</span>
          </div>
          <p className="field-note">
            Mission response, route profile and a compact local raster preview are stored in this browser. NASA WMTS tiles remain optional online context.
          </p>
          {!isOnline ? (
            <p className="offline-pack__network"><WifiOff size={12} aria-hidden="true" /> Browser offline: select a stored pack to review it.</p>
          ) : null}
          <div className="pwa-install-card">
            <div className="comparison-card__heading">
              <span><Smartphone size={14} aria-hidden="true" /> ARES PATH app</span>
              <span className="field-status">{isInstalled ? "INSTALLED" : canInstall ? "INSTALLABLE" : "PWA READY"}</span>
            </div>
            <p className="field-note">
              {isInstalled
                ? "The installed app can reopen the cached shell and saved Mission Packs."
                : "Install the app to reopen the cached shell and review saved Mission Packs without the backend."}
            </p>
            <button type="button" className="secondary-action" disabled={isInstalled || !canInstall} onClick={onInstall}>
              <Smartphone size={13} aria-hidden="true" /> {isInstalled ? "App installed" : "Install application"}
            </button>
          </div>
          <div className="offline-pack-actions">
            <label className="secondary-action" htmlFor="mission-pack-import">
              <Upload size={13} aria-hidden="true" /> Import Mission Pack JSON
            </label>
            <input
              id="mission-pack-import"
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImportPack(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          {offlinePacks.length > 0 ? (
            <div className="offline-pack-list">
              {offlinePacks.map((pack) => (
                <div className={selectedOfflinePackId === pack.package_id ? "offline-pack-item offline-pack-item--active" : "offline-pack-item"} key={pack.package_id}>
                  <button type="button" className="offline-pack-item__select" onClick={() => onSelectOfflinePack(pack.package_id)}>
                    <strong>{pack.region_id}</strong>
                    <small>{pack.saved_at.slice(0, 16).replace("T", " ")} UTC · {pack.mission.routes.length} routes</small>
                  </button>
                  <button
                    type="button"
                    className="offline-pack-item__delete"
                    aria-label={`Delete offline pack ${pack.region_id}`}
                    onClick={() => onDeleteOfflinePack(pack.package_id)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="field-note">No mission packs saved yet.</p>
          )}
          {selectedOfflinePackId ? (
            <button type="button" className="secondary-action" onClick={onUseLiveWorkspace}>Use live workspace</button>
          ) : null}
          {offlinePackError ? <p className="form-error" role="alert">{offlinePackError}</p> : null}
        </section>

        <div className="analysis-actions">
          <button type="button" disabled={!mission || offlinePackStatus === "saving"} onClick={onSaveOfflinePack}>
            <Download size={14} aria-hidden="true" /> {offlinePackStatus === "saving" ? "Saving pack" : "Offline pack"}
          </button>
          <button type="button" disabled={!mission} onClick={onExportManifest}>
            <FileJson size={14} aria-hidden="true" /> Export Mission Pack
          </button>
        </div>
      </div>
    </CollapsiblePanel>
  );
}
