# AL-Web – Broker & Underwriter Portal

React web portal for **AL (Agentic Lender)**: mortgage brokers and bank underwriting officers
manage loan pipelines, inspect AI agent reasoning and approve loans on-chain.

## Stack
React · Vite · React Router · Tailwind CSS · Firebase (Auth, Firestore) · Vitest · Oxlint · Prettier

## Requirements
- Node.js 24 LTS (`node -v`)
- npm 11+

## Setup
```bash
cd web
npm install
cp .env.example .env     # VITE_USE_MOCKS=true works without Firebase keys
npm run dev              # http://localhost:5173
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Oxlint |
| `npm run format` | Prettier: format all files |
| `npm test` | Vitest in watch mode |
| `npm run test:run` | Vitest once (used by CI) |

## Environment variables
| Variable | Purpose |
|---|---|
| `VITE_USE_MOCKS` | `true` = mock data from `src/mocks/`, `false` = live Firebase |
| `VITE_FIREBASE_*` | Firebase web config from the group project (never commit `.env`) |

## Mock accounts (VITE_USE_MOCKS=true)
| Email | Password | Role |
|---|---|---|
| orla.hennessy@bank.example | password123 | Underwriter |
| ciaran.oneill@broker.example | password123 | Broker |
| emma.byrne@broker.example | password123 | Broker |

## Project structure
```
src/
├── auth/       Auth context, role rules, protected routes
├── services/   All data access (mock or Firebase)
├── mocks/      Mock JSON matching docs/data-contract.md
└── test/       Test setup
```

Data contract: [`docs/data-contract.md`](../docs/data-contract.md)