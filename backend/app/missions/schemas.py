"""Pydantic DTOs for the public mission-planning contract."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CoordinateSystem = Literal["grid_row_col"]
MissionMode = Literal["compare", "shortest", "terrain_aware"]
RouteMode = Literal["shortest", "terrain_aware"]


class GridPointModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row: int = Field(ge=0)
    col: int = Field(ge=0)

    def as_tuple(self) -> tuple[int, int]:
        return self.row, self.col


class TerrainConfigRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_slope_deg: float = Field(default=20.0, gt=0.0, le=90.0)
    slope_weight: float = Field(default=2.0, ge=0.0)

    def as_dict(self) -> dict[str, float]:
        return {
            "max_slope_deg": self.max_slope_deg,
            "slope_weight": self.slope_weight,
        }


class MissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    coordinate_system: CoordinateSystem = "grid_row_col"
    start: GridPointModel
    destination: GridPointModel
    mode: MissionMode = "compare"
    terrain_config: TerrainConfigRequest = Field(default_factory=TerrainConfigRequest)
    scientific_target_ids: list[str] = Field(default_factory=list, max_length=16)


class RouteCalculationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    coordinate_system: CoordinateSystem = "grid_row_col"
    start: GridPointModel
    destination: GridPointModel
    mode: RouteMode
    terrain_config: TerrainConfigRequest = Field(default_factory=TerrainConfigRequest)

    def as_mission_request(self) -> MissionRequest:
        return MissionRequest(
            region_id=self.region_id,
            coordinate_system=self.coordinate_system,
            start=self.start,
            destination=self.destination,
            mode=self.mode,
            terrain_config=self.terrain_config,
        )


class TerrainProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    grid_path: list[GridPointModel] = Field(min_length=1)


class TraversabilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    terrain_config: TerrainConfigRequest = Field(default_factory=TerrainConfigRequest)


class RouteMetricsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    distance_m: float = Field(ge=0.0)
    ascent_m: float = Field(ge=0.0)
    descent_m: float = Field(ge=0.0)
    max_slope_deg: float = Field(ge=0.0)
    cost: float = Field(ge=0.0)
    cell_count: int = Field(ge=1)


class RouteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route_id: str
    mode: RouteMode
    grid_path: list[GridPointModel] = Field(min_length=1)
    metrics: RouteMetricsResponse
    expanded_cells: int = Field(ge=0)
    coordinate_system: CoordinateSystem = "grid_row_col"


class RouteComparisonResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    distance_delta_m: float
    ascent_delta_m: float
    descent_delta_m: float
    max_slope_delta_deg: float
    cell_count_delta: int
    same_path: bool
    cost_comparable: bool
    notes: list[str]


class ScientificTargetResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_id: str
    name: str
    region_id: str
    position: GridPointModel | None
    coordinate_status: Literal["verified", "contextual_only"]
    is_navigable: bool
    mission: str
    instrument: str
    source_url: str
    source_ids: list[str]
    description: str


class MissionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mission_id: str
    region_id: str
    coordinate_system: CoordinateSystem
    routes: list[RouteResponse] = Field(min_length=1)
    comparison: RouteComparisonResponse | None = None
    scientific_targets: list[ScientificTargetResponse]
    data_sources: list[str]
    methodology_version: str
    limitations: list[str]


class TerrainStatisticsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str
    height: int = Field(ge=1)
    width: int = Field(ge=1)
    valid_cell_count: int = Field(ge=0)
    valid_fraction: float = Field(ge=0.0, le=1.0)
    slope_cell_count: int = Field(ge=0)
    traversable_cell_count: int = Field(ge=0)
    traversable_fraction: float = Field(ge=0.0, le=1.0)
    elevation_min_m: float | None
    elevation_max_m: float | None
    elevation_mean_m: float | None
    elevation_median_m: float | None
    slope_min_deg: float | None
    slope_max_deg: float | None
    slope_mean_deg: float | None
    slope_median_deg: float | None
    pixel_size_x_m: float = Field(gt=0.0)
    pixel_size_y_m: float = Field(gt=0.0)
    config: dict[str, object]


class ElevationProfileResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grid_path: list[GridPointModel] = Field(min_length=1)
    cumulative_distance_m: list[float]
    elevation_m: list[float]
    distance_m: float = Field(ge=0.0)
    ascent_m: float = Field(ge=0.0)
    descent_m: float = Field(ge=0.0)
    max_slope_deg: float = Field(ge=0.0)


class TraversabilityResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str
    height: int = Field(ge=1)
    width: int = Field(ge=1)
    valid_cell_count: int = Field(ge=0)
    traversable_cell_count: int = Field(ge=0)
    valid_fraction: float = Field(ge=0.0, le=1.0)
    traversable_fraction: float = Field(ge=0.0, le=1.0)
    config: dict[str, object]


class APIError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    details: dict[str, object] = Field(default_factory=dict)


__all__ = [
    "APIError",
    "CoordinateSystem",
    "ElevationProfileResponse",
    "GridPointModel",
    "MissionRequest",
    "MissionMode",
    "MissionResponse",
    "RouteCalculationRequest",
    "RouteComparisonResponse",
    "RouteMetricsResponse",
    "RouteMode",
    "RouteResponse",
    "ScientificTargetResponse",
    "TerrainConfigRequest",
    "TerrainProfileRequest",
    "TerrainStatisticsResponse",
    "TraversabilityRequest",
    "TraversabilityResponse",
]
