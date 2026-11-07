"""AL-AI tests for minor-unit schemas, calculations and local write-back.

No Firebase credentials, network access or LLM providers are required.

These tests target the proposed AL-AI Python models. They do not validate
the complete AL-Core Firestore JSON Schema or real Firebase integration.
"""

from copy import deepcopy
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from al_ai_engine.firestore_adapter import InMemoryStore, process_application
from al_ai_engine.mock_service import (
    AssessmentConfig,
    assess,
    effective_apr_bps,
    monthly_repayment,
)
from al_ai_engine.schemas import (
    AssessmentInput,
    AssessmentResponse,
    BerRating,
    Recommendation,
)


FIXED_TIME = datetime(2026, 11, 5, 16, 0, tzinfo=timezone.utc)


@pytest.fixture
def payload():
    """Synthetic property and financial data; no personal identity inputs."""
    return {
        "applicationId": "APP-0001",
        "financialSpecs": {
            "loanAmountMinorUnits": 28_000_000,
            "requestedTermMonths": 300,
            "netMonthlyIncomeMinorUnits": 650_000,
            "monthlyExpensesMinorUnits": 180_000,
            "existingMonthlyDebtMinorUnits": 20_000,
        },
        "propertySpecs": {
            "askingPriceMinorUnits": 35_000_000,
            "berRating": "B2",
            "county": "Dublin",
        },
    }


@pytest.fixture
def application(payload):
    return AssessmentInput.model_validate(payload)


# ----- Input schemas -----


def test_valid_minor_unit_request(payload):
    data = AssessmentInput.model_validate(payload)

    assert data.applicationId == "APP-0001"
    assert data.financialSpecs.loanAmountMinorUnits == 28_000_000
    assert data.financialSpecs.requestedTermMonths == 300
    assert data.propertySpecs.berRating == BerRating.B2


@pytest.mark.parametrize(
    "field",
    [
        "loanAmountMinorUnits",
        "requestedTermMonths",
        "netMonthlyIncomeMinorUnits",
        "monthlyExpensesMinorUnits",
        "existingMonthlyDebtMinorUnits",
    ],
)
def test_missing_required_financial_input_is_rejected(payload, field):
    del payload["financialSpecs"][field]

    with pytest.raises(ValidationError):
        AssessmentInput.model_validate(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("loanAmountMinorUnits", 0),
        ("loanAmountMinorUnits", -1),
        ("loanAmountMinorUnits", 100.5),
        ("requestedTermMonths", -5),
        ("requestedTermMonths", 481),
        ("netMonthlyIncomeMinorUnits", 0),
        ("netMonthlyIncomeMinorUnits", None),
        ("monthlyExpensesMinorUnits", -1),
        ("existingMonthlyDebtMinorUnits", -1),
    ],
)
def test_invalid_financial_values_are_rejected(payload, field, value):
    payload["financialSpecs"][field] = value

    with pytest.raises(ValidationError):
        AssessmentInput.model_validate(payload)


def test_zero_expenses_and_debt_are_valid(payload):
    payload["financialSpecs"]["monthlyExpensesMinorUnits"] = 0
    payload["financialSpecs"]["existingMonthlyDebtMinorUnits"] = 0

    data = AssessmentInput.model_validate(payload)

    assert data.financialSpecs.monthlyExpensesMinorUnits == 0
    assert data.financialSpecs.existingMonthlyDebtMinorUnits == 0


@pytest.mark.parametrize("value", [0, -100])
def test_non_positive_asking_price_is_rejected(payload, value):
    payload["propertySpecs"]["askingPriceMinorUnits"] = value

    with pytest.raises(ValidationError):
        AssessmentInput.model_validate(payload)


def test_unsupported_ber_is_rejected(payload):
    payload["propertySpecs"]["berRating"] = "INVALID"

    with pytest.raises(ValidationError):
        AssessmentInput.model_validate(payload)


def test_unknown_ber_is_supported(payload):
    payload["propertySpecs"]["berRating"] = "UNKNOWN"

    data = AssessmentInput.model_validate(payload)

    assert data.propertySpecs.berRating == BerRating.UNKNOWN


def test_identity_fields_are_excluded_from_model(payload):
    # Current models ignore extra fields. This verifies that they are
    # excluded from the validated assessment input, not rejected by the API.
    payload["borrowerId"] = "synthetic-uid"
    payload["brokerId"] = "synthetic-broker-uid"

    data = AssessmentInput.model_validate(payload).model_dump()

    assert "borrowerId" not in data
    assert "brokerId" not in data


