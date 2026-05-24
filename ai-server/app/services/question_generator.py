from __future__ import annotations

import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Any

from app.model.json_utils import ModelJsonError, extract_json_array, extract_json_object


CAUTION_KEYWORDS = (
    "학습 중",
    "구현하지 못",
    "깊게 구현하지 못",
    "경험은 제한",
    "경험이 제한",
    "경험은 많지",
    "경험이 많지",
    "보완",
    "아직",
)

DOCUMENT_ANALYSIS_SYSTEM_PROMPT = (
    "너는 IT 면접 질문 생성을 위한 서류 분석기야. "
    "지원자 제출 서류를 읽고 실제 수행 경험과 미구현/학습 중 항목을 엄격하게 구분해. "
    "서류에 없는 도메인, 수치, 도구 사용 경험, 구현 세부사항은 추가하지 마. "
    "반드시 다음 키를 가진 JSON 객체만 출력해: "
    "confirmed_experiences, partial_experiences, not_yet_experiences, tech_keywords, technology_usages, project_domain. "
    "각 값은 문자열 배열로 작성해."
)

QUESTION_GENERATION_SYSTEM_PROMPT = (
    "너는 IT 기업의 실무 면접관이야. "
    "구조화된 서류 분석 결과를 바탕으로 직무 역량과 프로젝트 경험을 검증할 초기 면접 질문 10개를 작성해. "
    "규칙: "
    "1. 실제 면접관이 직접 묻는 자연스러운 존댓말 한 문장으로 간결하게 작성해. "
    "2. 분석 결과에 있는 경험과 기술만 근거로 삼고, 없는 도메인, 수치, 도구 사용 경험, 구현 세부사항은 추가하지 마. "
    "3. technology_usages에 적힌 기술별 사용 목적을 벗어나 질문하지 마. "
    "4. 각 질문은 단순 개념 확인보다 지원자의 실제 판단, 구현 과정, 문제 해결 근거를 확인할 수 있게 작성해. "
    "5. 질문은 쉬운 확인 질문부터 점진적으로 깊어지는 순서로 배치해. "
    "초반에는 프로젝트 경험과 구현 과정을 확인하고, 후반에는 문제 해결, 트레이드오프, 장애 대응, 확장 설계처럼 더 깊은 판단을 묻는 질문으로 구성해. "
    "6. 장애 대응이나 확장 설계 질문도 반드시 분석 결과에 포함된 기술과 상황 안에서만 작성해. "
    "7. not_yet_experiences 항목은 수행 경험으로 묻지 말고, 보완 계획이나 설계 방향을 묻는 가정형 질문으로 작성해. "
    "8. partial_experiences 항목은 구현된 범위와 미구현 범위를 구분해서 질문해. "
    "9. 부연 설명, 번호, 마크다운 없이 문자열 10개짜리 JSON 배열만 출력해."
)


class QuestionGenerationUnavailable(RuntimeError):
    pass


class QuestionGenerationInvalidResponse(ValueError):
    pass


