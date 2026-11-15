import type { Layer, MarsTrekLayer } from "@/shared/types/api-contract";

import { resolveApiResourceUrl } from "@/features/mars-map/services/region-api";

import {
  MISSION_PACK_SCHEMA_VERSION,
  MissionPackSchema,
  type MissionPack,
  type MissionPackInput,
  type MissionPackResource,
} from "../types";

const DATABASE_NAME = "ares-path-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "mission-packs";

const memoryPacks = new Map<string, MissionPack>();

function hasIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "package_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
  });
}

function closeAfter<T>(database: IDBDatabase, transaction: IDBTransaction, request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

function randomPackageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `mission-pack-${crypto.randomUUID()}`;
  }

  return `mission-pack-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resourcesForLayers(layers: Layer[], marsTrekLayers: MarsTrekLayer[]): MissionPackResource[] {
  const localResources = layers.flatMap((layer): MissionPackResource[] => {
    const resources: MissionPackResource[] = [];
    if (layer.preview_url) {
      resources.push({
        kind: "local_preview",
        url: layer.preview_url,
        status: layer.cached_preview_data_url ? "bundled" : "online_only",
        note: layer.cached_preview_data_url
          ? "A compact image preview is embedded in this Mission Pack."
          : "The local preview could not be bundled and remains served by the backend.",
      });
    }
    if (layer.raster_url) {
      resources.push({
        kind: "local_raster",
        url: layer.raster_url,
        status: "online_only",
        note: "The source GeoTIFF remains served by the backend; the offline pack uses the compact preview instead.",
      });
    }
    return resources;
  });

  const orbitalResources = marsTrekLayers.map((layer) => ({
    kind: "nasa_wmts" as const,
    url: layer.wmts_endpoint,
    status: "online_only" as const,
    note: "Remote NASA WMTS tiles are not embedded in the portable pack.",
  }));
  const allResources = [...localResources, ...orbitalResources];
  const uniqueResources = new Map(allResources.map((resource) => [`${resource.kind}:${resource.url}`, resource]));

  return [...uniqueResources.values()];
}

export function createMissionPack(input: MissionPackInput, savedAt = new Date()): MissionPack {
  return {
    ...input,
    schema_version: MISSION_PACK_SCHEMA_VERSION,
    package_id: randomPackageId(),
    saved_at: savedAt.toISOString(),
    resources: resourcesForLayers(input.layers, input.mars_trek_layers),
    offline_capabilities: {
      mission_response: "cached",
      elevation_profile: input.elevation_profile ? "cached" : "not_included",
      local_map_preview: input.layers.some((layer) => Boolean(layer.cached_preview_data_url))
        ? "cached"
        : "not_included",
      nasa_wmts: "online_only",
    },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The raster preview could not be serialized."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("The raster preview could not be read."));
    reader.readAsDataURL(blob);
  });
}

async function fetchPreviewDataUrl(previewUrl: string): Promise<string | null> {
  if (/^(data:|blob:)/i.test(previewUrl) || typeof window === "undefined") return null;

  try {
    const response = await fetch(resolveApiResourceUrl(previewUrl), { cache: "no-store" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export async function prepareMissionPack(input: MissionPackInput, savedAt = new Date()): Promise<MissionPack> {
  const layers = await Promise.all(input.layers.map(async (layer) => {
    if (!layer.preview_url || layer.cached_preview_data_url) return layer;
    const cachedPreview = await fetchPreviewDataUrl(layer.preview_url);
    return cachedPreview ? { ...layer, cached_preview_data_url: cachedPreview } : layer;
  }));

  return createMissionPack({ ...input, layers }, savedAt);
}

function normalizeMissionPack(value: unknown): MissionPack {
  const parsed = MissionPackSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const issuePath = issue?.path.length ? ` (${issue.path.join(".")}: ${issue.message})` : "";
    throw new Error(
      `This file is not a complete ARES PATH Mission Pack${issuePath}. Export an Offline Mission Pack JSON and try again.`,
    );
  }

  const raw = parsed.data;
  const localMapPreview = raw.offline_capabilities.local_map_preview
    ?? (raw.offline_capabilities.map_tiles === "local_preview_cached" ? "cached" : "not_included");

  return {
    ...raw,
    resources: raw.resources.length > 0
      ? raw.resources
      : resourcesForLayers(raw.layers, raw.mars_trek_layers),
    offline_capabilities: {
      mission_response: "cached",
      elevation_profile: raw.offline_capabilities.elevation_profile,
      local_map_preview: localMapPreview,
      nasa_wmts: "online_only",
    },
  };
}

export async function listMissionPacks(): Promise<MissionPack[]> {
  if (!hasIndexedDb()) {
    return [...memoryPacks.values()].sort((left, right) => right.saved_at.localeCompare(left.saved_at));
  }

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).getAll();
  const packs = await closeAfter(database, transaction, request);
  let firstInvalidPackError: Error | null = null;
  const normalizedPacks = (packs as unknown[])
    .flatMap((value) => {
      try {
        return [normalizeMissionPack(value)];
      } catch (error) {
        firstInvalidPackError ??= error instanceof Error ? error : new Error("A saved Mission Pack is invalid.");
        return [];
      }
    });
  if (normalizedPacks.length === 0 && packs.length > 0 && firstInvalidPackError) throw firstInvalidPackError;
  return normalizedPacks
    .sort((left, right) => right.saved_at.localeCompare(left.saved_at));
}

export async function importMissionPack(value: unknown): Promise<MissionPack> {
  const pack = normalizeMissionPack(value);
  await saveMissionPack(pack);
  return pack;
}

export async function saveMissionPack(pack: MissionPack): Promise<void> {
  if (!hasIndexedDb()) {
    for (const [packageId, existing] of memoryPacks) {
      if (existing.region_id === pack.region_id && packageId !== pack.package_id) memoryPacks.delete(packageId);
    }
    memoryPacks.set(pack.package_id, pack);
    return;
  }

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const existingRequest = store.getAll();
  await new Promise<void>((resolve, reject) => {
    existingRequest.onsuccess = () => {
      for (const existing of existingRequest.result as MissionPack[]) {
        if (existing.region_id === pack.region_id && existing.package_id !== pack.package_id) {
          store.delete(existing.package_id);
        }
      }
      store.put(pack);
    };
    existingRequest.onerror = () => reject(existingRequest.error ?? new Error("IndexedDB request failed."));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
  database.close();
}

export async function deleteMissionPack(packageId: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryPacks.delete(packageId);
    return;
  }

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const request = transaction.objectStore(STORE_NAME).delete(packageId);
  await closeAfter(database, transaction, request);
}
