export type MapLayerId = "ctx" | "hirise" | "elevation" | "optical";

export type MapLayer = {
  id: MapLayerId;
  label: string;
  color: string;
  active: boolean;
  sourceKind: "mars-trek" | "local";
  wmtsLayerId?: string;
  wmtsEndpoint?: string;
  capabilitiesUrl?: string;
  wmtsCrs?: string;
  tileUrlTemplate?: string;
  tileMatrixSet?: string;
  style?: string;
  format?: string;
  coverageExtent?: [number, number, number, number];
  coverageCoordinateSystem?: string;
  localPreviewUrl?: string;
  localRasterUrl?: string;
  localCrsWkt?: string;
  localTransform?: [number, number, number, number, number, number];
  localShape?: [number, number];
  localMapBounds?: [number, number, number, number];
  tileScheme?: string;
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
};

export type MarsMapStatus = "loading" | "ready" | "warning" | "error";

export type MarsMapController = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  resetRotation: () => void;
  fitComputationalExtent: () => void;
};
