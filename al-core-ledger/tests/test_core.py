import pytest

from api.core import canonical_sha256, pseudonymous_borrower_hash, stable_token_id


def test_canonical_hash_is_independent_of_object_key_order() -> None:
    first = {"applicationId": "APP-1", "valuation": {"currency": "EUR", "value": 250000}}
    second = {"valuation": {"value": 250000, "currency": "EUR"}, "applicationId": "APP-1"}

    assert canonical_sha256(first) == canonical_sha256(second)


def test_canonical_hash_changes_when_approval_data_changes() -> None:
    first = {"applicationId": "APP-1", "decision": "APPROVED"}
    second = {"applicationId": "APP-1", "decision": "REJECTED"}

    assert canonical_sha256(first) != canonical_sha256(second)


def test_canonical_hash_rejects_non_json_float_values() -> None:
    with pytest.raises(ValueError):
        canonical_sha256({"valuation": float("nan")})


def test_borrower_hash_is_stable_and_requires_a_secret() -> None:
    secret = "local-development-secret-with-32-bytes-minimum"
    first = pseudonymous_borrower_hash("firebase-uid-1", secret)

    assert first == pseudonymous_borrower_hash("firebase-uid-1", secret)
    assert first != pseudonymous_borrower_hash("firebase-uid-2", secret)
    assert len(first) == 32
    with pytest.raises(ValueError):
        pseudonymous_borrower_hash("firebase-uid-1", "too-short")


def test_token_id_is_stable_and_derived_from_application_id() -> None:
    assert stable_token_id("APP-10042") == stable_token_id("APP-10042")
    assert stable_token_id("APP-10042") != stable_token_id("APP-10043")
    assert 0 <= stable_token_id("APP-10042") < 2**256
