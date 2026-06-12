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
    "서류에 직접 등장하지 않은 도메인, 수치, 도구, 하드웨어, 외부 서비스, 구현 세부사항은 절대 추가하지 마. "
    "기술적으로 함께 자주 쓰이는 개념이라도 원문에 없으면 분석 결과에 넣지 마. "
    "기술명이 등장하더라도 해당 기술의 하위 설정, 장애 대응 전략, 보장 방식, 주변 도구는 원문에 직접 언급된 경우에만 포함해. "
    "원문에 없는 내용을 기술 상식으로 보완하거나 추론하지 마. "
    "프로젝트 도메인명은 원문 표현을 그대로 유지하고 다른 서비스로 바꾸지 마. "
    "반드시 다음 키를 가진 JSON 객체만 출력해: "
    "confirmed_experiences, partial_experiences, not_yet_experiences, tech_keywords, technology_usages, project_domain. "
    "각 값은 문자열 배열로 작성해."
)

def build_question_generation_system_prompt(question_count: int) -> str:
    return (
    "너는 IT 기업의 실무 면접관이야. "
    f"구조화된 서류 분석 결과를 바탕으로 직무 역량과 프로젝트 경험을 검증할 초기 면접 질문 {question_count}개를 작성해. "
    "규칙: "
    "1. 실제 면접관이 직접 묻는 자연스러운 존댓말 한 문장으로 간결하게 작성해. "
    "2. 분석 결과에 있는 경험과 기술만 근거로 삼고, 없는 도메인, 수치, 도구 사용 경험, 구현 세부사항은 추가하지 마. "
    "3. technology_usages에 적힌 기술별 사용 목적을 벗어나 질문하지 마. "
    "4. 분석 결과에 있더라도 원문 근거가 불명확한 하위 설정명, 보장 전략, 운영 방식은 질문에 넣지 마. "
    "5. 각 질문은 단순 개념 확인보다 지원자의 실제 판단, 구현 과정, 문제 해결 근거를 확인할 수 있게 작성해. "
    "6. 질문은 쉬운 확인 질문부터 점진적으로 깊어지는 순서로 배치해. "
    "초반에는 프로젝트 경험과 구현 과정을 확인하고, 후반에는 문제 해결, 트레이드오프, 장애 대응, 확장 설계처럼 더 깊은 판단을 묻는 질문으로 구성해. "
    "7. 장애 대응이나 확장 설계 질문도 반드시 분석 결과에 포함된 기술과 상황 안에서만 작성해. "
    "8. not_yet_experiences 항목은 수행 경험으로 묻지 말고, 보완 계획이나 설계 방향을 묻는 가정형 질문으로 작성해. "
    "9. partial_experiences 항목은 구현된 범위와 미구현 범위를 구분해서 질문해. "
    f"10. 부연 설명, 번호, 마크다운 없이 문자열 {question_count}개짜리 JSON 배열만 출력해."
    )

GROUP_COMMON_QUESTION_SYSTEM_PROMPT = (
    "너는 IT 기업의 그룹 면접관이야. "
    "여러 지원자의 제출 서류를 함께 읽고, 특정 한 명에게만 해당하지 않고 모든 지원자에게 공통으로 물을 수 있는 초기 면접 질문 5개를 작성해. "
    "규칙: "
    "1. 실제 면접관이 직접 묻는 자연스러운 존댓말 한 문장으로 간결하게 작성해. "
    "2. 여러 지원자에게 공통으로 적용 가능한 주제만 질문해. "
    "3. 제출 서류에 직접 포함된 경험과 기술만 근거로 삼고, 관련 있어 보이는 기술을 추론해서 추가하지 마. "
    "4. 특정 지원자의 고유 프로젝트명, 수치, 세부 구현을 모든 지원자가 수행한 것처럼 전제하지 마. "
    "5. 원문 근거가 불명확한 하위 설정명, 보장 전략, 운영 방식은 질문에 넣지 마. "
    "6. 단순 개념 질문보다 경험 비교, 기술 선택 기준, 문제 해결 방식, 협업 판단을 확인하는 질문으로 작성해. "
    "7. 미구현, 학습 중, 경험 제한 항목은 수행 경험으로 묻지 말고 보완 계획이나 설계 방향을 묻는 가정형 질문으로 작성해. "
    "8. 질문은 쉬운 확인 질문부터 점진적으로 깊어지는 순서로 배치해. "
    "9. 부연 설명, 번호, 마크다운 없이 문자열 5개짜리 JSON 배열만 출력해."
)

