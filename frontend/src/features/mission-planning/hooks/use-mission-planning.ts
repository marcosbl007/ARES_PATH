"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError } from "@/shared/api/http-client";
import type {
  ElevationProfileResponse,
  AnalysisWindow,
  HealthResponse,
  Layer,
  MissionRequest,
  MissionResponse,
  MarsTrekLayer,
  RegionMetadata,
  ScientificTarget,
  SystemInfoResponse,
  TerrainSampleResponse,
} from "@/shared/types/api-contract";
import {
  getMarsTrekLayers,
  getRegionLayers,
  getRegionMetadata,
  getRegions,
} from "@/features/mars-map/services/region-api";
import {
  createMissionPlan,
  getElevationProfile,
  getHealth,
  getScientificTargets,
  getTerrainSample,
  getSystemInfo,
  MissionRequestSchema,
} from "@/features/mission-planning/services/mission-api";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

type MissionPlanningState = {
  workspaceStatus: AsyncStatus;
  regionStatus: AsyncStatus;
  planStatus: AsyncStatus;
  health: HealthResponse | null;
  systemInfo: SystemInfoResponse | null;
  regions: RegionMetadata[];
  selectedRegionId: string;
  metadata: RegionMetadata | null;
  layers: Layer[];
  marsTrekLayers: MarsTrekLayer[];
  scientificTargets: ScientificTarget[];
  mission: MissionResponse | null;
  elevationProfile: ElevationProfileResponse | null;
  error: ApiClientError | null;
  profileError: ApiClientError | null;
  terrainSample: TerrainSampleResponse | null;
  terrainSampleStatus: AsyncStatus;
  terrainSampleError: ApiClientError | null;
};

const initialState: MissionPlanningState = {
  workspaceStatus: "idle",
  regionStatus: "idle",
  planStatus: "idle",
  health: null,
  systemInfo: null,
  regions: [],
  selectedRegionId: "",
  metadata: null,
  layers: [],
  marsTrekLayers: [],
  scientificTargets: [],
  mission: null,
  elevationProfile: null,
  error: null,
  profileError: null,
  terrainSample: null,
  terrainSampleStatus: "idle",
  terrainSampleError: null,
};

function asApiError(error: unknown, fallback: string): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiClientError(fallback, { code: "ABORTED" });
  }

  return new ApiClientError(fallback, {
    code: "CLIENT_ERROR",
    details: error instanceof Error ? error.message : {},
  });
}

