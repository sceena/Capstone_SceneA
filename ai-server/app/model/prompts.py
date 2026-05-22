from dataclasses import dataclass

from app.schemas.report import InterviewAnswer, ReportRequest


@dataclass(frozen=True)
class ModelPrompt:
    plain_text: str
    messages: list[dict[str, str]]


ANSWER_EVALUATION_SYSTEM = (
    "다음은 IT 직군 면접 질문과 지원자의 답변입니다. "
    "답변을 평가 기준에 따라 채점하고 정해진 JSON 형식으로 결과만 출력하세요."
)

ANSWER_EVALUATION_SCHEMA = """{
  "reasoning": "점수 판단 이유",
  "overall_score": 7,
  "strengths": ["장점 1", "장점 2"],
  "improvements": ["개선점 1", "개선점 2"]
}"""


def build_answer_evaluation_prompt(answer: InterviewAnswer, request: ReportRequest) -> ModelPrompt:
    del request

    user_content = f"""면접 질문:
{answer.question}

지원자 답변:
{answer.answer or ""}

반드시 아래 JSON 스키마와 같은 필드만 출력하세요.
{ANSWER_EVALUATION_SCHEMA}"""

    plain_text = f"""system:
{ANSWER_EVALUATION_SYSTEM}

user:
면접 질문:
{answer.question}

지원자 답변:
{answer.answer or ""}

assistant:
""".strip()

    return ModelPrompt(
        plain_text=plain_text,
        messages=[
            {"role": "system", "content": ANSWER_EVALUATION_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    )
