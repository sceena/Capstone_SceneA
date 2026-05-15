import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";

/* ============================================================
   멘토 마이페이지  (pages/mentor/MyPage.jsx)
   ============================================================ */

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A",
  cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75", tealLight:"#E8F5EE",
  text:"#1A1818", textSub:"#6B6863", textMuted:"#9E9B95",
  border:"#E8E0D0", bg:"#FAF8F4",
  orange:"#F59E0B", orangeLight:"#FEF3C7",
  red:"#EF4444", redLight:"#FEF2F2",
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
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님</span>
        <Link to="/" style={{ textDecoration:"none" }}><LogoIcon size={28}/></Link>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{l:"대시보드",to:"/dashboard/mentor"},{l:"예약 확인",to:"#"},{l:"MyPage",to:"/mentor/mypage",bold:true}].map((x,i)=>(
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

/* ── 스탯 카드 ── */
const StatCard = ({ label, value, sub, subColor, accent }) => (
  <div style={{ background:C.white, borderRadius:14, padding:"18px 20px", border:`1px solid ${C.border}`, flex:1, minWidth:0 }}>
    <p style={{ fontSize:12, color:C.textMuted, marginBottom:8 }}>{label}</p>
    <p style={{ fontSize:26, fontWeight:700, color:C.navy, letterSpacing:"-0.03em", marginBottom:4 }}>{value}</p>
    {sub && <p style={{ fontSize:12, color:subColor||C.textMuted }}>{sub}</p>}
  </div>
);

/* ── 세션 요청 아이템 ── */
const SessionRequestItem = ({ date, time, title, detail, onAccept }) => (
  <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
    <div style={{ width:8, height:8, borderRadius:"50%", background:C.orange, flexShrink:0 }}/>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ fontSize:13, color:C.textMuted, marginBottom:2 }}>{date} {time}</p>
      <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:2 }}>{title}</p>
      <p style={{ fontSize:12, color:C.textMuted }}>{detail}</p>
    </div>
    <button onClick={onAccept} style={{
      padding:"7px 16px", background:C.navy, color:C.white,
      border:"none", borderRadius:20, fontSize:12, fontWeight:600,
      cursor:"pointer", fontFamily:"inherit", flexShrink:0,
      transition:"background 0.18s",
    }}
      onMouseEnter={e=>e.currentTarget.style.background=C.navyMid}
      onMouseLeave={e=>e.currentTarget.style.background=C.navy}
    >수락하기</button>
  </div>
);

/* ── 리뷰 카드 ── */
const ReviewCard = ({ initials, name, role, company, stars, text, bgColor }) => (
  <div style={{ marginBottom:20 }}>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:"50%", background:bgColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:C.white, flexShrink:0 }}>{initials}</div>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:C.text }}>{name}</p>
          <p style={{ fontSize:12, color:C.textMuted }}>{role} · {company}</p>
        </div>
      </div>
      <div style={{ display:"flex", gap:2 }}>
        {"★★★★★".split("").map((s,i)=>(
          <span key={i} style={{ fontSize:13, color:i<stars?"#F59E0B":"#D1CFC9" }}>★</span>
        ))}
      </div>
    </div>
    <p style={{ fontSize:13, color:C.textSub, lineHeight:1.75 }}>{text}</p>
  </div>
);

