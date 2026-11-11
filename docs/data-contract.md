# AL Data Contract (v0.3)

How AL-Web reads and displays the shared AL data. Prepared by AL-Web for group agreement.

- **Source of truth:** AL-Core's JSON schemas in
  `al-core-ledger/firebase/schemas/` (`applications.schema.json`, `users.schema.json`) and
  the API contract in `al-core-ledger/docs/integration-api.md`. If this file and those
  disagree, **the schemas win** and this file must be corrected.
- **Agreed (group, Nov 2026):** the whole project uses the AL-Core schemas; the AI engine is
  being aligned to them.
- **Change process:** change shared field names through a pull request reviewed by the
  module owners (team-integration-guide.md, section 5).
- **Temporary items** are marked `TEMP(<tag>)` in the code. List them with
  `grep -rn "TEMP(" web/src docs`. The register is in section 10.

## 1. Units and conventions

| Kind            | Stored as                     | Example                | AL-Web shows   |
| --------------- | ----------------------------- | ---------------------- | -------------- |
| Money           | integer cents ("minor units") | `34200000`             | €342,000       |
| Rates, LTV, DTI | integer basis points (bps)    | `8926` (100 bps = 1%)  | 89.3%          |
| APR             | integer bps                   | `350`                  | 3.50%          |
| Term            | integer months                | `360`                  | 360 months     |
| Dates           | ISO 8601 date-time with zone  | `2026-10-08T09:30:00Z` | 08 Oct 2026    |
| Status, roles   | exact strings (case matters)  | `AI_DELIBERATED`       | AI Deliberated |
| Missing value   | field absent or `null`        | no `aiAssessment` yet  | —              |

