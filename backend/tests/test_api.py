import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_analyze_sample_chapter():
    response = client.post(
        "/api/v1/chapters/analyze",
        json={
            "url": "sample://manga/chapter-1",
            "source_language": "ja",
            "target_language": "vi"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_images"] > 0
    assert len(data["images"]) > 0

def test_create_and_get_job():
    response = client.post(
        "/api/v1/jobs",
        json={
            "url": "sample://manga/chapter-1",
            "source_language": "ja",
            "target_language": "vi"
        }
    )
    assert response.status_code == 201
    job_id = response.json()["job_id"]
    assert job_id is not None

    # Query status
    status_resp = client.get(f"/api/v1/jobs/{job_id}")
    assert status_resp.status_code == 200
    assert status_resp.json()["job_id"] == job_id
