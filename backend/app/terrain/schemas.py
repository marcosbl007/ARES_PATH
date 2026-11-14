"""Shared, typed contracts for terrain analysis.

The NASA data module owns the concrete ``RegionData`` class.  Terrain uses a
small structural protocol so it can be developed and exercised independently
of the data loader while still accepting that class without an adapter.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from math import isfinite
from numbers import Real
from typing import Protocol, TypeAlias

import numpy as np


GridPoint: TypeAlias = tuple[int, int]


class RegionDataLike(Protocol):
    """The subset of a NASA ``RegionData`` object used by this module."""

    region_id: str
    elevation_m: np.ndarray
    valid_mask: np.ndarray
    pixel_size_x_m: float
    pixel_size_y_m: float


@dataclass(frozen=True)
class TerrainConfig:
    """Exploratory terrain parameters; not astronaut mobility limits."""

    max_slope_deg: float = 20.0
    slope_weight: float = 2.0

    def __post_init__(self) -> None:
        if (
            isinstance(self.max_slope_deg, (bool, np.bool_))
            or not isinstance(self.max_slope_deg, (Real, np.integer, np.floating))
        ):
            raise ValueError("max_slope_deg must be a real number.")
        if (
            isinstance(self.slope_weight, (bool, np.bool_))
            or not isinstance(self.slope_weight, (Real, np.integer, np.floating))
        ):
            raise ValueError("slope_weight must be a real number.")
        if not isfinite(self.max_slope_deg) or not 0.0 < self.max_slope_deg <= 90.0:
            raise ValueError("max_slope_deg must be finite and in the interval (0, 90].")
        if not isfinite(self.slope_weight) or self.slope_weight < 0.0:
            raise ValueError("slope_weight must be finite and greater than or equal to 0.")

    @classmethod
    def from_value(
        cls,
        value: TerrainConfig | Mapping[str, object] | None,
    ) -> TerrainConfig:
        if value is None:
            return cls()
        if isinstance(value, cls):
            return value
        if not isinstance(value, Mapping):
            raise ValueError("Terrain config must be a TerrainConfig or mapping.")

        allowed = {"max_slope_deg", "slope_weight"}
        unknown = set(value) - allowed
        if unknown:
            names = ", ".join(sorted(str(key) for key in unknown))
            raise ValueError(f"Unknown terrain config field(s): {names}.")
        for key in allowed & value.keys():
            item = value[key]
            if (
                isinstance(item, (bool, np.bool_))
                or not isinstance(item, (Real, np.integer, np.floating))
            ):
                raise ValueError(f"Terrain config field {key} must be a real number.")
        try:
            return cls(
                max_slope_deg=float(value.get("max_slope_deg", 20.0)),
                slope_weight=float(value.get("slope_weight", 2.0)),
            )
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid terrain config: {exc}") from exc

    def as_dict(self) -> dict[str, object]:
        return {
            "max_slope_deg": self.max_slope_deg,
            "slope_weight": self.slope_weight,
            "cost_formula": "1 + slope_weight * (slope_deg / max_slope_deg) ** 2",
            "slope_method": "finite differences; central internally, one-sided at raster edges",
            "nodata_policy": "slope unavailable when an in-bounds cardinal neighbor is invalid",
        }


@dataclass(frozen=True)
class TerrainData:
    """Per-cell slope and exploratory routing inputs for one raster region."""

    slope_deg: np.ndarray
    traversable: np.ndarray
    cost_multiplier: np.ndarray
    config: dict[str, object]

    def __post_init__(self) -> None:
        slope = np.asarray(self.slope_deg)
        traversable = np.asarray(self.traversable)
        cost = np.asarray(self.cost_multiplier)
        if slope.ndim != 2 or traversable.shape != slope.shape or cost.shape != slope.shape:
            raise ValueError("TerrainData arrays must be 2D and share the same shape.")
        if traversable.dtype != np.bool_:
            raise ValueError("TerrainData traversable must be a boolean array.")
        if np.any(np.isfinite(slope) & (slope < 0.0)):
            raise ValueError("TerrainData slope_deg cannot contain negative slopes.")
        if np.any(traversable & (~np.isfinite(slope) | ~np.isfinite(cost) | (cost < 1.0))):
            raise ValueError("Traversable cells require finite slopes and cost multipliers >= 1.")


@dataclass(frozen=True)
class ElevationProfile:
    """Samples and cumulative topographic metrics along a grid path."""

    grid_path: tuple[GridPoint, ...]
    cumulative_distance_m: tuple[float, ...]
    elevation_m: tuple[float, ...]
    distance_m: float
    ascent_m: float
    descent_m: float
    max_slope_deg: float


@dataclass(frozen=True)
class TerrainStatistics:
    """Compact summary suitable for an API response; no raster is included."""

    region_id: str
    height: int
    width: int
    valid_cell_count: int
    valid_fraction: float
    slope_cell_count: int
    traversable_cell_count: int
    traversable_fraction: float
    elevation_min_m: float | None
    elevation_max_m: float | None
    elevation_mean_m: float | None
    elevation_median_m: float | None
    slope_min_deg: float | None
    slope_max_deg: float | None
    slope_mean_deg: float | None
    slope_median_deg: float | None
    pixel_size_x_m: float
    pixel_size_y_m: float
    config: dict[str, object]


def validate_region_arrays(
    region: RegionDataLike,
) -> tuple[np.ndarray, np.ndarray, float, float]:
    """Validate the shared region contract and return normalized arrays.

    The caller is responsible for establishing that the source raster's
    horizontal pixel sizes truly are metres.  This function validates their
    numeric form, but cannot infer units from an image or an unknown CRS.
    """

    try:
        elevation = np.asarray(region.elevation_m, dtype=np.float64)
        raw_mask = np.asarray(region.valid_mask)
        pixel_x_raw = region.pixel_size_x_m
        pixel_y_raw = region.pixel_size_y_m
    except (AttributeError, TypeError, ValueError) as exc:
        raise ValueError("Region must provide elevation_m, valid_mask, and metric pixel sizes.") from exc

    if (
        isinstance(pixel_x_raw, (bool, np.bool_))
        or isinstance(pixel_y_raw, (bool, np.bool_))
        or not isinstance(pixel_x_raw, (Real, np.integer, np.floating))
        or not isinstance(pixel_y_raw, (Real, np.integer, np.floating))
    ):
        raise ValueError("Region pixel sizes must be numeric metre values.")
    pixel_x = float(pixel_x_raw)
    pixel_y = float(pixel_y_raw)

    if elevation.ndim != 2 or elevation.size == 0:
        raise ValueError("Region elevation_m must be a non-empty 2D array.")
    if raw_mask.dtype != np.bool_:
        raise ValueError("Region valid_mask must be a boolean array.")
    if raw_mask.shape != elevation.shape:
        raise ValueError("Region valid_mask and elevation_m must have the same shape.")
    if np.any(raw_mask & ~np.isfinite(elevation)):
        raise ValueError("Every valid elevation cell must contain a finite value in metres.")
    if not isfinite(pixel_x) or pixel_x <= 0.0 or not isfinite(pixel_y) or pixel_y <= 0.0:
        raise ValueError("Region pixel sizes must be finite, positive values expressed in metres.")

    valid = raw_mask & np.isfinite(elevation)
    return elevation, valid, pixel_x, pixel_y


__all__ = [
    "ElevationProfile",
    "GridPoint",
    "RegionDataLike",
    "TerrainConfig",
    "TerrainData",
    "TerrainStatistics",
    "validate_region_arrays",
]
