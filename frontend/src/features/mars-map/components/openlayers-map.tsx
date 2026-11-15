"use client";

import { useEffect, useRef } from "react";

import Feature from "ol/Feature.js";
import { createEmpty, extend, isEmpty, type Extent } from "ol/extent.js";
import { defaults as defaultInteractions } from "ol/interaction/defaults.js";
import ImageLayer from "ol/layer/Image.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import OlMap from "ol/Map.js";
import Projection from "ol/proj/Projection.js";
import { addProjection } from "ol/proj.js";
import ImageStatic from "ol/source/ImageStatic.js";
import VectorSource from "ol/source/Vector.js";
import WMTS from "ol/source/WMTS.js";
import WMTSTileGrid from "ol/tilegrid/WMTS.js";
import CircleStyle from "ol/style/Circle.js";
import Fill from "ol/style/Fill.js";
import RegularShape from "ol/style/RegularShape.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import Text from "ol/style/Text.js";
import View from "ol/View.js";
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import Polygon from "ol/geom/Polygon.js";

import { resolveApiResourceUrl } from "@/features/mars-map/services/region-api";
import type { MapLayer, MarsMapController, MarsMapStatus } from "@/features/mars-map/types";
import {
  localGridPathToLonLat,
  localGridPointToLonLat,
  localRasterExtentInLonLat,
  parseMarsEquirectangularWkt,
} from "@/features/mars-map/utils/mars-coordinates";
import type { MissionResponse, RegionMetadata } from "@/shared/types/api-contract";

const MARS_TREK_PROJECTION_CODE = "EPSG:104905";
const MARS_TREK_EXTENT: Extent = [-180, -90, 180, 90];
const MARS_TREK_MATRIX_COUNT = 18;
const MARS_TREK_TILE_SIZE = 256;
const MARS_TREK_RESOLUTIONS = Array.from(
  { length: MARS_TREK_MATRIX_COUNT },
  (_, zoom) => 360 / (2 ** (zoom + 1) * MARS_TREK_TILE_SIZE),
);
const MARS_TREK_MATRIX_IDS = Array.from(
  { length: MARS_TREK_MATRIX_COUNT },
  (_, zoom) => String(zoom),
);
const MARS_TREK_MATRIX_SIZES = Array.from(
  { length: MARS_TREK_MATRIX_COUNT },
  (_, zoom) => [2 ** (zoom + 1), 2 ** zoom] as [number, number],
);

const MARS_TREK_PROJECTION = new Projection({
  code: MARS_TREK_PROJECTION_CODE,
  units: "degrees",
  extent: MARS_TREK_EXTENT,
  worldExtent: MARS_TREK_EXTENT,
  metersPerUnit: 111319.49079327358,
  global: true,
});

addProjection(MARS_TREK_PROJECTION);

type OpenLayersMapProps = {
  layers: MapLayer[];
  metadata: RegionMetadata | null;
  mission: MissionResponse | null;
  regionId: string;
  controllerRef: React.MutableRefObject<MarsMapController | null>;
  onStatusChange: (status: MarsMapStatus) => void;
};

function extentFromValues(values: number[] | undefined): Extent | null {
  if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) return null;
  return [values[0], values[1], values[2], values[3]];
}

function createWmtsLayer(
  layer: MapLayer,
  onStatusChange: (status: MarsMapStatus) => void,
): TileLayer<WMTS> | null {
  if (!layer.tileUrlTemplate || !layer.wmtsEndpoint || !layer.wmtsCrs) return null;

  const maxZoom = Math.min(layer.maxZoom ?? 0, MARS_TREK_MATRIX_COUNT - 1);
  const resolutions = MARS_TREK_RESOLUTIONS.slice(0, maxZoom + 1);
  const matrixIds = MARS_TREK_MATRIX_IDS.slice(0, maxZoom + 1);
  const sizes = MARS_TREK_MATRIX_SIZES.slice(0, maxZoom + 1);
  const tileGrid = new WMTSTileGrid({
    origin: [-180, 90],
    resolutions,
    matrixIds,
    sizes,
    tileSize: MARS_TREK_TILE_SIZE,
    extent: MARS_TREK_EXTENT,
  });
  const source = new WMTS({
    url: layer.tileUrlTemplate,
    layer: layer.wmtsLayerId ?? "",
    matrixSet: layer.tileMatrixSet ?? "default028mm",
    style: layer.style ?? "default",
    format: layer.format ?? "image/png",
    requestEncoding: "REST",
    projection: MARS_TREK_PROJECTION,
    tileGrid,
    crossOrigin: "anonymous",
    interpolate: false,
    wrapX: false,
    transition: 0,
    attributions: "NASA / Mars Trek / USGS / JPL",
  });
  source.on("tileloadstart", () => onStatusChange("loading"));
  source.on("tileloadend", () => onStatusChange("ready"));
  source.on("tileloaderror", () => onStatusChange("error"));

  return new TileLayer({
    source,
    visible: layer.active,
    extent: extentFromValues(layer.coverageExtent) ?? undefined,
    zIndex: layer.id === "hirise" ? 11 : 10,
  });
}

