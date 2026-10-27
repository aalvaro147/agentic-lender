from .schemas import (
    Affordability, AssessmentRequest, AssessmentResponse,
    Recommendation, StressTest, Valuation,
)

MOCK_MODEL_VERSION = "mock-0.1"


def monthly_repayment(principal: float, annual_rate_pct: float, term_months: int) -> float:
    r = annual_rate_pct / 1200
    if r == 0:
        return principal / term_months
    return principal * r / (1 - (1 + r) ** -term_months)


def assess(req: AssessmentRequest) -> AssessmentResponse:
    p, loan = req.property, req.loan
    warnings: list[str] = ["MOCK RESPONSE: valuation and recommendation are placeholders."]

    # Placeholder valuation: fixed 2% below asking price
    estimated = round(p.asking_price_eur * 0.98, 2)
    ltv = loan.requested_amount_eur / estimated * 100

    payment = monthly_repayment(loan.requested_amount_eur, loan.annual_interest_rate_pct, loan.term_months)
    stress = [
        StressTest(
            rate_increase_bps=bps,
            monthly_repayment_eur=round(
                monthly_repayment(loan.requested_amount_eur,
                                  loan.annual_interest_rate_pct + bps / 100,
                                  loan.term_months), 2),
        )
        for bps in (100, 200, 300)
    ]

    dti = surplus = None
    if loan.net_monthly_income_eur:
        debts = loan.monthly_debt_obligations_eur or 0
        dti = round((payment + debts) / loan.net_monthly_income_eur * 100, 2)
        if loan.monthly_living_expenses_eur is not None:
            surplus = round(loan.net_monthly_income_eur - debts
                            - loan.monthly_living_expenses_eur - payment, 2)
        else:
            warnings.append("Living expenses missing: disposable surplus not calculated.")
    else:
        warnings.append("Net monthly income missing: DTI and surplus not calculated.")

    # Placeholder decision rules
    if ltv > 90:
        rec = Recommendation.DECLINE
    elif ltv > 80 or (dti is not None and dti > 35):
        rec = Recommendation.CONDITIONALLY_APPROVE
    else:
        rec = Recommendation.APPROVE

    memo = (f"[MOCK] LTV {ltv:.1f}%, repayment EUR {payment:,.2f}/month. "
            f"Recommendation: {rec.value}. Qualitative placeholder for human review.")

    return AssessmentResponse(
        application_id=req.application_id,
        recommendation=rec,
        valuation=Valuation(
            estimated_value_eur=estimated,
            asking_price_eur=p.asking_price_eur,
            overvalued=p.asking_price_eur > estimated * 1.05,
            model_version=MOCK_MODEL_VERSION,
        ),
        affordability=Affordability(
            ltv_pct=round(ltv, 2), dti_pct=dti,
            monthly_repayment_eur=round(payment, 2),
            disposable_surplus_eur=surplus, stress_tests=stress,
        ),
        credit_memo=memo,
        warnings=warnings,
        is_mock=True,
    )