from typing import Any

import pytest
from fastapi.testclient import TestClient
from web3 import Web3

import api.main as core_api
from api.main import Services, create_app
from api.schemas import SettlementRequest


class FakeSnapshot:
    def __init__(self, data: dict[str, Any]) -> None:
        self.exists = True
        self._data = data

    def to_dict(self) -> dict[str, Any]:
        return self._data


class FakeDocument:
    def __init__(self, data: dict[str, Any]) -> None:
        self._data = data

    def get(self) -> FakeSnapshot:
        return FakeSnapshot(self._data)

    def update(self, values: dict[str, Any]) -> None:
        self._data.update(values)


class FakeCollection:
    def __init__(self, data: dict[str, dict[str, Any]]) -> None:
        self._data = data

    def document(self, document_id: str) -> FakeDocument:
        return FakeDocument(self._data.setdefault(document_id, {}))


class FakeBatch:
    def update(self, document: FakeDocument, values: dict[str, Any]) -> None:
        document.update(values)

    def set(self, document: FakeDocument, values: dict[str, Any], merge: bool = False) -> None:
        document.update(values)

    def commit(self) -> None:
        return None


class FakeDatabase:
    def __init__(self, applications: dict[str, dict[str, Any]]) -> None:
        self._applications = applications

    def collection(self, name: str) -> FakeCollection:
        if name == "applications":
            return FakeCollection(self._applications)
        assert name == "audit_logs"
        return FakeCollection({})

    def batch(self) -> FakeBatch:
        return FakeBatch()


def build_client(
    claims_by_token: dict[str, dict[str, str]],
    applications: dict[str, dict[str, Any]],
) -> TestClient:
    def verify_id_token(token: str) -> dict[str, Any]:
        if token not in claims_by_token:
            raise ValueError("Invalid test token")
        return claims_by_token[token]

    services = Services(
        db=FakeDatabase(applications),
        web3=Web3(),
        audit_registry=None,
        loan_token=None,
        sender_address="0x1111111111111111111111111111111111111111",
        borrower_hash_secret="test-secret-with-more-than-32-bytes",
        evm_private_key=None,
        verify_id_token=verify_id_token,
    )
    return TestClient(create_app(services))


def test_health_is_public_and_does_not_expose_service_configuration() -> None:
    client = build_client({}, {})

    with client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settlement_read_is_scoped_to_owner_or_assigned_broker() -> None:
    client = build_client(
        {
            "borrower-token": {"uid": "borrower-1", "role": "borrower"},
            "other-borrower-token": {"uid": "borrower-2", "role": "borrower"},
            "broker-token": {"uid": "broker-1", "role": "broker"},
        },
        {
            "APP-1": {
                "borrowerId": "borrower-1",
                "brokerId": "broker-1",
                "status": "AI_DELIBERATED",
                "blockchainTx": None,
            }
        },
    )

    with client:
        own_response = client.get(
            "/v1/applications/APP-1/settlement",
            headers={"Authorization": "Bearer borrower-token"},
        )
        assigned_response = client.get(
            "/v1/applications/APP-1/settlement",
            headers={"Authorization": "Bearer broker-token"},
        )
        denied_response = client.get(
            "/v1/applications/APP-1/settlement",
            headers={"Authorization": "Bearer other-borrower-token"},
        )
        missing_token_response = client.get("/v1/applications/APP-1/settlement")

    assert own_response.status_code == 200
    assert own_response.json()["status"] == "AI_DELIBERATED"
    assert assigned_response.status_code == 200
    assert denied_response.status_code == 403
    assert missing_token_response.status_code == 401


def test_settlement_request_uses_camel_case_contract_and_rejects_bad_ber() -> None:
    request_data = {
        "approvedAt": "2026-11-05T16:00:00Z",
        "creditMemo": "Approved after review.",
        "valuation": {"estimatedValueMinorUnits": 42000000, "currency": "EUR"},
        "loan": {
            "principalMinorUnits": 35000000,
            "baseAprBps": 350,
            "termMonths": 360,
            "berRating": "A2",
            "recipientAddress": "0x1111111111111111111111111111111111111111",
        },
    }

    parsed = SettlementRequest.model_validate(request_data)
    assert parsed.loan.ber_rating == "A2"
    assert parsed.loan.recipient_address == "0x1111111111111111111111111111111111111111"

    request_data["loan"]["berRating"] = "NOT-A-BER"
    with pytest.raises(ValueError):
        SettlementRequest.model_validate(request_data)


