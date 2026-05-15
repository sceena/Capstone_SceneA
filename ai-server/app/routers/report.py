from fastapi import APIRouter

from app.schemas.report import ReportRequest, ReportResponse
from app.services.report_generator import ReportGenerator

router = APIRouter(tags=["report"])
report_generator = ReportGenerator()


@router.post("/report", response_model=ReportResponse)
def generate_report(request: ReportRequest) -> ReportResponse:
    return report_generator.generate(request)