class QuestionGenerator:
    model = "gemini-3-flash-preview"
    max_retries = 3

    def __init__(self, timeout_sec: float | None = None) -> None:
        self.timeout_sec = timeout_sec or float(os.environ.get("QUESTION_GENERATION_TIMEOUT_SEC", "30"))

    def generate(self, content: str) -> list[str]:
        document = content.strip()
        if not document:
            raise QuestionGenerationInvalidResponse("content must not be blank")

        try:
            raw = self._generate_with_timeout(document)
        except TimeoutError as exc:
            raise QuestionGenerationUnavailable("question generation timed out") from exc
        except QuestionGenerationUnavailable:
            raise
        except Exception as exc:
            raise QuestionGenerationUnavailable("question generation request failed") from exc

        try:
            payload = self._extract_questions(raw)
            return self._validate_questions(payload)
        except (ModelJsonError, ValueError) as exc:
            raise QuestionGenerationInvalidResponse(f"model returned invalid questions: {exc}") from exc

    def _generate_with_timeout(self, document: str) -> str:
        executor: ThreadPoolExecutor | None = None
        future = None
        try:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(self._call_llm, document)
            return future.result(timeout=self.timeout_sec)
        except TimeoutError:
            if future is not None:
                future.cancel()
            if executor is not None:
                executor.shutdown(wait=False, cancel_futures=True)
            raise
        finally:
            if executor is not None and future is not None and future.done():
                executor.shutdown(wait=True)

    def _call_llm(self, document: str) -> str:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise QuestionGenerationUnavailable("GEMINI_API_KEY is not set")

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise QuestionGenerationUnavailable("google-genai is not installed") from exc

        client = genai.Client(api_key=api_key)
        try:
            analysis_raw = self._generate_content(
                client=client,
                types=types,
                contents=self._build_analysis_contents(types, document),
                system_prompt=DOCUMENT_ANALYSIS_SYSTEM_PROMPT,
            )
        except Exception as exc:
            raise QuestionGenerationUnavailable(f"LLM document analysis failed: {exc}") from exc

        try:
            analysis = self._validate_analysis(extract_json_object(analysis_raw))
        except Exception as exc:
            raise QuestionGenerationInvalidResponse(f"LLM document analysis returned invalid JSON: {exc}") from exc

        try:
            return self._generate_content(
                client=client,
                types=types,
                contents=self._build_question_contents(types, analysis),
                system_prompt=QUESTION_GENERATION_SYSTEM_PROMPT,
            )
        except Exception as exc:
            raise QuestionGenerationUnavailable(f"LLM question generation failed: {exc}") from exc

    def _generate_content(self, client: Any, types: Any, contents: list[Any], system_prompt: str) -> str:
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = client.models.generate_content(
                    model=self.model,
                    contents=contents,
                    config=self._build_config(types, system_prompt),
                )
                text = getattr(response, "text", None)
                if not text:
                    raise QuestionGenerationUnavailable("LLM response text is empty")
                return text
            except Exception as exc:
                last_error = exc
                if attempt == self.max_retries:
                    break
                time.sleep(0.8 * attempt)

        raise QuestionGenerationUnavailable("LLM request failed after retries") from last_error

    def _build_analysis_contents(self, types: Any, document: str) -> list[Any]:
        caution_text = self._build_caution_text(document)
        return [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"""지원자 제출 서류:
{document}

{caution_text}

반드시 JSON 객체만 출력하세요.
예시:
{{
  "confirmed_experiences": ["Spring Boot REST API 구현", "JPA N+1 문제를 fetch join으로 개선"],
  "partial_experiences": ["JWT Access Token 검증 흐름 구현, Refresh Token 회전은 미구현"],
  "not_yet_experiences": ["Prometheus와 Grafana는 학습 중", "운영 장애 대응 경험은 제한적"],
  "tech_keywords": ["Spring Boot", "JPA", "MySQL", "Redis", "JWT", "Docker Compose"],
  "technology_usages": [
    "Spring Boot: 예약 서비스 REST API 구현",
    "JPA/MySQL: 예약 목록 조회와 N+1 문제 개선",
    "Redis: 예약 가능 시간 목록 캐싱, TTL 설정, 예약 변경 시 캐시 키 삭제",
    "JWT: Access Token 발급 및 검증 구현, Refresh Token 회전/블랙리스트 미구현",
    "Docker Compose: Spring Boot 애플리케이션과 MySQL 실행 환경 구성"
  ],
  "project_domain": ["예약 서비스"]
}}"""
                    )
                ],
            )
        ]

    def _build_question_contents(self, types: Any, analysis: dict[str, list[str]]) -> list[Any]:
        analysis_json = json.dumps(analysis, ensure_ascii=False, indent=2)
        return [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"""구조화된 서류 분석 결과:
{analysis_json}

반드시 JSON 배열만 출력하세요.
예시: [
  "예약 서비스의 REST API를 설계할 때 가장 중요하게 고려한 기준은 무엇인가요?",
  "예약 목록 조회에서 N+1 문제가 발생한 원인을 어떻게 확인하셨나요?",
  "fetch join을 선택한 이유와 적용 과정에서 고려한 점은 무엇인가요?",
  "Redis 캐시 적용 대상을 예약 가능 시간 데이터로 정한 이유는 무엇인가요?",
  "TTL과 캐시 무효화 정책을 설계할 때 가장 중요하게 본 기준은 무엇인가요?",
  "Docker Compose로 개발 환경을 구성하면서 겪은 어려움은 무엇이었나요?",
  "Refresh Token 회전이나 블랙리스트 처리를 보완한다면 어떤 방식으로 설계하고 싶으신가요?",
  "운영 장애 대응 경험이 제한적이라고 했는데, 현재 어떤 방식으로 보완하고 있나요?",
  "Prometheus와 Grafana를 실제 프로젝트에 적용한다면 어떤 지표부터 확인하고 싶으신가요?",
  "해당 프로젝트에서 본인이 가장 주도적으로 맡은 기술적 결정은 무엇인가요?"
]"""
                    )
                ],
            )
        ]

    def _build_caution_text(self, document: str) -> str:
        caution_sentences = self._extract_caution_sentences(document)
        if not caution_sentences:
            return ""

        items = "\n".join(f"- {sentence}" for sentence in caution_sentences)
        return (
            "주의해서 해석할 문장:\n"
            f"{items}\n\n"
            "위 문장에 포함된 미구현, 학습 중, 경험 제한 항목은 수행 경험으로 간주하지 마세요. "
            "'구현하셨나요', '구축하면서', '처리하셨나요'처럼 실제로 수행한 경험을 전제로 묻지 말고, "
            "'도입한다면', '보완한다면', '설계한다면'처럼 가정형 질문으로만 작성하세요."
        )

    def _extract_caution_sentences(self, document: str) -> list[str]:
        normalized = re.sub(r"\s+", " ", document.strip())
        sentences = re.split(r"(?<=[.!?。！？])\s+", normalized)

        caution_sentences: list[str] = []
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if any(keyword in sentence for keyword in CAUTION_KEYWORDS):
                caution_sentences.append(sentence)

        if not caution_sentences and any(keyword in normalized for keyword in CAUTION_KEYWORDS):
            caution_sentences.append(normalized[:500])

        return caution_sentences[:5]

    def _build_config(self, types: Any, system_prompt: str) -> Any:
        return types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="HIGH"),
            response_mime_type="application/json",
            system_instruction=[
                types.Part.from_text(text=system_prompt),
            ],
        )

    def _validate_analysis(self, payload: dict[str, object]) -> dict[str, list[str]]:
        fields = (
            "confirmed_experiences",
            "partial_experiences",
            "not_yet_experiences",
            "tech_keywords",
            "technology_usages",
            "project_domain",
        )
        analysis: dict[str, list[str]] = {}
        for field in fields:
            value = payload.get(field, [])
            if not isinstance(value, list):
                raise ValueError(f"{field} must be a list")
            analysis[field] = [str(item).strip() for item in value if str(item).strip()]
        return analysis

    def _extract_questions(self, raw: str) -> list[object]:
        try:
            return extract_json_array(raw)
        except ModelJsonError:
            payload = extract_json_object(raw)
            questions = payload.get("questions")
            if not isinstance(questions, list):
                raise ValueError("JSON object does not contain a questions array")
            return questions

    def _validate_questions(self, payload: list[object]) -> list[str]:
        if len(payload) != 10:
            raise ValueError("question list must contain exactly 10 items")

        questions: list[str] = []
        for item in payload:
            if not isinstance(item, str):
                raise ValueError("question item must be a string")

            question = self._normalize_question(item)
            if not question:
                raise ValueError("question item is blank")
            questions.append(question)

        return questions

    def _normalize_question(self, question: str) -> str:
        normalized = question.strip()
        normalized = re.sub(r"^\s*(?:[-*]|\d+[.)]|Q\d+[.)])\s*", "", normalized)
        return normalized.strip()
