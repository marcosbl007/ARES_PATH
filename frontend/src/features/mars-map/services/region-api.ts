import { getJson } from "@/shared/api/http-client";
import {
  LayerSchema,
  RegionMetadataSchema,
  type Layer,
  type RegionMetadata,
} from "@/shared/types/api-contract";

const RegionListSchema = RegionMetadataSchema.array();
const LayerListSchema = LayerSchema.array();

export function getRegions(signal?: AbortSignal): Promise<RegionMetadata[]> {
  return getJson("/api/data/regions", RegionListSchema, signal);
}

export function getRegionMetadata(
  regionId: string,
  signal?: AbortSignal,
): Promise<RegionMetadata> {
  return getJson(`/api/data/regions/${encodeURIComponent(regionId)}`, RegionMetadataSchema, signal);
}

export function getRegionLayers(regionId: string, signal?: AbortSignal): Promise<Layer[]> {
  return getJson(
    `/api/data/regions/${encodeURIComponent(regionId)}/layers`,
    LayerListSchema,
    signal,
  );
}
