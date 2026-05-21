from __future__ import annotations

import json
import os
import re
from typing import Any

from app.schemas.fit_gap import FitGapAnalysisResponse
from app.schemas.report import FitGap


class FitGapComposerUnavailable(RuntimeError):
    pass


class FitGapComposer:
    """LLM composer for the middle Fit-Gap report section."""

    model = "gemini-3-flash-preview"

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
        response = client.models.generate_content(
            model=self.model,
            contents=self._build_contents(types, job_description, interview_session, resume_summary),
            config=self._build_config(types),
        )

        text = getattr(response, "text", None)
        if not text:
            raise FitGapComposerUnavailable("Gemini response text is empty")

        payload = self._parse_json_text(text)
        return FitGapAnalysisResponse.model_validate(payload)

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
