"""Deterministic A* on an 8-connected grid with physical step lengths."""

from __future__ import annotations

import heapq
from dataclasses import dataclass

import numpy as np

from app.routing.cost_function import (
    euclidean_heuristic,
    resolve_cost_multiplier,
    step_cost,
    validate_expansion_limit,
    validate_grid_point,
    validate_pixel_sizes,
    validate_traversable,
)
from app.routing.schemas import (
    DEFAULT_MAX_EXPANDED_CELLS,
    GridPoint,
    NoPathError,
    SearchLimitExceeded,
)


@dataclass(frozen=True)
class AStarPath:
    """Result of a successful search."""

    path: tuple[GridPoint, ...]
    cost: float
    expanded_cells: int


def _neighbors(
    current: GridPoint,
    traversable: np.ndarray,
) -> list[GridPoint]:
    """Return valid 8-connected neighbors without corner cutting."""

    height, width = traversable.shape
    row, col = current
    result: list[GridPoint] = []
    for delta_row in (-1, 0, 1):
        for delta_col in (-1, 0, 1):
            if delta_row == 0 and delta_col == 0:
                continue
            next_row = row + delta_row
            next_col = col + delta_col
            if not (0 <= next_row < height and 0 <= next_col < width):
                continue
            if not traversable[next_row, next_col]:
                continue
            if delta_row != 0 and delta_col != 0:
                if not traversable[row, next_col] or not traversable[next_row, col]:
                    continue
            result.append((next_row, next_col))
    return result


def _reconstruct_path(
    came_from: dict[GridPoint, GridPoint],
    start: GridPoint,
    goal: GridPoint,
) -> tuple[GridPoint, ...]:
    path = [goal]
    current = goal
    while current != start:
        current = came_from[current]
        path.append(current)
    path.reverse()
    return tuple(path)


def astar_search(
    traversable: np.ndarray,
    start: GridPoint,
    goal: GridPoint,
    pixel_size_x_m: float,
    pixel_size_y_m: float,
    cost_multiplier: np.ndarray | None = None,
    *,
    mode: str = "shortest",
    max_expanded_cells: int | None = DEFAULT_MAX_EXPANDED_CELLS,
) -> AStarPath:
    """Find a minimum-cost path with A* and the agreed per-step formula.

    Diagonal moves require both orthogonal neighbors to be traversable. The
    heuristic is Euclidean in metres, which is admissible because every
    multiplier is at least 1.
    """

    grid = validate_traversable(traversable)
    start = validate_grid_point(start, grid.shape, "start")
    goal = validate_grid_point(goal, grid.shape, "goal")
    pixel_x, pixel_y = validate_pixel_sizes(pixel_size_x_m, pixel_size_y_m)
    multiplier = resolve_cost_multiplier(cost_multiplier, grid)
    limit = validate_expansion_limit(max_expanded_cells)

    if not grid[start]:
        raise NoPathError(start, goal, mode, "Start cell is not traversable.")
    if not grid[goal]:
        raise NoPathError(start, goal, mode, "Goal cell is not traversable.")
    if start == goal:
        return AStarPath(path=(start,), cost=0.0, expanded_cells=0)

    g_score: dict[GridPoint, float] = {start: 0.0}
    came_from: dict[GridPoint, GridPoint] = {}
    closed: set[GridPoint] = set()
    frontier: list[tuple[float, float, GridPoint]] = [
        (euclidean_heuristic(start, goal, pixel_x, pixel_y), 0.0, start)
    ]
    expanded = 0

    while frontier:
        _, current_cost, current = heapq.heappop(frontier)
        if current in closed:
            continue
        if current_cost > g_score.get(current, np.inf):
            continue

        closed.add(current)
        expanded += 1
        if limit is not None and expanded > limit:
            raise SearchLimitExceeded(limit)

        if current == goal:
            return AStarPath(
                path=_reconstruct_path(came_from, start, goal),
                cost=float(current_cost),
                expanded_cells=expanded,
            )

        for neighbor in _neighbors(current, grid):
            if neighbor in closed:
                continue
            tentative = current_cost + step_cost(
                current, neighbor, multiplier, pixel_x, pixel_y
            )
            if tentative < g_score.get(neighbor, np.inf):
                g_score[neighbor] = tentative
                came_from[neighbor] = current
                priority = tentative + euclidean_heuristic(
                    neighbor, goal, pixel_x, pixel_y
                )
                heapq.heappush(frontier, (priority, tentative, neighbor))

    raise NoPathError(start, goal, mode)


def plan_path(
    start: tuple[int, int],
    goal: tuple[int, int],
    traversable: np.ndarray,
    pixel_size_x_m: float,
    pixel_size_y_m: float,
    cost_multiplier: np.ndarray | None = None,
    *,
    mode: str = "shortest",
    max_expanded_cells: int | None = DEFAULT_MAX_EXPANDED_CELLS,
) -> list[tuple[int, int]]:
    """Contract-compatible wrapper returning a list of ``(row, col)`` cells."""

    result = astar_search(
        traversable,
        start,
        goal,
        pixel_size_x_m,
        pixel_size_y_m,
        cost_multiplier,
        mode=mode,
        max_expanded_cells=max_expanded_cells,
    )
    return list(result.path)


__all__ = ["AStarPath", "astar_search", "plan_path"]
