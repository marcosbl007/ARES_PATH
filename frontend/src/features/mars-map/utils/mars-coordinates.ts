import type { GridPoint, RegionMetadata } from "@/shared/types/api-contract";

export type GeoCoordinate = [number, number];
export type GeoExtent = [number, number, number, number];
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
  const latitude = definition.falseNorthingMeters === 0
    ? (y / definition.radiusMeters) * (180 / Math.PI)
    : ((y - definition.falseNorthingMeters) / definition.radiusMeters) * (180 / Math.PI);

  return [longitude, latitude];
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

export function localRasterExtentInLonLat(
  metadata: RegionMetadata,
  definition: MarsEquirectangularDefinition,
): GeoExtent {
  const [height, width] = metadata.shape;
  const transform = metadataTransform(metadata);
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
