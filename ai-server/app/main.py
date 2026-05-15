from fastapi import FastAPI

from app.routers.report import router as report_router

app = FastAPI(
    title="SceneA AI Evaluation API",
    version="0.1.0",
)

app.include_router(report_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
