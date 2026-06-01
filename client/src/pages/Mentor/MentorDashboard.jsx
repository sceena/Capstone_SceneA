import { useCallback, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMySessions } from "../../api/sessions";
import { getMentorReservationRequests, respondReservation } from "../../api/reservations";

const C = {
    primary:      "#0D2240",
  primaryDark:  "#081828",
  primaryLight: "#E8EEF6",
  primaryGrad:  "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
  success:      "#0CA678",
  successLight: "#E6FCF5",
  successGrad:  "linear-gradient(135deg, #0CA678 0%, #38D9A9 100%)",
  warning:      "#E67700",
  warningLight: "#FFF3BF",
  warningGrad:  "linear-gradient(135deg, #F76707 0%, #FFA94D 100%)",
  danger:       "#E03131",
  dangerLight:  "#FFF5F5",
  text:         "#1A1B1E",
  textSub:      "#495057",
  textMuted:    "#868E96",
  white:        "#FFFFFF",
  bg:           "#F0F4F8",
  border:       "#E9ECEF",
  navy:         "#1C3A5C",
  navyGrad:     "linear-gradient(135deg, #1C3A5C 0%, #2D5A8E 100%)",
  shadow:       "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
  shadowLg:     "0 4px 12px rgba(0,0,0,0.08), 0 20px 48px rgba(0,0,0,0.07)",
};

/* ── 헤더 ── */
const Header = ({ userName, accessToken }) => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
    } catch {}
    clearAuthUser();
    navigate("/");
  };
  const initials = userName ? userName.slice(0, 2) : "멘";
  return (
    <header style={{
      background: C.white,
      padding: "0 5%",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <nav style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        {/* 로고 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: C.primaryGrad,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(66,99,235,0.3)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>
            Scene<span style={{ color: C.primary }}>A</span>
          </span>
        </div>

        {/* 우측: 네비게이션 + 로그아웃 */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[
            { label: "대시보드", to: "/dashboard/mentor", active: true },
            { label: "멘토 탐색", to: "/mentor/search" },
            { label: "마이페이지", to: "/mentor/mypage" },
          ].map(({ label, to, active }) => (
            <Link key={label} to={to} style={{
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              color: active ? C.primary : C.textSub,
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: 8,
              background: active ? C.primaryLight : "transparent",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; } }}
            >
              {label}
            </Link>
          ))}
          <div style={{ width: 1, height: 24, background: C.border, margin: "0 8px" }} />
          <button onClick={handleLogout} style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.textSub,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = "#CED4DA"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; e.currentTarget.style.borderColor = C.border; }}
          >
            로그아웃
          </button>
        </div>
      </nav>
    </header>
  );
};

/* ── 통계 카드 ── */
const StatCard = ({ label, value, sub, gradient, shadowColor, icon }) => (
  <div style={{
    background: gradient,
    borderRadius: 20,
    padding: "24px 26px",
    position: "relative",
    overflow: "hidden",
    boxShadow: `0 8px 24px ${shadowColor}`,
    flex: 1,
  }}>
    <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
    <div style={{ position: "absolute", bottom: -32, right: 18, width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
    <div style={{ position: "relative" }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "rgba(255,255,255,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 16,
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 32, fontWeight: 800, color: C.white, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 6 }}>{value}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.88)", marginBottom: 4 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{sub}</p>}
    </div>
  </div>
);

