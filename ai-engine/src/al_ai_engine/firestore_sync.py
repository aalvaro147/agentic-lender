"""Firestore sync for the AL AI Engine.

Polls applications/{docId} where status == PENDING_STATUS, runs the mock
assessment and writes the result back as `aiAssessment` with status
AI_DELIBERATED. The Firestore document ID is the application ID and field
names follow schemas.py (camelCase). Enabled via AI_SYNC_ENABLED=true.
"""
import asyncio
import logging
import os

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import FieldFilter

from .mock_service import assess
from .schemas import AssessmentInput

log = logging.getLogger("al_ai_engine.firestore_sync")

PENDING_STATUS = "SUBMITTED"     # TODO: confirm pre-AI status in docs/data-contract.md
DONE_STATUS = "AI_DELIBERATED"   # matches web/src/utils/statuses.js
COLLECTION = "applications"

_app_initialized = False


def init_firestore():
    """Initialise the Admin SDK once and return a Firestore client."""
    global _app_initialized
    if not _app_initialized:
        cred = credentials.Certificate(os.environ["FIREBASE_SERVICE_ACCOUNT_PATH"])
        firebase_admin.initialize_app(
            cred, {"projectId": os.environ.get("FIREBASE_PROJECT_ID")}
        )
        _app_initialized = True
    return firestore.client()


def assess_one(snapshot) -> None:
    """Assess one application document and write aiAssessment back."""
    data = snapshot.to_dict() or {}
    if data.get("aiAssessment") is not None:  # idempotency guard
        return
    try:
        parsed = AssessmentInput(
            applicationId=snapshot.id,  # doc ID = application ID
            financialSpecs=data["financialSpecs"],
            propertySpecs=data["propertySpecs"],
        )
    except (KeyError, ValueError) as exc:
        log.warning("skipping %s: invalid application document (%s)", snapshot.id, exc)
        return

    result = assess(parsed)
    snapshot.reference.update(
        {
            "aiAssessment": result.model_dump(mode="json"),
            "status": DONE_STATUS,
        }
    )
    log.info("assessed %s -> %s", snapshot.id, result.recommendation.value)


async def poll_loop(db, interval: float = 10.0) -> None:
    """Poll Firestore forever; runs as an asyncio task from the lifespan."""
    log.info("polling %s where status == %s every %ss", COLLECTION, PENDING_STATUS, interval)
    while True:
        try:
            query = db.collection(COLLECTION).where(
                filter=FieldFilter("status", "==", PENDING_STATUS)
            )
            for snap in query.stream():
                try:
                    assess_one(snap)
                except Exception:
                    log.exception("failed to assess %s", snap.id)
        except Exception:
            log.exception("poll cycle failed; retrying in %ss", interval)
        await asyncio.sleep(interval)