export function useMissionPlanning() {
  const [state, setState] = useState<MissionPlanningState>(initialState);
  const [workspaceReload, setWorkspaceReload] = useState(0);
  const planControllerRef = useRef<AbortController | null>(null);
  const sampleControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    planControllerRef.current?.abort();
    sampleControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    planControllerRef.current?.abort();
    const controller = new AbortController();
    planControllerRef.current = controller;
    let active = true;

    setState((current) => ({ ...current, workspaceStatus: "loading", error: null }));

    Promise.all([
      getHealth(controller.signal),
      getSystemInfo(controller.signal),
      getRegions(controller.signal),
      getMarsTrekLayers(controller.signal),
    ])
      .then(([health, systemInfo, regions, marsTrekLayers]) => {
        if (!active) return;

        const preferredRegion = regions.find((region) => region.region_id === "jezero_ctx_northwest_20m")
          ?? regions.find((region) => region.region_id === "jezero_ctx_northeast_20m")
          ?? regions.find((region) => region.region_id === "jezero_fan_2048")
          ?? regions.find((region) => region.region_id === "jezero_fan_1024")
          ?? regions[0];

        setState((current) => ({
          ...current,
          workspaceStatus: "success",
          health,
          systemInfo,
          regions,
          marsTrekLayers,
          selectedRegionId: current.selectedRegionId || preferredRegion?.region_id || "",
          error: null,
        }));
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;

        setState((current) => ({
          ...current,
          workspaceStatus: "error",
          error: asApiError(error, "The backend workspace could not be loaded."),
        }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [workspaceReload]);

  useEffect(() => {
    if (!state.selectedRegionId) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const regionId = state.selectedRegionId;

    setState((current) => ({
      ...current,
      regionStatus: "loading",
      metadata: null,
      layers: [],
      scientificTargets: [],
      mission: null,
      elevationProfile: null,
      terrainSample: null,
      terrainSampleStatus: "idle",
      terrainSampleError: null,
      error: null,
    }));

    Promise.all([
      getRegionMetadata(regionId, controller.signal),
      getRegionLayers(regionId, controller.signal),
      getScientificTargets(regionId, controller.signal),
    ])
      .then(([metadata, layers, scientificTargets]) => {
        if (!active) return;

        setState((current) => ({
          ...current,
          regionStatus: "success",
          metadata,
          layers,
          scientificTargets,
          error: null,
        }));
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;

        setState((current) => ({
          ...current,
          regionStatus: "error",
          error: asApiError(error, `Region ${regionId} could not be loaded.`),
        }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [state.selectedRegionId]);

  const selectRegion = useCallback((regionId: string) => {
    planControllerRef.current?.abort();
    sampleControllerRef.current?.abort();
    planControllerRef.current = null;
    setState((current) => ({
      ...current,
      selectedRegionId: regionId,
      planStatus: "idle",
      mission: null,
      elevationProfile: null,
      profileError: null,
      terrainSample: null,
      terrainSampleStatus: "idle",
      terrainSampleError: null,
    }));
  }, []);

  const clearMission = useCallback(() => {
    planControllerRef.current?.abort();
    sampleControllerRef.current?.abort();
    planControllerRef.current = null;
    setState((current) => ({
      ...current,
      planStatus: "idle",
      mission: null,
      elevationProfile: null,
      profileError: null,
      terrainSample: null,
      terrainSampleStatus: "idle",
      terrainSampleError: null,
      error: null,
    }));
  }, []);

  const inspectTerrainPoint = useCallback(async (
    point: { row: number; col: number },
    terrainConfig: { max_slope_deg: number; slope_weight: number },
    analysisWindow?: AnalysisWindow | null,
  ) => {
    if (!state.selectedRegionId) return null;

    sampleControllerRef.current?.abort();
    const controller = new AbortController();
    sampleControllerRef.current = controller;
    setState((current) => ({
      ...current,
      terrainSampleStatus: "loading",
      terrainSampleError: null,
    }));

    try {
      const sample = await getTerrainSample(
        state.selectedRegionId,
        point,
        terrainConfig,
        analysisWindow,
        controller.signal,
      );
      setState((current) => ({
        ...current,
        terrainSample: sample,
        terrainSampleStatus: "success",
        terrainSampleError: null,
      }));
      return sample;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      const apiError = asApiError(error, "Terrain sample could not be loaded.");
      setState((current) => ({
        ...current,
        terrainSample: null,
        terrainSampleStatus: "error",
        terrainSampleError: apiError,
      }));
      return null;
    } finally {
      if (sampleControllerRef.current === controller) {
        sampleControllerRef.current = null;
      }
    }
  }, [state.selectedRegionId]);

  const planMission = useCallback(async (request: MissionRequest) => {
    const parsed = MissionRequestSchema.safeParse(request);
    if (!parsed.success) {
      const validationError = new ApiClientError("Mission inputs are not valid.", {
        status: 422,
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      });
      setState((current) => ({ ...current, planStatus: "error", error: validationError }));
      return null;
    }

    planControllerRef.current?.abort();
    const controller = new AbortController();
    planControllerRef.current = controller;
    setState((current) => ({
      ...current,
      planStatus: "loading",
      mission: null,
      elevationProfile: null,
      profileError: null,
      error: null,
    }));

    try {
      const mission = await createMissionPlan(parsed.data, controller.signal);
      setState((current) => ({ ...current, planStatus: "success", mission }));

      try {
        const elevationProfile = await getElevationProfile(
          parsed.data.region_id,
          mission.routes[0].grid_path,
          parsed.data.analysis_window,
          controller.signal,
        );
        setState((current) => ({ ...current, elevationProfile, profileError: null }));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState((current) => ({
            ...current,
            profileError: asApiError(error, "The elevation profile is unavailable."),
          }));
        }
      }

      return mission;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }

      const apiError = asApiError(error, "The mission could not be calculated.");
      setState((current) => ({ ...current, planStatus: "error", error: apiError }));
      return null;
    } finally {
      if (planControllerRef.current === controller) {
        planControllerRef.current = null;
      }
    }
  }, []);

  const retry = useCallback(() => {
    setWorkspaceReload((current) => current + 1);
  }, []);

  return {
    ...state,
    selectRegion,
    clearMission,
    inspectTerrainPoint,
    planMission,
    retry,
    };
}