/* ── 대시보드 카드 컨테이너 ── */
const DashCard = ({ title, sub, children, style, accentColor, iconSvg }) => (
  <div style={{
    background: C.white,
    borderRadius: 20,
    padding: "24px 24px 28px",
    boxShadow: C.shadow,
    ...style,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {iconSvg && (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: accentColor ? `${accentColor}15` : C.primaryLight,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {iconSvg}
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
          {sub && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3, margin: 0 }}>{sub}</p>}
        </div>
      </div>
    </div>
    {children}
  </div>
);

/* ── 면접 세션 카드 ── */
const SessionCard = ({ title, date, mentor, type, time, onEnter }) => (
  <div style={{
    background: C.navyGrad,
    borderRadius: 16,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    boxShadow: "0 4px 16px rgba(28,58,92,0.22)",
    transition: "transform 0.2s, box-shadow 0.2s",
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 28px rgba(28,58,92,0.3)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(28,58,92,0.22)"; }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{
          background: "rgba(56,217,169,0.18)",
          color: "#38D9A9",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
          padding: "3px 10px", borderRadius: 99,
          border: "1px solid rgba(56,217,169,0.3)",
        }}>● LIVE 면접 세션</span>
      </div>
      <p style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>{title}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="1.5" y="2" width="9" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 1v2M8 1v2M1.5 5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {date}
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="6" cy="6" r="1.5" fill="currentColor"/>
          </svg>
          {mentor} · {type}
        </span>
      </div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.white, letterSpacing: "-0.04em", lineHeight: 1 }}>{time}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>KST</div>
      </div>
      <button
        onClick={onEnter}
        style={{
          background: "rgba(255,255,255,0.13)",
          color: C.white,
          border: "1px solid rgba(255,255,255,0.28)",
          borderRadius: 10,
          padding: "10px 22px",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.18s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.24)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; }}
      >
        입장하기 →
      </button>
    </div>
  </div>
);

