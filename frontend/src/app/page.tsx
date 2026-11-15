"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusDot } from "@/components/atoms/status-dot";
import { AppTopbar } from "@/components/organisms/app-topbar";
import { BrandLoadingScreen } from "@/components/organisms/brand-loading-screen";
import { WorkspaceRail } from "@/components/organisms/workspace-rail";
import { MapViewport } from "@/features/mars-map/components/map-viewport";
import type { MapLayer, MapLayerId } from "@/features/mars-map/types";
import { MissionSetupPanel, type PointDraft } from "@/features/mission-planning/components/mission-setup-panel";
import { useMissionPlanning } from "@/features/mission-planning/hooks/use-mission-planning";
import { RouteAnalysisPanel } from "@/features/route-analysis/components/route-analysis-panel";
import type { GridPoint } from "@/shared/types/api-contract";

const layerColors: Record<string, string> = {
  elevation: "#38bdf8",
  orthoimage: "#a7f3d0",
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
  return null;
}

function mapBoundsTuple(bounds: number[] | undefined): [number, number, number, number] | undefined {
  if (!bounds || bounds.length !== 4) return undefined;
  return [bounds[0], bounds[1], bounds[2], bounds[3]];
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [setupOpen, setSetupOpen] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [startDraft, setStartDraft] = useState<PointDraft>({ row: "", col: "" });
  const [destinationDraft, setDestinationDraft] = useState<PointDraft>({ row: "", col: "" });
  const [maxSlopeDeg, setMaxSlopeDeg] = useState("20");
  const [slopeWeight, setSlopeWeight] = useState("2");
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [activeLayerIds, setActiveLayerIds] = useState<MapLayerId[]>(["elevation"]);
  const planning = useMissionPlanning();

  useEffect(() => {
    const loadingTimer = window.setTimeout(() => setIsLoading(false), 2500);
    return () => window.clearTimeout(loadingTimer);
  }, []);

  const startPoint = parsePoint(startDraft);
  const destinationPoint = parsePoint(destinationDraft);

  const validationMessage = useMemo(() => {
    if (planning.workspaceStatus === "loading" || planning.regionStatus === "loading") return "Loading backend metadata.";
    if (!planning.selectedRegionId || !planning.metadata) return "Select a region with available raster metadata.";
    if (!startPoint || !destinationPoint) return "Enter integer row and col values for both mission points.";

    const [height, width] = planning.metadata.shape;
    const points = [startPoint, destinationPoint];
    if (points.some((point) => point.row >= height || point.col >= width)) {
      return `Points must stay inside the ${height} × ${width} raster grid.`;
    }

    const slope = Number(maxSlopeDeg);
    const weight = Number(slopeWeight);
    if (!Number.isFinite(slope) || slope <= 0 || slope > 90) return "Max slope must be between 0 and 90 degrees.";
    if (!Number.isFinite(weight) || weight < 0) return "Slope weight must be zero or greater.";

    return null;
  }, [
    destinationPoint,
    maxSlopeDeg,
    planning.metadata,
    planning.regionStatus,
    planning.selectedRegionId,
    planning.workspaceStatus,
    slopeWeight,
    startPoint,
  ]);

  const backendLayers = useMemo<MapLayer[]>(
    () => planning.layers.flatMap((layer) => {
      const id = mapLayerId(layer.layer_id);
      if (!id) return [];
      return [{
        id,
        label: `${id === "optical" ? "Optical" : "Elevation"} / native tiles`,
        color: layerColors[layer.layer_id] ?? "#a7f3d0",
        active: activeLayerIds.includes(id),
        tileUrlTemplate: layer.tile_url_template,
        tileScheme: layer.tile_scheme,
        tileSize: layer.tile_size,
        minZoom: layer.min_zoom,
        maxZoom: layer.max_zoom,
        shape: layer.shape,
        mapBounds: mapBoundsTuple(layer.map_bounds),
      }];
    }),
    [activeLayerIds, planning.layers],
  );

  const handlePointChange = (point: "start" | "destination", axis: keyof PointDraft, value: string) => {
    const setter = point === "start" ? setStartDraft : setDestinationDraft;
    setter((current) => ({ ...current, [axis]: value }));
  };

  const handleRegionChange = (regionId: string) => {
    planning.selectRegion(regionId);
    setStartDraft({ row: "", col: "" });
    setDestinationDraft({ row: "", col: "" });
    setSelectedTargetIds([]);
    setActiveLayerIds(["elevation"]);
  };

  const handleTargetToggle = (targetId: string) => {
    setSelectedTargetIds((current) => current.includes(targetId)
      ? current.filter((id) => id !== targetId)
      : [...current, targetId]);
  };

  const handlePlan = () => {
    if (!startPoint || !destinationPoint || !planning.selectedRegionId) return;

    void planning.planMission({
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
    });
  };

  const toggleLayer = (layerId: MapLayerId) => {
    setActiveLayerIds((current) => current.includes(layerId)
      ? current.filter((id) => id !== layerId)
      : [...current, layerId]);
  };

  const apiStatus = planning.workspaceStatus === "loading" ? "loading" : planning.workspaceStatus === "success" ? "online" : "error";
  const apiFooterLabel = planning.workspaceStatus === "success"
    ? "API / READY"
    : planning.workspaceStatus === "error"
      ? "API / ERROR"
      : "API / CONNECTING";
  const dataSources = planning.mission?.data_sources.join(", ") || planning.metadata?.source_ids.join(", ") || "PENDING";
  const errorMessage = apiErrorMessage(planning.error);

  return (
    <div className="ares-shell" suppressHydrationWarning>
      <div className="ares-shell__scanlines" aria-hidden="true" />
      <BrandLoadingScreen visible={isLoading} />

      <AppTopbar apiStatus={apiStatus} />

      <div className="workspace">
        <WorkspaceRail />

        <MissionSetupPanel
          open={setupOpen}
          onToggle={() => setSetupOpen((current) => !current)}
          regions={planning.regions}
          selectedRegionId={planning.selectedRegionId}
          onRegionChange={handleRegionChange}
          metadata={planning.metadata}
          regionStatus={planning.regionStatus}
          scientificTargets={planning.scientificTargets}
          selectedTargetIds={selectedTargetIds}
          onTargetToggle={handleTargetToggle}
          start={startDraft}
          destination={destinationDraft}
          onPointChange={handlePointChange}
          maxSlopeDeg={maxSlopeDeg}
          slopeWeight={slopeWeight}
          onMaxSlopeChange={setMaxSlopeDeg}
          onSlopeWeightChange={setSlopeWeight}
          planStatus={planning.planStatus}
          canPlan={validationMessage === null}
          validationMessage={validationMessage}
          errorMessage={errorMessage}
          onPlan={handlePlan}
        />

        <main className="main-stage">
          <MapViewport
            layers={backendLayers}
            regionId={planning.selectedRegionId}
            metadata={planning.metadata}
            mission={planning.mission}
            zoomLevel={zoomLevel}
            onToggleLayer={toggleLayer}
            onZoomChange={setZoomLevel}
            onResetView={() => setZoomLevel(1)}
          />
        </main>

        <RouteAnalysisPanel
          open={analysisOpen}
          onToggle={() => setAnalysisOpen((current) => !current)}
          mission={planning.mission}
          profile={planning.elevationProfile}
          status={planning.planStatus}
          errorMessage={errorMessage}
          profileErrorMessage={apiErrorMessage(planning.profileError)}
        />
      </div>

      <footer className="statusbar">
        <span><StatusDot tone={planning.workspaceStatus === "error" ? "red" : "blue"} /> {apiFooterLabel}</span>
        <span>DATA SOURCES: {dataSources}</span>
        <span>CRS: {planning.metadata ? "AVAILABLE" : "PENDING"}</span>
        <span className="statusbar__right">{planning.mission ? "MISSION RESPONSE LOADED" : "NO MISSION LOADED"}</span>
      </footer>
    </div>
  );
}
