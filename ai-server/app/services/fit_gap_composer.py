from __future__ import annotations

import json
import os
import re
import time
from typing import Any

from app.schemas.fit_gap import FitAnalysisItem, FitGapAnalysisResponse, GapAnalysisItem
from app.schemas.report import FitGap


class FitGapComposerUnavailable(RuntimeError):
    pass


class FitGapComposer:
    """LLM composer for the middle Fit-Gap report section."""

    model = "gemini-3-flash-preview"
    TECH_TERMS = [
        "Java", "Kotlin", "Spring", "Spring Boot", "JPA", "Querydsl",
        "C", "C++", "C/C++", "Python", "JavaScript", "TypeScript",
        "React", "Node", "FastAPI", "API", "REST", "WebSocket", "WebRTC",
        "MSSQL", "MySQL", "PostgreSQL", "Mongo", "MongoDB", "Redis",
        "DB", "RDBMS", "NoSQL", "ERD", "SQL", "쿼리", "인덱스", "튜닝",
        "AWS", "EC2", "RDS", "S3", "IDC", "Docker", "Kubernetes",
        "Jenkins", "GitHub Actions", "CI/CD", "Linux", "리눅스",
        "임베디드", "Embedded", "OTA", "SDV", "자율주행", "커넥티드",
        "성능", "최적화", "장애", "로그", "모니터링", "보안", "테스트",
        "예약", "결제", "쿠폰", "빌링", "무인화", "스크린 골프",
        "메모리", "메모리 누수", "디버깅", "트러블슈팅", "아키텍처",
    ]
    REQUIREMENT_GROUPS = [
        ("Java/Spring 기반 백엔드 개발 역량", ["Java", "Spring", "Spring Boot", "JPA", "백엔드"]),
        ("API 개발 및 서비스 운영 경험", ["API", "REST", "서비스", "운영", "백엔드"]),
        ("관계형 데이터베이스 개발 및 운영", ["DB", "RDBMS", "MSSQL", "MySQL", "PostgreSQL", "SQL", "데이터베이스"]),
        ("MongoDB 등 NoSQL 활용 경험", ["Mongo", "MongoDB", "NoSQL"]),
        ("ERD 설계 및 데이터 모델링", ["ERD", "설계", "모델링", "데이터 모델"]),
        ("쿼리 성능 개선 및 튜닝", ["쿼리", "튜닝", "성능", "인덱스", "실행 계획", "최적화"]),
        ("예약/결제/쿠폰/빌링 도메인 이해", ["예약", "결제", "쿠폰", "빌링", "무인화"]),
        ("AWS 또는 IDC 운영 경험", ["AWS", "EC2", "RDS", "S3", "IDC", "클라우드"]),
        ("배포 자동화 및 운영 경험", ["Docker", "CI/CD", "GitHub Actions", "Jenkins", "배포", "운영"]),
        ("장애 분석 및 로그 기반 문제 해결", ["장애", "로그", "모니터링", "알림", "트러블슈팅"]),
        ("임베디드 C/C++ 및 Linux 개발 역량", ["임베디드", "C/C++", "C++", "Linux", "리눅스"]),
        ("차량 SW/SDV/OTA 도메인 이해", ["차량", "SDV", "OTA", "자율주행", "커넥티드"]),
        ("시스템 안정성 및 예외 상황 디버깅 역량", ["안정성", "예외", "디버깅", "메모리", "트러블슈팅"]),
        ("테스트 코드와 협업 경험", ["테스트", "코드 리뷰", "협업", "Git"]),
    ]
    WEAK_EVIDENCE_TERMS = {
        "개발", "운영", "서비스", "플랫폼", "경험", "관리", "업무", "기술", "프로젝트",
    }
    ACTION_MARKERS = [
        "적용", "도입", "구현", "개발", "설계", "분석", "추적", "해결", "개선",
        "튜닝", "배포", "운영", "수정", "추가", "확인", "측정", "작성", "연동",
        "설정", "처리", "찾", "줄", "낮", "높", "최적화",
    ]
    RESULT_PATTERNS = [
        r"\d+\s*(ms|초|분|시간|%|배|건|명)",
        "감소", "단축", "향상", "개선", "안정", "줄였", "줄었습니다",
        "유지", "성공", "해결", "낮췄", "높였", "빨라",
    ]
    WEAK_CONTEXT_PATTERNS = [
        "이론적으로", "개념을", "알고 있습니다", "공부", "학습", "자격증",
        "준비", "들어봤", "기본 개념", "수업 시간", "아직 프로젝트",
    ]
    NEGATIVE_CONTEXT_PATTERNS = [
        "해본 적은 없", "해본 적 없", "써본 적은 없", "써본 적 없",
        "직접 해보지 못", "직접 써본 적", "경험은 부족", "경험이 부족",
        "경험은 아직", "경험이 아직", "경험은 없습니다", "경험이 없습니다",
        "많지 않습니다", "부족합니다", "시도해 보지는 못", "시도하지 못",
        "프로젝트에서 사용해본 적은 없", "프로젝트에서 사용해본 적이 없",
        "실무에서 사용해본 적은 없", "실무에서 사용해본 적이 없",
        "직접 경험은 부족", "직접 경험은 없습니다",
    ]

    def generate(
        self,
        job_description: str,
        interview_session: str,
        resume_summary: str = "",
    ) -> FitGapAnalysisResponse:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise FitGapComposerUnavailable("GEMINI_API_KEY is not set")

        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise FitGapComposerUnavailable("google-genai is not installed") from exc

        client = genai.Client(api_key=api_key)
        response = self._generate_content_with_retry(
            client=client,
            model=self.model,
            contents=self._build_contents(types, job_description, interview_session, resume_summary),
            config=self._build_config(types),
        )

        text = getattr(response, "text", None)
        if not text:
            raise FitGapComposerUnavailable("Gemini response text is empty")

        payload = self._parse_json_text(text)
        return FitGapAnalysisResponse.model_validate(payload)

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

        raise FitGapComposerUnavailable(
            f"Gemini Fit-Gap generation failed after {len(delays) + 1} attempts: "
            f"{type(last_exc).__name__}: {last_exc}"
        ) from last_exc

    def generate_fit_gap(
        self,
        job_description: str,
        interview_session: str,
        resume_summary: str = "",
    ) -> FitGap:
        response = self.generate(job_description, interview_session, resume_summary)
        matched_requirement_keys = {
            self._normalize_requirement(item.matched_skill)
            for item in response.fit_analysis
        }
        gap_items = [
            item
            for item in response.gap_analysis
            if self._normalize_requirement(item.missing_skill) not in matched_requirement_keys
        ]

        return FitGap(
            matched_requirements=[
                f"요구사항: {item.matched_skill} / 근거({item.question_no}): {item.evidence}"
                for item in response.fit_analysis
            ][:5],
            missing_requirements=[
                f"요구사항: {item.missing_skill} / 부족 근거: {item.reason}"
                for item in gap_items
            ][:5],
            recommendations=response.improvement_suggestions[:3],
        )

    def generate_fallback(
        self,
        job_description: str,
        interview_session: str,
        resume_summary: str = "",
    ) -> FitGapAnalysisResponse:
        requirements = self._extract_requirement_items(job_description)
        if not requirements:
            requirements = self._extract_requirement_items(f"{resume_summary}\n{interview_session}")

        sources = self._build_evidence_sources(interview_session, resume_summary)
        fit_items: list[FitAnalysisItem] = []
        gap_items: list[GapAnalysisItem] = []

        for requirement in requirements:
            evidence = self._find_requirement_evidence(requirement["terms"], sources)
            if evidence and evidence["quality"] == "strong" and len(fit_items) < 5:
                fit_items.append(
                    FitAnalysisItem(
                        question_no=evidence["source"],
                        matched_skill=requirement["label"],
                        evidence=evidence["summary"],
                    )
                )
            elif len(gap_items) < 5:
                gap_items.append(
                    GapAnalysisItem(
                        missing_skill=requirement["label"],
                        reason=self._build_gap_reason(requirement["label"], evidence),
                    )
                )

        if not requirements:
            gap_items.append(
                GapAnalysisItem(
                    missing_skill="채용공고 핵심 요구사항",
                    reason="채용공고 원문에서 분석 가능한 요구사항 문장을 충분히 추출하지 못했습니다.",
                )
            )

        suggestions = [self._build_recommendation(item.missing_skill) for item in gap_items[:3]]
        if not suggestions:
            suggestions = [
                "충족된 요구사항도 적용 전후 수치와 본인 의사결정 근거를 함께 말하면 설득력이 더 높아집니다.",
                "채용공고에 나온 기술명을 답변 첫 문장에 연결하고, 뒤에서 실제 프로젝트 근거를 설명하세요.",
            ]

        summary = (
            "Gemini 호출이 제한되어 규칙 기반 fallback으로 분석했습니다. "
            "채용공고의 요구사항 문장과 지원자 제출 문서, 면접 답변의 직접 키워드 근거를 기준으로 Fit-Gap을 산출했습니다."
        )
        return FitGapAnalysisResponse(
            fit_analysis=fit_items,
            gap_analysis=gap_items,
            improvement_suggestions=suggestions[:3],
            overall_summary=summary,
        )

    def generate_fit_gap_fallback(
        self,
        job_description: str,
        interview_session: str,
        resume_summary: str = "",
    ) -> FitGap:
        response = self.generate_fallback(job_description, interview_session, resume_summary)
        matched_requirement_keys = {
            self._normalize_requirement(item.matched_skill)
            for item in response.fit_analysis
        }
        gap_items = [
            item
            for item in response.gap_analysis
            if self._normalize_requirement(item.missing_skill) not in matched_requirement_keys
        ]
        return FitGap(
            matched_requirements=[
                f"요구사항: {item.matched_skill} / 근거({item.question_no}): {item.evidence}"
                for item in response.fit_analysis
            ][:5],
            missing_requirements=[
                f"요구사항: {item.missing_skill} / 부족 근거: {item.reason}"
                for item in gap_items
            ][:5],
            recommendations=response.improvement_suggestions[:3],
        )

    def _extract_requirement_items(self, text: str) -> list[dict[str, list[str] | str]]:
        normalized_text = (text or "").lower()
        found: list[dict[str, list[str] | str]] = []

        for line in self._extract_requirement_lines(text):
            terms = self._extract_terms_for_requirement(line)
            if terms:
                found.append({"label": line, "terms": terms})

        for label, terms in self.REQUIREMENT_GROUPS:
            if any(self._contains_term(normalized_text, term) for term in terms):
                found.append({"label": label, "terms": terms})

        for keyword in self.TECH_TERMS:
            if self._contains_term(normalized_text, keyword):
                found.append({"label": keyword, "terms": [keyword]})

        deduped = []
        seen = set()
        for item in found:
            key = self._normalize_requirement(item["label"])
            if key and key not in seen:
                seen.add(key)
                deduped.append(item)
        return deduped[:10]

    def _extract_requirement_lines(self, text: str) -> list[str]:
        lines = []
        for raw in re.split(r"\n|(?<=[.!?])\s+", text or ""):
            line = re.sub(r"^[\s*•·\-–—\d.)]+", "", raw).strip()
            line = re.sub(r"\s+", " ", line).strip(" .")
            if not line or len(line) < 6:
                continue
            if self._is_requirement_heading(line):
                continue
            if self._looks_like_requirement(line):
                lines.append(self._normalize_requirement_label(line))
        return lines

    def _is_requirement_heading(self, line: str) -> bool:
        headings = [
            "합류하시면", "이런 경험을 가진 분", "이런 경험을 우대", "지원 자격",
            "주요 업무", "자격 요건", "우대 사항", "필수 자격", "담당 업무",
        ]
        return any(heading in line for heading in headings) and not any(
            self._contains_term(line, term) for term in self.TECH_TERMS
        )

    def _looks_like_requirement(self, line: str) -> bool:
        if any(self._contains_term(line, term) for term in self.TECH_TERMS):
            return True
        markers = ["경험", "역량", "담당", "개발", "운영", "설계", "개선", "최적화", "유지보수"]
        return any(marker in line for marker in markers)

    def _normalize_requirement_label(self, line: str) -> str:
        label = re.sub(r"\s*개발합니다$", " 개발", line)
        label = re.sub(r"\s*운영합니다$", " 운영", label)
        label = re.sub(r"\s*(담당|수행)합니다$", "", label)
        label = re.sub(r"\s*찾습니다$", "", label)
        label = re.sub(r"\s*우대합니다$", "", label)
        label = re.sub(r"\s*(있는|있으신|이신|하신)?\s*분[을를]?$", "", label)
        label = re.sub(r"([가-힣])[을를]\s+(개발|운영)$", r"\1 \2", label)
        label = re.sub(r"([가-힣])[이가은는을를]$", r"\1", label)
        label = label.strip(" .")
        return label

    def _extract_terms_for_requirement(self, line: str) -> list[str]:
        terms = []
        for term in self.TECH_TERMS:
            if self._contains_term(line, term) and term not in terms:
                terms.append(term)
        english_tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#/.&-]{1,}", line)
        for token in english_tokens:
            if token not in terms:
                terms.append(token)
        korean_terms = [
            "데이터베이스", "스크린 골프", "매장 관리", "타석 예약", "성능 개선",
            "유지보수", "신규 개발", "무선 업데이트", "차량용 OS", "시스템 안정성",
            "메모리 누수", "예외 처리", "트러블슈팅",
        ]
        for term in korean_terms:
            if term in line and term not in terms:
                terms.append(term)
        return terms

    def _build_evidence_sources(self, interview_session: str, resume_summary: str) -> list[dict[str, str]]:
        sources = []
        if resume_summary.strip():
            sources.append({"source": "지원자 제출 문서", "text": resume_summary, "answer": resume_summary})

        pattern = re.compile(r"Q(\d+)\.\s*(.*?)(?:\nA\1\.\s*(.*?))(?=\nQ\d+\.|\Z)", re.DOTALL)
        for match in pattern.finditer(interview_session or ""):
            question_no, question, answer = match.groups()
            sources.append({
                "source": f"Q{question_no}",
                "text": f"{question}\n{answer}",
                "question": question,
                "answer": answer,
            })

        if not sources and interview_session.strip():
            sources.append({"source": "면접 답변", "text": interview_session, "answer": interview_session})
        return sources

    def _find_requirement_evidence(self, terms: list[str], sources: list[dict[str, str]]) -> dict[str, str] | None:
        weak_candidate: dict[str, str] | None = None

        for source in sources:
            text = source.get("answer") or source["text"]
            lower_text = text.lower()
            matched_terms = [
                term
                for term in terms
                if term and self._contains_term(lower_text, term)
            ]
            if not matched_terms:
                continue
            strong_terms = [
                term for term in matched_terms
                if term not in self.WEAK_EVIDENCE_TERMS and len(term) > 1
            ]
            if len(matched_terms) < 2 and not strong_terms:
                continue

            context = self._evidence_context(text, matched_terms)
            snippet = self._evidence_snippet(context, matched_terms[0])
            if self._has_negative_context(context) or self._is_weak_context(context):
                weak_candidate = weak_candidate or {
                    "source": source["source"],
                    "quality": "weak",
                    "reason": (
                        f"{source['source']}에서 '{snippet}'처럼 {', '.join(matched_terms[:3])} 언급은 있으나, "
                        "직접 수행 경험이나 적용 결과가 충분히 확인되지 않습니다."
                    ),
                }
                continue

            if self._has_action_evidence(context) or self._has_result_evidence(context):
                return {
                    "source": source["source"],
                    "quality": "strong",
                    "summary": (
                        f"{source['source']}에서 '{snippet}' 내용으로 "
                        f"{', '.join(matched_terms[:3])} 관련 수행 근거가 확인됩니다."
                    ),
                }

            weak_candidate = weak_candidate or {
                "source": source["source"],
                "quality": "weak",
                "reason": (
                    f"{source['source']}에서 '{snippet}'처럼 {', '.join(matched_terms[:3])} 언급은 있으나, "
                    "본인 역할, 적용 방식, 결과 수치가 함께 제시되지 않았습니다."
                ),
            }
        return weak_candidate

    def _build_gap_reason(self, requirement_label: str, evidence: dict[str, str] | None) -> str:
        if evidence and evidence.get("quality") == "weak":
            return (
                f"공고에는 {requirement_label}{self._subject_particle(requirement_label)} 요구됩니다. {evidence['reason']} "
                "따라서 현재 답변만으로는 부분 충족 수준으로 보고, 추가 근거가 필요합니다."
            )
        return (
            f"공고에는 {requirement_label}{self._subject_particle(requirement_label)} 요구되지만, "
            "지원자 제출 문서와 면접 답변에서 직접적인 수행 근거가 충분히 확인되지 않습니다."
        )

    def _build_recommendation(self, missing_skill: str) -> str:
        label = missing_skill or ""
        if any(term in label for term in ["SDV", "OTA", "차량", "커넥티드", "자율주행"]):
            return "SDV/OTA 구조와 차량 데이터 흐름을 정리하고, 서버와 차량 SW 안정성을 연결해 설명할 수 있는 사례를 준비하세요."
        if any(term in label for term in ["C/C++", "C++", "Linux", "리눅스", "임베디드", "메모리", "디버깅"]):
            return "C/C++ 또는 Linux 환경에서 재현 조건, 로그 분석, 수정 결과가 드러나는 시스템 디버깅 경험을 구체화하세요."
        if any(term in label for term in ["AWS", "Docker", "배포", "CI/CD", "Jenkins", "GitHub Actions", "클라우드"]):
            return "Docker/AWS 배포 흐름과 장애 시 롤백, 모니터링, 환경 변수 관리 경험을 간단한 프로젝트로 보완하세요."
        if any(term in label for term in ["DB", "데이터베이스", "MySQL", "Mongo", "Redis", "인덱스", "쿼리", "튜닝", "성능"]):
            return "실행 계획 기반 인덱스 튜닝, Redis 캐시 무효화, 적용 전후 성능 수치를 포함한 DB 개선 사례를 준비하세요."
        if any(term in label for term in ["Spring", "Java", "API", "백엔드", "REST", "서비스"]):
            return "Spring Boot API 설계, 예외 처리, 로그 기반 장애 추적까지 이어지는 백엔드 운영 경험을 한 사례로 정리하세요."
        return f"{missing_skill}에 대해 사용 기술, 본인 역할, 적용 결과를 한 답변 안에서 함께 정리하세요."

    def _has_action_evidence(self, text: str) -> bool:
        return any(marker in (text or "") for marker in self.ACTION_MARKERS)

    def _has_result_evidence(self, text: str) -> bool:
        return any(re.search(pattern, text or "", re.IGNORECASE) for pattern in self.RESULT_PATTERNS)

    def _has_negative_context(self, text: str) -> bool:
        return any(pattern in (text or "") for pattern in self.NEGATIVE_CONTEXT_PATTERNS)

    def _is_weak_context(self, text: str) -> bool:
        normalized = text or ""
        if not any(pattern in normalized for pattern in self.WEAK_CONTEXT_PATTERNS):
            return False
        return not (self._has_action_evidence(normalized) and self._has_result_evidence(normalized))

    def _subject_particle(self, text: str) -> str:
        stripped = (text or "").strip()
        if not stripped:
            return "이"
        last_char = stripped[-1]
        code = ord(last_char)
        if 0xAC00 <= code <= 0xD7A3:
            return "이" if (code - 0xAC00) % 28 else "가"
        return "가"

    def _contains_term(self, text: str, term: str) -> bool:
        if not text or not term:
            return False
        normalized_text = text.lower()
        normalized_term = term.lower()
        if re.fullmatch(r"[a-z0-9+#/.&-]+", normalized_term):
            pattern = rf"(?<![a-z0-9+#/.&-]){re.escape(normalized_term)}(?![a-z0-9+#/.&-])"
            return re.search(pattern, normalized_text) is not None
        return normalized_term in normalized_text

    def _evidence_snippet(self, text: str, term: str) -> str:
        compact = re.sub(r"\s+", " ", text or "").strip()
        index = compact.lower().find(term.lower())
        if index < 0:
            return compact[:90]
        start = max(0, index - 35)
        end = min(len(compact), index + len(term) + 55)
        snippet = compact[start:end].strip()
        if start > 0:
            snippet = "..." + snippet
        if end < len(compact):
            snippet += "..."
        return snippet

    def _evidence_context(self, text: str, matched_terms: list[str]) -> str:
        compact = re.sub(r"\s+", " ", text or "").strip()
        if not compact:
            return ""
        units = [
            unit.strip()
            for unit in re.split(r"(?<=[.!?。])\s+|\n+", text or "")
            if unit.strip()
        ]
        for unit in units:
            if any(self._contains_term(unit, term) for term in matched_terms):
                return re.sub(r"\s+", " ", unit).strip()
        return self._evidence_snippet(compact, matched_terms[0] if matched_terms else "")

    def _normalize_requirement(self, requirement: str) -> str:
        normalized = re.sub(r"\s+", "", requirement or "")
        normalized = re.sub(r"[/·,.\-()]", "", normalized)
        return normalized.lower()

    def _build_contents(
        self,
        types: Any,
        job_description: str,
        interview_session: str,
        resume_summary: str = "",
    ) -> list[Any]:
        applicant_document_block = resume_summary.strip() or "제공된 지원자 제출 문서 없음"
        return [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text="""[채용 공고: 백엔드 소프트웨어 엔지니어]
- 주요 업무: 서비스 백엔드 API 개발 및 운영, 데이터베이스 연동, 서비스 안정성 개선
- 필수 자격: Java 또는 Kotlin 기반 백엔드 개발 경험, Spring Framework 사용 경험, 관계형 데이터베이스 활용 역량
- 우대 사항:
  1. 캐시, 메시징 등 비동기 처리 기술에 대한 이해 또는 활용 경험
  2. 클라우드 환경 및 배포 자동화에 대한 이해 또는 운영 경험
  3. 서비스 장애 분석 및 성능 개선 경험

[전체 면접 세트: 4쌍]

Q1. 본인이 주도적으로 진행한 기술적 성취와 성능 최적화 경험에 대해 구체적으로 말씀해 주세요.
A1. 작년 학교 캡스톤 디자인 프로젝트에서 실시간 배달 앱의 백엔드를 맡았습니다. 처음에는 사용자 100명만 접속해도 API 응답 속도가 500ms 이상으로 느려지는 문제가 있었습니다. 원인을 분석해 보니 반복적인 DB 조회 쿼리가 병목이었습니다. 이를 해결하기 위해 Redis를 도입하여 조회 빈도가 높은 상점 데이터와 메뉴 정보를 캐싱했습니다. 그 결과 DB 부하를 70% 이상 줄였고, 평균 응답 시간을 80ms로 단축시켰습니다.

Q2. 마이크로서비스 아키텍처(MSA)에서 서비스 간 데이터 정합성을 어떻게 유지했는지, 혹은 관련 경험이 있나요?
A2. MSA에 대해서는 수업 시간에 이론적으로 배우긴 했습니다. 서비스들을 분리해서 관리하면 독립적인 배포가 가능하다는 장점을 알고 있습니다. 하지만 제가 진행한 프로젝트는 규모가 크지 않아서 하나의 거대한 서버(Monolithic)로 구현했습니다. 그래서 실제 서비스 간 데이터 정합성을 맞추는 복잡한 로직이나 Kafka 같은 메시지 브로커를 직접 써본 적은 없지만, 입사 후 빠르게 학습할 준비가 되어 있습니다.

Q3. 인프라 구축 및 배포 자동화(CI/CD) 과정에서 겪었던 기술적 어려움은 무엇이었나요?
A3. 인프라는 주로 AWS EC2 프리티어 인스턴스를 하나 빌려서 수동으로 배포했습니다. 깃허브에 코드를 올리면 서버에 접속해서 git pull을 받고 빌드하는 방식이었습니다. Docker나 Jenkins 같은 툴은 설정이 복잡해 보여서 시도해 보지는 못했고, 주로 리눅스 커맨드라인에서 환경 변수를 설정하고 실행하는 방식으로 관리했습니다. 수동 배포다 보니 가끔 설정 누락으로 서버가 안 켜지는 실수를 하기도 했습니다.

Q4. 복잡한 쿼리 상황에서 성능을 개선하기 위해 어떤 노력을 하셨나요?
A4. 주문 내역을 조회할 때 여러 테이블을 Join하다 보니 속도가 많이 느려졌습니다. JPA의 기본 메서드만으로는 한계가 있어서 Querydsl을 도입해 동적 쿼리를 작성했습니다. 필요한 컬럼만 조회하도록 프로젝션을 최적화했고, 자주 검색 조건으로 쓰이는 '주문 상태'와 '사용자 ID'에 복합 인덱스를 설정하여 조회 성능을 기존 대비 약 3배 정도 향상시켰습니다."""),
                ],
            ),
            types.Content(
                role="model",
                parts=[
                    types.Part.from_text(text="""```json
{
  "fit_analysis": [
    {
      "question_no": "Q1",
      "matched_skill": "캐시, 메시징 등 비동기 처리 기술에 대한 이해 또는 활용 경험",
      "evidence": "Q1 답변에서 Redis 캐시를 적용해 반복 조회 데이터를 캐싱했고, DB 부하와 API 응답 시간을 개선했다고 설명합니다."
    },
    {
      "question_no": "Q4",
      "matched_skill": "관계형 데이터베이스 활용 역량",
      "evidence": "Q4 답변에서 Join으로 느려진 주문 조회를 필요한 컬럼 조회와 복합 인덱스 설정으로 개선했다고 설명합니다."
    }
  ],
  "gap_analysis": [
    {
      "missing_skill": "백엔드 API 개발 및 운영 경험",
      "reason": "API 개발과 성능 개선 경험은 있으나, 운영 중 장애 탐지나 재발 방지처럼 운영 단계의 근거는 답변에서 확인되지 않습니다."
    },
    {
      "missing_skill": "배포 자동화 또는 클라우드 운영 경험",
      "reason": "EC2에 직접 접속해 수동으로 배포한 경험은 있으나, 자동화된 배포 흐름이나 운영 환경 개선 경험은 아직 구체적으로 드러나지 않습니다."
    }
  ],
  "improvement_suggestions": [
    "Redis 캐싱을 적용한 과정에서 어떤 지표를 보고 병목을 판단했는지, 적용 전후 수치를 더 구체적으로 정리하는 것이 좋습니다.",
    "수동 배포 경험을 GitHub Actions 같은 간단한 자동화 흐름으로 확장하면 운영 역량을 더 설득력 있게 보여줄 수 있습니다.",
    "성능 문제뿐 아니라 장애 발생 시 로그 확인, 원인 분석, 재발 방지 조치까지 이어지는 경험을 프로젝트에 추가하는 것이 좋습니다."
  ],
  "overall_summary": "캐시 적용과 데이터베이스 조회 성능 개선 경험은 백엔드 API 개발 직무와 잘 연결됩니다. 다만 운영, 배포 자동화, 장애 대응 경험은 답변에서 상대적으로 덜 드러나므로 이 부분을 보완하면 직무 적합도를 더 높일 수 있습니다."
}
```"""),
                ],
            ),
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"""[채용 공고]
{job_description}

[지원자 제출 문서]
{applicant_document_block}

[전체 면접 세트]
{interview_session}"""
                    ),
                ],
            ),
        ]

    def _build_config(self, types: Any) -> Any:
        return types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_level="HIGH",
            ),
            system_instruction=[
                types.Part.from_text(text="""너는 IT 전문 채용 컨설턴트다. 
제공된 [채용 공고]의 핵심 요구사항과 [지원자 제출 문서], [전체 면접 세트]의 답변들을 대조 분석하여 'Fit-Gap 리포트'를 작성하라.

분석 원칙:
1. 먼저 [채용 공고]에서 명시된 요구사항을 뽑고, fit_analysis와 gap_analysis는 반드시 그 요구사항을 기준으로 작성할 것.
2. matched_skill과 missing_skill에는 후보자의 역량명이 아니라 채용공고의 요구사항 문장을 적을 것.
3. 답변이나 지원자 제출 문서에 명시 근거가 있는 요구사항만 fit_analysis에 넣을 것. 키워드가 비슷해도 근거가 약하면 fit으로 처리하지 말 것.
4. evidence에는 "Q1 답변", "지원자 제출 문서"처럼 근거 출처와 답변 내용을 함께 적을 것.
5. 채용공고 요구사항이 지원자 제출 문서와 답변 전체에서 확인되지 않거나 부분적으로만 확인되면 gap_analysis에 넣을 것.
6. [지원자 제출 문서]는 이력서, 자기소개서, 포트폴리오 요약 또는 그 일부일 수 있으므로 형식에 의존하지 말 것.
7. 공고에 기술명이 구체적으로 없으면 특정 라이브러리나 도구명을 과하게 추정하지 말고, "성능 개선", "운영 경험", "배포 자동화"처럼 공고의 역량 범주로 분석할 것.
8. "Spring Boot 기반 백엔드 개발 역량"처럼 공고 요구사항을 넓게 재작성하지 말고, 공고에 나온 표현이나 그에 매우 가까운 표현을 사용할 것.
9. question_no에는 직접 근거가 있는 출처만 적을 것. 면접 답변에 직접 나오지 않은 근거는 Q번호를 붙이지 말고 "지원자 제출 문서"라고 적을 것.
10. evidence에서 서로 다른 출처의 근거를 억지로 엮지 말 것. 예를 들어 MySQL 근거가 제출 문서에만 있으면 Q1의 Redis 답변을 함께 근거로 쓰지 말 것.
11. Q번호를 적을 때는 해당 Q/A 안에 요구사항을 직접 뒷받침하는 내용이 있어야 한다. 개념 설명만으로 프로젝트 수행 경험을 증명했다고 판단하지 말 것.
12. 같은 채용공고 요구사항을 fit_analysis와 gap_analysis 양쪽에 동시에 넣지 말 것. 부분적으로만 확인된 요구사항은 gap_analysis에 넣고, 이미 충분히 확인된 요구사항은 fit_analysis에만 넣을 것.
13. 단정적으로 "경험이 전무함", "직무 적합도가 낮음"처럼 평가하지 말고, "답변에서 확인되지 않음", "보완하면 좋음"처럼 근거 중심으로 표현할 것.
14. improvement_suggestions는 가능하면 3개를 작성하고, 바로 실행 가능한 학습/프로젝트 개선 방향으로 제안할 것.
15. 모든 문장은 사용자에게 보여줄 리포트 문체로 작성하고, "명시함", "확인됨", "권장함", "부족함" 같은 명사형 종결 대신 "-합니다", "-습니다" 체로 통일할 것.
16. "최적의 후보자", "완벽히 부합", "매우 우수"처럼 과도하게 긍정적인 표현도 피하고, "적합도를 높일 수 있습니다", "강점으로 볼 수 있습니다"처럼 절제된 표현을 사용할 것.

반드시 아래 JSON 형식을 엄격히 준수하라:
{
  "fit_analysis": [
    {
      "question_no": "질문 번호",
      "matched_skill": "일치하는 공고 상의 역량",
      "evidence": "답변 내 근거 문장 요약"
    }
  ],
  "gap_analysis": [
    {
      "missing_skill": "공고에서 요구하나 부족한 역량",
      "reason": "부족하다고 판단한 구체적 이유"
    }
  ],
  "improvement_suggestions": ["보완을 위한 구체적인 기술적 조언 2~3개"],
  "overall_summary": "전체적인 직무 적합도 요약 (3줄 내외)"
}"""),
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
