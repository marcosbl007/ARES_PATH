"""Application entry point for the ARES PATH backend.

This module owns process-level concerns only: FastAPI construction, CORS,
configuration shared through ``app.state`` and the public error envelope.
Domain logic belongs to the modules under ``app/`` and is composed through
``app.api.router``.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.api.router import create_api_router
from app.missions.mission_service import MissionService
from app.nasa_data.repository import RegionRepository


logger = logging.getLogger("ares_path.api")


@dataclass(frozen=True)
class AppSettings:
    """Small process configuration shared by future dependency providers."""

    project_name: str = "ARES PATH"
    version: str = "0.1.0"
    challenge: str = "Interplanetary Survival Guide: Martian Map"
    methodology_version: str = "mvp-1"
    data_root: Path = Path(__file__).resolve().parents[1] / "data"
    cors_origins: tuple[str, ...] = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    )

    @classmethod
    def from_environment(cls) -> "AppSettings":
        configured_root = os.getenv("ARES_DATA_ROOT")
        configured_origins = os.getenv("ARES_CORS_ORIGINS")
        origins = (
            tuple(origin.strip() for origin in configured_origins.split(",") if origin.strip())
            if configured_origins
            else cls.cors_origins
        )
        return cls(
            data_root=(Path(configured_root).expanduser().resolve() if configured_root else cls.data_root),
            cors_origins=origins,
        )


def create_app(
    settings: AppSettings | None = None,
    *,
    region_repository: RegionRepository | None = None,
    mission_service: MissionService | None = None,
) -> FastAPI:
    """Create the application, keeping construction friendly to tests."""

    app_settings = settings or AppSettings.from_environment()
    application = FastAPI(
        title=app_settings.project_name,
        version=app_settings.version,
        description=(
            "Research prototype for explainable Marswalk route planning. "
            "It is not an operational EVA navigation or safety system."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    application.state.settings = app_settings

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(app_settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    application.include_router(
        create_api_router(
            data_root=app_settings.data_root,
            project_name=app_settings.project_name,
            version=app_settings.version,
            challenge=app_settings.challenge,
            methodology_version=app_settings.methodology_version,
            region_repository=region_repository,
            mission_service=mission_service,
        )
    )

    @application.get("/", tags=["meta"], summary="Backend metadata")
    async def root() -> dict[str, str]:
        return {
            "project": app_settings.project_name,
            "version": app_settings.version,
            "docs": "/docs",
            "status": "ok",
        }

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": jsonable_encoder(exc.errors()),
            },
        )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(
        _request: Request,
        exc: HTTPException,
    ) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": detail.get("code", "HTTP_ERROR"),
                "message": detail.get("message", "The request could not be completed."),
                "details": detail.get("details", detail),
            },
            headers=exc.headers,
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(
        _request: Request,
        exc: Exception,
    ) -> JSONResponse:
        logger.exception("Unhandled API error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "code": "INTERNAL_ERROR",
                "message": "An unexpected internal error occurred.",
                "details": {},
            },
        )

    return application


app = create_app()


__all__ = ["AppSettings", "app", "create_app"]

