from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any, Callable

import firebase_admin
from fastapi import Depends, FastAPI, HTTPException, Path as ApiPath, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore
from pydantic import BaseModel
from web3 import Web3
from web3.exceptions import ContractLogicError, Web3Exception

from api.core import canonical_sha256, pseudonymous_borrower_hash, stable_token_id
from api.schemas import (
    HealthResponse,
    RejectionRequest,
    RejectionResponse,
    SettlementRequest,
    SettlementResponse,
    SettlementStatusResponse,
)


logger = logging.getLogger("al_core_ledger")
bearer_scheme = HTTPBearer(auto_error=False)
APPLICATION_ID_PATTERN = r"^[A-Za-z0-9_-]{1,128}$"
APPROVABLE_STATUSES = {"AI_DELIBERATED", "UNDERWRITER_APPROVED"}
BER_GREEN_RATINGS = {"A1", "A2", "A3"}
ALLOWED_ROLES = {"borrower", "broker", "underwriter"}


class ConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    firebase_service_account_path: Path
    firebase_project_id: str | None
    borrower_hash_secret: str
    evm_rpc_url: str
    evm_chain_id: int | None
    evm_private_key: str | None
    evm_sender_address: str | None
    audit_registry_address: str
    loan_token_address: str
    artifacts_directory: Path
    confirmation_timeout_seconds: int

    @classmethod
    def from_environment(cls) -> Settings:
        service_account = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        hash_secret = os.environ.get("BORROWER_HASH_SECRET")
        rpc_url = os.environ.get("EVM_RPC_URL")
        audit_address = os.environ.get("AUDIT_REGISTRY_ADDRESS")
        loan_address = os.environ.get("LOAN_TOKEN_ADDRESS")
        required = {
            "FIREBASE_SERVICE_ACCOUNT_PATH": service_account,
            "BORROWER_HASH_SECRET": hash_secret,
            "EVM_RPC_URL": rpc_url,
            "AUDIT_REGISTRY_ADDRESS": audit_address,
            "LOAN_TOKEN_ADDRESS": loan_address,
        }
        missing = [key for key, value in required.items() if not value]
        if missing:
            raise ConfigurationError(f"Missing required environment variables: {', '.join(missing)}")
        if len(hash_secret.encode("utf-8")) < 32:
            raise ConfigurationError("BORROWER_HASH_SECRET must contain at least 32 bytes")

        artifacts_directory = Path(
            os.environ.get("CONTRACT_ARTIFACTS_DIR", Path(__file__).resolve().parents[1] / "artifacts")
        )
        chain_id_value = os.environ.get("EVM_CHAIN_ID")
        try:
            chain_id = int(chain_id_value) if chain_id_value else None
            confirmation_timeout_seconds = int(
                os.environ.get("EVM_CONFIRMATION_TIMEOUT_SECONDS", "120")
            )
        except ValueError as exc:
            raise ConfigurationError("EVM_CHAIN_ID and EVM_CONFIRMATION_TIMEOUT_SECONDS must be integers") from exc
        if confirmation_timeout_seconds <= 0:
            raise ConfigurationError("EVM_CONFIRMATION_TIMEOUT_SECONDS must be greater than zero")

        return cls(
            firebase_service_account_path=Path(service_account),
            firebase_project_id=os.environ.get("FIREBASE_PROJECT_ID"),
            borrower_hash_secret=hash_secret,
            evm_rpc_url=rpc_url,
            evm_chain_id=chain_id,
            evm_private_key=os.environ.get("EVM_PRIVATE_KEY"),
            evm_sender_address=os.environ.get("EVM_SENDER_ADDRESS"),
            audit_registry_address=audit_address,
            loan_token_address=loan_address,
            artifacts_directory=artifacts_directory,
            confirmation_timeout_seconds=confirmation_timeout_seconds,
        )


@dataclass
class Services:
    db: Any
    web3: Web3
    audit_registry: Any
    loan_token: Any
    sender_address: str
    borrower_hash_secret: str
    evm_private_key: str | None
    verify_id_token: Callable[[str], dict[str, Any]]
    confirmation_timeout_seconds: int = 120


class Principal(BaseModel):
    uid: str
    role: str


