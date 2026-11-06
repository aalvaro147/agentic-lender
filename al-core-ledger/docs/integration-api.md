# AL-Core integration contract

This is the integration boundary for AL-Mobile, AL-Web and AL-AI. The API is
versioned under `/v1`; its interactive OpenAPI specification is served at
`http://localhost:8000/docs` when the service is running.

## Responsibilities by module

| Module | Connects through | What it sends/does |
|---|---|---|
| AL-Mobile | Firebase Auth + Firestore client SDK | Creates/reads the signed-in borrower's application under Firestore rules. |
| AL-Web borrower/broker views | Firebase Auth + Firestore client SDK | Reads only owned/assigned applications and creates or updates allowed intake fields. |
| AL-Web underwriter view | Firebase Auth + Core Ledger REST API | Reads settlement state and submits the final approval for on-chain settlement. |
| AL-AI Engine | Server-side Firebase Admin SDK | Reads `APPLIED`; writes `aiAssessment`; changes status to `AI_DELIBERATED`. The service account stays server-side. |
| AL-Core API | Firebase Admin SDK + JSON-RPC | Verifies Firebase tokens/roles, enforces approval state, hashes the approval payload, commits audit and loan records, then stores transaction metadata. |

Do not let clients change `UNDERWRITER_APPROVED`, `blockchainTx`, or
`audit_logs` through Firestore. Approval settlement is performed only by the API.
Firestore rules protect client SDK traffic; Firebase Admin SDK calls bypass those
rules and must be restricted to trusted backend code and service accounts.

## Application document contract

Collection: `applications/{applicationId}`. See
[`applications.schema.json`](../firebase/schemas/applications.schema.json).

* `applicationId` matches the Firestore document ID.
* `borrowerId` and optional `brokerId` are Firebase UIDs.
* `status` moves through `APPLIED` → `AI_DELIBERATED` → `UNDERWRITER_APPROVED`
  → `FUNDED` / `CLOSED`, or to `REJECTED`.
* `financialSpecs` amounts are integer minor units, and terms are in months.
* `propertySpecs.berRating` is a recognized Irish BER (`A1` … `G`) or
  `UNKNOWN`.
* `aiAssessment` contains the AI recommendation, valuation and affordability
  outputs. The AI service sets `status` to `AI_DELIBERATED` only after writing
  the completed assessment.
* `blockchainTx` is written by the Core API, not by a client.

The JSON Schemas document the expected Firestore shape; Firestore does not
enforce JSON Schema automatically. The deployed Firestore Security Rules enforce
client authorization and key state-transition restrictions.

## Authentication

Every `/v1` request uses a Firebase ID token, not a Firebase refresh token:

```http
Authorization: Bearer <Firebase-ID-token>
Content-Type: application/json
```

The token must contain the custom claim `role` set to `borrower`, `broker`, or
`underwriter`. Roles are assigned only by an administrator using the privileged
script described in the README. A user must refresh their ID token after a role
change.

## `GET /v1/applications/{applicationId}/settlement`

Returns the application status and its ledger state. A borrower can read their
own application, a broker can read an application assigned to them, and an
underwriter can read any application.

Example response:

```json
{
  "applicationId": "APP-10042",
  "status": "UNDERWRITER_APPROVED",
  "ledger": {
    "status": "CONFIRMED",
    "auditHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "chainId": 31337,
    "applicationIdHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "tokenId": "42",
    "auditTxHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    "loanTxHash": "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    "blockNumber": 12
  }
}
```

## `POST /v1/applications/{applicationId}/settlement`

Underwriter only. The application must be in `AI_DELIBERATED` state, or be a
retry of the same approval already in progress. This call records the
underwriter's approval, writes the SHA-256 proof to `AuditRegistry`, mints the
ERC-721 loan note, and stores the result in Firestore.

Example request:

```json
{
  "approvedAt": "2026-11-05T16:00:00Z",
  "creditMemo": "Approved after income and collateral review.",
  "valuation": {
    "estimatedValueMinorUnits": 42000000,
    "currency": "EUR",
    "modelVersion": "avm-1.0",
    "ltvBps": 7500
  },
  "loan": {
    "principalMinorUnits": 35000000,
    "baseAprBps": 350,
    "termMonths": 360,
    "berRating": "A2",
    "recipientAddress": "0x1111111111111111111111111111111111111111"
  }
}
```

