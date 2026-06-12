import logging
import re

from app.model.inference import ModelInference, ModelUnavailable
from app.model.json_utils import ModelJsonError
from app.model.prompts import build_answer_evaluation_prompt
from app.schemas.evaluation import AnswerEvaluation, ModelAnswerEvaluation
from app.schemas.report import InterviewAnswer, MetricsSummary, QuestionReport, Replay
from app.schemas.report import ReportRequest
from app.services.text_signals import has_action, has_result, infer_sentence_clarity, infer_star

logger = logging.getLogger(__name__)


class AnswerEvaluator:
    """Step 1: evaluate each question-answer pair.

    SFT inference is used when AI_MODEL_ENABLED=true. The deterministic path is
    retained for local integration and mock interview data.
    """

    def __init__(self, model_inference: ModelInference | None = None) -> None:
        self.model_inference = model_inference or ModelInference()

    def evaluate(self, answer: InterviewAnswer, request: ReportRequest | None = None) -> AnswerEvaluation:
        if request is not None:
            model_evaluation = self._try_model_evaluation(answer, request)
            if model_evaluation is not None:
                return self._from_model(answer, model_evaluation)

        return self._fallback_evaluate(answer)

    def _try_model_evaluation(
        self,
        answer: InterviewAnswer,
        request: ReportRequest,
    ) -> ModelAnswerEvaluation | None:
        if not self.model_inference.settings.enabled and not self.model_inference.settings.required:
            return None

        try:
            prompt = build_answer_evaluation_prompt(answer, request)
            raw = self.model_inference.generate_json(prompt)
            return ModelAnswerEvaluation.model_validate(raw)
        except (ModelUnavailable, ModelJsonError, ValueError) as exc:
            if self.model_inference.settings.required:
                logger.exception(
                    "model evaluation failed for question_id=%s and AI_MODEL_REQUIRED=true",
                    answer.question_id,
                )
                raise
            logger.warning(
                "model evaluation failed for question_id=%s; using fallback evaluator: %s",
                answer.question_id,
                exc,
            )
            return None

    def _from_model(self, answer: InterviewAnswer, model_evaluation: ModelAnswerEvaluation) -> AnswerEvaluation:
        answer_text = (answer.answer or "").strip()
        metrics_summary = self._metrics_summary(answer)
        score = self._clamp_five_point_score(model_evaluation.overall_score)

        strengths = model_evaluation.strengths or ["질문 의도를 일부 파악하고 답변을 시도했습니다."]
        improvements = model_evaluation.improvements or [self._default_improvement(answer)]

        return AnswerEvaluation(
            report=QuestionReport(
                question_id=answer.question_id,
                answer_id=answer.answer_id,
                mentee_id=answer.mentee_id,
                mentee_name=answer.mentee_name,
                question=answer.question,
                answer=answer_text,
                score=score,
                reasoning=model_evaluation.reasoning or self._build_reason(score, metrics_summary),
                strengths=strengths,
                improvements=improvements,
                evaluation_source="sft",
                ai_model_name=self._sft_model_name(),
                prompt_version="sft_eval_v1",
                replay=Replay(
                    audio_url=answer.audio_url,
                    start_time=answer.answer_start,
                    end_time=answer.answer_end,
                ),
            ),
            highlight_reason=model_evaluation.reasoning or self._build_reason(score, metrics_summary),
            metrics_summary=metrics_summary,
        )

    def _fallback_evaluate(self, answer: InterviewAnswer) -> AnswerEvaluation:
        answer_text = (answer.answer or "").strip()
        metrics_summary = self._metrics_summary(answer)
        technical_feedback = self._technical_concept_feedback(answer.question, answer_text)

        score = 2.5
        reasoning = ""
        strengths: list[str] = []
        improvements: list[str] = []

        if technical_feedback:
            score = technical_feedback["score"]
            reasoning = technical_feedback.get("reasoning", "")
            strengths.extend(technical_feedback["strengths"])
            improvements.extend(technical_feedback["improvements"])
        else:
            if len(answer_text) >= 80:
                score += 0.5
                strengths.append("질문의 방향에 맞춰 답변을 충분히 전개했습니다.")
            else:
                improvements.append("핵심 근거와 실제 경험을 한두 문장 더 보완하세요.")

            if has_result(answer_text):
                score += 0.5
                strengths.append("결과나 개선 효과를 언급해 설득력을 높였습니다.")
            else:
                improvements.append("적용 전후 수치나 결과를 포함하면 평가가 좋아집니다.")

            if has_action(answer_text):
                score += 0.4
                strengths.append("본인이 수행한 행동이 드러납니다.")
            else:
                improvements.append("본인이 직접 한 행동을 구체적으로 설명하세요.")

            if metrics_summary.star_structure != "Action/Result 부족":
                score += 0.3
            else:
                improvements.append("STAR 구조에서 Action과 Result를 분명히 말하세요.")

        if metrics_summary.sentence_clarity == "장황함":
            score -= 0.3
            improvements.append("문장을 짧게 나누어 핵심부터 답변하세요.")

        if metrics_summary.speaking_speed in {"빠름", "느림"}:
            score -= 0.2
            improvements.append("말하기 속도를 조금 더 안정적으로 조절하세요.")

        score = self._clamp_five_point_score(score)

        if not strengths:
            strengths.append("질문 의도를 일부 파악하고 답변을 시도했습니다.")
        if not improvements:
            improvements.append("현재 답변의 구체성을 유지하면서 핵심을 더 압축하세요.")

        return AnswerEvaluation(
            report=QuestionReport(
                question_id=answer.question_id,
                answer_id=answer.answer_id,
                mentee_id=answer.mentee_id,
                mentee_name=answer.mentee_name,
                question=answer.question,
                answer=answer_text,
                score=score,
                reasoning=reasoning or self._build_reason(score, metrics_summary),
                strengths=strengths,
                improvements=improvements,
                evaluation_source="fallback",
                ai_model_name="rule-based-fallback",
                prompt_version="fallback_eval_v1",
                replay=Replay(
                    audio_url=answer.audio_url,
                    start_time=answer.answer_start,
                    end_time=answer.answer_end,
                ),
            ),
            highlight_reason=reasoning or self._build_reason(score, metrics_summary),
            metrics_summary=metrics_summary,
        )

    def _metrics_summary(self, answer: InterviewAnswer) -> MetricsSummary:
        metrics = answer.metrics
        answer_text = answer.answer or ""
        star = infer_star(answer_text)

        return MetricsSummary(
            speaking_speed=(metrics.speaking_speed if metrics else None) or "미측정",
            silence=(metrics.silence if metrics else None) or "미측정",
            sentence_clarity=(metrics.sentence_clarity if metrics else None)
            or infer_sentence_clarity(answer_text),
            star_structure=(metrics.star_structure if metrics and metrics.star_structure != "AI 판단 필요" else star),
        )

    def _build_reason(self, score: float, metrics_summary: MetricsSummary) -> str:
        if score >= 4.0:
            return "구체적인 행동과 결과가 드러나 Best 문항 후보로 적합합니다."
        if score <= 2.5:
            return "답변의 기본 방향은 있으나 근거, 행동, 결과가 부족해 보완이 필요합니다."
        return (
            "핵심 답변은 가능하지만 "
            f"{metrics_summary.star_structure} 상태라 더 구체적인 결과 설명이 필요합니다."
        )

    def _default_improvement(self, answer: InterviewAnswer) -> str:
        if self._is_technical_knowledge_question(answer.question):
            return "질문에서 요구한 핵심 개념의 정의, 차이점, 사용 이유를 정확히 구분해 설명하세요."
        return "답변을 더 구체적인 상황, 행동, 결과로 보완하세요."

    def _technical_concept_feedback(self, question: str, answer_text: str) -> dict | None:
        if not self._is_technical_knowledge_question(question):
            return None

        question_lower = question.lower()
        answer_lower = answer_text.lower()
        normalized_answer = re.sub(r"\s+", "", answer_lower)

        if "tcp" in question_lower and "udp" in question_lower:
            return self._tcp_udp_feedback(answer_lower, normalized_answer)
        if "jpa" in question_lower or "영속성" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="JPA/영속성 컨텍스트",
                expected=[
                    ("영속성 컨텍스트", ["영속성", "persistence", "컨텍스트"]),
                    ("엔티티 생명주기와 1차 캐시", ["1차 캐시", "생명주기", "entity", "엔티티"]),
                    ("변경 감지나 지연 로딩", ["변경 감지", "dirty", "지연 로딩", "lazy"]),
                    ("트랜잭션 단위 관리", ["트랜잭션", "flush", "commit", "커밋"]),
                ],
                misconceptions=[
                    ("JPA를 단순 SQL 작성 도구로만 설명했습니다.", ["sql만", "쿼리만", "sql을 대신"]),
                    ("JPA가 데이터베이스 자체라는 식의 설명은 부정확합니다.", ["데이터베이스입니다", "db입니다"]),
                ],
            )
        if "n+1" in question_lower or "n + 1" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="N+1 문제",
                expected=[
                    ("연관 데이터 조회 시 추가 쿼리 발생", ["추가 쿼리", "여러 번", "반복", "연관"]),
                    ("지연 로딩과 조회 전략", ["지연 로딩", "lazy", "fetch"]),
                    ("fetch join이나 EntityGraph 등 해결책", ["fetch join", "페치 조인", "entitygraph", "batch"]),
                ],
                misconceptions=[
                    ("N+1을 단순히 데이터가 많아서 생기는 문제로만 설명했습니다.", ["데이터가 많", "많아서"]),
                ],
            )
        if "인덱스" in question_lower or "index" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="DB 인덱스",
                expected=[
                    ("검색 성능 개선", ["검색", "조회", "탐색", "성능"]),
                    ("B-Tree 또는 정렬된 자료구조", ["b-tree", "btree", "트리", "정렬"]),
                    ("쓰기 비용과 저장 공간 트레이드오프", ["쓰기", "insert", "update", "저장 공간", "트레이드오프"]),
                    ("실행 계획 확인", ["실행 계획", "explain", "옵티마이저"]),
                ],
                misconceptions=[
                    ("인덱스가 모든 쿼리를 무조건 빠르게 만든다는 설명은 부정확합니다.", ["무조건", "항상 빠"]),
                    ("인덱스를 데이터 압축 기능처럼 설명했습니다.", ["압축"]),
                ],
            )
        if "트랜잭션" in question_lower or "transaction" in question_lower or "격리" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="트랜잭션",
                expected=[
                    ("ACID", ["acid", "원자성", "일관성", "격리성", "지속성"]),
                    ("commit/rollback", ["commit", "rollback", "커밋", "롤백"]),
                    ("격리 수준과 동시성 문제", ["격리", "동시성", "dirty read", "phantom", "repeatable"]),
                    ("데이터 정합성 보장", ["정합성", "일관성"]),
                ],
                misconceptions=[
                    ("트랜잭션을 단순 로그 기록이나 쿼리 묶음 정도로만 설명했습니다.", ["로그", "기록만"]),
                ],
            )
        if "jwt" in question_lower or "oauth" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="JWT/OAuth",
                expected=[
                    ("JWT는 토큰 형식", ["토큰", "claim", "클레임", "서명", "signature"]),
                    ("OAuth는 권한 위임/인가 프로토콜", ["인가", "권한 위임", "authorization", "access token"]),
                    ("인증과 인가 구분", ["인증", "인가"]),
                    ("보안상 만료와 저장 위치 고려", ["만료", "refresh", "탈취", "저장"]),
                ],
                misconceptions=[
                    ("JWT와 OAuth를 같은 개념으로 설명했습니다.", ["같은", "동일"]),
                    ("OAuth를 로그인 화면 자체로만 설명했습니다.", ["로그인 화면", "로그인 페이지"]),
                ],
            )
        if "rest" in question_lower or "rest api" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="REST API",
                expected=[
                    ("리소스 중심 URI", ["리소스", "uri", "url"]),
                    ("HTTP method 의미", ["get", "post", "put", "patch", "delete", "method", "메서드"]),
                    ("stateless", ["stateless", "무상태"]),
                    ("상태 코드를 통한 응답 의미", ["상태 코드", "status"]),
                ],
                misconceptions=[
                    ("REST를 단순히 JSON을 주고받는 API로만 설명했습니다.", ["json만", "json을"]),
                ],
            )
        if "http" in question_lower and "https" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="HTTP/HTTPS",
                expected=[
                    ("HTTPS는 TLS/SSL 암호화", ["tls", "ssl", "암호화", "인증서"]),
                    ("HTTP는 평문 전송", ["평문", "암호화되지"]),
                    ("무결성과 서버 인증", ["무결성", "인증서", "서버 인증"]),
                ],
                misconceptions=[
                    ("HTTPS를 단순히 속도가 빠른 HTTP로 설명했습니다.", ["빠른", "속도"]),
                ],
            )
        if "redis" in question_lower or "캐시" in question_lower or "cache" in question_lower:
            return self._concept_rule_feedback(
                answer_lower,
                title="Redis/캐시",
                expected=[
                    ("메모리 기반 저장소", ["메모리", "in-memory", "인메모리"]),
                    ("캐시로 조회 성능 개선", ["캐시", "조회", "성능"]),
                    ("TTL/만료와 일관성 고려", ["ttl", "만료", "일관성", "무효화"]),
                    ("세션, 랭킹, 분산락 등 활용", ["세션", "랭킹", "분산락", "pub/sub"]),
                ],
                misconceptions=[
                    ("Redis를 일반 관계형 데이터베이스와 동일하게 설명했습니다.", ["관계형", "join"]),
                ],
            )

        return {
            "score": 3.0 if len(answer_text) >= 40 else 2.5,
            "reasoning": "기술 개념 질문이지만 핵심 개념의 정확성 근거가 충분히 드러나지 않았습니다.",
            "strengths": ["기술 개념 질문에 대해 답변을 시도했습니다."],
            "improvements": [
                "핵심 개념의 정의와 차이점을 먼저 말한 뒤, 실제 사용 사례를 연결하세요.",
                "정확하지 않은 추측성 표현 대신 동작 원리와 트레이드오프를 기준으로 설명하세요.",
            ],
        }

    def _tcp_udp_feedback(self, answer_lower: str, normalized_answer: str) -> dict:
        misconceptions: list[str] = []

        if re.search(r"tcp.{0,12}(빠른|빠르|속도.*빠)", answer_lower) or re.search(
            r"udp.{0,12}(느린|느리|속도.*느)", answer_lower
        ):
            misconceptions.append("TCP/UDP의 차이를 단순 속도 차이로 반대로 설명했습니다.")
        if "udp" in answer_lower and "게임" in answer_lower and ("만" in answer_lower or "에서만" in answer_lower):
            misconceptions.append("UDP가 게임에서만 사용된다는 설명은 사실과 다릅니다.")
        if "udp" in answer_lower and ("압축" in answer_lower or "압축해서" in answer_lower):
            misconceptions.append("UDP는 데이터를 압축하는 프로토콜이 아닙니다.")
        if "tcp" in answer_lower and "인터넷" in answer_lower and ("만" in answer_lower or "사용하고" in answer_lower):
            misconceptions.append("TCP를 인터넷에서만 쓰는 프로토콜처럼 설명해 범위가 부정확합니다.")

        has_reliability = any(term in answer_lower for term in ["신뢰", "재전송", "순서", "연결형", "흐름 제어", "혼잡 제어"])
        has_udp_traits = any(term in answer_lower for term in ["비연결", "실시간", "지연", "손실", "오버헤드", "순서 보장", "재전송"])
        has_streaming_reason = any(term in answer_lower for term in ["스트리밍", "영상", "실시간", "지연"])

        if misconceptions:
            return {
                "score": 1.5 if len(misconceptions) >= 2 else 2.0,
                "reasoning": "TCP/UDP의 핵심 차이에 대한 사실 오류가 있어 낮게 평가했습니다.",
                "strengths": ["TCP와 UDP를 비교해야 한다는 질문 의도는 파악했습니다."],
                "improvements": [
                    *misconceptions[:3],
                    "TCP는 연결형·신뢰성·순서 보장·재전송이 핵심이고, UDP는 비연결형·낮은 지연·낮은 오버헤드가 핵심입니다.",
                    "영상 스트리밍에서는 일부 손실보다 지연 시간이 더 중요해서 UDP 기반 기술을 선택할 수 있다고 설명하세요.",
                ],
            }

        strengths = []
        if has_reliability:
            strengths.append("TCP의 신뢰성, 순서 보장, 재전송 특성을 언급했습니다.")
        if has_udp_traits:
            strengths.append("UDP의 낮은 지연 또는 비연결 특성을 언급했습니다.")
        if has_streaming_reason:
            strengths.append("영상 스트리밍에서 지연 시간의 중요성을 연결했습니다.")

        score = 2.5 + (0.7 if has_reliability else 0) + (0.7 if has_udp_traits else 0) + (0.6 if has_streaming_reason else 0)
        improvements = []
        if not has_reliability:
            improvements.append("TCP의 연결형 통신, 신뢰성, 순서 보장, 재전송 특성을 포함하세요.")
        if not has_udp_traits:
            improvements.append("UDP의 비연결성, 낮은 오버헤드, 지연 시간 측면의 장단점을 포함하세요.")
        if not has_streaming_reason:
            improvements.append("영상 스트리밍에서 UDP 기반 기술을 쓰는 이유를 실시간성·지연 허용 범위와 연결하세요.")

        return {
            "score": score,
            "reasoning": "TCP/UDP의 핵심 특성과 스트리밍 사용 이유를 기준으로 평가했습니다.",
            "strengths": strengths or ["TCP와 UDP를 비교하려는 답변 방향은 잡았습니다."],
            "improvements": improvements or ["핵심 개념을 유지하되 실제 서비스 예시를 더 구체적으로 연결하세요."],
        }

    def _concept_rule_feedback(
        self,
        answer_lower: str,
        title: str,
        expected: list[tuple[str, list[str]]],
        misconceptions: list[tuple[str, list[str]]] | None = None,
    ) -> dict:
        misconception_hits = [
            message
            for message, terms in (misconceptions or [])
            if any(term.lower() in answer_lower for term in terms)
        ]
        matched = [
            label
            for label, terms in expected
            if any(term.lower() in answer_lower for term in terms)
        ]
        missing = [label for label, _ in expected if label not in matched]

        score = 2.0 + min(2.0, len(matched) * 0.5) - min(1.0, len(misconception_hits) * 0.5)
        if len(matched) >= max(2, len(expected) - 1) and not misconception_hits:
            score += 0.5

        if misconception_hits:
            reasoning = f"{title} 질문에서 핵심 개념 오해가 확인되어 낮게 평가했습니다."
        elif len(matched) >= max(2, len(expected) - 1):
            reasoning = f"{title}의 핵심 개념을 비교적 정확히 설명했습니다."
        else:
            reasoning = f"{title} 질문이지만 핵심 정의와 동작 원리 설명이 부족합니다."

        strengths = [f"{item}을 언급했습니다." for item in matched[:3]]
        if not strengths:
            strengths = [f"{title} 질문에 대해 답변을 시도했습니다."]

        improvements = misconception_hits[:2] + [
            f"{item}을 명확히 포함하세요."
            for item in missing[:3]
        ]
        if not improvements:
            improvements = ["개념 설명에 실제 프로젝트 적용 사례나 트레이드오프를 덧붙이면 더 좋습니다."]

        return {
            "score": score,
            "reasoning": reasoning,
            "strengths": strengths,
            "improvements": improvements,
        }

    def _is_technical_knowledge_question(self, question: str) -> bool:
        question_lower = (question or "").lower()
        knowledge_markers = [
            "차이",
            "무엇",
            "왜",
            "원리",
            "개념",
            "설명",
            "동작",
            "사용하는",
            "사용하나요",
            "장단점",
            "tcp",
            "udp",
            "http",
            "https",
            "rest",
            "api",
            "db",
            "database",
            "데이터베이스",
            "인덱스",
            "트랜잭션",
            "정규화",
            "jpa",
            "spring",
            "jwt",
            "oauth",
        ]
        return any(marker in question_lower for marker in knowledge_markers)

    def _clamp_five_point_score(self, score: float | int | None) -> float:
        if score is None:
            return 3.0
        return max(1.0, min(5.0, round(float(score), 1)))

    def _sft_model_name(self) -> str:
        base_model = self.model_inference.settings.base_model
        adapter_path = self.model_inference.settings.adapter_path
        if adapter_path:
            return f"{base_model} + {adapter_path}"
        return base_model
