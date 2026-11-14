"""Deterministic routing checks on synthetic grids, never NASA observations."""

from __future__ import annotations

import heapq
import math
import time
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
import pytest

from app.routing import (
    NoPathError,
    RoutePlanner,
    SearchLimitExceeded,
    astar_search,
    calculate_route_metrics,
    compare_routes,
    find_shortest_path,
    find_terrain_aware_path,
    plan_path,
)
from app.terrain import analyze_region, calculate_elevation_profile


@dataclass(frozen=True)
class SyntheticRegion:
    region_id: str
    elevation_m: np.ndarray
    valid_mask: np.ndarray
    pixel_size_x_m: float
    pixel_size_y_m: float


@dataclass(frozen=True)
class SyntheticTerrain:
    traversable: np.ndarray
    cost_multiplier: np.ndarray


def region(
    elevation: list[list[float]] | np.ndarray,
    *,
    pixel_x: float = 1.0,
    pixel_y: float = 1.0,
    valid_mask: np.ndarray | None = None,
) -> SyntheticRegion:
    values = np.asarray(elevation, dtype=np.float64)
    mask = np.isfinite(values) if valid_mask is None else valid_mask
    return SyntheticRegion("synthetic", values, mask, pixel_x, pixel_y)


def flat_terrain(
    shape: tuple[int, int] = (3, 3),
    cost_multiplier: np.ndarray | None = None,
) -> SyntheticTerrain:
    traversable = np.ones(shape, dtype=bool)
    multipliers = (
        np.ones(shape, dtype=np.float64)
        if cost_multiplier is None
        else cost_multiplier
    )
    return SyntheticTerrain(traversable, multipliers)


def assert_valid_path(
    path: tuple[tuple[int, int], ...] | list[tuple[int, int]],
    traversable: np.ndarray,
    start: tuple[int, int],
    goal: tuple[int, int],
) -> None:
    assert tuple(path[0]) == start
    assert tuple(path[-1]) == goal
    assert len(set(path)) == len(path)
    for cell in path:
        assert traversable[cell]
    for previous, current in zip(path, path[1:]):
        delta_row = current[0] - previous[0]
        delta_col = current[1] - previous[1]
        assert max(abs(delta_row), abs(delta_col)) == 1
        if delta_row != 0 and delta_col != 0:
            assert traversable[previous[0], current[1]]
            assert traversable[current[0], previous[1]]


def path_cost(
    path: tuple[tuple[int, int], ...] | list[tuple[int, int]],
    multiplier: np.ndarray,
    pixel_x: float = 1.0,
    pixel_y: float = 1.0,
) -> float:
    total = 0.0
    for previous, current in zip(path, path[1:]):
        length = math.hypot(
            (current[1] - previous[1]) * pixel_x,
            (current[0] - previous[0]) * pixel_y,
        )
        total += length * 0.5 * (multiplier[previous] + multiplier[current])
    return total


def reference_dijkstra(
    traversable: np.ndarray,
    start: tuple[int, int],
    goal: tuple[int, int],
    pixel_x: float,
    pixel_y: float,
    multiplier: np.ndarray,
) -> float | None:
    """Independent reference implementation for small grids."""

    height, width = traversable.shape
    distances: dict[tuple[int, int], float] = {start: 0.0}
    frontier: list[tuple[float, tuple[int, int]]] = [(0.0, start)]

    while frontier:
        cost, current = heapq.heappop(frontier)
        if cost > distances.get(current, math.inf):
            continue
        if current == goal:
            return cost
        row, col = current
        for delta_row in (-1, 0, 1):
            for delta_col in (-1, 0, 1):
                if delta_row == 0 and delta_col == 0:
                    continue
                next_row, next_col = row + delta_row, col + delta_col
                if not (0 <= next_row < height and 0 <= next_col < width):
                    continue
                if not traversable[next_row, next_col]:
                    continue
                if delta_row != 0 and delta_col != 0:
                    if not traversable[row, next_col] or not traversable[next_row, col]:
                        continue
                length = math.hypot(delta_col * pixel_x, delta_row * pixel_y)
                step = length * 0.5 * (
                    multiplier[current] + multiplier[(next_row, next_col)]
                )
                next_cost = cost + step
                if next_cost < distances.get((next_row, next_col), math.inf):
                    distances[(next_row, next_col)] = next_cost
                    heapq.heappush(frontier, (next_cost, (next_row, next_col)))
    return None


