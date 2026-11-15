"""HTTP adapter for the P4 mission service."""

from fastapi import APIRouter, HTTPException

from .mission_builder import build_target_response
from .mission_service import MissionService, MissionServiceError
from .schemas import MissionRequest, MissionResponse, ScientificTargetResponse


def _as_http_error(error: MissionServiceError) -> HTTPException:
    return HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": error.message, "details": error.details},
    )


def create_router(service: MissionService) -> APIRouter:
    router = APIRouter(prefix="/missions", tags=["missions"])

    @router.get(
        "/scientific-targets",
        response_model=list[ScientificTargetResponse],
        summary="List documented scientific targets for a region",
    )
    def scientific_targets(region_id: str) -> list[ScientificTargetResponse]:
        try:
            targets = service.get_scientific_targets(region_id)
        except MissionServiceError as error:
            raise _as_http_error(error) from error
        return [build_target_response(target) for target in targets]

    @router.get(
        "/scientific-targets/{target_id}",
        response_model=ScientificTargetResponse,
        summary="Read one documented scientific target",
    )
    def scientific_target(target_id: str, region_id: str | None = None) -> ScientificTargetResponse:
        try:
            if region_id is not None:
                service.load_region(region_id)
            target = service.catalog.get(target_id, region_id=region_id)
            if target is None:
                raise MissionServiceError(
                    "SCIENTIFIC_TARGET_NOT_FOUND",
                    f"Unknown scientific target: {target_id}.",
                    status_code=404,
                    details={"target_id": target_id, "region_id": region_id or "catalog"},
                )
        except MissionServiceError as error:
            raise _as_http_error(error) from error
        return build_target_response(target)

    @router.post(
        "/plan",
        response_model=MissionResponse,
        summary="Calculate a mission route plan",
    )
    def plan(request: MissionRequest) -> MissionResponse:
        try:
            return service.create_mission_plan(request)
        except MissionServiceError as error:
            raise _as_http_error(error) from error

    return router


__all__ = ["create_router"]
