from dataclasses import dataclass
from os import getenv


def _bool_env(name: str, default: str = "false") -> bool:
    return getenv(name, default).lower() in {"1", "true", "yes", "on"}


def _csv_env(name: str, default: str) -> list[str]:
    return [item.strip() for item in getenv(name, default).split(",") if item.strip()]


@dataclass(frozen=True)
class ModelSettings:
    enabled: bool
    required: bool
    base_model: str
    adapter_path: str | None
    device_map: str
    offload_dir: str | None
    load_in_4bit: bool
    max_new_tokens: int
    temperature: float
    prompt_format: str


@dataclass(frozen=True)
class ServerSettings:
    cors_origins: list[str]


def get_model_settings() -> ModelSettings:
    prompt_format = getenv("AI_PROMPT_FORMAT", "plain").lower()
    if prompt_format not in {"plain", "chat"}:
        raise ValueError("AI_PROMPT_FORMAT must be either 'plain' or 'chat'")

    return ModelSettings(
        enabled=_bool_env("AI_MODEL_ENABLED"),
        required=_bool_env("AI_MODEL_REQUIRED"),
        base_model=getenv("AI_BASE_MODEL", "Qwen/Qwen2.5-7B-Instruct"),
        adapter_path=getenv("AI_ADAPTER_PATH") or None,
        device_map=getenv("AI_DEVICE_MAP", "auto"),
        offload_dir=getenv("AI_OFFLOAD_DIR") or None,
        load_in_4bit=_bool_env("AI_LOAD_IN_4BIT"),
        max_new_tokens=int(getenv("AI_MAX_NEW_TOKENS", "384")),
        temperature=float(getenv("AI_TEMPERATURE", "0.0")),
        prompt_format=prompt_format,
    )


def get_server_settings() -> ServerSettings:
    return ServerSettings(
        cors_origins=_csv_env(
            "AI_CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
        ),
    )
