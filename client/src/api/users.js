import { getAuthUser } from "../store/authStore";

function authHeaders() {
  const user = getAuthUser();
  if (!user?.accessToken) throw Object.assign(new Error("로그인 토큰 없음"), { status: 401 });
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${user.accessToken}`,
  };
}

function authToken() {
  const user = getAuthUser();
  if (!user?.accessToken) throw Object.assign(new Error("로그인 토큰 없음"), { status: 401 });
  return user.accessToken;
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
 * PATCH /api/users/me  (multipart/form-data)
 * data 파트(JSON): { name?, password?, tags? }
 * image 파트(File): 프로필 이미지 파일 (선택)
 */
export async function updateMyProfile(data, imageFile) {
  const token = authToken();
  const formData = new FormData();
  if (data && Object.keys(data).length > 0) {
    formData.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
  }
  if (imageFile) {
    formData.append("image", imageFile);
  }
  const res = await fetch("/api/users/me", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
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

/**
 * GET /api/users/mentors
 * 멘토 목록 조회. keyword(검색어), page, size 지원.
 */
export async function getMentors({ keyword = "", page = 0, size = 20 } = {}) {
  const params = new URLSearchParams({ page, size });
  if (keyword) params.set("keyword", keyword);
  const res = await fetch(`/api/users/mentors?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("멘토 목록 조회 실패");
  const data = await res.json();
  return Array.isArray(data) ? data : (data.content ?? []);
}

/**
 * POST /api/availability
 * 멘토가 가용시간 슬롯 하나를 등록한다.
 */
export async function saveMentorAvailability({ start_time, end_time }) {
  const res = await fetch("/api/availability", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ start_time, end_time }),
  });
  if (!res.ok) throw new Error("가용시간 등록 실패");
  return res.json();
}

/**
 * GET /api/availability/mentors/{mentorId}
 * 특정 멘토의 예약 가능한 가용시간 슬롯 목록을 조회한다.
 * LocalDateTime 배열 포맷("YYYY-MM-DDTHH:mm:ss") 문자열로 정규화한다.
 */
export async function getMentorAvailabilities(mentorId) {
  const res = await fetch(`/api/availability/mentors/${mentorId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("가용시간 조회 실패");
  const data = await res.json();
  const normalizeTime = (t) => {
    if (Array.isArray(t)) {
      const [y, mo, d, h = 0, m = 0] = t;
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
    return t;
  };
  return Array.isArray(data) ? data.map(a => ({
    ...a,
    start_time: normalizeTime(a.start_time),
    end_time: normalizeTime(a.end_time),
  })) : [];
}
