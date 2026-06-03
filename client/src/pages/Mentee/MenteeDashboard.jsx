import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMySessions } from "../../api/sessions";

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
    } catch (err) {
      console.error("[MenteeDashboard] 로그아웃 API 실패:", err);
    }
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
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        height: 64, maxWidth: 1200, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>
            면도리
          </span>
          <img src="/meondori-logo.svg" alt="" aria-hidden="true" style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />
        </div>

        {/* 우측: 네비게이션 + 로그아웃 */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[
            { label: "대시보드", to: "/dashboard/mentee", active: true },
            { label: "멘토 탐색", to: "/mentor/search" },
            { label: "마이페이지", to: "/mentee/mypage" },
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
            padding: "7px 16px", borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: "transparent", color: C.textSub,
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
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
    background: gradient, borderRadius: 20,
    padding: "24px 26px", position: "relative",
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
    background: C.white, borderRadius: 20,
    padding: "24px 24px 28px",
    boxShadow: C.shadow,
    ...style,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {iconSvg && (
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: accentColor ? `${accentColor}18` : C.primaryLight,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
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
    background: C.navyGrad, borderRadius: 16,
    padding: "20px 24px",
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 16,
    boxShadow: "0 4px 16px rgba(28,58,92,0.22)",
    transition: "transform 0.2s, box-shadow 0.2s",
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 28px rgba(28,58,92,0.3)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(28,58,92,0.22)"; }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{
          background: "rgba(56,217,169,0.18)", color: "#38D9A9",
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
      <button onClick={onEnter} style={{
        background: "rgba(255,255,255,0.13)", color: C.white,
        border: "1px solid rgba(255,255,255,0.28)",
        borderRadius: 10, padding: "10px 22px",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        fontFamily: "inherit", transition: "all 0.18s", whiteSpace: "nowrap",
      }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.24)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; }}
      >
        입장하기 →
      </button>
    </div>
  </div>
);

/* ── 다가오는 세션 아이템 ── */
const UpcomingItem = ({ date, time, title, mentor, type, status }) => {
  const [mon, day] = (date || "").split(".").map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(new Date().getFullYear(), (mon || 1) - 1, day || 1);
  const diff = Math.ceil((target - today) / 86400000);
  const dday = diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  const isEnterable = status === "confirmed" || status === "in_progress";
  const accentColor = isEnterable ? C.success : status === "pending" ? C.warning : C.textMuted;
  const bgColor     = isEnterable ? C.successLight : status === "pending" ? C.warningLight : C.bg;
  const statusLabel = status === "in_progress" ? "진행중" : status === "confirmed" ? "확정" : status === "pending" ? "대기중" : "미확정";

  return (
    <div style={{
      display: "flex", gap: 14, alignItems: "center",
      padding: "14px 0", borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        flexShrink: 0, width: 52, borderRadius: 12,
        background: bgColor, overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center",
        border: `1px solid ${accentColor}33`,
      }}>
        <div style={{ width: "100%", background: "rgba(0,0,0,0.08)", padding: "3px 0", textAlign: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: "0.05em" }}>
            {mon ? `${mon}월` : "--"}
          </span>
        </div>
        <div style={{ padding: "4px 0 2px", textAlign: "center" }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: accentColor, lineHeight: 1 }}>{day || "--"}</span>
        </div>
        <div style={{ padding: "2px 0 5px", textAlign: "center" }}>
          <span style={{ fontSize: 9, color: accentColor, fontWeight: 600 }}>{time}</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</p>
        <p style={{ fontSize: 12, color: C.textMuted }}>{mentor} · {type}</p>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
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

/* ── 히스토리 리포트 아이템 ── */
const HistoryItem = ({ date, title, mentor, score, tag, tagColor, onView }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 0", borderBottom: `1px solid ${C.border}`,
  }}>
    <div style={{
      width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
      border: `2.5px solid ${tagColor}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `${tagColor}10`,
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: tagColor }}>{score}</span>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</p>
      <p style={{ fontSize: 12, color: C.textMuted }}>{date} · {mentor}</p>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
        background: `${tagColor}15`, color: tagColor,
      }}>
        {tag}
      </span>
      <button onClick={onView} style={{
        background: "transparent", border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "6px 12px",
        fontSize: 12, fontWeight: 500, color: C.textSub,
        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
      >
        리포트 보기
      </button>
    </div>
  </div>
);

const normalizeStatus = s => String(s || "").toLowerCase();
const getScheduledAt  = s => s.scheduledAt ?? s.scheduled_at ?? "";
const getSessionTitle = s => s.title ?? (s.job_category ? `${s.job_category} 모의 면접` : "모의 면접");
const getMentorName   = s => s.mentorName ?? s.mentor_name ?? "";
const getSessionType  = s => {
  const maxP = Number(s.max_participants ?? s.maxParticipants ?? 1);
  if (maxP > 1) return "그룹 면접";
  return s.sessionType ?? s.session_type ?? "1:1 면접";
};
const toDateText      = v => v ? String(v).slice(5, 10).replace("-", ".") : "";
const toTimeText      = v => v ? String(v).slice(11, 16) : "";
const toScheduledTime = s => {
  const time = new Date(getScheduledAt(s)).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
};
const compareByScheduledAtAsc = (a, b) => toScheduledTime(a) - toScheduledTime(b);

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function MenteeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [unreadFinals, setUnreadFinals] = useState([]);

  const hasResume = (() => {
    try {
      const key = `scena_resume_draft:${user?.email || user?.id || "anonymous"}`;
      const job = localStorage.getItem(`${key}:job`);
      const items = localStorage.getItem(key);
      if (job) { const p = JSON.parse(job); if (p?.requirements || p?.looking_for) return true; }
      if (items) { const arr = JSON.parse(items); if (arr?.some(i => i.content?.trim())) return true; }
    } catch {}
    return false;
  })();

  useEffect(() => {
    setSessionsLoading(true);
    getMySessions()
      .then(data => {
        setSessions(Array.isArray(data) ? data : []);
        setSessionsError("");
      })
      .catch(err => {
        console.error("[MenteeDashboard] 세션 목록 조회 실패:", err);
        setSessionsError(err?.message || "세션 목록을 불러오지 못했습니다.");
      })
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => {
    const viewed = JSON.parse(localStorage.getItem("scena_viewed_finals") || "[]");
    const unread = sessions.filter(s =>
      normalizeStatus(s.status) === "completed" &&
      (s.report_status === "final" || s.tag === "최종 리포트") &&
      !viewed.includes(String(s.id))
    );
    setUnreadFinals(unread);
  }, [sessions]);

  const completedSessions = sessions.filter(s => normalizeStatus(s.status) === "completed");
  const enterableSessions = sessions.filter(s => {
    const status = normalizeStatus(s.status);
    return status === "scheduled" || status === "in_progress";
  }).sort(compareByScheduledAtAsc);
  const enterableCards = enterableSessions.map(s => ({
    id: s.id,
    date: toDateText(getScheduledAt(s)),
    time: toTimeText(getScheduledAt(s)),
    title: getSessionTitle(s),
    mentor: getMentorName(s) ? `${getMentorName(s)} 멘토` : "",
    type: getSessionType(s),
    status: normalizeStatus(s.status) === "in_progress" ? "in_progress" : "confirmed",
  }));

  const history = completedSessions.map(s => ({
    id: s.id,
    date: toDateText(getScheduledAt(s)),
    title: getSessionTitle(s),
    mentor: getMentorName(s) ? `${getMentorName(s)} 멘토` : "",
    score: s.aiScore ?? "-",
    tag: s.tag ?? "완료",
    tagColor: s.report_status === "final" || s.tag === "최종 리포트" ? C.primary : C.success,
    isFinal: s.report_status === "final" || s.tag === "최종 리포트",
  }));

  const finalSessions = completedSessions.filter(
    s => (s.report_status ?? s.reportStatus) === "final"
  );
  const finalWithScore = finalSessions.filter(s => Number.isFinite(Number(s.ai_score ?? s.aiScore)));
  const avgScore = finalWithScore.length > 0
    ? (finalWithScore.reduce((a, s) => a + Number(s.ai_score ?? s.aiScore), 0) / finalWithScore.length).toFixed(1)
    : null;

  const now = new Date();
  const dateLabel = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Noto Sans KR', -apple-system, sans-serif; background: ${C.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .dash-stats { flex-direction: column !important; }
          .dash-bottom { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5% 72px" }}>

        {/* ── 페이지 타이틀 ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.04em", marginBottom: 6 }}>
            안녕하세요, {userName} 멘티님
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted }}>{dateLabel} · 오늘도 면접 준비 화이팅이에요</p>
        </div>

        {/* ── 통계 카드 ── */}
        <div className="dash-stats" style={{ display: "flex", gap: 20, marginBottom: 28 }}>
          <StatCard
            label="완료된 면접"
            value={completedSessions.length}
            sub={completedSessions.length > 0 ? "리포트를 확인하세요" : "아직 완료된 면접 없음"}
            gradient={C.primaryGrad}
            shadowColor="rgba(13,34,64,0.28)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            }
          />
          <StatCard
            label="입장 가능 세션"
            value={enterableSessions.length}
            sub={enterableSessions.length > 0 ? "지금 바로 입장할 수 있어요" : "예정된 세션 없음"}
            gradient={C.successGrad}
            shadowColor="rgba(12,166,120,0.28)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
            }
          />
          <StatCard
            label="멘토 평균 평점"
            value={avgScore !== null ? `${avgScore}점` : "-"}
            sub={avgScore !== null ? `${finalWithScore.length}회 최종 리포트 기준` : "최종 리포트 완성 후 표시"}
            gradient={C.warningGrad}
            shadowColor="rgba(247,103,7,0.28)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            }
          />
        </div>

        {/* ── 미확인 최종 리포트 배너 ── */}
        {unreadFinals.map(s => {
          const markViewed = (id) => {
            try {
              const viewed = JSON.parse(localStorage.getItem("scena_viewed_finals") || "[]");
              const sid = String(id);
              if (!viewed.includes(sid)) {
                localStorage.setItem("scena_viewed_finals", JSON.stringify([...viewed, sid]));
              }
            } catch {}
            setUnreadFinals(prev => prev.filter(u => u.id !== id));
          };
          return (
          <div key={s.id} style={{
            background: C.primaryGrad,
            borderRadius: 16, padding: "20px 28px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 20, marginBottom: 16, flexWrap: "wrap",
            boxShadow: C.shadowLg, position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(12,166,120,0.15)", pointerEvents: "none" }} />
            {/* X 닫기 버튼 */}
            <button onClick={() => markViewed(s.id)} style={{
              position: "absolute", top: 12, right: 12, zIndex: 2,
              background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%",
              width: 28, height: 28, cursor: "pointer", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700,
            }}>✕</button>
            <div style={{ display: "flex", alignItems: "center", gap: 16, zIndex: 1 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: C.success,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: "0 4px 12px rgba(12,166,120,0.4)",
              }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="3" y="5" width="16" height="14" rx="2" stroke="white" strokeWidth="1.6"/>
                  <path d="M7 3v4M15 3v4M3 10h16" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M7 14h8M7 17h5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, background: C.success, color: "white", padding: "2px 8px", borderRadius: 99 }}>NEW</span>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "white" }}>최종 면접 리포트가 도착했습니다</p>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
                  {s.title} · 멘토 코멘트 + AI 분석이 합쳐진 최종 리포트를 확인하세요
                </p>
              </div>
            </div>
            <button
              onClick={() => { markViewed(s.id); navigate(`/report/final/${s.id}`, { state: { sessionId: s.id, role: "mentee" } }); }}
              style={{
                padding: "12px 24px", borderRadius: 10,
                border: "none", background: C.success,
                color: "white", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0, whiteSpace: "nowrap", zIndex: 1,
                boxShadow: "0 4px 12px rgba(12,166,120,0.4)",
                transition: "opacity 0.18s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              지금 확인하기 →
            </button>
          </div>
          );
        })}

        {/* ── 자소서 배너: 미등록이면 등록 유도, 등록했으면 표시 안 함 ── */}
        {!hasResume && (
          <div style={{
            background: "linear-gradient(135deg, #FFFBEB 0%, #FFF3CD 100%)",
            border: "1px solid #FFD43B",
            borderRadius: 16, padding: "16px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, marginBottom: 20, flexWrap: "wrap",
            boxShadow: "0 4px 16px rgba(255,193,7,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "#F59F00",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                boxShadow: "0 4px 12px rgba(245,159,0,0.35)",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#7A4F00", marginBottom: 3 }}>
                  멘토에게 신청하기 전에 자소서를 먼저 등록해두세요
                </p>
                <p style={{ fontSize: 12, color: "#9C6A00" }}>
                  멘토가 자소서를 검토한 후 맞춤 면접 질문을 준비합니다
                </p>
              </div>
            </div>
            <Link to="/mentee/resume" style={{
              padding: "10px 22px", background: "#F59F00", color: "#fff",
              borderRadius: 10, fontSize: 13, fontWeight: 700,
              textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(245,159,0,0.35)",
              transition: "opacity 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              자소서 등록하기 →
            </Link>
          </div>
        )}

        {/* ── 멘토 찾기 CTA ── */}
        <DashCard
          title="나에게 딱 맞는 현직자 멘토를 찾아보세요"
          sub="AI가 분석한 내 역량 기반으로 최적의 멘토를 추천해드립니다"
          style={{ marginBottom: 24 }}
          accentColor={C.primary}
          iconSvg={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          }
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <Link to="/mentor/search" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 14, fontWeight: 700, color: C.primary,
              textDecoration: "none",
              padding: "10px 22px", borderRadius: 10,
              background: C.primaryLight,
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.color = C.white; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.primaryLight; e.currentTarget.style.color = C.primary; }}
            >
              멘토 탐색하기 →
            </Link>
            <div style={{ display: "flex", gap: 28, flexShrink: 0 }}>
              {[
                { n: `${completedSessions.length}회`, label: "완료된 면접" },
                { n: avgScore !== null ? `${avgScore}점` : "-", label: "평균 점수" },
                { n: `${enterableSessions.length}건`, label: "입장 가능" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, letterSpacing: "-0.03em", margin: 0 }}>{s.n}</p>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </DashCard>

        {/* ── 예정된 면접 세션 ── */}
        <DashCard
          title="예정된 면접 세션"
          sub={`입장 가능 세션 ${enterableCards.length}건`}
          style={{ marginBottom: 24 }}
          accentColor={C.primary}
          iconSvg={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          }
        >
          {sessionsLoading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontSize: 14 }}>
              <div style={{
                width: 36, height: 36,
                border: `3px solid ${C.border}`,
                borderTop: `3px solid ${C.primary}`,
                borderRadius: "50%",
                margin: "0 auto 12px",
                animation: "spin 0.8s linear infinite",
              }} />
              불러오는 중...
            </div>
          ) : sessionsError ? (
            <div style={{
              background: "#FFF5F5", border: "1px solid #FCA5A5",
              color: C.danger, borderRadius: 10,
              padding: "12px 16px", fontSize: 13,
            }}>
              {sessionsError}
            </div>
          ) : enterableCards.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {enterableCards.map(s => (
                <SessionCard
                  key={s.id}
                  title={s.title}
                  date={s.date}
                  mentor={s.mentor}
                  type={s.type}
                  time={s.time}
                  onEnter={() => navigate(`/interview/ready/${s.id}`)}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.textMuted, fontSize: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", background: C.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>예정된 면접 세션이 없습니다</p>
              <p style={{ fontSize: 12, color: "#ADB5BD" }}>멘토를 찾아 면접을 신청해보세요</p>
            </div>
          )}
        </DashCard>

        {/* ── 하단 2열 ── */}
        <div className="dash-bottom" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* 면접 히스토리 & 리포트 */}
          <DashCard
            title="나의 면접 히스토리 & 리포트"
            sub="완료된 면접 결과를 확인하세요"
            accentColor={C.success}
            iconSvg={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            }
          >
            {history.length > 0 ? (
              <div>
                {history.map((h, i) => (
                  <HistoryItem key={i} {...h}
                    onView={() => navigate(`/report/final/${h.id}`, { state: { sessionId: h.id, role: "mentee" } })}
                  />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontSize: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: C.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5">
                    <rect x="3" y="5" width="16" height="14" rx="2"/>
                    <path d="M7 3v4M15 3v4M3 10h16" strokeLinecap="round"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>아직 완료된 면접이 없습니다</p>
                <p style={{ fontSize: 12, color: "#ADB5BD" }}>면접을 완료하면 리포트가 여기에 표시됩니다</p>
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
            {enterableCards.length > 0 ? (
              <div>
                {enterableCards.map((u, i) => <UpcomingItem key={i} {...u}/>)}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontSize: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: C.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 14px",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>예정된 세션이 없습니다</p>
                <p style={{ fontSize: 12, color: "#ADB5BD" }}>멘토를 찾아 면접을 신청해보세요</p>
              </div>
            )}

            <Link to="/mentor/search" style={{
              display: "block", marginTop: 20,
              padding: "12px", borderRadius: 10,
              background: C.bg, textAlign: "center",
              fontSize: 13, fontWeight: 600, color: C.primary,
              textDecoration: "none",
              border: `1px dashed ${C.border}`,
              transition: "all 0.18s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = C.primaryLight; e.currentTarget.style.borderColor = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.borderColor = C.border; }}
            >
              + 새 면접 세션 신청하기
            </Link>
          </DashCard>

        </div>
      </main>
    </>
  );
}
