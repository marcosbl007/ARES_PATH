"""Pydantic DTOs for the public mission-planning contract."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


CoordinateSystem = Literal["grid_row_col"]
MissionMode = Literal["compare", "shortest", "terrain_aware"]
RouteMode = Literal["shortest", "terrain_aware"]
ScientificTargetType = Literal[
    "geological_formation",
    "sedimentary_feature",
    "mineralogical_interest",
    "sample_site",
    "observation_site",
    "user_defined",
]
ScientificEvidenceStatus = Literal["verified", "derived", "user_defined", "unverified"]
ScientificGeometryType = Literal["point", "polygon"]
TerrainCoverageStatus = Literal["valid", "nodata", "outside"]


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


class AnalysisWindowModel(BaseModel):
    """A rectangular calculation window in the parent region grid."""

    model_config = ConfigDict(extra="forbid")

    row: int = Field(ge=0)
    col: int = Field(ge=0)
    height: int = Field(gt=0)
    width: int = Field(gt=0)


class MissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    coordinate_system: CoordinateSystem = "grid_row_col"
    start: GridPointModel
    destination: GridPointModel
    mode: MissionMode = "compare"
    terrain_config: TerrainConfigRequest = Field(default_factory=TerrainConfigRequest)
    scientific_target_ids: list[str] = Field(default_factory=list, max_length=16)
    analysis_window: AnalysisWindowModel | None = None


class RouteCalculationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    coordinate_system: CoordinateSystem = "grid_row_col"
    start: GridPointModel
    destination: GridPointModel
    mode: RouteMode
    terrain_config: TerrainConfigRequest = Field(default_factory=TerrainConfigRequest)
    analysis_window: AnalysisWindowModel | None = None

    def as_mission_request(self) -> MissionRequest:
        return MissionRequest(
            region_id=self.region_id,
            coordinate_system=self.coordinate_system,
            start=self.start,
            destination=self.destination,
            mode=self.mode,
            terrain_config=self.terrain_config,
            analysis_window=self.analysis_window,
        )


class TerrainProfileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    grid_path: list[GridPointModel] = Field(min_length=1)
    analysis_window: AnalysisWindowModel | None = None


class TraversabilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    terrain_config: TerrainConfigRequest = Field(default_factory=TerrainConfigRequest)
    analysis_window: AnalysisWindowModel | None = None


class TerrainSampleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str = Field(min_length=1, pattern=r"^[A-Za-z0-9_-]+$")
    point: GridPointModel
    terrain_config: TerrainConfigRequest = Field(default_factory=TerrainConfigRequest)
    analysis_window: AnalysisWindowModel | None = None


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


class ScientificSourceReferenceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mission: str | None = None
    instrument: str | None = None
    dataset: str | None = None
    title: str
    url: str


class ScientificTargetLocationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float | None = None
    longitude: float | None = None
    projected_x: float | None = None
    projected_y: float | None = None
    crs: str | None = None


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
    target_type: ScientificTargetType = "observation_site"
    scientific_objective: str
    scientific_importance: str | None = None
    location: ScientificTargetLocationResponse | None = None
    geometry_type: ScientificGeometryType = "point"
    evidence_status: ScientificEvidenceStatus = "unverified"
    source_references: list[ScientificSourceReferenceResponse] = Field(default_factory=list)
    spatial_resolution_m: float | None = Field(default=None, gt=0.0)
    limitations: list[str] = Field(default_factory=list)
    routable: bool = False


class MissionOverviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mission_id: str
    region_id: str
    generated_at_utc: str
    coordinate_system: CoordinateSystem
    origin: GridPointModel
    destination: GridPointModel
    objective: str
    planning_status: Literal["calculated", "partial"]


class ScientificObjectiveBriefingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_id: str | None
    name: str
    description: str
    scientific_importance: str | None = None
    evidence_status: ScientificEvidenceStatus
    source_references: list[ScientificSourceReferenceResponse] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class TerrainAssessmentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    coverage_status: Literal["complete", "partial"]
    valid_cell_count: int = Field(ge=0)
    nodata_cell_count: int = Field(ge=0)
    resolution_x_m: float = Field(gt=0.0)
    resolution_y_m: float = Field(gt=0.0)
    vertical_datum: str | None = None
    elevation_start_m: float | None = None
    elevation_destination_m: float | None = None
    maximum_route_slope_deg: float = Field(ge=0.0)
    slope_threshold_deg: float = Field(gt=0.0, le=90.0)
    slope_weight: float = Field(ge=0.0)
    traversable_cell_count: int = Field(ge=0)
    non_traversable_cell_count: int = Field(ge=0)
    slope_method: str
    restrictions: list[str] = Field(default_factory=list)


class RouteBriefingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route_id: str
    mode: RouteMode
    metrics: RouteMetricsResponse
    elevation_profile: ElevationProfileResponse
    restrictions: list[str] = Field(default_factory=list)


class RouteTradeoffResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statement: str
    evidence: list[str] = Field(default_factory=list)


class DataProvenanceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str
    role: Literal["map_visual", "dem", "scientific_objective", "algorithm"]
    title: str
    mission: str | None = None
    instrument: str | None = None
    dataset: str | None = None
    url: str | None = None
    processing: str | None = None
    limitations: list[str] = Field(default_factory=list)


class MissionBriefingResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mission_overview: MissionOverviewResponse
    scientific_objectives: list[ScientificObjectiveBriefingResponse] = Field(default_factory=list)
    terrain_assessment: TerrainAssessmentResponse
    route_comparison: list[RouteBriefingResponse] = Field(min_length=1)
    route_tradeoffs: list[RouteTradeoffResponse] = Field(default_factory=list)
    data_provenance: list[DataProvenanceResponse] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


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
    briefing: MissionBriefingResponse | None = None
    analysis_window: AnalysisWindowModel | None = None


class TerrainSampleResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    region_id: str
    point: GridPointModel
    coordinate_system: CoordinateSystem
    map_x_m: float
    map_y_m: float
    coverage_status: TerrainCoverageStatus
    no_data: bool
    elevation_m: float | None = None
    slope_deg: float | None = None
    slope_exceeds_threshold: bool | None = None
    traversable: bool | None = None
    elevation_units: Literal["m"] = "m"
    slope_units: Literal["degrees"] = "degrees"
    pixel_size_x_m: float = Field(gt=0.0)
    pixel_size_y_m: float = Field(gt=0.0)
    source_ids: list[str]
    available_layer_ids: list[str]
    nearby_scientific_targets: list[ScientificTargetResponse] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


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
    "DataProvenanceResponse",
    "ElevationProfileResponse",
    "GridPointModel",
    "MissionBriefingResponse",
    "MissionOverviewResponse",
    "MissionRequest",
    "MissionMode",
    "MissionResponse",
    "RouteCalculationRequest",
    "RouteBriefingResponse",
    "RouteComparisonResponse",
    "RouteMetricsResponse",
    "RouteMode",
    "RouteResponse",
    "RouteTradeoffResponse",
    "ScientificEvidenceStatus",
    "ScientificGeometryType",
    "ScientificObjectiveBriefingResponse",
    "ScientificSourceReferenceResponse",
    "ScientificTargetResponse",
    "ScientificTargetLocationResponse",
    "ScientificTargetType",
    "TerrainConfigRequest",
    "TerrainProfileRequest",
    "TerrainSampleRequest",
    "TerrainSampleResponse",
    "TerrainStatisticsResponse",
    "TerrainCoverageStatus",
    "TraversabilityRequest",
    "TraversabilityResponse",
]