GROUP_PERSONAL_QUESTION_SYSTEM_PROMPT = (
    "너는 IT 기업의 실무 면접관이야. "
    "지원자 한 명의 제출 서류를 바탕으로 그룹 면접에서 사용할 개인 맞춤 질문 5개를 작성해. "
    "규칙: "
    "1. 실제 면접관이 직접 묻는 자연스러운 존댓말 한 문장으로 작성해. "
    "2. 서류에 직접 포함된 경험과 기술만 근거로 삼고, 없는 도메인, 수치, 도구, 구현 세부사항은 추가하지 마. "
    "3. 기술명이 있더라도 사용 목적이나 구현 범위가 서류에 없으면 추측하지 마. "
    "4. 미구현, 학습 중, 경험 제한 항목은 수행 경험으로 묻지 말고 보완 계획이나 설계 방향을 묻는 가정형 질문으로 작성해. "
    "5. 쉬운 경험 확인 질문부터 문제 해결 근거, 트레이드오프, 보완 방향을 묻는 질문 순서로 배치해. "
    "6. 부연 설명, 번호, 마크다운 없이 문자열 5개짜리 JSON 배열만 출력해."
)


class QuestionGenerationUnavailable(RuntimeError):
    pass


class QuestionGenerationInvalidResponse(ValueError):
    pass


