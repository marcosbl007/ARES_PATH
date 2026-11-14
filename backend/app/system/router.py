"""Minimal system endpoints owned by Persona 5."""

from fastapi import APIRouter

from .schemas import HealthResponse, SystemInfoResponse


def create_router(
    *,
    project: str = "ARES PATH",
    version: str = "0.1.0",
    challenge: str = "Interplanetary Survival Guide: Martian Map",
) -> APIRouter:
    """Create an isolated router relative to the shared ``/api`` prefix."""

    router = APIRouter(tags=["system"])

    @router.get("/health", response_model=HealthResponse, summary="Check process health")
    def health() -> HealthResponse:
        return HealthResponse()

    @router.get(
        "/system/info",
        response_model=SystemInfoResponse,
        summary="Read public system metadata",
    )
    def info() -> SystemInfoResponse:
        return SystemInfoResponse(project=project, version=version, challenge=challenge)

    return router


router = create_router()

__all__ = ["create_router", "router"]
