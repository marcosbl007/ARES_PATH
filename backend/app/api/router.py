"""Composition point for the public ``/api`` surface.

P4 owns this module. It registers domain routers and keeps HTTP adapters thin:
NASA data, terrain, and routing algorithms remain in their own modules.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.missions.mission_service import (
    MissionService,
    MissionServiceError,
    create_mission_service,
)
from app.missions.router import create_router as create_missions_router
from app.missions.schemas import (
    ElevationProfileResponse,
    GridPointModel,
    MissionRequest,
    MissionResponse,
    RouteCalculationRequest,
    RouteResponse,
    TerrainConfigRequest,
    TerrainProfileRequest,
    TerrainStatisticsResponse,
    TraversabilityRequest,
    TraversabilityResponse,
)
from app.nasa_data.repository import RegionRepository, create_router as create_data_router
from app.system.router import create_router as create_system_router
from app.terrain import TerrainAnalyzer, TerrainConfig


def _mission_error(error: MissionServiceError) -> HTTPException:
    return HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": error.message, "details": error.details},
    )


def _terrain_error(
    code: str,
    message: str,
    status_code: int,
    details: dict[str, object],
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "details": details},
    )


def _build_terrain_router(service: MissionService) -> APIRouter:
    router = APIRouter(prefix="/terrain", tags=["terrain"])

    def load_region(region_id: str):
        try:
            return service.load_region(region_id)
        except MissionServiceError as error:
            raise _mission_error(error) from error

    def analyzer(config: TerrainConfigRequest) -> TerrainAnalyzer:
        try:
            return TerrainAnalyzer(TerrainConfig.from_value(config.as_dict()))
        except ValueError as error:
            raise _terrain_error("INVALID_TERRAIN_CONFIG", str(error), 422, {}) from error

    @router.get(
        "/{region_id}/summary",
        response_model=TerrainStatisticsResponse,
        summary="Read compact terrain statistics",
    )
    def summary(
        region_id: str,
        max_slope_deg: float = Query(default=20.0, gt=0.0, le=90.0),
        slope_weight: float = Query(default=2.0, ge=0.0),
    ) -> TerrainStatisticsResponse:
        region = load_region(region_id)
        try:
            statistics = TerrainAnalyzer(
                TerrainConfig(max_slope_deg=max_slope_deg, slope_weight=slope_weight)
            ).summary(region)
        except ValueError as error:
            raise _terrain_error("INVALID_TERRAIN_CONFIG", str(error), 422, {}) from error
        return TerrainStatisticsResponse.model_validate(asdict(statistics))

    @router.post(
        "/elevation-profile",
        response_model=ElevationProfileResponse,
        summary="Calculate an elevation profile for a grid path",
    )
    def elevation_profile(request: TerrainProfileRequest) -> ElevationProfileResponse:
        region = load_region(request.region_id)
        try:
            profile = TerrainAnalyzer().elevation_profile(
                region, [point.as_tuple() for point in request.grid_path]
            )
        except ValueError as error:
            raise _terrain_error("INVALID_GRID_PATH", str(error), 422, {}) from error
        return ElevationProfileResponse(
            grid_path=[GridPointModel(row=row, col=col) for row, col in profile.grid_path],
            cumulative_distance_m=list(profile.cumulative_distance_m),
            elevation_m=list(profile.elevation_m),
            distance_m=float(profile.distance_m),
            ascent_m=float(profile.ascent_m),
            descent_m=float(profile.descent_m),
            max_slope_deg=float(profile.max_slope_deg),
        )

    @router.post(
        "/traversability",
        response_model=TraversabilityResponse,
        summary="Summarize terrain traversability without returning a raster",
    )
    def traversability(request: TraversabilityRequest) -> TraversabilityResponse:
        region = load_region(request.region_id)
        try:
            statistics = analyzer(request.terrain_config).summary(region)
        except ValueError as error:
            raise _terrain_error("INVALID_TERRAIN_CONFIG", str(error), 422, {}) from error
        return TraversabilityResponse(
            region_id=statistics.region_id,
            height=statistics.height,
            width=statistics.width,
            valid_cell_count=statistics.valid_cell_count,
            traversable_cell_count=statistics.traversable_cell_count,
            valid_fraction=statistics.valid_fraction,
            traversable_fraction=statistics.traversable_fraction,
            config=statistics.config,
        )

    return router


def _build_routing_router(service: MissionService) -> APIRouter:
    router = APIRouter(prefix="/routes", tags=["routes"])

    @router.post(
        "/calculate",
        response_model=RouteResponse,
        summary="Calculate one route mode",
    )
    def calculate(request: RouteCalculationRequest) -> RouteResponse:
        try:
            response = service.create_mission_plan(request.as_mission_request())
        except MissionServiceError as error:
            raise _mission_error(error) from error
        return response.routes[0]

    @router.post(
        "/compare",
        response_model=MissionResponse,
        summary="Compare shortest and terrain-aware routes",
    )
    def compare(request: MissionRequest) -> MissionResponse:
        if request.mode != "compare":
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_ROUTE_MODE",
                    "message": "The compare endpoint requires mode='compare'.",
                    "details": {},
                },
            )
        try:
            return service.create_mission_plan(request)
        except MissionServiceError as error:
            raise _mission_error(error) from error

    return router


def create_api_router(
    *,
    data_root: str | Path | None = None,
    project_name: str = "ARES PATH",
    version: str = "0.1.0",
    challenge: str = "Interplanetary Survival Guide: Martian Map",
    methodology_version: str = "mvp-1",
    region_repository: RegionRepository | None = None,
    mission_service: MissionService | None = None,
) -> APIRouter:
    """Build an isolated API tree so tests can inject in-memory services."""

    root = APIRouter(prefix="/api")
    repository = region_repository or RegionRepository(data_root)
    service = mission_service or create_mission_service(
        data_root,
        repository=repository,
        methodology_version=methodology_version,
    )

    root.include_router(create_data_router(repository))
    root.include_router(
        create_system_router(project=project_name, version=version, challenge=challenge)
    )
    root.include_router(create_missions_router(service))
    root.include_router(_build_terrain_router(service))
    root.include_router(_build_routing_router(service))
    return root


# Compatibility exports for integrations that import a module-level router.
router = create_api_router()
api_router = router


def register_router(domain_router: APIRouter) -> APIRouter:
    """Register a relative domain router on the compatibility router."""

    router.include_router(domain_router)
    return domain_router


def register_routers(domain_routers: Iterable[APIRouter]) -> None:
    for domain_router in domain_routers:
        register_router(domain_router)


__all__ = [
    "api_router",
    "create_api_router",
    "register_router",
    "register_routers",
    "router",
]