def test_only_underwriters_can_submit_settlement() -> None:
    client = build_client(
        {
            "underwriter-token": {"uid": "underwriter-1", "role": "underwriter"},
            "borrower-token": {"uid": "borrower-1", "role": "borrower"},
        },
        {
            "APP-1": {
                "borrowerId": "borrower-1",
                "status": "AI_DELIBERATED",
                "blockchainTx": None,
            }
        },
    )
    request_data = {
        "approvedAt": "2026-11-05T16:00:00Z",
        "creditMemo": "Approved after review.",
        "valuation": {"estimatedValueMinorUnits": 42000000, "currency": "EUR"},
        "loan": {
            "principalMinorUnits": 35000000,
            "baseAprBps": 350,
            "termMonths": 360,
            "berRating": "A2",
            "recipientAddress": "0x1111111111111111111111111111111111111111",
        },
    }

    with client:
        response = client.post(
            "/v1/applications/APP-1/settlement",
            headers={"Authorization": "Bearer borrower-token"},
            json=request_data,
        )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "UNDERWRITER_REQUIRED"


def test_underwriter_submission_returns_confirmed_ledger_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = build_client(
        {"underwriter-token": {"uid": "underwriter-1", "role": "underwriter"}},
        {
            "APP-1": {
                "borrowerId": "borrower-1",
                "status": "AI_DELIBERATED",
                "blockchainTx": None,
            }
        },
    )
    monkeypatch.setattr(
        core_api,
        "_reserve_approval",
        lambda *args: {"alreadySettled": False},
    )
    monkeypatch.setattr(
        core_api,
        "_settle_on_chain",
        lambda *args: {
            "status": "CONFIRMED",
            "chainId": 31337,
            "auditHash": f"0x{'a' * 64}",
            "applicationIdHash": f"0x{'b' * 64}",
            "tokenId": "42",
            "auditTxHash": f"0x{'c' * 64}",
            "loanTxHash": f"0x{'d' * 64}",
            "blockNumber": 12,
        },
    )
    request_data = {
        "approvedAt": "2026-11-05T16:00:00Z",
        "creditMemo": "Approved after review.",
        "valuation": {"estimatedValueMinorUnits": 42000000, "currency": "EUR"},
        "loan": {
            "principalMinorUnits": 35000000,
            "baseAprBps": 350,
            "termMonths": 360,
            "berRating": "A2",
            "recipientAddress": "0x1111111111111111111111111111111111111111",
        },
    }

    with client:
        response = client.post(
            "/v1/applications/APP-1/settlement",
            headers={"Authorization": "Bearer underwriter-token"},
            json=request_data,
        )

    assert response.status_code == 200
    assert response.json()["status"] == "CONFIRMED"
    assert response.json()["chainId"] == 31337


def test_underwriter_can_record_an_idempotent_rejection(monkeypatch: pytest.MonkeyPatch) -> None:
    client = build_client(
        {"underwriter-token": {"uid": "underwriter-1", "role": "underwriter"}},
        {},
    )
    monkeypatch.setattr(core_api, "_reserve_rejection", lambda *args: True)

    with client:
        response = client.post(
            "/v1/applications/APP-1/rejection",
            headers={"Authorization": "Bearer underwriter-token"},
            json={
                "rejectedAt": "2026-11-05T16:00:00Z",
                "reason": "The verified affordability assessment does not meet the lending criteria.",
            },
        )

    assert response.status_code == 200
    assert response.json()["status"] == "REJECTED"
    assert response.json()["idempotentRetry"] is True


def test_openapi_exposes_all_core_integration_routes() -> None:
    client = build_client({}, {})

    with client:
        openapi = client.get("/openapi.json").json()

    assert set(openapi["paths"]) == {
        "/health",
        "/v1/applications/{application_id}/settlement",
        "/v1/applications/{application_id}/rejection",
    }
    assert "SettlementRequest" in openapi["components"]["schemas"]
    assert "RejectionRequest" in openapi["components"]["schemas"]
