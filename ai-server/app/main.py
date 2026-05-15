from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_server_settings
from app.routers.report import router as report_router

server_settings = get_server_settings()

app = FastAPI(
    title="SceneA AI Evaluation API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=server_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(report_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
