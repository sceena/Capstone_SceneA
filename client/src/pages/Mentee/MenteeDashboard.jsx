import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMySessions } from "../../api/sessions";

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
      <nav style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>
          안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{ label:"멘토 탐색", to:"/mentor/search" }, { label:"예약 확인", to:"#" }, { label:"MyPage", to:"/mentee/mypage" }]
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
    background:"#111111", borderRadius:12,
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
  const dotColor = status==="confirmed" ? C.teal : status==="pending" ? "#F59E0B" : C.border;
  return (
    <div style={{
      display:"flex", gap:16, alignItems:"flex-start",
      padding:"12px 0", borderBottom:`1px solid ${C.border}`,
    }}>
      <div style={{ flexShrink:0, width:72, textAlign:"right" }}>
        <p style={{ fontSize:12, color:C.textMuted }}>{date}</p>
        <p style={{ fontSize:12, color:C.textMuted }}>{time}</p>
      </div>
      <div style={{ display:"flex", alignItems:"flex-start", gap:10, flex:1 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:dotColor, flexShrink:0, marginTop:4 }}/>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:2 }}>{title}</p>
          <p style={{ fontSize:12, color:C.textMuted }}>{mentor} · {type}</p>
        </div>
      </div>
    </div>
  );
};

/* ── 히스토리 리포트 아이템 ── */
const HistoryItem = ({ date, title, mentor, score, tag, tagColor }) => (
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
      <button style={{
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

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function MenteeDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.email?.split("@")[0] || "사용자";

  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    getMySessions().then(setSessions).catch(() => {});
  }, []);

  /* API 응답에서 UI 데이터 파생 */
  const completedSessions = sessions.filter(s => s.status === "completed");
  const scheduledSessions = sessions.filter(s => s.status === "scheduled");
  const todaySession = scheduledSessions[0] ?? null;

  const history = completedSessions.map(s => ({
    id: s.id,
    date: s.scheduledAt?.slice(5, 10).replace("-", ".") ?? "",
    title: s.title ?? "",
    mentor: s.mentorName ? `${s.mentorName} 멘토` : "",
    score: s.aiScore ?? "-",
    tag: s.tag ?? "완료",
    tagColor: C.teal,
  }));

  const upcoming = scheduledSessions.map(s => ({
    id: s.id,
    date: s.scheduledAt?.slice(5, 10).replace("-", ".") ?? "",
    time: s.scheduledAt?.slice(11, 16) ?? "",
    title: s.title ?? "",
    mentor: s.mentorName ? `${s.mentorName} 멘토` : "",
    type: s.sessionType ?? "1:1",
    status: "confirmed",
  }));

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
              { n:"3회", label:"완료된 면접" },
              { n:"87점", label:"평균 점수" },
              { n:"2건", label:"예정된 일정" },
            ].map((s, i) => (
              <div key={i} style={{ textAlign:"center" }}>
                <p style={{ fontSize:22, fontWeight:700, color:C.navy, letterSpacing:"-0.03em" }}>{s.n}</p>
                <p style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 오늘 예정된 일정 ── */}
        <DashCard title="오늘 예정된 일정" style={{ marginBottom:24 }}>
          <SessionCard
            title={todaySession.title}
            date={todaySession.date}
            mentor={todaySession.mentor}
            type={todaySession.type}
            time={todaySession.time}
            onEnter={() => navigate(`/interview/ready/${todaySession.id}`)}
          />
        </DashCard>

        {/* ── 하단 2열 ── */}
        <div className="dash-bottom" style={{
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:24,
        }}>

          {/* 나의 면접 히스토리 & 리포트 */}
          <DashCard title="나의 면접 히스토리 & 리포트">
            {history.length > 0 ? (
              <div>
                {history.map((h, i) => <HistoryItem key={i} {...h}/>)}
                <Link to="/my/history" style={{
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

            {/* 멘토 신청 바로가기 */}
            <Link to="/mentor/search" style={{
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
