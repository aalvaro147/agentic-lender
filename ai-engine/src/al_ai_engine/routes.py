from fastapi import APIRouter

from .mock_service import assess
from .schemas import AssessmentRequest, AssessmentResponse

router = APIRouter(prefix="/api/v1", tags=["assessment"])


@router.post("/assess-application", response_model=AssessmentResponse)
def assess_application(req: AssessmentRequest) -> AssessmentResponse:
    return assess(req)