import { z } from "zod";

import {
  ElevationProfileResponseSchema,
  LayerSchema,
  MarsTrekLayerSchema,
  MissionRequestSchema,
  MissionResponseSchema,
  RegionMetadataSchema,
} from "@/shared/types/api-contract";
import type {
  ElevationProfileResponse,
  Layer,
  MarsTrekLayer,
  MissionRequest,
  MissionResponse,
  RegionMetadata,
} from "@/shared/types/api-contract";

export const MISSION_PACK_SCHEMA_VERSION = 1 as const;

export const MissionPackResourceSchema = z.object({
  kind: z.enum(["local_preview", "local_raster", "nasa_wmts"]),
  url: z.string().min(1),
  status: z.enum(["bundled", "online_only"]),
  note: z.string(),
}).strict();

export const MissionPackSchema = z.object({
  schema_version: z.literal(MISSION_PACK_SCHEMA_VERSION),
  package_id: z.string().min(1),
  saved_at: z.string().datetime({ offset: true }),
  region_id: z.string().min(1),
  request: MissionRequestSchema,
  region_metadata: RegionMetadataSchema,
  layers: LayerSchema.array(),
  mars_trek_layers: MarsTrekLayerSchema.array(),
  mission: MissionResponseSchema,
  elevation_profile: ElevationProfileResponseSchema.nullable(),
  resources: MissionPackResourceSchema.array(),
  offline_capabilities: z.object({
    mission_response: z.literal("cached"),
    elevation_profile: z.enum(["cached", "not_included"]),
    local_map_preview: z.enum(["cached", "not_included"]).optional(),
    nasa_wmts: z.literal("online_only").optional(),
    map_tiles: z.enum(["online_only", "local_preview_cached"]).optional(),
  }).passthrough(),
}).passthrough();

export type MissionPackResource = {
  kind: "local_preview" | "local_raster" | "nasa_wmts";
  url: string;
  status: "bundled" | "online_only";
  note: string;
};

export type MissionPack = {
  schema_version: typeof MISSION_PACK_SCHEMA_VERSION;
  package_id: string;
  saved_at: string;
  region_id: string;
  request: MissionRequest;
  region_metadata: RegionMetadata;
  layers: Layer[];
  mars_trek_layers: MarsTrekLayer[];
  mission: MissionResponse;
  elevation_profile: ElevationProfileResponse | null;
  resources: MissionPackResource[];
  offline_capabilities: {
    mission_response: "cached";
    elevation_profile: "cached" | "not_included";
    local_map_preview: "cached" | "not_included";
    nasa_wmts: "online_only";
  };
};

export type MissionPackInput = Omit<MissionPack, "schema_version" | "package_id" | "saved_at" | "resources" | "offline_capabilities">;
