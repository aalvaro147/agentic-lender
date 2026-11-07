"""Firestore adapter stub: APPLIED -> aiAssessment -> AI_DELIBERATED.

FirestoreStore is a draft and has not been run against a real project or
emulator. Admin SDK writes bypass security rules, so every state check is
enforced here. Never read or write blockchainTx, underwriter* fields or
approval/rejection statuses.
"""
import logging
import os
from typing import Protocol

from pydantic import ValidationError

from .mock_service import assess
from .schemas import AssessmentInput

log = logging.getLogger("al_ai_engine.adapter")


class ApplicationStore(Protocol):
    def list_applied_ids(self) -> list[str]: ...
    def get(self, application_id: str) -> dict | None: ...
    def save_assessment_and_advance(self, application_id: str, assessment: dict) -> bool: ...


class InMemoryStore:
    """Local mode: no Firebase keys needed."""

    def __init__(self, docs: dict[str, dict]):
        self.docs = docs

    def list_applied_ids(self):
        return [i for i, d in self.docs.items() if d.get("status") == "APPLIED"]

    def get(self, application_id):
        return self.docs.get(application_id)

    def save_assessment_and_advance(self, application_id, assessment):
        doc = self.docs[application_id]
        if doc.get("status") != "APPLIED" or doc.get("aiAssessment"):
            return False
        doc["aiAssessment"] = assessment       # 1. write the assessment
        doc["status"] = "AI_DELIBERATED"       # 2. only then advance status
        return True


class FirestoreStore:
    """Requires `pip install firebase-admin` and FIREBASE_SERVICE_ACCOUNT_PATH."""

    def __init__(self):
        import firebase_admin
        from firebase_admin import credentials, firestore

        self._fs = firestore
        if not firebase_admin._apps:
            cred = credentials.Certificate(os.environ["FIREBASE_SERVICE_ACCOUNT_PATH"])
            firebase_admin.initialize_app(cred)
        self._col = firestore.client().collection("applications")

    def list_applied_ids(self):
        return [d.id for d in self._col.where("status", "==", "APPLIED").stream()]

    def get(self, application_id):
        snap = self._col.document(application_id).get()
        return snap.to_dict() if snap.exists else None

    def save_assessment_and_advance(self, application_id, assessment):
        ref = self._col.document(application_id)
        current = ref.get().to_dict() or {}
        if current.get("status") != "APPLIED" or current.get("aiAssessment"):
            return False
        ref.update({"aiAssessment": assessment})
        ref.update({
            "status": "AI_DELIBERATED",
            "updatedAt": self._fs.SERVER_TIMESTAMP,
        })
        return True


def process_application(store: ApplicationStore, application_id: str) -> str:
    doc = store.get(application_id)
    if doc is None or doc.get("status") != "APPLIED" or doc.get("aiAssessment"):
        return "skipped"
    try:
        data = AssessmentInput(
            applicationId=application_id,  # Firestore document ID
            financialSpecs=doc.get("financialSpecs") or {},
            propertySpecs=doc.get("propertySpecs") or {},
        )
    except ValidationError as exc:
        # Missing/invalid inputs are an assessment error: leave APPLIED, no zeros
        log.error("Application %s invalid: %s", application_id, exc.errors())
        return "invalid"
    assessment = assess(data).model_dump(mode="python", exclude_none=True)
    return "assessed" if store.save_assessment_and_advance(application_id, assessment) else "skipped"


def run_once(store: ApplicationStore) -> dict[str, str]:
    return {i: process_application(store, i) for i in store.list_applied_ids()}


if __name__ == "__main__":  # local demo: python -m al_ai_engine.firestore_adapter
    logging.basicConfig(level=logging.INFO)
    sample = {
        "APP-0001": {
            "status": "APPLIED",
            "borrowerId": "ignored-by-engine",
            "financialSpecs": {
                "loanAmountMinorUnits": 28000000,
                "requestedTermMonths": 300,
                "netMonthlyIncomeMinorUnits": 650000,
                "monthlyExpensesMinorUnits": 180000,
                "existingMonthlyDebtMinorUnits": 20000,
            },
            "propertySpecs": {
                "askingPriceMinorUnits": 35000000,
                "berRating": "B2",
                "county": "Dublin",
            },
        },
        "APP-0002": {"status": "APPLIED", "financialSpecs": {}, "propertySpecs": {}},
    }
    store = InMemoryStore(sample)
    print(run_once(store))
    print(sample["APP-0001"]["status"], sample["APP-0001"]["aiAssessment"]["recommendation"])