/* ── 멘티 정보 상세 모달 ── */
const MenteeDetailModal = ({ request, onClose, onAccept, onDecline }) => {
  const raw = request.rawData || {};

  // resume_content: 백엔드가 예약 응답에 포함시켜주면 자동 표시
  const fullContent = raw.resume_content ?? raw.resumeContent ?? raw.content ?? "";
  const MENTOR_MSG_DIVIDER = "[멘토에게 전달할 내용]";
  const dividerIdx    = fullContent.indexOf(MENTOR_MSG_DIVIDER);
  const resumeContent = dividerIdx >= 0 ? fullContent.slice(0, dividerIdx).trim() : fullContent.trim();
  const mentorMessage = dividerIdx >= 0 ? fullContent.slice(dividerIdx + MENTOR_MSG_DIVIDER.length).trim() : "";

  const dateInfo = request.scheduledAt
    ? new Date(request.scheduledAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "미정";

  const infoRows = [
    { label: "멘티 이름",  value: request.name || "—" },
    { label: "면접 일정",  value: dateInfo },
    { label: "세션 유형",  value: request.sessionType || "1:1 면접" },
    { label: "신청일",     value: request.requestedAt ? new Date(request.requestedAt).toLocaleDateString("ko-KR") : "—" },
  ];

  const PendingBox = ({ label }) => (
    <div style={{ textAlign: "center", padding: "36px 0" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <p style={{ fontSize: 13, color: C.textSub, marginBottom: 6 }}>{label}</p>
      <span style={{ fontSize: 11, background: C.warningLight, color: C.warning, padding: "3px 12px", borderRadius: 99, fontWeight: 600 }}>백엔드 연동 예정</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.48)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.white, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.22)" }}>

        {/* 헤더 */}
        <div style={{ padding: "22px 28px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.primaryGrad, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3"/>
                <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{request.name || "멘티"} 멘티</h2>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>면접 신청 정보</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontSize: 16, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* 콘텐츠 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 신청 기본 정보 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", marginBottom: 10 }}>신청 정보</p>
            <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {infoRows.map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{r.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 자소서·채용정보 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", marginBottom: 10 }}>자소서 · 채용 정보</p>
            {resumeContent ? (
              <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{resumeContent}</p>
              </div>
            ) : (
              <PendingBox label="예약 응답에 resume_content 포함 시 자동 표시됩니다" />
            )}
          </div>

          {/* 멘토에게 바라는 점 */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.07em", marginBottom: 10 }}>멘토에게 바라는 점</p>
            {mentorMessage ? (
              <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{mentorMessage}</p>
              </div>
            ) : (
              <PendingBox label="백엔드 작업 완료 후 자동 표시됩니다" />
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: "16px 28px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          <button onClick={() => { onDecline(request.id); onClose(); }} style={{
            flex: 1, padding: "11px", background: "transparent", color: C.textSub,
            border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ADB5BD"; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
          >거절</button>
          <button onClick={() => { onAccept(request.id); onClose(); }} style={{
            flex: 2, padding: "11px", background: C.primaryGrad, color: C.white,
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(66,99,235,0.3)", transition: "opacity 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >수락하기</button>
        </div>
      </div>
    </div>
  );
};

/* ── 수락 대기 요청 카드 ── */
const RequestCard = ({ name, company, message, avatarColor, onAccept, onDecline, onDetail, scheduledAt, sessionType, requestedAt, disabled }) => {
  const dateInfo = scheduledAt ? (() => {
    const dt = new Date(scheduledAt);
    const days = ["일","월","화","수","목","금","토"];
    return {
      month: `${dt.getMonth()+1}월`,
      day: String(dt.getDate()).padStart(2, "0"),
      weekday: days[dt.getDay()],
      time: `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`,
    };
  })() : null;
  const requestedLabel = requestedAt ? new Date(requestedAt).toLocaleString("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }) : null;

  return (
    <div style={{
      background: C.white,
      borderRadius: 14,
      padding: "16px 18px",
      marginBottom: 10,
      border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${C.primary}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      transition: "box-shadow 0.2s",
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        {/* 날짜 박스 */}
        <div style={{
          width: 54, flexShrink: 0,
          background: dateInfo ? C.primaryGrad : C.bg,
          borderRadius: 12,
          textAlign: "center",
          overflow: "hidden",
          boxShadow: dateInfo ? "0 4px 12px rgba(66,99,235,0.25)" : "none",
        }}>
          <div style={{ background: "rgba(0,0,0,0.12)", padding: "3px 0" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
              {dateInfo?.month || "--"}
            </span>
          </div>
          <div style={{ padding: "5px 0 2px" }}>
            <span style={{ fontSize: 22, color: C.white, fontWeight: 900, lineHeight: 1 }}>
              {dateInfo?.day || "--"}
            </span>
          </div>
          <div style={{ padding: "1px 0 6px" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>
              {dateInfo ? `${dateInfo.weekday} ${dateInfo.time}` : "미정"}
            </span>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: C.primaryGrad,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(66,99,235,0.3)",
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5.5" r="2.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3"/>
                <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>{name || "멘티"}</p>
              <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{company}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {dateInfo && (
              <span style={{ fontSize: 11, fontWeight: 600, background: C.primaryLight, color: C.primary, padding: "3px 10px", borderRadius: 99, display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="1" y="2" width="8" height="7" rx="1" stroke={C.primary} strokeWidth="1.2"/>
                  <path d="M3.5 1v2M6.5 1v2M1 5h8" stroke={C.primary} strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {dateInfo.month} {dateInfo.day}일 {dateInfo.time}
              </span>
            )}
            {sessionType && (
              <span style={{ fontSize: 11, fontWeight: 500, background: C.bg, color: C.textSub, padding: "3px 10px", borderRadius: 99 }}>{sessionType}</span>
            )}
            {requestedLabel && (
              <span style={{ fontSize: 11, fontWeight: 500, background: "#FFF3BF", color: "#9C6A00", padding: "3px 10px", borderRadius: 99 }}>신청 {requestedLabel}</span>
            )}
          </div>

          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7, margin: 0 }}>{message}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onDetail} disabled={disabled} style={{
          flex: 2, padding: "9px",
          background: C.bg,
          color: C.primary,
          border: `1.5px solid ${C.primary}33`,
          borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "all 0.18s",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}
          onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = C.primaryLight; e.currentTarget.style.borderColor = C.primary; } }}
          onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = C.bg; e.currentTarget.style.borderColor = `${C.primary}33`; } }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          정보 확인하기
        </button>
        <button onClick={onAccept} disabled={disabled} style={{
          flex: 1, padding: "9px",
          background: disabled ? C.bg : C.primaryGrad,
          color: disabled ? C.textMuted : C.white,
          border: "none", borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          boxShadow: disabled ? "none" : "0 4px 12px rgba(66,99,235,0.3)",
          transition: "all 0.18s",
        }}
          onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.9"; }}
          onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = "1"; }}
        >
          수락
        </button>
        <button onClick={onDecline} disabled={disabled} style={{
          flex: 1, padding: "9px",
          background: "transparent",
          color: C.textSub,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          fontSize: 13, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "all 0.18s",
        }}
          onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = "#ADB5BD"; e.currentTarget.style.color = C.text; } }}
          onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; } }}
        >
          거절
        </button>
      </div>
    </div>
  );
};

/* ── 다가오는 세션 아이템 ── */
const UpcomingItem = ({ date, time, title, mentor, type, status }) => {
  const isPrimary  = status === "confirmed";
  const isPending  = status === "pending";
  const accentColor = isPrimary ? C.primary : isPending ? C.warning : C.border;
  const bgColor     = isPrimary ? C.primaryLight : isPending ? C.warningLight : C.bg;
  const statusLabel = isPrimary ? "확정" : isPending ? "대기 중" : "미확정";

  const [m, d] = (date || "").split(".").map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), (m || 1) - 1, d || 1);
  const diff = Math.ceil((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const dday = diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;

  return (
    <div style={{
      display: "flex", gap: 14, alignItems: "center",
      padding: "14px 0",
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        width: 52, flexShrink: 0,
        textAlign: "center",
        background: bgColor,
        borderRadius: 12,
        padding: "8px 4px",
        border: `1px solid ${accentColor}33`,
      }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: "0.04em", margin: "0 0 2px" }}>{m || "--"}월</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: accentColor, lineHeight: 1.1, margin: 0 }}>{d || "--"}</p>
        <p style={{ fontSize: 9, color: accentColor, fontWeight: 600, margin: "2px 0 0" }}>{time}</p>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</p>
        <p style={{ fontSize: 11, color: C.textMuted }}>{mentor} · {type}</p>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{
          fontSize: 12, fontWeight: 800, color: accentColor,
          background: bgColor, padding: "4px 10px",
          borderRadius: 8, display: "block", marginBottom: 4,
          border: `1px solid ${accentColor}33`,
        }}>{dday}</span>
        <span style={{ fontSize: 10, color: accentColor, fontWeight: 600 }}>{statusLabel}</span>
      </div>
    </div>
  );
};

