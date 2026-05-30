import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import { getMentorAvailabilities, requestReservation } from "../../api/reservations";
import useAuthStore from "../../store/authStore";

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

const MENTOR={
  id:1,name:"박지훈",company:"네이버",job:"백엔드 개발",years:6,
  tags:["기술 면접","JAVA/Spring","대규모 보안 처리 경험"],
  avatarColor:"#1B4F7A",
  philosophy:'"단순한 정답 공유가 아닌, 현업에서 통하는 사고방식을 길러드립니다. AI 리포트의 수치를 토대로 논리적 결함을 함께 찾아봐요."',
  career:["현) 네이버 서치 CIC / 시니어 백엔드 엔지니어 (6년차)","전) 카카오페이 결제 시스템 개발팀","전) 쿠팡 정산 플랫폼 파트"],
  techStack:"백엔드 개발 (Java, Spring Boot, MSA, MySQL)",
  focusItems:["기술 면접: CS 기초 및 프로젝트 Deep-Dive (꼬리 질문 대비)","인성 면접: STAR 기법을 활용한 경험 구조화","AI 리포트 피드백: 발화 습관 교정 및 답변 논리성 보완"],
  point:50,
  availableDates:[
    {date:"4월 2일 목요일",times:["18:00","19:00","20:00","21:00"]},
    {date:"4월 5일 일요일",times:["14:00","15:00","19:00","20:00"]},
    {date:"4월 7일 화요일",times:["19:00","20:00","21:00"]},
  ],
  maxCapacity:4,
};

const RESUME_DRAFT_KEY = "scena_resume_draft";
const getResumeDraftKey = (user) => `${RESUME_DRAFT_KEY}:${user?.email || user?.id || user?.memberId || "anonymous"}`;

const getStoredResumeContent = (user) => {
  try {
    const draft = JSON.parse(localStorage.getItem(getResumeDraftKey(user)));
    if (!Array.isArray(draft)) return "";
    return draft
      .filter(item => item?.content?.trim())
      .map(item => `[${item.title || "자기소개서"}]\n${item.content.trim()}`)
      .join("\n\n");
  } catch {
    return "";
  }
};

const formatDateLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
};

const formatTimeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const buildAvailabilityDates = (items) => {
  const groups = new Map();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  items
    .filter(item => {
      const startTime = item.start_time ?? item.startTime;
      const startDate = new Date(startTime);
      return !item.is_booked && !item.isBooked && !Number.isNaN(startDate.getTime()) && startDate >= tomorrow;
    })
    .sort((a, b) => String(a.start_time ?? a.startTime).localeCompare(String(b.start_time ?? b.startTime)))
    .forEach(item => {
      const startTime = item.start_time ?? item.startTime;
      const key = String(startTime).slice(0, 10);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          date: formatDateLabel(startTime),
          times: [],
        });
      }
      groups.get(key).times.push({
        id: item.id,
        time: formatTimeLabel(startTime),
        startTime,
        endTime: item.end_time ?? item.endTime,
      });
    });
  return Array.from(groups.values());
};

