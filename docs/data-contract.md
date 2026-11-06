# AL Data Contract (draft v0.1 – for group agreement)

Shared shapes used by AL-Web, AL-Mobile, AL-Core and AL-AI Engine.
Change this file only through a pull request that all four members approve.

## users/{uid}

| Field | Type | Values / notes |
|---|---|---|
| displayName | string | |
| email | string | |
| role | string | `"broker"` \| `"underwriter"` |
| brokerId | string \| null | set for brokers, null for underwriters |

## applications/{id}

| Field | Type | Values / notes |
|---|---|---|
| borrowerName | string | |
| location | string | e.g. "Ballincollig, Co. Cork" |
| brokerId | string | broker who referred the client |
| brokerName | string | |
| loanAmount | number | euro, whole number |
| propertyValuation | number | euro, from the ML valuation model |
| annualIncome | number | euro, gross |
| ltv | number | percent, 1 decimal (90.0 = 90%) |
| lti | number | multiple, 2 decimals |
| dti | number | percent, 1 decimal |
| riskTier | string | `"low"` \| `"medium"` \| `"high"` |
| status | string | `"applied"` \| `"ai_deliberated"` \| `"underwriter_approved"` \| `"funded"` \| `"closed"` |
| submittedAt | string | ISO date `YYYY-MM-DD` |

## Security rules (AL-Core)

- A broker can read only applications where `brokerId` matches their own profile.
- Only `underwriter` users can change `status` to `underwriter_approved`.

## Open questions

- Add `declined` and `conditionally_approved` statuses?
- Who calculates ltv / lti / dti: AL-AI Engine or AL-Core?