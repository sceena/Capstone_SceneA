import json
import re
from typing import Any


class ModelJsonError(ValueError):
    pass


def extract_json_object(text: str) -> dict[str, Any]:
    """Extract the first JSON object from a model response."""
    cleaned = _strip_code_fence(text.strip())

    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        value = _loads_first_object(cleaned)

    if not isinstance(value, dict):
        raise ModelJsonError("model response is not a JSON object")
    return value


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        return re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
    return text


def _loads_first_object(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ModelJsonError("no JSON object found")

    try:
        value = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ModelJsonError("invalid JSON object") from exc

    if not isinstance(value, dict):
        raise ModelJsonError("extracted JSON is not an object")
    return value
