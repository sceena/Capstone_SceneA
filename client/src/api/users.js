import { getAuthUser } from "../store/authStore";

function authHeaders() {
  const user = getAuthUser();
  if (!user?.accessToken) throw Object.assign(new Error("로그인 토큰 없음"), { status: 401 });
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.accessToken}`,
  };
}

/**
 * GET /api/users/me
 * 로그인한 사용자의 프로필 정보를 조회한다.
 */
export async function getMyProfile() {
  const res = await fetch("/api/users/me", { headers: authHeaders() });
  if (!res.ok) throw new Error("프로필 조회 실패");
  return res.json();
}

/**
 * PATCH /api/users/me
 * 로그인한 사용자의 이름, 비밀번호를 수정한다.
 * @param {{ name?: string, password?: string }} data
 */
export async function updateMyProfile(data) {
  const res = await fetch("/api/users/me", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const status = res.status;
    console.error("[updateMyProfile] 실패:", status, await res.text().catch(()=>""));
    throw Object.assign(new Error("프로필 수정 실패"), { status });
  }
  return res.json();
}

/**
 * GET /api/users/me/sessions
 * 마이페이지에서 본인이 참여한 면접 세션 목록과 리포트 상태를 조회한다.
 */
export async function getUserSessions() {
  const res = await fetch("/api/users/me/sessions", { headers: authHeaders() });
  if (!res.ok) throw new Error("면접 내역 조회 실패");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.content ?? []);
}
