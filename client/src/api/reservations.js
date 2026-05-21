import { getAuthUser } from "../store/authStore";

function authHeaders() {
  const user = getAuthUser();
  return {
    "Content-Type": "application/json",
    ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
  };
}

/**
 * POST /api/reservation/request
 * 멘티가 멘토에게 예약을 신청한다.
 * @param {{ mentorId: number, sessionType: string, participants: number, date: string, time: string }} data
 */
export async function requestReservation(data) {
  const res = await fetch("/api/reservation/request", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("예약 신청 실패");
  return res.json();
}

/**
 * POST /api/reservation/response
 * 멘토가 예약 요청에 수락 또는 거절한다.
 * @param {{ reservationId: number, accepted: boolean }} data
 */
export async function respondReservation(reservationId, accepted) {
  const res = await fetch(`/api/reservation/${reservationId}/response`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ accepted }),
  });
  if (!res.ok) throw new Error("예약 응답 실패");
  return res.json();
}