/* ══════════════ 메인 ══════════════ */
export default function MentorMyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.email?.split("@")[0] || "사용자";
  const [activeTab, setActiveTab] = useState("pending");

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
  const [requests, setRequests] = useState([
    { id:1, date:"04.02", time:"19:00", title:"김민준 — 백엔드 개발자 모의 면접", detail:"1:1 · 60분 · 50P · 수락 기한 18시간 32분 남음" },
    { id:2, date:"04.07", time:"20:00", title:"박서연 외 2명 — 프론트엔드 그룹 면접", detail:"그룹 3인 · 60분 · 150P · 수락 기한 6시간 14분 남음" },
    { id:3, date:"04.10", time:"19:00", title:"최현아 — 풀스택 기술 면접", detail:"1:1 · 60분 · 50P · 수락 기한 22시간 5분 남음" },
  ]);
  const confirmed = [
    { id:4, date:"04.12", time:"14:00", title:"이준석 — PM 직군 인성 면접", detail:"1:1 · 60분 · 50P" },
    { id:5, date:"04.15", time:"19:00", title:"한기욱 — 인프라 기술 면접", detail:"1:1 · 60분 · 50P" },
  ];
  const completed = Array.from({length:5},(_,i)=>({ id:i+10, date:`03.${String(i+1).padStart(2,"0")}`, time:"19:00", title:`완료된 세션 ${i+1}`, detail:"1:1 · 60분" }));

  const handleAccept = (id) => setRequests(r=>r.filter(x=>x.id!==id));

  const tabData = { pending: requests, confirmed, completed };
  const tabList = [
    { key:"pending",   label:"대기중",  count:requests.length, color:C.orange },
    { key:"confirmed", label:"확정",    count:confirmed.length },
    { key:"completed", label:"완료",    count:37 },
  ];

  const reviews = [
    { initials:"김M", name:"김민준", role:"백엔드", company:"카카오 지원", stars:5, bgColor:"#1B4F7A",
      text:"실제 현장에서 어떤 답변을 원하는지 구체적으로 알려주셔서 너무 좋았어요. STAR 구조 피드백 덕분에 다음 면접에서 훨씬 자신감 있게 답변할 수 있었습니다!" },
    { initials:"박S", name:"박서연", role:"프론트엔드", company:"네이버 지원", stars:4, bgColor:"#0F6E56",
      text:"AI 리포트로 제 약점을 정확히 파악하고, 멘토님이 그 부분을 집중 코칭해주셔서 단기간에 많이 성장한 느낌이에요. 강력 추천합니다." },
    { initials:"이J", name:"이준석", role:"백엔드", company:"라인 지원", stars:4, bgColor:"#533BA0",
      text:"기술 면접 준비에 정말 큰 도움이 됐어요. 다음 세션도 꼭 신청할 예정입니다." },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @media(max-width:900px){.mypage-layout{flex-direction:column!important}.mypage-sidebar{width:100%!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 5% 60px" }}>

        {/* 페이지 타이틀 */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color:C.text, letterSpacing:"-0.02em", marginBottom:4 }}>마이페이지</h1>
            <p style={{ fontSize:13, color:C.textMuted }}>멘토 활동 현황과 예약을 관리하세요</p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {["가능 시간 관리","프로필 수정"].map((l,i)=>(
              <button key={i} style={{
                padding:"10px 18px",
                background:C.white, color:C.text,
                border:`1.5px solid ${C.border}`, borderRadius:8,
                fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                transition:"border-color 0.15s",
              }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
              >{l}</button>
            ))}
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

          {/* ── 사이드바 프로필 ── */}
          <div className="mypage-sidebar" style={{ width:220, flexShrink:0 }}>
            <div style={{ background:C.white, borderRadius:16, padding:"24px 20px", border:`1px solid ${C.border}`, marginBottom:16 }}>
              {/* 아바타 */}
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <div style={{
                  width:68, height:68, borderRadius:"50%",
                  background:"#1B4F7A", margin:"0 auto 10px",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:22, fontWeight:700, color:C.white,
                }}>이J</div>
                <p style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:2 }}>이준호</p>
                <p style={{ fontSize:12, color:C.textSub }}>카카오 · 백엔드 개발 5년</p>
              </div>

              {/* 태그 */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, justifyContent:"center", marginBottom:16 }}>
                {["기술 면접","인성 면접","포트폴리오"].map((t,i)=>(
                  <span key={i} style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:C.bg, color:C.textSub }}>{t}</span>
                ))}
              </div>

              {/* 미니 스탯 */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18, padding:"12px 0", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                {[{n:"42",l:"총 멘티"},{n:"4.9",l:"평균평점"},{n:"7",l:"이번달"}].map((s,i)=>(
                  <div key={i} style={{ textAlign:"center" }}>
                    <p style={{ fontSize:16, fontWeight:700, color:C.navy }}>{s.n}</p>
                    <p style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{s.l}</p>
                  </div>
                ))}
              </div>

              {/* 상세 정보 */}
              {[{l:"소속",v:"카카오"},{l:"직무",v:"백엔드 개발"},{l:"경력",v:"5년"},{l:"최대 인원",v:"최대 3인"},{l:"세션 길이",v:"60분"},{l:"포인트",v:"50P / 세션"}].map((r,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:i<5?`1px solid ${C.border}`:"none" }}>
                  <span style={{ fontSize:12, color:C.textMuted }}>{r.l}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:C.text }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 메인 콘텐츠 ── */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:20 }}>

            {/* 스탯 4개 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              <StatCard label="총 세션" value="42회" sub="누적"/>
              <StatCard label="이번 달 세션" value="7회" sub="전월 대비 +2" subColor={C.teal}/>
              <StatCard label="평균 평점" value="4.9/5" sub="리뷰 38건"/>
              <StatCard label="대기 중 요청" value="3건" sub="수락 기한 임박 1건" subColor={C.orange}/>
            </div>

            {/* 수익 카드 */}
            <div style={{ background:C.white, borderRadius:16, padding:"20px 24px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                <div>
                  <p style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>이번 달 수익</p>
                  <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.02em", marginBottom:4 }}>350 P</p>
                  <p style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>세션 7회 × 50P</p>
                  <p style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>정산 상태</p>
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:999, background:C.tealLight, color:C.teal }}>정산 예정</span>
                  <p style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>지난 달 완료</p>
                </div>
                <div style={{ borderLeft:`1px solid ${C.border}`, paddingLeft:16 }}>
                  <p style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>누적 수익</p>
                  <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.02em", marginBottom:4 }}>2,100 P</p>
                  <p style={{ fontSize:11, color:C.textMuted }}>총 42회 누적</p>
                </div>
                <div style={{ borderLeft:`1px solid ${C.border}`, paddingLeft:16 }}>
                  <p style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>정산 예정일</p>
                  <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.02em", marginBottom:4 }}>04월 30일</p>
                  <p style={{ fontSize:11, color:C.orange, fontWeight:600 }}>D-3</p>
                </div>
              </div>
            </div>

            {/* 피드백 미작성 알림 */}
            <div style={{
              background:"#FFF8F0", border:`1.5px solid ${C.orange}40`,
              borderRadius:12, padding:"14px 20px",
              display:"flex", alignItems:"center", justifyContent:"space-between", gap:16,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:C.red, flexShrink:0 }}/>
                <p style={{ fontSize:13, color:C.text, fontWeight:500 }}>
                  완료된 세션 중 <strong style={{ color:C.red }}>피드백 미작성 2건</strong>이 있어요. 멘티가 최종 리포트를 기다리고 있어요!
                </p>
              </div>
              <button style={{
                padding:"8px 16px", background:C.white, color:C.navy,
                border:`1.5px solid ${C.border}`, borderRadius:8,
                fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0,
                transition:"border-color 0.15s",
              }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
              >바로 작성하기</button>
            </div>

            {/* 요청 탭 */}
            <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {/* 탭 헤더 */}
              <div style={{ display:"flex", borderBottom:`1px solid ${C.border}` }}>
                {tabList.map(t=>(
                  <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{
                    flex:1, padding:"14px 0", background:"transparent", border:"none",
                    borderBottom:`2.5px solid ${activeTab===t.key?C.navy:"transparent"}`,
                    fontSize:14, fontWeight:activeTab===t.key?700:400,
                    color:activeTab===t.key?C.navy:C.textMuted,
                    cursor:"pointer", fontFamily:"inherit", transition:"all 0.18s",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  }}>
                    {t.label}
                    <span style={{
                      fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:999,
                      background:activeTab===t.key?C.navy:C.bg,
                      color:activeTab===t.key?C.white:C.textMuted,
                    }}>{t.count}</span>
                  </button>
                ))}
              </div>

              {/* 탭 콘텐츠 */}
              <div style={{ padding:"4px 24px 8px" }}>
                {activeTab==="pending" && requests.length>0 ? (
                  requests.map(r=>(
                    <SessionRequestItem key={r.id} date={r.date} time={r.time} title={r.title} detail={r.detail} onAccept={()=>handleAccept(r.id)}/>
                  ))
                ) : activeTab==="confirmed" ? (
                  confirmed.map(r=>(
                    <div key={r.id} style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ width:8, height:8, borderRadius:"50%", background:C.teal, flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:13, color:C.textMuted, marginBottom:2 }}>{r.date} {r.time}</p>
                        <p style={{ fontSize:14, fontWeight:600, color:C.text }}>{r.title}</p>
                        <p style={{ fontSize:12, color:C.textMuted }}>{r.detail}</p>
                      </div>
                      <span style={{ fontSize:11, padding:"4px 10px", borderRadius:999, background:C.tealLight, color:C.teal, fontWeight:600 }}>확정</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding:"20px 0", textAlign:"center", color:C.textMuted, fontSize:13 }}>
                    총 37개의 완료된 세션이 있습니다
                  </div>
                )}
                {activeTab==="pending" && requests.length===0 && (
                  <div style={{ padding:"32px 0", textAlign:"center", color:C.textMuted, fontSize:13 }}>대기 중인 요청이 없습니다</div>
                )}
              </div>
            </div>

            {/* 최근 멘티 리뷰 */}
            <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <h3 style={{ fontSize:16, fontWeight:700, color:C.text }}>최근 멘티 리뷰</h3>
                <Link to="#" style={{ fontSize:13, color:C.textMuted, textDecoration:"none" }}>전체보기 →</Link>
              </div>
              {reviews.map((r,i)=>(
                <div key={i}>
                  <ReviewCard {...r}/>
                  {i<reviews.length-1&&<div style={{ borderBottom:`1px solid ${C.border}`, marginBottom:20 }}/>}
                </div>
              ))}
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
