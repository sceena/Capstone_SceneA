import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { getMentorAvailabilities, requestReservation } from "../../api/reservations";
import useAuthStore from "../../store/authStore";
import { clearAuthUser } from "../../store/authStore";
import JobAvatar from "../../components/JobAvatar";

const C = {
  primary:      "#0D2240",
  primaryLight: "#E8EEF6",
  primaryGrad:  "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
  success:      "#0CA678",
  successLight: "#E6FCF5",
  text:         "#1A1B1E",
  textSub:      "#495057",
  textMuted:    "#868E96",
  white:        "#FFFFFF",
  bg:           "#F0F4F8",
  border:       "#E9ECEF",
  shadow:       "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
};

/* ── 헤더 ── */
const Header = ({ userName, accessToken }) => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };
  const initials = userName ? userName.slice(0, 2) : "멘";
  return (
    <header style={{ background: C.white, padding: "0 5%", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)" }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>면도리</span>
          <img src="/mascot_exact_embedded.svg" alt="" aria-hidden="true" style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />
        </div>
        {/* 우측: 네비게이션 + 로그아웃 */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[
            { label: "대시보드", to: "/dashboard/mentee" },
            { label: "멘토 탐색", to: "/mentor/search", active: true },
            { label: "마이페이지", to: "/mentee/mypage" },
          ].map(({ label, to, active }) => (
            <Link key={label} to={to} style={{
              fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? C.primary : C.textSub, textDecoration: "none",
              padding: "6px 14px", borderRadius: 8,
              background: active ? C.primaryLight : "transparent", transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; } }}
            >{label}</Link>
          ))}
          <div style={{ width: 1, height: 24, background: C.border, margin: "0 8px" }} />
          <button onClick={handleLogout} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 유틸 ── */
const RESUME_DRAFT_KEY = "scena_resume_draft";
const getResumeDraftKey = (user) => `${RESUME_DRAFT_KEY}:${user?.email || user?.id || "anonymous"}`;
const getJobPostingDraftKey = (user) => `${getResumeDraftKey(user)}:job`;
const getLegacyJobPostingDraftKey = (user) => `${getResumeDraftKey(user)}:job_posting`;

const getStoredResumeContent = (user) => {
  try {
    const draft = JSON.parse(localStorage.getItem(getResumeDraftKey(user)));
    if (!Array.isArray(draft)) return "";
    return draft.filter(it => it?.content?.trim()).map(it => `[${it.title || "자기소개서"}]\n${it.content.trim()}`).join("\n\n");
  } catch { return ""; }
};

const getStoredJobPostingRawText = (user) => {
  try {
    const groupedDraft = JSON.parse(localStorage.getItem(getJobPostingDraftKey(user)));
    if (groupedDraft) {
      return [
        groupedDraft.requirements && `[합류하시면 함께 할 업무입니다]\n${groupedDraft.requirements}`,
        groupedDraft.looking_for && `[이런 경험을 가진 분을 찾습니다]\n${groupedDraft.looking_for}`,
        groupedDraft.preferred && `[이런 경험을 우대합니다]\n${groupedDraft.preferred}`,
      ].filter(Boolean).join("\n\n");
    }
  } catch {}

  try {
    return localStorage.getItem(getLegacyJobPostingDraftKey(user)) || "";
  } catch {
    return "";
  }
};

const formatDateLabel = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v.slice(0, 10);
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(d);
};

const formatTimeLabel = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v.slice(11, 16);
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
};

const buildAvailabilityDates = (items, sessTypeFilter) => {
  const groups = new Map();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  items
    .filter(item => {
      const startTime = item.start_time ?? item.startTime;
      const startDate = new Date(startTime);
      if (item.is_booked || item.isBooked || isNaN(startDate.getTime()) || startDate < tomorrow) return false;
      const maxP = Number(item.max_participants ?? item.maxParticipants ?? 1);
      if (sessTypeFilter === "1:1" && maxP !== 1) return false;
      if (sessTypeFilter === "그룹" && maxP <= 1) return false;
      return true;
    })
    .sort((a, b) => String(a.start_time ?? a.startTime).localeCompare(String(b.start_time ?? b.startTime)))
    .forEach(item => {
      const startTime = item.start_time ?? item.startTime;
      const key = String(startTime).slice(0, 10);
      if (!groups.has(key)) groups.set(key, { key, date: formatDateLabel(startTime), times: [] });
      const maxP = Number(item.max_participants ?? item.maxParticipants ?? 1);
      const currP = Number(item.current_participants ?? item.currentParticipants ?? 0);
      groups.get(key).times.push({
        id: item.id, time: formatTimeLabel(startTime),
        startTime, endTime: item.end_time ?? item.endTime,
        maxParticipants: maxP, currentParticipants: currP,
        remainingSeats: maxP - currP,
      });
    });
  return Array.from(groups.values());
};