class QuestionGenerator:
    model = "gemini-3-flash-preview"
    default_max_retries = 1
    max_retry_limit = 3
    retry_delay_sec = 3.0
    thinking_level = "HIGH"
    common_question_count = 5
    group_personal_question_count = 5
    default_group_personal_workers = 4

    def __init__(self, timeout_sec: float | None = None) -> None:
        self.model = os.environ.get("QUESTION_GENERATION_MODEL", self.model)
        self.thinking_level = os.environ.get("QUESTION_GENERATION_THINKING_LEVEL", self.thinking_level).strip()
        self.fake_mode = os.environ.get("QUESTION_GENERATION_FAKE", "").strip().lower() in {"1", "true", "yes", "on"}
        self.timeout_sec = timeout_sec or float(os.environ.get("QUESTION_GENERATION_TIMEOUT_SEC", "60"))
        configured_retries = int(os.environ.get("QUESTION_GENERATION_MAX_RETRIES", str(self.default_max_retries)))
        self.max_retries = min(max(1, configured_retries), self.max_retry_limit)
        configured_workers = int(
            os.environ.get("QUESTION_GENERATION_GROUP_PERSONAL_WORKERS", str(self.default_group_personal_workers))
        )
        self.group_personal_workers = max(1, configured_workers)

    def generate(self, content: str, question_count: int = 10) -> list[str]:
        document = content.strip()
        if not document:
            raise QuestionGenerationInvalidResponse("content must not be blank")

        try:
            analysis = self._analyze_with_timeout(document)
            raw = self._generate_questions_from_analysis_with_timeout(analysis, question_count)
        except TimeoutError as exc:
            raise QuestionGenerationUnavailable("question generation timed out") from exc
        except QuestionGenerationUnavailable:
            raise
        except Exception as exc:
            raise QuestionGenerationUnavailable("question generation request failed") from exc

        try:
            payload = self._extract_questions(raw)
            return self._validate_questions(payload, expected_count=question_count)
        except (ModelJsonError, ValueError) as exc:
            raise QuestionGenerationInvalidResponse(f"model returned invalid questions: {exc}") from exc

    def generate_for_session(self, session_type: str, candidates: list[dict[str, Any]]) -> dict[str, Any]:
        normalized_session_type = session_type.strip().upper()
        if normalized_session_type not in {"ONE_TO_ONE", "GROUP"}:
            raise QuestionGenerationInvalidResponse("session_type must be ONE_TO_ONE or GROUP")

        if normalized_session_type == "ONE_TO_ONE" and len(candidates) != 1:
            raise QuestionGenerationInvalidResponse("ONE_TO_ONE session must contain exactly one candidate")
        if normalized_session_type == "GROUP" and len(candidates) < 2:
            raise QuestionGenerationInvalidResponse("GROUP session must contain at least two candidates")

        if normalized_session_type == "GROUP":
            return self.generate_group_session_questions(candidates)

        analyzed_candidates = self.analyze_candidates(candidates)

        personal_questions: list[dict[str, Any]] = []
        for candidate in analyzed_candidates:
            personal_questions.append(
                {
                    "candidate_id": candidate.get("candidate_id"),
                    "questions": self.generate_questions_from_analysis(candidate["analysis"]),
                }
            )

        return {
            "session_type": normalized_session_type,
            "common_questions": [],
            "personal_questions": personal_questions,
        }

    def generate_group_session_questions(self, candidates: list[dict[str, Any]]) -> dict[str, Any]:
        normalized_candidates = self._normalize_group_candidates(candidates)
        try:
            common_questions = self.generate_common_questions(normalized_candidates)
            personal_questions = self._generate_group_personal_questions(normalized_candidates)
        except TimeoutError as exc:
            raise QuestionGenerationUnavailable("group question generation timed out") from exc
        except QuestionGenerationUnavailable:
            raise
        except QuestionGenerationInvalidResponse:
            raise
        except Exception as exc:
            raise QuestionGenerationUnavailable(f"group question generation request failed: {exc}") from exc

        return {
            "session_type": "GROUP",
            "common_questions": common_questions,
            "personal_questions": personal_questions,
        }

    def _generate_group_personal_questions(self, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        max_workers = min(self.group_personal_workers, len(candidates))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(self._generate_group_personal_question_set, candidate)
                for candidate in candidates
            ]
            return [future.result() for future in futures]

    def _generate_group_personal_question_set(self, candidate: dict[str, Any]) -> dict[str, Any]:
        try:
            raw = self._generate_group_personal_with_timeout(candidate["content"])
        except TimeoutError as exc:
            raise QuestionGenerationUnavailable("group personal question generation timed out") from exc
        except QuestionGenerationUnavailable:
            raise
        except Exception as exc:
            raise QuestionGenerationUnavailable(f"group personal question generation request failed: {exc}") from exc

        try:
            payload = self._extract_questions(raw)
            questions = self._validate_questions(payload, expected_count=self.group_personal_question_count)
        except (ModelJsonError, ValueError) as exc:
            raise QuestionGenerationInvalidResponse(f"model returned invalid personal questions: {exc}") from exc

        return {
            "candidate_id": candidate["candidate_id"],
            "questions": questions,
        }

    def generate_common_questions(self, candidates: list[dict[str, Any]]) -> list[str]:
        normalized_candidates = self._normalize_group_candidates(candidates)
        if len(normalized_candidates) < 2:
            raise QuestionGenerationInvalidResponse("common questions require at least two candidates")

        try:
            raw = self._generate_common_with_timeout(normalized_candidates)
        except TimeoutError as exc:
            raise QuestionGenerationUnavailable("common question generation timed out") from exc
        except QuestionGenerationUnavailable:
            raise
        except Exception as exc:
            raise QuestionGenerationUnavailable(f"common question generation request failed: {exc}") from exc

        try:
            payload = self._extract_questions(raw)
            return self._validate_questions(payload, expected_count=self.common_question_count)
        except (ModelJsonError, ValueError) as exc:
            raise QuestionGenerationInvalidResponse(f"model returned invalid common questions: {exc}") from exc

    def analyze_candidates(self, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        analyzed_candidates: list[dict[str, Any]] = []
        for index, candidate in enumerate(candidates, start=1):
            content = str(candidate.get("content", "")).strip()
            if not content:
                raise QuestionGenerationInvalidResponse("candidate content must not be blank")

            try:
                analysis = self._analyze_with_timeout(content)
            except TimeoutError as exc:
                raise QuestionGenerationUnavailable("document analysis timed out") from exc
            except QuestionGenerationUnavailable:
                raise
            except Exception as exc:
                raise QuestionGenerationUnavailable("document analysis request failed") from exc

            analyzed_candidates.append(
                {
                    "candidate_id": candidate.get("candidate_id"),
                    "analysis": analysis,
                }
            )

        return analyzed_candidates

    def generate_questions_from_analysis(self, analysis: dict[str, list[str]], question_count: int = 10) -> list[str]:
        try:
            raw = self._generate_questions_from_analysis_with_timeout(analysis, question_count)
        except TimeoutError as exc:
            raise QuestionGenerationUnavailable("question generation timed out") from exc
        except QuestionGenerationUnavailable:
            raise
        except Exception as exc:
            raise QuestionGenerationUnavailable("question generation request failed") from exc

        try:
            payload = self._extract_questions(raw)
            return self._validate_questions(payload, expected_count=question_count)
        except (ModelJsonError, ValueError) as exc:
            raise QuestionGenerationInvalidResponse(f"model returned invalid questions: {exc}") from exc

    def _analyze_with_timeout(self, document: str) -> dict[str, list[str]]:
        executor: ThreadPoolExecutor | None = None
        future = None
        try:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(self._call_analysis_llm, document)
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

    def _generate_questions_from_analysis_with_timeout(self, analysis: dict[str, list[str]], question_count: int) -> str:
        executor: ThreadPoolExecutor | None = None
        future = None
        try:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(self._call_question_llm, analysis, question_count)
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

    def _generate_common_with_timeout(self, candidates: list[dict[str, Any]]) -> str:
        executor: ThreadPoolExecutor | None = None
        future = None
        try:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(self._call_common_llm, candidates)
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

    def _generate_group_personal_with_timeout(self, document: str) -> str:
        executor: ThreadPoolExecutor | None = None
        future = None
        try:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(self._call_group_personal_llm, document)
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

    def _call_analysis_llm(self, document: str) -> dict[str, list[str]]:
        if self.fake_mode:
            return self._build_fake_analysis(document)

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
            return self._validate_analysis(extract_json_object(analysis_raw))
        except Exception as exc:
            raise QuestionGenerationInvalidResponse(f"LLM document analysis returned invalid JSON: {exc}") from exc

    def _call_question_llm(self, analysis: dict[str, list[str]], question_count: int) -> str:
        if self.fake_mode:
            return json.dumps(self._build_fake_questions(analysis, question_count), ensure_ascii=False)

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
            return self._generate_content(
                client=client,
                types=types,
                contents=self._build_question_contents(types, analysis, question_count),
                system_prompt=build_question_generation_system_prompt(question_count),
            )
        except Exception as exc:
            raise QuestionGenerationUnavailable(f"LLM question generation failed: {exc}") from exc

    def _call_common_llm(self, candidates: list[dict[str, Any]]) -> str:
        if self.fake_mode:
            return json.dumps(self._build_fake_common_questions(candidates), ensure_ascii=False)

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
            return self._generate_content(
                client=client,
                types=types,
                contents=self._build_common_question_contents(types, candidates),
                system_prompt=GROUP_COMMON_QUESTION_SYSTEM_PROMPT,
            )
        except Exception as exc:
            raise QuestionGenerationUnavailable(f"LLM common question generation failed: {exc}") from exc

    def _call_group_personal_llm(self, document: str) -> str:
        if self.fake_mode:
            analysis = self._build_fake_analysis(document)
            return json.dumps(
                self._build_fake_questions(analysis, self.group_personal_question_count),
                ensure_ascii=False,
            )

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
            return self._generate_content(
                client=client,
                types=types,
                contents=self._build_group_personal_question_contents(types, document),
                system_prompt=GROUP_PERSONAL_QUESTION_SYSTEM_PROMPT,
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
                time.sleep(self.retry_delay_sec * attempt)

        error_detail = str(last_error) if last_error else "unknown error"
        raise QuestionGenerationUnavailable(f"LLM request failed after retries: {error_detail}") from last_error

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

    def _build_question_contents(self, types: Any, analysis: dict[str, list[str]], question_count: int) -> list[Any]:
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

    def _build_common_question_contents(self, types: Any, candidates: list[dict[str, Any]]) -> list[Any]:
        candidate_sections = []
        for index, candidate in enumerate(candidates, start=1):
            label = f"지원자 {candidate.get('candidate_id') or index}"
            content = candidate["content"]
            caution_text = self._build_caution_text(content)
            candidate_sections.append(
                f"""[{label}]
{content}

{caution_text}""".strip()
            )

        return [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"""그룹 면접 지원자 제출 서류:
{chr(10).join(candidate_sections)}

위 여러 지원자에게 공통으로 물을 수 있는 질문만 작성하세요.
지원자 제출 서류에 없는 기술명, 도구, 수치, 구현 세부사항은 질문에 넣지 마세요.
반드시 문자열 {self.common_question_count}개짜리 JSON 배열만 출력하세요.
예시: [
  "각자 프로젝트에서 기술을 선택할 때 가장 중요하게 본 기준은 무엇인가요?",
  "문제가 발생했을 때 원인을 확인하기 위해 어떤 순서로 접근하셨나요?",
  "성능 개선이 필요하다고 판단한 근거는 어떻게 확인하셨나요?",
  "구현하지 못한 부분을 보완한다면 어떤 순서로 개선하고 싶으신가요?",
  "협업 과정에서 기술적 의견이 갈릴 때 어떤 기준으로 결정하셨나요?"
]"""
                    )
                ],
            )
        ]

    def _build_group_personal_question_contents(self, types: Any, document: str) -> list[Any]:
        caution_text = self._build_caution_text(document)
        return [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"""지원자 제출 서류:
{document}

{caution_text}

위 서류에 근거한 개인 맞춤 면접 질문 5개를 작성하세요.
서류에 없는 구현 범위나 운영 경험을 추가로 가정하지 마세요.
반드시 문자열 5개짜리 JSON 배열만 출력하세요."""
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

    def _normalize_group_candidates(self, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized_candidates: list[dict[str, Any]] = []
        for index, candidate in enumerate(candidates, start=1):
            content = str(candidate.get("content", "")).strip()
            if not content:
                raise QuestionGenerationInvalidResponse("candidate content must not be blank")

            normalized_candidates.append(
                {
                    "candidate_id": candidate.get("candidate_id") or index,
                    "content": content,
                }
            )
        return normalized_candidates

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
        config_kwargs = {
            "response_mime_type": "application/json",
            "system_instruction": [
                types.Part.from_text(text=system_prompt),
            ],
        }
        if self.thinking_level and self.thinking_level.upper() != "NONE":
            config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=self.thinking_level)
        return types.GenerateContentConfig(
            **config_kwargs,
        )

    def _build_fake_analysis(self, document: str) -> dict[str, list[str]]:
        tech_candidates = (
            "Spring Boot",
            "Spring Cloud",
            "JPA",
            "Hibernate",
            "MySQL",
            "PostgreSQL",
            "MariaDB",
            "Redis",
            "Kafka",
            "Elasticsearch",
            "Zipkin",
            "AWS",
            "EC2",
            "RDS",
            "NestJS",
            "Socket.io",
            "TypeORM",
            "Prisma",
            "FastAPI",
            "Pandas",
            "Celery",
            "RabbitMQ",
            "SQLAlchemy",
            "Alembic",
            "Docker",
            "Docker Compose",
            "JWT",
            "React",
            "TypeScript",
            "React Query",
            "Zustand",
        )
        normalized_document = document.lower()
        keywords = [tech for tech in tech_candidates if tech.lower() in normalized_document]
        if not keywords:
            keywords = ["프로젝트 경험"]

        sentences = [sentence.strip() for sentence in re.split(r"[.!?。]\s*|\n+", document) if sentence.strip()]
        project_domain = sentences[:1] or ["지원자 제출 서류 기반 프로젝트"]
        caution_sentences = self._extract_caution_sentences(document)

        technology_usages = []
        for tech in keywords[:8]:
            matched_sentence = next(
                (sentence for sentence in sentences if tech.lower() in sentence.lower()),
                f"{tech} 사용 경험",
            )
            technology_usages.append(f"{tech}: {matched_sentence[:120]}")

        return {
            "confirmed_experiences": sentences[:5] or ["지원자 제출 서류에 기반한 수행 경험"],
            "partial_experiences": caution_sentences,
            "not_yet_experiences": caution_sentences,
            "tech_keywords": keywords,
            "technology_usages": technology_usages,
            "project_domain": project_domain,
        }

    def _build_fake_questions(self, analysis: dict[str, list[str]], question_count: int) -> list[str]:
        keywords = analysis.get("tech_keywords") or ["프로젝트"]
        usages = analysis.get("technology_usages") or []
        partials = analysis.get("partial_experiences") or analysis.get("not_yet_experiences") or []

        questions = [
            f"프로젝트에서 {keywords[0]} 사용 경험과 본인이 맡은 핵심 역할은 무엇인가요?",
            "프로젝트 요구사항을 API나 데이터 구조로 옮길 때 가장 중요하게 본 기준은 무엇인가요?",
            "개발 과정에서 성능이나 안정성 문제를 발견한 방법과 해결 과정을 설명해 주세요.",
            "사용한 기술을 선택할 때 다른 대안과 비교해 어떤 근거로 판단하셨나요?",
            "데이터 정합성이나 예외 상황을 처리하기 위해 어떤 설계를 적용하셨나요?",
            "구현 과정에서 가장 어려웠던 기술적 문제와 해결 방식을 설명해 주세요.",
            "현재 구조에서 트래픽이나 데이터가 늘어난다면 어떤 부분을 먼저 개선하고 싶으신가요?",
            "테스트나 로그를 활용해 구현 결과를 검증한 방식이 있다면 설명해 주세요.",
            "협업 과정에서 기술적 의사결정을 공유하거나 조율한 경험을 설명해 주세요.",
            "프로젝트를 다시 개선한다면 가장 먼저 보완하고 싶은 기술적 요소는 무엇인가요?",
        ]

        for usage in usages[:3]:
            tech = usage.split(":", 1)[0]
            questions.append(f"{tech}을 해당 프로젝트에 적용한 목적과 구현 과정은 무엇인가요?")
        for partial in partials[:2]:
            questions.append(f"{partial[:30]} 부분을 보완한다면 어떤 방향으로 설계하고 싶으신가요?")

        return self._deduplicate_and_fill_questions(questions, question_count)

    def _build_fake_common_questions(self, candidates: list[dict[str, Any]]) -> list[str]:
        questions = [
            "각자 프로젝트에서 기술 스택을 선택할 때 가장 중요하게 고려한 기준은 무엇인가요?",
            "개발 중 발생한 성능 문제나 병목을 어떤 방식으로 발견하고 해결하셨나요?",
            "데이터 정합성이나 장애 상황을 고려해 설계한 부분이 있다면 설명해 주세요.",
            "협업 과정에서 기술적 의견이 갈렸을 때 어떻게 조율하셨나요?",
            "현재 프로젝트를 더 확장한다면 가장 먼저 개선하고 싶은 구조는 무엇인가요?",
        ]
        return self._deduplicate_and_fill_questions(questions, self.common_question_count)

    def _deduplicate_and_fill_questions(self, questions: list[str], expected_count: int) -> list[str]:
        normalized_questions = []
        seen = set()
        for question in questions:
            normalized = self._normalize_question(question)
            if normalized in seen:
                continue
            seen.add(normalized)
            normalized_questions.append(normalized)
            if len(normalized_questions) == expected_count:
                return normalized_questions

        while len(normalized_questions) < expected_count:
            index = len(normalized_questions) + 1
            normalized_questions.append(f"지원자 경험을 바탕으로 추가로 확인하고 싶은 기술적 판단은 무엇인가요? ({index})")

        return normalized_questions

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
            if value is None:
                analysis[field] = []
                continue
            if isinstance(value, str):
                item = value.strip()
                analysis[field] = [item] if item else []
                continue
            if not isinstance(value, list):
                raise ValueError(f"{field} must be a list or string")
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

    def _validate_questions(self, payload: list[object], expected_count: int = 10) -> list[str]:
        if len(payload) != expected_count:
            raise ValueError(f"question list must contain exactly {expected_count} items")

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
