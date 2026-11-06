from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any


def canonical_sha256(payload: dict[str, Any]) -> str:
    """Hash a JSON payload deterministically so independent services can verify it."""
    canonical_json = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return f"0x{hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()}"


def pseudonymous_borrower_hash(borrower_id: str, secret: str) -> bytes:
    if not borrower_id:
        raise ValueError("borrower_id must not be empty")
    secret_bytes = secret.encode("utf-8")
    if len(secret_bytes) < 32:
        raise ValueError("BORROWER_HASH_SECRET must contain at least 32 bytes")
    return hmac.new(secret_bytes, borrower_id.encode("utf-8"), hashlib.sha256).digest()


def stable_token_id(application_id: str) -> int:
    if not application_id:
        raise ValueError("application_id must not be empty")
    return int.from_bytes(hashlib.sha256(application_id.encode("utf-8")).digest(), "big")
