import { getJson } from "@/shared/api/http-client";
import { API_BASE_URL } from "@/shared/config/runtime";
import {
  LayerSchema,
  RegionMetadataSchema,
  type Layer,
  type RegionMetadata,
} from "@/shared/types/api-contract";

const RegionListSchema = RegionMetadataSchema.array();
const LayerListSchema = LayerSchema.array();

export function resolveApiResourceUrl(resourcePath: string): string {
  return new URL(resourcePath, `${API_BASE_URL}/`).toString();
}

export function getRasterTileUrl(
  tileUrlTemplate: string,
  zoom: number,
  column: number,
  row: number,
): string {
  const path = tileUrlTemplate
    .replace("{z}", String(zoom))
    .replace("{x}", String(column))
    .replace("{y}", String(row));

  return resolveApiResourceUrl(path);
}

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
