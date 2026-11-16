import type { AnalysisWindow, GridPoint, RegionMetadata } from "@/shared/types/api-contract";

export type GeoCoordinate = [number, number];
export type GeoExtent = [number, number, number, number];
export type GridPosition = { row: number; col: number };
export type MarsEquirectangularDefinition = {
  radiusMeters: number;
  standardParallelDegrees: number;
  centralMeridianDegrees: number;
  falseEastingMeters: number;
  falseNorthingMeters: number;
};

type AffineTransform = [number, number, number, number, number, number];

const NUMBER_PATTERN = "[-+]?\\d*\\.?\\d+(?:[Ee][-+]?\\d+)?";

function readWktNumber(wkt: string, parameter: string): number | null {
  const match = wkt.match(new RegExp(`(?:PARAMETER|SPHEROID)\\[\\\"[^\\\"]*${parameter}[^\\\"]*\\\",\\s*(${NUMBER_PATTERN})`, "i"));
  return match ? Number(match[1]) : null;
}

function readParameter(wkt: string, parameter: string): number | null {
  const match = wkt.match(new RegExp(`PARAMETER\\[\\\"${parameter}\\\",\\s*(${NUMBER_PATTERN})`, "i"));
  return match ? Number(match[1]) : null;
}

export function parseMarsEquirectangularWkt(wkt: string): MarsEquirectangularDefinition | null {
  if (!/EQUIRECTANGULAR/i.test(wkt)) return null;

  const radiusMeters = readWktNumber(wkt, "Mars_localRadius") ?? readWktNumber(wkt, "Mars") ?? null;
  const standardParallelDegrees = readParameter(wkt, "standard_parallel_1");
  const centralMeridianDegrees = readParameter(wkt, "central_meridian");
  const falseEastingMeters = readParameter(wkt, "false_easting") ?? 0;
  const falseNorthingMeters = readParameter(wkt, "false_northing") ?? 0;

  if (
    radiusMeters === null
    || standardParallelDegrees === null
    || centralMeridianDegrees === null
    || !Number.isFinite(radiusMeters)
    || !Number.isFinite(standardParallelDegrees)
    || !Number.isFinite(centralMeridianDegrees)
  ) {
    return null;
  }

  return {
    radiusMeters,
    standardParallelDegrees,
    centralMeridianDegrees,
    falseEastingMeters,
    falseNorthingMeters,
  };
}

export function marsMapToLonLat(
  x: number,
  y: number,
  definition: MarsEquirectangularDefinition,
): GeoCoordinate {
  const standardParallelRadians = (definition.standardParallelDegrees * Math.PI) / 180;
  const longitude = definition.centralMeridianDegrees
    + ((x - definition.falseEastingMeters) / (definition.radiusMeters * Math.cos(standardParallelRadians))) * (180 / Math.PI);
  const latitude = ((y - definition.falseNorthingMeters) / definition.radiusMeters) * (180 / Math.PI);

  return [longitude, latitude];
}

export function lonLatToMarsMap(
  longitude: number,
  latitude: number,
  definition: MarsEquirectangularDefinition,
): [number, number] {
  const standardParallelRadians = (definition.standardParallelDegrees * Math.PI) / 180;
  const x = definition.falseEastingMeters
    + (longitude - definition.centralMeridianDegrees) * (Math.PI / 180)
      * definition.radiusMeters * Math.cos(standardParallelRadians);
  const y = definition.falseNorthingMeters + latitude * (Math.PI / 180) * definition.radiusMeters;

  return [x, y];
}

function affinePoint(
  transform: AffineTransform,
  column: number,
  row: number,
): [number, number] {
  const [a, b, c, d, e, f] = transform;
  return [
    a * column + b * row + c,
    d * column + e * row + f,
  ];
}

function metadataTransform(metadata: RegionMetadata): AffineTransform {
  return metadata.transform as AffineTransform;
}

export function rasterExtentInLonLat(
  shape: [number, number],
  transform: AffineTransform,
  definition: MarsEquirectangularDefinition,
): GeoExtent {
  const [height, width] = shape;
  const corners = [
    affinePoint(transform, 0, 0),
    affinePoint(transform, width, 0),
    affinePoint(transform, width, height),
    affinePoint(transform, 0, height),
  ].map(([x, y]) => marsMapToLonLat(x, y, definition));
  const longitudes = corners.map(([longitude]) => longitude);
  const latitudes = corners.map(([, latitude]) => latitude);

  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function localRasterExtentInLonLat(
  metadata: RegionMetadata,
  definition: MarsEquirectangularDefinition,
): GeoExtent {
  return rasterExtentInLonLat(metadata.shape, metadataTransform(metadata), definition);
}

export function localGridWindowToLonLatExtent(
  window: AnalysisWindow,
  metadata: RegionMetadata,
  definition: MarsEquirectangularDefinition,
): GeoExtent {
  const transform = metadataTransform(metadata);
  const corners = [
    affinePoint(transform, window.col, window.row),
    affinePoint(transform, window.col + window.width, window.row),
    affinePoint(transform, window.col + window.width, window.row + window.height),
    affinePoint(transform, window.col, window.row + window.height),
  ].map(([x, y]) => marsMapToLonLat(x, y, definition));
  const longitudes = corners.map(([longitude]) => longitude);
  const latitudes = corners.map(([, latitude]) => latitude);

  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function localGridPointToLonLat(
  point: GridPoint,
  metadata: RegionMetadata,
  definition: MarsEquirectangularDefinition,
): GeoCoordinate {
  const [x, y] = affinePoint(metadataTransform(metadata), point.col + 0.5, point.row + 0.5);
  return marsMapToLonLat(x, y, definition);
}

export function localGridPathToLonLat(
  path: GridPoint[],
  metadata: RegionMetadata,
  definition: MarsEquirectangularDefinition,
): GeoCoordinate[] {
  return path.map((point) => localGridPointToLonLat(point, metadata, definition));
}

export function localLonLatToGridPoint(
  longitude: number,
  latitude: number,
  metadata: RegionMetadata,
  definition: MarsEquirectangularDefinition,
): GridPoint | null {
  const position = localLonLatToGridPosition(longitude, latitude, metadata, definition);
  if (!position) return null;

  const [height, width] = metadata.shape;
  const edgeTolerance = 1e-9;
  if (
    position.row < -edgeTolerance
    || position.col < -edgeTolerance
    || position.row >= height - edgeTolerance
    || position.col >= width - edgeTolerance
  ) {
    return null;
  }

  return {
    row: Math.min(height - 1, Math.max(0, Math.floor(position.row))),
    col: Math.min(width - 1, Math.max(0, Math.floor(position.col))),
  };
}

export function localLonLatToGridPosition(
  longitude: number,
  latitude: number,
  metadata: RegionMetadata,
  definition: MarsEquirectangularDefinition,
): GridPosition | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

  const [x, y] = lonLatToMarsMap(longitude, latitude, definition);
  const [a, b, c, d, e, f] = metadataTransform(metadata);
  const determinant = a * e - b * d;
  if (Math.abs(determinant) < Number.EPSILON) return null;

  const column = ((x - c) * e - b * (y - f)) / determinant;
  const row = (a * (y - f) - d * (x - c)) / determinant;
  return {
    row,
    col: column,
  };
}