def _read_contract_abi(artifacts_directory: Path, contract_name: str) -> list[dict[str, Any]]:
    artifact_path = artifacts_directory / "contracts" / f"{contract_name}.sol" / f"{contract_name}.json"
    if not artifact_path.is_file():
        raise ConfigurationError(
            f"Missing Hardhat artifact {artifact_path}; run `npm run compile` in al-core-ledger"
        )
    with artifact_path.open(encoding="utf-8") as artifact_file:
        artifact = json.load(artifact_file)
    abi = artifact.get("abi")
    if not isinstance(abi, list):
        raise ConfigurationError(f"Hardhat artifact {artifact_path} has no ABI")
    return abi


def build_services(settings: Settings) -> Services:
    if not settings.firebase_service_account_path.is_file():
        raise ConfigurationError(
            f"Firebase service account file not found: {settings.firebase_service_account_path}"
        )

    try:
        firebase_app = firebase_admin.get_app()
    except ValueError:
        firebase_options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None
        firebase_app = firebase_admin.initialize_app(
            credentials.Certificate(str(settings.firebase_service_account_path)),
            firebase_options,
        )

    web3 = Web3(Web3.HTTPProvider(settings.evm_rpc_url))
    if not web3.is_connected():
        raise ConfigurationError(f"Cannot connect to EVM RPC endpoint: {settings.evm_rpc_url}")
    if settings.evm_chain_id is not None and web3.eth.chain_id != settings.evm_chain_id:
        raise ConfigurationError(
            f"EVM chain ID mismatch: expected {settings.evm_chain_id}, got {web3.eth.chain_id}"
        )

    if not Web3.is_address(settings.audit_registry_address):
        raise ConfigurationError("AUDIT_REGISTRY_ADDRESS is not a valid EVM address")
    if not Web3.is_address(settings.loan_token_address):
        raise ConfigurationError("LOAN_TOKEN_ADDRESS is not a valid EVM address")

    audit_address = Web3.to_checksum_address(settings.audit_registry_address)
    loan_address = Web3.to_checksum_address(settings.loan_token_address)
    if not web3.eth.get_code(audit_address) or not web3.eth.get_code(loan_address):
        raise ConfigurationError("No deployed contract code found at one or both configured addresses")

    private_key = settings.evm_private_key
    if private_key:
        sender_address = web3.eth.account.from_key(private_key).address
        if settings.evm_sender_address and not Web3.is_address(settings.evm_sender_address):
            raise ConfigurationError("EVM_SENDER_ADDRESS is not a valid EVM address")
        if (
            settings.evm_sender_address
            and Web3.to_checksum_address(settings.evm_sender_address) != sender_address
        ):
            raise ConfigurationError("EVM_SENDER_ADDRESS does not match EVM_PRIVATE_KEY")
    elif settings.evm_sender_address:
        if not Web3.is_address(settings.evm_sender_address):
            raise ConfigurationError("EVM_SENDER_ADDRESS is not a valid EVM address")
        sender_address = Web3.to_checksum_address(settings.evm_sender_address)
    else:
        unlocked_accounts = web3.eth.accounts
        if not unlocked_accounts:
            raise ConfigurationError(
                "Set EVM_PRIVATE_KEY for a signing wallet or EVM_SENDER_ADDRESS for an unlocked local account"
            )
        sender_address = Web3.to_checksum_address(unlocked_accounts[0])

    audit_registry = web3.eth.contract(
        address=audit_address,
        abi=_read_contract_abi(settings.artifacts_directory, "AuditRegistry"),
    )
    loan_token = web3.eth.contract(
        address=loan_address,
        abi=_read_contract_abi(settings.artifacts_directory, "LoanToken"),
    )
    if not audit_registry.functions.hasRole(audit_registry.functions.AUDITOR_ROLE().call(), sender_address).call():
        raise ConfigurationError(f"EVM sender {sender_address} has no AUDITOR_ROLE on AuditRegistry")
    if not loan_token.functions.hasRole(loan_token.functions.MINTER_ROLE().call(), sender_address).call():
        raise ConfigurationError(f"EVM sender {sender_address} has no MINTER_ROLE on LoanToken")

    def verify_id_token(token: str) -> dict[str, Any]:
        return firebase_auth.verify_id_token(token, app=firebase_app, check_revoked=True)

    return Services(
        db=firestore.client(firebase_app),
        web3=web3,
        audit_registry=audit_registry,
        loan_token=loan_token,
        sender_address=sender_address,
        borrower_hash_secret=settings.borrower_hash_secret,
        evm_private_key=private_key,
        verify_id_token=verify_id_token,
        confirmation_timeout_seconds=settings.confirmation_timeout_seconds,
    )


def _http_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