export default function MentorApply(){
  const navigate=useNavigate();
  const { id: mentorIdParam } = useParams();
  const { state: navState } = useLocation();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const mentorFromState = navState?.mentor ?? {};
  const selectedMentorId = Number(mentorIdParam || mentorFromState.id || MENTOR.id);
  const mentor={
    ...MENTOR,
    ...mentorFromState,
    id: selectedMentorId,
    company: mentorFromState.company ?? MENTOR.company,
    job: mentorFromState.job ?? mentorFromState.bio ?? MENTOR.job,
    years: mentorFromState.years ?? MENTOR.years,
    tags: mentorFromState.tags?.map(tag => tag.name ?? tag) ?? MENTOR.tags,
  };
  const [sessType,setSessType]=useState("1:1");
  const [participants,setParticipants]=useState(2);
  const [selDateIdx,setSelDateIdx]=useState(0);
  const [selTime,setSelTime]=useState("");
  const [availableDates,setAvailableDates]=useState([]);
  const [availabilityLoading,setAvailabilityLoading]=useState(true);
  const [availabilityError,setAvailabilityError]=useState("");
  const [loading,setLoading]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [requestNote,setRequestNote]=useState("");

  useEffect(() => {
    if (!mentor.id) return;
    setAvailabilityLoading(true);
    setAvailabilityError("");
    getMentorAvailabilities(mentor.id)
      .then(data => {
        const nextDates = buildAvailabilityDates(data);
        setAvailableDates(nextDates);
        setSelDateIdx(0);
        setSelTime("");
      })
      .catch(error => {
        setAvailableDates([]);
        setSelTime("");
        setAvailabilityError(error?.message || "예약 가능 시간을 불러오지 못했습니다.");
      })
      .finally(() => setAvailabilityLoading(false));
  }, [mentor.id]);

  const selectedDate = availableDates[selDateIdx] ?? null;
  const selectedSlot = selectedDate?.times.find(slot => String(slot.id) === String(selTime)) ?? null;
  const totalPoint=sessType==="그룹"?Math.round(mentor.point*participants*0.7):mentor.point;
  const canSubmit=Boolean(selectedSlot) && !availabilityLoading && !loading;

  const handleSubmit=async()=>{
    if(!canSubmit)return;
    setLoading(true);
    try {
      const resumeContent = navState?.resumeContent || getStoredResumeContent(user);

      if (!resumeContent.trim()) {
        setLoading(false);
        alert("면접 신청 전에 자소서를 먼저 등록해 주세요.");
        navigate("/mentee/resume");
        return;
      }

      await requestReservation({
        mentor_id: mentor.id,
        availability_id: selectedSlot.id,
      });
    } catch (error) {
      alert(error?.message || "면접 신청에 실패했습니다.");
      setLoading(false);
      return;
    }
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
          <p style={{fontSize:14,color:C.textMuted,marginBottom:32}}>{selectedDate?.date} · {selectedSlot?.time} · {sessType==="그룹"?`그룹 ${participants}인`:"1:1 집중 면접"}</p>
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
                <div style={{width:52,height:52,borderRadius:"50%",background:mentor.avatarColor,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:C.white}}>{mentor.name[0]}</div>
                <div>
                  <p style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:3}}>{mentor.name} 멘토</p>
                  <p style={{fontSize:14,color:C.textSub}}>{mentor.company} / {mentor.job} {mentor.years}년차</p>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
                {mentor.tags.map((t,i)=><span key={i} style={{fontSize:13,padding:"4px 10px",borderRadius:999,background:C.bg,color:C.textSub}}>#{t}</span>)}
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
                <p style={{fontSize:14,color:C.text,lineHeight:1.75,fontStyle:"italic",marginBottom:14}}>{mentor.philosophy}</p>
                <p style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>주요 경력 (Career):</p>
                <ul style={{paddingLeft:16,marginBottom:12}}>
                  {mentor.career.map((c,i)=><li key={i} style={{fontSize:13,color:C.textSub,lineHeight:1.7,marginBottom:3}}>{c}</li>)}
                </ul>
                <p style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:4}}>전문 직무:</p>
                <p style={{fontSize:13,color:C.textSub,marginBottom:12}}>{mentor.techStack}</p>
                <p style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>면접 집중 코칭 항목:</p>
                <ul style={{paddingLeft:16}}>
                  {mentor.focusItems.map((f,i)=><li key={i} style={{fontSize:13,color:C.textSub,lineHeight:1.7,marginBottom:3}}>{f}</li>)}
                </ul>
              </div>
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
                  <input type="range" min={2} max={mentor.maxCapacity} value={participants}
                    onChange={e=>setParticipants(Number(e.target.value))}
                    style={{width:"100%",accentColor:C.navy,cursor:"pointer"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                    {[2,3,4].map(n=><span key={n} style={{fontSize:13,color:n===participants?C.navy:C.textMuted,fontWeight:n===participants?700:400}}>{n}명{n===4?"(최대)":""}</span>)}
                  </div>
                  <p style={{fontSize:13,color:C.textMuted,marginTop:10}}>* 그룹 세션은 1인당 {Math.round(mentor.point*0.7)}P 적용</p>
                </div>
              )}

              {/* 02 일시 선택 */}
              <div style={{padding:"24px 32px 20px",borderBottom:`1px solid ${C.border}`}}>
                <p style={{fontSize:13,fontWeight:700,color:C.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>02 일시 선택 ({selectedDate?.date || "예약 가능 시간"})</p>
                {availabilityLoading && <p style={{fontSize:13,color:C.textMuted,marginBottom:16}}>예약 가능한 시간을 불러오는 중입니다...</p>}
                {availabilityError && <p style={{fontSize:13,color:"#EF4444",marginBottom:16}}>{availabilityError}</p>}
                {!availabilityLoading && !availabilityError && availableDates.length === 0 && (
                  <p style={{fontSize:13,color:C.textMuted,marginBottom:16}}>현재 예약 가능한 시간이 없습니다.</p>
                )}
                <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                  {availableDates.map((d,i)=>(
                    <button key={i} type="button" onClick={()=>{setSelDateIdx(i);setSelTime("");}} style={{
                      padding:"10px 18px",
                      background:selDateIdx===i?C.navy:C.bg,
                      color:selDateIdx===i?C.white:C.textSub,
                      border:`1px solid ${selDateIdx===i?C.navy:C.border}`,
                      borderRadius:8,cursor:"pointer",
                      fontSize:14,fontWeight:selDateIdx===i?700:400,fontFamily:"inherit",transition:"all 0.15s",
                    }}>{d.date}</button>
                  ))}
                </div>
              </div>

              {/* 시간 선택 */}
              <div style={{padding:"20px 32px 24px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {(selectedDate?.times ?? []).map(t=>(
                    <button key={t.id} type="button" onClick={()=>setSelTime(t.id)} style={{
                      padding:"14px 0",flex:"1 0 calc(25% - 8px)",minWidth:72,
                      background:String(selTime)===String(t.id)?"#111":C.white,
                      color:String(selTime)===String(t.id)?C.white:C.text,
                      border:`1.5px solid ${String(selTime)===String(t.id)?"#111":C.border}`,
                      borderRadius:10,cursor:"pointer",
                      fontSize:16,fontWeight:String(selTime)===String(t.id)?700:400,fontFamily:"inherit",
                      transition:"all 0.18s",
                    }}>{t.time}</button>
                  ))}
                </div>
              </div>

              {/* 03 멘토에게 전달할 내용 */}
              <div style={{padding:"24px 32px",borderBottom:`1px solid ${C.border}`}}>
                <p style={{fontSize:13,fontWeight:700,color:C.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:10}}>03 멘토에게 전달할 내용</p>
                <textarea
                  value={requestNote}
                  onChange={e=>setRequestNote(e.target.value)}
                  rows={4}
                  placeholder={"현재 준비 상황, 걱정되는 부분, 멘토에게 받고 싶은 피드백을 적어주세요.\n예: 프로젝트 꼬리질문 대비가 필요하고, 백엔드 장애 대응 경험 답변을 점검받고 싶어요."}
                  style={{
                    width:"100%",resize:"vertical",border:`1.5px solid ${C.border}`,borderRadius:10,
                    padding:"13px 14px",fontSize:14,lineHeight:1.7,fontFamily:"inherit",outline:"none",
                    background:C.white,color:C.text,
                  }}
                  onFocus={e=>e.currentTarget.style.borderColor=C.navy}
                  onBlur={e=>e.currentTarget.style.borderColor=C.border}
                />
                <p style={{fontSize:12,color:C.textMuted,marginTop:8}}>
                  이 내용은 자소서 정보와 함께 저장되어 멘토의 사전 질문 준비에 활용됩니다.
                </p>
              </div>

              {/* 포인트 + 신청 버튼 */}
              <div style={{padding:"24px 32px",background:C.bg}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <span style={{fontSize:16,color:C.textSub}}>최종 차감 포인트</span>
                  <span style={{fontSize:32,fontWeight:700,color:C.navy,letterSpacing:"-0.03em"}}>{totalPoint} <span style={{fontSize:18}}>P</span></span>
                </div>
                {selectedSlot&&(
                  <div style={{background:C.teal+"14",border:`1px solid ${C.teal}40`,borderRadius:10,padding:"12px 16px",marginBottom:14}}>
                    <p style={{fontSize:15,color:C.teal,fontWeight:600}}>✓ {selectedDate?.date} · {selectedSlot.time} · {sessType==="그룹"?`그룹 ${participants}인`:"1:1 집중 면접"}</p>
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
                    :selectedSlot?"신청 정보 입력하기":"시간을 선택해주세요"
                  }
                </button>
                {!canSubmit&&<p style={{fontSize:13,color:C.textMuted,textAlign:"center",marginTop:10}}>날짜와 시간을 선택하면 신청할 수 있어요</p>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
