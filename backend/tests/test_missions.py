"""Mission API integration checks over deterministic synthetic terrain only."""

from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np
from affine import Affine
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.missions.mission_service import MissionService, MissionServiceError
from app.missions.schemas import MissionRequest
from app.missions.scientific_targets import ScientificTarget, ScientificTargetCatalog
from app.nasa_data.schemas import RegionData
from app.api.router import create_api_router
from app.terrain import TerrainAnalyzer


@dataclass
class MemoryRepository:
    region: RegionData
    unavailable: bool = False

    def get_region(self, region_id: str) -> RegionData:
        if self.unavailable:
            raise FileNotFoundError("synthetic DTM unavailable")
        if region_id != self.region.region_id:
            raise KeyError(region_id)
        return self.region

    def list_regions(self) -> list[dict[str, object]]:
        return []

    def get_region_metadata(self, region_id: str) -> dict[str, object]:
        if region_id != self.region.region_id:
            raise KeyError(region_id)
        return {"region_id": region_id, "source_ids": list(self.region.source_ids)}

    def get_available_layers(self, region_id: str) -> list[dict[str, object]]:
        if region_id != self.region.region_id:
            raise KeyError(region_id)
        return []


def synthetic_region() -> RegionData:
    elevation = np.full((10, 10), 100.0, dtype=np.float64)
    return RegionData(
        region_id="synthetic",
        elevation_m=elevation,
        valid_mask=np.ones(elevation.shape, dtype=bool),
        transform=Affine(1, 0, 0, 0, -1, 0),
        crs_wkt="MARS_SYNTHETIC_METRIC",
        pixel_size_x_m=1.0,
        pixel_size_y_m=1.0,
        source_ids=("synthetic-elevation",),
    )


def app_client(
    region: RegionData | None = None,
    *,
    unavailable: bool = False,
) -> TestClient:
    region = region or synthetic_region()
    repository = MemoryRepository(region, unavailable=unavailable)
    target = ScientificTarget(
        target_id="synthetic_context",
        name="Synthetic contextual target",
        region_id="synthetic",
        position=None,
        coordinate_status="contextual_only",
        is_navigable=False,
        mission="Synthetic test fixture",
        instrument="Synthetic instrument",
        source_url="https://example.invalid/synthetic",
        source_ids=("synthetic-source",),
        description="Test-only contextual entry without a fabricated coordinate.",
    )
    service = MissionService(
        repository,
        catalog=ScientificTargetCatalog(targets=(target,)),
    )
    application = FastAPI()
    application.include_router(
        create_api_router(region_repository=repository, mission_service=service)
    )
    return TestClient(application)


def mission_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "region_id": "synthetic",
        "coordinate_system": "grid_row_col",
        "start": {"row": 0, "col": 0},
        "destination": {"row": 9, "col": 9},
        "mode": "compare",
        "terrain_config": {"max_slope_deg": 20.0, "slope_weight": 2.0},
        "scientific_target_ids": ["synthetic_context"],
    }
    payload.update(overrides)
    return payload


def test_mission_plan_returns_two_typed_routes_sources_and_limitations() -> None:
    response = app_client().post("/api/missions/plan", json=mission_payload())

    assert response.status_code == 200
    payload = response.json()
    assert payload["region_id"] == "synthetic"
    assert payload["coordinate_system"] == "grid_row_col"
    assert len(payload["routes"]) == 2
    assert {route["mode"] for route in payload["routes"]} == {"shortest", "terrain_aware"}
    assert payload["routes"][0]["grid_path"][0] == {"row": 0, "col": 0}
    assert payload["routes"][0]["grid_path"][-1] == {"row": 9, "col": 9}
    assert payload["routes"][0]["metrics"]["distance_m"] > 0
    assert payload["data_sources"] == ["synthetic-elevation"]
    assert payload["scientific_targets"][0]["is_navigable"] is False
    assert payload["scientific_targets"][0]["position"] is None
    assert payload["scientific_targets"][0]["source_references"] == []
    assert payload["briefing"]["mission_overview"]["planning_status"] == "calculated"
    assert len(payload["briefing"]["route_comparison"]) == 2
    assert payload["briefing"]["scientific_objectives"][0]["evidence_status"] == "unverified"
    assert any("contextual" in limitation for limitation in payload["limitations"])
    json.dumps(payload, allow_nan=False)


