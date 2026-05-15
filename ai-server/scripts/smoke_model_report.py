from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from app.schemas.report import ReportRequest
from app.services.report_generator import ReportGenerator


def main() -> None:
    parser = argparse.ArgumentParser(description="Run an SFT report smoke test.")
    parser.add_argument(
        "--input",
        default="examples/report_request.json",
        help="Path to a report request JSON file.",
    )
    args = parser.parse_args()

    _require_model_env()

    payload_path = PROJECT_ROOT / args.input
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    request = ReportRequest.model_validate(payload)
    report = ReportGenerator().generate(request)

    print(f"session_id={report.session_id}")
    print(f"overall_score={report.overall_score}")
    print(f"question_reports={len(report.question_reports)}")

    for item in report.question_reports:
        print(
            " | ".join(
                [
                    f"question_id={item.question_id}",
                    f"score={item.score}",
                    f"source={item.evaluation_source}",
                    f"reasoning={_shorten(item.reasoning)}",
                    f"strengths={len(item.strengths)}",
                    f"improvements={len(item.improvements)}",
                ]
            )
        )

    sources = {item.evaluation_source for item in report.question_reports}
    if sources != {"sft"}:
        raise SystemExit(f"expected only sft evaluations, got: {sorted(sources)}")


def _require_model_env() -> None:
    required = {
        "AI_MODEL_ENABLED": "true",
        "AI_MODEL_REQUIRED": "true",
        "AI_BASE_MODEL": "Qwen/Qwen2.5-7B-Instruct",
        "AI_ADAPTER_PATH": None,
    }

    missing = []
    for key, expected in required.items():
        value = os.getenv(key)
        if not value:
            missing.append(key)
        elif expected is not None and value.lower() != expected.lower():
            raise SystemExit(f"{key} must be {expected!r}, got {value!r}")

    if missing:
        raise SystemExit(f"missing required env vars: {', '.join(missing)}")


def _shorten(text: str, max_length: int = 80) -> str:
    text = " ".join(text.split())
    if len(text) <= max_length:
        return text
    return text[: max_length - 3] + "..."


if __name__ == "__main__":
    main()
