import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMySessions } from "../../api/sessions";
import { respondReservation } from "../../api/reservations";

/* ============================================================
   멘토 대시보드  (pages/Dashboard/MentorDashboard.jsx)
   ============================================================ */

const C = {
  navy:      "#0D2240",
  navyMid:   "#1B4F7A",
  cream:     "#F2EDE4",
  creamDark: "#E8E0D0",
  white:     "#FFFFFF",
  teal:      "#1D9E75",
  text:      "#1A1818",
  textSub:   "#6B6863",
  textMuted: "#9E9B95",
  border:    "#E8E0D0",
  bg:        "#FAF8F4",
};

/* ── 로고 ── */
const LogoIcon = ({ size = 26, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="2" fill={color}/>
    {[0,45,90,135,180,225,270,315].map((deg, i) => {
      const r = deg * Math.PI / 180;
      return <line key={i}
        x1={14+2.5*Math.cos(r)} y1={14+2.5*Math.sin(r)}
        x2={14+10 *Math.cos(r)} y2={14+10 *Math.sin(r)}
        stroke={color} strokeWidth="1.5" strokeLinecap="round"/>;
    })}
    {[0,90,180,270].map((deg, i) => {
      const r=deg*Math.PI/180, mx=14+7*Math.cos(r), my=14+7*Math.sin(r), o=r+Math.PI/2;
      return <g key={i}>
        <line x1={mx} y1={my} x2={mx+3*Math.cos(o)} y2={my+3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1={mx} y1={my} x2={mx-3*Math.cos(o)} y2={my-3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </g>;
    })}
  </svg>
);

/* ── 섹션 헤더 아이콘 ── */
const SectionIcon = () => (
  <div style={{
    width:36, height:36, borderRadius:"50%",
    border:`1.5px solid ${C.border}`,
    display:"flex", alignItems:"center", justifyContent:"center",
    flexShrink:0,
  }}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke={C.teal} strokeWidth="1.5"/>
      <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3.76 3.76l1.06 1.06M11.18 11.18l1.06 1.06M11.18 4.82l-1.06 1.06M4.82 11.18l-1.06 1.06" stroke={C.teal} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  </div>
);

/* ── 따옴표 아이콘 ── */
const QuoteIcon = () => (
  <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
    <path d="M0 20V12C0 5.373 4.48 1.28 13.44 0l1.12 2.08C10.293 3.12 8 5.653 8 9.6V11h5V20H0zm15 0V12C15 5.373 19.48 1.28 28.44 0l1.12 2.08C25.293 3.12 23 5.653 23 9.6V11h5V20H15z" fill={C.border}/>
  </svg>
);

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
  return (
    <header style={{
      background: C.navy, padding:"0 5%",
      position:"sticky", top:0, zIndex:100,
    }}>
      <nav style={{
        display:"flex", alignItems:"center",
        justifyContent:"space-between", height:64,
      }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>
          안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>멘토님
        </span>
        <Link to="/" style={{ textDecoration:"none" }}>
          <LogoIcon size={28} color={C.white}/>
        </Link>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{ label:"멘토 탐색", to:"/mentor/search" }, { label:"MyPage", to:"/mentor/mypage" }].map(({ label, to }) => (
            <Link key={label} to={to} style={{
              fontSize:14, fontWeight: label==="MyPage" ? 700 : 400,
              color: C.white, textDecoration:"none",
              opacity: 0.85, transition:"opacity 0.15s",
            }}
              onMouseEnter={e => e.target.style.opacity=1}
              onMouseLeave={e => e.target.style.opacity=0.85}
            >
              {label}
            </Link>
          ))}
          <button onClick={handleLogout} style={{
            padding:"7px 16px", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.3)",
            background:"transparent", color:"rgba(255,255,255,0.85)",
            fontSize:13, fontWeight:500, cursor:"pointer",
            fontFamily:"inherit", transition:"background 0.15s, border-color 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(255,255,255,0.3)"; }}
          >
            로그아웃
          </button>
        </div>
      </nav>
    </header>
  );
};

