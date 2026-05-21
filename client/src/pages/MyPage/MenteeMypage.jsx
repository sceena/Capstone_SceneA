import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMyProfile, updateMyProfile, getUserSessions } from "../../api/users";
import { getAvatar } from "../../utils/avatar";

/* ============================================================
   멘티 마이페이지  (pages/mentee/MyPage.jsx)
   ============================================================ */

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A",
  cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75", tealLight:"#E8F5EE",
  text:"#1A1818", textSub:"#6B6863", textMuted:"#9E9B95",
  border:"#E8E0D0", bg:"#FAF8F4",
  orange:"#F59E0B", red:"#EF4444",
};

/* ── 로고 ── */
const LogoIcon = ({ size=26, color=C.white }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="2" fill={color}/>
    {[0,45,90,135,180,225,270,315].map((deg,i)=>{
      const r=deg*Math.PI/180;
      return <line key={i} x1={14+2.5*Math.cos(r)} y1={14+2.5*Math.sin(r)} x2={14+10*Math.cos(r)} y2={14+10*Math.sin(r)} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>;
    })}
    {[0,90,180,270].map((deg,i)=>{
      const r=deg*Math.PI/180,mx=14+7*Math.cos(r),my=14+7*Math.sin(r),o=r+Math.PI/2;
      return <g key={i}><line x1={mx} y1={my} x2={mx+3*Math.cos(o)} y2={my+3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/><line x1={mx} y1={my} x2={mx-3*Math.cos(o)} y2={my-3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/></g>;
    })}
  </svg>
);

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
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님</span>
        <Link to="/" style={{ textDecoration:"none" }}><LogoIcon size={28}/></Link>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{l:"대시보드",to:"/dashboard/mentee"},{l:"멘토 탐색",to:"/mentor/search"},{l:"예약 확인",to:"#"},{l:"MyPage",to:"/mentee/mypage",bold:true}].map((x,i)=>(
            <Link key={i} to={x.to} style={{ fontSize:14, fontWeight:x.bold?700:400, color:C.white, textDecoration:"none", opacity:x.bold?1:0.85 }}
              onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=x.bold?1:0.85}>{x.l}</Link>
          ))}
          <button onClick={handleLogout} style={{
            padding:"7px 16px", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.3)",
            background:"transparent", color:"rgba(255,255,255,0.85)",
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
            transition:"background 0.15s, border-color 0.15s",
          }}
            onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.6)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(255,255,255,0.3)"; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 변화 스탯 카드 ── */
const ChangeStatCard = ({ label, before, after, unit, note, noteColor }) => (
  <div style={{ background:C.white, borderRadius:14, padding:"18px 20px", border:`1px solid ${C.border}`, flex:1, minWidth:0 }}>
    <p style={{ fontSize:12, color:C.textMuted, marginBottom:8 }}>{label}</p>
    {before ? (
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
        <span style={{ fontSize:14, color:C.textMuted }}>{before}</span>
        <span style={{ fontSize:14, color:C.textMuted }}>→</span>
        <span style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.03em" }}>{after}</span>
      </div>
    ) : (
      <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.03em", marginBottom:4 }}>{after}</p>
    )}
    {note && <p style={{ fontSize:12, color:noteColor||C.teal, fontWeight:500 }}>{note}</p>}
    {unit && !note && <p style={{ fontSize:12, color:C.textMuted }}>{unit}</p>}
  </div>
);

/* ── 역량 성장 바 ── */
const GrowthBar = ({ label, value, change, color }) => {
  const isNeg = change < 0;
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:13, color:C.text }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:700, color: isNeg?C.red:C.teal }}>
          {isNeg?"":"+"}
          {change}%
        </span>
      </div>
      <div style={{ height:8, background:C.creamDark, borderRadius:999, overflow:"hidden" }}>
        <div style={{
          height:"100%", borderRadius:999,
          background: isNeg?C.red:color,
          width:`${Math.min(Math.abs(value),100)}%`,
          transition:"width 0.6s ease",
        }}/>
      </div>
    </div>
  );
};

