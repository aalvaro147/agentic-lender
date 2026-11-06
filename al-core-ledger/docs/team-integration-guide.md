# AL module integration guide

This guide explains how AL-Mobile, AL-Web and AL-AI connect to AL-Core. It is
the shared implementation checklist for the module owners. The API request and
response examples in [the integration contract](integration-api.md) and the
Firestore schemas and Security Rules remain authoritative if this overview
drifts.

## 1. Agree on the boundary before implementing

Use the following ownership split. Do not have two modules independently
advance the same application state or write the same decision fields.

| Module | Connects to | Owns |
|---|---|---|
| AL-Mobile | Firebase Authentication and Firestore client SDK | Borrower sign-in, application intake, and the borrower's own application/status views. |
| AL-Web borrower/broker views | Firebase Authentication and Firestore client SDK | Role-scoped application views and allowed intake edits. |
| AL-Web underwriter view | Firebase Authentication, Firestore client SDK, and Core REST API | Reviewing an AI-deliberated application and sending the underwriter's final approval or rejection to the Core API. |
| AL-AI Engine | Trusted backend using Firebase Admin SDK | Reading eligible applications and writing the AI assessment; changing status to `AI_DELIBERATED` only after the assessment is complete. |
| AL-Core API | Firebase Admin SDK and EVM JSON-RPC | Verifying identity and role, reserving the underwriter decision, recording audit data, settling approvals on-chain, and saving confirmed transaction metadata. |

### Shared application lifecycle

Use these exact, case-sensitive status strings:

```text
APPLIED -> AI_DELIBERATED -> UNDERWRITER_APPROVED -> FUNDED -> CLOSED
                         \-> REJECTED
```

`APPLIED` is created by a borrower or broker. The AI service moves an assessed
application to `AI_DELIBERATED`. The Core API reserves approval as
`UNDERWRITER_APPROVED` and records rejection as `REJECTED`. `FUNDED` and
`CLOSED` are later lifecycle states; do not infer that token minting itself
means funding has occurred.

The shared Firestore document is `applications/{applicationId}`. Its core
fields are:

```text
applicationId                 Firestore document ID
borrowerId                    Firebase UID
brokerId                      assigned Firebase UID, or null/omitted
status                        one of the lifecycle values above
financialSpecs                integer minor-unit amounts and requestedTermMonths
propertySpecs                 askingPriceMinorUnits, berRating, county, ...
aiAssessment                  AI recommendation and supporting outputs
underwriterApproval           written by Core API, not a client
underwriterDecision           written by Core API, not a client
blockchainTx                  written by Core API, not a client
createdAt, updatedAt          Firestore timestamps
```

The complete field constraints are in
[`applications.schema.json`](../firebase/schemas/applications.schema.json).
Keep field names and casing consistent with that schema and the existing
Firestore documents. Amounts are integer minor units (for example, euro cents),
APR is in basis points (`350` means 3.50%), and loan terms are months.

## 2. Connect each module

### AL-Mobile: borrower application and status

1. Sign in with Firebase Authentication and use the signed-in user's Firebase
   ID token through the Firebase client SDK.
2. Create `applications/{applicationId}` with `status: "APPLIED"`,
   `borrowerId` equal to the authenticated UID, the agreed `financialSpecs` and
   `propertySpecs`, and Firestore server timestamps.
3. Use the Firestore client SDK only for documents and fields allowed by the
   Security Rules. A borrower may edit financial/property inputs while the
   application is `APPLIED`; clients cannot set AI, approval, rejection, or
   blockchain results.
4. Display later status from Firestore. Use the Core API settlement GET route
   if the screen needs its normalized ledger result; follow the access rules in
   [the API contract](integration-api.md).

Do not put a Firebase Admin service-account file, EVM private key, or
`BORROWER_HASH_SECRET` in the app.

### AL-Web: broker and underwriter portal

1. Sign in with Firebase Authentication. Use Firestore client SDK queries for
   the broker's assigned applications and role-allowed reads; the Security
   Rules enforce ownership/assignment.
2. Create or edit intake fields only while the application is `APPLIED` and
   only within the allowed fields. Do not write `AI_DELIBERATED`,
   `UNDERWRITER_APPROVED`, `REJECTED`, `underwriterApproval`,
   `underwriterDecision`, `blockchainTx`, or `audit_logs` from the browser.
3. In the underwriter view, display the AI assessment and let an authorized
   underwriter review it. Obtain a fresh Firebase ID token with
   `await user.getIdToken()` and call the Core API with
   `Authorization: Bearer <id-token>`.
