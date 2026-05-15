from app.schemas.report import InterviewAnswer, ReportRequest


def build_answer_evaluation_prompt(answer: InterviewAnswer, request: ReportRequest) -> str:
    candidate = request.candidate_context
    company = request.company_context
    resume_context = "\n".join(candidate.resume_summaries[:3]) or "제공된 지원자 요약 없음"
    job_context = company.job_posting_summary or "제공된 채용공고 요약 없음"

    return f"""
당신은 IT 면접 답변을 평가하는 AI 멘토입니다.
지원자 수준: {candidate.level or "unknown"}
목표 직무: {candidate.target_role or company.target_role or "unknown"}
목표 회사: {company.target_company or "unknown"}

[지원자 요약]
{resume_context}

[채용공고 요약]
{job_context}

[질문]
{answer.question}

[지원자 답변]
{answer.answer or ""}

다음 JSON 형식으로만 답하세요. 다른 설명은 출력하지 마세요.
{{
  "reasoning": "평가 근거",
  "overall_score": 7,
  "strengths": ["장점 1", "장점 2"],
  "improvements": ["개선점 1", "개선점 2"],
  "star_structure": "S/T/A/R 모두 충족 | Action/Result 충족 | Result 부족 | Action/Result 부족"
}}
""".strip()
