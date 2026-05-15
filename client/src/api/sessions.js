import { getAuthUser } from "../store/authStore";

function authHeaders() {
  const user = getAuthUser();
  return {
    "Content-Type": "application/json",
    ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
  };
}

/**
 * POST /api/sessions
 * 멘티가 새 면접 세션을 생성한다.
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
 * GET /api/sessions/{id}
 * 특정 세션의 상세 정보를 조회한다.
 */
export async function getSession(id) {
  const res = await fetch(`/api/sessions/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("세션 조회 실패");
  return res.json();
}

/**
 * GET /api/sessions/me
 * 로그인한 사용자가 참여한 세션 목록을 조회한다.
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
 * PATCH /api/sessions/{id}/status
 * 세션 상태를 변경한다. (멘토 전용)
 * scheduled → in_progress → completed 순서만 허용
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
 * POST /api/sessions/{id}/join
 * 멘티 또는 멘토가 세션에 참여한다.
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
 * PATCH /api/sessions/{id}/participants/{userId}/status
 * 멘티의 답변 상태를 변경한다. (버튼 기반 화자 분리 시 호출)
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