`approvedAt` must include a timezone. The API uses the authenticated underwriter
UID and application ID when constructing the canonical audit payload; neither
is accepted from the request body. It hashes sorted, compact UTF-8 JSON with
SHA-256. The request's credit memo is used only to compute the hash and is not
saved by the Core API. The valuation is included in that hash but is not written
on-chain. The API derives the on-chain borrower pseudonym from the Firestore
`borrowerId` using `BORROWER_HASH_SECRET`.

Amounts are minor currency units; `35000000` means €350,000.00. APR uses basis
points; `350` means 3.50%. For BER `A1`, `A2`, or `A3`, the contract subtracts
25 bps, flooring the final APR at zero.

Example response:

```json
{
  "applicationId": "APP-10042",
  "status": "CONFIRMED",
  "chainId": 31337,
  "auditHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "applicationIdHash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "tokenId": "42",
  "auditTxHash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "loanTxHash": "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "blockNumber": 12
}
```

`auditTxHash` or `loanTxHash` can be `null` on a successful idempotent retry
when that transaction was already committed by an earlier attempt. Keep the
same request body, including `approvedAt`, for a retry. A changed approval
payload returns `409` rather than silently replacing an immutable record.

## `POST /v1/applications/{applicationId}/rejection`

Underwriter only. Use this endpoint to record a decline instead of changing
`status` directly in Firestore. The application must be `AI_DELIBERATED`.
The rejection reason is retained in a restricted Firestore audit log and is
not sent to the blockchain. Repeating the exact same decision payload is
idempotent; a different decision after rejection returns `409`.

Request:

```json
{
  "rejectedAt": "2026-11-05T16:00:00Z",
  "reason": "The verified affordability assessment does not meet the lending criteria."
}
```

Response:

```json
{
  "applicationId": "APP-10042",
  "status": "REJECTED",
  "rejectionHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "idempotentRetry": false
}
```

## Status and error codes

| HTTP | `detail.code` | Meaning / client action |
|---|---|---|
| 401 | `AUTH_REQUIRED`, `INVALID_TOKEN` | Sign in again and send a fresh Firebase ID token. |
| 403 | `UNDERWRITER_REQUIRED`, `APPLICATION_FORBIDDEN`, `ROLE_REQUIRED` | The signed-in role cannot perform this action. |
| 404 | `APPLICATION_NOT_FOUND` | Check the Firestore document ID. |
| 409 | `APPLICATION_NOT_READY`, `APPLICATION_INVALID`, `APPROVAL_ALREADY_RECORDED`, `DECISION_ALREADY_RECORDED`, `ON_CHAIN_AUDIT_MISMATCH`, `ON_CHAIN_LOAN_MISMATCH` | Refresh application state; do not retry with a changed decision. |
| 422 | Validation error / `INVALID_AUDIT_PAYLOAD` | Fix the request shape, values, timezone or JSON data. |
| 502 | `LEDGER_SETTLEMENT_FAILED` | Retry the same approval payload after checking the RPC service. |

`GET /health` is an unauthenticated liveness check. It does not disclose
Firebase or RPC configuration.

## AL-Web example

```javascript
const idToken = await firebaseUser.getIdToken();
const response = await fetch(
  `${import.meta.env.VITE_CORE_API_URL}/v1/applications/${applicationId}/settlement`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(approvalPayload),
  },
);

const result = await response.json();
if (!response.ok) {
  throw new Error(result.detail?.message ?? "Ledger settlement failed");
}
```

Set `VITE_CORE_API_URL=http://localhost:8000` in the web app's local environment.
Only render the approval action for an authenticated underwriter; the API
re-checks the role and is the authoritative control.

## AL-AI hand-off

The AI service writes a Firestore document matching
[`applications.schema.json`](../firebase/schemas/applications.schema.json).
Set `status` to `AI_DELIBERATED` only after `aiAssessment` is complete. Include
the final credit memo and valuation in the assessment so the underwriter can
review them. AL-Web then sends the reviewed memo and valuation in the settlement
request above. The AI service must not call the settlement endpoint using an
underwriter identity or set the on-chain transaction fields itself.