function createLocalImageLayer(
  layer: MapLayer,
  metadata: RegionMetadata | null,
  definition: ReturnType<typeof parseMarsEquirectangularWkt>,
  onStatusChange: (status: MarsMapStatus) => void,
): ImageLayer<ImageStatic> | null {
  if (!layer.localPreviewUrl || !metadata || !definition) return null;

  const imageExtent = localRasterExtentInLonLat(metadata, definition);
  const source = new ImageStatic({
    url: resolveApiResourceUrl(layer.localPreviewUrl),
    imageExtent,
    projection: MARS_TREK_PROJECTION,
    crossOrigin: "anonymous",
    interpolate: false,
  });
  source.on("imageloadend", () => onStatusChange("ready"));
  source.on("imageloaderror", () => onStatusChange("error"));

  return new ImageLayer({
    source,
    visible: layer.active,
    opacity: layer.id === "elevation" ? 0.5 : 0.88,
    zIndex: layer.id === "elevation" ? 21 : 20,
  });
}

function styleForRoute(mode: "shortest" | "terrain_aware") {
  return new Style({
    stroke: new Stroke({
      color: mode === "terrain_aware" ? "#5bc0eb" : "#fc3d21",
      width: mode === "terrain_aware" ? 4 : 3,
      lineDash: mode === "shortest" ? [10, 8] : undefined,
    }),
  });
}

function markerStyle(color: string, label: string, shape: "circle" | "diamond" = "circle") {
  return new Style({
    image: shape === "circle"
      ? new CircleStyle({
        radius: 7,
        fill: new Fill({ color: "rgba(3, 7, 13, 0.82)" }),
        stroke: new Stroke({ color, width: 3 }),
      })
      : new RegularShape({
        points: 4,
        radius: 8,
        angle: Math.PI / 4,
        fill: new Fill({ color: "rgba(3, 7, 13, 0.86)" }),
        stroke: new Stroke({ color, width: 2 }),
      }),
    text: new Text({
      text: label,
      offsetY: -19,
      font: "700 10px monospace",
      fill: new Fill({ color: "#edf7ff" }),
      stroke: new Stroke({ color: "rgba(3, 7, 13, 0.92)", width: 4 }),
      backgroundFill: new Fill({ color: "rgba(3, 7, 13, 0.7)" }),
      padding: [3, 5, 3, 5],
    }),
  });
}

