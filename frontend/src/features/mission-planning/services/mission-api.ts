import { getJson, postJson } from "@/shared/api/http-client";
import {
  ElevationProfileResponseSchema,
  HealthResponseSchema,
  MissionRequestSchema,
  MissionResponseSchema,
  ScientificTargetSchema,
  SystemInfoResponseSchema,
  type ElevationProfileResponse,
  type GridPoint,
  type HealthResponse,
  type MissionRequest,
  type MissionResponse,
  type ScientificTarget,
  type SystemInfoResponse,
} from "@/shared/types/api-contract";

const ScientificTargetListSchema = ScientificTargetSchema.array();

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return getJson("/api/health", HealthResponseSchema, signal);
}

export function getSystemInfo(signal?: AbortSignal): Promise<SystemInfoResponse> {
  return getJson("/api/system/info", SystemInfoResponseSchema, signal);
}

export function getScientificTargets(
  regionId: string,
  signal?: AbortSignal,
): Promise<ScientificTarget[]> {
  return getJson(
    `/api/missions/scientific-targets?region_id=${encodeURIComponent(regionId)}`,
    ScientificTargetListSchema,
    signal,
  );
}

export function createMissionPlan(
  request: MissionRequest,
  signal?: AbortSignal,
): Promise<MissionResponse> {
  return postJson("/api/missions/plan", request, MissionResponseSchema, signal);
}

export function getElevationProfile(
  regionId: string,
  gridPath: GridPoint[],
  signal?: AbortSignal,
): Promise<ElevationProfileResponse> {
  return postJson(
    "/api/terrain/elevation-profile",
    { region_id: regionId, grid_path: gridPath },
    ElevationProfileResponseSchema,
    signal,
  );
}

export { MissionRequestSchema };
