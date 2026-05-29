import { useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { requestReservation } from "../../api/reservations";
import { createSession, saveJobPosting, saveResume } from "../../api/sessions";
import useAuthStore from "../../store/authStore";
import { getAvatar } from "../../utils/avatar";

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A", cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75", text:"#1A1818", textSub:"#6B6863",
  textMuted:"#9E9B95", border:"#E8E0D0", bg:"#FAF8F4",
};

const Header = ({ userName }) => (
  <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
    <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
      <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님</span>
      <div style={{ display:"flex", alignItems:"center", gap:24 }}>
        {[{l:"대시보드",to:"/dashboard/mentee"},{l:"멘토 탐색",to:"/mentor/search"},{l:"MyPage",to:"/mentee/mypage"}].map((x,i)=>(
          <Link key={i} to={x.to} style={{ fontSize:14, fontWeight:x.l==="MyPage"?700:400, color:C.white, textDecoration:"none", opacity:0.85 }}
            onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.85}>{x.l}</Link>
        ))}
      </div>
    </nav>
  </header>
);

export default function MentorApply() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state: navState } = useLocation();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";

  const mentor = navState?.mentor;
  const av = getAvatar(mentor?.name);
  const imageUrl = mentor?.profile_image_url || mentor?.profileImageUrl;

  const [sessType, setSessType] = useState("1:1");
  const [selDate, setSelDate] = useState("");
  const [selTime, setSelTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = selDate !== "" && selTime !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const jobPosting = navState?.jobPosting;
      const resumeContent = navState?.resumeContent;
      let sessionId = null;
      let jobPostingId = null;

      try {
        const session = await createSession({
          mentor_id: Number(id),
          job_category: jobPosting?.jobCategory || "면접",
        });
        sessionId = session?.id;
      } catch {}

      if (sessionId && jobPosting?.company) {
        try {
          const jp = await saveJobPosting(sessionId, {
            company: jobPosting.company,
            jobCategory: jobPosting.jobCategory || "면접",
            rawText: jobPosting.rawText || jobPosting.company,
          });
          jobPostingId = jp?.id;
        } catch {}
      }

      if (sessionId && resumeContent) {
        try { await saveResume(sessionId, resumeContent); } catch {}
      }

      await requestReservation({
        mentor_id: Number(id),
        availability_id: 1,
        job_posting_id: jobPostingId ?? null,
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  if (!mentor) return (
    <>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}`}</style>
      <Header userName={userName}/>
      <div style={{ maxWidth:480, margin:"80px auto", textAlign:"center", padding:"0 5%" }}>
        <p style={{ fontSize:16, color:C.textSub, marginBottom:20 }}>멘토 정보를 불러올 수 없어요.</p>
        <button onClick={() => navigate("/mentor/search")} style={{ padding:"12px 28px", background:C.navy, color:C.white, border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>멘토 탐색으로</button>
      </div>
    </>
  );

  if (submitted) return (
    <>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}`}</style>
      <Header userName={userName}/>
      <div style={{ maxWidth:480, margin:"80px auto", textAlign:"center", padding:"0 5%" }}>
        <div style={{ background:C.white, borderRadius:20, padding:"48px 40px", border:`1px solid ${C.border}` }}>
          <div style={{ width:64, height:64, borderRadius:"50%", background:C.teal+"18", margin:"0 auto 20px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 14l7 7L23 7" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 style={{ fontSize:24, fontWeight:700, color:C.text, marginBottom:10 }}>신청이 완료됐어요!</h2>
          <p style={{ fontSize:15, color:C.textSub, lineHeight:1.7, marginBottom:8 }}>
            <strong style={{ color:C.navy }}>{mentor.name} 멘토</strong>님의 승인을 기다리고 있어요.
          </p>
          <p style={{ fontSize:13, color:C.textMuted, marginBottom:32 }}>{selDate} · {selTime} · {sessType === "그룹" ? "그룹 면접" : "1:1 집중 면접"}</p>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={() => navigate("/mentor/search")} style={{ flex:1, padding:"14px", background:C.white, color:C.text, border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}>다른 멘토 보기</button>
            <button onClick={() => navigate("/dashboard/mentee")} style={{ flex:1, padding:"14px", background:C.navy, color:C.white, border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>대시보드로 이동</button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:820px){.apply-layout{flex-direction:column!important}.mentor-sticky{position:static!important}}
      `}</style>
      <Header userName={userName}/>
      <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 5% 60px" }}>

        <button onClick={() => navigate(-1)} style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:24, background:"transparent", border:"none", fontSize:15, color:C.textSub, cursor:"pointer", fontFamily:"inherit", padding:0 }}
          onMouseEnter={e=>e.currentTarget.style.color=C.navy} onMouseLeave={e=>e.currentTarget.style.color=C.textSub}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          멘토 목록으로
        </button>

        <div className="apply-layout" style={{ display:"flex", gap:24, alignItems:"flex-start" }}>

          {/* 왼쪽 멘토 카드 */}
          <div style={{ width:300, flexShrink:0 }}>
            <div className="mentor-sticky" style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}`, position:"sticky", top:88 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", marginBottom:16 }}>
                {imageUrl ? (
                  <img src={imageUrl} alt={mentor.name} style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover", marginBottom:12, border:`2px solid ${C.border}` }}/>
                ) : (
                  <div style={{ width:72, height:72, borderRadius:"50%", background:av.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, marginBottom:12 }}>{av.animal}</div>
                )}
                <p style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:4 }}>{mentor.name} 멘토</p>
                {mentor.bio && <p style={{ fontSize:13, color:C.textSub, lineHeight:1.6 }}>{mentor.bio}</p>}
              </div>

              {mentor.tags?.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, justifyContent:"center", marginBottom:16 }}>
                  {mentor.tags.map((t, i) => (
                    <span key={i} style={{ fontSize:12, padding:"4px 10px", borderRadius:999, background:C.bg, color:C.textSub }}>#{t.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 신청 폼 */}
          <div style={{ flex:1 }}>
            <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>

              {/* 01 세션 유형 */}
              <div style={{ padding:"28px 32px", borderBottom:`1px solid ${C.border}` }}>
                <p style={{ fontSize:13, fontWeight:700, color:C.textMuted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:14 }}>01 세션 유형 선택</p>
                <div style={{ display:"flex", gap:12 }}>
                  {[{t:"1:1 집중 면접", d:"60분 · 개인 맞춤형", v:"1:1"}, {t:"그룹 면접 연습", d:"60분 · 다대다 실전", v:"그룹"}].map(s => (
                    <button key={s.v} type="button" onClick={() => setSessType(s.v)} style={{
                      flex:1, padding:"20px 16px", textAlign:"center",
                      background:sessType===s.v?C.navy:C.white,
                      border:`1.5px solid ${sessType===s.v?C.navy:C.border}`,
                      borderRadius:12, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s",
                    }}>
                      <p style={{ fontSize:16, fontWeight:700, color:sessType===s.v?C.white:C.text, marginBottom:4 }}>{s.t}</p>
                      <p style={{ fontSize:13, color:sessType===s.v?"rgba(255,255,255,0.65)":C.textMuted }}>{s.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 02 날짜 선택 */}
              <div style={{ padding:"24px 32px", borderBottom:`1px solid ${C.border}` }}>
                <p style={{ fontSize:13, fontWeight:700, color:C.textMuted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:14 }}>02 희망 날짜 선택</p>
                <input
                  type="date"
                  value={selDate}
                  onChange={e => setSelDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  style={{
                    width:"100%", padding:"12px 16px", borderRadius:10,
                    border:`1.5px solid ${selDate?C.navy:C.border}`,
                    fontSize:15, fontFamily:"inherit", outline:"none",
                    background:C.bg, color:C.text, cursor:"pointer",
                  }}
                />
              </div>

              {/* 03 시간 선택 */}
              <div style={{ padding:"24px 32px", borderBottom:`1px solid ${C.border}` }}>
                <p style={{ fontSize:13, fontWeight:700, color:C.textMuted, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:14 }}>03 희망 시간 선택</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                  {["09:00","10:00","11:00","14:00","14:30","15:00","16:00","19:00","20:00","21:00"].map(t => (
                    <button key={t} type="button" onClick={() => setSelTime(t)} style={{
                      padding:"12px 20px",
                      background:selTime===t?"#111":C.white,
                      color:selTime===t?C.white:C.text,
                      border:`1.5px solid ${selTime===t?"#111":C.border}`,
                      borderRadius:10, cursor:"pointer",
                      fontSize:15, fontWeight:selTime===t?700:400, fontFamily:"inherit",
                      transition:"all 0.18s",
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* 신청 버튼 */}
              <div style={{ padding:"24px 32px", background:C.bg }}>
                {canSubmit && (
                  <div style={{ background:C.teal+"14", border:`1px solid ${C.teal}40`, borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
                    <p style={{ fontSize:14, color:C.teal, fontWeight:600 }}>✓ {selDate} · {selTime} · {sessType === "그룹" ? "그룹 면접" : "1:1 집중 면접"}</p>
                  </div>
                )}
                <button onClick={canSubmit ? handleSubmit : undefined} disabled={!canSubmit || loading} style={{
                  width:"100%", padding:"18px",
                  background:canSubmit?"#111":C.creamDark,
                  color:canSubmit?C.white:C.textMuted,
                  border:"none", borderRadius:12,
                  fontSize:17, fontWeight:700, cursor:canSubmit?"pointer":"not-allowed",
                  fontFamily:"inherit", transition:"background 0.18s",
                }}>
                  {loading
                    ? <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation:"spin 0.8s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        신청 중...
                      </span>
                    : canSubmit ? "신청하기" : "날짜와 시간을 선택해주세요"
                  }
                </button>
                {!canSubmit && <p style={{ fontSize:13, color:C.textMuted, textAlign:"center", marginTop:10 }}>날짜와 시간을 선택하면 신청할 수 있어요</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
