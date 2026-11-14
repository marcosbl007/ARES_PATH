"""Small response models for process health and public system metadata."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Indicates that the HTTP process answered the request."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"] = "ok"


class SystemInfoResponse(BaseModel):
    """Non-sensitive project metadata exposed by the backend."""

    model_config = ConfigDict(extra="forbid")

    project: str = "ARES PATH"
    version: str = "0.1.0"
    challenge: str = "Interplanetary Survival Guide: Martian Map"
    scope: str = "Explainable exploratory planning over a documented Mars raster region."
    status: Literal["prototype"] = "prototype"
    warning: str = Field(
        default="Research prototype; not operational EVA navigation or safety guidance."
    )


__all__ = ["HealthResponse", "SystemInfoResponse"]