/* ══════════════ 메인 ══════════════ */
export default function MentorApply() {
  const navigate = useNavigate();
  const { id: mentorIdParam } = useParams();
  const { state: navState } = useLocation();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";

  const mentorFromState = navState?.mentor ?? {};
  const mentorId = Number(mentorIdParam || mentorFromState.id);

  // 실제 멘토 데이터만 사용 (더미 없음)
  const mentor = {
    id:       mentorId,
    name:     mentorFromState.name || "",
    bio:      mentorFromState.bio  || "",
    tags:     (mentorFromState.tags || []).map(t => (typeof t === "string" ? t : t.name)),
    tagsRaw:  mentorFromState.tags || [],
    profileImageUrl: mentorFromState.profile_image_url || mentorFromState.profileImageUrl || null,
  };

  const jobStr = mentorFromState.tags?.find(t => t?.category === "직무")?.name
    || mentorFromState.tags?.find(t => t?.category === "기술스택")?.name
    || "";
  const careerTag = mentorFromState.tags?.find(t => t?.category === "경력" || t?.category === "근속년수");

  const [sessType, setSessType]               = useState("1:1");
  const [selDateIdx, setSelDateIdx]           = useState(0);
  const [selTime, setSelTime]                 = useState("");
  const [availableDates, setAvailableDates]   = useState([]);
  const [rawAvailabilities, setRawAvailabilities] = useState([]);
  const [availLoading, setAvailLoading]       = useState(true);
  const [availError, setAvailError]           = useState("");
  const [loading, setLoading]                 = useState(false);
  const [submitted, setSubmitted]             = useState(false);
  const [requestNote, setRequestNote]         = useState("");
  const [noteFocused, setNoteFocused]         = useState(false);

  useEffect(() => {
    if (!mentor.id) return;
    setAvailLoading(true);
    setAvailError("");
    getMentorAvailabilities(mentor.id)
      .then(data => {
        setRawAvailabilities(data);
        setAvailableDates(buildAvailabilityDates(data, sessType));
        setSelDateIdx(0); setSelTime("");
      })
      .catch(err => {
        setRawAvailabilities([]); setAvailableDates([]); setSelTime("");
        setAvailError(err?.message || "예약 가능 시간을 불러오지 못했습니다.");
      })
      .finally(() => setAvailLoading(false));
  }, [mentor.id]);

  useEffect(() => {
    if (!rawAvailabilities.length) return;
    setAvailableDates(buildAvailabilityDates(rawAvailabilities, sessType));
    setSelDateIdx(0); setSelTime("");
  }, [sessType]);

  const selectedDate = availableDates[selDateIdx] ?? null;
  const selectedSlot = selectedDate?.times.find(s => String(s.id) === String(selTime)) ?? null;
  const canSubmit = Boolean(selectedSlot) && !availLoading && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const resumeContent = navState?.resumeContent || getStoredResumeContent(user);
      const jobPostingRawText = navState?.jobPosting?.rawText || getStoredJobPostingRawText(user);
      if (!resumeContent.trim()) {
        setLoading(false);
        alert("면접 신청 전에 면접 정보를 먼저 등록해 주세요.");
        navigate("/mentee/resume");
        return;
      }
      if (!jobPostingRawText.trim()) {
        setLoading(false);
        alert("Fit-Gap 분석에 사용할 채용공고 내용을 먼저 등록해 주세요.");
        navigate("/mentee/resume");
        return;
      }
      await requestReservation({
        mentor_id: mentor.id,
        availability_id: selectedSlot.id,
        job_posting_raw_text: jobPostingRawText.trim(),
        job_posting_company: "지원 기업",
        job_posting_job_category: jobStr || "지원 직무",
        resume_content: resumeContent,
        ...(requestNote.trim() && { request_note: requestNote.trim() }),
      });
    } catch (err) {
      alert(err?.message || "면접 신청에 실패했습니다.");
      setLoading(false);
      return;
    }
    setLoading(false);
    setSubmitted(true);
  };

  /* ── 신청 완료 화면 ── */
  if (submitted) return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;700&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter','Noto Sans KR',sans-serif;background:${C.bg}}`}</style>
      <Header userName={userName} accessToken={user?.accessToken}/>
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 5%" }}>
        <div style={{ background: C.white, borderRadius: 24, padding: "52px 40px", boxShadow: "0 12px 48px rgba(13,34,64,0.12)", textAlign: "center" }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: C.successLight, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(12,166,120,0.25)" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7L23 7" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-0.04em", marginBottom: 12 }}>신청이 완료됐어요!</h2>
          <p style={{ fontSize: 15, color: C.textSub, lineHeight: 1.7, marginBottom: 6 }}>
            <strong style={{ color: C.primary }}>{mentor.name} 멘토</strong>님의 승인을 기다리고 있어요.
          </p>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 32 }}>
            {selectedDate?.date} · {selectedSlot?.time} · {sessType === "그룹" ? "그룹 면접 연습" : "1:1 집중 면접"}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => navigate("/mentor/search")} style={{ flex: 1, padding: "14px", background: C.white, color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}
            >다른 멘토 보기</button>
            <button onClick={() => navigate("/dashboard/mentee")} style={{ flex: 1, padding: "14px", background: C.primaryGrad, color: C.white, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px rgba(13,34,64,0.25)", transition: "opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >대시보드로 이동</button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter','Noto Sans KR',-apple-system,sans-serif;background:${C.bg}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:820px){.apply-layout{flex-direction:column!important}.mentor-sticky{position:static!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 5% 72px" }}>

        {/* 뒤로가기 */}
        <button onClick={() => navigate(-1)} style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24,
          padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
          background: C.white, color: C.textSub, fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          멘토 목록으로
        </button>

        <div className="apply-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* ── 왼쪽 멘토 프로필 카드 ── */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div className="mentor-sticky" style={{
              background: C.white, borderRadius: 20,
              padding: "28px 24px", boxShadow: C.shadow,
              position: "sticky", top: 88,
            }}>
              {/* 아바타 + 이름 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
                {mentor.profileImageUrl ? (
                  <img src={mentor.profileImageUrl} alt={mentor.name} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 14, border: `2px solid ${C.border}` }}/>
                ) : (
                  <JobAvatar jobStr={jobStr} size={72} style={{ marginBottom: 14 }}/>
                )}
                <p style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{mentor.name || "멘토"} 멘토</p>
                {careerTag && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: C.primaryLight, color: C.primary }}>
                    {careerTag.name}
                  </span>
                )}
              </div>

              {/* 태그 */}
              {mentor.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {mentor.tags.map((t, i) => (
                    <span key={i} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 99, background: C.bg, color: C.textSub, border: `1px solid ${C.border}` }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* 멘토 정보 없을 때 */}
              {!mentor.name && (
                <p style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "20px 0" }}>
                  멘토 정보를 불러오는 중입니다...
                </p>
              )}
            </div>
          </div>

          {/* ── 오른쪽 신청 폼 ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: C.white, borderRadius: 20, overflow: "hidden", boxShadow: C.shadow }}>

              {/* STEP 01 — 세션 유형 */}
              <div style={{ padding: "28px 32px", borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  01 · 세션 유형 선택
                </p>
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { t: "1:1 집중 면접", d: "10분 · 개인 맞춤형", v: "1:1",  },
                    { t: "그룹 면접 연습", d: "30분 · 다대다 실전", v: "그룹", },
                  ].map(s => (
                    <button key={s.v} type="button" onClick={() => setSessType(s.v)} style={{
                      flex: 1, padding: "20px 16px", textAlign: "center",
                      background: sessType === s.v ? C.primaryGrad : C.bg,
                      border: `1.5px solid ${sessType === s.v ? "transparent" : C.border}`,
                      borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                      transition: "all 0.2s",
                      boxShadow: sessType === s.v ? "0 6px 20px rgba(13,34,64,0.22)" : "none",
                    }}>
                      <span style={{ fontSize: 22, display: "block", marginBottom: 8 }}>{s.icon}</span>
                      <p style={{ fontSize: 15, fontWeight: 700, color: sessType === s.v ? C.white : C.text, marginBottom: 4 }}>{s.t}</p>
                      <p style={{ fontSize: 13, color: sessType === s.v ? "rgba(255,255,255,0.65)" : C.textMuted }}>{s.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 02 — 날짜 선택 */}
              <div style={{ padding: "28px 32px", borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  02 · 날짜 선택
                </p>

                {availLoading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.textMuted, fontSize: 13, padding: "12px 0" }}>
                    <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.primary}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
                    예약 가능한 시간을 불러오는 중...
                  </div>
                )}
                {availError && (
                  <div style={{ background: "#FFF5F5", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#B91C1C", marginBottom: 12 }}>
                    {availError}
                  </div>
                )}
                {!availLoading && !availError && availableDates.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px 0", color: C.textMuted }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.4" style={{ display: "block", margin: "0 auto 10px" }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                    </svg>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>현재 예약 가능한 시간이 없어요</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>멘토가 일정을 등록하면 여기에 표시됩니다</p>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {availableDates.map((d, i) => (
                    <button key={i} type="button" onClick={() => { setSelDateIdx(i); setSelTime(""); }} style={{
                      padding: "10px 18px",
                      background: selDateIdx === i ? C.primaryGrad : C.bg,
                      color: selDateIdx === i ? C.white : C.textSub,
                      border: `1.5px solid ${selDateIdx === i ? "transparent" : C.border}`,
                      borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                      fontSize: 14, fontWeight: selDateIdx === i ? 700 : 400,
                      transition: "all 0.15s",
                      boxShadow: selDateIdx === i ? "0 4px 12px rgba(13,34,64,0.2)" : "none",
                    }}>{d.date}</button>
                  ))}
                </div>
              </div>

              {/* STEP 02 — 시간 선택 */}
              {selectedDate && (
                <div style={{ padding: "20px 32px 24px", borderBottom: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
                    <strong style={{ color: C.text }}>{selectedDate.date}</strong> 예약 가능 시간
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {selectedDate.times.map(t => {
                      const isGroup = t.maxParticipants > 1;
                      const isSel = String(selTime) === String(t.id);
                      return (
                        <button key={t.id} type="button" onClick={() => setSelTime(t.id)} style={{
                          flex: "1 0 calc(25% - 8px)", minWidth: 80,
                          padding: isGroup ? "12px 0" : "16px 0",
                          background: isSel ? C.primaryGrad : C.bg,
                          color: isSel ? C.white : C.text,
                          border: `1.5px solid ${isSel ? "transparent" : C.border}`,
                          borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                          fontSize: 16, fontWeight: isSel ? 700 : 500,
                          transition: "all 0.18s",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          boxShadow: isSel ? "0 4px 12px rgba(13,34,64,0.22)" : "none",
                        }}>
                          <span>{t.time}</span>
                          {isGroup && (
                            <span style={{ fontSize: 11, color: isSel ? "rgba(255,255,255,0.75)" : C.success, fontWeight: 600 }}>
                              잔여 {t.remainingSeats}/{t.maxParticipants}석
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 03 — 멘토에게 전달할 내용 */}
              <div style={{ padding: "28px 32px", borderBottom: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
                  03 · 멘토에게 전달할 내용 <span style={{ fontWeight: 400, fontSize: 11, textTransform: "none", letterSpacing: 0 }}>(선택)</span>
                </p>
                <textarea
                  value={requestNote}
                  onChange={e => setRequestNote(e.target.value)}
                  onFocus={() => setNoteFocused(true)}
                  onBlur={() => setNoteFocused(false)}
                  rows={4}
                  placeholder={"현재 준비 상황, 걱정되는 부분, 받고 싶은 피드백을 자유롭게 적어주세요.\n예: 프로젝트 꼬리질문 대비가 필요하고, 백엔드 장애 대응 경험 답변을 점검받고 싶어요."}
                  style={{
                    width: "100%", resize: "vertical",
                    border: `1.5px solid ${noteFocused ? C.primary : C.border}`,
                    borderRadius: 12, padding: "14px 16px",
                    fontSize: 14, lineHeight: 1.75, fontFamily: "inherit", outline: "none",
                    background: noteFocused ? C.white : C.bg, color: C.text,
                    transition: "all 0.18s",
                    boxShadow: noteFocused ? `0 0 0 3px ${C.primaryLight}` : "none",
                  }}
                />
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                  이 내용은 자소서와 함께 멘토의 사전 질문 준비에 활용됩니다.
                </p>
              </div>

              {/* 최종 확인 + 신청 버튼 */}
              <div style={{ padding: "28px 32px", background: C.bg }}>
                {selectedSlot && (
                  <div style={{
                    background: C.primaryLight,
                    border: `1px solid ${C.primary}33`,
                    borderRadius: 12, padding: "14px 18px", marginBottom: 20,
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <p style={{ fontSize: 14, color: C.primary, fontWeight: 600, margin: 0 }}>
                      {selectedDate?.date} · {selectedSlot.time} · {sessType === "그룹" ? "그룹 면접 연습" : "1:1 집중 면접"}
                    </p>
                  </div>
                )}

                <button
                  onClick={canSubmit ? handleSubmit : undefined}
                  disabled={!canSubmit || loading}
                  style={{
                    width: "100%", padding: "18px",
                    background: canSubmit ? C.primaryGrad : C.border,
                    color: canSubmit ? C.white : C.textMuted,
                    border: "none", borderRadius: 14,
                    fontSize: 16, fontWeight: 700,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    fontFamily: "inherit", transition: "opacity 0.18s",
                    boxShadow: canSubmit ? "0 6px 20px rgba(13,34,64,0.28)" : "none",
                  }}
                  onMouseEnter={e => { if (canSubmit && !loading) e.currentTarget.style.opacity = "0.88"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                >
                  {loading ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      신청 중...
                    </span>
                  ) : selectedSlot ? "면접 신청하기" : "날짜와 시간을 선택해주세요"}
                </button>

                {!canSubmit && !loading && (
                  <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 10 }}>
                    날짜와 시간을 선택하면 신청 버튼이 활성화돼요
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
