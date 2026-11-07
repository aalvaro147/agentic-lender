"""Mock assessment. All financial figures are calculated here in Python.

Valuation and the recommendation rules are placeholders (isMock=True).
Language models will only explain these numbers; they never calculate them.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from .schemas import (
    Affordability, AiAssessment, AssessmentInput, BerRating,
    Recommendation, StressTest, Valuation,
)

MODEL_VERSION = "mock-0.2"
BER_DISCOUNT_BANDS = {BerRating.A1, BerRating.A2, BerRating.A3}
BER_DISCOUNT_BPS = 25  # mirrors the AL-Core contract


@dataclass(frozen=True)
class AssessmentConfig:
    base_apr_bps: int = 350                 # mock assumption, not a market rate
    stress_increases_bps: tuple = (100, 200, 300)
    stress_pass_bps: int = 200              # must stay affordable at this rise
    max_loan_to_income: Decimal = Decimal("4.0")   # placeholder borrowing cap
    max_ltv_bps: int = 9000                 # placeholder
    conditional_ltv_bps: int = 8000         # placeholder
    overvalued_tolerance_pct: int = 5
    mock_value_pct_of_asking: int = 97      # mock "model" output


DEFAULT_CONFIG = AssessmentConfig()


def monthly_repayment(principal: int, apr_bps: int, months: int) -> int:
    """Annuity repayment in minor units, rounded half up."""
    if apr_bps == 0:
        pay = Decimal(principal) / Decimal(months)
    else:
        r = Decimal(apr_bps) / Decimal(10000) / Decimal(12)
        factor = (1 + r) ** months
        pay = Decimal(principal) * r * factor / (factor - 1)
    return int(pay.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def effective_apr_bps(base_bps: int, ber: BerRating) -> int:
    if ber in BER_DISCOUNT_BANDS:
        return max(0, base_bps - BER_DISCOUNT_BPS)
    return base_bps


def _eur(minor: int) -> str:
    return f"EUR {minor / 100:,.2f}"


def assess(
    data: AssessmentInput,
    cfg: AssessmentConfig = DEFAULT_CONFIG,
    now: datetime | None = None,
) -> AiAssessment:
    fin, prop = data.financialSpecs, data.propertySpecs
    warnings = ["MOCK OUTPUT: not a real valuation or lending decision."]

    # Valuation (placeholder) and verified LTV on the lower of asking/estimate
    asking = prop.askingPriceMinorUnits
    estimate = asking * cfg.mock_value_pct_of_asking // 100
    basis = min(asking, estimate)
    ltv_bps = (fin.loanAmountMinorUnits * 10000 + basis // 2) // basis
    overvalued = asking > estimate * (100 + cfg.overvalued_tolerance_pct) / 100
    if overvalued:
        warnings.append("Asking price exceeds estimated value beyond tolerance.")
    if prop.berRating == BerRating.UNKNOWN:
        warnings.append("BER rating unknown: no BER rate discount applied.")

    # Affordability
    apr = effective_apr_bps(cfg.base_apr_bps, prop.berRating)
    term = fin.requestedTermMonths
    income = fin.netMonthlyIncomeMinorUnits
    fixed = fin.monthlyExpensesMinorUnits + fin.existingMonthlyDebtMinorUnits
    repay = monthly_repayment(fin.loanAmountMinorUnits, apr, term)
    surplus = income - fixed - repay
    dti_bps = (repay + fin.existingMonthlyDebtMinorUnits) * 10000 // income
    lti = (Decimal(fin.loanAmountMinorUnits) / Decimal(income * 12)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    stress = []
    for inc in cfg.stress_increases_bps:
        s_apr = apr + inc
        s_pay = monthly_repayment(fin.loanAmountMinorUnits, s_apr, term)
        stress.append(StressTest(
            rateIncreaseBps=inc, aprBps=s_apr,
            monthlyRepaymentMinorUnits=s_pay,
            disposableSurplusMinorUnits=income - fixed - s_pay,
        ))
    pass_test = next(s for s in stress if s.rateIncreaseBps == cfg.stress_pass_bps)

    # Placeholder recommendation rules
    reasons = []
    if surplus < 0:
        reasons.append("negative disposable surplus")
    if lti > cfg.max_loan_to_income:
        reasons.append(f"loan-to-income {lti}x above placeholder cap")
    if ltv_bps > cfg.max_ltv_bps:
        reasons.append("LTV above placeholder maximum")

    conditions = []
    if pass_test.disposableSurplusMinorUnits < 0:
        conditions.append(f"unaffordable at +{cfg.stress_pass_bps} bps")
    if ltv_bps > cfg.conditional_ltv_bps:
        conditions.append("LTV above conditional threshold")
    if overvalued:
        conditions.append("asking price above estimated value")

    if reasons:
        rec, why = Recommendation.DECLINE, reasons
    elif conditions:
        rec, why = Recommendation.CONDITIONALLY_APPROVE, conditions
    else:
        rec, why = Recommendation.APPROVE, ["all placeholder checks passed"]

    memo = (
        f"MOCK credit memo. Qualitative assessment for human underwriter review. "
        f"Recommendation: {rec.value} ({'; '.join(why)}). "
        f"Loan {_eur(fin.loanAmountMinorUnits)} over {term} months at "
        f"{apr / 100:.2f}% APR; repayment {_eur(repay)}/month; "
        f"LTV {ltv_bps / 100:.2f}%; DTI {dti_bps / 100:.2f}%; "
        f"disposable surplus {_eur(surplus)}/month."
    )

    return AiAssessment(
        recommendation=rec,
        createdAt=now or datetime.now(timezone.utc),
        modelVersion=MODEL_VERSION,
        valuation=Valuation(
            estimatedValueMinorUnits=estimate,
            modelVersion=MODEL_VERSION,
            ltvBps=ltv_bps,
        ),
        affordability=Affordability(
            aprBps=apr,
            monthlyRepaymentMinorUnits=repay,
            dtiBps=dti_bps,
            disposableSurplusMinorUnits=surplus,
            loanToIncomeMultiple=float(lti),
            stressTests=stress,
            assumptions=[
                f"Base APR {cfg.base_apr_bps} bps (mock assumption).",
                f"BER A1-A3 discount of {BER_DISCOUNT_BPS} bps applied.",
                "DTI = (new repayment + existing debt) / net monthly income.",
                "Surplus = income - expenses - existing debt - repayment.",
                "Borrowing cap and LTV limits are placeholders, not regulatory rules.",
            ],
        ),
        creditMemo=memo,
        warnings=warnings,
    )