AL-Web never turns a missing value into `0` (team-integration-guide.md: "missing or invalid
required inputs" are an error, "not zero-valued data").

## 2. `users/{uid}`

Required: `uid`, `email`, `role`, `createdAt`. No other fields allowed
(`additionalProperties: false`).

| Field           | Type   | Values / notes                                   |
| --------------- | ------ | ------------------------------------------------ |
| `uid`           | string | Firebase Authentication UID                      |
| `email`         | string | email format                                     |
| `role`          | string | `borrower` \| `broker` \| `underwriter`          |
| `displayName`   | string | optional                                         |
| `walletAddress` | string | optional, `0x` + 40 hex; the loan note recipient |
| `createdAt`     | string | date-time                                        |

- A broker is identified by their **uid**. There is no `brokerId` field on the profile
  (v0.1 had one; removed).
- The role used for access control is the Firebase custom claim `role`; the profile field
  mirrors it.
- **Read access (firestore.rules):** a user reads their own profile; an underwriter reads
  any profile. A broker cannot read borrowers' profiles (see Q3).

## 3. `applications/{applicationId}`

Required: `applicationId`, `borrowerId`, `status`, `createdAt`. No other top-level fields
allowed.

| Field                 | Type           | Values / notes                                              |
| --------------------- | -------------- | ----------------------------------------------------------- |
| `applicationId`       | string         | same as the document ID                                     |
| `borrowerId`          | string         | borrower's uid                                              |
| `brokerId`            | string \| null | assigned broker's uid; `null` if the borrower applied alone |
| `status`              | string         | see section 4                                               |
| `financialSpecs`      | object         | see below                                                   |
| `propertySpecs`       | object         | see below                                                   |
| `aiAssessment`        | object \| null | written by the AI service (section 5)                       |
| `underwriterApproval` | object \| null | written by the Core API on approval                         |
| `underwriterDecision` | object \| null | written by the Core API on rejection                        |
| `blockchainTx`        | object \| null | written by the Core API after settlement                    |
| `createdAt`           | string         | date-time                                                   |
| `updatedAt`           | string         | date-time, optional                                         |

**`financialSpecs`** (all required, integers ≥ 0)

| Field                    | Notes                                                |
| ------------------------ | ---------------------------------------------------- |
| `grossIncomeMinorUnits`  | period not stated yet (Q2); AL-Web mocks use annual  |
| `existingDebtMinorUnits` | period not stated yet (Q2); AL-Web mocks use monthly |
| `depositMinorUnits`      |                                                      |
| `requestedTermMonths`    | 1 to 600                                             |

**`propertySpecs`**

| Field                   | Required | Notes                         |
| ----------------------- | -------- | ----------------------------- |
| `askingPriceMinorUnits` | yes      |                               |
| `berRating`             | yes      | `A1`–`G` or `UNKNOWN`         |
| `county`                | yes      | county only, no town ("Cork") |
| `floorAreaSquareMetres` | no       | number                        |
| `bedrooms`              | no       | integer ≥ 0                   |
| `propertyType`          | no       | free text                     |

**`underwriterApproval`**: `approvedBy` (uid), `approvedAt`, `auditHash` (`0x` + 64 hex).
**`underwriterDecision`**: `decision` (`REJECTED`), `rejectedBy`, `rejectedAt`,
`rejectionHash`.
**`blockchainTx`**: `status` (`PENDING` \| `CONFIRMED` \| `FAILED`), `auditHash`, plus
optional `chainId`, `applicationIdHash`, `tokenId`, `auditTxHash`, `loanTxHash`,
`blockNumber`.

## 4. Lifecycle and who writes what

```text
APPLIED -> AI_DELIBERATED -> UNDERWRITER_APPROVED -> FUNDED -> CLOSED
                         \-> REJECTED
```

| Status                 | Set by                                           |
| ---------------------- | ------------------------------------------------ |
| `APPLIED`              | borrower or broker (client SDK)                  |
| `AI_DELIBERATED`       | AI service, after `aiAssessment` is complete     |
| `UNDERWRITER_APPROVED` | Core API (`POST …/settlement`), underwriter only |
| `REJECTED`             | Core API (`POST …/rejection`), underwriter only  |
| `FUNDED`, `CLOSED`     | later lifecycle states; minting alone ≠ funded   |

**AL-Web never writes** `AI_DELIBERATED`, `UNDERWRITER_APPROVED`, `REJECTED`,
`underwriterApproval`, `underwriterDecision`, `blockchainTx` or `audit_logs` from the
browser. Approval and rejection go through the Core API (section 7).

## 5. `aiAssessment`

AL-Core requires only `recommendation` and `createdAt`; `valuation` and `affordability`
are open objects. The fields AL-Web reads come from the AI engine's output (version
`mock-0.2`, PR #11) and are **provisional** (`TEMP(AI-FIELDS)`).

| Field                                                 | Source  | Used by AL-Web for                                                            |
| ----------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| `recommendation`                                      | AL-Core | `APPROVE` \| `CONDITIONALLY_APPROVE` \| `DECLINE`; provisional risk tier (D3) |
| `createdAt`, `modelVersion`, `creditMemo`             | AL-Core | audit console, credit memo (WEB-36)                                           |
| `valuation.estimatedValueMinorUnits`                  | AI      | asking price vs valuation (WEB-27)                                            |
| `valuation.ltvBps`, `currency`, `modelVersion`        | AI      | pipeline LTV; settlement request                                              |
| `affordability.dtiBps`                                | AI      | pipeline DTI (WEB-28)                                                         |
| `affordability.loanToIncomeMultiple`                  | AI      | pipeline LTI                                                                  |
| `affordability.aprBps`                                | AI      | APR **after** any BER discount (see Q5)                                       |
| `affordability.monthlyRepaymentMinorUnits`            | AI      | DTI breakdown (WEB-28)                                                        |
| `affordability.disposableSurplusMinorUnits`           | AI      | DTI breakdown (WEB-28)                                                        |
| `affordability.stressTests[]`                         | AI      | +100/+200/+300 bps results (E5 stress test)                                   |
| `affordability.assumptions[]`, `isMock`, `warnings[]` | AI      | shown as notes on the AI screens                                              |

Engine definitions (mock-0.2): LTV uses the lower of asking price and valuation;
DTI = (new repayment + existing debt) ÷ net monthly income.

## 6. AL-Web pipeline row (`services/applicationMapper.js`)

Mock and live data both pass through `toPipelineRow(doc, usersById)`. Units are kept as
stored; formatting happens only in `utils/format.js`.

| Row field              | Source                                              | Missing →   |
| ---------------------- | --------------------------------------------------- | ----------- |
| `id`                   | `applicationId` (mock) or document ID (live)        | —           |
| `status`               | `status`                                            | —           |
| `borrowerName`         | `users/{borrowerId}.displayName` (`TEMP(Q3-NAMES)`) | `null`      |
| `brokerId`             | `brokerId`                                          | `null`      |
| `brokerName`           | `users/{brokerId}.displayName` (`TEMP(Q3-NAMES)`)   | `null`      |
| `location`             | `"Co. " + propertySpecs.county`                     | `null`      |
| `loanAmountMinorUnits` | asking price − deposit (`TEMP(Q1-LOAN)`)            | `null`      |
| `ltvBps`               | `aiAssessment.valuation.ltvBps`                     | `null` (D2) |
| `dtiBps`, `lti`        | `aiAssessment.affordability.*` (`TEMP(AI-FIELDS)`)  | `null` (D2) |
| `recommendation`       | `aiAssessment.recommendation`                       | `null`      |
| `riskTier`             | from recommendation (`TEMP(Q4-RISK)`, D3)           | `null`      |
| `submittedAt`          | `createdAt` (ISO string or Firestore Timestamp)     | `null`      |

Broker filter: `where('brokerId', '==', profile.uid)`, the same rule firestore.rules
enforces. Only an underwriter loads `users` for names.

### Loan file (`toLoanFile`, WEB-26, WEB-30)

`getApplication(profile, applicationId)` returns the pipeline row above plus `property`,
or `null` when the application cannot be shown. An unknown ID and another broker's
application both return `null` (D5); live mode treats Firestore `permission-denied` the
same way.

| `property` field        | Source                                | Missing → |
| ----------------------- | ------------------------------------- | --------- |
| `location`              | `"Co. " + propertySpecs.county`       | `null`    |
| `propertyType`          | `propertySpecs.propertyType`          | `null`    |
| `bedrooms`              | `propertySpecs.bedrooms`              | `null`    |
| `floorAreaSquareMetres` | `propertySpecs.floorAreaSquareMetres` | `null`    |
| `berRating`             | `propertySpecs.berRating`             | `null`    |

## 7. Core API calls AL-Web will make (WEB-42, WEB-43)

Base URL from `VITE_CORE_API_URL` (local: `http://localhost:8000`). Every call sends
`Authorization: Bearer <Firebase ID token>`. The approve/reject actions are shown only to
an underwriter; the API re-checks the role.

### `POST /v1/applications/{applicationId}/settlement`

Allowed only when the application is `AI_DELIBERATED`. Example request
(from integration-api.md):

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

Where AL-Web takes each value:

| Request field              | AL-Web source                                             | Status |
| -------------------------- | --------------------------------------------------------- | ------ |
| `approvedAt`               | time of the underwriter's confirmation, with zone         | agreed |
| `creditMemo`               | `aiAssessment.creditMemo`, as reviewed by the underwriter | agreed |
| `valuation`                | `aiAssessment.valuation` (same four fields)               | agreed |
| `loan.principalMinorUnits` | no stored field yet                                       | **Q1** |
| `loan.baseAprBps`          | base APR **before** the BER discount                      | **Q5** |
| `loan.termMonths`          | `financialSpecs.requestedTermMonths`                      | agreed |
| `loan.berRating`           | `propertySpecs.berRating`                                 | agreed |
| `loan.recipientAddress`    | `users/{borrowerId}.walletAddress` (underwriter read)     | agreed |

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

A retry must send the **same body**, including `approvedAt`. `auditTxHash` or
`loanTxHash` may be `null` on a successful retry.

### `POST /v1/applications/{applicationId}/rejection`

Allowed only when the application is `AI_DELIBERATED`. The reason stays in a restricted
audit log, not on-chain.

```json
{
  "rejectedAt": "2026-11-05T16:00:00Z",
  "reason": "The verified affordability assessment does not meet the lending criteria."
}
```

```json
{
  "applicationId": "APP-10042",
  "status": "REJECTED",
  "rejectionHash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "idempotentRetry": false
}
```

### Errors AL-Web must show explicitly

| HTTP | `detail.code`                                                                                                                                                 | AL-Web action                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 401  | `AUTH_REQUIRED`, `INVALID_TOKEN`                                                                                                                              | ask the user to sign in again                                |
| 403  | `UNDERWRITER_REQUIRED`, `APPLICATION_FORBIDDEN`, `ROLE_REQUIRED`                                                                                              | "Not authorised" message                                     |
| 404  | `APPLICATION_NOT_FOUND`                                                                                                                                       | "Application not found"                                      |
| 409  | `APPLICATION_NOT_READY`, `APPLICATION_INVALID`, `APPROVAL_ALREADY_RECORDED`, `DECISION_ALREADY_RECORDED`, `ON_CHAIN_AUDIT_MISMATCH`, `ON_CHAIN_LOAN_MISMATCH` | refresh the application; never retry with a changed decision |
| 422  | validation error, `INVALID_AUDIT_PAYLOAD`                                                                                                                     | show the field problem                                       |
| 502  | `LEDGER_SETTLEMENT_FAILED`                                                                                                                                    | offer "Retry" with the same payload                          |

## 8. Decisions (AL-Web)

| #   | Decision                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | AL-Web uses AL-Core's uppercase status codes everywhere; no translation layer                                                               |
| D2  | LTV, LTI, DTI and risk show "—" until the AI has run; AL-Web does not calculate them                                                        |
| D3  | Until the AI returns a risk tier, AL-Web derives one from the recommendation: APPROVE → Low, CONDITIONALLY_APPROVE → Medium, DECLINE → High |
| D4  | Mocks include one sample per status, including a `REJECTED` application                                                                     |
| D5  | A broker opening another broker's application sees the same "Application not found" as for an unknown ID (11 Nov)                           |
| D6  | WEB-26 and WEB-30 are delivered together (11 Nov)                                                                                           |
| D7  | The loan file shows labelled placeholders for sections built in later stories (WEB-27, 28, 29, 31) (11 Nov)                                 |

## 9. Open questions

| #   | Question                                                                                                                                                                               | Owner        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Q1  | Where is the loan amount stored? Settlement needs `loan.principalMinorUnits`. Confirm "asking price − deposit" or add a field                                                          | AL-Core      |
| Q2  | Is `grossIncomeMinorUnits` monthly or annual? Is `existingDebtMinorUnits` a monthly repayment or a total balance?                                                                      | AL-Core      |
| Q3  | How does a broker see client names? Rules block `users/{borrowerId}` for brokers                                                                                                       | AL-Core      |
| Q4  | Will the AI return a risk tier, and with which values?                                                                                                                                 | AI + group   |
| Q5  | Which value is `loan.baseAprBps`? The AI's `affordability.aprBps` already includes the 25 bps BER A1–A3 discount, and the contract subtracts it again; sending it would discount twice | AI + AL-Core |

Resolved since v0.1: statuses (`REJECTED` added, uppercase), who calculates LTV/LTI/DTI
(the AI engine).

## 10. Temporary items register

| Tag               | What is temporary                                                  | Files                                                                                | Permanent when                      |
| ----------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------- |
| `TEMP(Q1-LOAN)`   | loan = asking price − deposit                                      | `services/applicationMapper.js`, `pages/PipelinePage.jsx`, `\pages/LoanFilePage.jsx` | Q1 answered                         |
| `TEMP(Q2-PERIOD)` | mock income annual, mock debt monthly                              | `mocks/README.md`                                                                    | Q2 answered                         |
| `TEMP(Q3-NAMES)`  | names from `users/{uid}`; mock mode shows them to brokers          | `services/applicationMapper.js`, `services/applicationService.js`                    | Q3 answered                         |
| `TEMP(Q4-RISK)`   | risk tier derived from the recommendation (D3)                     | `services/applicationMapper.js`, `utils/statuses.js`                                 | Q4 answered                         |
| `TEMP(AI-FIELDS)` | `affordability.dtiBps`, `loanToIncomeMultiple` names               | `services/applicationMapper.js`                                                      | AI's Core-aligned version merged    |
| `TEMP(AI-MOCK)`   | mock `aiAssessment` generated by `mock-0.2` from translated inputs | `services/applicationService.js`, `mocks/README.md`                                  | mocks regenerated with that version |

Resolved: `TEMP(OLD-MOCKS)` (`formatEuro` removed in WEB-08).

## 11. Mock data

`web/src/mocks/` holds 8 applications (one per status, plus a second `APPLIED` and
`AI_DELIBERATED`) and 12 users. Both files were checked against AL-Core's JSON schemas on
11 Nov 2026: **0 errors** (users checked with the mock-only `password` field removed).
Details and temporary notes: `web/src/mocks/README.md`.

## Change log

| Version | Date        | Change                                                                                          |
| ------- | ----------- | ----------------------------------------------------------------------------------------------- |
| v0.1    | Oct 2026    | AL-Web draft: lowercase statuses, euros and percentages                                         |
| v0.2    | 11 Nov 2026 | Aligned with AL-Core schemas and API; AI fields; mapping; decisions D1–D4; Q1–Q5; TEMP register |
| v0.3    | 11 Nov 2026 | Loan file mapping (WEB-26, WEB-30); decisions D5–D7                                             |
