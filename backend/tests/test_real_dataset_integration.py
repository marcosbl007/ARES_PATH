"""Public HTTP smoke tests against the versioned Jezero raster assets."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from app.main import AppSettings, create_app


DATA_ROOT = Path(__file__).resolve().parents[1] / "data"
REGION_ID = "jezero_fan_256"
HIRISE_REGION_IDS = (
    "jezero_fan_512",
    "jezero_fan_1024",
    "jezero_fan_2048",
)
CTX_REGION_IDS = (
    "jezero_ctx_northwest_20m",
    "jezero_ctx_northeast_20m",
    "jezero_ctx_southwest_20m",
    "jezero_ctx_southeast_20m",
)


def real_client() -> TestClient:
    return TestClient(create_app(settings=AppSettings(data_root=DATA_ROOT)))


def test_real_dataset_serves_metadata_binary_assets_and_routes() -> None:
    client = real_client()

    health = client.get("/api/health")
    regions = client.get("/api/data/regions")
    metadata = client.get(f"/api/data/regions/{REGION_ID}")
    layers = client.get(f"/api/data/regions/{REGION_ID}/layers")

    assert health.status_code == 200
    assert regions.status_code == 200
    assert REGION_ID in {region["region_id"] for region in regions.json()}
    assert metadata.status_code == 200
    assert metadata.json()["shape"] == [256, 256]
    assert layers.status_code == 200
    assert {layer["layer_id"] for layer in layers.json()} == {"elevation", "orthoimage", "slope"}

    preview = client.get(f"/api/data/regions/{REGION_ID}/layers/elevation/preview.png")
    slope_preview = client.get(f"/api/data/regions/{REGION_ID}/layers/slope/preview.png")
    terrain_sample = client.post(
        "/api/terrain/sample",
        json={
            "region_id": REGION_ID,
            "point": {"row": 10, "col": 20},
            "terrain_config": {"max_slope_deg": 20, "slope_weight": 2},
        },
    )
    raster = client.get(f"/api/data/regions/{REGION_ID}/layers/elevation/raster")
    mission = client.post(
        "/api/missions/plan",
        json={
            "region_id": REGION_ID,
            "coordinate_system": "grid_row_col",
            "start": {"row": 10, "col": 20},
            "destination": {"row": 80, "col": 65},
            "mode": "compare",
            "terrain_config": {"max_slope_deg": 20, "slope_weight": 2},
            "scientific_target_ids": [],
            "analysis_window": {"row": 0, "col": 0, "height": 128, "width": 128},
        },
    )

    assert preview.status_code == 200
    assert preview.headers["content-type"].startswith("image/png")
    assert slope_preview.status_code == 200
    assert slope_preview.headers["content-type"].startswith("image/png")
    assert terrain_sample.status_code == 200
    assert terrain_sample.json()["elevation_m"] is not None
    assert terrain_sample.json()["slope_deg"] is not None
    assert raster.status_code == 200
    assert raster.headers["content-type"].startswith("image/tiff")
    assert mission.status_code == 200
    payload = mission.json()
    assert len(payload["routes"]) == 2
    assert {route["mode"] for route in payload["routes"]} == {"shortest", "terrain_aware"}
    assert payload["data_sources"] == ["DTEEC_002387_1985_003798_1985_A01"]
    assert payload["briefing"]["terrain_assessment"]["resolution_x_m"] > 0
    assert len(payload["briefing"]["route_comparison"]) == 2
    assert payload["briefing"]["scientific_objectives"][0]["evidence_status"] == "user_defined"


@pytest.mark.parametrize("region_id", HIRISE_REGION_IDS)
def test_hirise_region_variants_can_serve_routes(region_id: str) -> None:
    client = real_client()
    metadata = client.get(f"/api/data/regions/{region_id}")
    mission = client.post(
        "/api/missions/plan",
        json={
            "region_id": region_id,
            "coordinate_system": "grid_row_col",
            "start": {"row": 40, "col": 40},
            "destination": {"row": 80, "col": 80},
            "mode": "compare",
            "terrain_config": {"max_slope_deg": 20, "slope_weight": 2},
            "scientific_target_ids": [],
            "analysis_window": {"row": 0, "col": 0, "height": 128, "width": 128},
        },
    )

    assert metadata.status_code == 200
    assert metadata.json()["shape"] in ([512, 512], [1024, 1024], [2048, 2048])
    assert mission.status_code == 200
    assert len(mission.json()["routes"]) == 2


@pytest.mark.parametrize("region_id", CTX_REGION_IDS)
def test_ctx_mosaic_region_serves_aligned_layers_and_routes(region_id: str) -> None:
    client = real_client()

    metadata = client.get(f"/api/data/regions/{region_id}")
    layers = client.get(f"/api/data/regions/{region_id}/layers")
    ortho_metadata = client.get(
        f"/api/data/regions/{region_id}/layers/orthoimage/metadata"
    )
    mission = client.post(
        "/api/missions/plan",
        json={
            "region_id": region_id,
            "coordinate_system": "grid_row_col",
            "start": {"row": 850, "col": 700},
            "destination": {"row": 950, "col": 800},
            "mode": "compare",
            "terrain_config": {"max_slope_deg": 20, "slope_weight": 2},
            "scientific_target_ids": [],
            "analysis_window": {"row": 753, "col": 598, "height": 1024, "width": 1024},
        },
    )

    assert metadata.status_code == 200
    assert metadata.json()["shape"] == [2530, 2221]
    assert metadata.json()["source_ids"] == ["MARS2020_CTX_JEZERO_DTM_20M"]
    assert layers.status_code == 200
    assert {layer["layer_id"] for layer in layers.json()} == {"elevation", "orthoimage", "slope"}
    assert ortho_metadata.status_code == 200
    assert ortho_metadata.json()["source_ids"] == ["MARS2020_CTX_JEZERO_ORTHO_5M"]
    assert mission.status_code == 200
    assert mission.json()["analysis_window"] == {
        "row": 753,
        "col": 598,
        "height": 1024,
        "width": 1024,
    }
    assert len(mission.json()["routes"]) == 2


def test_ctx_mosaic_can_route_on_the_full_selected_region() -> None:
    client = real_client()
    response = client.post(
        "/api/missions/plan",
        json={
            "region_id": "jezero_ctx_northwest_20m",
            "coordinate_system": "grid_row_col",
            "start": {"row": 1265, "col": 1110},
            "destination": {"row": 1300, "col": 1150},
            "mode": "compare",
            "terrain_config": {"max_slope_deg": 20, "slope_weight": 2},
            "scientific_target_ids": [],
        },
    )

    assert response.status_code == 200
    assert len(response.json()["routes"]) == 2
