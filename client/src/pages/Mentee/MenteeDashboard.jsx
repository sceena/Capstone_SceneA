import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMySessions, joinSession } from "../../api/sessions";

/* ============================================================
   멘티 대시보드  (pages/Dashboard/MenteeDashboard.jsx)
   ============================================================ */

const C = {
  navy:      "#0D2240",
  navyMid:   "#1B4F7A",
  cream:     "#F2EDE4",
  creamDark: "#E8E0D0",
  white:     "#FFFFFF",
  teal:      "#1D9E75",
  tealLight: "#E8F5EE",
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

/* ── 섹션 아이콘 ── */
const SectionIcon = () => (
  <div style={{
    width:36, height:36, borderRadius:"50%",
    border:`1.5px solid ${C.border}`,
    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
  }}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke={C.teal} strokeWidth="1.5"/>
      <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14" stroke={C.teal} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3.76 3.76l1.06 1.06M11.18 11.18l1.06 1.06M11.18 4.82l-1.06 1.06M4.82 11.18l-1.06 1.06" stroke={C.teal} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  </div>
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
    <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>
          안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{ label:"대시보드", to:"/dashboard/mentee" }, { label:"멘토 탐색", to:"/mentor/search" }, { label:"MyPage", to:"/mentee/mypage" }]
            .map((item, i) => (
            <Link key={i} to={item.to} style={{
              fontSize:14, fontWeight: item.label==="MyPage" ? 700 : 400,
              color:C.white, textDecoration:"none", opacity:0.85, transition:"opacity 0.15s",
            }}
              onMouseEnter={e => e.target.style.opacity=1}
              onMouseLeave={e => e.target.style.opacity=0.85}
            >{item.label}</Link>
          ))}
          <button onClick={handleLogout} style={{
            padding:"7px 16px", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.3)",
            background:"transparent", color:"rgba(255,255,255,0.85)",
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
            transition:"background 0.15s, border-color 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(255,255,255,0.3)"; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 따옴표 아이콘 ── */
const QuoteIcon = () => (
  <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
    <path d="M0 20V12C0 5.373 4.48 1.28 13.44 0l1.12 2.08C10.293 3.12 8 5.653 8 9.6V11h5V20H0zm15 0V12C15 5.373 19.48 1.28 28.44 0l1.12 2.08C25.293 3.12 23 5.653 23 9.6V11h5V20H15z" fill={C.border}/>
  </svg>
);

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
          background:"#333", color:"#bbb",
          fontSize:9, fontWeight:700, letterSpacing:"0.08em",
          padding:"2px 6px", borderRadius:3,
        }}>0:1</span>
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
    background:C.white, borderRadius:16,
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

/* ── 다가오는 세션 아이템 ── */
const UpcomingItem = ({ date, time, title, mentor, type, status }) => {
  const [mon, day] = (date || "").split(".").map(Number);
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(new Date().getFullYear(), (mon||1)-1, day||1);
  const diff = Math.ceil((target - today) / 86400000);
  const dday = diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
  const ddayColor = diff === 0 ? "#EF4444" : diff > 0 ? C.navy : C.textMuted;
  const boxColor = status==="confirmed" ? C.teal : status==="pending" ? "#F59E0B" : C.navyMid;
  return (
    <div style={{
      display:"flex", gap:14, alignItems:"center",
      padding:"12px 0", borderBottom:`1px solid ${C.border}`,
    }}>
      <div style={{
        flexShrink:0, width:54, borderRadius:10,
        background:boxColor, overflow:"hidden",
        display:"flex", flexDirection:"column", alignItems:"center",
      }}>
        <div style={{ width:"100%", background:"rgba(0,0,0,0.18)", padding:"2px 0", textAlign:"center" }}>
          <span style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.9)", letterSpacing:"0.05em" }}>
            {mon ? `${mon}월` : ""}
          </span>
        </div>
        <div style={{ padding:"4px 0 2px", textAlign:"center" }}>
          <span style={{ fontSize:20, fontWeight:800, color:"white", lineHeight:1 }}>{day || "-"}</span>
        </div>
        <div style={{ padding:"2px 0 4px", textAlign:"center" }}>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.8)", fontWeight:500 }}>{time}</span>
        </div>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</p>
        <p style={{ fontSize:12, color:C.textMuted }}>{mentor} · {type}</p>
      </div>
      <div style={{ flexShrink:0, textAlign:"right" }}>
        <div style={{ fontSize:14, fontWeight:800, color:ddayColor, letterSpacing:"-0.02em", marginBottom:4 }}>{dday}</div>
        <div style={{
          fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99,
          background: status==="confirmed" ? C.tealLight : "#FEF3C7",
          color: status==="confirmed" ? C.teal : "#92400E",
        }}>
          {status==="confirmed" ? "확정" : status==="pending" ? "대기중" : "미확정"}
        </div>
      </div>
    </div>
  );
};