def test_free_grid_diagonal_reaches_known_distance() -> None:
    traversable = np.ones((3, 3), dtype=bool)
    result = astar_search(traversable, (0, 0), (2, 2), 1.0, 1.0)

    assert result.path == ((0, 0), (1, 1), (2, 2))
    assert result.cost == pytest.approx(2.0 * math.sqrt(2.0))
    assert result.expanded_cells > 0
    assert plan_path((0, 0), (2, 2), traversable, 1.0, 1.0) == list(result.path)


def test_anisotropic_pixels_change_diagonal_length() -> None:
    traversable = np.ones((3, 3), dtype=bool)
    sample = region(np.zeros((3, 3)), pixel_x=2.0, pixel_y=1.0)
    route = find_shortest_path(sample, flat_terrain(), (0, 0), (2, 2))

    expected = 2.0 * math.sqrt(5.0)
    assert route.metrics.distance_m == pytest.approx(expected)
    assert route.metrics.cost == pytest.approx(expected)


def test_diagonal_is_blocked_by_an_orthogonal_obstacle() -> None:
    traversable = np.array([[True, False], [True, True]], dtype=bool)
    result = astar_search(traversable, (0, 0), (1, 1), 1.0, 1.0)

    assert result.path == ((0, 0), (1, 0), (1, 1))
    assert result.cost == pytest.approx(2.0)
    assert_valid_path(result.path, traversable, (0, 0), (1, 1))


def test_shortest_path_goes_around_the_blocked_center() -> None:
    traversable = np.ones((3, 3), dtype=bool)
    traversable[1, 1] = False
    sample = region(np.zeros((3, 3)))
    route = find_shortest_path(
        sample, SyntheticTerrain(traversable, np.ones((3, 3))), (0, 0), (2, 2)
    )

    assert route.metrics.distance_m == pytest.approx(4.0)
    assert len(route.grid_path) == 5
    assert (1, 1) not in route.grid_path
    assert_valid_path(route.grid_path, traversable, (0, 0), (2, 2))


def test_no_path_is_an_explicit_typed_condition() -> None:
    traversable = np.ones((5, 5), dtype=bool)
    for row in (1, 2, 3):
        for col in (1, 2, 3):
            if (row, col) != (2, 2):
                traversable[row, col] = False
    sample = region(np.zeros((5, 5)))

    with pytest.raises(NoPathError) as caught:
        find_shortest_path(
            sample, SyntheticTerrain(traversable, np.ones((5, 5))), (0, 0), (2, 2)
        )
    assert caught.value.code == "NO_PATH"
    assert caught.value.start == (0, 0)
    assert caught.value.goal == (2, 2)


def test_blocked_endpoints_are_rejected_and_start_equal_goal_is_valid() -> None:
    traversable = np.ones((3, 3), dtype=bool)
    traversable[0, 0] = False

    with pytest.raises(NoPathError, match="Start cell"):
        astar_search(traversable, (0, 0), (2, 2), 1.0, 1.0)
    with pytest.raises(NoPathError, match="Goal cell"):
        astar_search(traversable, (1, 1), (0, 0), 1.0, 1.0)

    traversable[0, 0] = True
    result = astar_search(traversable, (1, 1), (1, 1), 1.0, 1.0)
    assert result.path == ((1, 1),)
    assert result.cost == 0.0
    assert result.expanded_cells == 0

    sample = region(np.zeros((3, 3)))
    route = find_shortest_path(sample, flat_terrain(), (1, 1), (1, 1))
    assert route.metrics.distance_m == 0.0
    assert route.metrics.ascent_m == 0.0
    assert route.metrics.descent_m == 0.0
    assert route.metrics.max_slope_deg == 0.0
    assert route.metrics.cost == 0.0
    assert route.metrics.cell_count == 1


