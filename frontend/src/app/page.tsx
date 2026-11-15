"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { StatusDot } from "@/components/atoms/status-dot";
import type { NavigationTarget } from "@/components/molecules/navigation-target";
import { AppTopbar } from "@/components/organisms/app-topbar";
import { BrandLoadingScreen } from "@/components/organisms/brand-loading-screen";
import { usePwaInstall } from "@/components/organisms/pwa-runtime";
import { WorkspaceRail } from "@/components/organisms/workspace-rail";
import { MapViewport } from "@/features/mars-map/components/map-viewport";
import type { MapLayer, MapLayerId, MapSelectionMode } from "@/features/mars-map/types";
import { MissionSetupPanel, type PointDraft } from "@/features/mission-planning/components/mission-setup-panel";
import { useMissionPlanning } from "@/features/mission-planning/hooks/use-mission-planning";
import { useOfflineMissions } from "@/features/offline-missions/hooks/use-offline-missions";
import { createMissionPack, prepareMissionPack } from "@/features/offline-missions/services/mission-pack-store";
import { RouteAnalysisPanel } from "@/features/route-analysis/components/route-analysis-panel";
import { createDefaultAnalysisWindow, isPointInAnalysisWindow } from "@/features/mars-map/utils/analysis-window";
import type { AnalysisWindow, GridPoint, MissionRequest, ScientificTarget } from "@/shared/types/api-contract";

const layerColors: Record<string, string> = {
  ctx: "#5bc0eb",
  hirise: "#fdb813",
  elevation: "#38bdf8",
  orthoimage: "#a7f3d0",
  slope: "#fdb813",
};

function parsePoint(draft: PointDraft): GridPoint | null {
  if (draft.row.trim() === "" || draft.col.trim() === "") return null;

  const row = Number(draft.row);
  const col = Number(draft.col);
  if (!Number.isSafeInteger(row) || !Number.isSafeInteger(col) || row < 0 || col < 0) return null;

  return { row, col };
}
function apiErrorMessage(error: { code: string; message: string } | null) {
  if (!error) return null;
  return `${error.message} [${error.code}]`;
}

function mapLayerId(layerId: string): MapLayerId | null {
  if (layerId === "elevation") return "elevation";
  if (layerId === "orthoimage") return "optical";
  if (layerId === "slope") return "slope";
  return null;
}

function marsTrekLayerId(instrument: string): MapLayerId {
  return instrument.toLowerCase().includes("hirise") ? "hirise" : "ctx";
}

function mapBoundsTuple(bounds: number[] | undefined): [number, number, number, number] | undefined {
  if (!bounds || bounds.length !== 4) return undefined;
  return [bounds[0], bounds[1], bounds[2], bounds[3]];
}

