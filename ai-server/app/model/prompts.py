from dataclasses import dataclass

from app.schemas.report import InterviewAnswer, ReportRequest


@dataclass(frozen=True)
class ModelPrompt:
    plain_text: str
    messages: list[dict[str, str]]


ANSWER_EVALUATION_SYSTEM = (
    "다음은 IT 직군 면접 질문과 지원자의 답변입니다. "
    "기술 개념 질문은 개념 정확성을 최우선으로 평가하고, 경험 질문은 구체성·역할·결과를 평가하세요. "
    "답변이 사실과 다르거나 핵심 개념을 반대로 설명하면 반드시 reasoning과 improvements에 명확히 지적하세요. "
    "정해진 JSON 형식으로 결과만 출력하세요."
)

ANSWER_EVALUATION_SCHEMA = """{
  "reasoning": "점수 판단 이유",
  "overall_score": 3.5,
  "strengths": ["장점 1", "장점 2"],
  "improvements": ["개선점 1", "개선점 2"]
}"""


def build_answer_evaluation_prompt(answer: InterviewAnswer, request: ReportRequest) -> ModelPrompt:
    del request

    user_content = f"""면접 질문:
{answer.question}

지원자 답변:
{answer.answer or ""}

평가 기준:
- overall_score는 반드시 1~5점 사이의 숫자로 출력하세요.
- 기술 개념 질문에서는 STAR 구조보다 개념 정확성, 핵심 차이, 사용 이유, 오해 여부를 먼저 평가하세요.
- 답변이 틀린 개념을 말하면 "개념 오해" 또는 "사실 오류"를 reasoning에 포함하세요.
- strengths에는 실제로 맞게 말한 내용만 적고, 단순히 답변이 길다는 이유를 강점으로 쓰지 마세요.
- improvements에는 질문의 핵심 개념을 기준으로 무엇을 바로잡아야 하는지 구체적으로 적으세요.
- 경험/프로젝트 질문에서만 STAR, Action, Result, 수치화 개선을 주된 개선점으로 제시하세요.

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
