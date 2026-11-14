"""A* routing, route metrics, and alternative comparison for ARES PATH."""

from app.routing.astar import AStarPath, astar_search, plan_path
from app.routing.route_comparator import compare_routes
from app.routing.route_planner import (
    RoutePlanner,
    calculate_route_metrics,
    find_shortest_path,
    find_terrain_aware_path,
)
from app.routing.schemas import (
    DEFAULT_MAX_EXPANDED_CELLS,
    GridPoint,
    NoPathError,
    RouteComparison,
    RouteMetrics,
    RouteResult,
    RoutingError,
    SearchLimitExceeded,
)

__all__ = [
    "AStarPath",
    "DEFAULT_MAX_EXPANDED_CELLS",
    "GridPoint",
    "NoPathError",
    "RouteComparison",
    "RouteMetrics",
    "RoutePlanner",
    "RouteResult",
    "RoutingError",
    "SearchLimitExceeded",
    "astar_search",
    "calculate_route_metrics",
    "compare_routes",
    "find_shortest_path",
    "find_terrain_aware_path",
    "plan_path",
]
