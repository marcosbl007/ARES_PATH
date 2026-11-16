import { describe, expect, it } from "vitest";

import type { RegionMetadata } from "@/shared/types/api-contract";

import {
  createDefaultAnalysisWindow,
  isPointInAnalysisWindow,
  normalizeAnalysisWindow,
} from "./analysis-window";

const metadata = {
  region_id: "jezero_fan_512",
  shape: [512, 512],
} as RegionMetadata;

describe("regional analysis window", () => {
  it("starts centered and never leaves the selected raster", () => {
    const initial = createDefaultAnalysisWindow(metadata);
    const normalized = normalizeAnalysisWindow({
      row: -20,
      col: 500,
      height: 400,
      width: 400,
    }, metadata);

    expect(initial).toEqual({ row: 0, col: 0, height: 512, width: 512 });
    expect(normalized).toEqual({ row: 0, col: 112, height: 400, width: 400 });
    expect(isPointInAnalysisWindow({ row: 0, col: 112 }, normalized)).toBe(true);
    expect(isPointInAnalysisWindow({ row: 400, col: 511 }, normalized)).toBe(false);
  });

  it("keeps large-region analysis within the deployed compute budget", () => {
    const largeRegion = { ...metadata, shape: [2048, 2048] } as RegionMetadata;

    expect(createDefaultAnalysisWindow(largeRegion)).toEqual({
      row: 768, col: 768, height: 512, width: 512,
    });
    expect(normalizeAnalysisWindow({
      row: 0, col: 0, height: 1024, width: 1024,
    }, largeRegion)).toEqual({
      row: 0, col: 0, height: 512, width: 512,
    });
  });
});
