import { getJson, postJson } from "@/shared/api/http-client";
import {
  ElevationProfileResponseSchema,
  HealthResponseSchema,
  type AnalysisWindow,
  MissionRequestSchema,
  MissionResponseSchema,
  ScientificTargetSchema,
  TerrainSampleResponseSchema,
  SystemInfoResponseSchema,
  type ElevationProfileResponse,
  type GridPoint,
  type HealthResponse,
  type MissionRequest,
  type MissionResponse,
  type ScientificTarget,
  type TerrainSampleResponse,
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

export function getScientificTarget(
  targetId: string,
  regionId?: string,
  signal?: AbortSignal,
): Promise<ScientificTarget> {
  const query = regionId ? `?region_id=${encodeURIComponent(regionId)}` : "";
  return getJson(
    `/api/missions/scientific-targets/${encodeURIComponent(targetId)}${query}`,
    ScientificTargetSchema,
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
  analysisWindow?: AnalysisWindow | null,
  signal?: AbortSignal,
): Promise<ElevationProfileResponse> {
  return postJson(
    "/api/terrain/elevation-profile",
    {
      region_id: regionId,
      grid_path: gridPath,
      ...(analysisWindow ? { analysis_window: analysisWindow } : {}),
    },
    ElevationProfileResponseSchema,
    signal,
  );
}

export function getTerrainSample(
  regionId: string,
  point: GridPoint,
  terrainConfig: { max_slope_deg: number; slope_weight: number },
  analysisWindow?: AnalysisWindow | null,
  signal?: AbortSignal,
): Promise<TerrainSampleResponse> {
  return postJson(
    "/api/terrain/sample",
    {
      region_id: regionId,
      point,
      terrain_config: terrainConfig,
      ...(analysisWindow ? { analysis_window: analysisWindow } : {}),
    },
    TerrainSampleResponseSchema,
    signal,
  );
}

export { MissionRequestSchema };
