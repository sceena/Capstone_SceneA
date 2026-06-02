import { useCallback, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createQuestions,
  getQuestions,
  getRecommendedQuestions,
  getResume,
  getSession,
  joinSession,
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
  const [step, setStep] = useState(1); // 1: 정보 확인  2: 장치 확인
  const [checklist, setChecklist] = useState([false, false, false, false]);
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
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [openResumeIndex, setOpenResumeIndex] = useState(null);

  const cacheRecommendedQuestions = useCallback((items) => {
    if (!id || !Array.isArray(items)) return;
    const contents = items
      .map(item => item?.content?.trim?.() || "")
      .filter(Boolean);
    if (contents.length > 0) {
      sessionStorage.setItem(`scena_session_recommendations_${id}`, JSON.stringify(contents));
    }
  }, [id]);

  /* ── 오디오 레벨 분석 ── */
  const [micLevel, setMicLevel] = useState(0);
  const [micOk, setMicOk] = useState(false);
  const audioCtxLobbyRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  /* 세션 정보 로드 */
  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) {
      /* 더미 데이터 (로컬 UI 확인용) */
      setSessionData({
        title: "네이버 백엔드 모의 면접",
        scheduledAt: "2026-06-01 14:00",
        sessionType: "1:1 개인 세션",
        mentorName: "김멘토",
        mentorInfo: "네이버 5년차 백엔드 엔지니어",
        menteeGoal: "Spring Boot 기반 경험을 중심으로 면접 준비",
        participants: [
          { name: "이멘티", role: "mentee", info: "네이버 지원자" },
        ],
      });
      setResumeContent(
        "[지원 동기]\n저는 대규모 트래픽 환경에서의 백엔드 개발에 관심이 많아 네이버에 지원하게 되었습니다.\n\n[프로젝트 경험]\nSpring Boot와 JPA를 활용한 카풀 서비스를 개발하였으며, AWS EC2 배포 경험이 있습니다.\n\n[강점]\n문제 해결 능력과 팀 협업 경험을 강점으로 내세울 수 있습니다."
      );
      setRecommendedQuestions([
        { key: "personal-0-0", section: "개인 질문", content: "Spring Boot와 JPA를 사용하면서 N+1 문제를 경험한 적 있나요? 어떻게 해결했나요?", selected: true },
        { key: "personal-0-1", section: "개인 질문", content: "대용량 트래픽 처리를 위해 어떤 설계 방식을 고려해본 적 있나요?", selected: true },
        { key: "personal-0-2", section: "개인 질문", content: "카풀 서비스를 개발할 때 가장 어려웠던 기술적 문제는 무엇이었나요?", selected: true },
        { key: "personal-0-3", section: "개인 질문", content: "AWS EC2 배포 과정에서 발생한 트러블슈팅 경험을 설명해주세요.", selected: true },
        { key: "personal-0-4", section: "개인 질문", content: "REST API 설계 시 중요하게 생각하는 원칙은 무엇인가요?", selected: false },
      ]);
      return;
    }
    getSession(id).then(setSessionData).catch(() => {});
    if (role === "mentor") {
      getQuestions(id).then(data => {
        setQuestions(normalizeQuestionList(data));
      }).catch(() => {});
    }
    getResume(id).then(data => {
      setResumeContent(data?.content ?? "");
      setResumeError("");
    }).catch(() => {
      setResumeContent("");
      setResumeError("제출한 자소서를 불러오지 못했습니다.");
    });
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
    const sections = [];
    const lines = content.split(/\r?\n/);
    let current = null;

    lines.forEach(line => {
      const titleMatch = line.match(/^\[(.+?)\]\s*$/);
      if (titleMatch) {
        if (current?.content?.trim()) {
          sections.push({ title: current.title, content: current.content.trim() });
        }
        current = { title: titleMatch[1].trim(), content: "" };
        return;
      }

      if (current) {
        current.content += `${line}\n`;
      }
    });

    if (current?.content?.trim()) {
      sections.push({ title: current.title, content: current.content.trim() });
    }

    if (sections.length > 0) return sections;
    return [{ title: "자기소개서", content: content.trim() }].filter(item => item.content);
  };

  const findResumeSectionContent = (content, titleCandidates) => {
    const normalizedTitles = titleCandidates.map(title => title.replace(/\s+/g, "").toLowerCase());
    return parseResumeContent(content)
      .find(section => normalizedTitles.includes((section.title || "").replace(/\s+/g, "").toLowerCase()))
      ?.content
      ?.trim() || "";
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
      cacheRecommendedQuestions(nextQuestions);
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
        cacheRecommendedQuestions(savedQuestions);
      } else {
        const latest = await getQuestions(id);
        const latestQuestions = normalizeQuestionList(latest);
        setQuestions(latestQuestions);
        cacheRecommendedQuestions(latestQuestions);
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
      if (role === "mentor" && questions.length === 0 && recommendedQuestions.length > 0) {
        const contents = recommendedQuestions
          .filter(item => item.selected !== false)
          .map(item => item.content.trim())
          .filter(Boolean);
        if (contents.length > 0) {
          try {
            const data = await createQuestions(id, contents);
            const savedQuestions = normalizeQuestionList(data);
            setQuestions(savedQuestions);
            cacheRecommendedQuestions(savedQuestions.length > 0 ? savedQuestions : recommendedQuestions);
          } catch {
            cacheRecommendedQuestions(recommendedQuestions);
          }
        }
      }
      try { await joinSession(id); } catch {}
      if (role === "mentor") {
        try { await updateSessionStatus(id, "in_progress"); } catch {}
      }
    }
    navigate(role === "mentor" ? `/interview/mentor/${id}` : `/interview/mentee/${id}`);
  };

  const [selectedMenteeIdx, setSelectedMenteeIdx] = useState(0);

  const scheduledAt = sessionData?.scheduledAt ?? sessionData?.scheduled_at ?? "";
  const mentorName  = sessionData?.mentorName ?? sessionData?.mentor_name ?? "멘토";
  const mentorInfo  = sessionData?.mentorInfo ?? sessionData?.mentor_info ?? "면접 준비를 함께 진행합니다.";
  const menteeGoal  = sessionData?.menteeGoal ?? sessionData?.mentee_goal ?? "멘토에게 전달한 자소서와 지원 정보를 바탕으로 면접을 준비합니다.";

  /* 참여자 목록에서 멘티들 추출 (그룹 면접 대응) */
  const allParticipants = sessionData?.participants ?? [];
  const menteeParticipants = allParticipants.filter(p =>
    (p.role ?? p.memberRole ?? "").toLowerCase() === "mentee"
  );
  const fallbackMenteeName = sessionData?.menteeName ?? sessionData?.mentee_name ?? allParticipants.find(p => (p.role ?? "").toLowerCase() === "mentee")?.name ?? "멘티";
  const mentees = menteeParticipants.length > 0
    ? menteeParticipants
    : [{ name: fallbackMenteeName, role: "mentee" }];
  const selectedMentee = mentees[selectedMenteeIdx] ?? mentees[0];

  /* API 데이터 우선, 없으면 fallback */
  const session = {
    title:      sessionData?.title ?? (sessionData?.job_category ? `${sessionData.job_category} 모의 면접` : "세션 로딩 중..."),
    date:       scheduledAt,
    type:       sessionData?.sessionType ?? sessionData?.session_type ?? "1:1 개인 세션",
    menteeName: selectedMentee?.name ?? fallbackMenteeName,
    menteeInfo: sessionData?.menteeInfo ?? sessionData?.mentee_info ?? "",
    menteeGoal,
    aiReport:   sessionData?.aiReport ?? sessionData?.ai_report ?? "",
    mentorName,
    mentorInfo,
  };

  const isMentor = role === "mentor";
  const isGroup  = mentees.length > 1 || session.type?.includes("그룹");
  const menteePreInterviewNote = findResumeSectionContent(resumeContent, [
    "멘토에게 전달할 내용",
    "하고 싶은 말",
    "하고싶은 말",
    "사전 전달 내용",
    "자기소개",
  ]);

  /* ── 아코디언 헬퍼 ── */
  const Accordion = ({ title, accentColor = "#fff", defaultOpen = false, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
      <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", overflow: "hidden", background: "#112338", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
        <button type="button" onClick={() => setOpen(v => !v)} style={{
          width: "100%", padding: "14px 18px", background: "#1a3352",
          border: "none", borderBottom: open ? "1px solid rgba(255,255,255,0.1)" : "none",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: accentColor }}>{title}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
            <path d="M2 5l5 5 5-5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {open && <div style={{ padding: "16px 18px", background: "#0e1e30" }}>{children}</div>}
      </div>
    );
  };

  const deviceReady = camStatus === "ok" && micOk;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;margin:0;overflow:hidden}
        #root{height:100%;width:100%;max-width:100%;margin:0;min-height:0;display:block;text-align:left}
        body{font-family:'Noto Sans KR',sans-serif;background:#0a1628;color:white}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:999px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.3)}
      `}</style>

      <div style={{ width:"100%", height:"100vh", background:"#0a1628", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── 헤더 ── */}
        <div style={{
          height: 64, padding: "0 32px", flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#0D2240",
        }}>
          {/* 로고 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#0D2240,#1B4F7A)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>Scene<span style={{ color: C_teal }}>A</span></span>
          </div>

          {/* 스텝 인디케이터 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[{ n: 1, l: "정보 확인" }, { n: 2, l: "장치 확인" }].map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: step >= s.n ? C_teal : "rgba(255,255,255,0.08)",
                  border: `1.5px solid ${step >= s.n ? C_teal : "rgba(255,255,255,0.2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: step >= s.n ? "#fff" : "rgba(255,255,255,0.35)",
                  transition: "all 0.3s",
                }}>
                  {step > s.n ? "✓" : s.n}
                </div>
                <span style={{ fontSize: 13, fontWeight: step === s.n ? 700 : 400, color: step === s.n ? "#fff" : "rgba(255,255,255,0.4)", transition: "all 0.3s" }}>{s.l}</span>
                {i < 1 && <div style={{ width: 36, height: 1, background: step > s.n ? C_teal : "rgba(255,255,255,0.15)", transition: "background 0.3s", margin: "0 4px" }} />}
              </div>
            ))}
          </div>

          {/* 세션 제목 */}
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{session.title}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: session.type?.includes("그룹") ? "rgba(245,158,11,0.2)" : "rgba(29,158,117,0.2)",
                color: session.type?.includes("그룹") ? "#F59E0B" : C_teal,
              }}>{session.type?.includes("그룹") ? "그룹" : "1:1"}</span>
              {session.date && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{session.date}</span>}
            </div>
          </div>
        </div>

        {/* ── 메인 콘텐츠 ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: "24px 32px", gap: 24 }}>

          {/* ════════════════════════════════
              STEP 1 — 정보 확인
          ════════════════════════════════ */}
          <div style={{ display: step === 1 ? "contents" : "none" }}>

            {/* 왼쪽: 세션 정보 + 내 프로필 (좁게 고정) */}
            <div style={{ width: 270, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", paddingRight: 4 }}>

              {/* 세션 참여자 카드 */}
              <div style={{ background: "#112338", borderRadius: 16, padding: "20px 22px", border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>참여자</p>
                  {isGroup && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", background: "rgba(245,158,11,0.18)", padding: "2px 10px", borderRadius: 99, border: "1px solid rgba(245,158,11,0.3)" }}>
                      그룹 면접 · 멘티 {mentees.length}명
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                  {/* 멘토 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${isMentor ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)"}`, background: isMentor ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)" }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#0F6E56", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {session.mentorName?.[0] ?? "M"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{session.mentorName}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C_teal, background: "rgba(29,158,117,0.18)", padding: "2px 8px", borderRadius: 99 }}>멘토</span>
                        {isMentor && <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 99 }}>나</span>}
                      </div>
                      {session.mentorInfo && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.mentorInfo}</p>}
                    </div>
                  </div>

                  {/* 멘티들 (클릭 가능) */}
                  {mentees.map((mentee, i) => {
                    const isSelected = isMentor && selectedMenteeIdx === i;
                    const isMe = !isMentor && mentees.length === 1;
                    return (
                      <div key={i}
                        onClick={() => isMentor && setSelectedMenteeIdx(i)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                          borderRadius: 12,
                          border: `1px solid ${isSelected ? "rgba(165,180,252,0.5)" : isMe ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)"}`,
                          background: isSelected ? "rgba(165,180,252,0.12)" : isMe ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                          cursor: isMentor ? "pointer" : "default",
                          transition: "all 0.18s",
                          position: "relative",
                        }}
                        onMouseEnter={e => { if (isMentor && !isSelected) { e.currentTarget.style.background = "rgba(165,180,252,0.07)"; e.currentTarget.style.borderColor = "rgba(165,180,252,0.3)"; } }}
                        onMouseLeave={e => { if (isMentor && !isSelected) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; } }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: isSelected ? "#3730A3" : "#1B4F7A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0, transition: "background 0.18s" }}>
                          {mentee.name?.[0] ?? "M"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{mentee.name}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#A5B4FC", background: "rgba(165,180,252,0.15)", padding: "2px 8px", borderRadius: 99 }}>멘티</span>
                            {isMe && <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 99 }}>나</span>}
                            {isGroup && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>지원자 {i + 1}</span>}
                          </div>
                          {mentee.info && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mentee.info}</p>}
                        </div>
                        {isMentor && (
                          <div style={{ flexShrink: 0 }}>
                            {isSelected
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: "#A5B4FC" }}>확인 중 ●</span>
                              : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>클릭</span>
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 면접 진행 가이드 (멘토만) */}
              {isMentor && (
                <div style={{ background: "#0d2219", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(29,158,117,0.35)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: C_teal, textTransform: "uppercase", marginBottom: 14 }}>면접 진행 가이드</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { icon: "⏱", text: "질문당 답변 시간은 2~3분을 권장합니다" },
                      { icon: "⭐", text: "STAR 기법(상황→과제→행동→결과)으로 구체적 답변을 유도하세요" },
                      { icon: "🎯", text: "AI 추천 질문을 참고하되 자유롭게 응용하세요" },
                      { icon: "💬", text: "면접 종료 후 멘토링 세션에서 심층 피드백이 진행됩니다" },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>{item.icon}</span>
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.65 }}>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 멘티 사전 전달 내용 (멘토만) */}
              {isMentor && (
                <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#818CF8", textTransform: "uppercase", marginBottom: 10 }}>
                    {selectedMentee?.name ? `${selectedMentee.name} 사전 전달 내용` : "멘티 사전 전달 내용"}
                  </p>
                  {menteePreInterviewNote ? (
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.76)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{menteePreInterviewNote}</p>
                  ) : (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", lineHeight: 1.7 }}>
                      멘티가 따로 남긴 하고 싶은 말은 없습니다. 제출한 자기소개서는 오른쪽에서 확인할 수 있습니다.
                    </p>
                  )}
                </div>
              )}

              {/* 목표 / 한마디 (멘티만) */}
              {!isMentor && session.menteeGoal && (
                <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 16, padding: "18px 20px", border: "1px solid rgba(99,102,241,0.2)" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#818CF8", textTransform: "uppercase", marginBottom: 10 }}>오늘의 목표</p>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{session.menteeGoal}</p>
                </div>
              )}
            </div>

            {/* 오른쪽: 두 컬럼 가로 배치 */}
            <div style={{ flex: 1, display: "flex", gap: 14, overflow: "hidden" }}>

              {/* ── 멘토: 자소서(왼) | AI질문(오) ── */}
              {isMentor && (
                <>
                  {/* 왼쪽 열: 자소서 */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <Accordion title={isGroup ? `${selectedMentee?.name ?? "멘티"} 자기소개서` : "멘티 자기소개서"} accentColor="#818CF8" defaultOpen={true}>
                      {resumeContent ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {parseResumeContent(resumeContent).map((item, i) => (
                            <div key={i} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)" }}>
                              <button type="button" onClick={() => setOpenResumeIndex(openResumeIndex === i ? null : i)} style={{
                                width: "100%", background: "#1e3a5a", border: "none", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", gap: 8, fontFamily: "inherit",
                              }}>
                                <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, textAlign: "left" }}>{item.title}</span>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", flexShrink: 0 }}>{openResumeIndex === i ? "▼" : "▶"}</span>
                              </button>
                              {openResumeIndex === i && (
                                <div style={{ padding: "14px 16px", background: "#0d1e30", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", lineHeight: 1.85, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{item.content}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>자기소개서가 없습니다</p>
                      )}
                    </Accordion>
                  </div>

                  {/* 오른쪽 열: AI 질문 */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {(() => {
                      const sectionKey = isGroup ? `지원자 ${selectedMenteeIdx + 1}` : null;
                      const shownRecommended = sectionKey
                        ? recommendedQuestions.filter(q => q.section === "공통" || q.section === sectionKey)
                        : recommendedQuestions;
                      const shownSaved = sectionKey
                        ? questions.filter(q => !q.section || q.section === "공통" || q.section === sectionKey)
                        : questions;
                      return (
                        <Accordion
                          title={isGroup ? `🎯 AI 질문 — ${selectedMentee?.name ?? "멘티"}` : "🎯 AI 예상 질문 리스트"}
                          accentColor="#F59E0B"
                          defaultOpen={true}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button type="button" onClick={handleLoadRecommendedQuestions} disabled={recommendLoading} style={{
                                flex: 1, padding: "9px 12px", borderRadius: 8,
                                border: "1px solid rgba(245,158,11,0.4)", background: recommendLoading ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.18)",
                                color: "#F59E0B", cursor: recommendLoading ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                              }}>
                                {recommendLoading && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                                  </svg>
                                )}
                                {recommendLoading ? "AI 질문 생성 중..." : "AI 추천 질문 불러오기"}
                              </button>
                              {shownRecommended.length > 0 && (
                                <button type="button" onClick={handleSaveRecommendedQuestions} disabled={recommendSaving} style={{
                                  padding: "9px 12px", borderRadius: 8,
                                  border: "1px solid rgba(29,158,117,0.4)", background: "rgba(29,158,117,0.18)",
                                  color: C_teal, cursor: recommendSaving ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                                }}>
                                  {recommendSaving ? "저장 중..." : "선택 저장"}
                                </button>
                              )}
                            </div>
                            {recommendError && <p style={{ fontSize: 11, color: "#EF4444" }}>{recommendError}</p>}
                            {shownRecommended.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {shownRecommended.map((item, i) => {
                                  const globalIdx = recommendedQuestions.indexOf(item);
                                  return (
                                    <label key={item.key} style={{
                                      background: item.selected ? "#2a1e00" : "#162030",
                                      border: `1px solid ${item.selected ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.15)"}`,
                                      borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer",
                                    }}>
                                      <input type="checkbox" checked={item.selected} onChange={() => handleRecommendedQuestionToggle(globalIdx)} style={{ accentColor: "#F59E0B", width: 14, height: 14, marginTop: 6, flexShrink: 0 }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}>
                                          <span style={{ fontSize: 10, color: item.section === "공통" ? C_teal : "#F59E0B", fontWeight: 700 }}>{item.section}</span>
                                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>추천 {i + 1}</span>
                                        </div>
                                        <textarea value={item.content ?? ""} onChange={e => handleRecommendedQuestionChange(globalIdx, e.target.value)}
                                          rows={Math.max(2, Math.ceil(String(item.content ?? "").length / 34))}
                                          style={{ width: "100%", resize: "none", minHeight: 60, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "8px 10px", background: "rgba(13,34,64,0.9)", color: "rgba(255,255,255,0.92)", fontFamily: "inherit", fontSize: 12, lineHeight: 1.65, outline: "none", boxSizing: "border-box" }}
                                        />
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            {shownSaved.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {shownSaved.map((q, i) => (
                                  <div key={q.id ?? i} style={{ background: "#1e1400", border: "1px solid rgba(245,158,11,0.45)", borderRadius: 10, padding: "11px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: "#F59E0B", flexShrink: 0, marginTop: 2 }}>Q{i + 1}</span>
                                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.95)", lineHeight: 1.65, margin: 0 }}>{q.content ?? q.question ?? q}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </Accordion>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* ── 멘티: 멘토소개(왼) | 자소서(오) ── */}
              {!isMentor && (
                <>
                  {/* 왼쪽 열: 멘토 소개 */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <Accordion title="담당 멘토 소개" accentColor={C_teal} defaultOpen={true}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: session.mentorInfo ? 12 : 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#0F6E56", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {session.mentorName?.[0] ?? "?"}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{session.mentorName} 멘토</p>
                          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{session.type}</p>
                        </div>
                      </div>
                      {session.mentorInfo && (
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{session.mentorInfo}</p>
                      )}
                    </Accordion>
                  </div>

                  {/* 오른쪽 열: 자소서 */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <Accordion title="제출한 자기소개서" accentColor="#818CF8" defaultOpen={true}>
                      {resumeContent ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {parseResumeContent(resumeContent).map((item, i) => (
                            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px" }}>
                              <p style={{ fontSize: 11, fontWeight: 800, color: C_teal, marginBottom: 6 }}>{item.title}</p>
                              <p style={{ fontSize: 12, lineHeight: 1.75, color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap" }}>{item.content}</p>
                            </div>
                          ))}
                          {(sessionData?.jobPosting?.url || sessionData?.jobPostingUrl) && (
                            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px" }}>
                              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>채용공고 URL</p>
                              <p style={{ fontSize: 11, color: C_teal, wordBreak: "break-all" }}>{sessionData?.jobPosting?.url || sessionData?.jobPostingUrl}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: resumeError ? "#EF4444" : "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                          {resumeError || "자기소개서를 불러오는 중입니다..."}
                        </p>
                      )}
                    </Accordion>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* ════════════════════════════════
              STEP 2 — 장치 확인
          ════════════════════════════════ */}
          <div style={{ display: step === 2 ? "contents" : "none" }}>

            {/* 왼쪽: 카메라 프리뷰 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>

              {/* ⚠️ 장치 경고 배너 */}
              {!deviceReady && (
                <div style={{ width: "100%", maxWidth: 460, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <p style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600 }}>카메라와 마이크가 정상 작동하는지 확인해주세요</p>
                </div>
              )}

              {/* 카메라 프리뷰 박스 */}
              <div style={{ width: "100%", maxWidth: 460, aspectRatio: "4/3", background: "#0d1f3c", borderRadius: 14, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
                <video ref={videoRef} autoPlay playsInline muted style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover", transform: "scaleX(-1)",
                  display: (camOn && camStatus === "ok") ? "block" : "none",
                }} />
                {!(camOn && camStatus === "ok") && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.06)", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {camStatus === "loading"
                        ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                        : <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="11" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" /><path d="M5 24c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      }
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                      {camStatus === "denied" ? (camError || "카메라 권한이 거부됐어요") : camOn ? "카메라 연결 중..." : "카메라가 꺼져 있어요"}
                    </p>
                    {camStatus === "denied" && (
                      <button type="button" onClick={() => startCameraPreview("")} style={{ marginTop: 12, padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.24)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        카메라 권한 다시 요청
                      </button>
                    )}
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "4px 10px" }}>
                  <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{isMentor ? session.mentorName : session.menteeName} (나)</span>
                </div>
              </div>

              {/* 마이크 작동 방식 안내 */}
              <div style={{ width: "100%", maxWidth: 460, background: "rgba(29,158,117,0.1)", border: "1px solid rgba(29,158,117,0.3)", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>🎙</span>
                <div>
                  <p style={{ fontSize: 13, color: C_teal, fontWeight: 700, marginBottom: 3 }}>마이크는 기본 음소거로 시작합니다</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                    면접 중 <strong style={{ color: "rgba(255,255,255,0.85)" }}>
                      {isMentor ? '"질문 녹음" 버튼' : '"답변 시작" 버튼'}
                    </strong>을 눌러야만 마이크가 활성화됩니다.
                  </p>
                </div>
              </div>

              {/* 컨트롤 버튼 */}
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  { active: micOn, setActive: setMicOn, onIcon: <MicOnIcon />, offIcon: <MicOffIcon />, label: micOn ? "마이크 ON" : "마이크 OFF" },
                  { active: camOn, setActive: setCamOn, onIcon: <CamOnIcon />, offIcon: <CamOffIcon />, label: camOn ? "카메라 ON" : "카메라 OFF" },
                ].map((btn, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <button onClick={() => btn.setActive(v => !v)} style={{
                      width: 52, height: 52, borderRadius: "50%",
                      background: btn.active ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.2)",
                      border: `1.5px solid ${btn.active ? "rgba(255,255,255,0.2)" : "rgba(239,68,68,0.5)"}`,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = btn.active ? "rgba(255,255,255,0.16)" : "rgba(239,68,68,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = btn.active ? "rgba(255,255,255,0.1)" : "rgba(239,68,68,0.2)"; }}
                    >
                      {btn.active ? btn.onIcon : btn.offIcon}
                    </button>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{btn.label}</span>
                  </div>
                ))}
              </div>

              {/* 카메라 선택 */}
              {videoDevices.length > 1 && (
                <div style={{ width: "100%", maxWidth: 360 }}>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>카메라 선택</label>
                  <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, fontSize: 12, cursor: "pointer", outline: "none" }}>
                    {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `카메라 ${d.deviceId.slice(0, 6)}`}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* 오른쪽: 장치 상태 + 체크리스트 */}
            <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* 마이크 레벨 미터 */}
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>마이크 레벨</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>🎙 입력 감지</span>
                  {!micOn
                    ? <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>마이크 꺼짐</span>
                    : micOk
                      ? <span style={{ fontSize: 11, color: C_teal, fontWeight: 700 }}>✓ 정상 감지됨</span>
                      : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>말씀해보세요...</span>
                  }
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${micOn ? micLevel : 0}%`, height: 8, borderRadius: 99, background: micLevel > 20 ? C_teal : "rgba(255,255,255,0.2)", transition: "width 0.08s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {["낮음", "적정 ✓"].map((l, i) => <span key={i} style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{l}</span>)}
                </div>
              </div>

              {/* 장치 상태 */}
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>장치 상태</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "카메라", ok: camStatus === "ok", okText: "정상 연결됨", failText: "확인 필요" },
                    { label: "마이크", ok: micOk, okText: "정상 감지됨", failText: "테스트 중", pulse: !micOk && micOn },
                  ].map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: d.ok ? "rgba(29,158,117,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${d.ok ? "rgba(29,158,117,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                      <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{d.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: d.ok ? C_teal : "rgba(255,255,255,0.25)", animation: d.pulse ? "pulse 1.2s ease-in-out infinite" : "none" }} />
                        <span style={{ fontSize: 12, color: d.ok ? C_teal : "rgba(255,255,255,0.4)", fontWeight: 600 }}>{d.ok ? d.okText : d.failText}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 체크리스트 */}
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.1)", flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>입장 전 체크</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(isMentor ? [
                    { label: "멘티 자기소개서 검토 완료", auto: false },
                    { label: "AI 추천 질문 확인 완료", auto: false },
                    { label: "카메라 화면이 정상으로 보인다", auto: camStatus === "ok" },
                    { label: "마이크 레벨 바가 움직인다", auto: micOk },
                  ] : [
                    { label: "카메라 화면이 정상으로 보인다", auto: camStatus === "ok" },
                    { label: "마이크 레벨 바가 움직인다", auto: micOk },
                    { label: "조용하고 밝은 환경에 있다", auto: false },
                  ]).map((item, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, cursor: item.auto ? "default" : "pointer" }}>
                      <input type="checkbox" checked={item.auto || checklist[i]} onChange={() => !item.auto && setChecklist(prev => prev.map((v, j) => j === i ? !v : v))} style={{ accentColor: C_teal, width: 15, height: 15, flexShrink: 0 }} readOnly={item.auto} />
                      <span style={{ fontSize: 12, color: (item.auto || checklist[i]) ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)", textDecoration: (item.auto || checklist[i]) ? "line-through" : "none" }}>{item.label}</span>
                      {item.auto && <span style={{ fontSize: 10, color: C_teal, fontWeight: 700, marginLeft: "auto", flexShrink: 0 }}>자동</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>{/* end main content */}

        {/* ── 푸터 (버튼) ── */}
        <div style={{
          height: 72, padding: "0 32px", flexShrink: 0,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "#0D2240",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            {step === 2 && (
              <button onClick={() => setStep(1)} style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "transparent", color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
              >← 이전</button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {step === 1 && (
              <button onClick={() => setStep(2)} style={{ padding: "12px 32px", borderRadius: 10, border: `1.5px solid ${C_teal}`, background: "rgba(29,158,117,0.18)", color: C_teal, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(29,158,117,0.28)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(29,158,117,0.18)"; }}
              >장치 확인하기 →</button>
            )}
            {step === 2 && (
              <button onClick={handleEnter} disabled={entering} style={{ padding: "12px 36px", borderRadius: 10, border: "none", background: entering ? "rgba(255,255,255,0.2)" : "linear-gradient(135deg,#1D9E75,#0F6E56)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: entering ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "opacity 0.18s", boxShadow: entering ? "none" : "0 4px 16px rgba(29,158,117,0.4)", letterSpacing: "0.02em" }}
                onMouseEnter={e => { if (!entering) e.currentTarget.style.opacity = "0.88"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >{entering ? "입장 중..." : "면접 입장하기"}</button>
            )}
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
