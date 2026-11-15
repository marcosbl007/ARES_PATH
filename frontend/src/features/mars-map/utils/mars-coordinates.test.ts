import { describe, expect, it } from "vitest";

import type { RegionMetadata } from "@/shared/types/api-contract";

import {
  localGridPathToLonLat,
  localGridPointToLonLat,
  localLonLatToGridPoint,
  localRasterExtentInLonLat,
  parseMarsEquirectangularWkt,
} from "./mars-coordinates";

const metadata = {
  shape: [256, 256],
  transform: [1.0096476466229, 0, -551.2676150561033, 0, -1.0096476466229, 1095852.37233921],
  crs_wkt: "PROJCS[\"EQUIRECTANGULAR MARS\",GEOGCS[\"GCS_MARS\",DATUM[\"D_MARS\",SPHEROID[\"Mars_localRadius\",3394839.8133163,0]]],PROJECTION[\"Equirectangular\"],PARAMETER[\"standard_parallel_1\",15],PARAMETER[\"central_meridian\",77.41],PARAMETER[\"false_easting\",0],PARAMETER[\"false_northing\",0]]",
} as RegionMetadata;

describe("Mars local raster georeferencing", () => {
  it("maps the raster extent and cell centers into Mars Trek lon/lat space", () => {
    const definition = parseMarsEquirectangularWkt(metadata.crs_wkt);
    expect(definition).not.toBeNull();

    const extent = localRasterExtentInLonLat(metadata, definition!);
    const firstCell = localGridPointToLonLat({ row: 0, col: 0 }, metadata, definition!);
    const lastCell = localGridPointToLonLat({ row: 255, col: 255 }, metadata, definition!);
    const path = localGridPathToLonLat([
      { row: 0, col: 0 },
      { row: 255, col: 255 },
    ], metadata, definition!);

    expect(extent[0]).toBeLessThan(extent[2]);
    expect(extent[1]).toBeLessThan(extent[3]);
    expect(firstCell[0]).toBeGreaterThan(extent[0]);
    expect(firstCell[1]).toBeLessThan(extent[3]);
    expect(lastCell[0]).toBeLessThan(extent[2]);
    expect(lastCell[1]).toBeGreaterThan(extent[1]);
    expect(path).toHaveLength(2);

    expect(localLonLatToGridPoint(firstCell[0], firstCell[1], metadata, definition!)).toEqual({ row: 0, col: 0 });
    expect(localLonLatToGridPoint(lastCell[0], lastCell[1], metadata, definition!)).toEqual({ row: 255, col: 255 });
    expect(localLonLatToGridPoint(extent[2], extent[3], metadata, definition!)).toBeNull();
  });
});
