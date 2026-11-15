import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

describe("frontend foundation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.endsWith("/api/health")
        ? { status: "ok" }
        : url.endsWith("/api/system/info")
          ? {
              project: "ARES PATH",
              version: "0.1.0",
              challenge: "Interplanetary Survival Guide: Martian Map",
              scope: "test",
              status: "prototype",
              warning: "Research prototype; not operational EVA navigation or safety guidance.",
            }
          : url.endsWith("/api/data/regions")
            ? [{
                region_id: "synthetic",
                shape: [10, 10],
                transform: [1, 0, 0, 0, -1, 0],
                crs_wkt: "MARS_SYNTHETIC_METRIC",
                pixel_size_x_m: 1,
                pixel_size_y_m: 1,
                source_ids: ["synthetic"],
                valid_cells: 100,
                processed_sha256: "synthetic",
              }]
            : url.includes("/api/data/mars-trek/layers")
              ? []
            : url.endsWith("/layers")
              ? [{
                  layer_id: "elevation",
                  units: "m",
                  type: "raster",
                  source_ids: ["synthetic"],
                  used_for_routing: true,
                }]
              : url.includes("/scientific-targets")
                ? []
                : {
                    region_id: "synthetic",
                    shape: [10, 10],
                    transform: [1, 0, 0, 0, -1, 0],
                    crs_wkt: "MARS_SYNTHETIC_METRIC",
                    pixel_size_x_m: 1,
                    pixel_size_y_m: 1,
                    source_ids: ["synthetic"],
                    valid_cells: 100,
                    processed_sha256: "synthetic",
                  };

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
      } as Response;
    }));
  });

  it("exposes the technical application entry point", () => {
    render(<Home />);

    expect(screen.getByAltText("ARES PATH")).toBeInTheDocument();
  });

  it("loads a region from the backend contract", async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByDisplayValue("synthetic")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("10 × 10 cells · 100 valid cells")).toBeInTheDocument());
  });
});