/* ── 면접 세션 카드 (검정 배경) ── */
const SessionCard = ({ title, date, mentor, type, time, onEnter }) => (
  <div style={{
    background:"#0D2240", borderRadius:12,
    padding:"18px 22px",
    display:"flex", alignItems:"center",
    justifyContent:"space-between", gap:16,
    transition:"transform 0.2s",
  }}
    onMouseEnter={e => e.currentTarget.style.transform="translateY(-1px)"}
    onMouseLeave={e => e.currentTarget.style.transform="translateY(0)"}
  >
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <span style={{
          background:"#1D9E7533", color:"#1D9E75",
          fontSize:9, fontWeight:700, letterSpacing:"0.08em",
          padding:"2px 8px", borderRadius:3,
        }}>면접 세션</span>
      </div>
      <p style={{ fontSize:15, fontWeight:700, color:C.white, marginBottom:5 }}>{title}</p>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", display:"flex", alignItems:"center", gap:4 }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5.5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {date}
        </span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", display:"flex", alignItems:"center", gap:4 }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="5.5" cy="5.5" r="1.5" fill="currentColor"/>
          </svg>
          {mentor} · {type}
        </span>
      </div>
    </div>
    <div style={{ display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
      <div>
        <span style={{ fontSize:28, fontWeight:700, color:C.white, letterSpacing:"-0.03em" }}>{time}</span>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginLeft:3 }}>KST</span>
      </div>
      <button
        onClick={onEnter}
        style={{
          background:"transparent", color:C.white,
          border:"1px solid rgba(255,255,255,0.4)",
          borderRadius:6, padding:"8px 16px",
          fontSize:12, fontWeight:600, cursor:"pointer",
          fontFamily:"inherit", transition:"background 0.18s, border-color 0.18s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.8)"; }}
        onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(255,255,255,0.4)"; }}
      >
        입장하기
      </button>
    </div>
  </div>
);

/* ── 카드 컨테이너 ── */
const DashCard = ({ title, sub, children, style }) => (
  <div style={{
    background: C.white,
    borderRadius:16,
    padding:"24px 24px 28px",
    border:`1px solid ${C.border}`,
    ...style,
  }}>
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <SectionIcon/>
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, color:C.text, letterSpacing:"-0.02em" }}>{title}</h2>
          {sub && <p style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{sub}</p>}
        </div>
      </div>
      <QuoteIcon/>
    </div>
    {children}
  </div>
);

