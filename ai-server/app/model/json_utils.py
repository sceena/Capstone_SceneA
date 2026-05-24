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


def extract_json_array(text: str) -> list[Any]:
    """Extract the first JSON array from a model response."""
    cleaned = _strip_code_fence(text.strip())

    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        value = _loads_first_array(cleaned)

    if not isinstance(value, list):
        raise ModelJsonError("model response is not a JSON array")
    return value


def _strip_code_fence(text: str) -> str:
    if text.startswith("```"):
        return re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
    return text


def _loads_first_object(text: str) -> dict[str, Any]:
    start = text.find("{")
    if start < 0:
        raise ModelJsonError("no JSON object found")

    decoder = json.JSONDecoder()
    try:
        value, _ = decoder.raw_decode(text[start:])
    except json.JSONDecodeError as exc:
        raise ModelJsonError("invalid JSON object") from exc

    if not isinstance(value, dict):
        raise ModelJsonError("extracted JSON is not an object")
    return value


def _loads_first_array(text: str) -> list[Any]:
    start = text.find("[")
    if start < 0:
        raise ModelJsonError("no JSON array found")

    decoder = json.JSONDecoder()
    try:
        value, _ = decoder.raw_decode(text[start:])
    except json.JSONDecodeError as exc:
        raise ModelJsonError("invalid JSON array") from exc

    if not isinstance(value, list):
        raise ModelJsonError("extracted JSON is not an array")
    return value
