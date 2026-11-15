import type { RegionMetadata } from "@/shared/types/api-contract";

export function formatRegionLabel(region: RegionMetadata) {
  const [height, width] = region.shape;
  const widthKm = (width * region.pixel_size_x_m) / 1000;
  const heightKm = (height * region.pixel_size_y_m) / 1000;
  const name = region.region_id.replaceAll("_", " ");

  return `${name} · ${width} × ${height} cells · ${widthKm.toFixed(2)} × ${heightKm.toFixed(2)} km`;
}

