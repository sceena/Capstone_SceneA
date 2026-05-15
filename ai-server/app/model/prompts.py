from app.schemas.report import InterviewAnswer, ReportRequest


def build_answer_evaluation_prompt(answer: InterviewAnswer, request: ReportRequest) -> str:
    return f"""
system:
다음은 IT 직군 면접 질문과 지원자의 답변입니다. 답변을 평가 기준에 따라 채점하고 정해진 JSON 형식으로 결과를 출력하세요.

user:
면접 질문:
{answer.question}

지원자 답변:
{answer.answer or ""}

assistant:
{{
  "reasoning": "점수 판단 이유",
  "overall_score": 7,
  "strengths": ["장점 1", "장점 2"],
  "improvements": ["개선점 1", "개선점 2"]
}}
""".strip()
