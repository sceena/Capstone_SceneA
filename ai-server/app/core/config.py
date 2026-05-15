from dataclasses import dataclass
from os import getenv


@dataclass(frozen=True)
class ModelSettings:
    enabled: bool
    base_model: str
    adapter_path: str | None
    max_new_tokens: int
    temperature: float


def get_model_settings() -> ModelSettings:
    return ModelSettings(
        enabled=getenv("AI_MODEL_ENABLED", "false").lower() == "true",
        base_model=getenv("AI_BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct"),
        adapter_path=getenv("AI_ADAPTER_PATH") or None,
        max_new_tokens=int(getenv("AI_MAX_NEW_TOKENS", "512")),
        temperature=float(getenv("AI_TEMPERATURE", "0.0")),
    )
