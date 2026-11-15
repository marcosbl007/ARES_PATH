"use client";

import { useMemo, useState } from "react";

import { getRasterTileUrl } from "@/features/mars-map/services/region-api";
import type { MapLayer } from "@/features/mars-map/types";

const MAX_VISIBLE_TILE_ZOOM = 3;

type RasterTileLayerProps = {
  layer: MapLayer;
  zoomLevel: number;
};

function tileCoordinates(matrixSize: number) {
  return Array.from({ length: matrixSize * matrixSize }, (_, index) => ({
    column: index % matrixSize,
    row: Math.floor(index / matrixSize),
  }));
}

export function RasterTileLayer({ layer, zoomLevel }: RasterTileLayerProps) {
  const [tileError, setTileError] = useState(false);
  const minimumZoom = layer.minZoom ?? 0;
  const maximumZoom = Math.min(layer.maxZoom ?? MAX_VISIBLE_TILE_ZOOM, MAX_VISIBLE_TILE_ZOOM);
  const tileZoom = Math.max(
    minimumZoom,
    Math.min(maximumZoom, Math.max(0, Math.floor(zoomLevel))),
  );
  const matrixSize = 2 ** tileZoom;
  const coordinates = useMemo(() => tileCoordinates(matrixSize), [matrixSize]);

  if (!layer.tileUrlTemplate) {
    return (
      <div className="raster-layer raster-layer--unavailable" aria-label={`${layer.label} unavailable`}>
        <span>RASTER TILE URL UNAVAILABLE</span>
      </div>
    );
  }

  return (
    <div
      className="raster-layer"
      data-layer-id={layer.id}
      data-tile-zoom={tileZoom}
      aria-label={`${layer.label} native raster`}
    >
      <div
        className="raster-layer__tiles"
        style={{
          gridTemplateColumns: `repeat(${matrixSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${matrixSize}, minmax(0, 1fr))`,
        }}
      >
        {coordinates.map(({ column, row }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tileZoom}-${column}-${row}`}
            className="raster-layer__tile"
            src={getRasterTileUrl(layer.tileUrlTemplate!, tileZoom, column, row)}
            alt=""
            draggable={false}
            loading={tileZoom < 2 ? "eager" : "lazy"}
            onError={() => setTileError(true)}
          />
        ))}
      </div>
      {tileError ? (
        <div className="raster-layer__error" role="status">
          RASTER TILE REQUEST FAILED
        </div>
      ) : null}
    </div>
  );
}