# ----- Financial calculations -----


def test_zero_interest_repayment():
    # 120,000 cents / 12 months = 10,000 cents per month.
    assert monthly_repayment(120_000, 0, 12) == 10_000


def test_zero_interest_repayment_rounds_half_up():
    # 1,206 cents / 12 months = 100.5 cents -> 101 cents.
    assert monthly_repayment(1_206, 0, 12) == 101


def test_positive_interest_increases_repayment():
    zero_interest = monthly_repayment(28_000_000, 0, 300)
    with_interest = monthly_repayment(28_000_000, 350, 300)

    assert isinstance(with_interest, int)
    assert with_interest > zero_interest


def test_higher_interest_increases_repayment():
    assert (
        monthly_repayment(28_000_000, 650, 300)
        > monthly_repayment(28_000_000, 350, 300)
    )


def test_longer_term_reduces_monthly_repayment():
    assert (
        monthly_repayment(28_000_000, 350, 360)
        < monthly_repayment(28_000_000, 350, 240)
    )


@pytest.mark.parametrize("ber", [BerRating.A1, BerRating.A2, BerRating.A3])
def test_eligible_ber_receives_25_bps_discount(ber):
    assert effective_apr_bps(350, ber) == 325


@pytest.mark.parametrize("ber", [BerRating.B2, BerRating.G, BerRating.UNKNOWN])
def test_other_ber_has_no_discount(ber):
    assert effective_apr_bps(350, ber) == 350


def test_ber_discount_cannot_make_rate_negative():
    assert effective_apr_bps(10, BerRating.A1) == 0


# ----- Assessment output and calculation consistency -----


def test_assessment_output_is_marked_as_mock(application):
    result = assess(application, now=FIXED_TIME)

    assert result.isMock is True
    assert result.createdAt == FIXED_TIME
    assert result.modelVersion == "mock-0.2"
    assert result.valuation.modelVersion == result.modelVersion
    assert any("MOCK OUTPUT" in warning for warning in result.warnings)
    assert "human underwriter review" in result.creditMemo


def test_mock_valuation_and_ltv(application):
    result = assess(application, now=FIXED_TIME)

    # Current mock valuation is 97% of the 35,000,000-cent asking price.
    assert result.valuation.estimatedValueMinorUnits == 33_950_000
    assert result.valuation.currency == "EUR"

    # LTV uses the mock estimate here and is rounded to the nearest bps.
    assert result.valuation.ltvBps == 8247


def test_affordability_matches_documented_definitions(application):
    result = assess(application, now=FIXED_TIME)
    fin = application.financialSpecs
    affordability = result.affordability

    repayment = monthly_repayment(
        fin.loanAmountMinorUnits,
        affordability.aprBps,
        fin.requestedTermMonths,
    )

    assert affordability.monthlyRepaymentMinorUnits == repayment
    assert affordability.disposableSurplusMinorUnits == (
        fin.netMonthlyIncomeMinorUnits
        - fin.monthlyExpensesMinorUnits
        - fin.existingMonthlyDebtMinorUnits
        - repayment
    )
    assert affordability.dtiBps == (
        (repayment + fin.existingMonthlyDebtMinorUnits)
        * 10_000
        // fin.netMonthlyIncomeMinorUnits
    )
    assert affordability.loanToIncomeMultiple == 3.59


def test_stress_scenarios_and_surplus(application):
    result = assess(application, now=FIXED_TIME)
    fin = application.financialSpecs
    affordability = result.affordability
    scenarios = affordability.stressTests

    assert [item.rateIncreaseBps for item in scenarios] == [100, 200, 300]

    previous_repayment = affordability.monthlyRepaymentMinorUnits
    previous_surplus = affordability.disposableSurplusMinorUnits

    for item in scenarios:
        assert item.aprBps == affordability.aprBps + item.rateIncreaseBps
        assert item.monthlyRepaymentMinorUnits > previous_repayment
        assert item.disposableSurplusMinorUnits < previous_surplus
        assert item.disposableSurplusMinorUnits == (
            fin.netMonthlyIncomeMinorUnits
            - fin.monthlyExpensesMinorUnits
            - fin.existingMonthlyDebtMinorUnits
            - item.monthlyRepaymentMinorUnits
        )

        previous_repayment = item.monthlyRepaymentMinorUnits
        previous_surplus = item.disposableSurplusMinorUnits


