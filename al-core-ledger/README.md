# AL-Core & Ledger

AL-Core provides Firebase-backed application data and role checks, plus an
authenticated REST boundary for writing approved loan records to an EVM
network. The contracts keep the public audit proof and ERC-721 loan note; the
API keeps private application data in Firestore.

## What is implemented

* Firebase custom claims for `borrower`, `broker`, and `underwriter`.
* Firestore collection schemas and role-scoped Security Rules.
* `AuditRegistry.sol`, which stores one immutable SHA-256 digest per application.
* `LoanToken.sol`, an ERC-721 note recording principal in minor units, APR in
  basis points, term, BER and a keyed borrower pseudonym. BER A1/A2/A3 receive
  the required 25-basis-point discount.
* FastAPI routes for reading settlement state and for the underwriter approval
  to audit/token settlement flow, and for recording a declined decision.
* Hardhat local deployment and contract tests.

See [the architecture diagrams](docs/architecture.md) and
[the integration/API contract](docs/integration-api.md) before connecting
another subsystem. The
[team integration guide](docs/team-integration-guide.md) assigns each module's
responsibilities and provides a shared integration checklist.

## Local setup

Requirements: Node.js 20+, npm, Python 3.11+, a Firebase project with
Authentication and Firestore enabled, and an administrator service-account
JSON file. Do not commit the service-account JSON, `.env`, private keys or
deployed addresses.

### 1. Install and deploy the local contracts

```bash
cd al-core-ledger
npm ci
npm run compile
```

In terminal 1, start the local EVM:

```bash
npm run node
```

In terminal 2, copy `.env.example` to `.env`, then deploy:

```bash
npm run deploy:localhost
```

Copy the `auditRegistry` and `loanToken` addresses printed by deployment into
`.env`. For a local node, leave `EVM_PRIVATE_KEY` blank and leave
`EVM_SENDER_ADDRESS` blank to use the first unlocked Hardhat account. The
deployer has the required roles by default. If `API_SIGNER_ADDRESS` is set
before deployment, the deployer grants it `AUDITOR_ROLE` and `MINTER_ROLE`.

### 2. Configure Firebase and role claims

Install the Python dependencies before running the privileged role-management
script:

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Place the Firebase Admin service-account file at the path configured by
`FIREBASE_SERVICE_ACCOUNT_PATH`. Set `FIREBASE_PROJECT_ID`, then assign roles
with an administrator credential:

```bash
export FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
.venv/bin/python scripts/set_firebase_role.py FIREBASE_UID underwriter
```

Use the allowed roles `borrower`, `broker` and `underwriter`. This operation
requires trusted administrative access. The user must sign in again or refresh
their Firebase ID token before the custom claim is present. Deploy the Firestore
rules to the selected Firebase project:

```bash
npm install --global firebase-tools
firebase use --add
firebase deploy --only firestore:rules
```

Do not grant an underwriter role to an account used by borrowers or brokers.
Custom claims are authorization data and must only be assigned by trusted
administrators.

### 3. Run the Core API

Set a unique borrower pseudonymization secret (at least 32 random bytes), for
example with `openssl rand -hex 32`, then set the local RPC URL, chain ID,
contract addresses, Firebase credentials and API CORS origins in `.env`.
`CONTRACT_ARTIFACTS_DIR` defaults to `./artifacts`.

```bash
. .venv/bin/activate
uvicorn api.main:app --reload --env-file .env --host 127.0.0.1 --port 8000
```

The API checks Firebase credentials, EVM connectivity, chain ID, deployed
contract code, artifacts and writer roles during startup. Configuration errors
stop startup rather than allowing a partial or success-shaped service. Visit
`http://localhost:8000/docs` for the generated OpenAPI page. `GET /health` is
the unauthenticated liveness check.

For a manual integration test, save a settlement request matching
[`integration-api.md`](docs/integration-api.md) to a JSON file, then set
`CORE_API_URL` and `FIREBASE_ID_TOKEN` in the shell and run:

```bash
python scripts/web3_integration_hook.py APP-10042 ./settlement-request.json
```

The helper is an HTTP client only; it does not claim success or sign EVM
transactions itself.

### 4. Test

```bash
npm test
pytest
```

Hardhat tests cover authorization, immutability, validation, token ownership
and BER incentives. Python tests cover canonical audit hashing and stable
pseudonym/token derivation. A live end-to-end approval also requires a Firebase
project, assigned test roles, a running Hardhat node, and deployed addresses.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes | Firebase Admin service-account JSON path (server only). |
| `FIREBASE_PROJECT_ID` | Recommended | Firebase project ID. |
| `BORROWER_HASH_SECRET` | Yes | Private secret used to derive a stable HMAC-SHA-256 borrower pseudonym. |
| `EVM_RPC_URL` | Yes | JSON-RPC endpoint. |
| `EVM_CHAIN_ID` | Recommended | Refuse startup if the RPC is connected to the wrong chain. |
| `AUDIT_REGISTRY_ADDRESS` | Yes | Deployed `AuditRegistry` address. |
| `LOAN_TOKEN_ADDRESS` | Yes | Deployed `LoanToken` address. |
| `EVM_PRIVATE_KEY` | For remote RPC | Server-side signer key; omit for an unlocked local development account. |
| `EVM_SENDER_ADDRESS` | Optional | Unlocked local writer account when no private key is supplied. |
| `API_SIGNER_ADDRESS` | Optional | Address to receive contract writer roles during deployment. |
| `API_CORS_ORIGINS` | Optional | Comma-separated exact browser origins; defaults to local Vite origins. |
| `EVM_CONFIRMATION_TIMEOUT_SECONDS` | Optional | Time to wait for each transaction receipt (default `120`). |

Use a unique secret and a restricted signer for each environment. Never put
Firebase Admin credentials or an EVM private key in AL-Web, AL-Mobile, source
control, or a public test fixture.

## Important contract/API behavior

* The API hashes a versioned canonical JSON representation of application ID,
  underwriter UID, approval time, memo, valuation and approved loan terms.
* Only the SHA-256 digest and pseudonymous loan fields are written on-chain.
  Principal, APR, term, BER, recipient address and token owner are public
  blockchain data.
* The API stores transaction status and hashes in Firestore only after receipt
  confirmation. A same-payload retry resumes a partial settlement safely.
* Values on-chain cannot be edited or deleted. A changed approval payload for
  the same application is rejected rather than overwriting the audit record.
