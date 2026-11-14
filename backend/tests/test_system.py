"""Isolated checks for the minimal Persona 5 system endpoints."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.system.router import create_router


def system_client() -> TestClient:
    application = FastAPI()
    application.include_router(create_router(), prefix="/api")
    return TestClient(application)


def test_health_returns_a_small_json_ok_response() -> None:
    response = system_client().get("/api/health")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert response.json() == {"status": "ok"}


def test_system_info_exposes_public_project_metadata_only() -> None:
    response = system_client().get("/api/system/info")
    payload = response.json()

    assert response.status_code == 200
    assert payload["project"] == "ARES PATH"
    assert payload["version"] == "0.1.0"
    assert payload["challenge"] == "Interplanetary Survival Guide: Martian Map"
    assert payload["status"] == "prototype"
    assert "not operational" in payload["warning"]
    assert set(payload) == {"project", "version", "challenge", "scope", "status", "warning"}