def test_metrics_come_from_elevations_not_step_indices() -> None:
    elevations = [[10, 15, 12, 20], [10, 15, 12, 20]]
    sample = region(elevations, pixel_x=2.0)
    route = find_shortest_path(sample, flat_terrain((2, 4)), (0, 0), (0, 3))
    profile = calculate_elevation_profile(sample, route.grid_path)

    assert route.grid_path == ((0, 0), (0, 1), (0, 2), (0, 3))
    assert route.metrics.distance_m == pytest.approx(6.0)
    assert route.metrics.ascent_m == pytest.approx(13.0)
    assert route.metrics.descent_m == pytest.approx(3.0)
    assert route.metrics.max_slope_deg == pytest.approx(np.degrees(np.arctan2(8.0, 2.0)))
    assert route.metrics.cell_count == 4
    assert route.metrics == calculate_route_metrics(sample, route.grid_path, cost=6.0)
    assert profile.distance_m == route.metrics.distance_m


def test_terrain_aware_avoids_a_high_cost_strip() -> None:
    sample = region(np.zeros((5, 5)))
    traversable = np.ones((5, 5), dtype=bool)
    multiplier = np.ones((5, 5), dtype=np.float64)
    multiplier[2, 1:4] = 50.0
    terrain = SyntheticTerrain(traversable, multiplier)

    shortest = find_shortest_path(sample, terrain, (2, 0), (2, 4))
    aware = find_terrain_aware_path(sample, terrain, (2, 0), (2, 4))

    assert shortest.grid_path == ((2, 0), (2, 1), (2, 2), (2, 3), (2, 4))
    assert shortest.metrics.distance_m == pytest.approx(4.0)
    assert aware.metrics.distance_m == pytest.approx(2.0 + 2.0 * math.sqrt(2.0))
    assert aware.metrics.distance_m > shortest.metrics.distance_m
    assert aware.metrics.cost < path_cost(shortest.grid_path, multiplier)
    assert all(multiplier[cell] == 1.0 for cell in aware.grid_path)
    assert_valid_path(aware.grid_path, traversable, (2, 0), (2, 4))


def test_comparator_reports_physical_tradeoffs_without_safety_claims() -> None:
    sample = region(np.zeros((5, 5)))
    multiplier = np.ones((5, 5), dtype=np.float64)
    multiplier[2, 1:4] = 50.0
    terrain = SyntheticTerrain(np.ones((5, 5), dtype=bool), multiplier)
    shortest = find_shortest_path(sample, terrain, (2, 0), (2, 4))
    aware = find_terrain_aware_path(sample, terrain, (2, 0), (2, 4))
    comparison = compare_routes(shortest, aware)

    assert comparison.same_path is False
    assert comparison.distance_delta_m == pytest.approx(
        aware.metrics.distance_m - shortest.metrics.distance_m
    )
    assert comparison.cell_count_delta == aware.metrics.cell_count - shortest.metrics.cell_count
    assert comparison.cost_comparable is False
    assert any("longer" in note for note in comparison.notes)
    assert any("not directly comparable" in note for note in comparison.notes)
    assert not any("safe" in note.lower() for note in comparison.notes)


def test_comparator_accepts_identical_routes() -> None:
    sample = region(np.zeros((3, 3)))
    terrain = flat_terrain()
    comparison = RoutePlanner().compare(sample, terrain, (0, 0), (2, 2))

    assert comparison.same_path is True
    assert comparison.distance_delta_m == 0.0
    assert comparison.cell_count_delta == 0
    assert any("same grid path" in note for note in comparison.notes)