/* ── WPM 태그 색상 ── */
const wpmColor = (level) => {
  if(level==="안정") return { bg:C.tealLight, color:C.teal };
  if(level==="양호") return { bg:"#E8F4FF", color:"#185FA5" };
  if(level==="빠름") return { bg:"#FEF3C7", color:C.orange };
  if(level==="매우 빠름") return { bg:"#FEF2F2", color:C.red };
  return { bg:C.bg, color:C.textSub };
};

/* ── 히스토리 아이템 ── */
const HistoryItem = ({ num, title, wpm, wpmLevel, star, ai, silence, mentor, date, type, hasReport, hasAudio }) => {
  const wc = wpmColor(wpmLevel);
  return (
    <div style={{ padding:"18px 0", borderBottom:`1px solid ${C.border}` }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
        {/* 번호 원 */}
        <div style={{
          width:28, height:28, borderRadius:"50%", flexShrink:0,
          background:C.teal+"18", border:`1.5px solid ${C.teal}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:12, fontWeight:700, color:C.teal,
        }}>{num}</div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <p style={{ fontSize:15, fontWeight:700, color:C.text }}>{title}</p>
            <span style={{ fontSize:11, padding:"3px 8px", borderRadius:999, background:C.tealLight, color:C.teal, fontWeight:600 }}>완료</span>
          </div>

          {/* 지표 태그들 */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
            <span style={{ fontSize:11, padding:"3px 9px", borderRadius:999, background:wc.bg, color:wc.color, fontWeight:600 }}>
              WPM {wpm} · {wpmLevel}
            </span>
            <span style={{ fontSize:11, padding:"3px 9px", borderRadius:999, background:C.bg, color:C.textSub }}>
              STAR {star}
            </span>
            <span style={{ fontSize:11, padding:"3px 9px", borderRadius:999, background:C.bg, color:C.textSub }}>
              AI {ai}점
            </span>
            {silence && (
              <span style={{ fontSize:11, padding:"3px 9px", borderRadius:999, background:"#FEF2F2", color:C.red }}>
                침묵 {silence}회
              </span>
            )}
          </div>

          {/* 멘토 · 날짜 */}
          <p style={{ fontSize:12, color:C.textMuted, marginBottom:10 }}>
            멘토 {mentor} · {date} · {type}
          </p>

          {/* 버튼 */}
          <div style={{ display:"flex", gap:8 }}>
            <button style={{
              padding:"7px 16px",
              background:C.navy, color:C.white,
              border:"none", borderRadius:8,
              fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              transition:"background 0.18s",
            }}
              onMouseEnter={e=>e.currentTarget.style.background=C.navyMid}
              onMouseLeave={e=>e.currentTarget.style.background=C.navy}
            >리포트 보기</button>
            {hasAudio && (
              <button style={{
                padding:"7px 16px",
                background:C.white, color:C.text,
                border:`1px solid ${C.border}`, borderRadius:8,
                fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                display:"flex", alignItems:"center", gap:5,
                transition:"border-color 0.15s",
              }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4.5 4l4 2-4 2V4z" fill="currentColor"/>
                </svg>
                답변 다시 듣기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── 더미 히스토리 (API 미연결 시 표시용) ── */
const DUMMY_HISTORY = [
  { num:5, title:"백엔드 개발자 모의 면접", wpm:118, wpmLevel:"안정", star:"4/4", ai:4.4, silence:2, mentor:"박지훈", date:"2026.04.02", type:"1:1", hasAudio:true },
  { num:4, title:"프론트엔드 그룹 면접 연습", wpm:129, wpmLevel:"양호", star:"3/4", ai:4.1, silence:null, mentor:"이수연", date:"2026.03.20", type:"그룹 3인", hasAudio:true },
  { num:3, title:"인성 면접 집중 코칭", wpm:141, wpmLevel:"양호", star:"3/4", ai:3.9, silence:4, mentor:"박지훈", date:"2026.03.05", type:"1:1", hasAudio:true },
  { num:2, title:"기술 면접 기초 세션", wpm:158, wpmLevel:"빠름", star:"2/4", ai:3.5, silence:null, mentor:"김도현", date:"2026.02.18", type:"1:1", hasAudio:false },
  { num:1, title:"첫 모의 면접 세션", wpm:182, wpmLevel:"매우 빠름", star:"1/4", ai:2.8, silence:7, mentor:"박지훈", date:"2026.02.01", type:"1:1", hasAudio:false },
];

/* ── 프로필 수정 모달 ── */
function EditProfileModal({ onClose }) {
  const [tab, setTab]         = useState("name");   // "name" | "password"
  const [name, setName]       = useState("");
  const [pwNew, setPwNew]     = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  const inputStyle = (borderColor) => ({
    width:"100%", padding:"11px 14px", borderRadius:10,
    border:`1.5px solid ${borderColor||C.border}`,
    fontSize:14, fontFamily:"inherit", outline:"none", background:C.bg,
    boxSizing:"border-box",
  });

  const handleSave = async () => {
    setError("");
    const data = {};
    if (tab === "name") {
      if (!name.trim()) { setError("이름을 입력해주세요."); return; }
      data.name = name.trim();
    } else {
      if (pwNew.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
      if (pwNew !== pwConfirm) { setError("비밀번호가 일치하지 않습니다."); return; }
      data.password = pwNew;
    }
    setSaving(true);
    try {
      await updateMyProfile(data);
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e) {
      if (e?.status === 401) setError("로그인이 만료되었습니다. 다시 로그인해주세요.");
      else if (e?.status === 400) setError("입력값을 확인해주세요.");
      else if (!navigator.onLine || e?.message === "Failed to fetch") setError("서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.");
      else setError("저장에 실패했습니다. 다시 시도해주세요.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:C.white, borderRadius:18, padding:"32px 36px", width:400, boxShadow:"0 8px 40px rgba(13,34,68,0.18)" }}>
        <h3 style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:20 }}>프로필 수정</h3>

        {done ? (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>✓</div>
            <p style={{ color:C.teal, fontWeight:600, fontSize:15 }}>저장되었습니다!</p>
          </div>
        ) : (
          <>
            {/* 탭 */}
            <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:22 }}>
              {[{k:"name",l:"이름 변경"},{k:"password",l:"비밀번호 변경"}].map(t=>(
                <button key={t.k} onClick={()=>{ setTab(t.k); setError(""); }} style={{
                  flex:1, padding:"10px 0", background:"transparent", border:"none",
                  borderBottom:`2.5px solid ${tab===t.k?C.navy:"transparent"}`,
                  fontSize:13, fontWeight:tab===t.k?700:400,
                  color:tab===t.k?C.navy:C.textMuted,
                  cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
                  marginBottom:-1,
                }}>{t.l}</button>
              ))}
            </div>

            {/* 이름 변경 */}
            {tab === "name" && (
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:7 }}>새 이름</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="변경할 이름을 입력하세요"
                  style={inputStyle()}
                  onFocus={e=>e.target.style.borderColor=C.navy}
                  onBlur={e=>e.target.style.borderColor=C.border}
                />
              </div>
            )}

            {/* 비밀번호 변경 */}
            {tab === "password" && (
              <>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:7 }}>새 비밀번호</label>
                  <input type="password" value={pwNew} onChange={e=>setPwNew(e.target.value)} placeholder="8자 이상 입력"
                    style={inputStyle()}
                    onFocus={e=>e.target.style.borderColor=C.navy}
                    onBlur={e=>e.target.style.borderColor=C.border}
                  />
                  {pwNew.length > 0 && pwNew.length < 8 && (
                    <p style={{ fontSize:11, color:C.red, marginTop:5 }}>비밀번호는 8자 이상이어야 합니다.</p>
                  )}
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:7 }}>새 비밀번호 확인</label>
                  <input type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} placeholder="비밀번호를 다시 입력"
                    style={inputStyle(pwConfirm && pwConfirm !== pwNew ? C.red : undefined)}
                    onFocus={e=>e.target.style.borderColor= pwConfirm && pwConfirm!==pwNew ? C.red : C.navy}
                    onBlur={e=>e.target.style.borderColor= pwConfirm && pwConfirm!==pwNew ? C.red : C.border}
                  />
                  {pwConfirm && pwNew !== pwConfirm && (
                    <p style={{ fontSize:11, color:C.red, marginTop:5 }}>비밀번호가 일치하지 않습니다.</p>
                  )}
                  {pwConfirm && pwNew === pwConfirm && pwNew.length >= 8 && (
                    <p style={{ fontSize:11, color:C.teal, marginTop:5 }}>비밀번호가 일치합니다.</p>
                  )}
                </div>
              </>
            )}

            {error && (
              <p style={{ fontSize:12, color:C.red, marginBottom:14, textAlign:"center" }}>{error}</p>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose} style={{ flex:1, padding:"12px", borderRadius:10, border:`1px solid ${C.border}`, background:C.white, color:C.textSub, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>취소</button>
              <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:"12px", borderRadius:10, border:"none", background:saving?C.textMuted:C.navy, color:C.white, fontSize:14, fontWeight:700, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit" }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════ 메인 ══════════════ */
export default function MenteeMyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const [activeTab, setActiveTab] = useState("all");
  const [profile, setProfile]     = useState(null);
  const [apiSessions, setApiSessions] = useState([]);
  const [showEdit, setShowEdit]   = useState(false);

  useEffect(() => {
    getMyProfile().then(setProfile).catch(() => {});
    getUserSessions().then(data => { if (data?.length) setApiSessions(data); }).catch(() => {});
  }, []);

  /* API 세션 → historyAll 파생 (없으면 더미 사용) */
  const historyAll = apiSessions.length > 0
    ? apiSessions.map((s, i, arr) => ({
        id: s.id,
        num: arr.length - i,
        title: s.title ?? "",
        wpm: s.wpm ?? 0,
        wpmLevel: s.wpmLevel ?? "양호",
        star: s.star ?? "-",
        ai: s.aiScore ?? 0,
        silence: s.silence ?? null,
        mentor: s.mentorName ?? "",
        date: s.scheduledAt?.slice(0, 10).replace(/-/g, ".") ?? "",
        type: s.sessionType ?? "1:1",
        hasAudio: !!s.reportStatus,
      }))
    : DUMMY_HISTORY;

  const displayName = profile?.name ?? userName;

  const handleWithdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      await fetch("/api/auth/withdraw", {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${user?.accessToken}` },
      });
    } catch {}
    clearAuthUser();
    navigate("/");
  };

  const historyUnread = historyAll.slice(0, 1);

  const growthData = [
    { label:"STAR 구조화",    value:75, change:28, color:C.teal },
    { label:"말하기 안정성",   value:80, change:31, color:C.teal },
    { label:"논리적 답변",     value:65, change:19, color:"#185FA5" },
    { label:"문장 간결성",     value:60, change:14, color:C.orange },
    { label:"반응 속도",       value:70, change:22, color:C.teal },
    { label:"직무 역량 커버리지",value:40, change:-5, color:C.red },
  ];

  const comments = [
    { initials:"박J", name:"박지훈 멘토", bg:"#1B4F7A", date:"04.02",
      session:"5회차 · 백엔드 개발자 모의 면접",
      text:"수치 기반 답변이 훨씬 자연스러워졌어요. 이제 MSA처럼 경험 없는 영역은 학습 의지를 보여주는 방향으로 연습하면 다음 면접 충분히 통과할 수 있을 것 같아요." },
    { initials:"이S", name:"이수연 멘토", bg:"#0F6E56", date:"03.20",
      session:"4회차 · 프론트엔드 그룹 면접 연습",
      text:"STAR 구조가 많이 잡혔어요! Result 부분을 항상 수치나 구체적 성과로 마무리하는 습관만 들이면 완벽할 것 같습니다." },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @media(max-width:900px){.mypage-layout{flex-direction:column!important}.mypage-sidebar{width:100%!important}}
        @media(max-width:600px){.stat-grid{grid-template-columns:1fr 1fr!important}.growth-grid{grid-template-columns:1fr!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 5% 60px" }}>

        {/* 페이지 타이틀 */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color:C.text, letterSpacing:"-0.02em", marginBottom:4 }}>마이페이지</h1>
            <p style={{ fontSize:13, color:C.textMuted }}>나의 면접 성장 기록을 확인하세요</p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => setShowEdit(true)} style={{
              padding:"10px 18px",
              background:C.white, color:C.text,
              border:`1.5px solid ${C.border}`, borderRadius:8,
              fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
              transition:"border-color 0.15s",
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >프로필 수정</button>
            <button onClick={handleWithdraw} style={{
              padding:"10px 18px",
              background:C.white, color:C.red,
              border:`1.5px solid ${C.border}`, borderRadius:8,
              fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
              transition:"border-color 0.15s",
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.red}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >회원탈퇴</button>
          </div>
        </div>

        <div className="mypage-layout" style={{ display:"flex", gap:24, alignItems:"flex-start" }}>

          {/* ── 사이드바 ── */}
          <div className="mypage-sidebar" style={{ width:210, flexShrink:0 }}>
            <div style={{ background:C.white, borderRadius:16, padding:"24px 20px", border:`1px solid ${C.border}` }}>
              {/* 아바타 */}
              <div style={{ textAlign:"center", marginBottom:16 }}>
                {(() => { const av = getAvatar(user?.email); return (
                <div style={{
                  width:68, height:68, borderRadius:"50%",
                  background:av.color, margin:"0 auto 10px",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:32,
                }}>{av.animal}</div>
                ); })()}
                <p style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:2 }}>{displayName}</p>
                <p style={{ fontSize:12, color:C.textSub }}>백엔드 개발자 지망 · 신입</p>
              </div>

              {/* 목표 기업 */}
              <div style={{ background:C.bg, borderRadius:10, padding:"10px 12px", marginBottom:14 }}>
                <p style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>목표 직무 & 기업</p>
                <p style={{ fontSize:13, fontWeight:700, color:C.navy }}>백엔드 개발자</p>
                <p style={{ fontSize:11, color:C.textSub, marginTop:2 }}>카카오 · 네이버 · 라인</p>
              </div>

              {/* 스탯 리스트 */}
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
                {[
                  {l:"총 세션",    v:"5회"},
                  {l:"평균 AI 점수", v:"3.8 → 4.4"},
                  {l:"최근 WPM",   v:"118 WPM"},
                  {l:"STAR 달성률", v:"92%"},
                  {l:"보유 포인트", v:"320 P"},
                ].map((r,i)=>(
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:i<4?`1px solid ${C.border}`:"none" }}>
                    <span style={{ fontSize:12, color:C.textMuted }}>{r.l}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:C.navy }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 메인 콘텐츠 ── */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:20 }}>

            {/* 스탯 4개 */}
            <div className="stat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <ChangeStatCard label="총 면접 횟수" after="5회" unit="누적"/>
              <ChangeStatCard label="AI 종합점수 변화" before="3.8" after="4.4" note="+0.6 성장"/>
              <ChangeStatCard label="평균 WPM 변화" before="162" after="118" note="안정화됨" noteColor={C.teal}/>
              <ChangeStatCard label="침묵 횟수 변화" before="7" after="2" note="Dead Air 감소" noteColor={C.teal}/>
            </div>

            {/* 역량별 성장 현황 */}
            <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}` }}>
              <div style={{ marginBottom:18 }}>
                <h3 style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:2 }}>역량별 성장 현황</h3>
                <p style={{ fontSize:12, color:C.textMuted }}>5회 면접 기준 누적 평균</p>
              </div>
              <div className="growth-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 32px" }}>
                {growthData.map((g,i)=>(
                  <GrowthBar key={i} {...g}/>
                ))}
              </div>
            </div>

            {/* 히스토리 탭 */}
            <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {/* 탭 */}
              <div style={{ display:"flex", borderBottom:`1px solid ${C.border}` }}>
                {[
                  {k:"all",    l:`전체 히스토리`, count:historyAll.length},
                  {k:"unread", l:`리포트 미확인`,  count:historyUnread.length, accent:true},
                ].map(t=>(
                  <button key={t.k} onClick={()=>setActiveTab(t.k)} style={{
                    padding:"14px 24px", background:"transparent", border:"none",
                    borderBottom:`2.5px solid ${activeTab===t.k?C.navy:"transparent"}`,
                    fontSize:14, fontWeight:activeTab===t.k?700:400,
                    color:activeTab===t.k?C.navy:C.textMuted,
                    cursor:"pointer", fontFamily:"inherit", transition:"all 0.18s",
                    display:"flex", alignItems:"center", gap:6,
                  }}>
                    {t.l}
                    <span style={{
                      fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:999,
                      background:t.accent ? (activeTab===t.k?C.red:"#FEF2F2") : (activeTab===t.k?C.navy:C.bg),
                      color:t.accent ? C.red : (activeTab===t.k?C.white:C.textMuted),
                    }}>{t.count}</span>
                  </button>
                ))}
              </div>

              {/* 히스토리 리스트 */}
              <div style={{ padding:"0 24px 8px" }}>
                {(activeTab==="all"?historyAll:historyUnread).map((h,i)=>(
                  <HistoryItem key={i} {...h}/>
                ))}
              </div>
            </div>

            {/* 자소서 관리 바로가기 */}
            <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <h3 style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:4 }}>자소서 관리</h3>
                <p style={{ fontSize:12, color:C.textMuted }}>면접 전 미리 작성해두면 멘토가 맞춤 질문을 준비합니다</p>
              </div>
              <Link to="/mentee/resume" style={{ textDecoration:"none" }}>
                <button style={{
                  padding:"10px 20px", borderRadius:8,
                  background:C.navy, color:C.white,
                  border:"none", fontSize:13, fontWeight:700,
                  cursor:"pointer", fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:6,
                  transition:"background 0.15s",
                }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.navyMid}
                  onMouseLeave={e=>e.currentTarget.style.background=C.navy}
                >
                  자소서 작성하러 가기
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </Link>
            </div>

            {/* 멘토 코멘트 모음 */}
            <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <h3 style={{ fontSize:16, fontWeight:700, color:C.text }}>멘토 코멘트 모음</h3>
                <Link to="#" style={{ fontSize:13, color:C.textMuted, textDecoration:"none" }}>전체보기 →</Link>
              </div>

              {comments.map((c,i)=>(
                <div key={i} style={{
                  background:C.bg, borderRadius:12, padding:"16px 18px",
                  marginBottom: i<comments.length-1?14:0,
                }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{
                        width:34, height:34, borderRadius:"50%",
                        background:c.bg, flexShrink:0,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:12, fontWeight:700, color:C.white,
                      }}>{c.initials}</div>
                      <p style={{ fontSize:14, fontWeight:700, color:C.text }}>{c.name}</p>
                    </div>
                    <span style={{ fontSize:12, color:C.textMuted }}>{c.date}</span>
                  </div>
                  <p style={{ fontSize:13, color:C.text, lineHeight:1.75, marginBottom:8 }}>{c.text}</p>
                  <p style={{ fontSize:11, color:C.textMuted }}>{c.session}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </main>

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
    </>
  );
}
