from __future__ import annotations

import json
import os
import re
import time
from typing import Any

from app.schemas.top_summary import TopSummaryAnalysisResponse


class TopSummaryComposerUnavailable(RuntimeError):
    pass


class TopSummaryComposer:
    """LLM composer for question-type-specific structure presence analysis."""

    model = "gemini-3-flash-preview"

    def generate(self, summary: dict[str, Any]) -> TopSummaryAnalysisResponse:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise TopSummaryComposerUnavailable("GEMINI_API_KEY is not set")

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise TopSummaryComposerUnavailable("google-genai is not installed") from exc

        client = genai.Client(api_key=api_key)
        response = self._generate_content_with_retry(
            client=client,
            model=self.model,
            contents=self._build_contents(types, summary),
            config=self._build_config(types),
        )

        text = getattr(response, "text", None)
        if not text:
            raise TopSummaryComposerUnavailable("Gemini response text is empty")

        payload = self._parse_json_text(text)
        return TopSummaryAnalysisResponse.model_validate(payload)

    def _generate_content_with_retry(
        self,
        client: Any,
        model: str,
        contents: list[Any],
        config: Any,
    ) -> Any:
        delays = [0.8, 1.6]
        last_exc: Exception | None = None

        for attempt in range(len(delays) + 1):
            try:
                return client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                )
            except Exception as exc:
                last_exc = exc
                if attempt >= len(delays):
                    break
                time.sleep(delays[attempt])

        raise TopSummaryComposerUnavailable(
            f"Gemini top summary generation failed after {len(delays) + 1} attempts: "
            f"{type(last_exc).__name__}: {last_exc}"
        ) from last_exc

    def _build_contents(self, types: Any, summary: dict[str, Any]) -> list[Any]:
        sessions = {
            key: {
                "question_text": value.get("question_text"),
                "answer_text": value.get("answer_text"),
            }
            for key, value in summary.items()
            if key.startswith("Session") and isinstance(value, dict)
        }
        return [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=json.dumps({"sessions": sessions}, ensure_ascii=False)
                    ),
                ],
            )
        ]

    def _build_config(self, types: Any) -> Any:
        return types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="HIGH"),
            system_instruction=[
                types.Part.from_text(
                    text="""You are a structure analyzer for an AI interview report.
For each session, first classify the question type, then judge only whether the required structure elements exist.
Do not choose best/worst sessions. Do not calculate scores.
Do not judge attitude, personality, or whether the topic is correct beyond the requested structure elements.

Question types and required elements:
1. experience
   Use for questions asking for a concrete experience, achievement, conflict, failure, project, or problem-solving case.
   Required elements: situation, task, action, result.
2. opinion
   Use for questions asking thoughts, values, definitions, preferences, strengths, work style, or general viewpoint.
   Required elements: claim, reason, example.
3. situational
   Use for hypothetical questions asking what the candidate would do in a given situation.
   Required elements: situation_understanding, action_plan, rationale.
4. knowledge
   Use for questions asking technical concepts, definitions, principles, or comparisons.
   Required elements: concept, explanation, example.

Element judgment rules:
- Mark an element true only when it is clearly present in the answer.
- Do not force STAR onto opinion, situational, or knowledge questions.
- For opinion questions, "example" can be a concrete personal example, service example, project example, or realistic scenario.
- For situational questions, "action_plan" must be a concrete planned behavior, not just a personality trait.
- For knowledge questions, "example" is optional only when the question explicitly asks for a definition only; otherwise judge it normally.

Writing style:
- Write every Korean reason in polite report style ending with '-합니다' or '-습니다'.
- Do not use harsh expressions.
- Mention one concrete piece of answer evidence, such as a concept, action, result, example, or the concrete element that is missing.
- Avoid generic reasons that could apply to any answer.
- Keep each reason to one sentence.
- Do not mention CPM, silence, sentence conciseness, score, best/worst, or question relevance.
- reason and strength_reason should explain what is structurally good in the answer.
- weakness_reason should explain only what is missing or weak in the answer. Do not include praise in weakness_reason.
- If the answer is mostly strong, weakness_reason should still name the most realistic remaining limitation.

Return only this JSON shape:
{
  "structure_analysis": [
    {
      "session_id": "Session1",
      "question_type": "opinion",
      "elements": {
        "claim": true,
        "reason": true,
        "example": false
      },
      "reason": "팀 협업을 선호한다는 주장과 이유는 제시되어 답변의 기본 방향이 분명합니다.",
      "strength_reason": "팀 협업을 선호한다는 주장과 이유는 제시되어 답변의 기본 방향이 분명합니다.",
      "weakness_reason": "팀 협업을 뒷받침하는 실제 협업 사례가 드러나지 않아 답변의 설득력을 보완할 필요가 있습니다."
    }
  ]
}"""
                ),
            ],
        )

    def _parse_json_text(self, text: str) -> dict[str, Any]:
        cleaned = text.strip()
        fenced = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
        if fenced:
            cleaned = fenced.group(1).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            decoder = json.JSONDecoder()
            start = cleaned.find("{")
            while start != -1:
                try:
                    payload, _ = decoder.raw_decode(cleaned[start:])
                    if isinstance(payload, dict):
                        return payload
                except json.JSONDecodeError:
                    start = cleaned.find("{", start + 1)
                    continue
            raise