const normalizeStatus   = s => String(s || "").toLowerCase();
const getScheduledAt    = s => s.scheduledAt ?? s.scheduled_at ?? "";
const getSessionTitle   = s => s.title ?? (s.job_category ? `${s.job_category} 모의 면접` : "모의 면접");
const getMenteeName     = s => s.menteeName ?? s.mentee_name ?? "";
const getSessionType    = s => s.sessionType ?? s.session_type ?? "1:1 면접";
const getReservationSessionType = r => {
  const maxParticipants = Number(r.max_participants ?? r.maxParticipants ?? 1);
  return maxParticipants > 1 ? "그룹 면접" : "1:1 면접";
};
const toDateText        = v => v ? String(v).slice(5, 10).replace("-", ".") : "";
const toTimeText        = v => v ? String(v).slice(11, 16) : "";

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function MentorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";

  const [allSessions, setAllSessions] = useState([]);
  const loadSessions = useCallback(() => {
    getMySessions()
      .then(data => setAllSessions(Array.isArray(data) ? data : []))
      .catch(() => setAllSessions([]));
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const rawSessions = allSessions;
  const sessions = rawSessions
    .filter(s => (normalizeStatus(s.status) === "scheduled" || normalizeStatus(s.status) === "in_progress") && s.kind !== "mentoring")
    .map(s => ({
      id: s.id,
      title: getSessionTitle(s),
      date: toDateText(getScheduledAt(s)),
      mentor: getMenteeName(s),
      type: getSessionType(s),
      time: toTimeText(getScheduledAt(s)),
    }));

  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const loadReservationRequests = useCallback(() => {
    setRequestsLoading(true);
    getMentorReservationRequests("PENDING")
      .then(data => {
        const pending = data.filter(r => normalizeStatus(r.status) === "pending");
        setRequests(pending.map(r => ({
          id: r.id,
          name: r.mentee_name ?? r.menteeName ?? "",
          company: r.session_id || r.sessionId ? `세션 #${r.session_id ?? r.sessionId}` : "면접 신청",
          message: "면접 신청이 도착했습니다. 신청 일정을 확인한 뒤 수락 또는 거절해주세요.",
          avatarColor: C.primary,
          scheduledAt: r.scheduled_at ?? r.scheduledAt ?? null,
          sessionType: getReservationSessionType(r),
          requestedAt: r.created_at ?? r.createdAt ?? null,
          rawData: r,
        })));
        setRequestsError("");
      })
      .catch(error => {
        console.error("[MentorDashboard] 예약 신청 목록 조회 실패", error);
        setRequestsError(error?.message || "예약 신청 목록을 불러오지 못했습니다.");
      })
      .finally(() => setRequestsLoading(false));
  }, []);
  useEffect(() => { loadReservationRequests(); }, [loadReservationRequests]);

  const upcoming = rawSessions
    .filter(s => normalizeStatus(s.status) === "scheduled")
    .map(s => ({
      id: s.id,
      date: toDateText(getScheduledAt(s)),
      time: toTimeText(getScheduledAt(s)),
      title: getSessionTitle(s),
      mentor: getMenteeName(s),
      type: getSessionType(s),
      status: "confirmed",
    }));

  const handleAccept = async id => {
    setRequests(r => r.filter(x => x.id !== id)); // 즉시 제거 → 중복 클릭 불가
    try {
      await respondReservation({ reservationId: id, accepted: true });
      loadSessions();
    } catch (error) {
      alert(error?.message || "예약 수락에 실패했습니다.");
      loadReservationRequests();
    }
  };
  const handleDecline = async id => {
    try {
      await respondReservation({ reservationId: id, accepted: false });
      setRequests(r => r.filter(x => x.id !== id));
      loadSessions();
    } catch (error) { alert(error?.message || "예약 거절에 실패했습니다."); }
  };

  const now = new Date();
  const dateLabel = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Noto Sans KR', -apple-system, sans-serif; background: ${C.bg}; }
        @media (max-width: 768px) {
          .dash-stats { flex-direction: column !important; }
          .dash-bottom { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {selectedRequest && (
        <MenteeDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onAccept={id => { handleAccept(id); setSelectedRequest(null); }}
          onDecline={id => { handleDecline(id); setSelectedRequest(null); }}
        />
      )}

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5% 72px" }}>

        {/* ── 페이지 타이틀 ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.04em", marginBottom: 6 }}>
            안녕하세요, {userName} 멘토님
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted }}>{dateLabel} · 오늘도 멋진 면접을 진행해보세요</p>
        </div>

        {/* ── 통계 카드 ── */}
        <div className="dash-stats" style={{ display: "flex", gap: 20, marginBottom: 28 }}>
          <StatCard
            label="예정된 면접"
            value={sessions.length}
            sub={sessions.length > 0 ? `다음: ${sessions[0]?.time} KST` : "현재 예정 없음"}
            gradient={C.primaryGrad}
            shadowColor="rgba(66,99,235,0.28)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            }
          />
          <StatCard
            label="수락 대기 요청"
            value={requestsLoading ? "..." : requests.length}
            sub={requests.length > 0 ? "확인이 필요한 신청이 있습니다" : "새 신청이 없습니다"}
            gradient={C.successGrad}
            shadowColor="rgba(12,166,120,0.28)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
          />
          <StatCard
            label="확정된 일정"
            value={upcoming.length}
            sub={upcoming.length > 0 ? `${upcoming[0]?.date} 예정` : "확정된 세션 없음"}
            gradient={C.warningGrad}
            shadowColor="rgba(247,103,7,0.28)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            }
          />
        </div>

        {/* ── 미완료 피드백 알림 배너 ── */}
        {(() => {
          const pf = rawSessions.filter(s => normalizeStatus(s.status) === "completed" && !s.feedbackSubmitted);
          if (pf.length === 0) return null;
          return (
            <div style={{
              background: "linear-gradient(135deg, #FFF3BF 0%, #FFE066 100%)",
              border: "1px solid #FFD43B",
              borderRadius: 16,
              padding: "18px 24px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 4px 16px rgba(255,193,7,0.2)",
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "#F59F00",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: "0 4px 12px rgba(245,159,0,0.4)",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#7A4F00", marginBottom: 3 }}>
                  미완료 피드백 {pf.length}건이 있습니다
                </p>
                <p style={{ fontSize: 12, color: "#9C6A00" }}>
                  멘티는 멘토의 최종 코멘트를 기다리고 있어요. 세션 종료 후 60분 이내에 전송해주세요.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pf.map(s => (
                  <button key={s.id} onClick={() => navigate(`/mentor/feedback/${s.id}`)} style={{
                    padding: "8px 18px", borderRadius: 8, border: "none",
                    background: "#7A4F00", color: "white",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    transition: "opacity 0.15s",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.82"; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {s.title || "세션"} 피드백 작성 →
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── 예정된 면접 일정 ── */}
        <DashCard
          title="예정된 면접 일정"
          sub={`면접 세션 ${sessions.length}건 · 면접 종료 후 멘토링 세션이 자동 연결됩니다`}
          style={{ marginBottom: 24 }}
          accentColor={C.primary}
          iconSvg={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.map(s => (
              <SessionCard
                key={s.id}
                title={s.title}
                date={s.date}
                mentor={s.mentor}
                type={s.type}
                time={s.time}
                onEnter={() => navigate(`/interview/ready-mentor/${s.id}`)}
              />
            ))}
            {sessions.length === 0 && (
              <div style={{
                textAlign: "center", padding: "40px 0",
                color: C.textMuted, fontSize: 14,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: C.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>예정된 면접 일정이 없습니다</p>
                <p style={{ fontSize: 12, color: "#ADB5BD" }}>멘티의 예약 신청을 수락하면 일정이 표시됩니다</p>
              </div>
            )}
          </div>
        </DashCard>

        {/* ── 하단 2열 ── */}
        <div className="dash-bottom" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* 수락 대기 중인 요청 */}
          <DashCard
            title="수락 대기 중인 요청"
            sub="멘티가 신청한 면접 일정을 확인하고 확정하세요"
            accentColor={C.success}
            iconSvg={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
          >
            {requestsError && (
              <div style={{
                background: C.dangerLight,
                border: `1px solid #FCA5A5`,
                color: C.danger,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12,
                marginBottom: 12,
              }}>
                {requestsError}
              </div>
            )}
            {requestsLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontSize: 14 }}>
                <div style={{
                  width: 36, height: 36,
                  border: `3px solid ${C.border}`,
                  borderTop: `3px solid ${C.primary}`,
                  borderRadius: "50%",
                  margin: "0 auto 12px",
                  animation: "spin 0.8s linear infinite",
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                불러오는 중...
              </div>
            ) : requests.length > 0 ? (
              requests.map(r => (
                <RequestCard
                  key={r.id}
                  name={r.name}
                  company={r.company}
                  message={r.message}
                  avatarColor={r.avatarColor}
                  scheduledAt={r.scheduledAt}
                  sessionType={r.sessionType}
                  requestedAt={r.requestedAt}
                  onAccept={() => handleAccept(r.id)}
                  onDecline={() => handleDecline(r.id)}
                  onDetail={() => setSelectedRequest(r)}
                />
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontSize: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: C.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>대기 중인 요청이 없습니다</p>
                <p style={{ fontSize: 12, color: "#ADB5BD" }}>새 신청이 오면 이곳에 표시됩니다</p>
              </div>
            )}
          </DashCard>

          {/* 다가오는 면접 세션 */}
          <DashCard
            title="다가오는 면접 세션"
            sub="확정된 일정을 확인하세요"
            accentColor={C.warning}
            iconSvg={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.warning} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            }
          >
            <div>
              {upcoming.length > 0 ? (
                upcoming.map((u, i) => <UpcomingItem key={i} {...u}/>)
              ) : (
                <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontSize: 14 }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: C.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <p style={{ fontWeight: 500, marginBottom: 4 }}>예정된 면접 세션이 없습니다</p>
                  <p style={{ fontSize: 12, color: "#ADB5BD" }}>확정된 세션이 생기면 여기에 표시됩니다</p>
                </div>
              )}
            </div>

          </DashCard>

        </div>
      </main>
    </>
  );
}
