import { describe, expect, it } from "vitest";

import type {
  ElevationProfileResponse,
  Layer,
  MissionRequest,
  MissionResponse,
  RegionMetadata,
} from "@/shared/types/api-contract";

import { createMissionPack } from "./mission-pack-store";
import type { MissionPackInput } from "../types";

const request: MissionRequest = {
  region_id: "jezero_fan_256",
  coordinate_system: "grid_row_col",
  start: { row: 10, col: 20 },
  destination: { row: 80, col: 65 },
  mode: "compare",
  terrain_config: { max_slope_deg: 20, slope_weight: 2 },
  scientific_target_ids: [],
};

const metadata: RegionMetadata = {
  region_id: request.region_id,
  shape: [256, 256],
  transform: [1, 0, 0, 0, -1, 256],
  crs_wkt: "PROJCS[\"EQUIRECTANGULAR MARS\"]",
  pixel_size_x_m: 1,
  pixel_size_y_m: 1,
  source_ids: ["DTEEC_TEST"],
  valid_cells: 65536,
  processed_sha256: "test-sha256",
};

const layers: Layer[] = [{
  layer_id: "elevation",
  units: "m",
  type: "elevation",
  source_ids: ["DTEEC_TEST"],
  used_for_routing: true,
  preview_url: "/api/data/regions/jezero_fan_256/layers/elevation/preview.png",
}];

const mission: MissionResponse = {
  mission_id: "mission-test",
  region_id: request.region_id,
  coordinate_system: "grid_row_col",
  routes: [{
    route_id: "shortest",
    mode: "shortest",
    grid_path: [request.start, request.destination],
    metrics: {
      distance_m: 10,
      ascent_m: 1,
      descent_m: 0,
      max_slope_deg: 2,
      cost: 10,
      cell_count: 2,
    },
    expanded_cells: 4,
    coordinate_system: "grid_row_col",
  }],
  comparison: null,
  scientific_targets: [],
  data_sources: ["DTEEC_TEST"],
  methodology_version: "test",
  limitations: ["test fixture"],
};

const profile: ElevationProfileResponse = {
  grid_path: [request.start, request.destination],
  cumulative_distance_m: [0, 10],
  elevation_m: [-2420, -2419],
  distance_m: 10,
  ascent_m: 1,
  descent_m: 0,
  max_slope_deg: 2,
};

describe("mission pack serialization", () => {
  it("records the response and distinguishes local previews from remote tiles", () => {
    const input: MissionPackInput = {
      region_id: request.region_id,
      request,
      region_metadata: metadata,
      layers,
      mars_trek_layers: [],
      mission,
      elevation_profile: profile,
    };
    const pack = createMissionPack(input, new Date("2026-11-14T12:00:00.000Z"));

    expect(pack.schema_version).toBe(1);
    expect(pack.saved_at).toBe("2026-11-14T12:00:00.000Z");
    expect(pack.mission.mission_id).toBe("mission-test");
    expect(pack.offline_capabilities).toEqual({
      mission_response: "cached",
      elevation_profile: "cached",
      local_map_preview: "not_included",
      nasa_wmts: "online_only",
    });
    expect(pack.resources).toEqual([expect.objectContaining({
      kind: "local_preview",
      status: "online_only",
    })]);
  });
});