/* ── 수락 대기 요청 카드 ── */
const RequestCard = ({ name, company, message, avatarColor, onAccept, onDecline, scheduledAt, sessionType }) => {
  const dateLabel = scheduledAt ? (() => {
    const dt = new Date(scheduledAt);
    const days = ['일','월','화','수','목','금','토'];
    return `${dt.getMonth()+1}월 ${dt.getDate()}일 (${days[dt.getDay()]}) ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  })() : null;

  return (
    <div style={{
      background:C.bg,
      borderRadius:12, padding:"16px 18px",
      marginBottom:12,
      border:`1px solid ${C.border}`,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <div style={{
          width:36, height:36, borderRadius:"50%", flexShrink:0,
          background: avatarColor,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5.5" r="2.5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3"/>
            <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize:14, fontWeight:700, color:C.text }}>{name}</p>
          <p style={{ fontSize:12, color:C.textMuted }}>{company}</p>
        </div>
      </div>

      {/* 날짜·시간·유형 배지 */}
      {(dateLabel || sessionType) && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {dateLabel && (
            <span style={{ fontSize:11, fontWeight:700, background:"#E1F5EE", color:C.teal, padding:"3px 10px", borderRadius:99, display:"flex", alignItems:"center", gap:4 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="1" y="2" width="8" height="7" rx="1" stroke={C.teal} strokeWidth="1.2"/>
                <path d="M3.5 1v2M6.5 1v2M1 5h8" stroke={C.teal} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {dateLabel}
            </span>
          )}
          {sessionType && (
            <span style={{ fontSize:11, fontWeight:600, background:"#E8E5DF", color:"#555", padding:"3px 10px", borderRadius:99 }}>{sessionType}</span>
          )}
        </div>
      )}

      <p style={{ fontSize:13, color:C.textSub, lineHeight:1.75, marginBottom:14 }}>{message}</p>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={onAccept} style={{
          flex:1, padding:"8px",
          background:C.navy, color:C.white,
          border:"none", borderRadius:8,
          fontSize:12, fontWeight:600, cursor:"pointer",
          fontFamily:"inherit", transition:"background 0.18s",
        }}
          onMouseEnter={e => e.currentTarget.style.background=C.navyMid}
          onMouseLeave={e => e.currentTarget.style.background=C.navy}
        >
          수락
        </button>
        <button onClick={onDecline} style={{
          flex:1, padding:"8px",
          background:"transparent", color:C.textSub,
          border:`1px solid ${C.border}`, borderRadius:8,
          fontSize:12, fontWeight:500, cursor:"pointer",
          fontFamily:"inherit", transition:"border-color 0.18s",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor=C.text}
          onMouseLeave={e => e.currentTarget.style.borderColor=C.border}
        >
          거절
        </button>
      </div>
    </div>
  );
};

/* ── 다가오는 세션 아이템 (시각화 강화) ── */
const UpcomingItem = ({ date, time, title, mentor, type, status }) => {
  const dotColor = status === "confirmed" ? C.teal : status === "pending" ? "#F59E0B" : C.border;
  const bgColor  = status === "confirmed" ? "#E8F5EE" : status === "pending" ? "#FEF3C7" : C.bg;
  const statusLabel = status === "confirmed" ? "확정" : status === "pending" ? "대기 중" : "미확정";

  const [m, d] = (date || "").split('.').map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), (m || 1) - 1, d || 1);
  const diff = Math.ceil((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const dday = diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;

  return (
    <div style={{
      display:"flex", gap:14, alignItems:"center",
      padding:"12px 0", borderBottom:`1px solid ${C.border}`,
    }}>
      {/* 달력 날짜 박스 */}
      <div style={{
        width:54, flexShrink:0, textAlign:"center",
        background:bgColor, borderRadius:10, padding:"8px 4px",
        border:`1px solid ${dotColor}33`,
      }}>
        <p style={{ fontSize:9, fontWeight:700, color:dotColor, letterSpacing:"0.04em", margin:"0 0 2px" }}>{m || "--"}월</p>
        <p style={{ fontSize:22, fontWeight:800, color:dotColor, lineHeight:1.1, margin:0 }}>{d || "--"}</p>
        <p style={{ fontSize:9, color:dotColor, fontWeight:600, margin:"2px 0 0" }}>{time}</p>
      </div>
      {/* 내용 */}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</p>
        <p style={{ fontSize:11, color:C.textMuted }}>{mentor} · {type}</p>
      </div>
      {/* D-day + 상태 */}
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <span style={{ fontSize:12, fontWeight:800, color:dotColor, background:bgColor, padding:"3px 9px", borderRadius:6, display:"block", marginBottom:4 }}>{dday}</span>
        <span style={{ fontSize:10, color:dotColor, fontWeight:600 }}>{statusLabel}</span>
      </div>
    </div>
  );
};

/* ── 더미 데이터 (API 미연결 시) ── */
const DUMMY_SESSIONS = [
  {
    id: "demo-1",
    status: "scheduled",
    title: "백엔드 개발자 모의 면접",
    scheduledAt: "2026-05-23T19:00",
    menteeName: "김민준",
    sessionType: "1:1 면접",
    kind: "interview",
  },
  {
    id: "demo-m1",
    status: "scheduled",
    title: "OOO 멘토 개인 멘토링 진행",
    scheduledAt: "2026-05-23T20:30",
    menteeName: "박서연",
    sessionType: "1:1 멘토링",
    kind: "mentoring",
  },
];

const DUMMY_REQUESTS = [
  {
    id: "req-1",
    name: "이준석",
    company: "카카오 백엔드 개발자 지원",
    message: "Spring Boot + MSA 관련 기술 면접 준비 중입니다. 실무 경험 기반의 피드백을 꼭 받고 싶습니다. 잘 부탁드립니다!",
    avatarColor: "#1B4F7A",
    scheduledAt: "2026-06-10T19:00",
    sessionType: "1:1 면접",
  },
];

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function MentorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const userName = user?.name || user?.email?.split("@")[0] || "사용자";

  const [allSessions, setAllSessions] = useState([]);
  useEffect(() => {
    getMySessions().then(data => { if (data?.length) setAllSessions(data); }).catch(() => {});
  }, []);

  const rawSessions = allSessions.length > 0 ? allSessions : DUMMY_SESSIONS;

  /* API 응답에서 UI 데이터 파생 — 면접 세션만 (멘토링은 면접 종료 후 자동 진입) */
  const sessions = rawSessions
    .filter(s => (s.status === "scheduled" || s.status === "in_progress") && s.kind !== "mentoring")
    .map(s => ({
      id: s.id,
      title: s.title ?? "",
      date: s.scheduledAt?.slice(5, 10).replace("-", ".") ?? "",
      mentor: s.menteeName ?? "",
      type: s.sessionType ?? "1:1 세션",
      time: s.scheduledAt?.slice(11, 16) ?? "",
    }));

  const [requests, setRequests] = useState(DUMMY_REQUESTS);
  useEffect(() => {
    const pending = allSessions.filter(s => s.status === "pending");
    if (pending.length > 0) {
      setRequests(pending.map(s => ({
        id: s.id,
        name: s.menteeName ?? "",
        company: s.menteeCompany ?? "",
        message: s.menteeMessage ?? "",
        avatarColor: "#1B4F7A",
        scheduledAt: s.scheduledAt ?? null,
        sessionType: s.sessionType ?? "1:1 면접",
      })));
    }
  }, [allSessions]);

  const upcoming = rawSessions
    .filter(s => s.status === "scheduled")
    .map(s => ({
      id: s.id,
      date: s.scheduledAt?.slice(5, 10).replace("-", ".") ?? "",
      time: s.scheduledAt?.slice(11, 16) ?? "",
      title: s.title ?? "",
      mentor: s.menteeName ?? "",
      type: s.sessionType ?? "1:1",
      status: "confirmed",
    }));

  const handleAccept = async (id) => {
    try { await respondReservation({ reservationId: id, accepted: true }); } catch {}
    setRequests(r => r.filter(x => x.id !== id));
  };
  const handleDecline = async (id) => {
    try { await respondReservation({ reservationId: id, accepted: false }); } catch {}
    setRequests(r => r.filter(x => x.id !== id));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; background: ${C.bg}; }
        @media (max-width: 768px) {
          .dash-bottom { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 5% 60px" }}>

        {/* ── 미완료 피드백 알림 배너 ── */}
        {(() => {
          const pendingFeedback = rawSessions.filter(s => s.status === "completed" && !s.feedbackSubmitted);
          if (pendingFeedback.length === 0) return null;
          return (
            <div style={{
              background: "#FEF3C7", border: "1px solid #F59E0B",
              borderRadius: 14, padding: "18px 24px", marginBottom: 28,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "#F59E0B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#92400E", marginBottom: 3 }}>
                  아직 전송하지 않은 피드백이 {pendingFeedback.length}건 있습니다
                </p>
                <p style={{ fontSize: 12, color: "#B45309" }}>
                  멘티는 멘토의 최종 코멘트를 기다리고 있어요. 세션 종료 후 60분 이내에 전송해주세요.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingFeedback.map(s => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/mentor/feedback/${s.id}`)}
                    style={{
                      padding: "8px 18px", borderRadius: 8, border: "none",
                      background: "#92400E", color: "white",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", whiteSpace: "nowrap",
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
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
          style={{ marginBottom:28 }}
        >
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
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
              <div style={{ textAlign:"center", padding:"32px 0", color:C.textMuted, fontSize:14 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.4" style={{ display:"block", margin:"0 auto 12px" }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                예정된 면접 일정이 없습니다
              </div>
            )}
          </div>
        </DashCard>

        {/* ── 하단 2열 ── */}
        <div className="dash-bottom" style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:24,
        }}>

          {/* 수락 대기 중인 요청 */}
          <DashCard title="수락 대기 중인 요청" sub="멘티가 멘토링을 요청했습니다">
            {requests.length > 0 ? (
              requests.map(r => (
                <RequestCard
                  key={r.id}
                  name={r.name}
                  company={r.company}
                  message={r.message}
                  avatarColor={r.avatarColor}
                  scheduledAt={r.scheduledAt}
                  sessionType={r.sessionType}
                  onAccept={()  => handleAccept(r.id)}
                  onDecline={() => handleDecline(r.id)}
                />
              ))
            ) : (
              <div style={{ textAlign:"center", padding:"40px 0", color:C.textMuted, fontSize:14 }}>
                대기 중인 요청이 없습니다.
              </div>
            )}
          </DashCard>

          {/* 다가오는 면접 세션 */}
          <DashCard title="다가오는 면접 세션" sub="확정된 일정을 확인하세요">
            <div>
              {upcoming.length > 0 ? (
                upcoming.map((u, i) => <UpcomingItem key={i} {...u}/>)
              ) : (
                <div style={{ textAlign:"center", padding:"32px 0", color:C.textMuted, fontSize:14 }}>
                  예정된 면접 세션이 없습니다.
                </div>
              )}
            </div>

            {/* 범례 */}
            <div style={{ display:"flex", gap:16, marginTop:16, flexWrap:"wrap" }}>
              {[
                { color:C.teal,    label:"확정" },
                { color:"#F59E0B", label:"대기 중" },
                { color:C.border,  label:"미확정" },
              ].map((leg, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:7, height:7, borderRadius:"50%", background:leg.color }}/>
                  <span style={{ fontSize:11, color:C.textMuted }}>{leg.label}</span>
                </div>
              ))}
            </div>
          </DashCard>

        </div>
      </main>
    </>
  );
}