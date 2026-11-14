"""Pure serialization helpers for mission responses."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence

from app.routing.schemas import RouteComparison, RouteResult

from .schemas import (
    GridPointModel,
    MissionRequest,
    MissionResponse,
    RouteComparisonResponse,
    RouteMetricsResponse,
    RouteResponse,
    ScientificTargetResponse,
)
from .scientific_targets import ScientificTarget


def build_mission_id(request: MissionRequest) -> str:
    """Create a deterministic identifier without timestamps or random state."""

    payload = json.dumps(request.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
    return f"mission-{request.region_id}-{digest}"


def build_route_response(route: RouteResult) -> RouteResponse:
    return RouteResponse(
        route_id=route.route_id,
        mode=route.mode,
        grid_path=[GridPointModel(row=row, col=col) for row, col in route.grid_path],
        metrics=RouteMetricsResponse(
            distance_m=float(route.metrics.distance_m),
            ascent_m=float(route.metrics.ascent_m),
            descent_m=float(route.metrics.descent_m),
            max_slope_deg=float(route.metrics.max_slope_deg),
            cost=float(route.metrics.cost),
            cell_count=int(route.metrics.cell_count),
        ),
        expanded_cells=int(route.expanded_cells),
        coordinate_system=route.coordinate_system,
    )


def build_comparison_response(comparison: RouteComparison) -> RouteComparisonResponse:
    return RouteComparisonResponse(
        distance_delta_m=float(comparison.distance_delta_m),
        ascent_delta_m=float(comparison.ascent_delta_m),
        descent_delta_m=float(comparison.descent_delta_m),
        max_slope_delta_deg=float(comparison.max_slope_delta_deg),
        cell_count_delta=int(comparison.cell_count_delta),
        same_path=bool(comparison.same_path),
        cost_comparable=bool(comparison.cost_comparable),
        notes=list(comparison.notes),
    )


def build_target_response(target: ScientificTarget) -> ScientificTargetResponse:
    position = (
        GridPointModel(row=target.position[0], col=target.position[1])
        if target.position is not None
        else None
    )
    return ScientificTargetResponse(
        target_id=target.target_id,
        name=target.name,
        region_id=target.region_id,
        position=position,
        coordinate_status=target.coordinate_status,  # type: ignore[arg-type]
        is_navigable=target.is_navigable,
        mission=target.mission,
        instrument=target.instrument,
        source_url=target.source_url,
        source_ids=list(target.source_ids),
        description=target.description,
    )


def build_mission_response(
    request: MissionRequest,
    routes: Sequence[RouteResult],
    *,
    comparison: RouteComparison | None,
    scientific_targets: Sequence[ScientificTarget],
    data_sources: Sequence[str],
    methodology_version: str,
    limitations: Sequence[str],
) -> MissionResponse:
    return MissionResponse(
        mission_id=build_mission_id(request),
        region_id=request.region_id,
        coordinate_system=request.coordinate_system,
        routes=[build_route_response(route) for route in routes],
        comparison=build_comparison_response(comparison) if comparison else None,
        scientific_targets=[build_target_response(target) for target in scientific_targets],
        data_sources=list(data_sources),
        methodology_version=methodology_version,
        limitations=list(limitations),
    )


__all__ = [
    "build_comparison_response",
    "build_mission_id",
    "build_mission_response",
    "build_route_response",
    "build_target_response",
]
