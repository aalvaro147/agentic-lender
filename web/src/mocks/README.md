# AL-Web mock data

Used when `VITE_USE_MOCKS=true` (local development and every automated test).
Mock **mode** is permanent; the mock **content** below is temporary where marked
`TEMP(...)`. JSON files cannot hold comments, so the notes live here.
All people, addresses and hashes are synthetic.

## applications.json

Eight documents in the exact AL-Core shape of `applications/{applicationId}`
(`al-core-ledger/firebase/schemas/applications.schema.json`): uppercase statuses,
amounts in cents, `financialSpecs` with only the four AL-Core fields.

| Application                | Status                 | Sample of                                                |
| -------------------------- | ---------------------- | -------------------------------------------------------- |
| AL-2026-0146, AL-2026-0142 | `APPLIED`              | No `aiAssessment` yet                                    |
| AL-2026-0148, AL-2026-0144 | `AI_DELIBERATED`       | Deliberation mock (`aiAssessment`)                       |
| AL-2026-0147               | `UNDERWRITER_APPROVED` | `underwriterApproval` + `blockchainTx` (settlement mock) |
| AL-2026-0145               | `FUNDED`               | as above                                                 |
| AL-2026-0143               | `CLOSED`               | as above                                                 |
| AL-2026-0149               | `REJECTED`             | `underwriterDecision`                                    |

- **TEMP(AI-MOCK):** each `aiAssessment` is real output of the AI engine version
  `mock-0.2` (PR #11). That version still expects its old inputs, so the AL-Core
  values were translated before running it: loan = asking price − deposit,
  net monthly income = `grossIncomeMinorUnits` ÷ 12, monthly expenses = 0,
  monthly debt = `existingDebtMinorUnits`. Regenerate these when the AI engine
  reads AL-Core fields directly.
- **TEMP(Q2-PERIOD):** `grossIncomeMinorUnits` is written as an **annual** amount and
  `existingDebtMinorUnits` as a **monthly** repayment. AL-Core has not stated the
  periods yet; adjust the values when it does.
- Hashes, token IDs and block numbers in `underwriterApproval`, `underwriterDecision`
  and `blockchainTx` are made-up SHA-256 values, not real transactions.

## users.json

Profiles in the AL-Core `users/{uid}` shape: `uid`, `email`, `role`, `displayName`,
`createdAt`, plus `walletAddress` for borrowers.

- A broker is identified by their **uid**; applications store it in `brokerId`.
- `password` exists only so mock sign-in works. It is not an AL-Core field and
  real passwords never go into Firestore (Firebase Authentication holds them).
- Borrowers have no password: they use AL-Mobile, not AL-Web.

| Account                      | Role               | Password    |
| ---------------------------- | ------------------ | ----------- |
| orla.hennessy@bank.example   | underwriter        | password123 |
| ciaran.oneill@broker.example | broker (3 clients) | password123 |
| emma.byrne@broker.example    | broker (2 clients) | password123 |
| sean.kelly@broker.example    | broker (3 clients) | password123 |
