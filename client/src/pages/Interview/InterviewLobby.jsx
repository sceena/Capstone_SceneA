import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSession, joinSession, updateSessionStatus } from "../../api/sessions";

/* ============================================================
   면접 준비 화면  (pages/interview/InterviewReady.jsx)
   - 전체 배경: 완전 검정
   - 좌: 카메라·마이크 테스트
   - 우: 세션 브리핑 + 입장하기 버튼
   - role prop: "mentee" | "mentor"
   ============================================================ */

export default function InterviewRobby({ role = "mentee" }) {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const videoRef  = useRef(null);

  const [micOn,  setMicOn]  = useState(true);
  const [camOn,  setCamOn]  = useState(true);
  const [stream, setStream] = useState(null);
  const [camStatus, setCamStatus] = useState("idle"); // idle | loading | ok | denied
  const [entering, setEntering] = useState(false);
  const [checklist, setChecklist] = useState([false, false, false]);
  const [sessionData, setSessionData] = useState(null);

  /* 세션 정보 로드 */
  useEffect(() => {
    getSession(id).then(setSessionData).catch(() => {});
  }, [id]);

  /* 카메라 미리보기 */
  useEffect(() => {
    if(!camOn) { if(stream){stream.getTracks().forEach(t=>t.stop());setStream(null);} return; }
    setCamStatus("loading");
    navigator.mediaDevices?.getUserMedia({ video:true, audio:micOn })
      .then(s => {
        setStream(s);
        if(videoRef.current) videoRef.current.srcObject = s;
        setCamStatus("ok");
      })
      .catch(() => setCamStatus("denied"));
    return () => { stream?.getTracks().forEach(t=>t.stop()); };
  }, [camOn]);

  const handleEnter = async () => {
    setEntering(true);
    try {
      await joinSession(id);
      if (role === "mentor") await updateSessionStatus(id, "in_progress");
    } catch {}
    stream?.getTracks().forEach(t => t.stop());
    navigate(role === "mentor" ? `/interview/mentor/${id}` : `/interview/mentee/${id}`);
  };

  /* API 데이터 우선, 없으면 fallback */
  const session = {
    title:       sessionData?.title       ?? "세션 로딩 중...",
    date:        sessionData?.scheduledAt ?? "",
    type:        sessionData?.sessionType ?? "1:1 개인 세션",
    menteeName:  sessionData?.menteeName  ?? "",
    menteeInfo:  sessionData?.menteeInfo  ?? "",
    menteeGoal:  sessionData?.menteeGoal  ?? "",
    aiReport:    sessionData?.aiReport    ?? "",
    mentorName:  sessionData?.mentorName  ?? "",
    mentorInfo:  sessionData?.mentorInfo  ?? "",
  };

  const isMentor = role === "mentor";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;margin:0;overflow:hidden}
        #root{height:100%;width:100%;max-width:100%;margin:0;min-height:0;display:block;text-align:left}
        body{font-family:'Noto Sans KR',sans-serif;background:#F2EDE4;color:white}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        @media(max-width:820px){.ready-layout{flex-direction:column!important}.ready-left,.ready-right{width:100%!important}}
      `}</style>

      <div style={{
        width:"100%", height:"100vh",
        background:"#F2EDE4",
        display:"flex", flexDirection:"column",
        alignItems:"stretch",
        padding:"32px",
        overflow:"hidden", boxSizing:"border-box",
      }}>
        <div className="ready-layout" style={{
          display:"flex", gap:0,
          width:"100%", height:"100%",
          borderRadius:20, overflow:"hidden",
          background:"#0D2240",
          boxShadow:"0 24px 64px rgba(13,34,68,0.25)",
        }}>

          {/* ════ 왼쪽: 카메라 영역 ════ */}
          <div className="ready-left" style={{
            flex:1, background:"#0a1628",
            display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            padding:"36px 28px", gap:24,
            position:"relative",
          }}>
            {/* 카메라 프리뷰 */}
            <div style={{
              width:"100%", maxWidth:460,
              aspectRatio:"4/3",
              background:"#0d1f3c",
              borderRadius:12, overflow:"hidden",
              position:"relative",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {camOn && camStatus==="ok"
                ? <video ref={videoRef} autoPlay muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)" }}/>
                : (
                  <div style={{ textAlign:"center" }}>
                    <div style={{
                      width:72, height:72, borderRadius:"50%",
                      background:"#1a3060", margin:"0 auto 12px",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      {camStatus==="loading"
                        ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" style={{animation:"spin 1s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        : <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="11" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/><path d="M5 24c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      }
                    </div>
                    <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                      {camStatus==="denied" ? "카메라 권한이 거부됐어요" : camOn ? "카메라 연결 중..." : "카메라가 꺼져 있어요"}
                    </p>
                  </div>
                )
              }

              {/* 이름 레이블 */}
              <div style={{
                position:"absolute", bottom:12, left:12,
                background:"rgba(0,0,0,0.6)", borderRadius:6,
                padding:"4px 10px",
              }}>
                <span style={{ fontSize:12, color:C_white, fontWeight:500 }}>
                  {isMentor ? session.mentorName : session.menteeName} (나)
                </span>
              </div>
            </div>

            {/* 컨트롤 버튼 */}
            <div style={{ display:"flex", gap:14 }}>
              {[
                {
                  active:micOn, setActive:setMicOn,
                  onIcon:<MicOnIcon/>, offIcon:<MicOffIcon/>, label: micOn?"마이크 ON":"마이크 OFF",
                },
                {
                  active:camOn, setActive:setCamOn,
                  onIcon:<CamOnIcon/>, offIcon:<CamOffIcon/>, label: camOn?"카메라 ON":"카메라 OFF",
                },
                {
                  active:true, setActive:()=>{},
                  onIcon:<SettingIcon/>, offIcon:<SettingIcon/>, label:"설정",
                },
              ].map((btn,i)=>(
                <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                  <button onClick={()=>btn.setActive(v=>!v)} style={{
                    width:48, height:48, borderRadius:"50%",
                    background: btn.active ? "#333" : "#555",
                    border:`1px solid ${btn.active?"#444":"rgba(239,68,68,0.5)"}`,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 0.18s",
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background="#444"}
                    onMouseLeave={e=>e.currentTarget.style.background=btn.active?"#333":"#555"}
                  >
                    {btn.active ? btn.onIcon : btn.offIcon}
                  </button>
                  <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)" }}>{btn.label}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize:12, color:"rgba(255,255,255,0.3)", textAlign:"center" }}>
              입장 전 장치 설정을 확인해주세요
            </p>
          </div>

          {/* ════ 오른쪽: 브리핑 ════ */}
          <div className="ready-right" style={{
            width:420, flexShrink:0,
            background:"#0D2240",
            padding:"36px 32px",
            display:"flex", flexDirection:"column", gap:20,
            borderLeft:"1px solid rgba(255,255,255,0.08)",
            overflowY:"auto",
          }}>
            {/* 세션 정보 */}
            <div>
              <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.15em", color:"rgba(255,255,255,0.4)", textTransform:"uppercase", marginBottom:10 }}>
                SESSION BRIEFING
              </p>
              <h2 style={{ fontSize:20, fontWeight:700, color:"#fff", marginBottom:6, letterSpacing:"-0.02em" }}>
                {session.title}
              </h2>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.45)" }}>
                {session.date} · {session.type}
              </p>
            </div>

            {/* 상대방 정보 */}
            <div style={{
              background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"16px",
              border:"1px solid rgba(255,255,255,0.1)",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <div style={{
                  width:36, height:36, borderRadius:"50%",
                  background: isMentor ? "#1B4F7A" : "#0F6E56",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:700, color:"#fff", flexShrink:0,
                }}>
                  {isMentor ? session.menteeName[0] : session.mentorName[0]}
                </div>
                <div>
                  <p style={{ fontSize:14, fontWeight:700, color:"#fff" }}>
                    {isMentor ? `${session.menteeName} 멘티` : `${session.mentorName} 멘토`}
                  </p>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>
                    {isMentor ? session.menteeInfo : session.mentorInfo}
                  </p>
                </div>
              </div>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:1.7, fontStyle:"italic" }}>
                {isMentor ? session.menteeGoal : `"${session.mentorInfo} 멘토님과 함께하는 1:1 모의 면접입니다."`}
              </p>
            </div>

            {/* AI 사전 분석 리포트 */}
            <div style={{
              background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"16px",
              border:"1px solid rgba(255,255,255,0.1)",
            }}>
              <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"rgba(255,255,255,0.4)", textTransform:"uppercase", marginBottom:8 }}>
                AI 사전 분석 리포트
              </p>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.75 }}>
                {session.aiReport}
              </p>
            </div>

            {/* 체크리스트 (멘토만) */}
            {isMentor && (
              <div style={{
                background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px",
                border:"1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:10 }}>입장 전 체크</p>
                {[
                  "자기소개서 및 이력서 검토 완료",
                  "AI 추천 질문 확인",
                  "카메라·마이크 정상 작동",
                ].map((item,i)=>(
                  <label key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, cursor:"pointer" }}>
                    <input type="checkbox" checked={checklist[i]} onChange={()=>setChecklist(prev=>prev.map((v,j)=>j===i?!v:v))}
                      style={{ accentColor:C_teal, width:14, height:14 }}/>
                    <span style={{ fontSize:12, color:checklist[i]?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.45)", textDecoration:checklist[i]?"line-through":"none" }}>{item}</span>
                  </label>
                ))}
              </div>
            )}

            {/* 여백 채우기 */}
            <div style={{ flex:1 }}/>

            {/* 입장 버튼 */}
            <button onClick={handleEnter} style={{
              width:"100%", padding:"16px",
              background:"#F2EDE4", color:"#0D2240",
              border:"none", borderRadius:12,
              fontSize:16, fontWeight:700,
              cursor:"pointer",
              fontFamily:"inherit", transition:"background 0.2s",
              letterSpacing:"0.02em",
            }}
              onMouseEnter={e=>e.currentTarget.style.background="#E8E0D0"}
              onMouseLeave={e=>e.currentTarget.style.background="#F2EDE4"}
            >
              입장하기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 아이콘 상수 ── */
const C_white = "#FFFFFF";
const C_teal  = "#1D9E75";

const MicOnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="6" y="1" width="6" height="9" rx="3" stroke="white" strokeWidth="1.5"/>
    <path d="M3 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="9" y1="14" x2="9" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const MicOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="6" y="1" width="6" height="9" rx="3" stroke="#EF4444" strokeWidth="1.5"/>
    <path d="M3 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="1" y1="1" x2="17" y2="17" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const CamOnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="12" height="10" rx="2" stroke="white" strokeWidth="1.5"/>
    <path d="M13 7l4-2v8l-4-2V7z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const CamOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="12" height="10" rx="2" stroke="#EF4444" strokeWidth="1.5"/>
    <path d="M13 7l4-2v8l-4-2V7z" stroke="#EF4444" strokeWidth="1.5" strokeLinejoin="round"/>
    <line x1="1" y1="1" x2="17" y2="17" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const SettingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="2.5" stroke="white" strokeWidth="1.5"/>
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
