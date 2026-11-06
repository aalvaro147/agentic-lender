from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from web3 import Web3


BerRating = Literal[
    "A1",
    "A2",
    "A3",
    "B1",
    "B2",
    "B3",
    "C1",
    "C2",
    "C3",
    "D1",
    "D2",
    "E1",
    "E2",
    "F",
    "G",
    "UNKNOWN",
]


class LoanTerms(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    principal_minor_units: int = Field(alias="principalMinorUnits", gt=0)
    base_apr_bps: int = Field(alias="baseAprBps", ge=0, le=10_000)
    term_months: int = Field(alias="termMonths", ge=1, le=600)
    ber_rating: BerRating = Field(alias="berRating")
    recipient_address: str = Field(alias="recipientAddress")

    @field_validator("recipient_address")
    @classmethod
    def validate_recipient_address(cls, value: str) -> str:
        if not Web3.is_address(value):
            raise ValueError("recipientAddress must be a valid EVM address")
        return Web3.to_checksum_address(value)


class SettlementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    credit_memo: str = Field(alias="creditMemo", min_length=1, max_length=50_000)
    valuation: dict[str, Any] = Field(min_length=1)
    approved_at: datetime = Field(alias="approvedAt")
    loan: LoanTerms

    @field_validator("approved_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("approvedAt must include a timezone")
        return value


class RejectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    reason: str = Field(min_length=1, max_length=4_000)
    rejected_at: datetime = Field(alias="rejectedAt")

    @field_validator("rejected_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("rejectedAt must include a timezone")
        return value


ApplicationStatus = Literal[
    "APPLIED",
    "AI_DELIBERATED",
    "UNDERWRITER_APPROVED",
    "FUNDED",
    "CLOSED",
    "REJECTED",
]


class HealthResponse(BaseModel):
    status: Literal["ok"]


class LedgerState(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["PENDING", "CONFIRMED", "FAILED"] | None = None
    audit_hash: str | None = Field(default=None, alias="auditHash")
    chain_id: int | None = Field(default=None, alias="chainId")
    application_id_hash: str | None = Field(default=None, alias="applicationIdHash")
    token_id: str | None = Field(default=None, alias="tokenId")
    audit_tx_hash: str | None = Field(default=None, alias="auditTxHash")
    loan_tx_hash: str | None = Field(default=None, alias="loanTxHash")
    block_number: int | None = Field(default=None, alias="blockNumber")


class SettlementStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    application_id: str = Field(alias="applicationId")
    status: ApplicationStatus
    ledger: LedgerState | None


class SettlementResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    application_id: str = Field(alias="applicationId")
    status: Literal["CONFIRMED"]
    chain_id: int = Field(alias="chainId")
    audit_hash: str = Field(alias="auditHash")
    application_id_hash: str = Field(alias="applicationIdHash")
    token_id: str = Field(alias="tokenId")
    audit_tx_hash: str | None = Field(alias="auditTxHash")
    loan_tx_hash: str | None = Field(alias="loanTxHash")
    block_number: int | None = Field(alias="blockNumber")


class RejectionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    application_id: str = Field(alias="applicationId")
    status: Literal["REJECTED"]
    rejection_hash: str = Field(alias="rejectionHash")
    idempotent_retry: bool = Field(alias="idempotentRetry")