def _current_principal(
    request: Request,
    credentials_value: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Principal:
    if credentials_value is None:
        raise _http_error(status.HTTP_401_UNAUTHORIZED, "AUTH_REQUIRED", "Provide a Firebase ID token.")

    services: Services = request.app.state.services
    try:
        claims = services.verify_id_token(credentials_value.credentials)
    except (
        ValueError,
        firebase_auth.InvalidIdTokenError,
        firebase_auth.ExpiredIdTokenError,
        firebase_auth.RevokedIdTokenError,
    ) as exc:
        raise _http_error(status.HTTP_401_UNAUTHORIZED, "INVALID_TOKEN", "The Firebase ID token is invalid.") from exc

    uid = claims.get("uid")
    role = claims.get("role")
    if not isinstance(uid, str) or not isinstance(role, str) or role not in ALLOWED_ROLES:
        raise _http_error(status.HTTP_403_FORBIDDEN, "ROLE_REQUIRED", "The account has no supported role claim.")
    return Principal(uid=uid, role=role)


def _canonical_approval_payload(
    application_id: str,
    underwriter_uid: str,
    request: SettlementRequest,
) -> dict[str, Any]:
    return {
        "version": 1,
        "applicationId": application_id,
        "approvedByUid": underwriter_uid,
        "approvedAt": request.approved_at.astimezone(timezone.utc).isoformat(),
        "creditMemo": request.credit_memo,
        "valuation": request.valuation,
        "loan": {
            "principalMinorUnits": request.loan.principal_minor_units,
            "baseAprBps": request.loan.base_apr_bps,
            "termMonths": request.loan.term_months,
            "berRating": request.loan.ber_rating,
            "recipientAddress": request.loan.recipient_address,
        },
    }


def _canonical_rejection_payload(
    application_id: str,
    underwriter_uid: str,
    request: RejectionRequest,
) -> dict[str, Any]:
    return {
        "version": 1,
        "applicationId": application_id,
        "rejectedByUid": underwriter_uid,
        "rejectedAt": request.rejected_at.astimezone(timezone.utc).isoformat(),
        "reason": request.reason,
    }


def _reserve_approval(
    services: Services,
    application_id: str,
    underwriter: Principal,
    approved_at: datetime,
    audit_hash: str,
    borrower_id: str,
) -> dict[str, Any]:
    application_ref = services.db.collection("applications").document(application_id)
    transaction = services.db.transaction()

    @firestore.transactional
    def reserve(transaction_value: Any) -> dict[str, Any]:
        snapshot = application_ref.get(transaction=transaction_value)
        if not snapshot.exists:
            raise _http_error(status.HTTP_404_NOT_FOUND, "APPLICATION_NOT_FOUND", "Application not found.")
        application = snapshot.to_dict() or {}
        if application.get("borrowerId") != borrower_id:
            raise _http_error(status.HTTP_409_CONFLICT, "APPLICATION_CHANGED", "Application owner changed.")
        current_status = application.get("status")
        if current_status not in APPROVABLE_STATUSES:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "APPLICATION_NOT_READY",
                "Only an AI_DELIBERATED application can be approved for settlement.",
            )

        previous_approval = application.get("underwriterApproval") or {}
        previous_hash = previous_approval.get("auditHash")
        if previous_hash and previous_hash != audit_hash:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "APPROVAL_ALREADY_RECORDED",
                "A different approval payload is already recorded for this application.",
            )

        previous_ledger = application.get("blockchainTx") or {}
        if previous_ledger.get("auditHash") == audit_hash and previous_ledger.get("status") == "CONFIRMED":
            return {"alreadySettled": True, "blockchainTx": previous_ledger}

        if current_status == "UNDERWRITER_APPROVED" and not previous_hash:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "APPROVAL_ALREADY_RECORDED",
                "The application was approved outside the ledger settlement flow.",
            )

        transaction_value.update(
            application_ref,
            {
                "status": "UNDERWRITER_APPROVED",
                "underwriterApproval": {
                    "approvedBy": underwriter.uid,
                    "approvedAt": approved_at.astimezone(timezone.utc),
                    "auditHash": audit_hash,
                },
                "blockchainTx": {
                    "status": "PENDING",
                    "auditHash": audit_hash,
                },
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
        )
        transaction_value.set(
            services.db.collection("audit_logs").document(f"approval-{application_id}"),
            {
                "applicationId": application_id,
                "borrowerId": borrower_id,
                "brokerId": application.get("brokerId"),
                "eventType": "UNDERWRITER_APPROVED",
                "actorUid": underwriter.uid,
                "createdAt": approved_at.astimezone(timezone.utc),
                "details": {"decision": "APPROVED"},
                "auditHash": audit_hash,
            },
            merge=True,
        )
        return {"alreadySettled": False}

    return reserve(transaction)


def _reserve_rejection(
    services: Services,
    application_id: str,
    underwriter: Principal,
    request: RejectionRequest,
    rejection_hash: str,
) -> bool:
    application_ref = services.db.collection("applications").document(application_id)
    audit_log_ref = services.db.collection("audit_logs").document(f"rejection-{application_id}")
    transaction = services.db.transaction()

    @firestore.transactional
    def reserve(transaction_value: Any) -> bool:
        snapshot = application_ref.get(transaction=transaction_value)
        if not snapshot.exists:
            raise _http_error(status.HTTP_404_NOT_FOUND, "APPLICATION_NOT_FOUND", "Application not found.")
        application = snapshot.to_dict() or {}
        previous_decision = application.get("underwriterDecision") or {}
        if (
            application.get("status") == "REJECTED"
            and previous_decision.get("rejectionHash") == rejection_hash
        ):
            return True
        if application.get("status") != "AI_DELIBERATED":
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "APPLICATION_NOT_READY",
                "Only an AI_DELIBERATED application can be rejected.",
            )
        borrower_id = application.get("borrowerId")
        if not isinstance(borrower_id, str) or not borrower_id:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "APPLICATION_INVALID",
                "Application has no borrowerId.",
            )
        if previous_decision.get("rejectionHash"):
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "DECISION_ALREADY_RECORDED",
                "A different underwriter decision is already recorded.",
            )

        rejected_at = request.rejected_at.astimezone(timezone.utc)
        transaction_value.update(
            application_ref,
            {
                "status": "REJECTED",
                "underwriterDecision": {
                    "decision": "REJECTED",
                    "rejectedBy": underwriter.uid,
                    "rejectedAt": rejected_at,
                    "rejectionHash": rejection_hash,
                },
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
        )
        transaction_value.set(
            audit_log_ref,
            {
                "applicationId": application_id,
                "borrowerId": borrower_id,
                "brokerId": application.get("brokerId"),
                "eventType": "UNDERWRITER_REJECTED",
                "actorUid": underwriter.uid,
                "createdAt": rejected_at,
                "details": {"reason": request.reason},
                "auditHash": rejection_hash,
            },
            merge=True,
        )
        return False

    return reserve(transaction)


def _send_and_confirm(services: Services, contract_function: Any) -> dict[str, Any]:
    if services.evm_private_key:
        transaction = contract_function.build_transaction(
            {
                "from": services.sender_address,
                "nonce": services.web3.eth.get_transaction_count(services.sender_address),
                "chainId": services.web3.eth.chain_id,
            }
        )
        signed_transaction = services.web3.eth.account.sign_transaction(
            transaction,
            services.evm_private_key,
        )
        transaction_hash = services.web3.eth.send_raw_transaction(signed_transaction.raw_transaction)
    else:
        transaction_hash = contract_function.transact({"from": services.sender_address})
    receipt = services.web3.eth.wait_for_transaction_receipt(
        transaction_hash,
        timeout=services.confirmation_timeout_seconds,
    )
    if receipt["status"] != 1:
        raise Web3Exception("EVM transaction was mined with a failure status")
    return {
        "transactionHash": Web3.to_hex(transaction_hash),
        "blockNumber": int(receipt["blockNumber"]),
    }


def _persist_settlement(
    services: Services,
    application_id: str,
    borrower_id: str,
    broker_id: str | None,
    underwriter_uid: str,
    ledger_result: dict[str, Any],
) -> None:
    batch = services.db.batch()
    application_ref = services.db.collection("applications").document(application_id)
    audit_log_ref = services.db.collection("audit_logs").document(f"settlement-{application_id}")
    batch.update(
        application_ref,
        {
            "blockchainTx": ledger_result,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )
    batch.set(
        audit_log_ref,
        {
            "applicationId": application_id,
            "borrowerId": borrower_id,
            "brokerId": broker_id,
            "eventType": "LEDGER_SETTLEMENT_CONFIRMED",
            "actorUid": underwriter_uid,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "details": {
                "chainId": ledger_result["chainId"],
                "applicationIdHash": ledger_result["applicationIdHash"],
                "tokenId": ledger_result["tokenId"],
                "auditTxHash": ledger_result["auditTxHash"],
                "loanTxHash": ledger_result["loanTxHash"],
            },
            "auditHash": ledger_result["auditHash"],
        },
        merge=True,
    )
    batch.commit()


def _mark_ledger_failed(services: Services, application_id: str, audit_hash: str) -> None:
    services.db.collection("applications").document(application_id).update(
        {
            "blockchainTx.status": "FAILED",
            "blockchainTx.auditHash": audit_hash,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )


def _settle_on_chain(
    services: Services,
    application_id: str,
    borrower_id: str,
    request: SettlementRequest,
    audit_hash: str,
) -> dict[str, Any]:
    application_hash = Web3.keccak(text=application_id)
    audit_hash_bytes = bytes.fromhex(audit_hash[2:])
    borrower_hash = pseudonymous_borrower_hash(borrower_id, services.borrower_hash_secret)
    token_id = stable_token_id(application_id)
    recipient = request.loan.recipient_address

    audit_exists = services.audit_registry.functions.auditExists(application_hash).call()
    audit_tx: dict[str, Any] | None = None
    if audit_exists:
        existing_record = services.audit_registry.functions.auditRecords(application_hash).call()
        if bytes(existing_record[0]) != audit_hash_bytes:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "ON_CHAIN_AUDIT_MISMATCH",
                "A different audit hash is already committed for this application.",
            )
    else:
        audit_tx = _send_and_confirm(
            services,
            services.audit_registry.functions.recordAuditHash(application_hash, audit_hash_bytes),
        )

    loan_exists = False
    try:
        current_owner = services.loan_token.functions.ownerOf(token_id).call()
        loan_exists = True
    except ContractLogicError:
        current_owner = None

    expected_apr = request.loan.base_apr_bps
    if request.loan.ber_rating in BER_GREEN_RATINGS:
        expected_apr = max(0, expected_apr - 25)

    loan_tx: dict[str, Any] | None = None
    if loan_exists:
        existing_note = services.loan_token.functions.loanNotes(token_id).call()
        if (
            Web3.to_checksum_address(current_owner) != recipient
            or int(existing_note[0]) != request.loan.principal_minor_units
            or int(existing_note[1]) != expected_apr
            or int(existing_note[2]) != request.loan.term_months
            or bytes(existing_note[3]) != borrower_hash
            or existing_note[4] != request.loan.ber_rating
        ):
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "ON_CHAIN_LOAN_MISMATCH",
                "A different loan token already exists for this application.",
            )
    else:
        loan_tx = _send_and_confirm(
            services,
            services.loan_token.functions.mintLoanToken(
                recipient,
                token_id,
                request.loan.principal_minor_units,
                request.loan.base_apr_bps,
                request.loan.term_months,
                borrower_hash,
                request.loan.ber_rating,
            ),
        )

    return {
        "status": "CONFIRMED",
        "chainId": services.web3.eth.chain_id,
        "auditHash": audit_hash,
        "applicationIdHash": Web3.to_hex(application_hash),
        "tokenId": str(token_id),
        "auditTxHash": audit_tx["transactionHash"] if audit_tx else None,
        "loanTxHash": loan_tx["transactionHash"] if loan_tx else None,
        "blockNumber": max(
            tx["blockNumber"] for tx in (audit_tx, loan_tx) if tx is not None
        )
        if audit_tx or loan_tx
        else None,
    }


def create_app(services: Services | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        application.state.services = services or build_services(Settings.from_environment())
        yield

    application = FastAPI(
        title="Agentic Lender Core Ledger API",
        version="1.0.0",
        description="Firebase-authenticated application ledger settlement API.",
        lifespan=lifespan,
    )
    cors_origins = [
        origin.strip()
        for origin in os.environ.get(
            "API_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @application.get("/health", tags=["Operations"], response_model=HealthResponse)
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @application.get(
        "/v1/applications/{application_id}/settlement",
        tags=["Ledger"],
        response_model=SettlementStatusResponse,
    )
    def get_settlement(
        request: Request,
        application_id: Annotated[
            str,
            ApiPath(min_length=1, max_length=128, pattern=APPLICATION_ID_PATTERN),
        ],
        principal: Annotated[Principal, Depends(_current_principal)],
    ) -> dict[str, Any]:
        services_value: Services = request.app.state.services
        snapshot = services_value.db.collection("applications").document(application_id).get()
        if not snapshot.exists:
            raise _http_error(status.HTTP_404_NOT_FOUND, "APPLICATION_NOT_FOUND", "Application not found.")
        application_data = snapshot.to_dict() or {}
        is_allowed = (
            principal.role == "underwriter"
            or (
                principal.role == "borrower"
                and application_data.get("borrowerId") == principal.uid
            )
            or (
                principal.role == "broker"
                and application_data.get("brokerId") == principal.uid
            )
        )
        if not is_allowed:
            raise _http_error(status.HTTP_403_FORBIDDEN, "APPLICATION_FORBIDDEN", "Access denied.")
        return {
            "applicationId": application_id,
            "status": application_data.get("status"),
            "ledger": application_data.get("blockchainTx"),
        }

    @application.post(
        "/v1/applications/{application_id}/settlement",
        tags=["Ledger"],
        status_code=status.HTTP_200_OK,
        response_model=SettlementResponse,
    )
    def settle_application(
        request: Request,
        application_id: Annotated[
            str,
            ApiPath(min_length=1, max_length=128, pattern=APPLICATION_ID_PATTERN),
        ],
        payload: SettlementRequest,
        principal: Annotated[Principal, Depends(_current_principal)],
    ) -> dict[str, Any]:
        if principal.role != "underwriter":
            raise _http_error(status.HTTP_403_FORBIDDEN, "UNDERWRITER_REQUIRED", "Underwriter role required.")

        services_value: Services = request.app.state.services
        application_ref = services_value.db.collection("applications").document(application_id)
        application_snapshot = application_ref.get()
        if not application_snapshot.exists:
            raise _http_error(status.HTTP_404_NOT_FOUND, "APPLICATION_NOT_FOUND", "Application not found.")
        application_data = application_snapshot.to_dict() or {}
        borrower_id = application_data.get("borrowerId")
        if not isinstance(borrower_id, str) or not borrower_id:
            raise _http_error(
                status.HTTP_409_CONFLICT,
                "APPLICATION_INVALID",
                "Application has no borrowerId.",
            )

        canonical_payload = _canonical_approval_payload(application_id, principal.uid, payload)
        try:
            audit_hash = canonical_sha256(canonical_payload)
        except (TypeError, ValueError) as exc:
            raise _http_error(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "INVALID_AUDIT_PAYLOAD",
                "The valuation must contain finite JSON values.",
            ) from exc

        reservation = _reserve_approval(
            services_value,
            application_id,
            principal,
            payload.approved_at,
            audit_hash,
            borrower_id,
        )
        if reservation["alreadySettled"]:
            return {
                "applicationId": application_id,
                **reservation["blockchainTx"],
            }

        try:
            ledger_result = _settle_on_chain(
                services_value,
                application_id,
                borrower_id,
                payload,
                audit_hash,
            )
        except HTTPException:
            raise
        except (Web3Exception, ValueError, TimeoutError) as exc:
            _mark_ledger_failed(services_value, application_id, audit_hash)
            logger.exception("Ledger settlement failed for application %s", application_id)
            raise _http_error(
                status.HTTP_502_BAD_GATEWAY,
                "LEDGER_SETTLEMENT_FAILED",
                "Blockchain settlement failed. The same approval payload can be retried.",
            ) from exc

        _persist_settlement(
            services_value,
            application_id,
            borrower_id,
            application_data.get("brokerId"),
            principal.uid,
            ledger_result,
        )
        return {"applicationId": application_id, **ledger_result}

    @application.post(
        "/v1/applications/{application_id}/rejection",
        tags=["Applications"],
        status_code=status.HTTP_200_OK,
        response_model=RejectionResponse,
    )
    def reject_application(
        request: Request,
        application_id: Annotated[
            str,
            ApiPath(min_length=1, max_length=128, pattern=APPLICATION_ID_PATTERN),
        ],
        payload: RejectionRequest,
        principal: Annotated[Principal, Depends(_current_principal)],
    ) -> dict[str, str | bool]:
        if principal.role != "underwriter":
            raise _http_error(status.HTTP_403_FORBIDDEN, "UNDERWRITER_REQUIRED", "Underwriter role required.")

        services_value: Services = request.app.state.services
        rejection_hash = canonical_sha256(
            _canonical_rejection_payload(application_id, principal.uid, payload)
        )
        already_rejected = _reserve_rejection(
            services_value,
            application_id,
            principal,
            payload,
            rejection_hash,
        )
        return {
            "applicationId": application_id,
            "status": "REJECTED",
            "rejectionHash": rejection_hash,
            "idempotentRetry": already_rejected,
        }

    return application


app = create_app()
