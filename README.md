# agentic-lender
## Arquitectura del Sistema

```mermaid
graph TD
   graph TD
    %% Definición de estilos
    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc
    classDef auth fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc
    classDef ai fill:#0f172a,stroke:#a855f7,stroke-width:2px,color:#f8fafc
    classDef glue fill:#0f172a,stroke:#f59e0b,stroke-width:2px,color:#f8fafc
    classDef ledger fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#f8fafc

    %% 1. CLIENT LAYER
    subgraph CLIENT ["CLIENT LAYER"]
        Mobile["📱 AL-Mobile (Android / Kotlin)<br/>• Retail Borrower Application<br/>• Property Specs & BER Rating"]:::client
        Web["💻 AL-Web (React Portal)<br/>• Broker Queue & Underwriter UI<br/>• Decision Sign-off Console"]:::client
    end

    %% 2. AUTHENTICATION & DATA LAYER
    subgraph AUTH ["AUTHENTICATION & DATA LAYER (AL-CORE)"]
        FirebaseAuth["🔑 Firebase Auth<br/>(Custom Claims: Borrower, Broker, Underwriter)"]:::auth
        Firestore[("🗄️ Cloud Firestore Database<br/>• /users (User Profiles & Roles)<br/>• /applications (State, Financials, Specs)<br/>• /audit_logs (Deliberation Logs & Sign-offs)")]:::auth
    end

    %% 3. AL-AI ENGINE
    subgraph AI ["AL-AI ENGINE (Python Backend)"]
        ML["🤖 Supervised ML Model<br/>(Property Valuation)"]:::ai
        Agents["🧠 Multi-Agent Deliberation Committee<br/>• Affordability Agent<br/>• Valuation Agent<br/>• Market Search Agent (Live Data)<br/>• Underwriting Strategist Agent"]:::ai
    end

    %% 4. INTEGRATION GLUE LAYER
    subgraph GLUE ["INTEGRATION GLUE LAYER (AL-CORE)"]
        Listener["⚡ Python / Ethers.js Web3 Listener<br/>• SHA-256 Credit Memo Hashing Engine<br/>• Hardhat / Testnet Contract Dispatch"]:::glue
    end

    %% 5. EVM BLOCKCHAIN LEDGER
    subgraph LEDGER ["EVM BLOCKCHAIN LEDGER (AL-CORE)"]
        AuditContract["📜 AuditRegistry.sol<br/>• Stores SHA-256 Audit Hashes on-chain"]:::ledger
        LoanContract["🪙 LoanToken.sol (ERC-721 NFT)<br/>• Mints Loan Note<br/>• Applies Green Incentive (BER A1-A3)"]:::ledger
    end

    %% Flujos y Conexiones
    Mobile --> FirebaseAuth
    Web --> FirebaseAuth
    FirebaseAuth --> Firestore

    Firestore -- "1. Trigger / Read" --> AI
    AI -- "2. Write Results" --> Firestore

    Firestore -- "3. Trigger / Dispatch" --> Listener
    Listener -- "4. On-Chain Commit" --> AuditContract
    Listener -- "4. On-Chain Commit" --> LoanContract
```