def test_terrain_analysis_output_flows_into_the_planner() -> None:
    elevations = np.add.outer(np.arange(6, dtype=np.float64) * 0.2, np.zeros(6))
    sample = region(elevations)
    terrain = analyze_region(sample, {"max_slope_deg": 20.0, "slope_weight": 2.0})
    planner = RoutePlanner()

    shortest = planner.plan(sample, terrain, (2, 0), (2, 5), mode="shortest")
    aware = planner.plan(sample, terrain, (2, 0), (2, 5), mode="terrain_aware")

    assert all(terrain.traversable[cell] for cell in shortest.grid_path)
    assert all(terrain.traversable[cell] for cell in aware.grid_path)
    assert shortest.metrics.distance_m == pytest.approx(5.0)
    assert aware.metrics.cost >= shortest.metrics.cost
    assert shortest.mode == "shortest"
    assert aware.mode == "terrain_aware"
    with pytest.raises(ValueError):
        planner.plan(sample, terrain, (2, 0), (2, 5), mode="unknown")  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "call",
    [
        lambda: astar_search(np.ones((3, 3)), (0, 0), (2, 2), 1.0, 1.0),
        lambda: astar_search(np.ones(3, dtype=bool), (0, 0), (2, 2), 1.0, 1.0),
        lambda: astar_search(np.ones((3, 3), dtype=bool), (0.0, 0), (2, 2), 1.0, 1.0),
        lambda: astar_search(np.ones((3, 3), dtype=bool), (0, 0), (3, 3), 1.0, 1.0),
        lambda: astar_search(np.ones((3, 3), dtype=bool), (0, 0), (2, 2), 0.0, 1.0),
        lambda: astar_search(
            np.ones((3, 3), dtype=bool),
            (0, 0),
            (2, 2),
            1.0,
            1.0,
            np.ones((2, 2)),
        ),
        lambda: astar_search(
            np.ones((3, 3), dtype=bool),
            (0, 0),
            (2, 2),
            1.0,
            1.0,
            np.full((3, 3), 0.5),
        ),
        lambda: astar_search(
            np.ones((3, 3), dtype=bool),
            (0, 0),
            (2, 2),
            1.0,
            1.0,
            np.full((3, 3), np.nan),
        ),
        lambda: astar_search(
            np.ones((3, 3), dtype=bool), (0, 0), (2, 2), 1.0, 1.0, max_expanded_cells=0
        ),
    ],
)
def test_invalid_inputs_are_rejected(call: Callable[[], object]) -> None:
    with pytest.raises(ValueError):
        call()


def test_expansion_limit_stops_a_large_search() -> None:
    traversable = np.ones((50, 50), dtype=bool)
    with pytest.raises(SearchLimitExceeded) as caught:
        astar_search(
            traversable, (0, 0), (49, 49), 1.0, 1.0, max_expanded_cells=5
        )
    assert caught.value.code == "SEARCH_LIMIT"


def test_a_star_matches_dijkstra_on_seeded_random_grids() -> None:
    rng = np.random.default_rng(20261114)
    shape = (8, 8)
    start, goal = (0, 0), (7, 7)

    for _ in range(10):
        traversable = rng.random(shape) > 0.25
        traversable[start] = True
        traversable[goal] = True
        multiplier = rng.uniform(1.0, 5.0, size=shape)
        expected = reference_dijkstra(traversable, start, goal, 1.0, 1.0, multiplier)

        if expected is None:
            with pytest.raises(NoPathError):
                astar_search(
                    traversable,
                    start,
                    goal,
                    1.0,
                    1.0,
                    multiplier,
                    max_expanded_cells=None,
                )
            continue

        result = astar_search(
            traversable,
            start,
            goal,
            1.0,
            1.0,
            multiplier,
            max_expanded_cells=None,
        )
        assert result.cost == pytest.approx(expected, rel=1e-12, abs=1e-12)
        assert_valid_path(result.path, traversable, start, goal)


def test_hundred_by_hundred_grid_returns_the_known_diagonal() -> None:
    traversable = np.ones((100, 100), dtype=bool)
    started = time.perf_counter()
    result = astar_search(traversable, (0, 0), (99, 99), 1.0, 1.0)
    elapsed = time.perf_counter() - started

    assert result.path[0] == (0, 0)
    assert result.path[-1] == (99, 99)
    assert len(result.path) == 100
    assert result.cost == pytest.approx(99.0 * math.sqrt(2.0))
    assert elapsed < 10.0
