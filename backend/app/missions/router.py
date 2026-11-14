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
        return [
            build_target_response(target) for target in service.get_scientific_targets(region_id)
        ]

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
