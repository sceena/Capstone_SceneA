import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateSessionStatus, updateParticipantStatus, uploadAnswerAudio } from "../../api/sessions";
import { getAuthUser } from "../../store/authStore";

/* ============================================================
   면접 진행  (pages/interview/InterviewSession.jsx)
   role="mentee" → 일반 화상 면접 UI
   role="mentor" → 우측 AI 추천질문 + 질문 리스트 사이드패널 추가
   ============================================================ */

export default function InterviewSession({ role = "mentee" }) {
  const navigate = useNavigate();
  const { id }   = useParams();

  /* ── 타이머 ── */
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(true);
  useEffect(() => {
    if(!recording) return;
    const t = setInterval(() => setElapsed(s=>s+1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const formatTime = (s) => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return h>0
      ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
      : `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  /* ── 컨트롤 상태 ── */
  const [micOn,      setMicOn]      = useState(true);
  const [camOn,      setCamOn]      = useState(true);
  const [screenShare,setScreenShare]= useState(false);
  const [chatOpen,   setChatOpen]   = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [ending,     setEnding]     = useState(false);

  /* ── 멘토 전용: 사이드패널 ── */
  const [checkedQs,  setCheckedQs]  = useState([]);
  const [chatMsg,    setChatMsg]    = useState("");
  const [chatHistory,setChatHistory]= useState([]);

  /* ── 멘티 전용: 답변 상태 (화자 분리) + 오디오 녹음 ── */
  const [answerStatus, setAnswerStatus] = useState("idle"); // idle | answering | done
  const [currentQuestionId, setCurrentQuestionId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  /* ── 더미 참가자 ── */
  const isMentor = role === "mentor";
  const participants = [
    { name:"김민준", muted:true,  color:"#1B4F7A", speaking:false },
    { name:"이지원", muted:false, color:"#533BA0", speaking:true  },
    { name:"박현우", muted:false, color:"#0F6E56", speaking:false },
    { name:"최유나", muted:true,  color:"#8B4513", speaking:false },
  ];

  /* ── AI 추천질문 (멘토용) ── */
  const aiQuestions = [
    "분산 처리 시스템에서 데이터 일관성을 어떻게 보장하셨나요?",
    "Spring Boot에서 트랜잭션 처리 시 주의했던 경험이 있나요?",
    "대규모 트래픽 상황에서의 DB 최적화 방법을 설명해주세요.",
  ];

  const questionList = [
    { q:"세션 진행 방식과 소요 시간을 간략히 설명해주세요.", bold:"세션 진행 방식" },
    { q:"모든 것이 계획대로 되지 않을 수 있지만 괜찮습니다.", bold:"괜찮습니다" },
    { q:"지원자가 스스로의 경험과 생각을 자유롭게 말할 수 있도록 유도해주세요.", bold:"자유롭게" },
    { q:"원격 면접 시 화면 공유, 카메라·마이크 정상 여부를 확인하세요.", bold:"화면 공유, 카메라·마이크" },
  ];

  const toggleCheck = (i) => {
    setCheckedQs(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev, i]);
  };

  const handleEndCall = async () => {
    if(!window.confirm("면접을 종료하시겠습니까?")) return;
    setEnding(true);
    try {
      if (isMentor) await updateSessionStatus(id, "completed");
    } catch {}
    await new Promise(r=>setTimeout(r,800));
    navigate(`/report/ai/${id}`, { state: { role: isMentor ? "mentor" : "mentee" } });
  };

  const handleAnswerStatus = async (nextStatus) => {
    setAnswerStatus(nextStatus);
    try {
      const user = getAuthUser();
      if (user?.id) await updateParticipantStatus(id, user.id, nextStatus);
    } catch {}

    if (nextStatus === "answering") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        mediaRecorderRef.current = recorder;
        recorder.start();
      } catch {}
    } else if (nextStatus === "done" && mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (currentQuestionId) {
          uploadAnswerAudio(id, currentQuestionId, blob).catch(() => {});
        }
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
  };

  const sendChat = () => {
    if(!chatMsg.trim()) return;
    setChatHistory(prev=>[...prev, { me:true, text:chatMsg }]);
    setChatMsg("");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;margin:0}
        #root{height:100%;overflow:hidden;min-height:0;width:100%;max-width:100%;margin:0;display:block;text-align:left}
        body{font-family:'Noto Sans KR',sans-serif;background:#f5f5f5;color:#111}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px}
        .ctrl-btn:hover{background:rgba(59,130,246,0.85)!important}
        .ctrl-btn-off:hover{background:rgba(239,68,68,0.85)!important}
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#f5f5f5" }}>

        {/* ════ 상단 헤더 바 ════ */}
        <div style={{
          background:"#fff", padding:"0 20px",
          borderBottom:"1px solid #e5e7eb",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          height:64, flexShrink:0,
        }}>
          {/* 좌측 */}
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{
              width:36, height:36, borderRadius:8,
              background:"#2563EB",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="4" width="11" height="9" rx="1.5" fill="white"/>
                <path d="M12 7.5l5-2.5v8l-5-2.5V7.5z" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:"#111" }}>OOO 멘토 면접 진행</p>
              <p style={{ fontSize:11, color:"#9ca3af" }}>June 12th, 2022 | 11:00 AM</p>
            </div>
          </div>

          {/* 가운데: 참가자 아바타 */}
          <div style={{ display:"flex", alignItems:"center", gap:-8 }}>
            {participants.slice(0,4).map((p,i)=>(
              <div key={i} style={{
                width:32, height:32, borderRadius:"50%",
                background:p.color, border:"2px solid #fff",
                marginLeft: i>0?-8:0, zIndex:4-i,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:700, color:"#fff",
              }}>{p.name[0]}</div>
            ))}
            <div style={{
              width:32, height:32, borderRadius:"50%",
              background:"#e5e7eb", border:"2px solid #fff",
              marginLeft:-8,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, fontWeight:700, color:"#6b7280",
            }}>+9</div>
          </div>

          {/* 우측: 모더레이터 */}
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            background:"#f9fafb", borderRadius:10,
            padding:"8px 14px", border:"1px solid #e5e7eb",
          }}>
            <div style={{
              width:32, height:32, borderRadius:"50%",
              background:"#1B4F7A", overflow:"hidden",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:12, fontWeight:700, color:"#fff",
            }}>박</div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:"#111" }}>OOO 멘토</p>
              <p style={{ fontSize:11, color:"#9ca3af" }}>Moderator</p>
            </div>
            <button style={{ background:"none", border:"none", cursor:"pointer", padding:"0 4px" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="3" r="1.2" fill="#9ca3af"/><circle cx="8" cy="8" r="1.2" fill="#9ca3af"/><circle cx="8" cy="13" r="1.2" fill="#9ca3af"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ════ 본문 영역 ════ */}
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* ── 메인 비디오 영역 ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* 메인 스피커 뷰 */}
            <div style={{ flex:1, position:"relative", overflow:"hidden", background:"#e5e7eb" }}>
              {/* 가상 배경 이미지 플레이스홀더 */}
              <div style={{
                width:"100%", height:"100%",
                background:"linear-gradient(135deg,#e0e7ff 0%,#f0fdf4 100%)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{
                    width:100, height:100, borderRadius:"50%",
                    background:"#1B4F7A", margin:"0 auto 16px",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:32, fontWeight:700, color:"#fff",
                  }}>박</div>
                  <p style={{ fontSize:16, fontWeight:600, color:"#374151" }}>박지훈 멘토</p>
                  <p style={{ fontSize:12, color:"#9ca3af", marginTop:4 }}>카메라 연결 중...</p>
                </div>
              </div>

              {/* 녹화 타이머 */}
              <div style={{
                position:"absolute", top:16, left:16,
                background:"rgba(0,0,0,0.55)", borderRadius:20,
                padding:"5px 12px",
                display:"flex", alignItems:"center", gap:7,
              }}>
                <div style={{
                  width:8, height:8, borderRadius:"50%", background:"#EF4444",
                  animation: recording ? "pulse 1.2s ease-in-out infinite" : "none",
                }}/>
                <span style={{ fontSize:12, fontWeight:700, color:"#fff", fontFamily:"monospace" }}>
                  {formatTime(elapsed)}
                </span>
              </div>

              {/* 전체화면 버튼 */}
              <button onClick={()=>setFullscreen(v=>!v)} style={{
                position:"absolute", top:16, right:16,
                width:32, height:32, borderRadius:6,
                background:"rgba(0,0,0,0.45)", border:"none",
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* 이름 레이블 */}
              <div style={{
                position:"absolute", bottom:14, left:14,
                background:"rgba(0,0,0,0.55)", borderRadius:6, padding:"4px 10px",
              }}>
                <span style={{ fontSize:12, color:"#fff", fontWeight:500 }}>박지훈 멘토</span>
              </div>

              {/* 음성 인식 파형 아이콘 */}
              <div style={{
                position:"absolute", bottom:14, right:14,
                background:"rgba(0,0,0,0.45)", borderRadius:6,
                padding:"4px 8px",
                display:"flex", alignItems:"center", gap:2,
              }}>
                {[3,5,4,6,3,5,4].map((h,i)=>(
                  <div key={i} style={{ width:3, height:h*2, background:"rgba(255,255,255,0.6)", borderRadius:2 }}/>
                ))}
              </div>
            </div>

            {/* 하단 썸네일 바 */}
            <div style={{
              background:"#fff", padding:"10px 16px",
              borderTop:"1px solid #e5e7eb",
              display:"flex", gap:8, overflowX:"auto",
            }}>
              {participants.map((p,i)=>(
                <div key={i} style={{
                  position:"relative", flexShrink:0,
                  width:160, height:90, borderRadius:8,
                  background: p.speaking ? "#EFF6FF" : "#f3f4f6",
                  border:`2px solid ${p.speaking?"#2563EB":"transparent"}`,
                  overflow:"hidden",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  cursor:"pointer",
                  transition:"border-color 0.2s",
                }}>
                  <div style={{
                    width:44, height:44, borderRadius:"50%",
                    background:p.color,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:16, fontWeight:700, color:"#fff",
                  }}>{p.name[0]}</div>

                  {/* 이름 */}
                  <div style={{
                    position:"absolute", bottom:6, left:6,
                    background:"rgba(0,0,0,0.5)", borderRadius:4, padding:"2px 7px",
                  }}>
                    <span style={{ fontSize:11, color:"#fff", fontWeight:500 }}>{p.name}</span>
                  </div>

                  {/* 뮤트 아이콘 */}
                  <div style={{
                    position:"absolute", bottom:6, right:6,
                    width:20, height:20, borderRadius:"50%",
                    background: p.muted ? "#EF4444" : "#2563EB",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      {p.muted
                        ? <><rect x="3" y=".5" width="4" height="5" rx="2" fill="white"/><line x1="1" y1="1" x2="9" y2="9" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></>
                        : <><rect x="3" y=".5" width="4" height="5" rx="2" fill="white"/><path d="M1 4.5c0 2.2 1.8 4 4 4s4-1.8 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></>
                      }
                    </svg>
                  </div>
                </div>
              ))}
            </div>

            {/* ── 하단 컨트롤 바 ── */}
            <div style={{
              background:"#fff", padding:"12px 20px",
              borderTop:"1px solid #e5e7eb",
              display:"flex", alignItems:"center", justifyContent:"center",
              gap:10, flexShrink:0,
            }}>
              {[
                { icon:<MicIcon on={micOn}/>, label:micOn?"마이크":"음소거", active:micOn, click:()=>setMicOn(v=>!v) },
                { icon:<CamIcon on={camOn}/>, label:camOn?"카메라":"카메라 끔", active:camOn, click:()=>setCamOn(v=>!v) },
                { icon:<ShareIcon/>, label:"화면 공유", active:!screenShare, click:()=>setScreenShare(v=>!v) },
                { icon:<RecordIcon on={recording}/>, label:"녹화", active:!recording, click:()=>setRecording(v=>!v), pink:true },
                { icon:<ChatIcon/>, label:"채팅", active:!chatOpen, click:()=>setChatOpen(v=>!v) },
                { icon:<MoreIcon/>, label:"더보기", active:true, click:()=>{} },
              ].map((btn,i)=>(
                <button key={i} className={btn.active?"ctrl-btn":"ctrl-btn-off"} onClick={btn.click} style={{
                  width:48, height:48, borderRadius:"50%",
                  background: btn.pink && !btn.active ? "#FEE2E2"
                    : !btn.active ? "#EF4444"
                    : "#3B82F6",
                  border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  transition:"background 0.18s",
                }}>
                  {btn.icon}
                </button>
              ))}

              {/* 채팅 입력창 (채팅 열린 경우) */}
              {chatOpen && (
                <div style={{ display:"flex", gap:8, flex:1, maxWidth:340 }}>
                  <input
                    placeholder="Type Something..."
                    value={chatMsg} onChange={e=>setChatMsg(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&sendChat()}
                    style={{
                      flex:1, padding:"10px 14px",
                      background:"#f3f4f6", border:"1px solid #e5e7eb",
                      borderRadius:24, fontSize:13, color:"#111",
                      outline:"none", fontFamily:"inherit",
                    }}
                  />
                  <button onClick={sendChat} style={{
                    width:40, height:40, borderRadius:"50%",
                    background:"#2563EB", border:"none", cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 8L2 2l2 6-2 6 12-6z" fill="white"/>
                    </svg>
                  </button>
                </div>
              )}

              {/* 멘티 전용: 답변 상태 버튼 (화자 분리) */}
              {!isMentor && (
                <button
                  onClick={() => handleAnswerStatus(answerStatus === "answering" ? "done" : "answering")}
                  style={{
                    padding:"12px 20px",
                    background: answerStatus === "answering" ? "#1D9E75" : "#f3f4f6",
                    color: answerStatus === "answering" ? "#fff" : "#374151",
                    border: `1.5px solid ${answerStatus === "answering" ? "#1D9E75" : "#d1d5db"}`,
                    borderRadius:24,
                    fontSize:13, fontWeight:700, cursor:"pointer",
                    fontFamily:"inherit", transition:"all 0.18s",
                  }}
                >
                  {answerStatus === "answering" ? "● 답변 중..." : "답변 시작"}
                </button>
              )}

              {/* End Call */}
              <button onClick={handleEndCall} disabled={ending} style={{
                padding:"12px 24px",
                background: ending ? "#9ca3af" : "#EF4444",
                color:"#fff", border:"none", borderRadius:24,
                fontSize:14, fontWeight:700, cursor:ending?"not-allowed":"pointer",
                fontFamily:"inherit", transition:"background 0.18s", marginLeft:8,
              }}
                onMouseEnter={e=>{if(!ending)e.currentTarget.style.background="#DC2626";}}
                onMouseLeave={e=>{if(!ending)e.currentTarget.style.background="#EF4444";}}
              >
                {ending ? "종료 중..." : "End Call"}
              </button>
            </div>
          </div>

          {/* ════ 멘토 전용: 우측 사이드패널 ════ */}
          {isMentor && (
            <div style={{
              width:300, flexShrink:0,
              background:"#fff", borderLeft:"1px solid #e5e7eb",
              display:"flex", flexDirection:"column",
              overflow:"hidden",
            }}>
              {/* 패널 헤더 */}
              <div style={{ padding:"13px 16px", borderBottom:"1px solid #e5e7eb" }}>
                <p style={{ fontSize:13, fontWeight:700, color:"#111" }}>면접 질문 패널</p>
              </div>

              {/* 항상 열려있는 콘텐츠 */}
              <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:20 }}>

                {/* AI 추천질문 */}
                <div>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#2563EB", textTransform:"uppercase", marginBottom:10 }}>AI 추천질문</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {aiQuestions.map((q,i)=>(
                      <div key={i} style={{
                        background:"#f8faff", borderRadius:10, padding:"12px 14px",
                        border:"1px solid #dbeafe", cursor:"pointer",
                        borderLeft:"3px solid #2563EB",
                        transition:"background 0.15s",
                      }}
                        onMouseEnter={e=>e.currentTarget.style.background="#eff6ff"}
                        onMouseLeave={e=>e.currentTarget.style.background="#f8faff"}
                      >
                        <span style={{ fontSize:10, fontWeight:700, color:"#2563EB", display:"block", marginBottom:4 }}>Q{i+1}</span>
                        <p style={{ fontSize:12, color:"#374151", lineHeight:1.65 }}>{q}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 질문 리스트 */}
                <div>
                  <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"#6b7280", textTransform:"uppercase", marginBottom:10 }}>질문 리스트</p>
                  {questionList.map((item,i)=>{
                    const checked = checkedQs.includes(i);
                    return (
                      <label key={i} style={{
                        display:"flex", alignItems:"flex-start", gap:10,
                        padding:"10px 0",
                        borderBottom:"1px solid #f3f4f6",
                        cursor:"pointer",
                      }}>
                        <input type="checkbox" checked={checked}
                          onChange={()=>toggleCheck(i)}
                          style={{ marginTop:2, accentColor:"#2563EB", width:14, height:14, flexShrink:0 }}/>
                        <p style={{
                          fontSize:12, color:checked?"#9ca3af":"#374151",
                          lineHeight:1.7, textDecoration:checked?"line-through":"none",
                        }}>
                          {item.q.split(item.bold).map((part,j,arr)=>(
                            j < arr.length-1
                              ? <span key={j}>{part}<strong style={{ fontWeight:700 }}>{item.bold}</strong></span>
                              : <span key={j}>{part}</span>
                          ))}
                        </p>
                      </label>
                    );
                  })}
                  {checkedQs.length === questionList.length && (
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:12, padding:"10px", background:"#f0fdf4", borderRadius:8 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#1D9E75"/><path d="M4.5 8l2.5 2.5 4-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontSize:12, color:"#1D9E75", fontWeight:600 }}>And you're good to go!</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 하단 채팅 입력 */}
              <div style={{
                padding:"12px 14px",
                borderTop:"1px solid #e5e7eb",
                display:"flex", gap:8,
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink:0, alignSelf:"center" }}>
                  <circle cx="9" cy="9" r="7.5" stroke="#9ca3af" strokeWidth="1.3"/>
                  <path d="M9 6v3.5l2 1.5" stroke="#9ca3af" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <input placeholder="Type Something..." value={chatMsg}
                  onChange={e=>setChatMsg(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&sendChat()}
                  style={{
                    flex:1, border:"none", background:"transparent",
                    fontSize:13, color:"#374151", outline:"none", fontFamily:"inherit",
                  }}
                />
                <button onClick={sendChat} style={{
                  width:32, height:32, borderRadius:"50%",
                  background:"#2563EB", border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M11.5 6.5L1.5 1.5l1.5 5-1.5 5 10-5z" fill="white"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── 컨트롤 아이콘 ── */
const MicIcon = ({on}) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    {on
      ? <><rect x="6" y="1" width="6" height="9" rx="3" fill="white"/><path d="M3 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/><line x1="9" y1="14" x2="9" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></>
      : <><rect x="6" y="1" width="6" height="9" rx="3" fill="white" opacity=".5"/><line x1="2" y1="2" x2="16" y2="16" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></>
    }
  </svg>
);
const CamIcon = ({on}) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="11" height="9" rx="1.5" fill={on?"white":"rgba(255,255,255,0.5)"}/>
    <path d="M12 7l5-2.5v8L12 10V7z" fill={on?"white":"rgba(255,255,255,0.5)"}/>
    {!on && <line x1="2" y1="2" x2="16" y2="16" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>}
  </svg>
);
const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="5" width="16" height="10" rx="1.5" stroke="white" strokeWidth="1.5"/>
    <path d="M9 1v7M6 4l3-3 3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const RecordIcon = ({on}) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke={on?"rgba(255,150,150,0.8)":"rgba(255,255,255,0.5)"} strokeWidth="1.5"/>
    <circle cx="9" cy="9" r="4" fill={on?"#EF4444":"rgba(255,255,255,0.5)"}/>
  </svg>
);
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 3h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5l-3 3V4a1 1 0 0 1 1-1z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M5 7h8M5 10h5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const MoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="4" cy="9" r="1.5" fill="white"/><circle cx="9" cy="9" r="1.5" fill="white"/><circle cx="14" cy="9" r="1.5" fill="white"/>
  </svg>
);
