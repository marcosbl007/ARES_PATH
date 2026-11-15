"""Deterministic mission briefing assembly from verified backend metrics."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np

from app.nasa_data.mars_trek import get_verified_mars_trek_layers
from app.routing.schemas import RouteComparison, RouteResult
from app.terrain.elevation import calculate_elevation_profile

from .schemas import (
    DataProvenanceResponse,
    ElevationProfileResponse,
    GridPointModel,
    MissionBriefingResponse,
    MissionOverviewResponse,
    MissionRequest,
    RouteBriefingResponse,
    RouteMetricsResponse,
    RouteTradeoffResponse,
    ScientificObjectiveBriefingResponse,
    ScientificSourceReferenceResponse,
    TerrainAssessmentResponse,
)
from .scientific_targets import ScientificTarget


def _source_reference_models(target: ScientificTarget) -> list[ScientificSourceReferenceResponse]:
    return [
        ScientificSourceReferenceResponse(
            mission=reference.mission,
            instrument=reference.instrument,
            dataset=reference.dataset,
            title=reference.title,
            url=reference.url,
        )
        for reference in target.source_references
    ]


def _profile_response(
    region: Any,
    route: RouteResult,
    *,
    grid_offset: tuple[int, int] = (0, 0),
) -> ElevationProfileResponse:
    profile = calculate_elevation_profile(region, route.grid_path)
    row_offset, col_offset = grid_offset
    return ElevationProfileResponse(
        grid_path=[
            GridPointModel(row=row + row_offset, col=col + col_offset)
            for row, col in profile.grid_path
        ],
        cumulative_distance_m=list(profile.cumulative_distance_m),
        elevation_m=list(profile.elevation_m),
        distance_m=float(profile.distance_m),
        ascent_m=float(profile.ascent_m),
        descent_m=float(profile.descent_m),
        max_slope_deg=float(profile.max_slope_deg),
    )


def _objective_summaries(
    request: MissionRequest,
    targets: list[ScientificTarget],
) -> list[ScientificObjectiveBriefingResponse]:
    if not targets:
        return [
            ScientificObjectiveBriefingResponse(
                target_id=None,
                name="User-defined observation point",
                description=(
                    "Evaluate a user-selected raster cell as an observation destination. "
                    "This is a planning input, not a certified scientific site."
                ),
                scientific_importance=None,
                evidence_status="user_defined",
                source_references=[],
                limitations=[
                    "No NASA scientific target was selected for this mission.",
                    f"Destination is the user-defined cell R{request.destination.row} C{request.destination.col}.",
                ],
            )
        ]

    return [
        ScientificObjectiveBriefingResponse(
            target_id=target.target_id,
            name=target.name,
            description=target.description,
            scientific_importance=target.scientific_importance,
            evidence_status=(
                target.evidence_status  # type: ignore[arg-type]
                if target.evidence_status in {"verified", "derived", "user_defined", "unverified"}
                else "unverified"
            ),
            source_references=_source_reference_models(target),
            limitations=list(target.limitations),
        )
        for target in targets
    ]


def _provenance(
    region: Any,
    targets: list[ScientificTarget],
    methodology_version: str,
) -> list[DataProvenanceResponse]:
    entries: list[DataProvenanceResponse] = []
    source = region.metadata.get("source", {}) if isinstance(region.metadata, dict) else {}
    if not isinstance(source, dict):
        source = {}
    height, width = region.elevation_m.shape
    source_id = (region.source_ids[0] if region.source_ids else "local-dem")
    entries.append(
        DataProvenanceResponse(
            source_id=source_id,
            role="dem",
            title=str(source.get("title", "Processed Mars elevation model")),
            mission=source.get("mission"),
            instrument=source.get("instrument"),
            dataset=source.get("dataset_id"),
            url=source.get("official_page"),
            processing=(
                f"Local processed GeoTIFF; {region.metadata.get('resampling', 'metadata-defined')} "
                f"resampling; {region.metadata.get('coordinate_system', 'grid_row_col')} contract."
            ),
            limitations=[
                f"The DTM is a local {width} x {height} computational window.",
                "Elevation is referenced to the source Mars vertical datum when documented.",
            ],
        )
    )

    ortho_source = region.metadata.get("ortho_source", {}) if isinstance(region.metadata, dict) else {}
    if isinstance(ortho_source, dict) and ortho_source:
        entries.append(
            DataProvenanceResponse(
                source_id=str(ortho_source.get("product_id", "local-orthoimage")),
                role="map_visual",
                title=str(ortho_source.get("product_id", "HiRISE orthoimage")),
                mission=ortho_source.get("mission"),
                instrument=ortho_source.get("instrument"),
                dataset=ortho_source.get("associated_dtm"),
                url=ortho_source.get("official_page"),
                processing="Grid-registered local display raster; DN values are visual context only.",
                limitations=[
                    "The optical image is not used as an elevation or slope measurement.",
                    "Its local alignment is documented separately from the remote WMTS layers.",
                ],
            )
        )

    for layer in get_verified_mars_trek_layers():
        entries.append(
            DataProvenanceResponse(
                source_id=str(layer["layer_id"]),
                role="map_visual",
                title=str(layer["title"]),
                mission=str(layer["mission"]),
                instrument=str(layer["instrument"]),
                url=str(layer["source_url"]),
                processing="Remote NASA Mars Trek WMTS visual layer.",
                limitations=[
                    "Remote visual context only; not used by A* or terrain measurements.",
                    "Alignment with the local DTM is not asserted by this response.",
                ],
            )
        )

    for target in targets:
        for source_reference in target.source_references:
            entries.append(
                DataProvenanceResponse(
                    source_id=(target.source_ids[0] if target.source_ids else target.target_id),
                    role="scientific_objective",
                    title=source_reference.title,
                    mission=source_reference.mission,
                    instrument=source_reference.instrument,
                    dataset=source_reference.dataset,
                    url=source_reference.url,
                    processing="Catalog reference returned by the mission-planning API.",
                    limitations=list(target.limitations),
                )
            )

    entries.append(
        DataProvenanceResponse(
            source_id="ares-path-routing",
            role="algorithm",
            title="ARES PATH deterministic route comparison",
            dataset=methodology_version,
            processing="8-connected A* over the validated elevation-derived traversability grid.",
            limitations=[
                "Terrain-aware cost is an exploratory criterion, not an operational safety score.",
                "No atmospheric, thermal, biological or real-time obstacle data are included.",
            ],
        )
    )
    return entries


def _tradeoffs(comparison: RouteComparison | None) -> list[RouteTradeoffResponse]:
    if comparison is None:
        return [
            RouteTradeoffResponse(
                statement="Only one route mode was requested; no alternative trade-off was calculated.",
                evidence=[],
            )
        ]

    if comparison.same_path:
        return [
            RouteTradeoffResponse(
                statement="Both planning modes returned the same grid path for this request.",
                evidence=["same_path=true"],
            )
        ]

    statements: list[RouteTradeoffResponse] = []
    distance = comparison.distance_delta_m
    if abs(distance) > 1e-9:
        relation = "longer" if distance > 0 else "shorter"
        statements.append(
            RouteTradeoffResponse(
                statement=(
                    f"The terrain-aware route is {abs(distance):.3f} m {relation} than the shortest route."
                ),
                evidence=[f"distance_delta_m={distance:.6f}"],
            )
        )

    slope = comparison.max_slope_delta_deg
    if abs(slope) > 1e-9:
        relation = "lower" if slope < 0 else "higher"
        statements.append(
            RouteTradeoffResponse(
                statement=(
                    f"The terrain-aware route has a {abs(slope):.3f} degree {relation} maximum sampled slope."
                ),
                evidence=[f"max_slope_delta_deg={slope:.6f}"],
            )
        )

    if comparison.cost_comparable is False:
        statements.append(
            RouteTradeoffResponse(
                statement="Route costs are not directly compared because the two modes optimize different objectives.",
                evidence=["cost_comparable=false"],
            )
        )
    return statements


def build_mission_briefing(
    request: MissionRequest,
    region: Any,
    terrain: Any,
    routes: list[RouteResult],
    comparison: RouteComparison | None,
    targets: list[ScientificTarget],
    *,
    methodology_version: str,
    limitations: list[str],
    grid_offset: tuple[int, int] = (0, 0),
) -> MissionBriefingResponse:
    profiles = [
        _profile_response(region, route, grid_offset=grid_offset)
        for route in routes
    ]
    valid_count = int(np.count_nonzero(region.valid_mask))
    total_count = int(region.valid_mask.size)
    traversable_count = int(np.count_nonzero(terrain.traversable))
    non_traversable_count = max(valid_count - traversable_count, 0)
    maximum_route_slope = max(route.metrics.max_slope_deg for route in routes)
    source = region.metadata.get("source", {}) if isinstance(region.metadata, dict) else {}
    vertical_datum = source.get("vertical_datum") if isinstance(source, dict) else None
    restrictions: list[str] = []
    if non_traversable_count:
        restrictions.append(
            f"{non_traversable_count} valid cells are excluded by the configured terrain mask."
        )
    if total_count > valid_count:
        restrictions.append(f"{total_count - valid_count} cells have no valid elevation value.")
    if not restrictions:
        restrictions.append("No cells were excluded by the configured terrain mask in this region.")

    route_briefings = [
        RouteBriefingResponse(
            route_id=route.route_id,
            mode=route.mode,
            metrics=RouteMetricsResponse(
                distance_m=route.metrics.distance_m,
                ascent_m=route.metrics.ascent_m,
                descent_m=route.metrics.descent_m,
                max_slope_deg=route.metrics.max_slope_deg,
                cost=route.metrics.cost,
                cell_count=route.metrics.cell_count,
            ),
            elevation_profile=profile,
            restrictions=list(restrictions),
        )
        for route, profile in zip(routes, profiles, strict=True)
    ]

    objective_name = (
        targets[0].name if targets else "User-defined observation point"
    )
    briefing_limitations = list(dict.fromkeys([*limitations, *[
        limitation for target in targets for limitation in target.limitations
    ]]))
    mission_id = "mission-placeholder"
    # The deterministic ID is injected by the serializer after this function
    # is called. The placeholder is never returned to clients.
    return MissionBriefingResponse(
        mission_overview=MissionOverviewResponse(
            mission_id=mission_id,
            region_id=request.region_id,
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
            coordinate_system=request.coordinate_system,
            origin=GridPointModel(row=request.start.row, col=request.start.col),
            destination=GridPointModel(row=request.destination.row, col=request.destination.col),
            objective=objective_name,
            planning_status="calculated",
        ),
        scientific_objectives=_objective_summaries(request, targets),
        terrain_assessment=TerrainAssessmentResponse(
            coverage_status="complete" if valid_count == total_count else "partial",
            valid_cell_count=valid_count,
            nodata_cell_count=total_count - valid_count,
            resolution_x_m=float(region.pixel_size_x_m),
            resolution_y_m=float(region.pixel_size_y_m),
            vertical_datum=vertical_datum,
            elevation_start_m=profiles[0].elevation_m[0] if profiles else None,
            elevation_destination_m=profiles[0].elevation_m[-1] if profiles else None,
            maximum_route_slope_deg=float(maximum_route_slope),
            slope_threshold_deg=float(request.terrain_config.max_slope_deg),
            slope_weight=float(request.terrain_config.slope_weight),
            traversable_cell_count=traversable_count,
            non_traversable_cell_count=non_traversable_count,
            slope_method=(
                "Finite differences on the validated elevation grid; "
                "row and column derivatives use the raster metre spacing."
            ),
            restrictions=restrictions,
        ),
        route_comparison=route_briefings,
        route_tradeoffs=_tradeoffs(comparison),
        data_provenance=_provenance(region, targets, methodology_version),
        limitations=briefing_limitations,
    )


def set_briefing_mission_id(briefing: MissionBriefingResponse, mission_id: str) -> MissionBriefingResponse:
    """Replace the temporary ID without mutating a Pydantic response object."""

    return briefing.model_copy(
        update={
            "mission_overview": briefing.mission_overview.model_copy(
                update={"mission_id": mission_id}
            )
        }
    )


__all__ = ["build_mission_briefing", "set_briefing_mission_id"]
