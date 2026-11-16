"""Validation and slicing for user-selected raster calculation windows."""

from __future__ import annotations

from dataclasses import dataclass
import os

from affine import Affine

from app.nasa_data.schemas import RegionData

from .schemas import AnalysisWindowModel


GridPoint = tuple[int, int]


@dataclass(frozen=True)
class AnalysisWindow:
    row: int
    col: int
    height: int
    width: int

    @property
    def row_end(self) -> int:
        return self.row + self.height

    @property
    def col_end(self) -> int:
        return self.col + self.width

    def as_dict(self) -> dict[str, int]:
        return {
            "row": self.row,
            "col": self.col,
            "height": self.height,
            "width": self.width,
        }


def resolve_analysis_window(
    region: RegionData,
    requested: AnalysisWindowModel | None,
) -> AnalysisWindow:
    """Resolve a request window and reject any crop outside the parent DTM."""

    height, width = region.elevation_m.shape
    if requested is None:
        window = AnalysisWindow(row=0, col=0, height=height, width=width)
    else:
        window = AnalysisWindow(
            row=requested.row,
            col=requested.col,
            height=requested.height,
            width=requested.width,
        )
    if window.row_end > height or window.col_end > width:
        raise ValueError(
            "Analysis window must be fully contained in the selected region "
            f"({height} rows x {width} columns)."
        )
    limit = os.environ.get("ARES_MAX_ANALYSIS_WINDOW_CELLS")
    if limit is not None and window.height * window.width > int(limit):
        raise ValueError(
            f"Analysis window exceeds this deployment's limit of {limit} cells. "
            "Select a smaller area."
        )
    return window


def crop_region(region: RegionData, window: AnalysisWindow) -> RegionData:
    """Return a view-backed copy of a validated parent region window."""

    elevation = region.elevation_m[window.row:window.row_end, window.col:window.col_end].copy()
    valid_mask = region.valid_mask[window.row:window.row_end, window.col:window.col_end].copy()
    transform = region.transform @ Affine.translation(window.col, window.row)
    metadata = dict(region.metadata)
    metadata.update(
        {
            "shape": [window.height, window.width],
            "transform": list(transform)[:6],
            "valid_cells": int(valid_mask.sum()),
            "analysis_window": window.as_dict(),
        }
    )
    return RegionData(
        region_id=region.region_id,
        elevation_m=elevation,
        valid_mask=valid_mask,
        transform=transform,
        crs_wkt=region.crs_wkt,
        pixel_size_x_m=region.pixel_size_x_m,
        pixel_size_y_m=region.pixel_size_y_m,
        source_ids=region.source_ids,
        metadata=metadata,
    )


def point_in_window(point: GridPoint, window: AnalysisWindow) -> bool:
    row, col = point
    return window.row <= row < window.row_end and window.col <= col < window.col_end


def localize_point(point: GridPoint, window: AnalysisWindow) -> GridPoint:
    return point[0] - window.row, point[1] - window.col


def globalize_point(point: GridPoint, window: AnalysisWindow) -> GridPoint:
    return point[0] + window.row, point[1] + window.col


def localize_path(path: tuple[GridPoint, ...] | list[GridPoint], window: AnalysisWindow) -> list[GridPoint]:
    return [localize_point(point, window) for point in path]


def globalize_path(path: tuple[GridPoint, ...] | list[GridPoint], window: AnalysisWindow) -> list[GridPoint]:
    return [globalize_point(point, window) for point in path]


__all__ = [
    "AnalysisWindow",
    "crop_region",
    "globalize_path",
    "localize_path",
    "localize_point",
    "point_in_window",
    "resolve_analysis_window",
]

