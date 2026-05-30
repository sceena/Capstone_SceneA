import { getAuthUser } from "../store/authStore";

function authHeaders() {
  const user = getAuthUser();
  const token = user?.accessToken || user?.token || user?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function requireAuthHeaders() {
  const user = getAuthUser();
  const token = user?.accessToken || user?.token || user?.access_token;
  if (!token) {
    throw new Error("실제 로그인 토큰이 필요합니다. 데모 로그인 말고 회원가입/로그인 후 다시 시도해 주세요.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * POST /api/sessions : 멘티가 새 면접 세션을 생성한다.
 * @param {{ mentorId: number, jobPostingId?: number, coverLetterId?: number }} data
 */
export async function createSession(data) {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message || body?.detail || body?.error || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(`세션 생성 실패 (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return res.json();
}

/**
 * GET /api/sessions/{id} : 특정 세션의 상세 정보를 조회한다.
 */
export async function getSession(id) {
  const res = await fetch(`/api/sessions/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("세션 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/me : 로그인한 사용자가 참여한 세션 목록을 조회한다.
 * @returns {Promise<Array>}
 */
export async function getMySessions(status) {
  const params = status ? `?status=${status}` : "";
  const res = await fetch(`/api/sessions/me${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("세션 목록 조회 실패");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.content ?? []);
}

/**
 * PATCH /api/sessions/{id}/status : 세션 상태를 변경한다. (멘토 전용)
 
 * @param {number|string} id
 * @param {"scheduled"|"in_progress"|"completed"} status
 */
export async function updateSessionStatus(id, status) {
  const res = await fetch(`/api/sessions/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("세션 상태 변경 실패");
  return res.json();
}

/**
 * POST /api/sessions/{id}/join : 멘티 또는 멘토가 세션에 참여한다.
 */
export async function joinSession(id) {
  const res = await fetch(`/api/sessions/${id}/join`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("세션 참여 실패");
  return res.json();
}

/**
 * PATCH /api/sessions/{id}/participants/{userId}/status : 멘티의 답변 상태를 변경한다. (버튼 기반 화자 분리 시 호출)
 * @param {number|string} sessionId
 * @param {number|string} userId
 * @param {"idle"|"answering"|"done"} answerStatus
 */
export async function updateParticipantStatus(sessionId, userId, answerStatus) {
  const res = await fetch(`/api/sessions/${sessionId}/participants/${userId}/status`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ answer_status: answerStatus }),
  });
  if (!res.ok) throw new Error("참여자 상태 변경 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/analysis/summary
 * 세션 전체 AI 분석 요약 조회 (BEST/WORST 답변 식별 포함)
 */
export async function getSessionAnalysisSummary(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/analysis/summary`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("AI 분석 요약 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/questions/{questionId}/answers/{answerId}/analysis
 * STT 변환 텍스트 및 AI 정량 평가 결과 조회
 */
export async function getAnswerAnalysis(sessionId, questionId, answerId) {
  const res = await fetch(
    `/api/sessions/${sessionId}/questions/${questionId}/answers/${answerId}/analysis`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("답변 분석 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/questions/{questionId}/answers/{answerId}/segments
 * 답변 텍스트의 논리성 하이라이트 세그먼트 목록 조회 (STAR 구조)
 */
export async function getAnswerSegments(sessionId, questionId, answerId) {
  const res = await fetch(
    `/api/sessions/${sessionId}/questions/${questionId}/answers/${answerId}/segments`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("세그먼트 조회 실패");
  return res.json();
}

function authHeadersNoBody() {
  const user = getAuthUser();
  const token = user?.accessToken || user?.token || user?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * GET /api/sessions/{id}/report
 * 세션 리포트 조회. report_status: "first" | "final"
 */
export async function getSessionReport(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/report`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("리포트 조회 실패");
  return res.json();
}

/**
 * POST /api/sessions/{id}/report/generate
 * 세션 답변/STT 텍스트를 기반으로 AI 리포트를 생성한다.
 */
export async function generateSessionReport(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/report/generate`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("리포트 생성 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/answers/stt-status
 * 리포트 생성 전 답변 STT 완료 여부를 확인한다.
 */
export async function getSessionSttStatus(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/answers/stt-status`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("STT 상태 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/report/fit-gap
 * 채용공고 역량 vs 자소서 역량 비교 결과 조회
 */
export async function getFitGapAnalysis(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/report/fit-gap`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Fit-Gap 분석 조회 실패");
  return res.json();
}

/**
 * PATCH /api/sessions/{id}/report/mentor-feedback
 * 멘토 종합 피드백 작성. 저장 시 report_status가 final로 변경됨.
 * @param {string} feedback
 */
export async function saveMentorFeedback(sessionId, feedback) {
  const res = await fetch(`/api/sessions/${sessionId}/report/mentor-feedback`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ mentor_feedback: feedback }),
  });
  if (!res.ok) throw new Error("멘토 피드백 저장 실패");
  return res.json();
}

/**
 * PATCH /api/sessions/{sessionId}/answers/{answerId}/evaluation/mentor
 * 질문별 AI 평가 초안에 대한 멘토 수정본을 저장한다. 향후 DPO chosen 데이터로 활용된다.
 */
export async function saveMentorAnswerEvaluation(sessionId, answerId, evaluation) {
  const res = await fetch(`/api/sessions/${sessionId}/answers/${answerId}/evaluation/mentor`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(evaluation),
  });
  if (!res.ok) throw new Error("멘토 답변 평가 저장 실패");
  return res.json();
}

/**
 * POST /api/sessions/{id}/questions/{questionId}/answers
 * 멘티 답변 오디오 업로드. 업로드 후 STT·AI 분석 비동기 진행.
 * @param {Blob} audioBlob
 */
export async function uploadAnswerAudio(sessionId, questionId, audioBlob, { answerStart, answerEnd, menteeId }) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "answer.webm");
  const params = new URLSearchParams({
    answer_start: answerStart,
    answer_end: answerEnd,
    mentee_id: menteeId,
  });
  const res = await fetch(
    `/api/sessions/${sessionId}/questions/${questionId}/answers?${params}`,
    {
      method: "POST",
      headers: authHeadersNoBody(),
      body: formData,
    }
  );
  if (!res.ok) throw new Error("오디오 업로드 실패");
  return res.json();
}

/**
 * POST /api/sessions/{id}/questions/audio
 * 멘토가 실제로 말한 질문 오디오를 업로드한다. 업로드 후 질문 STT가 비동기로 진행된다.
 */
export async function uploadQuestionAudio(sessionId, audioBlob) {
  if (!/^\d+$/.test(String(sessionId ?? ""))) {
    throw new Error("데모 세션에서는 질문 오디오를 저장할 수 없습니다. 실제 생성된 면접 세션으로 테스트해 주세요.");
  }
  const formData = new FormData();
  formData.append("audio", audioBlob, "question.webm");
  const res = await fetch(`/api/sessions/${sessionId}/questions/audio`, {
    method: "POST",
    headers: authHeadersNoBody(),
    body: formData,
  });
  if (!res.ok) throw new Error("질문 오디오 업로드 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/questions/{questionId}/answers
 * 특정 질문의 답변 목록 조회 (그룹 면접 시 전체 멘티 답변 포함)
 */
export async function getQuestionAnswers(sessionId, questionId) {
  const res = await fetch(
    `/api/sessions/${sessionId}/questions/${questionId}/answers`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("답변 목록 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/questions/{questionId}/answers/{answerId}/audio
 * 저장된 답변 오디오 스트리밍. 반환값: Blob URL (재생용)
 */
export async function getAnswerAudio(sessionId, questionId, answerId) {
  const res = await fetch(
    `/api/sessions/${sessionId}/questions/${questionId}/answers/${answerId}/audio`,
    { headers: authHeadersNoBody() }
  );
  if (!res.ok) throw new Error("오디오 조회 실패");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/* ── 면접 질문 ─────────────────────────────────────────────── */

/**
 * POST /api/sessions/{id}/questions
 * AI가 생성한 질문 목록을 세션에 저장한다.
 * @param {string[]} contents 질문 텍스트 배열
 */
export async function createQuestions(sessionId, contents) {
  const res = await fetch(`/api/sessions/${sessionId}/questions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ questions: contents.map(content => ({ content })) }),
  });
  if (!res.ok) throw new Error("질문 생성 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/questions
 * 특정 세션의 전체 질문 목록을 조회한다.
 */
export async function getRecommendedQuestions(sessionId) {
  if (!/^\d+$/.test(String(sessionId ?? ""))) {
    throw new Error("실제 세션에서만 AI 추천 질문을 불러올 수 있습니다. 데모 세션이 아니라 새로 생성된 세션으로 테스트해 주세요.");
  }

  const res = await fetch(`/api/sessions/${sessionId}/questions/recommendations`, {
    method: "POST",
    headers: requireAuthHeaders(),
  });
  if (!res.ok) {
    let message = "AI 추천 질문 생성 실패";
    try {
      const data = await res.json();
      message = data?.message || data?.detail || message;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export async function getQuestions(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/questions`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("질문 목록 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/questions/{questionId}
 * 특정 질문 하나를 조회한다.
 */
export async function getQuestion(sessionId, questionId) {
  const res = await fetch(`/api/sessions/${sessionId}/questions/${questionId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("질문 조회 실패");
  return res.json();
}

/**
 * PATCH /api/sessions/{id}/questions/{questionId}
 * 멘토가 AI 생성 질문을 수정한다. 면접 시작 전(scheduled)에만 허용.
 * @param {string} content 수정할 질문 내용
 */
export async function updateQuestion(sessionId, questionId, content) {
  const res = await fetch(`/api/sessions/${sessionId}/questions/${questionId}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("질문 수정 실패");
  return res.json();
}

/**
 * DELETE /api/sessions/{id}/questions/{questionId}
 * 멘토가 AI 생성 질문을 삭제한다. 면접 시작 전(scheduled)에만 허용.
 */
export async function deleteQuestion(sessionId, questionId) {
  const res = await fetch(`/api/sessions/${sessionId}/questions/${questionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("질문 삭제 실패");
}

/* ── 채용공고 ────────────────────────────────────────────── */

/**
 * POST /api/sessions/{id}/job-posting
 * 멘티가 채용공고 원문을 저장한다. 세션과 연결됨.
 * @param {{ company: string, jobCategory: string, rawText: string, url?: string }} data
 */
export async function saveJobPosting(sessionId, { company, jobCategory, rawText, url }) {
  const res = await fetch(`/api/sessions/${sessionId}/job-posting`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ company, job_category: jobCategory, raw_text: rawText, url }),
  });
  if (!res.ok) throw new Error("채용공고 저장 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/job-posting/skills
 * AI가 채용공고에서 추출한 필수/우대 역량 키워드 목록을 조회한다.
 */
export async function getJobSkills(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/job-posting/skills`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("채용공고 역량 조회 실패");
  return res.json();
}

/* ── 자소서 ─────────────────────────────────────────────── */

/**
 * POST /api/sessions/{id}/resume
 * 멘티가 자소서 텍스트를 저장한다. 텍스트로만 저장(파일 업로드 없음).
 * @param {string} content 자소서 전문
 */
export async function saveResume(sessionId, content) {
  const res = await fetch(`/api/sessions/${sessionId}/resume`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("자소서 저장 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/resume
 * 세션에 등록된 자소서 원문을 조회한다. 멘토가 호출하면 멘티의 자소서를 반환한다.
 */
export async function getResume(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/resume`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("자소서 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/{id}/resume/skills
 * AI가 자소서에서 추출한 역량 키워드 목록을 조회한다.
 */
export async function getResumeSkills(sessionId) {
  const res = await fetch(`/api/sessions/${sessionId}/resume/skills`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("자소서 역량 조회 실패");
  return res.json();
}

/* ── 멘토 별점 ───────────────────────────────────────────── */

/**
 * PATCH /api/sessions/{id}/questions/{questionId}/answers/{answerId}/mentor-score
 * 멘토 답변 별점 입력. AI 별점을 덮어쓰며 gap 자동 계산됨. (멘토링 세션 중 호출)
 * @param {number} score 1~5
 */
export async function saveMentorScore(sessionId, questionId, answerId, score) {
  const res = await fetch(
    `/api/sessions/${sessionId}/questions/${questionId}/answers/${answerId}/mentor-score`,
    {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ mentor_score: score }),
    }
  );
  if (!res.ok) throw new Error("멘토 별점 저장 실패");
  return res.json();
}

/**
 * POST /api/sessions/{id}/mentor-review
 * 멘티가 멘토에게 별점 + 후기를 남긴다.
 * @param {{ rating: number, comment: string }} data
 */
export async function saveMentorReview(sessionId, data) {
  const res = await fetch(`/api/sessions/${sessionId}/mentor-review`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("멘토 후기 저장 실패");
  return res.json();
}
