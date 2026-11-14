"""Public terrain-analysis facade used by routing and mission planning."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

import numpy as np

from app.terrain.elevation import calculate_elevation_profile
from app.terrain.schemas import (
    ElevationProfile,
    GridPoint,
    RegionDataLike,
    TerrainConfig,
    TerrainData,
    TerrainStatistics,
    validate_region_arrays,
)
from app.terrain.slope import calculate_slope
from app.terrain.traversability import generate_terrain_cost_grid


def analyze_region(
    region: RegionDataLike,
    config: TerrainConfig | Mapping[str, object] | None = None,
) -> TerrainData:
    """Return the agreed P2-to-P3 terrain contract for a prepared region."""

    return generate_terrain_cost_grid(region, config)


def get_terrain_statistics(
    region: RegionDataLike,
    config: TerrainConfig | Mapping[str, object] | None = None,
) -> TerrainStatistics:
    """Return compact elevation/slope statistics for a region."""

    elevation_m, valid_mask, pixel_x_m, pixel_y_m = validate_region_arrays(region)
    terrain = generate_terrain_cost_grid(region, config)
    valid_elevations = elevation_m[valid_mask]
    valid_slopes = terrain.slope_deg[np.isfinite(terrain.slope_deg)]
    valid_count = int(np.count_nonzero(valid_mask))
    cell_count = int(elevation_m.size)
    traversable_count = int(np.count_nonzero(terrain.traversable))

    def stats(values: np.ndarray, method: str) -> float | None:
        if values.size == 0:
            return None
        return float(getattr(np, method)(values))

    return TerrainStatistics(
        region_id=str(getattr(region, "region_id", "unknown")),
        height=int(elevation_m.shape[0]),
        width=int(elevation_m.shape[1]),
        valid_cell_count=valid_count,
        valid_fraction=(valid_count / cell_count) if cell_count else 0.0,
        slope_cell_count=int(valid_slopes.size),
        traversable_cell_count=traversable_count,
        traversable_fraction=(traversable_count / valid_count) if valid_count else 0.0,
        elevation_min_m=stats(valid_elevations, "min"),
        elevation_max_m=stats(valid_elevations, "max"),
        elevation_mean_m=stats(valid_elevations, "mean"),
        elevation_median_m=stats(valid_elevations, "median"),
        slope_min_deg=stats(valid_slopes, "min"),
        slope_max_deg=stats(valid_slopes, "max"),
        slope_mean_deg=stats(valid_slopes, "mean"),
        slope_median_deg=stats(valid_slopes, "median"),
        pixel_size_x_m=pixel_x_m,
        pixel_size_y_m=pixel_y_m,
        config=terrain.config,
    )


class TerrainAnalyzer:
    """Reusable facade around slope, masks, route profiles, and summaries."""

    def __init__(self, config: TerrainConfig | Mapping[str, object] | None = None) -> None:
        self.config = TerrainConfig.from_value(config)

    def calculate_slope(self, region: RegionDataLike) -> np.ndarray:
        return calculate_slope(region)

    def analyze(self, region: RegionDataLike) -> TerrainData:
        return analyze_region(region, self.config)

    def elevation_profile(
        self,
        region: RegionDataLike,
        grid_path: Sequence[GridPoint | Mapping[str, object]],
    ) -> ElevationProfile:
        return calculate_elevation_profile(region, grid_path)

    def summary(self, region: RegionDataLike) -> TerrainStatistics:
        return get_terrain_statistics(region, self.config)


__all__ = [
    "TerrainAnalyzer",
    "analyze_region",
    "calculate_elevation_profile",
    "calculate_slope",
    "generate_terrain_cost_grid",
    "get_terrain_statistics",
]
