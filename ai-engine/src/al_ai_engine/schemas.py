"""AL-AI schemas aligned with the AL-Core Firestore contract.

Amounts are integer minor units (cents), rates are basis points and terms are
months. Identity fields (borrowerId, brokerId, names) are deliberately absent:
the engine never reads them. The Firestore document ID is the application ID.
"""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Recommendation(str, Enum):
    APPROVE = "APPROVE"
    CONDITIONALLY_APPROVE = "CONDITIONALLY_APPROVE"
    DECLINE = "DECLINE"


class BerRating(str, Enum):
    A1 = "A1"
    A2 = "A2"
    A3 = "A3"
    B1 = "B1"
    B2 = "B2"
    B3 = "B3"
    C1 = "C1"
    C2 = "C2"
    C3 = "C3"
    D1 = "D1"
    D2 = "D2"
    E1 = "E1"
    E2 = "E2"
    F = "F"
    G = "G"
    UNKNOWN = "UNKNOWN"


# ---------- Input (read from applications/{applicationId}) ----------
class FinancialSpecs(BaseModel):
    """Required inputs. Missing values are validation errors, never zero."""

    model_config = ConfigDict(extra="ignore")

    loanAmountMinorUnits: int = Field(gt=0)
    requestedTermMonths: int = Field(ge=12, le=480)
    netMonthlyIncomeMinorUnits: int = Field(gt=0)
    monthlyExpensesMinorUnits: int = Field(ge=0)
    existingMonthlyDebtMinorUnits: int = Field(ge=0)


class PropertySpecs(BaseModel):
    model_config = ConfigDict(extra="ignore")

    askingPriceMinorUnits: int = Field(gt=0)
    berRating: BerRating = BerRating.UNKNOWN
    county: str = Field(min_length=1)
    propertyType: str | None = None
    floorAreaSqM: float | None = Field(default=None, gt=0)
    bedrooms: int | None = Field(default=None, ge=0)


class AssessmentInput(BaseModel):
    """applicationId is a pass-through key and is never analysed."""

    model_config = ConfigDict(extra="ignore")

    applicationId: str = Field(min_length=1)
    financialSpecs: FinancialSpecs
    propertySpecs: PropertySpecs


# ---------- Output (written to aiAssessment) ----------
class Valuation(BaseModel):
    estimatedValueMinorUnits: int
    currency: str = "EUR"
    modelVersion: str
    ltvBps: int


class StressTest(BaseModel):
    rateIncreaseBps: int
    aprBps: int
    monthlyRepaymentMinorUnits: int
    disposableSurplusMinorUnits: int


class Affordability(BaseModel):
    aprBps: int
    monthlyRepaymentMinorUnits: int
    dtiBps: int
    disposableSurplusMinorUnits: int
    loanToIncomeMultiple: float
    stressTests: list[StressTest]
    assumptions: list[str]


class AiAssessment(BaseModel):
    recommendation: Recommendation
    createdAt: datetime
    isMock: bool = True
    modelVersion: str
    valuation: Valuation
    affordability: Affordability
    creditMemo: str
    warnings: list[str] = []


class AssessmentResponse(BaseModel):
    """REST test-harness response only; Firestore stores aiAssessment directly."""

    applicationId: str
    aiAssessment: AiAssessment