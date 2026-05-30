import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { requestReservation } from "../../api/reservations";
import { createSession, saveJobPosting, saveResume } from "../../api/sessions";
import useAuthStore from "../../store/authStore";
import { getAvatar } from "../../utils/avatar";
import { getMentorAvailabilities } from "../../api/users";

const C = {
  navy:"#0D2240",navyMid:"#1B4F7A",cream:"#F2EDE4",creamDark:"#E8E0D0",
  white:"#FFFFFF",teal:"#1D9E75",text:"#1A1818",textSub:"#6B6863",
  textMuted:"#9E9B95",border:"#E8E0D0",bg:"#FAF8F4",
};

const LogoIcon=({size=26,color=C.white})=>(
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="2" fill={color}/>
    {[0,45,90,135,180,225,270,315].map((deg,i)=>{const r=deg*Math.PI/180;return <line key={i} x1={14+2.5*Math.cos(r)} y1={14+2.5*Math.sin(r)} x2={14+10*Math.cos(r)} y2={14+10*Math.sin(r)} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>;})}
    {[0,90,180,270].map((deg,i)=>{const r=deg*Math.PI/180,mx=14+7*Math.cos(r),my=14+7*Math.sin(r),o=r+Math.PI/2;return <g key={i}><line x1={mx} y1={my} x2={mx+3*Math.cos(o)} y2={my+3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/><line x1={mx} y1={my} x2={mx-3*Math.cos(o)} y2={my-3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/></g>;})}
  </svg>
);

const Header=({ userName })=>(
  <header style={{background:C.navy,padding:"0 5%",position:"sticky",top:0,zIndex:100}}>
    <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
      <span style={{fontSize:15,fontWeight:600,color:C.white}}>안녕하세요 <span style={{color:"rgba(255,255,255,0.75)"}}>{userName}</span>님</span>
      <div style={{display:"flex",alignItems:"center",gap:24}}>
        {[{l:"대시보드",to:"/dashboard/mentee"},{l:"멘토 탐색",to:"/mentor/search"},{l:"MyPage",to:"/mentee/mypage"}].map((x,i)=>(
          <Link key={i} to={x.to} style={{fontSize:14,fontWeight:x.l==="MyPage"?700:400,color:C.white,textDecoration:"none",opacity:0.85}}
            onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.85}>{x.l}</Link>
        ))}
      </div>
    </nav>
  </header>
);

const groupAvailabilityByDate = (availabilities) => {
  if (!availabilities) return {};
  const grouped = {};
  for (const avail of availabilities) {
    const date = new Date(avail.start_time).toLocaleDateString('ko-KR');
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(avail);
  }
  return grouped;
};

const RESUME_DRAFT_KEY = "scena_resume_draft";

const getStoredResumeContent = () => {
  try {
    const draft = JSON.parse(localStorage.getItem(RESUME_DRAFT_KEY));
    if (!Array.isArray(draft)) return "";
    return draft
      .filter(item => item?.content?.trim())
      .map(item => `[${item.title || "자기소개서"}]\n${item.content.trim()}`)
      .join("\n\n");
  } catch {
    return "";
  }
};

export default function MentorApply(){
  const navigate=useNavigate();
  const { state: navState } = useLocation();
  const { id: mentorId } = useParams();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const mentor=navState?.mentor;
  const [sessType,setSessType]=useState("1:1");
  const [participants,setParticipants]=useState(2);
  const [selDate,setSelDate]=useState("");
  const [selAvailabilityId,setSelAvailabilityId]=useState(null);
  const [loading,setLoading]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [availabilities, setAvailabilities] = useState(mentor?.availabilities ?? []);
  const [availLoading, setAvailLoading] = useState(true);

  useEffect(() => {
    const id = mentorId || mentor?.id;
    if (!id) { setAvailLoading(false); return; }
    setAvailLoading(true);
    getMentorAvailabilities(id)
      .then(data => setAvailabilities(data))
      .catch(() => setAvailabilities(mentor?.availabilities ?? []))
      .finally(() => setAvailLoading(false));
  }, [mentorId, mentor?.id]);

  const groupedAvailabilities = groupAvailabilityByDate(availabilities);
  const availableDates = Object.keys(groupedAvailabilities).sort();
  const currentDate = selDate || availableDates[0] || "";
  const currentTimeSlots = groupedAvailabilities[currentDate] || [];
  const maxCapacity = mentor?.maxCapacity ?? 4;
  const canSubmit=selAvailabilityId!==null;
  const selectedAvailability = availabilities.find(a => a.id === selAvailabilityId);

  useEffect(() => {
    if (!selDate && availableDates.length > 0) {
      setSelDate(availableDates[0]);
    }
  }, [availableDates, selDate]);

  const handleSubmit=async()=>{
    if(!canSubmit)return;
    setLoading(true);
    try {
      const jobPosting = navState?.jobPosting;
      const resumeContent = navState?.resumeContent || getStoredResumeContent();

      if (!resumeContent.trim()) {
        setLoading(false);
        alert("면접 신청 전에 자소서를 먼저 등록해 주세요.");
        navigate("/mentee/resume");
        return;
      }

      let sessionId = null;
      let jobPostingId = null;

      try {
        const session = await createSession({
          mentor_id: mentor.id,
          job_category: jobPosting?.jobCategory || mentor.job,
        });
        sessionId = session?.id;
      } catch {}

      if (sessionId && jobPosting?.company) {
        try {
          const jp = await saveJobPosting(sessionId, {
            company: jobPosting.company,
            jobCategory: jobPosting.jobCategory || mentor.job,
            rawText: jobPosting.rawText || jobPosting.company,
          });
          jobPostingId = jp?.id;
        } catch {}
      }

      if (sessionId && resumeContent) {
        await saveResume(sessionId, resumeContent);
      }

      await requestReservation({
        mentor_id: mentor.id,
        availability_id: selAvailabilityId,
        job_posting_id: jobPostingId ?? null,
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  if(submitted)return(
    <>
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}`}</style>
      <Header userName={userName}/>
      <div style={{maxWidth:480,margin:"80px auto",textAlign:"center",padding:"0 5%"}}>
        <div style={{background:C.white,borderRadius:20,padding:"48px 40px",border:`1px solid ${C.border}`}}>
          <div style={{width:64,height:64,borderRadius:"50%",background:C.teal+"18",margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M5 14l7 7L23 7" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h2 style={{fontSize:26,fontWeight:700,color:C.text,marginBottom:10}}>신청이 완료됐어요!</h2>
          <p style={{fontSize:16,color:C.textSub,lineHeight:1.7,marginBottom:8}}><strong style={{color:C.navy}}>{mentor.name} 멘토</strong>님의 승인을 기다리고 있어요.</p>
          <p style={{fontSize:14,color:C.textMuted,marginBottom:32}}>{selectedAvailability ? new Date(selectedAvailability.start_time).toLocaleString('ko-KR') : '-'} · {sessType==="그룹"?`그룹 ${participants}인`:"1:1 집중 면접"}</p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>navigate("/mentor/search")} style={{flex:1,padding:"14px",background:C.white,color:C.text,border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:15,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>다른 멘토 보기</button>
            <button onClick={()=>navigate("/dashboard/mentee")} style={{flex:1,padding:"14px",background:C.navy,color:C.white,border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>대시보드로 이동</button>
          </div>
        </div>
      </div>
    </>
  );

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:820px){.apply-layout{flex-direction:column!important}.mentor-sticky{position:static!important}}
      `}</style>
      <Header userName={userName}/>
      <main style={{maxWidth:1100,margin:"0 auto",padding:"36px 5% 60px"}}>

        <button onClick={()=>navigate(-1)} style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:24,background:"transparent",border:"none",fontSize:15,color:C.textSub,cursor:"pointer",fontFamily:"inherit",padding:0,transition:"color 0.15s"}}
          onMouseEnter={e=>e.currentTarget.style.color=C.navy} onMouseLeave={e=>e.currentTarget.style.color=C.textSub}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          멘토 목록으로
        </button>

        <div className="apply-layout" style={{display:"flex",gap:24,alignItems:"flex-start"}}>

          {/* 왼쪽 멘토 카드 */}
          <div style={{width:300,flexShrink:0}}>
            <div className="mentor-sticky" style={{background:C.white,borderRadius:16,padding:"24px",border:`1px solid ${C.border}`,position:"sticky",top:88}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
                {mentor.profile_image_url
                  ? <img src={mentor.profile_image_url} alt={mentor.name} style={{width:52,height:52,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:`1px solid ${C.border}`}}/>
                  : <div style={{width:52,height:52,borderRadius:"50%",background:getAvatar(String(mentor.id)).color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:C.white}}>{mentor.name[0]}</div>
                }
                <div>
                  <p style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:3}}>{mentor.name} 멘토</p>
                  {mentor.nickname && <p style={{fontSize:14,color:C.textSub}}>{mentor.nickname}</p>}
                </div>
              </div>
              {mentor.tags?.length > 0 && (
                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
                  {mentor.tags.map((t,i)=><span key={i} style={{fontSize:13,padding:"4px 10px",borderRadius:999,background:C.bg,color:C.textSub}}>#{t.name}</span>)}
                </div>
              )}
              {mentor.bio && (
                <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
                  <p style={{fontSize:14,color:C.text,lineHeight:1.75}}>{mentor.bio}</p>
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 신청 폼 */}
          <div style={{flex:1}}>
            <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>

              {/* 01 세션 유형 */}
              <div style={{padding:"28px 32px",borderBottom:`1px solid ${C.border}`}}>
                <p style={{fontSize:13,fontWeight:700,color:C.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>01 세션 유형 선택</p>
                <div style={{display:"flex",gap:12}}>
                  {[{t:"1:1 집중 면접",d:"60분 · 개인 맞춤형",v:"1:1"},{t:"그룹 면접 연습",d:"60분 · 다대다 실전",v:"그룹"}].map(s=>(
                    <button key={s.v} type="button" onClick={()=>setSessType(s.v)} style={{
                      flex:1,padding:"20px 16px",textAlign:"center",
                      background:sessType===s.v?C.navy:C.white,
                      border:`1.5px solid ${sessType===s.v?C.navy:C.border}`,
                      borderRadius:12,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s",
                    }}>
                      <p style={{fontSize:17,fontWeight:700,color:sessType===s.v?C.white:C.text,marginBottom:5}}>{s.t}</p>
                      <p style={{fontSize:14,color:sessType===s.v?"rgba(255,255,255,0.65)":C.textMuted}}>{s.d}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 참여 인원 (그룹만) */}
              {sessType==="그룹"&&(
                <div style={{padding:"24px 32px",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
                    <p style={{fontSize:16,fontWeight:600,color:C.text}}>참여 인원</p>
                    <p style={{fontSize:16,fontWeight:700,color:C.navy}}>{participants}명 (본인 포함)</p>
                  </div>
                  <input type="range" min={2} max={maxCapacity} value={participants}
                    onChange={e=>setParticipants(Number(e.target.value))}
                    style={{width:"100%",accentColor:C.navy,cursor:"pointer"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                    {[2,3,4].map(n=><span key={n} style={{fontSize:13,color:n===participants?C.navy:C.textMuted,fontWeight:n===participants?700:400}}>{n}명{n===4?"(최대)":""}</span>)}
                  </div>
                </div>
              )}

              {/* 02 일시 선택 */}
              <div style={{padding:"24px 32px 20px",borderBottom:`1px solid ${C.border}`}}>
                <p style={{fontSize:13,fontWeight:700,color:C.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>02 일시 선택</p>
                {availLoading ? (
                  <p style={{fontSize:14,color:C.textMuted}}>가용 시간 불러오는 중...</p>
                ) : availableDates.length === 0 ? (
                  <p style={{fontSize:14,color:C.textMuted}}>현재 예약 가능한 시간이 없어요.</p>
                ) : (
                  <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                    {availableDates.map((date)=>(
                      <button key={date} type="button" onClick={()=>{setSelDate(date);setSelAvailabilityId(null);}} style={{
                        padding:"10px 18px",
                        background:currentDate===date?C.navy:C.bg,
                        color:currentDate===date?C.white:C.textSub,
                        border:`1px solid ${currentDate===date?C.navy:C.border}`,
                        borderRadius:8,cursor:"pointer",
                        fontSize:14,fontWeight:currentDate===date?700:400,fontFamily:"inherit",transition:"all 0.15s",
                      }}>{date}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* 시간 선택 */}
              {!availLoading && currentTimeSlots.length > 0 && (
              <div style={{padding:"20px 32px 24px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {currentTimeSlots.map(slot=>(
                    <button key={slot.id} type="button" onClick={()=>!slot.is_booked&&setSelAvailabilityId(slot.id)} style={{
                      padding:"14px 0",flex:"1 0 calc(25% - 8px)",minWidth:72,
                      background:selAvailabilityId===slot.id?"#111":C.white,
                      color:selAvailabilityId===slot.id?C.white:C.text,
                      border:`1.5px solid ${selAvailabilityId===slot.id?"#111":C.border}`,
                      borderRadius:10,cursor:slot.is_booked?"not-allowed":"pointer",
                      fontSize:16,fontWeight:selAvailabilityId===slot.id?700:400,fontFamily:"inherit",
                      transition:"all 0.18s",
                      opacity:slot.is_booked?0.4:1,
                    }} disabled={slot.is_booked}>{new Date(slot.start_time).toLocaleTimeString('ko-KR',{hour:"2-digit",minute:"2-digit"})}</button>
                  ))}
                </div>
              </div>
              )}

              {/* 포인트 + 신청 버튼 */}
              <div style={{padding:"24px 32px",background:C.bg}}>
                <div style={{marginBottom:14}}>
                {selAvailabilityId&&selectedAvailability&&(
                  <div style={{background:C.teal+"14",border:`1px solid ${C.teal}40`,borderRadius:10,padding:"12px 16px",marginBottom:14}}>
                    <p style={{fontSize:15,color:C.teal,fontWeight:600}}>✓ {new Date(selectedAvailability.start_time).toLocaleString('ko-KR')} · {sessType==="그룹"?`그룹 ${participants}인`:"1:1 집중 면접"}</p>
                  </div>
                )}
                <button onClick={canSubmit?handleSubmit:undefined} disabled={!canSubmit||loading} style={{
                  width:"100%",padding:"18px",
                  background:canSubmit?"#111":C.creamDark,
                  color:canSubmit?C.white:C.textMuted,
                  border:"none",borderRadius:12,
                  fontSize:17,fontWeight:700,cursor:canSubmit?"pointer":"not-allowed",
                  fontFamily:"inherit",transition:"background 0.18s",
                }}
                  onMouseEnter={e=>{if(canSubmit&&!loading)e.currentTarget.style.background="#222";}}
                  onMouseLeave={e=>{if(canSubmit)e.currentTarget.style.background="#111";}}>
                  {loading
                    ?<span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{animation:"spin 0.8s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        신청 중...
                      </span>
                    :selAvailabilityId?"신청 정보 입력하기":"시간을 선택해주세요"
                  }
                </button>
                {!canSubmit&&<p style={{fontSize:13,color:C.textMuted,textAlign:"center",marginTop:10}}>일시를 선택하면 신청할 수 있어요</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
