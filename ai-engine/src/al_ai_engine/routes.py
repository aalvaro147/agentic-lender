from fastapi import APIRouter

from .mock_service import assess
from .schemas import AssessmentInput, AssessmentResponse

router = APIRouter(prefix="/api/v1", tags=["assessment"])


@router.post("/assess-application", response_model=AssessmentResponse)
def assess_application(req: AssessmentInput) -> AssessmentResponse:
    return AssessmentResponse(
        applicationId=req.applicationId,
        aiAssessment=assess(req),
    )