4. For approval, send `POST /v1/applications/{applicationId}/settlement` with
   the exact payload defined in [the API contract](integration-api.md):
   `approvedAt`, `creditMemo`, `valuation`, and `loan`. For rejection, send
   `POST /v1/applications/{applicationId}/rejection` with `rejectedAt` and
   `reason`. Both timestamps must include a timezone.
5. Handle non-2xx responses explicitly. In particular, show authentication,
   authorization, validation, conflict, and ledger-service errors rather than
   showing a success message. Keep the same request body when retrying a
   settlement.

The API base URL should come from the web app's environment configuration
(for example, `VITE_CORE_API_URL`); never embed credentials or private keys in
frontend environment variables. Local Vite origins must be included in the
Core API's exact CORS allow-list.

### AL-AI Engine: assessment write-back

1. Run the AI service as trusted backend code with a Firebase Admin credential;
   never ship that credential to AL-Mobile or AL-Web.
2. Read applications in `APPLIED` and use the agreed `financialSpecs` and
   `propertySpecs` as inputs. Treat missing or invalid required inputs as an
   assessment error, not as zero-valued data.
3. Write the completed result under `aiAssessment`. At minimum, include
   `recommendation` (`APPROVE`, `CONDITIONALLY_APPROVE`, or `DECLINE`) and
   `createdAt`; provide valuation, affordability, credit memo, and model
   version when available, using the documented schema.
4. Only after the assessment write succeeds, update the application to
   `AI_DELIBERATED` and update its timestamp. Do not approve/reject the loan,
   write `blockchainTx`, or call the contracts directly.
5. Coordinate status/idempotency behavior with AL-Core before adding retries or
   additional status values. Firebase Admin bypasses Firestore Security Rules,
   so enforce the intended state transition in the AI service itself.

`aiAssessment.recommendation` is an AI output, not the human underwriter's
decision. A `DECLINE` recommendation must still be reviewed and finalized via
the underwriter decision flow agreed by the team.

## 3. Authentication, Firestore, and privacy rules

- The Core API accepts Firebase **ID tokens**, not refresh tokens. Supported
  custom roles are `borrower`, `broker`, and `underwriter`. After an admin
  changes a user's role, that user must refresh/sign in again to receive a
  token with the new claim.
- Assign custom roles only through trusted administrator tooling. Never allow a
  client to set its own role.
- Firestore client SDK access is constrained by
  [`firestore.rules`](../firebase/firestore.rules). The API and trusted AI
  backend use Firebase Admin and therefore must enforce authorization and
  validation in their own code.
- Never send names, email addresses, account numbers, or raw Firebase UIDs to
  the blockchain. On-chain loan terms, BER, recipient address, token owner, and
  transaction data are public. The API uses a keyed borrower pseudonym and
  stores the approval proof hash; pseudonymization is not encryption.
- Keep secrets server-side and out of Git: Firebase service-account JSON,
  `.env`, `EVM_PRIVATE_KEY`, and `BORROWER_HASH_SECRET`.

## 4. Local integration and verification

Follow [the AL-Core README](../README.md) to install dependencies, configure
Firebase, deploy the local Hardhat contracts, and start the API. The API's
interactive documentation is available at `http://localhost:8000/docs` while
it is running. Use the local Firebase project/emulator or an explicitly
approved development Firebase project; do not test with real borrower data.

Before calling a module integrated, walk through this shared smoke-test:

1. A borrower or broker creates a valid `APPLIED` application.
2. An unauthorized user cannot read or edit that application.
3. The AI service writes a complete `aiAssessment` and then changes the status
   to `AI_DELIBERATED`.
4. The broker and underwriter views show the agreed inputs, status, and AI
   result, subject to their roles.
5. An underwriter approval with a valid ID token reaches the Core API; the API
   records the audit proof, mints the note on the local EVM, and returns a
   confirmed result.
6. A retry with the same approval payload does not create a second audit/token;
   a changed payload is rejected. An underwriter rejection follows the
   rejection endpoint and does not mint a token.
7. Invalid tokens, roles, input fields, and invalid state transitions produce
   visible errors and do not appear as successful decisions.

Run the relevant module tests as well as the Core tests (`npm test` and
`pytest` from `al-core-ledger`). A local contract/API test does not by itself
prove end-to-end integration with the mobile app, web portal, AI service, or a
deployed Firebase project; record which environment and path were actually
tested.

## 5. Team hand-off checklist

For each module, its owner should share:

- The branch/PR and a short description of the feature.
- Required environment variables (names only; share secret values securely,
  never in Git or chat).
- Which shared fields/endpoints it reads or writes.
- A screenshot or sample request/response using synthetic data.
- Tests run, outcome, known limitations, and anything another module owner
  needs to implement.

Raise proposed changes to shared field names, status values, or endpoint
payloads with the team before implementing them. Update the schema, API
contract, and all affected modules together when the team agrees to a change.