function transformTuple(transform: number[] | undefined): [number, number, number, number, number, number] | undefined {
  if (!transform || transform.length !== 6) return undefined;
  return [transform[0], transform[1], transform[2], transform[3], transform[4], transform[5]];
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [setupOpen, setSetupOpen] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [startDraft, setStartDraft] = useState<PointDraft>({ row: "", col: "" });
  const [destinationDraft, setDestinationDraft] = useState<PointDraft>({ row: "", col: "" });
  const [selectionMode, setSelectionMode] = useState<MapSelectionMode>("origin");
  const [analysisWindow, setAnalysisWindow] = useState<AnalysisWindow | null>(null);
  const [areaSelectionActive, setAreaSelectionActive] = useState(false);
  const [maxSlopeDeg, setMaxSlopeDeg] = useState("20");
  const [slopeWeight, setSlopeWeight] = useState("2");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [activeTarget, setActiveTarget] = useState<NavigationTarget>("traverse");
  const [activeLayerIds, setActiveLayerIds] = useState<MapLayerId[]>(["elevation", "optical", "ctx", "hirise"]);
  const [layerOpacity, setLayerOpacity] = useState<Partial<Record<MapLayerId, number>>>({
    ctx: 1,
    hirise: 1,
    elevation: 0.5,
    optical: 0.88,
    slope: 0.55,
  });
  const [focusPoint, setFocusPoint] = useState<GridPoint | null>(null);
  const planning = useMissionPlanning();
  const offline = useOfflineMissions();
  const pwa = usePwaInstall();
  const selectedOfflinePack = offline.selectedPack;
  const activeRegionId = selectedOfflinePack?.region_id ?? planning.selectedRegionId;
  const activeMetadata = selectedOfflinePack?.region_metadata ?? planning.metadata;
  const activeLayers = selectedOfflinePack?.layers ?? planning.layers;
  const activeMarsTrekLayers = selectedOfflinePack?.mars_trek_layers ?? planning.marsTrekLayers;
  const displayMission = selectedOfflinePack?.mission ?? planning.mission;
  const displayProfile = selectedOfflinePack ? selectedOfflinePack.elevation_profile : planning.elevationProfile;
  const activeAnalysisWindow = useMemo(
    () => selectedOfflinePack?.request.analysis_window
      ?? analysisWindow
      ?? (activeMetadata ? createDefaultAnalysisWindow(activeMetadata) : null),
    [activeMetadata, analysisWindow, selectedOfflinePack],
  );
  const [lastMissionRequest, setLastMissionRequest] = useState<MissionRequest | null>(null);

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => setIsLoading(false), 2500);
    return () => window.clearTimeout(loadingTimer);
  }, []);

  const effectiveStartDraft = selectedOfflinePack
    ? { row: String(selectedOfflinePack.request.start.row), col: String(selectedOfflinePack.request.start.col) }
    : startDraft;
  const effectiveDestinationDraft = selectedOfflinePack
    ? { row: String(selectedOfflinePack.request.destination.row), col: String(selectedOfflinePack.request.destination.col) }
    : destinationDraft;
  const effectiveSelectedTargetIds = selectedOfflinePack
    ? selectedOfflinePack.request.scientific_target_ids
    : selectedTargetIds;
  const startPoint = parsePoint(effectiveStartDraft);
  const destinationPoint = parsePoint(effectiveDestinationDraft);

  const validationMessage = useMemo(() => {
    if (planning.workspaceStatus === "loading" || planning.regionStatus === "loading") return "Loading backend metadata.";
    if (!activeRegionId || !activeMetadata) return "Select a region with available raster metadata.";
    if (!activeAnalysisWindow) return "Select an analysis area before planning.";
    if (!startPoint || !destinationPoint) return "Enter integer row and col values for both mission points.";

    const [height, width] = activeMetadata.shape;
    const points = [startPoint, destinationPoint];
    if (points.some((point) => point.row >= height || point.col >= width)) {
      return `Points must stay inside the ${height} × ${width} raster grid.`;
    }
    if (points.some((point) => !isPointInAnalysisWindow(point, activeAnalysisWindow))) {
      return "Both mission points must stay inside the selected analysis area.";
    }

    const slope = Number(maxSlopeDeg);
    const weight = Number(slopeWeight);
    if (!Number.isFinite(slope) || slope <= 0 || slope > 90) return "Max slope must be between 0 and 90 degrees.";
    if (!Number.isFinite(weight) || weight < 0) return "Slope weight must be zero or greater.";

    return null;
  }, [
    destinationPoint,
    maxSlopeDeg,
    activeMetadata,
    activeRegionId,
    planning.regionStatus,
    planning.workspaceStatus,
    slopeWeight,
    startPoint,
    activeAnalysisWindow,
  ]);

  const backendLayers = useMemo<MapLayer[]>(
    () => {
      const effectiveActiveLayerIds: MapLayerId[] = selectedOfflinePack
        ? ["elevation", "optical", "slope"]
        : activeLayerIds;

      return [
      ...activeMarsTrekLayers.map((layer) => {
        const id = marsTrekLayerId(layer.instrument);
        return {
          id,
          label: `${layer.instrument} / NASA orbital`,
          color: layerColors[id],
          active: !selectedOfflinePack && effectiveActiveLayerIds.includes(id),
          opacity: layerOpacity[id] ?? 1,
          sourceKind: "mars-trek" as const,
          wmtsLayerId: layer.layer_id,
          wmtsEndpoint: layer.wmts_endpoint,
          capabilitiesUrl: layer.capabilities_url,
          wmtsCrs: layer.wmts_crs,
          tileUrlTemplate: layer.tile_url_template,
          tileMatrixSet: layer.tile_matrix_set,
          style: layer.style,
          format: layer.format,
          coverageExtent: mapBoundsTuple(layer.coverage_bbox),
          coverageCoordinateSystem: layer.coverage_bbox_coordinate_system,
          minZoom: 0,
          maxZoom: layer.max_zoom,
          name: layer.name ?? layer.title,
          dataType: layer.data_type,
          mission: layer.mission,
          instrument: layer.instrument,
          spatialResolutionM: layer.spatial_resolution_m,
          coverageStatus: layer.coverage_status,
          coverageDescription: layer.coverage_description,
          sourceUrls: layer.source_urls,
          attribution: layer.attribution,
          routingRole: layer.routing_role,
          limitations: layer.limitations,
        };
      }),
      ...activeLayers.flatMap((layer) => {
        const id = mapLayerId(layer.layer_id);
        if (!id) return [];
        return [{
          id,
          label: `${id === "optical" ? "Optical" : id === "slope" ? "Slope" : "Elevation"} / analysis`,
          color: layerColors[layer.layer_id] ?? "#a7f3d0",
          active: effectiveActiveLayerIds.includes(id),
          opacity: layerOpacity[id] ?? (id === "elevation" ? 0.5 : id === "slope" ? 0.55 : 0.88),
          sourceKind: "local" as const,
          localPreviewUrl: layer.cached_preview_data_url ?? layer.preview_url,
          localRasterUrl: layer.raster_url,
          localCrsWkt: layer.crs_wkt,
          localTransform: transformTuple(layer.transform),
          localShape: layer.shape,
          localMapBounds: mapBoundsTuple(layer.map_bounds),
          tileScheme: layer.tile_scheme,
          tileSize: layer.tile_size,
          minZoom: layer.min_zoom,
          maxZoom: layer.max_zoom,
          name: layer.name,
          dataType: layer.data_type,
          mission: layer.mission,
          instrument: layer.instrument,
          spatialResolutionM: layer.spatial_resolution_m,
          coverageStatus: layer.coverage_status,
          coverageDescription: layer.coverage_description,
          sourceUrls: layer.source_urls,
          attribution: layer.attribution,
          routingRole: layer.routing_role,
          derivationMethod: layer.derivation_method,
          limitations: layer.limitations,
        }];
      }),
      ];
    },
    [activeLayerIds, activeLayers, activeMarsTrekLayers, layerOpacity, selectedOfflinePack],
  );

  const handlePointChange = (point: "start" | "destination", axis: keyof PointDraft, value: string) => {
    const setter = point === "start" ? setStartDraft : setDestinationDraft;
    setter((current) => ({ ...current, [axis]: value }));
  };

  const handleNavigate = (target: NavigationTarget) => {
    setActiveTarget(target);
    if (["region", "layers", "targets", "parameters"].includes(target)) setSetupOpen(true);
    if (["routes", "telemetry", "offline"].includes(target)) setAnalysisOpen(true);

    const targetId = {
      traverse: "map-viewport",
      region: "region-id",
      parameters: "terrain-criteria",
      layers: "scientific-layer-explorer",
      targets: "scientific-targets",
      routes: "route-analysis-panel",
      telemetry: "route-comparison",
      offline: "offline-mission-packs",
    }[target];

    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  };

  const handleMapPointSelect = useCallback((point: GridPoint, mode: MapSelectionMode) => {
    const draft = { row: String(point.row), col: String(point.col) };
    if (mode === "origin") setStartDraft(draft);
    else setDestinationDraft(draft);
    if (!offline.selectedPackId) {
      void planning.inspectTerrainPoint(point, {
        max_slope_deg: Number(maxSlopeDeg),
        slope_weight: Number(slopeWeight),
      }, activeAnalysisWindow ?? undefined);
    }
  }, [activeAnalysisWindow, maxSlopeDeg, offline.selectedPackId, planning, slopeWeight]);

  const handleClearPoints = () => {
    setStartDraft({ row: "", col: "" });
    setDestinationDraft({ row: "", col: "" });
    setLastMissionRequest(null);
    offline.select(null);
    planning.clearMission();
    setFocusPoint(null);
  };

  const handleRegionChange = (regionId: string) => {
    offline.select(null);
    planning.selectRegion(regionId);
    setAnalysisWindow(null);
    setAreaSelectionActive(false);
    setStartDraft({ row: "", col: "" });
    setDestinationDraft({ row: "", col: "" });
    setSelectionMode("origin");
    setSelectedTargetIds([]);
    setActiveLayerIds(["elevation", "optical", "ctx", "hirise"]);
    setFocusPoint(null);
  };

  const handleAnalysisWindowChange = (nextWindow: AnalysisWindow) => {
    setAnalysisWindow(nextWindow);
    handleClearPoints();
  };

  const handleToggleAreaSelection = () => {
    if (!activeMetadata || !activeAnalysisWindow) return;
    setAreaSelectionActive((current) => !current);
  };

  const handleResetAnalysisArea = () => {
    if (!activeMetadata) return;
    handleAnalysisWindowChange(createDefaultAnalysisWindow(activeMetadata));
  };

  const handleTargetToggle = (targetId: string) => {
    setSelectedTargetIds((current) => current.includes(targetId)
      ? current.filter((id) => id !== targetId)
      : [...current, targetId]);
  };

  const handleTargetFocus = (point: GridPoint) => {
    setFocusPoint({ ...point });
    void planning.inspectTerrainPoint(point, {
      max_slope_deg: Number(maxSlopeDeg),
      slope_weight: Number(slopeWeight),
    }, activeAnalysisWindow ?? undefined);
  };

  const handleUseTargetAsDestination = (target: ScientificTarget) => {
    if (!target.position || !target.routable) return;
    setDestinationDraft({ row: String(target.position.row), col: String(target.position.col) });
    setSelectedTargetIds((current) => current.includes(target.target_id) ? current : [...current, target.target_id]);
    setSelectionMode("destination");
    handleTargetFocus(target.position);
  };

  const handleOpacityChange = (layerId: MapLayerId, opacity: number) => {
    setLayerOpacity((current) => ({ ...current, [layerId]: opacity }));
  };

  const handlePlan = () => {
    if (!startPoint || !destinationPoint || !planning.selectedRegionId || !activeAnalysisWindow) return;

    const request: MissionRequest = {
      region_id: planning.selectedRegionId,
      coordinate_system: "grid_row_col",
      start: startPoint,
      destination: destinationPoint,
      mode: "compare",
      terrain_config: {
        max_slope_deg: Number(maxSlopeDeg),
        slope_weight: Number(slopeWeight),
      },
      scientific_target_ids: selectedTargetIds,
      analysis_window: activeAnalysisWindow,
    };
    offline.select(null);
    setLastMissionRequest(request);
    void planning.planMission(request);
  };

  const handleSaveOfflinePack = () => {
    if (!planning.mission || !lastMissionRequest || !activeMetadata) return;

    void offline.save({
      region_id: planning.mission.region_id,
      request: lastMissionRequest,
      region_metadata: activeMetadata,
      layers: planning.layers,
      mars_trek_layers: planning.marsTrekLayers,
      mission: planning.mission,
      elevation_profile: planning.elevationProfile,
    });
  };

  const handleOfflinePackSelect = (packageId: string) => {
    const pack = offline.packs.find((item) => item.package_id === packageId);
    if (!pack) return;

    planning.clearMission();
    offline.select(packageId);
    setStartDraft({ row: String(pack.request.start.row), col: String(pack.request.start.col) });
    setDestinationDraft({ row: String(pack.request.destination.row), col: String(pack.request.destination.col) });
    setSelectedTargetIds(pack.request.scientific_target_ids);
    setActiveLayerIds(["elevation", "optical", "slope"]);
    setSelectionMode("origin");
    setAnalysisWindow(pack.request.analysis_window ?? createDefaultAnalysisWindow(pack.region_metadata));
    setAreaSelectionActive(false);
    setLastMissionRequest(pack.request);
    setActiveTarget("offline");
  };

  const handleImportPack = async (file: File) => {
    const pack = await offline.importPack(file);
    if (!pack) return;

    planning.clearMission();
    setStartDraft({ row: String(pack.request.start.row), col: String(pack.request.start.col) });
    setDestinationDraft({ row: String(pack.request.destination.row), col: String(pack.request.destination.col) });
    setSelectedTargetIds(pack.request.scientific_target_ids);
    setActiveLayerIds(["elevation", "optical", "slope"]);
    setSelectionMode("origin");
    setAnalysisWindow(pack.request.analysis_window ?? createDefaultAnalysisWindow(pack.region_metadata));
    setAreaSelectionActive(false);
    setLastMissionRequest(pack.request);
    setFocusPoint(null);
    setActiveTarget("offline");
  };

  const handleLiveWorkspace = () => {
    offline.select(null);
    setLastMissionRequest(null);
    setAnalysisWindow(null);
    setAreaSelectionActive(false);
    setStartDraft({ row: "", col: "" });
    setDestinationDraft({ row: "", col: "" });
    setFocusPoint(null);
    setActiveLayerIds(["elevation", "optical", "ctx", "hirise"]);
    setActiveTarget("traverse");
  };

  const handleExportManifest = async () => {
    if (!displayMission || !activeMetadata) return;

    const packInput = selectedOfflinePack ? null : (
      lastMissionRequest
        ? createMissionPack({
          region_id: displayMission.region_id,
          request: lastMissionRequest,
          region_metadata: activeMetadata,
          layers: planning.layers,
          mars_trek_layers: planning.marsTrekLayers,
          mission: displayMission,
          elevation_profile: displayProfile,
        })
        : null
    );
    const pack = selectedOfflinePack ?? (packInput ? await prepareMissionPack(packInput) : null);
    if (!pack) return;

    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ares-path-${displayMission.region_id}-mission-pack.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportBriefing = () => {
    if (!displayMission?.briefing) return;
    const blob = new Blob([JSON.stringify(displayMission.briefing, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ares-path-${displayMission.region_id}-mission-briefing.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleLayer = (layerId: MapLayerId) => {
    setActiveLayerIds((current) => {
      const isOrbitalLayer = layerId === "ctx" || layerId === "hirise";
      if (isOrbitalLayer) {
        return current.includes(layerId)
          ? current.filter((id) => id !== layerId)
          : [...current.filter((id) => id !== "ctx" && id !== "hirise"), layerId];
      }

      return current.includes(layerId)
        ? current.filter((id) => id !== layerId)
        : [...current, layerId];
    });
  };

  const apiStatus = planning.workspaceStatus === "loading" ? "loading" : planning.workspaceStatus === "success" ? "online" : "error";
  const apiFooterLabel = planning.workspaceStatus === "success"
    ? "API / READY"
    : planning.workspaceStatus === "error"
      ? "API / ERROR"
      : "API / CONNECTING";
  const dataSources = displayMission?.data_sources.join(", ") || activeMetadata?.source_ids.join(", ") || "PENDING";
  const errorMessage = apiErrorMessage(planning.error);

  return (
    <div className="ares-shell" suppressHydrationWarning>
      <div className="ares-shell__scanlines" aria-hidden="true" />
      <BrandLoadingScreen visible={isLoading} />

      <AppTopbar
        apiStatus={apiStatus}
        activeTarget={activeTarget}
        onNavigate={handleNavigate}
        canExportPack={Boolean(displayMission && activeMetadata && (selectedOfflinePack || lastMissionRequest))}
        onExportPack={() => { void handleExportManifest(); }}
        canInstall={pwa.canInstall}
        isInstalled={pwa.isInstalled}
        onInstall={() => { void pwa.install(); }}
      />

      <div className="workspace">
        <WorkspaceRail activeTarget={activeTarget} onNavigate={handleNavigate} />

        <MissionSetupPanel
          open={setupOpen}
          onToggle={() => setSetupOpen((current) => !current)}
          regions={planning.regions}
          selectedRegionId={planning.selectedRegionId}
          onRegionChange={handleRegionChange}
          metadata={activeMetadata}
          analysisWindow={activeAnalysisWindow}
          areaSelectionActive={areaSelectionActive}
          onToggleAreaSelection={handleToggleAreaSelection}
          onResetAnalysisArea={handleResetAnalysisArea}
          regionStatus={planning.regionStatus}
          scientificTargets={planning.scientificTargets}
          selectedTargetIds={effectiveSelectedTargetIds}
          onTargetToggle={handleTargetToggle}
          onTargetFocus={handleTargetFocus}
          onUseTargetAsDestination={handleUseTargetAsDestination}
          layers={backendLayers}
          onToggleLayer={toggleLayer}
          onOpacityChange={handleOpacityChange}
          terrainSample={planning.terrainSample}
          terrainSampleStatus={planning.terrainSampleStatus}
          terrainSampleError={apiErrorMessage(planning.terrainSampleError)}
          start={effectiveStartDraft}
          destination={effectiveDestinationDraft}
          selectionMode={selectionMode}
          onSelectionModeChange={setSelectionMode}
          onPointChange={handlePointChange}
          onClearPoints={handleClearPoints}
          maxSlopeDeg={maxSlopeDeg}
          slopeWeight={slopeWeight}
          onMaxSlopeChange={setMaxSlopeDeg}
          onSlopeWeightChange={setSlopeWeight}
          planStatus={planning.planStatus}
          canPlan={validationMessage === null && !selectedOfflinePack}
          validationMessage={validationMessage}
          errorMessage={errorMessage}
          onPlan={handlePlan}
        />

        <main className="main-stage">
          <MapViewport
            layers={backendLayers}
            regionId={activeRegionId}
            metadata={activeMetadata}
            mission={displayMission}
            analysisWindow={activeAnalysisWindow}
            areaSelectionActive={areaSelectionActive}
            onAnalysisWindowChange={handleAnalysisWindowChange}
            onToggleLayer={toggleLayer}
            selectionMode={selectionMode}
            onMapPointSelect={handleMapPointSelect}
            focusPoint={focusPoint}
          />
        </main>

        <RouteAnalysisPanel
          open={analysisOpen}
          onToggle={() => setAnalysisOpen((current) => !current)}
          mission={displayMission}
          profile={displayProfile}
          status={planning.planStatus}
          errorMessage={errorMessage}
          profileErrorMessage={apiErrorMessage(planning.profileError)}
          offlinePacks={offline.packs}
          selectedOfflinePackId={offline.selectedPackId}
          offlinePackStatus={offline.status}
          offlinePackError={offline.error}
          isOnline={offline.isOnline}
          onSaveOfflinePack={handleSaveOfflinePack}
          onSelectOfflinePack={handleOfflinePackSelect}
          onDeleteOfflinePack={offline.remove}
          onUseLiveWorkspace={handleLiveWorkspace}
          onExportManifest={() => { void handleExportManifest(); }}
          onImportPack={(file) => { void handleImportPack(file); }}
          onExportBriefing={handleExportBriefing}
          onPrintBriefing={() => window.print()}
          canInstall={pwa.canInstall}
          isInstalled={pwa.isInstalled}
          onInstall={() => { void pwa.install(); }}
        />
      </div>

      <footer className="statusbar">
        <span><StatusDot tone={planning.workspaceStatus === "error" ? "red" : "blue"} /> {apiFooterLabel}</span>
        <span>DATA SOURCES: {dataSources}</span>
        <span>CRS: {activeMetadata ? "MARS TREK + LOCAL" : "PENDING"}</span>
        <span className="statusbar__right">{displayMission ? (selectedOfflinePack ? "OFFLINE PACK LOADED" : "MISSION RESPONSE LOADED") : "NO MISSION LOADED"}</span>
      </footer>
    </div>
  );
}
