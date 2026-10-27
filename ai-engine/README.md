# AL AI Engine (Predictive ML & Multi-Agent Committee)

An independent Python microservice for property valuation, affordability stress-testing, and credit recommendation deliberation.

## Current Sprint 1 Status
- **Progress:** Foundation & Mock Assessment Service (~15-20%)
- **Service Type:** FastAPI REST API
- **Execution Mode:** Mock mode active (`is_mock: true`) — valuation uses placeholder rules while regression pipeline and LangGraph agents are in development.
- **Data Boundary:** Processes strictly anonymous property specs and loan terms. Borrower identity is excluded (`application_id` is an untracked pass-through reference).

## Quick Start

### 1. Environment Setup
```bash
python -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn al_ai_engine.main:app --reload

Open http://127.0.0.1:8000/docs