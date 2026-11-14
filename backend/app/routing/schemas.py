"""Typed contracts for grid routing and route comparison."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypeAlias

import numpy as np


GridPoint: TypeAlias = tuple[int, int]
RouteMode: TypeAlias = Literal["shortest", "terrain_aware"]

COORDINATE_SYSTEM = "grid_row_col"
DEFAULT_MAX_EXPANDED_CELLS = 1_000_000


class RoutingError(RuntimeError):
    """Base class for typed routing failures."""

    code = "ROUTING_ERROR"


class NoPathError(RoutingError):
    """No 8-connected traversable path satisfies the selected mode."""

    code = "NO_PATH"

    def __init__(
        self,
        start: GridPoint,
        goal: GridPoint,
        mode: str = "shortest",
        reason: str = "No traversable path exists.",
    ) -> None:
        self.start = start
        self.goal = goal
        self.mode = mode
        self.reason = reason
        super().__init__(f"{reason} start={start} goal={goal} mode={mode}")


class SearchLimitExceeded(RoutingError):
    """The A* expansion limit was reached before finding a path."""

    code = "SEARCH_LIMIT"

    def __init__(self, limit: int) -> None:
        self.limit = limit
        super().__init__(
            f"A* expanded more than {limit} cells; narrow the region or raise the limit."
        )


@dataclass(frozen=True)
class RouteMetrics:
    """Metrics computed from the elevation grid and the selected route.

    ``cost`` is the internal objective value. It is dimensionless in
    ``terrain_aware`` mode; in ``shortest`` mode unit multipliers make it
    numerically equal to horizontal distance in metres.
    """

    distance_m: float
    ascent_m: float
    descent_m: float
    max_slope_deg: float
    cost: float
    cell_count: int

    def __post_init__(self) -> None:
        values = (
            self.distance_m,
            self.ascent_m,
            self.descent_m,
            self.max_slope_deg,
            self.cost,
        )
        if any(not np.isfinite(value) or value < 0.0 for value in values):
            raise ValueError("Route metrics must be finite and non-negative.")
        if self.cell_count < 1:
            raise ValueError("Route metrics require at least one cell.")


@dataclass(frozen=True)
class RouteResult:
    """One calculated alternative with its grid path and metrics."""

    route_id: str
    mode: RouteMode
    grid_path: tuple[GridPoint, ...]
    metrics: RouteMetrics
    expanded_cells: int
    coordinate_system: str = COORDINATE_SYSTEM

    def __post_init__(self) -> None:
        if self.mode not in ("shortest", "terrain_aware"):
            raise ValueError("mode must be 'shortest' or 'terrain_aware'.")
        if not self.grid_path:
            raise ValueError("A route must contain at least one cell.")
        if self.expanded_cells < 0:
            raise ValueError("expanded_cells cannot be negative.")


@dataclass(frozen=True)
class RouteComparison:
    """Comparable deltas between the two route modes.

    Deltas are ``terrain_aware - shortest``. Positive distance means the
    terrain-aware route is longer. Cost is only comparable when both modes
    optimize the same objective, which is false by default.
    """

    shortest: RouteResult
    terrain_aware: RouteResult
    distance_delta_m: float
    ascent_delta_m: float
    descent_delta_m: float
    max_slope_delta_deg: float
    cell_count_delta: int
    same_path: bool
    cost_comparable: bool
    notes: tuple[str, ...] = ()


__all__ = [
    "COORDINATE_SYSTEM",
    "DEFAULT_MAX_EXPANDED_CELLS",
    "GridPoint",
    "NoPathError",
    "RouteComparison",
    "RouteMetrics",
    "RouteMode",
    "RouteResult",
    "RoutingError",
    "SearchLimitExceeded",
]
