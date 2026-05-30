import { getAuthUser } from "../store/authStore";

function authHeaders() {
  const user = getAuthUser();
  const token = user?.accessToken || user?.token || user?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function errorMessage(res, fallback) {
  let detail = "";
  try {
    const data = await res.json();
    detail = data?.message || data?.detail || data?.error || "";
  } catch {
    detail = await res.text().catch(() => "");
  }
  return `${fallback} (${res.status})${detail ? `: ${detail}` : ""}`;
}

export async function requestReservation(data) {
  const res = await fetch("/api/reservation/request", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "예약 신청 실패"));
  return res.json();
}

export async function getMentorAvailabilities(mentorId) {
  const res = await fetch(`/api/availability/mentors/${mentorId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "예약 가능 시간 조회 실패"));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createMentorAvailability({ start_time, end_time }) {
  const res = await fetch("/api/availability", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ start_time, end_time }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "예약 가능 시간 등록 실패"));
  return res.json();
}

export async function deleteMentorAvailability(availabilityId) {
  const res = await fetch(`/api/availability/${availabilityId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "예약 가능 시간 삭제 실패"));
}

export async function getMentorReservationRequests(status = "PENDING") {
  const params = new URLSearchParams({ status });
  const res = await fetch(`/api/reservation/mentor?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "예약 신청 목록 조회 실패"));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function respondReservation(reservationIdOrData, acceptedArg) {
  const reservationId = typeof reservationIdOrData === "object"
    ? reservationIdOrData.reservationId
    : reservationIdOrData;
  const accepted = typeof reservationIdOrData === "object"
    ? reservationIdOrData.accepted
    : acceptedArg;

  const res = await fetch(`/api/reservation/${reservationId}/response`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ accepted }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "예약 응답 실패"));
  return res.json();
}