def test_unknown_ber_adds_warning(payload):
    payload["propertySpecs"]["berRating"] = "UNKNOWN"

    result = assess(AssessmentInput.model_validate(payload), now=FIXED_TIME)

    assert result.affordability.aprBps == 350
    assert any("BER rating unknown" in warning for warning in result.warnings)


def test_default_sample_receives_conditional_recommendation(application):
    # Sample LTV is above the current mock conditional threshold of 8,000 bps.
    result = assess(application, now=FIXED_TIME)

    assert result.recommendation == Recommendation.CONDITIONALLY_APPROVE


def test_approval_with_explicit_mock_threshold(application):
    # This is a test configuration, not a regulatory lending policy.
    config = AssessmentConfig(conditional_ltv_bps=9000)

    result = assess(application, cfg=config, now=FIXED_TIME)

    assert result.recommendation == Recommendation.APPROVE


def test_negative_surplus_receives_decline_recommendation(payload):
    payload["financialSpecs"]["monthlyExpensesMinorUnits"] = 650_000

    result = assess(AssessmentInput.model_validate(payload), now=FIXED_TIME)

    assert result.affordability.disposableSurplusMinorUnits < 0
    assert result.recommendation == Recommendation.DECLINE


def test_application_id_does_not_affect_assessment(payload):
    first = AssessmentInput.model_validate(payload)
    payload["applicationId"] = "APP-DIFFERENT"
    second = AssessmentInput.model_validate(payload)

    assert assess(first, now=FIXED_TIME) == assess(second, now=FIXED_TIME)


def test_response_preserves_application_id(application):
    response = AssessmentResponse(
        applicationId=application.applicationId,
        aiAssessment=assess(application, now=FIXED_TIME),
    )

    output = response.model_dump(mode="json")

    assert output["applicationId"] == "APP-0001"
    assert output["aiAssessment"]["isMock"] is True
    assert output["aiAssessment"]["recommendation"] == "CONDITIONALLY_APPROVE"
    assert "applicationId" not in output["aiAssessment"]


# ----- Local adapter: no real Firestore writes -----


def test_local_adapter_writes_assessment_and_advances_status(payload):
    document = deepcopy(payload)
    document["status"] = "APPLIED"
    document["borrowerId"] = "synthetic-uid"

    store = InMemoryStore({"APP-0001": document})

    result = process_application(store, "APP-0001")
    saved = store.get("APP-0001")

    assert result == "assessed"
    assert saved["status"] == "AI_DELIBERATED"
    assert saved["aiAssessment"]["isMock"] is True
    assert saved["aiAssessment"]["createdAt"] is not None
    assert saved["borrowerId"] == "synthetic-uid"
    assert "blockchainTx" not in saved
    assert "underwriterApproval" not in saved
    assert "underwriterDecision" not in saved


def test_invalid_application_is_not_advanced():
    original = {
        "status": "APPLIED",
        "financialSpecs": {},
        "propertySpecs": {},
    }
    store = InMemoryStore({"APP-INVALID": deepcopy(original)})

    result = process_application(store, "APP-INVALID")

    assert result == "invalid"
    assert store.get("APP-INVALID") == original


def test_repeated_local_processing_does_not_replace_assessment(payload):
    document = deepcopy(payload)
    document["status"] = "APPLIED"
    store = InMemoryStore({"APP-0001": document})

    assert process_application(store, "APP-0001") == "assessed"
    first_result = deepcopy(store.get("APP-0001"))

    assert process_application(store, "APP-0001") == "skipped"
    assert store.get("APP-0001") == first_result


@pytest.mark.parametrize(
    "status",
    ["AI_DELIBERATED", "UNDERWRITER_APPROVED", "REJECTED", "FUNDED", "CLOSED"],
)
def test_local_adapter_skips_non_applied_documents(payload, status):
    document = deepcopy(payload)
    document["status"] = status
    store = InMemoryStore({"APP-0001": document})

    assert process_application(store, "APP-0001") == "skipped"
    assert "aiAssessment" not in store.get("APP-0001")


def test_local_adapter_skips_missing_document():
    store = InMemoryStore({})

    assert process_application(store, "APP-MISSING") == "skipped"


def test_local_adapter_preserves_existing_assessment(payload):
    document = deepcopy(payload)
    document["status"] = "APPLIED"
    document["aiAssessment"] = {"creditMemo": "Existing assessment"}
    original = deepcopy(document)
    store = InMemoryStore({"APP-0001": document})

    assert process_application(store, "APP-0001") == "skipped"
    assert store.get("APP-0001") == original