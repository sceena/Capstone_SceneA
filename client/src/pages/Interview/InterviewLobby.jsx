import { useCallback, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createQuestions,
  getQuestions,
  getRecommendedQuestions,
  getResume,
  getSession,
  joinSession,
  saveResume,
  updateSessionStatus,
} from "../../api/sessions";
import {
  describeMediaError,
  getStreamVideoDeviceId,
  getVideoInputDevices,
  mediaSupportError,
  openAudioVideoStream,
} from "../../utils/mediaDevices";

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
  const streamRef = useRef(null);
  const [camStatus, setCamStatus] = useState("idle"); // idle | loading | ok | denied
  const [camError, setCamError] = useState("");
  const [entering, setEntering] = useState(false);
  const [checklist, setChecklist] = useState([false, false, false]);
  const [sessionData, setSessionData] = useState(null);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [questionsOpen, setQuestionsOpen] = useState(true);
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendSaving, setRecommendSaving] = useState(false);
  const [recommendError, setRecommendError] = useState("");
  const [resumeContent, setResumeContent] = useState("");
  const [openResumeIndex, setOpenResumeIndex] = useState(null);

  /* ── 오디오 레벨 분석 ── */
  const [micLevel, setMicLevel] = useState(0);
  const [micOk, setMicOk] = useState(false);
  const audioCtxLobbyRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  /* 세션 정보 로드 */
  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) return;
    getSession(id).then(setSessionData).catch(() => {});
    if (role === "mentor") {
      getQuestions(id).then(data => {
        setQuestions(normalizeQuestionList(data));
      }).catch(() => {});
      getResume(id).then(data => {
        setResumeContent(data?.content ?? "");
      }).catch(() => {});
    }
    if (role === "mentee") {
      const raw = localStorage.getItem("scena_resume_draft");
      try {
        const draft = JSON.parse(raw);
        if (Array.isArray(draft)) {
          const content = draft
            .filter(item => item?.content?.trim())
            .map(item => `[${item.title || "자기소개서"}]\n${item.content.trim()}`)
            .join("\n\n");
          if (content) saveResume(id, content).catch(() => {});
        }
      } catch {}
    }
  }, [id, role]);

  /* 사용 가능한 카메라 목록 로드 */
  useEffect(() => {
    const supportError = mediaSupportError();
    if (supportError) {
      setCamStatus("denied");
      setCamError(supportError);
      return;
    }

    getVideoInputDevices().then(cams => {
      setVideoDevices(cams);
      if (cams.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(localStorage.getItem('preferredCameraId') || cams[0].deviceId);
      }
    }).catch(error => {
      setCamError(describeMediaError(error));
    });
  }, []);

  /* stream 준비되면 video에 연결 (ref가 아직 없을 때 대비) */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.play().catch(() => {});
  }, [stream]);

  const startCameraPreview = useCallback((deviceId = selectedDeviceId) => {
    const supportError = mediaSupportError();
    if (supportError) {
      setCamStatus("denied");
      setCamError(supportError);
      return () => {};
    }

    let cancelled = false;
    setCamStatus("loading");
    setCamError("");

    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    openAudioVideoStream(deviceId)
      .then(s => {
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
        setStream(s);
        setCamStatus("ok");
        const actualDeviceId = getStreamVideoDeviceId(s);
        if (actualDeviceId) {
          localStorage.setItem('preferredCameraId', actualDeviceId);
          if (actualDeviceId !== deviceId) setSelectedDeviceId(actualDeviceId);
        }
        /* 권한 허용 후 카메라 목록 레이블 갱신 */
        getVideoInputDevices().then(cams => {
          setVideoDevices(cams);
        }).catch(() => {});
      })
      .catch(error => {
        if (!cancelled) {
          setCamStatus("denied");
          setCamError(describeMediaError(error));
          if (deviceId) localStorage.removeItem('preferredCameraId');
        }
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [selectedDeviceId]);

  /* 카메라 초기화 - selectedDeviceId 변경 시마다 재실행 */
  useEffect(() => startCameraPreview(selectedDeviceId), [selectedDeviceId, startCameraPreview]);

  /* 마이크 트랙 활성/비활성 */
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = micOn; });
  }, [micOn]);

  /* 마이크 레벨 실시간 분석 */
  useEffect(() => {
    if (!stream) { setMicLevel(0); return; }
    let cancelled = false;
    try {
      const ctx = new AudioContext();
      audioCtxLobbyRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      const tick = () => {
        if (cancelled) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const lv = Math.min(100, avg * 3.5);
        setMicLevel(lv);
        if (lv > 8) setMicOk(true);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {}
    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      audioCtxLobbyRef.current?.close().catch(() => {});
      audioCtxLobbyRef.current = null;
      analyserRef.current = null;
    };
  }, [stream]);

  /* 카메라 트랙 활성/비활성 */
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOn; });
  }, [camOn]);

  const parseResumeContent = (content) => {
    if (!content) return [];
    return content.split(/\n\n+/).map(section => {
      const match = section.match(/^\[(.+?)\]\n([\s\S]*)/);
      if (match) return { title: match[1], content: match[2].trim() };
      return { title: "자기소개서", content: section.trim() };
    }).filter(item => item.content);
  };

  const normalizeQuestionList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.questions)) return data.questions;
    return [];
  };

  const flattenRecommendedQuestions = (data) => {
    const isGroup = data?.session_type === "GROUP";
    const commonItems = isGroup ? (data?.common_questions ?? []).map((content, index) => ({
      key: `common-${index}`,
      section: "공통",
      content,
      selected: true,
    })) : [];

    const personalItems = (data?.personal_questions ?? []).flatMap(item =>
      (item.questions ?? []).map((content, index) => ({
        key: `personal-${item.candidate_id}-${index}`,
        section: isGroup ? `지원자 ${item.candidate_id}` : "개인 질문",
        content,
        selected: true,
      }))
    );

    return [...commonItems, ...personalItems];
  };

  const handleLoadRecommendedQuestions = async () => {
    if (!id || recommendLoading) return;
    setRecommendLoading(true);
    setRecommendError("");
    try {
      const data = await getRecommendedQuestions(id);
      const nextQuestions = flattenRecommendedQuestions(data);
      setRecommendedQuestions(nextQuestions);
      if (nextQuestions.length === 0) {
        setRecommendError("추천 질문이 없습니다. 지원자 서류가 등록되어 있는지 확인해 주세요.");
      }
    } catch (error) {
      setRecommendError(error?.message || "AI 추천 질문을 불러오지 못했습니다.");
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleRecommendedQuestionChange = (index, value) => {
    setRecommendedQuestions(prev =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, content: value } : item
      )
    );
  };

  const handleRecommendedQuestionToggle = (index) => {
    setRecommendedQuestions(prev =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleSaveRecommendedQuestions = async () => {
    const contents = recommendedQuestions
      .filter(item => item.selected)
      .map(item => item.content.trim())
      .filter(Boolean);

    if (contents.length === 0) {
      setRecommendError("저장할 질문을 하나 이상 선택해 주세요.");
      return;
    }

    setRecommendSaving(true);
    setRecommendError("");
    try {
      const data = await createQuestions(id, contents);
      const savedQuestions = normalizeQuestionList(data);
      if (savedQuestions.length > 0) {
        setQuestions(savedQuestions);
      } else {
        const latest = await getQuestions(id);
        setQuestions(normalizeQuestionList(latest));
      }
    } catch (error) {
      setRecommendError(error?.message || "선택한 질문을 저장하지 못했습니다.");
    } finally {
      setRecommendSaving(false);
    }
  };

  const handleEnter = async () => {
    setEntering(true);
    const isRealSession = id && /^\d+$/.test(id);
    if (isRealSession) {
      try { await joinSession(id); } catch {}
      if (role === "mentor") {
        try { await updateSessionStatus(id, "in_progress"); } catch {}
      }
    }
    navigate(role === "mentor" ? `/interview/mentor/${id}` : `/interview/mentee/${id}`);
  };

  const scheduledAt = sessionData?.scheduledAt ?? sessionData?.scheduled_at ?? "";
  const mentorName = sessionData?.mentorName ?? sessionData?.mentor_name ?? "멘토";
  const menteeFromParticipants = sessionData?.participants?.find?.(p => p.role === "mentee");
  const menteeName = sessionData?.menteeName ?? sessionData?.mentee_name ?? menteeFromParticipants?.name ?? "멘티";
  const mentorInfo = sessionData?.mentorInfo ?? sessionData?.mentor_info ?? "면접 준비를 함께 진행합니다.";
  const menteeGoal = sessionData?.menteeGoal ?? sessionData?.mentee_goal ?? "멘토에게 전달한 자소서와 지원 정보를 바탕으로 면접을 준비합니다.";

  /* API 데이터 우선, 없으면 fallback */
  const session = {
    title:       sessionData?.title ?? (sessionData?.job_category ? `${sessionData.job_category} 모의 면접` : "세션 로딩 중..."),
    date:        scheduledAt,
    type:        sessionData?.sessionType ?? sessionData?.session_type ?? "1:1 개인 세션",
    menteeName,
    menteeInfo:  sessionData?.menteeInfo ?? sessionData?.mentee_info ?? "",
    menteeGoal,
    aiReport:    sessionData?.aiReport ?? sessionData?.ai_report ?? "멘티의 자기소개서와 지원 정보를 기반으로 추천 질문을 확인하세요.",
    mentorName,
    mentorInfo,
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
              {/* 항상 DOM에 존재 - CSS로 표시/숨김 제어 */}
              <video
                ref={videoRef}
                autoPlay playsInline muted
                style={{
                  position:"absolute", inset:0, width:"100%", height:"100%",
                  objectFit:"cover", transform:"scaleX(-1)",
                  display: (camOn && camStatus==="ok") ? "block" : "none",
                }}
              />
              {!(camOn && camStatus==="ok") && (
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
                    {camStatus==="denied" ? (camError || "카메라 권한이 거부됐어요") : camOn ? "카메라 연결 중..." : "카메라가 꺼져 있어요"}
                  </p>
                  {camStatus==="denied" && (
                    <button
                      type="button"
                      onClick={() => startCameraPreview("")}
                      style={{
                        marginTop: 12,
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.24)",
                        background: "rgba(255,255,255,0.12)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      카메라 권한 다시 요청
                    </button>
                  )}
                </div>
              )}

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

            {/* 카메라 선택 드롭다운 */}
            {videoDevices.length > 1 && (
              <div style={{ width:"100%", maxWidth:340 }}>
                <label style={{ fontSize:11, color:"rgba(255,255,255,0.4)", display:"block", marginBottom:6 }}>
                  카메라 선택
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={e => setSelectedDeviceId(e.target.value)}
                  style={{
                    width:"100%", padding:"8px 12px",
                    background:"#1a3060", color:"#fff",
                    border:"1px solid rgba(255,255,255,0.15)",
                    borderRadius:8, fontSize:12,
                    cursor:"pointer", outline:"none",
                  }}
                >
                  {videoDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `카메라 ${d.deviceId.slice(0, 6)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 마이크 레벨 미터 */}
            <div style={{ width:"100%", maxWidth:360 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", fontWeight:600 }}>🎙 마이크 레벨</span>
                {!micOn
                  ? <span style={{ fontSize:11, color:"#EF4444" }}>마이크가 꺼져 있어요</span>
                  : micOk
                    ? <span style={{ fontSize:11, color:C_teal, fontWeight:700 }}>✓ 정상 감지됨</span>
                    : <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>말씀해보세요...</span>
                }
              </div>
              <div style={{ height:8, background:"rgba(255,255,255,0.08)", borderRadius:99, overflow:"hidden" }}>
                <div style={{
                  width:`${micOn ? micLevel : 0}%`, height:8, borderRadius:99,
                  background: micLevel > 70 ? "#EF4444" : micLevel > 20 ? C_teal : "rgba(255,255,255,0.2)",
                  transition:"width 0.08s ease",
                }}/>
              </div>
              {/* 눈금 */}
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                {["낮음","적정","높음"].map((l,i)=>(
                  <span key={i} style={{ fontSize:9, color:"rgba(255,255,255,0.2)" }}>{l}</span>
                ))}
              </div>
            </div>

            {/* 장치 상태 배지 */}
            <div style={{ display:"flex", gap:10 }}>
              <div style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"5px 12px", borderRadius:99,
                background: camStatus==="ok" ? "rgba(29,158,117,0.15)" : "rgba(239,68,68,0.12)",
                border:`1px solid ${camStatus==="ok" ? "rgba(29,158,117,0.4)" : "rgba(239,68,68,0.3)"}`,
              }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background: camStatus==="ok" ? C_teal : "#EF4444" }}/>
                <span style={{ fontSize:11, color: camStatus==="ok" ? C_teal : "#EF4444", fontWeight:600 }}>
                  {camStatus==="ok" ? "카메라 정상" : "카메라 확인 필요"}
                </span>
              </div>
              <div style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"5px 12px", borderRadius:99,
                background: micOk ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.05)",
                border:`1px solid ${micOk ? "rgba(29,158,117,0.4)" : "rgba(255,255,255,0.1)"}`,
              }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background: micOk ? C_teal : "rgba(255,255,255,0.2)", animation: !micOk && micOn ? "pulse 1.2s ease-in-out infinite" : "none" }}/>
                <span style={{ fontSize:11, color: micOk ? C_teal : "rgba(255,255,255,0.4)", fontWeight:600 }}>
                  {micOk ? "마이크 정상" : "마이크 테스트 중"}
                </span>
              </div>
            </div>
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
            {/* ⚠️ 장치 테스트 안내 배너 */}
            {(camStatus !== "ok" || !micOk) && (
              <div style={{
                background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.35)",
                borderRadius:10, padding:"10px 14px",
                display:"flex", gap:10, alignItems:"flex-start",
              }}>
                <span style={{ fontSize:16, flexShrink:0 }}>⚠️</span>
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:"#F59E0B", marginBottom:3 }}>
                    카메라·마이크 테스트를 먼저 진행해주세요
                  </p>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)", lineHeight:1.6 }}>
                    왼쪽 화면에서 카메라 영상이 보이고, 마이크 레벨 바가 움직이는 것을 확인한 후 입장하세요.
                  </p>
                </div>
              </div>
            )}

            {/* 세션 제목 + 면접 종류 */}
            <div>
              <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.15em", color:"rgba(255,255,255,0.4)", textTransform:"uppercase", marginBottom:8 }}>
                SESSION INFO
              </p>
              <h2 style={{ fontSize:18, fontWeight:700, color:"#fff", marginBottom:8, letterSpacing:"-0.02em" }}>
                {session.title}
              </h2>
              <div style={{ display:"flex", gap:8 }}>
                <span style={{
                  fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:99,
                  background: session.type?.includes("그룹") ? "rgba(245,158,11,0.2)" : "rgba(29,158,117,0.2)",
                  color: session.type?.includes("그룹") ? "#F59E0B" : C_teal,
                  border: `1px solid ${session.type?.includes("그룹") ? "rgba(245,158,11,0.4)" : "rgba(29,158,117,0.4)"}`,
                }}>
                  {session.type?.includes("그룹") ? "그룹 면접" : "1:1 면접"}
                </span>
                {session.date && (
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", display:"flex", alignItems:"center" }}>
                    {session.date}
                  </span>
                )}
              </div>
            </div>

            {/* 멘토 전용: 멘티 정보 + 자소서 */}
            {isMentor && (
              <div style={{
                background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"16px",
                border:"1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"rgba(255,255,255,0.4)", textTransform:"uppercase", marginBottom:10 }}>
                  멘티 정보
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <div style={{
                    width:36, height:36, borderRadius:"50%",
                    background:"#1B4F7A",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:700, color:"#fff", flexShrink:0,
                  }}>
                    {session.menteeName?.[0] ?? "?"}
                  </div>
                  <div>
                    <p style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{session.menteeName} 멘티</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>{session.menteeInfo || session.type}</p>
                  </div>
                </div>
                {resumeContent ? (
                  <div>
                    <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:6 }}>자기소개서</p>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {parseResumeContent(resumeContent).map((item, i) => (
                        <div key={i} style={{ borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)" }}>
                          <button
                            type="button"
                            onClick={() => setOpenResumeIndex(openResumeIndex === i ? null : i)}
                            style={{
                              width:"100%", background:"rgba(255,255,255,0.05)",
                              border:"none", cursor:"pointer",
                              display:"flex", alignItems:"center", justifyContent:"space-between",
                              padding:"8px 10px", gap:8,
                            }}
                          >
                            <span style={{ fontSize:11, color:"rgba(255,255,255,0.75)", fontWeight:600, textAlign:"left" }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize:10, color:"rgba(255,255,255,0.4)", flexShrink:0 }}>
                              {openResumeIndex === i ? "▼" : "▶"}
                            </span>
                          </button>
                          {openResumeIndex === i && (
                            <div style={{ padding:"8px 10px", background:"rgba(0,0,0,0.2)" }}>
                              <p style={{
                                fontSize:11, color:"rgba(255,255,255,0.6)", lineHeight:1.7,
                                whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0,
                              }}>{item.content}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", fontStyle:"italic" }}>
                    자기소개서가 없습니다
                  </p>
                )}
              </div>
            )}

            {/* 멘티 전용: 멘토 정보 */}
            {!isMentor && (
              <div style={{
                background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"16px",
                border:"1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"rgba(255,255,255,0.4)", textTransform:"uppercase", marginBottom:10 }}>
                  담당 멘토
                </p>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{
                    width:36, height:36, borderRadius:"50%",
                    background:"#0F6E56",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:13, fontWeight:700, color:"#fff", flexShrink:0,
                  }}>
                    {session.mentorName?.[0] ?? "?"}
                  </div>
                  <div>
                    <p style={{ fontSize:14, fontWeight:700, color:"#fff" }}>{session.mentorName} 멘토</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.45)" }}>{session.mentorInfo}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── 멘티 전용: 자소서 등록 확인 ── */}
            {!isMentor && (
              <div style={{
                background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px",
                border:"1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:"rgba(255,255,255,0.4)", textTransform:"uppercase", marginBottom:12 }}>
                  자소서 등록 확인
                </p>
                {sessionData?.jobPosting || sessionData?.jobPostingUrl || sessionData?.coverLetter ? (
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <div style={{
                        width:28, height:28, borderRadius:"50%",
                        background:"rgba(29,158,117,0.2)", border:"1px solid rgba(29,158,117,0.5)",
                        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C_teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, color:"#fff" }}>자기소개서 등록 완료</p>
                        <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>면접 AI 분석에 반영됩니다</p>
                      </div>
                    </div>
                    {(sessionData?.jobPosting?.url || sessionData?.jobPostingUrl) && (
                      <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8, padding:"8px 12px" }}>
                        <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:2 }}>채용공고 URL</p>
                        <p style={{ fontSize:11, color:C_teal, wordBreak:"break-all" }}>
                          {sessionData?.jobPosting?.url || sessionData?.jobPostingUrl}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <div style={{
                      width:28, height:28, borderRadius:"50%",
                      background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)",
                      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:"#EF4444", marginBottom:4 }}>자기소개서 미등록</p>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", lineHeight:1.6 }}>
                        자기소개서가 없으면 AI 맞춤 질문 생성이 제한됩니다.<br/>
                        마이페이지에서 등록 후 입장을 권장드립니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 멘티 전용: 입장 전 체크리스트 ── */}
            {!isMentor && (
              <div style={{
                background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px",
                border:"1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:10 }}>입장 전 체크</p>
                {[
                  { label:"카메라 화면이 정상으로 보인다", auto: camStatus==="ok" },
                  { label:"마이크 레벨 바가 움직이는 것을 확인했다", auto: micOk },
                  { label:"조용하고 밝은 환경에 있다", auto: false },
                ].map((item,i)=>(
                  <label key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, cursor:"pointer" }}>
                    <input type="checkbox"
                      checked={item.auto || checklist[i]}
                      onChange={()=>!item.auto && setChecklist(prev=>prev.map((v,j)=>j===i?!v:v))}
                      style={{ accentColor:C_teal, width:14, height:14 }}
                      readOnly={item.auto}
                    />
                    <span style={{
                      fontSize:12,
                      color:(item.auto||checklist[i])?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.45)",
                      textDecoration:(item.auto||checklist[i])?"line-through":"none",
                    }}>{item.label}</span>
                    {item.auto && <span style={{ fontSize:10, color:C_teal, fontWeight:700 }}>자동</span>}
                  </label>
                ))}
              </div>
            )}

            {/* ── 멘토 전용: AI 예상 질문 리스트 ── */}
            {isMentor && (
              <div style={{
                background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <button
                  type="button"
                  onClick={() => setQuestionsOpen(v => !v)}
                  style={{
                    width: "100%", background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: 0, marginBottom: questionsOpen ? 12 : 0,
                  }}
                >
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase" }}>
                    🎯 AI 예상 질문 리스트
                  </p>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                    {questionsOpen ? "▲" : "▼"}
                  </span>
                </button>
                {questionsOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleLoadRecommendedQuestions}
                        disabled={recommendLoading}
                        style={{
                          flex: 1,
                          padding: "9px 12px",
                          borderRadius: 8,
                          border: "1px solid rgba(245,158,11,0.35)",
                          background: recommendLoading ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.18)",
                          color: "#F59E0B",
                          cursor: recommendLoading ? "default" : "pointer",
                          fontFamily: "inherit",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {recommendLoading ? "추천 질문 생성 중..." : "AI 추천 질문 불러오기"}
                      </button>
                      {recommendedQuestions.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSaveRecommendedQuestions}
                          disabled={recommendSaving}
                          style={{
                            padding: "9px 12px",
                            borderRadius: 8,
                            border: "1px solid rgba(29,158,117,0.35)",
                            background: recommendSaving ? "rgba(29,158,117,0.12)" : "rgba(29,158,117,0.18)",
                            color: C_teal,
                            cursor: recommendSaving ? "default" : "pointer",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {recommendSaving ? "저장 중..." : "선택 저장"}
                        </button>
                      )}
                    </div>

                    {recommendError && (
                      <p style={{ fontSize: 11, color: "#EF4444", lineHeight: 1.5 }}>
                        {recommendError}
                      </p>
                    )}

                    {recommendedQuestions.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {recommendedQuestions.map((item, i) => (
                          <label key={item.key} style={{
                            background: item.selected ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${item.selected ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.08)"}`,
                            borderRadius: 8,
                            padding: "8px 10px",
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-start",
                          }}>
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleRecommendedQuestionToggle(i)}
                              style={{ accentColor: "#F59E0B", width: 14, height: 14, marginTop: 6, flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                                <span style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700 }}>
                                  {item.section}
                                </span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>
                                  추천 {i + 1}
                                </span>
                              </div>
                              <textarea
                                value={item.content ?? ""}
                                onChange={event => handleRecommendedQuestionChange(i, event.target.value)}
                                rows={Math.max(3, Math.ceil(String(item.content ?? "").length / 34))}
                                style={{
                                  width: "100%",
                                  resize: "none",
                                  minHeight: 78,
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: 7,
                                  padding: "7px 8px",
                                  background: "rgba(13,34,64,0.82)",
                                  color: "rgba(255,255,255,0.82)",
                                  fontFamily: "inherit",
                                  fontSize: 12,
                                  lineHeight: 1.55,
                                  outline: "none",
                                  overflow: "hidden",
                                  boxSizing: "border-box",
                                }}
                              />
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {questionsOpen && (
                  questions.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {questions.map((q, i) => (
                        <div key={q.id ?? i} style={{
                          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                          borderRadius: 8, padding: "8px 12px",
                          display: "flex", gap: 10, alignItems: "flex-start",
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", flexShrink: 0, marginTop: 1 }}>
                            Q{i + 1}
                          </span>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                            {q.content ?? q.question ?? q}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
                      AI 예상 질문을 불러오는 중입니다. 세션 ID가 유효하면 자동으로 표시됩니다.
                    </p>
                  )
                )}
              </div>
            )}

            {/* ── 멘토 전용: 면접 진행 가이드 ── */}
            {isMentor && (
              <div style={{
                background:"rgba(29,158,117,0.07)", borderRadius:12, padding:"14px 16px",
                border:"1px solid rgba(29,158,117,0.2)",
              }}>
                <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", color:C_teal, textTransform:"uppercase", marginBottom:12 }}>
                  면접 진행 가이드
                </p>
                {[
                  { icon:"⏱", text:"질문당 답변 시간은 2~3분을 권장합니다" },
                  { icon:"📝", text:"답변 중 메모 기능을 활용해 핵심을 기록하세요" },
                  { icon:"⭐", text:"STAR 기법(상황→과제→행동→결과)으로 구체적 답변을 유도하세요" },
                  { icon:"🎯", text:"AI 추천 질문을 참고하되 자유롭게 응용하세요" },
                  { icon:"💬", text:"면접 종료 후 멘토링 세션에서 심층 피드백이 진행됩니다" },
                ].map((item,i)=>(
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:i<4?10:0 }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>{item.icon}</span>
                    <p style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.65 }}>{item.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── 멘토 전용: 입장 전 체크리스트 ── */}
            {isMentor && (
              <div style={{
                background:"rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px",
                border:"1px solid rgba(255,255,255,0.1)",
              }}>
                <p style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.5)", marginBottom:10 }}>입장 전 체크</p>
                {[
                  { label:"멘티 자기소개서 및 이력서 검토 완료", auto: false },
                  { label:"AI 추천 질문 확인 완료", auto: false },
                  { label:"카메라 화면이 정상으로 보인다", auto: camStatus==="ok" },
                  { label:"마이크 레벨 바가 움직이는 것을 확인했다", auto: micOk },
                ].map((item,i)=>(
                  <label key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, cursor:"pointer" }}>
                    <input type="checkbox"
                      checked={item.auto || checklist[i]}
                      onChange={()=>!item.auto && setChecklist(prev=>prev.map((v,j)=>j===i?!v:v))}
                      style={{ accentColor:C_teal, width:14, height:14 }}
                    />
                    <span style={{
                      fontSize:12,
                      color:(item.auto||checklist[i])?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.45)",
                      textDecoration:(item.auto||checklist[i])?"line-through":"none",
                    }}>{item.label}</span>
                    {item.auto && <span style={{ fontSize:10, color:C_teal, fontWeight:700, marginLeft:2 }}>자동</span>}
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
