"""End-to-end mission orchestration for P4.

This module coordinates P1, P2 and P3 services. It does not implement raster
processing or A* itself, which keeps the domain boundaries testable.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.nasa_data.repository import RegionRepository
from app.routing import NoPathError, RoutePlanner, SearchLimitExceeded
from app.routing.schemas import RouteComparison, RouteResult
from app.terrain import TerrainAnalyzer, TerrainConfig

from .analysis_window import (
    crop_region,
    localize_point,
    point_in_window,
    resolve_analysis_window,
)
from .mission_builder import build_mission_response
from .schemas import MissionRequest, MissionResponse
from .scientific_targets import ScientificTarget, ScientificTargetCatalog


class MissionServiceError(RuntimeError):
    """Expected domain error that can be translated into an HTTP envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int,
        details: dict[str, object] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class RegionProvider(Protocol):
    def get_region(self, region_id: str): ...


class MissionService:
    """Compose repositories, terrain analysis and route planning."""

    def __init__(
        self,
        repository: RegionProvider | None = None,
        *,
        catalog: ScientificTargetCatalog | None = None,
        route_planner: RoutePlanner | None = None,
        methodology_version: str = "mvp-1",
    ) -> None:
        self.repository = repository or RegionRepository()
        self.catalog = catalog or ScientificTargetCatalog()
        self.route_planner = route_planner or RoutePlanner()
        self.methodology_version = methodology_version

    def load_region(self, region_id: str):
        try:
            return self.repository.get_region(region_id)
        except KeyError as exc:
            raise MissionServiceError(
                "REGION_NOT_FOUND",
                f"Unknown region: {region_id}.",
                status_code=404,
                details={"region_id": region_id},
            ) from exc
        except FileNotFoundError as exc:
            raise MissionServiceError(
                "DTM_UNAVAILABLE",
                "The processed DTM is not available for this region.",
                status_code=503,
                details={"region_id": region_id},
            ) from exc
        except ValueError as exc:
            raise MissionServiceError(
                "INVALID_DATA",
                "Region data failed integrity validation.",
                status_code=409,
                details={"region_id": region_id},
            ) from exc

    def terrain_for(self, region, config: dict[str, float]):
        try:
            terrain_config = TerrainConfig.from_value(config)
            return TerrainAnalyzer(terrain_config).analyze(region)
        except ValueError as exc:
            raise MissionServiceError(
                "INVALID_TERRAIN_CONFIG",
                str(exc),
                status_code=422,
                details={},
            ) from exc

    def get_scientific_targets(self, region_id: str) -> tuple[ScientificTarget, ...]:
        # Keep the catalog endpoint consistent with every other region-scoped
        # endpoint: an unknown region is not the same as a known region with
        # no documented targets.
        self.load_region(region_id)
        return self.catalog.for_region(region_id)

    def _requested_targets(self, request: MissionRequest) -> tuple[ScientificTarget, ...]:
        targets: list[ScientificTarget] = []
        for target_id in request.scientific_target_ids:
            target = self.catalog.get(target_id, region_id=request.region_id)
            if target is None:
                raise MissionServiceError(
                    "SCIENTIFIC_TARGET_NOT_FOUND",
                    f"Unknown scientific target: {target_id}.",
                    status_code=404,
                    details={"target_id": target_id, "region_id": request.region_id},
                )
            targets.append(target)
        return tuple(targets)

    def _validate_target_destination(
        self,
        request: MissionRequest,
        targets: tuple[ScientificTarget, ...],
    ) -> None:
        for target in targets:
            if not target.is_navigable or target.position is None:
                continue
            if request.destination.as_tuple() != target.position:
                raise MissionServiceError(
                    "SCIENTIFIC_TARGET_COORDINATE_MISMATCH",
                    "A navigable scientific target must be used at its verified grid coordinate.",
                    status_code=422,
                    details={
                        "target_id": target.target_id,
                        "expected_destination": {
                            "row": target.position[0],
                            "col": target.position[1],
                        },
                    },
                )

    def _calculate_routes(self, request: MissionRequest, region, terrain) -> tuple[tuple[RouteResult, ...], RouteComparison | None]:
        start = request.start.as_tuple()
        destination = request.destination.as_tuple()
        try:
            if request.mode == "compare":
                comparison = self.route_planner.compare(region, terrain, start, destination)
                return (comparison.shortest, comparison.terrain_aware), comparison
            route = self.route_planner.plan(
                region,
                terrain,
                start,
                destination,
                mode=request.mode,
            )
            return (route,), None
        except NoPathError as exc:
            raise MissionServiceError(
                exc.code,
                "No traversable route exists for the requested points and mode.",
                status_code=422,
                details={
                    "start": {"row": exc.start[0], "col": exc.start[1]},
                    "goal": {"row": exc.goal[0], "col": exc.goal[1]},
                    "mode": exc.mode,
                    "reason": exc.reason,
                },
            ) from exc
        except SearchLimitExceeded as exc:
            raise MissionServiceError(
                exc.code,
                "Route search reached its configured expansion limit.",
                status_code=422,
                details={
                    "max_expanded_cells": exc.limit,
                    "suggestion": "Reduce the selected analysis area or choose closer mission points.",
                },
            ) from exc
        except ValueError as exc:
            raise MissionServiceError(
                "INVALID_ROUTE_INPUT",
                str(exc),
                status_code=422,
                details={},
            ) from exc

    def create_mission_plan(self, request: MissionRequest) -> MissionResponse:
        parent_region = self.load_region(request.region_id)
        try:
            analysis_window = resolve_analysis_window(parent_region, request.analysis_window)
        except ValueError as exc:
            raise MissionServiceError(
                "INVALID_ANALYSIS_WINDOW",
                str(exc),
                status_code=422,
                details={"region_id": request.region_id},
            ) from exc

        parent_height, parent_width = parent_region.elevation_m.shape
        for name, point in (("start", request.start.as_tuple()), ("destination", request.destination.as_tuple())):
            if not (0 <= point[0] < parent_height and 0 <= point[1] < parent_width):
                raise MissionServiceError(
                    "INVALID_ROUTE_INPUT",
                    f"{name.title()} is outside the {parent_height}x{parent_width} raster grid.",
                    status_code=422,
                    details={
                        "point": {"row": point[0], "col": point[1]},
                        "shape": [parent_height, parent_width],
                    },
                )
            if not point_in_window(point, analysis_window):
                raise MissionServiceError(
                    "INVALID_GRID_POINT",
                    f"{name.title()} must be inside the selected analysis window.",
                    status_code=422,
                    details={
                        "point": {"row": point[0], "col": point[1]},
                        "analysis_window": analysis_window.as_dict(),
                    },
                )

        region = crop_region(parent_region, analysis_window)
        local_request = request.model_copy(
            update={
                "start": request.start.model_copy(
                    update={
                        "row": localize_point(request.start.as_tuple(), analysis_window)[0],
                        "col": localize_point(request.start.as_tuple(), analysis_window)[1],
                    }
                ),
                "destination": request.destination.model_copy(
                    update={
                        "row": localize_point(request.destination.as_tuple(), analysis_window)[0],
                        "col": localize_point(request.destination.as_tuple(), analysis_window)[1],
                    }
                ),
                "analysis_window": None,
            }
        )

        terrain = self.terrain_for(region, local_request.terrain_config.as_dict())
        targets = self._requested_targets(request)
        self._validate_target_destination(request, targets)
        for target in targets:
            if target.position is not None and not point_in_window(target.position, analysis_window):
                raise MissionServiceError(
                    "SCIENTIFIC_TARGET_OUTSIDE_ANALYSIS_WINDOW",
                    "A selected scientific target is outside the analysis window.",
                    status_code=422,
                    details={
                        "target_id": target.target_id,
                        "analysis_window": analysis_window.as_dict(),
                    },
                )

        routes, comparison = self._calculate_routes(local_request, region, terrain)

        limitations = [
            "Research prototype; not operational EVA navigation or safety guidance.",
            "Coordinates use zero-based raster cells under the grid_row_col contract.",
            "Terrain-aware cost is an exploratory criterion, not a safety score.",
        ]
        if any(not target.is_navigable for target in targets):
            limitations.append(
                "One or more selected scientific targets are contextual only and have no verified navigation coordinate."
            )
        if request.analysis_window is not None:
            limitations.append(
                "Routing was calculated inside the user-selected analysis window; "
                "grid coordinates remain relative to the parent region."
            )

        return build_mission_response(
            request,
            routes,
            comparison=comparison,
            scientific_targets=targets,
            data_sources=region.source_ids,
            methodology_version=self.methodology_version,
            limitations=limitations,
            region=region,
            terrain=terrain,
            grid_offset=(analysis_window.row, analysis_window.col),
        )


def create_mission_service(
    data_root: str | Path | None = None,
    *,
    repository: RegionProvider | None = None,
    catalog: ScientificTargetCatalog | None = None,
    methodology_version: str = "mvp-1",
) -> MissionService:
    root = Path(data_root) if data_root is not None else None
    resolved_repository = repository or RegionRepository(root)
    resolved_catalog = catalog or ScientificTargetCatalog(
        root / "scientific_targets.json" if root is not None else None
    )
    return MissionService(
        resolved_repository,
        catalog=resolved_catalog,
        methodology_version=methodology_version,
    )


def create_mission_plan(service: MissionService, request: MissionRequest) -> MissionResponse:
    return service.create_mission_plan(request)


__all__ = [
    "MissionService",
    "MissionServiceError",
    "create_mission_plan",
    "create_mission_service",
]
