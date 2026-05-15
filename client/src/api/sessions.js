import { getAuthUser } from "../store/authStore";

function authHeaders() {
  const user = getAuthUser();
  return {
    "Content-Type": "application/json",
    ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
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
  if (!res.ok) throw new Error("세션 생성 실패");
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
export async function getMySessions() {
  const res = await fetch("/api/sessions/me", {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("세션 목록 조회 실패");
  return res.json();
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
  return user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {};
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
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) throw new Error("멘토 피드백 저장 실패");
  return res.json();
}

/**
 * POST /api/sessions/{id}/questions/{questionId}/answers
 * 멘티 답변 오디오 업로드. 업로드 후 STT·AI 분석 비동기 진행.
 * @param {Blob} audioBlob
 */
export async function uploadAnswerAudio(sessionId, questionId, audioBlob) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "answer.webm");
  const res = await fetch(
    `/api/sessions/${sessionId}/questions/${questionId}/answers`,
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
      body: JSON.stringify({ score }),
    }
  );
  if (!res.ok) throw new Error("멘토 별점 저장 실패");
  return res.json();
}
