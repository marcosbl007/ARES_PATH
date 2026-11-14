"""Internal raster contract: rows/columns, metres, and the source Mars CRS."""
from dataclasses import dataclass, field
from math import floor
from typing import Any

import numpy as np
from affine import Affine


@dataclass(frozen=True)
class RegionData:
    region_id: str
    elevation_m: np.ndarray
    valid_mask: np.ndarray
    transform: Affine
    crs_wkt: str
    pixel_size_x_m: float
    pixel_size_y_m: float
    source_ids: tuple[str, ...]
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if (self.elevation_m.ndim != 2 or 0 in self.elevation_m.shape
                or self.valid_mask.shape != self.elevation_m.shape
                or self.valid_mask.dtype != np.bool_):
            raise ValueError("Expected matching nonempty 2D elevation and boolean mask")
        if not np.array_equal(np.isfinite(self.elevation_m), self.valid_mask):
            raise ValueError("Invalid cells must be NaN; valid cells must be finite")
        if not self.valid_mask.any():
            raise ValueError("Region has no valid elevation cells")
        if not all(np.isfinite(v) and v > 0 for v in
                   (self.pixel_size_x_m, self.pixel_size_y_m)):
            raise ValueError("Pixel sizes must be positive metres")

    def cell_center(self, row: int, col: int) -> tuple[float, float]:
        self._check(row, col)
        return self.transform * (col + 0.5, row + 0.5)

    def map_to_cell(self, x: float, y: float) -> tuple[int, int]:
        col, row = ~self.transform * (x, y)
        result = floor(row), floor(col)
        self._check(*result)
        return result

    def _check(self, row: int, col: int) -> None:
        if not (0 <= row < self.elevation_m.shape[0] and
                0 <= col < self.elevation_m.shape[1]):
            raise ValueError("Cell outside region")
