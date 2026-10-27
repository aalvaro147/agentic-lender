from enum import Enum
from pydantic import BaseModel, Field


class PropertyType(str, Enum):
    DETACHED = "detached"
    SEMI_DETACHED = "semi_detached"
    TERRACED = "terraced"
    APARTMENT = "apartment"


class PropertyData(BaseModel):
    property_type: PropertyType
    county: str = Field(min_length=2)
    bedrooms: int = Field(ge=0, le=20)
    bathrooms: int = Field(ge=0, le=20)
    floor_area_sqm: float = Field(gt=0)
    ber_rating: str | None = Field(default=None, description="e.g. A1, C2, G")
    year_built: int | None = Field(default=None, ge=1600, le=2100)
    asking_price_eur: float = Field(gt=0)


class LoanData(BaseModel):
    requested_amount_eur: float = Field(gt=0)
    term_months: int = Field(ge=12, le=480)
    annual_interest_rate_pct: float = Field(ge=0, le=30)
    # Optional until agreed with AL-Core / AL-Mobile
    net_monthly_income_eur: float | None = Field(default=None, ge=0)
    monthly_debt_obligations_eur: float | None = Field(default=None, ge=0)
    monthly_living_expenses_eur: float | None = Field(default=None, ge=0)


class AssessmentRequest(BaseModel):
    application_id: str = Field(min_length=1, description="Pass-through only; not used in analysis")
    property: PropertyData
    loan: LoanData


class Recommendation(str, Enum):
    APPROVE = "APPROVE"
    CONDITIONALLY_APPROVE = "CONDITIONALLY_APPROVE"
    DECLINE = "DECLINE"


class Valuation(BaseModel):
    estimated_value_eur: float
    asking_price_eur: float
    overvalued: bool
    model_version: str


class StressTest(BaseModel):
    rate_increase_bps: int
    monthly_repayment_eur: float


class Affordability(BaseModel):
    ltv_pct: float
    dti_pct: float | None
    monthly_repayment_eur: float
    disposable_surplus_eur: float | None
    stress_tests: list[StressTest]


class AssessmentResponse(BaseModel):
    application_id: str
    recommendation: Recommendation
    valuation: Valuation
    affordability: Affordability
    credit_memo: str
    warnings: list[str]
    is_mock: bool