# Agentic Lender (AL): Decentralized & AI-Assisted Loan Underwriting Platform

**Agentic Lender (AL)** is an intelligent, end-to-end mortgage and loan underwriting platform designed to streamline origination, automate property appraisal, provide AI-assisted deliberation, and ensure tamper-proof notarization on a distributed ledger.

---

## 📌 Project Overview & Modules

The platform is structured into four core subsystems that cover the complete lifecycle of a loan:

1. **📱 Mobile Application (`AL-Mobile`)**
   - **Role:** Retail Borrower Interface.
   - **Tech Stack:** Android / Kotlin.
   - **Functionality:** Provides prospective borrowers with an intuitive mobile UI to apply for loans, submit personal and financial credentials, input property specifications, and specify Building Energy Ratings (BER A1–A3) to access green loan incentives.

2. **💻 Web Portal (`AL-Web`)**
   - **Role:** Broker & Underwriter Operations.
   - **Tech Stack:** React, Vite.
   - **Functionality:** Centralized portal for mortgage brokers to manage their application pipeline and for bank underwriters to review loan details, evaluate AI deliberation logs, and sign off on credit decisions.

3. **🧠 AI Engine (`AL-AI Engine`)**
   - **Role:** Automated Valuation & Deliberation Committee.
   - **Tech Stack:** Python, Supervised Machine Learning & Multi-Agent Systems.
   - **Functionality:** 
     - **Supervised ML Model:** Automated Valuation Model (AVM) for objective property appraisal.
     - **Multi-Agent Deliberation Committee:** Orchestrates specialized agents (Affordability Agent, Valuation Agent, Market Search Agent with live data, and Underwriting Strategist Agent) to assess borrower affordability, stress-test risk profiles, and generate comprehensive credit memos.

4. **⛓️ Core Infrastructure & Ledger (`AL-Core` / `al-core-ledger`)**
   - **Role:** Centralized Data Layer, RBAC & Blockchain Settlement.
   - **Tech Stack:** Firebase Auth, Cloud Firestore, FastAPI / Firebase Admin / Web3.py, Hardhat, Solidity.
   - **Functionality:**
     - **Authentication & RBAC:** Firebase Authentication with custom claims (`borrower`, `broker`, `underwriter`).
     - **Database Layer:** Cloud Firestore maintaining stateful application records, user profiles, and audit trails.
     - **Integration API:** A Firebase-authenticated FastAPI service that hashes underwriter approvals, records audit proofs and coordinates loan-token minting.
     - **EVM Blockchain Ledger:** Ethereum-compatible smart contracts (`AuditRegistry.sol` for immutable audit logging and `LoanToken.sol` ERC-721 NFT for loan tokenization with green incentives).

---

## 🏗️ System Architecture & Workflow

Below is the technical overview and flowchart detailing module interactions, data flows, and subsystem boundaries:

```mermaid
graph TD
    classDef mobile fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    classDef web fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    classDef auth fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc
    classDef ai fill:#0f172a,stroke:#a855f7,stroke-width:2px,color:#f8fafc
    classDef glue fill:#0f172a,stroke:#f59e0b,stroke-width:2px,color:#f8fafc
    classDef ledger fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#f8fafc


    %% 1. MOBILE APP MODULE
    subgraph MODULE_MOBILE ["1. MOBILE APP (AL-Mobile)"]
        MobileApp["Android / Kotlin App<br/>• Retail Borrower Application Interface<br/>• Financial Inputs & Property Specs<br/>• BER Rating Selection (A1-A3)"]:::mobile
    end

    %% 2. WEB PORTAL MODULE
    subgraph MODULE_WEB ["2. WEB PORTAL (AL-Web)"]
        WebPortal["React Web Portal<br/>• Broker Application Queue<br/>• Underwriter Review UI<br/>• Decision Sign-off Console"]:::web
    end

    %% 3. CORE INFRASTRUCTURE (AL-Core)
    subgraph MODULE_CORE ["3. CORE INFRASTRUCTURE & LEDGER (AL-Core)"]
        
        subgraph AUTH ["Authentication & Data Layer"]
            FirebaseAuth["Firebase Auth<br/>(Custom Claims: Borrower, Broker, Underwriter)"]:::auth
            Firestore[("Cloud Firestore Database<br/>• /users (User Profiles & Roles)<br/>• /applications (State, Financials, Specs)<br/>• /audit_logs (Deliberation Logs & Sign-offs)")]:::auth
        end

        subgraph GLUE ["Integration API"]
            Listener["FastAPI Core Ledger API<br/>• Firebase ID-token / role validation<br/>• Canonical SHA-256 audit hashing<br/>• EVM transaction dispatch"]:::glue
        end

        subgraph LEDGER ["EVM Blockchain Ledger (al-core-ledger)"]
            AuditContract["AuditRegistry.sol<br/>• Stores SHA-256 Audit Hashes on-chain"]:::ledger
            LoanContract["LoanToken.sol (ERC-721 NFT)<br/>• Mints Loan Note<br/>• Applies Green Incentive (BER A1-A3)"]:::ledger
        end

    end

    %% 4. AI ENGINE MODULE
    subgraph MODULE_AI ["4. AI ENGINE (AL-AI Engine)"]
        ML["Supervised ML Model<br/>(Property Valuation)"]:::ai
        Agents["Multi-Agent Deliberation Committee<br/>• Affordability Agent<br/>• Valuation Agent<br/>• Market Search Agent (Live Data)<br/>• Underwriting Strategist Agent"]:::ai
    end

    %% Conexiones entre Módulos
    MobileApp --> FirebaseAuth
    WebPortal --> FirebaseAuth
    FirebaseAuth --> Firestore

    Firestore -- "1. Trigger / Read Payload" --> ML
    Firestore -- "1. Trigger / Read Payload" --> Agents
    ML -- "2. Write Valuation" --> Firestore
    Agents -- "2. Write Decision Logs" --> Firestore

    WebPortal -- "Underwriter approval + Firebase ID token" --> Listener
    Listener -- "Verify role / reserve approval / save receipt" --> Firestore
    Listener -- "JSON-RPC transaction" --> AuditContract
    Listener -- "JSON-RPC transaction" --> LoanContract
```

### 🔄 End-to-End Execution Flow

1. **Application Intake:** The borrower (via `AL-Mobile`) or broker (via `AL-Web`) authenticates through Firebase Auth and submits the mortgage application to Cloud Firestore.
2. **AI Valuation & Risk Deliberation:** Firestore events trigger the `AL-AI Engine`. The supervised ML model estimates property valuation, while the Multi-Agent Deliberation Committee stress-tests affordability and risk, storing valuation reports and decision logs back into Firestore.
3. **Underwriter Review & Sign-Off:** Human underwriters inspect the consolidated dossier and AI deliberations via `AL-Web` to finalize and sign off on the approval state.
4. **On-Chain Commit & Tokenization:** An authenticated underwriter submits approval through the Core Ledger API. The API hashes the canonical approval payload with SHA-256, records the proof in `AuditRegistry.sol`, and mints the note in `LoanToken.sol` (with green discounts for BER A1–A3). Confirmed transaction metadata is then saved to Firestore.

For the implementable API contract, local setup, diagrams, Firestore schemas and
role rules, see [`al-core-ledger/README.md`](al-core-ledger/README.md),
[`al-core-ledger/docs/architecture.md`](al-core-ledger/docs/architecture.md)
and [`al-core-ledger/docs/integration-api.md`](al-core-ledger/docs/integration-api.md).