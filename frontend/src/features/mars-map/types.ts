export type MapLayerId = "elevation" | "optical";

export type MapLayer = {
  id: MapLayerId;
  label: string;
  color: string;
  active: boolean;
  tileUrlTemplate?: string;
  tileScheme?: string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  shape?: [number, number];
  mapBounds?: [number, number, number, number];
};
