"""Route planning facade connecting terrain data to A* and metrics."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

import numpy as np

from app.routing.astar import AStarPath, astar_search
from app.routing.cost_function import validate_expansion_limit
from app.routing.route_comparator import compare_routes
from app.routing.schemas import (
    DEFAULT_MAX_EXPANDED_CELLS,
    GridPoint,
    RouteComparison,
    RouteMetrics,
    RouteMode,
    RouteResult,
)
from app.terrain.elevation import calculate_elevation_profile


class RegionLike(Protocol):
    """The subset of the prepared region used for physical metrics."""

    elevation_m: np.ndarray
    valid_mask: np.ndarray
    pixel_size_x_m: float
    pixel_size_y_m: float


class TerrainLike(Protocol):
    """The P2 terrain contract consumed by the planner."""

    traversable: np.ndarray
    cost_multiplier: np.ndarray


def calculate_route_metrics(
    region: RegionLike,
    grid_path: Sequence[GridPoint],
    *,
    cost: float,
) -> RouteMetrics:
    """Build route metrics from the real elevation grid and P2 profile."""

    if not np.isfinite(cost) or cost < 0.0:
        raise ValueError("Route cost must be finite and non-negative.")
    profile = calculate_elevation_profile(region, grid_path)
    return RouteMetrics(
        distance_m=profile.distance_m,
        ascent_m=profile.ascent_m,
        descent_m=profile.descent_m,
        max_slope_deg=profile.max_slope_deg,
        cost=float(cost),
        cell_count=len(profile.grid_path),
    )


def _plan(
    region: RegionLike,
    terrain: TerrainLike,
    start: GridPoint,
    goal: GridPoint,
    mode: RouteMode,
    max_expanded_cells: int | None,
) -> RouteResult:
    multiplier = None if mode == "shortest" else np.asarray(terrain.cost_multiplier)
    search: AStarPath = astar_search(
        terrain.traversable,
        start,
        goal,
        region.pixel_size_x_m,
        region.pixel_size_y_m,
        multiplier,
        mode=mode,
        max_expanded_cells=max_expanded_cells,
    )
    return RouteResult(
        route_id=mode,
        mode=mode,
        grid_path=search.path,
        metrics=calculate_route_metrics(region, search.path, cost=search.cost),
        expanded_cells=search.expanded_cells,
    )


def find_shortest_path(
    region: RegionLike,
    terrain: TerrainLike,
    start: GridPoint,
    goal: GridPoint,
    *,
    max_expanded_cells: int | None = DEFAULT_MAX_EXPANDED_CELLS,
) -> RouteResult:
    """Minimum-distance route using the shared traversability mask."""

    return _plan(region, terrain, start, goal, "shortest", max_expanded_cells)


def find_terrain_aware_path(
    region: RegionLike,
    terrain: TerrainLike,
    start: GridPoint,
    goal: GridPoint,
    *,
    max_expanded_cells: int | None = DEFAULT_MAX_EXPANDED_CELLS,
) -> RouteResult:
    """Route that penalizes steep cells through P2 cost multipliers."""

    return _plan(region, terrain, start, goal, "terrain_aware", max_expanded_cells)


class RoutePlanner:
    """Reusable facade for calculating and comparing both route modes."""

    _MAX_DYNAMIC_EXPANDED_CELLS = 8_000_000

    def __init__(self, max_expanded_cells: int | None = DEFAULT_MAX_EXPANDED_CELLS) -> None:
        self.max_expanded_cells = validate_expansion_limit(max_expanded_cells)

    def _effective_limit(self, region: RegionLike) -> int | None:
        """Give a selected raster enough budget to exhaust its valid cells."""

        if self.max_expanded_cells is None:
            return None

        cell_count = int(np.asarray(region.elevation_m).size)
        # A* closes each grid cell at most once. One extra expansion avoids an
        # artificial SEARCH_LIMIT when the frontier exhausts a full window.
        raster_limit = min(cell_count + 1, self._MAX_DYNAMIC_EXPANDED_CELLS)
        return max(self.max_expanded_cells, raster_limit)

    def plan(
        self,
        region: RegionLike,
        terrain: TerrainLike,
        start: GridPoint,
        goal: GridPoint,
        mode: RouteMode = "shortest",
    ) -> RouteResult:
        max_expanded_cells = self._effective_limit(region)
        if mode == "shortest":
            return find_shortest_path(
                region, terrain, start, goal, max_expanded_cells=max_expanded_cells
            )
        if mode == "terrain_aware":
            return find_terrain_aware_path(
                region, terrain, start, goal, max_expanded_cells=max_expanded_cells
            )
        raise ValueError("mode must be 'shortest' or 'terrain_aware'.")

    def compare(
        self,
        region: RegionLike,
        terrain: TerrainLike,
        start: GridPoint,
        goal: GridPoint,
    ) -> RouteComparison:
        max_expanded_cells = self._effective_limit(region)
        shortest = find_shortest_path(
            region, terrain, start, goal, max_expanded_cells=max_expanded_cells
        )
        terrain_aware = find_terrain_aware_path(
            region, terrain, start, goal, max_expanded_cells=max_expanded_cells
        )
        return compare_routes(shortest, terrain_aware)


__all__ = [
    "RegionLike",
    "RoutePlanner",
    "TerrainLike",
    "calculate_route_metrics",
    "find_shortest_path",
    "find_terrain_aware_path",
]
