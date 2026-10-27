import json
from pathlib import Path

from fastapi.testclient import TestClient

from al_ai_engine.main import app

client = TestClient(app)
FIXTURE = Path(__file__).parent.parent / "fixtures" / "requests" / "standard_application.json"


def load():
    return json.loads(FIXTURE.read_text())


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_assessment_passes_through_application_id():
    r = client.post("/api/v1/assess-application", json=load())
    assert r.status_code == 200
    body = r.json()
    assert body["application_id"] == "APP-0001"
    assert body["is_mock"] is True
    assert len(body["affordability"]["stress_tests"]) == 3


def test_invalid_term_rejected():
    payload = load()
    payload["loan"]["term_months"] = -5
    assert client.post("/api/v1/assess-application", json=payload).status_code == 422


def test_missing_income_gives_warning():
    payload = load()
    payload["loan"]["net_monthly_income_eur"] = None
    body = client.post("/api/v1/assess-application", json=payload).json()
    assert body["affordability"]["dti_pct"] is None
    assert any("income" in w.lower() for w in body["warnings"])