"""Composition point for the public ``/api`` surface.

P4 owns this module. It registers domain routers and keeps HTTP adapters thin:
NASA data, terrain, and routing algorithms remain in their own modules.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import asdict
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from app.missions.mission_service import (
    MissionService,
    MissionServiceError,
    create_mission_service,
)
from app.missions.analysis_window import (
    crop_region,
    globalize_path,
    localize_path,
    localize_point,
    point_in_window,
    resolve_analysis_window,
)
from app.missions.mission_builder import build_target_response
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
    TerrainSampleRequest,
    TerrainSampleResponse,
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

    def region_for_window(region_id: str, requested_window):
        parent_region = load_region(region_id)
        try:
            window = resolve_analysis_window(parent_region, requested_window)
        except ValueError as error:
            raise _terrain_error(
                "INVALID_ANALYSIS_WINDOW",
                str(error),
                422,
                {"region_id": region_id},
            ) from error
        return crop_region(parent_region, window), window

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
        "/sample",
        response_model=TerrainSampleResponse,
        summary="Inspect elevation and slope at one raster cell",
    )
    def sample(request: TerrainSampleRequest) -> TerrainSampleResponse:
        region, analysis_window = region_for_window(request.region_id, request.analysis_window)
        absolute_point = request.point.as_tuple()
        if not point_in_window(absolute_point, analysis_window):
            raise _terrain_error(
                "INVALID_GRID_POINT",
                "Point is outside the selected analysis window.",
                422,
                {
                    "point": {"row": absolute_point[0], "col": absolute_point[1]},
                    "analysis_window": analysis_window.as_dict(),
                },
            )
        row, col = localize_point(absolute_point, analysis_window)

        try:
            terrain_analyzer = analyzer(request.terrain_config)
            terrain = terrain_analyzer.analyze(region)
            slope = terrain_analyzer.calculate_slope(region)
        except ValueError as error:
            raise _terrain_error("INVALID_TERRAIN_CONFIG", str(error), 422, {}) from error

        x_m, y_m = region.cell_center(row, col)
        is_valid = bool(region.valid_mask[row, col])
        elevation_m = float(region.elevation_m[row, col]) if is_valid else None
        slope_value = float(slope[row, col]) if np.isfinite(slope[row, col]) else None
        coverage_status = "valid" if is_valid and slope_value is not None else "nodata"

        nearby_targets = []
        for target in service.catalog.for_region(request.region_id):
            if target.position is None or not target.is_navigable:
                continue
            target_distance = float(
                ((target.position[0] - absolute_point[0]) ** 2
                 + (target.position[1] - absolute_point[1]) ** 2) ** 0.5
            )
            if target_distance <= 10.0:
                nearby_targets.append(target)

        try:
            layer_descriptors = service.repository.get_available_layers(request.region_id)
            available_layer_ids = [str(layer["layer_id"]) for layer in layer_descriptors]
        except (AttributeError, KeyError, FileNotFoundError, ValueError):
            available_layer_ids = []

        limitations = [
            "The sample is a raster-cell query; it is not a continuous terrain survey.",
            "Slope is derived from the local elevation grid using finite differences.",
        ]
        if not is_valid:
            limitations.append("The selected cell has no valid elevation value in the DTM.")

        return TerrainSampleResponse(
            region_id=request.region_id,
            point=request.point,
            coordinate_system="grid_row_col",
            map_x_m=float(x_m),
            map_y_m=float(y_m),
            coverage_status=coverage_status,
            no_data=not is_valid,
            elevation_m=elevation_m,
            slope_deg=slope_value,
            slope_exceeds_threshold=(
                bool(slope_value > request.terrain_config.max_slope_deg)
                if slope_value is not None
                else None
            ),
            traversable=(bool(terrain.traversable[row, col]) if is_valid else False),
            pixel_size_x_m=float(region.pixel_size_x_m),
            pixel_size_y_m=float(region.pixel_size_y_m),
            source_ids=list(region.source_ids),
            available_layer_ids=available_layer_ids,
            nearby_scientific_targets=[
                # The catalog already enforces source-backed target records.
                build_target_response(target)
                for target in nearby_targets
            ],
            limitations=limitations,
        )

    @router.post(
        "/elevation-profile",
        response_model=ElevationProfileResponse,
        summary="Calculate an elevation profile for a grid path",
    )
    def elevation_profile(request: TerrainProfileRequest) -> ElevationProfileResponse:
        region, analysis_window = region_for_window(request.region_id, request.analysis_window)
        absolute_path = [point.as_tuple() for point in request.grid_path]
        if any(not point_in_window(point, analysis_window) for point in absolute_path):
            raise _terrain_error(
                "INVALID_GRID_PATH",
                "Every profile point must be inside the selected analysis window.",
                422,
                {"analysis_window": analysis_window.as_dict()},
            )
        try:
            profile = TerrainAnalyzer().elevation_profile(
                region, localize_path(absolute_path, analysis_window)
            )
        except ValueError as error:
            raise _terrain_error("INVALID_GRID_PATH", str(error), 422, {}) from error
        return ElevationProfileResponse(
            grid_path=[
                GridPointModel(row=row, col=col)
                for row, col in globalize_path(profile.grid_path, analysis_window)
            ],
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
        region, _analysis_window = region_for_window(request.region_id, request.analysis_window)
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
