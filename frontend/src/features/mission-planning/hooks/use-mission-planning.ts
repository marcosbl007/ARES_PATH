"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError } from "@/shared/api/http-client";
import type {
  ElevationProfileResponse,
  HealthResponse,
  Layer,
  MissionRequest,
  MissionResponse,
  MarsTrekLayer,
  RegionMetadata,
  ScientificTarget,
  SystemInfoResponse,
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

  useEffect(() => () => {
    planControllerRef.current?.abort();
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

        setState((current) => ({
          ...current,
          workspaceStatus: "success",
          health,
          systemInfo,
          regions,
          marsTrekLayers,
          selectedRegionId: current.selectedRegionId || regions[0]?.region_id || "",
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
    planControllerRef.current = null;
    setState((current) => ({
      ...current,
      selectedRegionId: regionId,
      planStatus: "idle",
      mission: null,
      elevationProfile: null,
      profileError: null,
    }));
  }, []);

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
    planMission,
    retry,
    };
}
