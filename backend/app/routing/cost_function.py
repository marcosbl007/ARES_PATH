"""Step costs, multipliers, and shared input validation for A*."""

from __future__ import annotations

from math import isfinite, hypot
from numbers import Integral, Real

import numpy as np

from app.routing.schemas import GridPoint


def validate_traversable(traversable: object) -> np.ndarray:
    """Return a validated 2D boolean traversability mask."""

    grid = np.asarray(traversable)
    if grid.ndim != 2 or grid.size == 0:
        raise ValueError("traversable must be a non-empty 2D boolean array.")
    if grid.dtype != np.bool_:
        raise ValueError("traversable must be a boolean array.")
    return grid


def validate_grid_point(
    point: object,
    shape: tuple[int, int],
    name: str = "point",
) -> GridPoint:
    """Validate a zero-based ``(row, col)`` cell inside ``shape``."""

    if not isinstance(point, (tuple, list)) or len(point) != 2:
        raise ValueError(f"{name} must be a (row, col) pair.")
    row_raw, col_raw = point
    for value in (row_raw, col_raw):
        if isinstance(value, (bool, np.bool_)) or not isinstance(value, (int, np.integer)):
            raise ValueError(f"{name} row and col must be integers.")
    row, col = int(row_raw), int(col_raw)
    height, width = shape
    if not (0 <= row < height and 0 <= col < width):
        raise ValueError(f"{name} ({row}, {col}) is outside the {height}x{width} grid.")
    return row, col


def validate_pixel_sizes(pixel_size_x_m: object, pixel_size_y_m: object) -> tuple[float, float]:
    """Validate positive metric cell sizes used for physical distances."""

    for value, name in ((pixel_size_x_m, "pixel_size_x_m"), (pixel_size_y_m, "pixel_size_y_m")):
        if isinstance(value, (bool, np.bool_)) or not isinstance(
            value, (Real, np.integer, np.floating)
        ):
            raise ValueError(f"{name} must be a real number in metres.")
        if not isfinite(float(value)) or float(value) <= 0.0:
            raise ValueError(f"{name} must be finite and positive, in metres.")
    return float(pixel_size_x_m), float(pixel_size_y_m)


def resolve_cost_multiplier(
    cost_multiplier: object | None,
    traversable: np.ndarray,
) -> np.ndarray:
    """Return a finite multiplier grid with values >= 1 on traversable cells.

    Blocked cells may contain NaN because terrain analysis keeps them out of
    routing. Missing multipliers mean unit cost.
    """

    if cost_multiplier is None:
        return np.ones(traversable.shape, dtype=np.float64)

    values = np.asarray(cost_multiplier, dtype=np.float64)
    if values.shape != traversable.shape:
        raise ValueError("cost_multiplier must have the same shape as traversable.")
    usable = values[traversable]
    if not np.all(np.isfinite(usable)):
        raise ValueError("Traversable cells require finite cost multipliers.")
    if np.any(usable < 1.0):
        raise ValueError("Cost multipliers must be greater than or equal to 1.")
    return values


def validate_expansion_limit(limit: object | None) -> int | None:
    """Validate an optional A* expansion limit."""

    if limit is None:
        return None
    if isinstance(limit, (bool, np.bool_)) or not isinstance(limit, Integral):
        raise ValueError("max_expanded_cells must be an integer or None.")
    value = int(limit)
    if value <= 0:
        raise ValueError("max_expanded_cells must be greater than zero.")
    return value


def step_length_m(
    delta_row: int,
    delta_col: int,
    pixel_size_x_m: float,
    pixel_size_y_m: float,
) -> float:
    """Physical horizontal length of an 8-connected step."""

    return hypot(delta_col * pixel_size_x_m, delta_row * pixel_size_y_m)


def average_multiplier(current: float, neighbor: float) -> float:
    """Symmetric multiplier applied to the segment between two cells."""

    return 0.5 * (current + neighbor)


def step_cost(
    current: GridPoint,
    neighbor: GridPoint,
    multiplier: np.ndarray,
    pixel_size_x_m: float,
    pixel_size_y_m: float,
) -> float:
    """Cost of moving between two neighboring cells."""

    length = step_length_m(
        neighbor[0] - current[0],
        neighbor[1] - current[1],
        pixel_size_x_m,
        pixel_size_y_m,
    )
    return length * average_multiplier(
        float(multiplier[current]),
        float(multiplier[neighbor]),
    )


def euclidean_heuristic(
    point: GridPoint,
    goal: GridPoint,
    pixel_size_x_m: float,
    pixel_size_y_m: float,
) -> float:
    """Admissible distance-to-goal in metres for multipliers >= 1."""

    return hypot(
        (goal[1] - point[1]) * pixel_size_x_m,
        (goal[0] - point[0]) * pixel_size_y_m,
    )


__all__ = [
    "average_multiplier",
    "euclidean_heuristic",
    "resolve_cost_multiplier",
    "step_cost",
    "step_length_m",
    "validate_expansion_limit",
    "validate_grid_point",
    "validate_pixel_sizes",
    "validate_traversable",
]