export function OpenLayersMap({
  layers,
  metadata,
  mission,
  regionId,
  controllerRef,
  onStatusChange,
}: OpenLayersMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<OlMap | null>(null);
  const layerRegistryRef = useRef(new globalThis.Map<string, TileLayer<WMTS> | ImageLayer<ImageStatic>>());
  const overlaySourceRef = useRef<VectorSource | null>(null);

  useEffect(() => {
    if (
      !containerRef.current
      || typeof window === "undefined"
      || typeof ResizeObserver === "undefined"
      || !metadata
      || layers.length === 0
      || mapRef.current
    ) return undefined;

    const definition = parseMarsEquirectangularWkt(metadata.crs_wkt);
    if (!definition) onStatusChange("warning");

    const mapLayers: Array<TileLayer<WMTS> | ImageLayer<ImageStatic>> = [];
    const regionalExtent = createEmpty();
    const localLayers = layers.filter((layer) => layer.sourceKind === "local");
    const layerRegistry = layerRegistryRef.current;

    for (const layer of layers) {
      const olLayer = layer.sourceKind === "mars-trek"
        ? createWmtsLayer(layer, onStatusChange)
        : createLocalImageLayer(layer, metadata, definition, onStatusChange);
      if (!olLayer) continue;

      layerRegistry.set(layer.id, olLayer);
      mapLayers.push(olLayer);
      if (layer.sourceKind === "mars-trek") {
        const coverageExtent = extentFromValues(layer.coverageExtent);
        if (coverageExtent) extend(regionalExtent, coverageExtent);
      }
    }

    if (isEmpty(regionalExtent) && definition && localLayers.length > 0) {
      const localExtent = localRasterExtentInLonLat(metadata, definition);
      extend(regionalExtent, localExtent);
    }

    const overlaySource = new VectorSource();
    overlaySourceRef.current = overlaySource;
    const overlayLayer = new VectorLayer({
      source: overlaySource,
      zIndex: 100,
    });

    const view = new View({
      projection: MARS_TREK_PROJECTION,
      center: [77.41, 18.46],
      zoom: 5,
      minZoom: 0,
      maxZoom: MARS_TREK_MATRIX_COUNT - 1,
      extent: MARS_TREK_EXTENT,
      constrainOnlyCenter: true,
      showFullExtent: true,
    });
    const map = new OlMap({
      target: containerRef.current,
      layers: [...mapLayers, overlayLayer],
      view,
      controls: [],
      interactions: defaultInteractions(),
    });

    mapRef.current = map;
    map.updateSize();
    if (!isEmpty(regionalExtent)) {
      view.fit(regionalExtent, {
        padding: [78, 78, 78, 78],
        maxZoom: 11,
        duration: 0,
      });
    }

    controllerRef.current = {
      zoomIn: () => view.animate({ zoom: Math.min((view.getZoom() ?? 0) + 1, MARS_TREK_MATRIX_COUNT - 1), duration: 180 }),
      zoomOut: () => view.animate({ zoom: Math.max((view.getZoom() ?? 0) - 1, 0), duration: 180 }),
      resetView: () => {
        if (!isEmpty(regionalExtent)) {
          view.fit(regionalExtent, { padding: [78, 78, 78, 78], maxZoom: 11, duration: 220 });
        }
      },
      resetRotation: () => view.setRotation(0),
      fitComputationalExtent: () => {
        if (definition) {
          view.fit(localRasterExtentInLonLat(metadata, definition), {
            padding: [110, 110, 110, 110],
            maxZoom: 17,
            duration: 220,
          });
        }
      },
    };

    const frame = window.requestAnimationFrame(() => {
      map.updateSize();
      if (!isEmpty(regionalExtent)) {
        view.fit(regionalExtent, { padding: [78, 78, 78, 78], maxZoom: 11, duration: 0 });
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      controllerRef.current = null;
      overlaySourceRef.current = null;
      layerRegistry.clear();
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
    };
    // Layer visibility changes are handled by the following effect without rebuilding the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerRef, layers.length, metadata?.processed_sha256, onStatusChange, regionId]);

  useEffect(() => {
    for (const layer of layers) {
      layerRegistryRef.current.get(layer.id)?.setVisible(layer.active);
    }
  }, [layers]);

  useEffect(() => {
    const source = overlaySourceRef.current;
    if (!source) return;

    source.clear();
    if (!metadata) return;

    const definition = parseMarsEquirectangularWkt(metadata.crs_wkt);
    if (!definition) {
      onStatusChange("warning");
      return;
    }

    const localExtent = localRasterExtentInLonLat(metadata, definition);
    const boundaryFeature = new Feature({
      geometry: new Polygon([[
        [localExtent[0], localExtent[1]],
        [localExtent[2], localExtent[1]],
        [localExtent[2], localExtent[3]],
        [localExtent[0], localExtent[3]],
        [localExtent[0], localExtent[1]],
      ]]),
    });
    boundaryFeature.setStyle(new Style({
      stroke: new Stroke({ color: "#fdb813", width: 2, lineDash: [8, 6] }),
      fill: new Fill({ color: "rgba(253, 184, 19, 0.07)" }),
    }));
    source.addFeature(boundaryFeature);

    for (const route of mission?.routes ?? []) {
      const coordinates = localGridPathToLonLat(route.grid_path, metadata, definition);
      if (coordinates.length < 2) continue;
      const routeFeature = new Feature({
        geometry: new LineString(coordinates),
        routeMode: route.mode,
      });
      routeFeature.setStyle(styleForRoute(route.mode));
      source.addFeature(routeFeature);
    }

    const firstRoute = mission?.routes[0];
    const start = firstRoute?.grid_path[0];
    const destination = firstRoute?.grid_path.at(-1);
    if (start) {
      const startFeature = new Feature({
        geometry: new Point(localGridPointToLonLat(start, metadata, definition)),
      });
      startFeature.setStyle(markerStyle("#5bc0eb", `ORIGIN / R${start.row} C${start.col}`));
      source.addFeature(startFeature);
    }
    if (destination) {
      const destinationFeature = new Feature({
        geometry: new Point(localGridPointToLonLat(destination, metadata, definition)),
      });
      destinationFeature.setStyle(markerStyle("#fdb813", `DESTINATION / R${destination.row} C${destination.col}`));
      source.addFeature(destinationFeature);
    }

    for (const target of mission?.scientific_targets ?? []) {
      if (!target.position || target.coordinate_status !== "verified") continue;
      const targetFeature = new Feature({
        geometry: new Point(localGridPointToLonLat(target.position, metadata, definition)),
      });
      targetFeature.setStyle(markerStyle("#fdb813", target.name, "diamond"));
      source.addFeature(targetFeature);
    }
  }, [metadata, mission, onStatusChange]);

  return (
    <div
      ref={containerRef}
      className="ol-map-container"
      data-region-id={regionId}
      aria-label="NASA Mars Trek orbital map with local computational overlays"
    />
  );
}
