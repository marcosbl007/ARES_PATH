"""Raster assets, local native tiles and preview renderings for the API.

The service deliberately keeps two representations separate:

* ``/raster`` returns the original processed GeoTIFF bytes, preserving the
  numeric elevation values and georeferencing.
* ``/preview.png`` and ``/tiles`` return display-only RGBA renderings. Their
  pixels must never be used as terrain measurements or by the route planner.

The local tile matrix is an AOI matrix in the raster's native projected Mars
CRS. It is not Web Mercator and it is not the global Mars Trek WMTS matrix.
This makes the coordinate contract explicit until a reprojection target is
agreed with the map client.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from math import isfinite
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.io import MemoryFile
from rasterio.windows import from_bounds

from .processor import sha256, validate_region_id


TILE_SIZE = 256
LOCAL_TILE_MAX_ZOOM = 12
_SUPPORTED_LAYER_IDS = frozenset(("elevation", "orthoimage"))


class LayerNotFound(KeyError):
    """Raised when a region does not expose the requested raster layer."""


@dataclass(frozen=True)
class TileBounds:
    """Bounds for one tile in the native projected raster CRS."""

    left: float
    bottom: float
    right: float
    top: float

    def as_tuple(self) -> tuple[float, float, float, float]:
        return self.left, self.bottom, self.right, self.top


def tile_bounds(
    bounds: tuple[float, float, float, float],
    zoom: int,
    column: int,
    row: int,
) -> TileBounds:
    """Calculate an AOI-local XYZ tile extent without a terrestrial CRS."""

    if zoom < 0 or zoom > LOCAL_TILE_MAX_ZOOM:
        raise ValueError(f"Local tile zoom must be between 0 and {LOCAL_TILE_MAX_ZOOM}.")

    matrix_size = 1 << zoom
    if not (0 <= column < matrix_size and 0 <= row < matrix_size):
        raise ValueError("Tile coordinates are outside the local tile matrix.")

    left, bottom, right, top = bounds
    span_x = (right - left) / matrix_size
    span_y = (top - bottom) / matrix_size
    return TileBounds(
        left=left + column * span_x,
        bottom=top - (row + 1) * span_y,
        right=left + (column + 1) * span_x,
        top=top - row * span_y,
    )


def _rgba_png(
    values: np.ma.MaskedArray,
    *,
    layer_id: str,
    global_values: np.ma.MaskedArray | None = None,
) -> bytes:
    """Render a display-only RGBA PNG from a raster sample."""

    value_mask = np.ma.getmaskarray(values)
    numeric = np.asarray(np.ma.getdata(values), dtype=np.float64).copy()
    numeric[value_mask] = np.nan
    valid = (~value_mask) & np.isfinite(numeric)

    if layer_id == "orthoimage":
        gray = np.clip(np.nan_to_num(numeric, nan=0.0), 0, 255).astype(np.uint8)
    else:
        reference = global_values if global_values is not None else values
        reference_mask = np.ma.getmaskarray(reference)
        reference_values = np.asarray(np.ma.getdata(reference), dtype=np.float64).copy()
        reference_values[reference_mask] = np.nan
        reference_valid = np.isfinite(reference_values)
        if not reference_valid.any():
            gray = np.zeros(numeric.shape, dtype=np.uint8)
        else:
            low, high = np.nanpercentile(reference_values[reference_valid], [2, 98])
            span = max(float(high - low), 1e-12)
            gray = np.clip((numeric - low) / span * 255, 0, 255)
            gray = np.nan_to_num(gray, nan=0.0).astype(np.uint8)

    rgba = np.zeros((4, numeric.shape[0], numeric.shape[1]), dtype=np.uint8)
    rgba[0] = gray
    rgba[1] = gray
    rgba[2] = gray
    rgba[3] = np.where(valid, 255, 0).astype(np.uint8)

    with MemoryFile() as memory:
        with memory.open(
            driver="PNG",
            height=rgba.shape[1],
            width=rgba.shape[2],
            count=4,
            dtype="uint8",
        ) as destination:
            destination.write(rgba)
        return memory.read()


class RasterAssetService:
    """Read validated raster assets without exposing arbitrary filesystem paths."""

    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)

    def _elevation_path(self, region_id: str) -> Path:
        validate_region_id(region_id)
        return self.data_dir / "processed" / f"{region_id}_elevation.tif"

    def _region_metadata(self, region_id: str) -> dict[str, Any]:
        path = self._elevation_path(region_id).with_suffix(".json")
        if not path.is_file():
            raise KeyError(region_id)
        metadata = json.loads(path.read_text(encoding="utf-8"))
        if metadata.get("region_id") != region_id:
            raise ValueError("Region metadata identifier mismatch")
        return metadata

    def layer_path(self, region_id: str, layer_id: str) -> Path:
        """Return a validated path for one of the region's declared layers."""

        if layer_id not in _SUPPORTED_LAYER_IDS:
            raise LayerNotFound(layer_id)

        metadata = self._region_metadata(region_id)
        if layer_id == "elevation":
            path = self._elevation_path(region_id)
            expected_hash = metadata.get("processed_sha256")
            if not path.is_file():
                raise FileNotFoundError(path)
            if expected_hash and sha256(path) != expected_hash:
                raise ValueError("Processed raster checksum mismatch")
            return path

        path = self._elevation_path(region_id).with_name(f"{region_id}_orthoimage.tif")
        sidecar = path.with_suffix(".json")
        if not path.is_file() or not sidecar.is_file():
            raise LayerNotFound(layer_id)

        ortho = json.loads(sidecar.read_text(encoding="utf-8"))
        if (
            ortho.get("region_id") != region_id
            or ortho.get("dtm_sha256") != metadata.get("processed_sha256")
            or sha256(path) != ortho.get("processed_sha256")
        ):
            raise ValueError("Ortho provenance mismatch")

        with rasterio.open(path) as source:
            if (
                list(source.shape) != metadata.get("shape")
                or list(source.transform)[:6] != metadata.get("transform")
                or source.crs is None
                or source.crs.to_wkt() != metadata.get("crs_wkt")
            ):
                raise ValueError("Ortho grid mismatch")
        return path

    def layer_metadata(self, region_id: str, layer_id: str) -> dict[str, Any]:
        path = self.layer_path(region_id, layer_id)
        sidecar = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
        with rasterio.open(path) as source:
            nodata = source.nodata
            nodata_value = float(nodata) if nodata is not None and isfinite(float(nodata)) else None
            bounds = [float(value) for value in source.bounds]
            transform = [float(value) for value in list(source.transform)[:6]]
            crs_wkt = source.crs.to_wkt() if source.crs else sidecar.get("crs_wkt")
            descriptor = {
                "layer_id": layer_id,
                "shape": [int(source.height), int(source.width)],
                "width": int(source.width),
                "height": int(source.height),
                "count": int(source.count),
                "dtype": source.dtypes[0],
                "nodata": nodata_value,
                "transform": transform,
                "crs_wkt": crs_wkt,
                "map_bounds": bounds,
                "coordinate_system": "native_projected_mars",
                "pixel_size_x_m": float(abs(source.transform.a)),
                "pixel_size_y_m": float(abs(source.transform.e)),
                "units": sidecar.get("units", "m" if layer_id == "elevation" else "DN"),
            }
        return {**sidecar, **descriptor}

    def read_tile_png(
        self,
        region_id: str,
        layer_id: str,
        zoom: int,
        column: int,
        row: int,
    ) -> bytes:
        metadata = self.layer_metadata(region_id, layer_id)
        bounds = tuple(float(value) for value in metadata["map_bounds"])
        tile = tile_bounds(bounds, zoom, column, row)
        path = self.layer_path(region_id, layer_id)

        with rasterio.open(path) as source:
            window = from_bounds(*tile.as_tuple(), transform=source.transform)
            values = source.read(
                1,
                window=window,
                out_shape=(TILE_SIZE, TILE_SIZE),
                boundless=True,
                masked=True,
                resampling=Resampling.nearest,
            )
            global_values = source.read(1, masked=True) if layer_id == "elevation" else None

        return _rgba_png(values, layer_id=layer_id, global_values=global_values)
    def read_preview_png(self, region_id: str, layer_id: str) -> bytes:
        self.layer_metadata(region_id, layer_id)
        path = self.layer_path(region_id, layer_id)
        with rasterio.open(path) as source:
            values = source.read(1, masked=True)
            global_values = values if layer_id == "elevation" else None
        return _rgba_png(values, layer_id=layer_id, global_values=global_values)