def test_mission_plan_routes_inside_a_selected_window_and_keeps_parent_coordinates() -> None:
    response = app_client().post(
        "/api/missions/plan",
        json=mission_payload(
            start={"row": 2, "col": 3},
            destination={"row": 6, "col": 7},
            scientific_target_ids=[],
            analysis_window={"row": 2, "col": 3, "height": 5, "width": 5},
        ),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["analysis_window"] == {"row": 2, "col": 3, "height": 5, "width": 5}
    assert payload["routes"][0]["grid_path"][0] == {"row": 2, "col": 3}
    assert payload["routes"][0]["grid_path"][-1] == {"row": 6, "col": 7}
    assert payload["briefing"]["route_comparison"][0]["elevation_profile"]["grid_path"][0] == {
        "row": 2,
        "col": 3,
    }
    assert any("selected analysis window" in limitation for limitation in payload["limitations"])


def test_scientific_targets_endpoint_returns_documented_catalog_entries() -> None:
    response = app_client().get("/api/missions/scientific-targets?region_id=synthetic")

    assert response.status_code == 200
    assert response.json()[0]["target_id"] == "synthetic_context"


def test_scientific_target_detail_endpoint_returns_one_catalog_entry() -> None:
    response = app_client().get(
        "/api/missions/scientific-targets/synthetic_context?region_id=synthetic"
    )

    assert response.status_code == 200
    assert response.json()["target_id"] == "synthetic_context"
    assert response.json()["routable"] is False


def test_terrain_sample_endpoint_uses_the_real_region_contract() -> None:
    response = app_client().post(
        "/api/terrain/sample",
        json={
            "region_id": "synthetic",
            "point": {"row": 2, "col": 3},
            "terrain_config": {"max_slope_deg": 20, "slope_weight": 2},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["coverage_status"] == "valid"
    assert payload["elevation_m"] == 100.0
    assert payload["slope_deg"] == 0.0
    assert payload["source_ids"] == ["synthetic-elevation"]


def test_terrain_sample_analyzes_only_the_point_neighborhood(monkeypatch) -> None:
    analyze = TerrainAnalyzer.analyze

    def check_neighborhood(self, region):
        assert region.elevation_m.size <= 9
        return analyze(self, region)

    monkeypatch.setattr(TerrainAnalyzer, "analyze", check_neighborhood)
    response = app_client().post(
        "/api/terrain/sample",
        json={
            "region_id": "synthetic",
            "point": {"row": 0, "col": 0},
            "analysis_window": {"row": 0, "col": 0, "height": 10, "width": 10},
        },
    )

    assert response.status_code == 200
    assert response.json()["slope_deg"] == 0.0


def test_deployment_analysis_area_limit_returns_a_structured_error(monkeypatch) -> None:
    monkeypatch.setenv("ARES_MAX_ANALYSIS_WINDOW_CELLS", "64")
    response = app_client().post(
        "/api/missions/plan",
        json=mission_payload(scientific_target_ids=[]),
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_ANALYSIS_WINDOW"
    assert "64 cells" in response.json()["detail"]["message"]


def test_parallel_mission_is_rejected_before_allocating_another_route() -> None:
    service = MissionService(MemoryRepository(synthetic_region()))
    request = MissionRequest.model_validate(mission_payload(scientific_target_ids=[]))
    assert service._planning_lock.acquire(blocking=False)
    try:
        with pytest.raises(MissionServiceError) as captured:
            service.create_mission_plan(request)
        assert captured.value.code == "MISSION_BUSY"
        assert captured.value.status_code == 503
    finally:
        service._planning_lock.release()


def test_scientific_targets_endpoint_rejects_unknown_region() -> None:
    response = app_client().get("/api/missions/scientific-targets?region_id=does_not_exist")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "REGION_NOT_FOUND"


def test_route_calculation_and_terrain_summary_use_the_same_service() -> None:
    client = app_client()
    route_payload = mission_payload(mode="shortest")
    route_payload.pop("scientific_target_ids")
    route_response = client.post(
        "/api/routes/calculate",
        json=route_payload,
    )
    summary_response = client.get("/api/terrain/synthetic/summary")

    assert route_response.status_code == 200
    assert route_response.json()["mode"] == "shortest"
    assert summary_response.status_code == 200
    assert summary_response.json()["valid_cell_count"] == 100
    assert summary_response.json()["traversable_cell_count"] == 100


def test_missing_region_is_translated_to_the_public_error_envelope() -> None:
    response = app_client().post(
        "/api/missions/plan",
        json=mission_payload(region_id="does_not_exist"),
    )

    assert response.status_code == 404
    assert response.json() == {
        "detail": {
            "code": "REGION_NOT_FOUND",
            "message": "Unknown region: does_not_exist.",
            "details": {"region_id": "does_not_exist"},
        }
    }


def test_out_of_raster_coordinates_return_a_typed_422_error() -> None:
    response = app_client().post(
        "/api/missions/plan",
        json=mission_payload(destination={"row": 99, "col": 99}),
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_ROUTE_INPUT"


def test_unavailable_dtm_returns_503_without_fallback_values() -> None:
    response = app_client(unavailable=True).post(
        "/api/missions/plan",
        json=mission_payload(),
    )

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "DTM_UNAVAILABLE"


def test_inaccessible_destination_returns_no_path() -> None:
    elevation = np.full((5, 5), 100.0, dtype=np.float64)
    elevation[2, :] = np.nan
    blocked_region = RegionData(
        region_id="synthetic",
        elevation_m=elevation,
        valid_mask=np.isfinite(elevation),
        transform=Affine(1, 0, 0, 0, -1, 0),
        crs_wkt="MARS_SYNTHETIC_METRIC",
        pixel_size_x_m=1.0,
        pixel_size_y_m=1.0,
        source_ids=("synthetic-elevation",),
    )

    response = app_client(blocked_region).post(
        "/api/missions/plan",
        json=mission_payload(
            start={"row": 0, "col": 0},
            destination={"row": 4, "col": 4},
            scientific_target_ids=[],
        ),
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "NO_PATH"


def test_non_traversable_endpoint_returns_a_structured_point_error() -> None:
    elevation = np.full((5, 5), 100.0, dtype=np.float64)
    elevation[1, 1] = np.nan
    blocked_region = RegionData(
        region_id="synthetic",
        elevation_m=elevation,
        valid_mask=np.isfinite(elevation),
        transform=Affine(1, 0, 0, 0, -1, 0),
        crs_wkt="MARS_SYNTHETIC_METRIC",
        pixel_size_x_m=1.0,
        pixel_size_y_m=1.0,
        source_ids=("synthetic-elevation",),
    )

    response = app_client(blocked_region).post(
        "/api/missions/plan",
        json=mission_payload(
            start={"row": 1, "col": 1},
            destination={"row": 4, "col": 4},
            scientific_target_ids=[],
        ),
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "NON_TRAVERSABLE_POINT"
    assert detail["details"]["point_affected"] == "start"
    assert detail["details"]["reason"] == "no_data"
    assert detail["details"]["suggestion"]
