"""Configurable terrain masks and slope cost multipliers."""

from __future__ import annotations

from collections.abc import Mapping

import numpy as np

from app.terrain.schemas import (
    RegionDataLike,
    TerrainConfig,
    TerrainData,
    validate_region_arrays,
)
from app.terrain.slope import calculate_slope


def generate_terrain_cost_grid(
    region: RegionDataLike,
    config: TerrainConfig | Mapping[str, object] | None = None,
) -> TerrainData:
    """Build slope, traversability, and relative cost arrays.

    Cells are traversable when they have a valid, computable slope no greater
    than ``max_slope_deg``. On traversable cells the dimensionless multiplier
    is ``1 + slope_weight * (slope_deg / max_slope_deg) ** 2``. Blocked cells
    have a NaN multiplier and must not be passed to a route planner as valid.
    """

    settings = TerrainConfig.from_value(config)
    elevation_m, valid_mask, _pixel_x_m, _pixel_y_m = validate_region_arrays(region)
    slope_deg = calculate_slope(region)
    traversable = (
        valid_mask
        & np.isfinite(elevation_m)
        & np.isfinite(slope_deg)
        & (slope_deg <= settings.max_slope_deg)
    )

    cost_multiplier = np.full(elevation_m.shape, np.nan, dtype=np.float64)
    normalized_slope = slope_deg[traversable] / settings.max_slope_deg
    cost_multiplier[traversable] = 1.0 + settings.slope_weight * np.square(normalized_slope)

    return TerrainData(
        slope_deg=slope_deg,
        traversable=traversable,
        cost_multiplier=cost_multiplier,
        config=settings.as_dict(),
    )


__all__ = ["generate_terrain_cost_grid"]