/* ── 히스토리 리포트 아이템 ── */
const HistoryItem = ({ date, title, mentor, score, tag, tagColor, onView }) => (
  <div style={{
    display:"flex", alignItems:"center", gap:14,
    padding:"13px 0", borderBottom:`1px solid ${C.border}`,
  }}>
    {/* 점수 원 */}
    <div style={{
      width:44, height:44, borderRadius:"50%", flexShrink:0,
      border:`2.5px solid ${tagColor}`,
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <span style={{ fontSize:13, fontWeight:700, color:tagColor }}>{score}</span>
    </div>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</p>
      <p style={{ fontSize:12, color:C.textMuted }}>{date} · {mentor}</p>
    </div>
    <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
      <span style={{
        fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:999,
        background: tagColor + "18", color:tagColor,
      }}>
        {tag}
      </span>
      <button onClick={onView} style={{
        background:"transparent", border:`1px solid ${C.border}`,
        borderRadius:6, padding:"5px 10px",
        fontSize:11, fontWeight:500, color:C.textSub,
        cursor:"pointer", fontFamily:"inherit",
        transition:"border-color 0.15s",
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor=C.navy}
        onMouseLeave={e => e.currentTarget.style.borderColor=C.border}
      >
        리포트 보기
      </button>
    </div>
  </div>
);

const normalizeStatus = (status) => String(status || "").toLowerCase();
const getScheduledAt = (session) => session.scheduledAt ?? session.scheduled_at ?? "";
const getSessionTitle = (session) => session.title ?? (session.job_category ? `${session.job_category} 모의 면접` : "모의 면접");
const getMentorName = (session) => session.mentorName ?? session.mentor_name ?? "";
const getSessionType = (session) => session.sessionType ?? session.session_type ?? "1:1 면접";
const toDateText = (value) => value ? String(value).slice(5, 10).replace("-", ".") : "";
const toTimeText = (value) => value ? String(value).slice(11, 16) : "";

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function MenteeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";

  const [sessions, setSessions] = useState([]);
  const [unreadFinals, setUnreadFinals] = useState([]);
  const [joinId, setJoinId] = useState("");
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!joinId.trim()) return;
    setJoining(true);
    try {
      await joinSession(joinId.trim());
      navigate(`/interview/ready/${joinId.trim()}`);
    } catch {
      alert("세션을 찾을 수 없거나 참여할 수 없습니다.");
      setJoining(false);
    }
  };

  useEffect(() => {
    getMySessions()
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]));
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

  /* API 응답에서 UI 데이터 파생 */
  const completedSessions = sessions.filter(s => normalizeStatus(s.status) === "completed");
  const scheduledSessions = sessions.filter(s => normalizeStatus(s.status) === "scheduled");
  const scheduledCards = scheduledSessions.map(s => ({
    id: s.id,
    date: toDateText(getScheduledAt(s)),
    time: toTimeText(getScheduledAt(s)),
    title: getSessionTitle(s),
    mentor: getMentorName(s) ? `${getMentorName(s)} 멘토` : "",
    type: getSessionType(s),
    status: "confirmed",
  }));
  const history = completedSessions.map(s => ({
    id: s.id,
    date: toDateText(getScheduledAt(s)),
    title: getSessionTitle(s),
    mentor: getMentorName(s) ? `${getMentorName(s)} 멘토` : "",
    score: s.aiScore ?? "-",
    tag: s.tag ?? "완료",
    tagColor: s.report_status === "final" || s.tag === "최종 리포트" ? C.navy : C.teal,
    isFinal: s.report_status === "final" || s.tag === "최종 리포트",
  }));

  const upcoming = scheduledCards;

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

        {/* ── 미확인 최종 리포트 알림 배너 ── */}
        {unreadFinals.map(s => (
          <div key={s.id} style={{
            background: "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
            borderRadius: 16, padding: "20px 28px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 20, marginBottom: 16, flexWrap: "wrap",
            boxShadow: "0 4px 24px rgba(13,34,64,0.18)",
            position: "relative", overflow: "hidden",
          }}>
            {/* 배경 장식 */}
            <div style={{ position:"absolute", right:-20, top:-20, width:120, height:120, borderRadius:"50%", background:"rgba(29,158,117,0.15)", pointerEvents:"none" }}/>
            <div style={{ position:"absolute", right:60, bottom:-30, width:80, height:80, borderRadius:"50%", background:"rgba(29,158,117,0.1)", pointerEvents:"none" }}/>

            <div style={{ display:"flex", alignItems:"center", gap:16, zIndex:1 }}>
              {/* 아이콘 */}
              <div style={{
                width:48, height:48, borderRadius:14,
                background: C.teal,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
              }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="3" y="5" width="16" height="14" rx="2" stroke="white" strokeWidth="1.6"/>
                  <path d="M7 3v4M15 3v4M3 10h16" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M7 14h8M7 17h5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontWeight:700, background:C.teal, color:"white", padding:"2px 8px", borderRadius:99 }}>NEW</span>
                  <p style={{ fontSize:15, fontWeight:700, color:"white" }}>최종 면접 리포트가 도착했습니다</p>
                </div>
                <p style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.5 }}>
                  {s.title} · 멘토 코멘트 + AI 분석이 합쳐진 최종 리포트를 확인하세요
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/report/final", { state: { sessionId: s.id, role: "mentee" } })}
              style={{
                padding: "12px 24px", borderRadius: 10,
                border: "none", background: C.teal,
                color: "white", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0, whiteSpace: "nowrap", zIndex: 1,
                transition: "opacity 0.18s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity="1"}
            >
              지금 확인하기 →
            </button>
          </div>
        ))}

        {/* ── 세션 ID로 참여 ── */}
        <div style={{
          background:C.white, border:`1.5px solid ${C.navy}`,
          borderRadius:14, padding:"20px 24px", marginBottom:24,
          display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
        }}>
          <div style={{ flex:1, minWidth:200 }}>
            <p style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:4 }}>세션 ID로 바로 참여하기</p>
            <p style={{ fontSize:12, color:C.textMuted }}>멘토에게 받은 세션 ID를 입력하세요</p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={joinId}
              onChange={e => setJoinId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder="세션 ID 입력"
              style={{
                padding:"10px 14px", borderRadius:8, border:`1.5px solid ${C.border}`,
                fontSize:14, fontFamily:"inherit", outline:"none", width:140,
              }}
              onFocus={e => e.target.style.borderColor=C.navy}
              onBlur={e => e.target.style.borderColor=C.border}
            />
            <button onClick={handleJoin} disabled={joining || !joinId.trim()} style={{
              padding:"10px 20px", background:C.navy, color:C.white,
              border:"none", borderRadius:8, fontSize:14, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit",
              opacity: joining || !joinId.trim() ? 0.5 : 1,
            }}>
              {joining ? "참여 중..." : "참여하기"}
            </button>
          </div>
        </div>

        {/* ── 자소서 업로드 안내 배너 (면접 확정 시) ── */}
        {scheduledSessions.length > 0 && (
          <div style={{
            background:"#FFF8F0", border:"1.5px solid #F59E0B",
            borderRadius:14, padding:"16px 24px",
            display:"flex", alignItems:"center", justifyContent:"space-between",
            gap:16, marginBottom:20, flexWrap:"wrap",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>📋</span>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:"#92400E", marginBottom:2 }}>
                  면접이 확정됐어요! 자소서를 미리 등록해두세요
                </p>
                <p style={{ fontSize:12, color:"#B45309" }}>
                  멘토가 면접 전 자소서를 검토하고 맞춤 질문을 준비합니다
                </p>
              </div>
            </div>
            <Link to="/mentee/resume" style={{
              padding:"9px 20px", background:"#F59E0B", color:"#fff",
              borderRadius:8, fontSize:13, fontWeight:700,
              textDecoration:"none", flexShrink:0, whiteSpace:"nowrap",
            }}>자소서 등록하기 →</Link>
          </div>
        )}

        {/* ── 상단 배너 카드 (멘토 찾기 CTA) ── */}
        <div style={{
          background:C.white, borderRadius:16,
          padding:"24px 32px",
          border:`1px solid ${C.border}`,
          marginBottom:24,
          display:"flex", alignItems:"center",
          justifyContent:"space-between", gap:20,
          flexWrap:"wrap",
        }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, color:C.text, letterSpacing:"-0.02em", marginBottom:6 }}>
              나에게 딱 맞는 현직자 멘토를 찾아보세요
            </h2>
            <p style={{ fontSize:13, color:C.textSub, lineHeight:1.6 }}>
              AI가 분석한 내 역량 기반으로 최적의 멘토를 추천해드립니다.
            </p>
            <Link to="/mentor/search" style={{
              display:"inline-flex", alignItems:"center", gap:6,
              marginTop:14, fontSize:13, fontWeight:700,
              color:C.navy, textDecoration:"none",
              transition:"gap 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.gap="10px"; }}
              onMouseLeave={e => { e.currentTarget.style.gap="6px"; }}
            >
              멘토 탐색하기
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke={C.navy} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
          {/* 우측 미니 스탯 */}
          <div style={{ display:"flex", gap:24, flexShrink:0 }}>
            {[
              { n:`${completedSessions.length}회`, label:"완료된 면접" },
              { n: completedSessions.length > 0 ? `${Math.round(completedSessions.reduce((a,s) => a + (Number(s.aiScore) || 0), 0) / completedSessions.length)}점` : "-", label:"평균 점수" },
              { n:`${scheduledSessions.length}건`, label:"예정된 일정" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign:"center" }}>
                <p style={{ fontSize:22, fontWeight:700, color:C.navy, letterSpacing:"-0.03em" }}>{s.n}</p>
                <p style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 예정된 일정 ── */}
        <DashCard title="예정된 일정" style={{ marginBottom:24 }}>
          {scheduledCards.length > 0 ? (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {scheduledCards.map(session => (
                <SessionCard
                  key={session.id}
                  title={session.title}
                  date={session.date}
                  mentor={session.mentor}
                  type={session.type}
                  time={session.time}
                  onEnter={() => navigate(`/interview/ready/${session.id}`)}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"40px 0", color:C.textMuted, fontSize:14 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.4" style={{ display:"block", margin:"0 auto 12px" }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              예정된 면접 세션이 없습니다
            </div>
          )}
        </DashCard>

        {/* ── 하단 2열 ── */}
        <div className="dash-bottom" style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:24,
        }}>

          {/* 나의 면접 히스토리 & 리포트 */}
          <DashCard title="나의 면접 히스토리 & 리포트">
            {history.length > 0 ? (
              <div>
                {history.map((h, i) => (
                  <HistoryItem key={i} {...h}
                    onView={() => h.isFinal
                      ? navigate("/report/final", { state: { sessionId: h.id, role: "mentee" } })
                      : navigate(`/report/ai/${h.id}`, { state: { role: "mentee" } })
                    }
                  />
                ))}
                <Link to="/dashboard/mentee" style={{
                  display:"block", textAlign:"center",
                  marginTop:16, fontSize:13, color:C.textMuted,
                  textDecoration:"none",
                  transition:"color 0.15s",
                }}
                  onMouseEnter={e => e.target.style.color=C.navy}
                  onMouseLeave={e => e.target.style.color=C.textMuted}
                >
                  전체 히스토리 보기 →
                </Link>
              </div>
            ) : (
              <div style={{
                textAlign:"center", padding:"48px 0",
                color:C.textMuted, fontSize:14,
              }}>
                <div style={{
                  width:48, height:48, borderRadius:"50%",
                  background:C.bg, margin:"0 auto 14px",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <rect x="3" y="5" width="16" height="14" rx="2" stroke={C.textMuted} strokeWidth="1.4"/>
                    <path d="M7 3v4M15 3v4M3 10h16" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                아직 완료된 면접이 없습니다
              </div>
            )}
          </DashCard>

          {/* 다가오는 면접 세션 */}
          <DashCard title="다가오는 면접 세션">
            <div>
              {upcoming.map((u, i) => <UpcomingItem key={i} {...u}/>)}
            </div>

            {/* 멘토 신청 바로가기 */}
            <Link to="/mentee/resume" style={{
              display:"block", marginTop:20,
              padding:"12px", borderRadius:10,
              background:C.bg, textAlign:"center",
              fontSize:13, fontWeight:600, color:C.navy,
              textDecoration:"none",
              border:`1px dashed ${C.border}`,
              transition:"border-color 0.18s, background 0.18s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background=C.creamDark; e.currentTarget.style.borderColor=C.navy; }}
              onMouseLeave={e => { e.currentTarget.style.background=C.bg; e.currentTarget.style.borderColor=C.border; }}
            >
              + 새 면접 세션 신청하기
            </Link>
          </DashCard>

        </div>
      </main>
    </>
  );
}
