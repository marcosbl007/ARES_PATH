import { describe, expect, it } from "vitest";

import { getRasterTileUrl } from "./region-api";

describe("raster tile URL adapter", () => {
  it("resolves the backend native tile template against the configured API", () => {
    const template = "/api/data/regions/jezero_demo/layers/elevation/tiles/{z}/{x}/{y}.png";

    expect(getRasterTileUrl(template, 2, 3, 1)).toBe(
      "http://localhost:8000/api/data/regions/jezero_demo/layers/elevation/tiles/2/3/1.png",
    );
  });
});
