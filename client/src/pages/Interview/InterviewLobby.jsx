import { useCallback, useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuthUser } from "../../store/authStore";
import {
  createQuestions,
  deleteQuestion,
  getMenteeResume,
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

export default function InterviewLobby({ role = "mentee" }) {
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
  const [recommendScope, setRecommendScope] = useState("personal");
  const [recommendSaving, setRecommendSaving] = useState(false);
  const [deletingQuestionId, setDeletingQuestionId] = useState(null);
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
        setQuestions(normalizeSavedQuestionList(data));
      }).catch(() => {});
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

  const normalizeSavedQuestionList = (data) =>
    normalizeQuestionList(data).map(item => ({
      ...item,
      content: item.content ?? item.question ?? "",
      questionType: item.question_type ?? item.questionType ?? null,
      candidateId: item.candidate_id ?? item.candidateId ?? null,
      selected: item.selected ?? true,
    }));

  const getQuestionCandidateId = (question) =>
    question?.candidate_id ?? question?.candidateId ?? null;

  const getQuestionType = (question) => {
    if (question?.section === "공통") return "COMMON";
    const explicitType = question?.question_type ?? question?.questionType ?? null;
    if (explicitType) return String(explicitType).toUpperCase();
    return getQuestionCandidateId(question) ? "PERSONAL" : null;
  };

  const isCommonQuestion = (question) => getQuestionType(question) === "COMMON";

  const flattenRecommendedQuestions = (data) => {
    const isGroup = (data?.session_type ?? data?.sessionType) === "GROUP";
    const commonQuestions = data?.common_questions ?? data?.commonQuestions ?? [];
    const personalQuestions = data?.personal_questions ?? data?.personalQuestions ?? [];
    const commonItems = isGroup ? commonQuestions.map((content, index) => ({
      key: `common-${index}`,
      section: "공통",
      questionType: "COMMON",
      candidateId: null,
      content,
      selected: true,
    })) : [];

    const personalItems = personalQuestions.flatMap(item => {
      const candidateId = item.candidate_id ?? item.candidateId ?? null;
      return (item.questions ?? []).map((content, index) => ({
        key: `personal-${candidateId ?? "single"}-${index}`,
        section: isGroup && candidateId != null ? `지원자 ${candidateId}` : "개인 질문",
        questionType: "PERSONAL",
        candidateId,
        content,
        selected: true,
      }));
    });

    return [...commonItems, ...personalItems];
  };

  const handleLoadRecommendedQuestions = async (scope = "personal") => {
    if (!id || recommendLoading) return;
    setRecommendScope(scope);

    const alreadyLoaded = scope === "common"
      ? recommendedQuestions.some(isCommonQuestion)
      : recommendedQuestions.some(item =>
        selectedMenteeId != null && Number(getQuestionCandidateId(item)) === Number(selectedMenteeId)
      );
    if (alreadyLoaded) {
      setRecommendError("");
      return;
    }

    setRecommendLoading(true);
    setRecommendError("");
    try {
      const data = await getRecommendedQuestions(id, {
        scope: scope === "common" ? "COMMON" : "PERSONAL",
        candidateId: scope === "common" ? null : selectedMenteeId,
      });
      const nextQuestions = flattenRecommendedQuestions(data);
      setRecommendedQuestions(prev => {
        const filteredPrev = prev.filter(item =>
          scope === "common"
            ? !isCommonQuestion(item)
            : !(selectedMenteeId != null && Number(getQuestionCandidateId(item)) === Number(selectedMenteeId))
        );
        return [...filteredPrev, ...nextQuestions];
      });
      cacheRecommendedQuestions([...recommendedQuestions, ...nextQuestions]);
      if (nextQuestions.length === 0) {
        setRecommendError(
          scope === "common"
            ? "공통 질문이 생성되지 않았습니다. 수락된 멘티가 2명 이상인지 확인해 주세요."
            : "개인 질문이 생성되지 않았습니다. AI 서버 응답을 확인해 주세요."
        );
      }
    } catch (error) {
      setRecommendError(error?.message || "AI 추천 질문을 불러오지 못했습니다.");
    } finally {
      setRecommendLoading(false);
    }
  };

  const handleRecommendedQuestionChange = (key, value) => {
    setRecommendedQuestions(prev =>
      prev.map(item =>
        item.key === key ? { ...item, content: value } : item
      )
    );
  };

  const handleRecommendedQuestionToggle = (key) => {
    setRecommendedQuestions(prev =>
      prev.map(item =>
        item.key === key ? { ...item, selected: item.selected === false } : item
      )
    );
  };

  const handleDeleteSavedQuestion = async (questionId) => {
    if (!questionId) return;
    setDeletingQuestionId(questionId);
    setRecommendError("");
    try {
      await deleteQuestion(id, questionId);
      setQuestions(prev => prev.filter(item => item.id !== questionId));
    } catch (error) {
      setRecommendError(error?.message || "질문을 삭제하지 못했습니다.");
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleSaveRecommendedQuestions = async (targetRecommendedQuestions = recommendedQuestions) => {
    const skipAlreadySavedCommon = isGroup && questions.some(isCommonQuestion);
    const questionItems = targetRecommendedQuestions
      .filter(item => item.selected)
      .filter(item => !(skipAlreadySavedCommon && isCommonQuestion(item)))
      .map(item => {
        const questionType = getQuestionType(item) ?? "PERSONAL";
        const candidateId = isGroup && questionType === "PERSONAL"
          ? selectedMenteeId
          : getQuestionCandidateId(item);
        return {
          content: item.content?.trim() ?? "",
          questionType,
          candidateId: questionType === "COMMON" ? null : candidateId,
        };
      })
      .filter(item => item.content);

    if (isGroup && questionItems.some(item => item.questionType === "PERSONAL" && item.candidateId == null)) {
      setRecommendError("선택된 멘티 정보를 찾지 못해 개인 질문을 저장할 수 없습니다.");
      return;
    }

    if (questionItems.length === 0) {
      setRecommendError(skipAlreadySavedCommon ? "공통 질문은 이미 저장되어 있습니다. 저장할 개인 질문을 선택해 주세요." : "저장할 질문을 하나 이상 선택해 주세요.");
      return;
    }

    setRecommendSaving(true);
    setRecommendError("");
    try {
      await createQuestions(id, questionItems);
      const latest = await getQuestions(id);
      const latestQuestions = normalizeSavedQuestionList(latest);
      setQuestions(latestQuestions);
      cacheRecommendedQuestions(recommendedQuestions);
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
        const questionItems = recommendedQuestions
          .filter(item => item.selected !== false)
          .map(item => {
            const questionType = getQuestionType(item) ?? "PERSONAL";
            return {
              content: item.content?.trim() ?? "",
              questionType,
              candidateId: questionType === "COMMON" ? null : getQuestionCandidateId(item),
            };
          })
          .filter(item => item.content);
        if (questionItems.length > 0) {
          try {
            await createQuestions(id, questionItems);
            const latest = await getQuestions(id);
            setQuestions(normalizeSavedQuestionList(latest));
            cacheRecommendedQuestions(recommendedQuestions);
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

  const formatScheduledTime = (value) => {
    if (!value) return "";
    const normalized = typeof value === "string" ? value.replace(" ", "T") : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(value);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    return `${month}월 ${day}일 ${hour}시${minute ? ` ${String(minute).padStart(2, "0")}분` : ""}`;
  };

  const resolveMenteeGoal = (value) => {
    const fallback = "완벽하게 말하려고 애쓰기보다, 지금까지 해온 경험을 차분히 꺼내면 충분합니다. 오늘은 답변의 방향과 보완할 지점을 분명히 가져가는 시간이에요.";
    const genericGoal = "멘토에게 전달한 자기소개서와 지원 정보를 바탕으로 면접을 준비합니다.";
    const text = value?.trim?.() || "";
    return !text || text === genericGoal ? fallback : text;
  };

  const scheduledAt = sessionData?.scheduledAt ?? sessionData?.scheduled_at ?? "";
  const mentorName  = sessionData?.mentorName ?? sessionData?.mentor_name ?? "멘토";
  const mentorInfo  = sessionData?.mentorInfo ?? sessionData?.mentor_info ?? "면접 준비를 함께 진행합니다.";
  const menteeGoal  = resolveMenteeGoal(sessionData?.menteeGoal ?? sessionData?.mentee_goal);

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
  const selectedMenteeId = selectedMentee?.user_id ?? selectedMentee?.userId ?? selectedMentee?.id ?? null;
  const getMenteeId = (mentee) => mentee?.user_id ?? mentee?.userId ?? mentee?.id ?? null;
  const getMenteeNameById = (candidateId) => {
    const target = mentees.find(mentee => Number(getMenteeId(mentee)) === Number(candidateId));
    return target?.name ?? "멘티";
  };
  const getQuestionLabel = (question) => {
    const candidateId = getQuestionCandidateId(question);
    if (isCommonQuestion(question)) return "공통 질문";
    if (candidateId == null) return "개인 질문";
    return `${getMenteeNameById(candidateId)} 개인 질문`;
  };

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) return;

    const loadResume = (role === "mentor" && selectedMenteeId)
      ? getMenteeResume(id, selectedMenteeId)
      : getResume(id);

    loadResume.then(data => {
      setResumeContent(data?.content ?? "");
      setResumeError("");
      setOpenResumeIndex(null);
    }).catch(() => {
      setResumeContent("");
      setResumeError("제출한 자소서를 불러오지 못했습니다.");
      setOpenResumeIndex(null);
    });
  }, [id, role, selectedMenteeId]);

  /* API 데이터 우선, 없으면 fallback */
  const session = {
    title:      sessionData?.title ?? (sessionData?.job_category ? `${sessionData.job_category} 모의 면접` : "세션 로딩 중..."),
    date:       formatScheduledTime(scheduledAt),
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

  const myProfileImg = (() => {
    const u = getAuthUser();
    const stored = localStorage.getItem(`profile_img_${u?.email}`);
    return stored?.startsWith("data:") ? stored : null;
  })();
  const sessionStatus = String(sessionData?.status ?? "").toUpperCase();
  const canModifyQuestions = !sessionStatus || sessionStatus === "SCHEDULED";
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
      <div style={{ borderRadius: 14, border: "1px solid #E5E5E5", overflow: "hidden", background: "#FFFFFF", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
        <button type="button" onClick={() => setOpen(v => !v)} style={{
          width: "100%", padding: "14px 18px", background: "#FFFFFF",
          border: "none", borderBottom: open ? "1px solid #E5E5E5" : "none",
          cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#202123" }}>{title}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
            <path d="M2 5l5 5 5-5" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {open && <div style={{ padding: "16px 18px", background: "#FFFFFF" }}>{children}</div>}
      </div>
    );
  };

  const deviceReady = camStatus === "ok" && micOk;

  const renderRecommendedQuestionList = (items) => (
    items.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 2 }}>
        {items.map((item, i) => {
          const selected = item.selected !== false;
          return (
            <div key={item.key} style={{
              background: selected ? "#201803" : "#101b2a",
              border: `1px solid ${selected ? "rgba(245,158,11,0.48)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 8, padding: "11px 12px", display: "flex", gap: 10, alignItems: "flex-start", position: "relative", zIndex: 1,
            }}>
              <input type="checkbox" checked={selected} readOnly onPointerDown={e => { e.preventDefault(); e.stopPropagation(); handleRecommendedQuestionToggle(item.key); }} style={{ accentColor: "#F59E0B", width: 15, height: 15, marginTop: 5, flexShrink: 0, cursor: "pointer", position: "relative", zIndex: 5, pointerEvents: "auto" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <span style={{ fontSize: 11, color: getQuestionLabel(item) === "공통 질문" ? "#34D399" : "#FBBF24", fontWeight: 800 }}>{getQuestionLabel(item)}</span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.38)", fontWeight: 700 }}>추천 {i + 1}</span>
                </div>
                <textarea value={item.content ?? ""} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => handleRecommendedQuestionChange(item.key, e.target.value)}
                  rows={Math.max(2, Math.ceil(String(item.content ?? "").length / 34))}
                  style={{ width: "100%", resize: "vertical", minHeight: 66, border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, padding: "9px 10px", background: "#0b1726", color: "rgba(255,255,255,0.94)", fontFamily: "inherit", fontSize: 12, lineHeight: 1.65, outline: "none", boxSizing: "border-box", position: "relative", zIndex: 3, pointerEvents: "auto" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    )
  );

  const renderSavedQuestionList = (items) => (
    items.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 2 }}>
        {items.map((q, i) => (
          <div key={q.id ?? i} style={{ background: "#101b2a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "12px 13px", display: "flex", gap: 10, alignItems: "flex-start", position: "relative", zIndex: 1 }}>
            <span style={{ minWidth: 28, textAlign: "center", fontSize: 11, fontWeight: 800, color: "#FBBF24", flexShrink: 0, marginTop: 3 }}>Q{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: getQuestionLabel(q) === "공통 질문" ? "#34D399" : "#FBBF24", fontWeight: 800, marginBottom: 5 }}>{getQuestionLabel(q)}</div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.95)", lineHeight: 1.65, margin: 0 }}>{q.content ?? q.question ?? q}</p>
            </div>
            {q.id && (
              <button type="button" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); if (deletingQuestionId !== q.id) handleDeleteSavedQuestion(q.id); }} disabled={deletingQuestionId === q.id} style={{
                flexShrink: 0, minHeight: 30, padding: "6px 10px", borderRadius: 7,
                border: "1px solid rgba(239,68,68,0.50)", background: deletingQuestionId === q.id ? "rgba(239,68,68,0.08)" : "#2a1012",
                color: "#F87171", cursor: deletingQuestionId === q.id ? "default" : "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800,
                position: "relative", zIndex: 5, pointerEvents: "auto",
              }}>
                {deletingQuestionId === q.id ? "삭제 중.." : "삭제"}
              </button>
            )}
          </div>
        ))}
      </div>
    )
  );

  const renderQuestionSection = ({ title, accentColor, loadScope, loadLabel, recommendedItems, savedItems }) => (
    <Accordion title={title} accentColor={accentColor} defaultOpen={true}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {canModifyQuestions ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative", zIndex: 3 }}>
            <button type="button" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); if (!recommendLoading) handleLoadRecommendedQuestions(loadScope); }} disabled={recommendLoading} style={{
              flex: 1, minHeight: 38, padding: "9px 12px", borderRadius: 8,
              border: "1px solid #D1D5DB", background: recommendLoading && recommendScope === loadScope ? "#F1F1F3" : "#FFFFFF",
              color: "#202123", cursor: recommendLoading ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              position: "relative", zIndex: 4, pointerEvents: "auto",
            }}>
              {recommendLoading && recommendScope === loadScope ? "AI 질문 생성 중..." : loadLabel}
            </button>
            {recommendedItems.length > 0 && (
              <button type="button" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); if (!recommendSaving) handleSaveRecommendedQuestions(recommendedItems); }} disabled={recommendSaving} style={{
                minHeight: 38, padding: "9px 14px", borderRadius: 8,
                border: "1px solid #202123", background: recommendSaving ? "#F1F1F3" : "#202123",
                color: recommendSaving ? "#6B7280" : "#FFFFFF", cursor: recommendSaving ? "default" : "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800,
                whiteSpace: "nowrap", position: "relative", zIndex: 4, pointerEvents: "auto",
              }}>
                {recommendSaving ? "저장 중..." : "선택 저장"}
              </button>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.6 }}>
            면접이 시작된 이후에는 저장된 질문만 확인할 수 있습니다.
          </p>
        )}
        {recommendError && recommendScope === loadScope && <p style={{ fontSize: 11, color: "#EF4444" }}>{recommendError}</p>}
        {canModifyQuestions && renderRecommendedQuestionList(recommendedItems)}
        {renderSavedQuestionList(savedItems)}
      </div>
    </Accordion>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;margin:0;overflow:hidden}
        #root{height:100%;width:100%;max-width:100%;margin:0;min-height:0;display:block;text-align:left}
        body{font-family:'Noto Sans KR',sans-serif;background:#F7F7F8;color:#202123}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:999px}
        ::-webkit-scrollbar-thumb:hover{background:#9CA3AF}
      `}</style>

      <div style={{ width:"100%", height:"100vh", background:"#F7F7F8", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* ── 헤더 ── */}
        <div style={{
          height: 64, padding: "0 32px", flexShrink: 0,
          borderBottom: "1px solid #E5E5E5",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FFFFFF",
        }}>
          {/* 로고 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#202123", letterSpacing: "-0.03em" }}>면도리</span>
            <img src="/mascot_exact_embedded.svg" alt="" aria-hidden="true" style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }} />
          </div>

          {/* 스텝 인디케이터 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[{ n: 1, l: "정보 확인" }, { n: 2, l: "장치 확인" }].map((s, i) => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: step >= s.n ? "#202123" : "#F1F1F3",
                  border: `1.5px solid ${step >= s.n ? "#202123" : "#E5E5E5"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: step >= s.n ? "#fff" : "#9CA3AF",
                  transition: "all 0.3s",
                }}>
                  {step > s.n ? "✓" : s.n}
                </div>
                <span style={{ fontSize: 13, fontWeight: step === s.n ? 700 : 400, color: step === s.n ? "#202123" : "#6B7280", transition: "all 0.3s" }}>{s.l}</span>
                {i < 1 && <div style={{ width: 36, height: 1, background: step > s.n ? "#202123" : "#E5E5E5", transition: "background 0.3s", margin: "0 4px" }} />}
              </div>
            ))}
          </div>

          {/* 세션 제목 */}
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#202123" }}>{session.title}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                background: session.type?.includes("그룹") ? "rgba(245,158,11,0.2)" : "rgba(29,158,117,0.2)",
                color: session.type?.includes("그룹") ? "#F59E0B" : C_teal,
              }}>{session.type?.includes("그룹") ? "그룹" : "1:1"}</span>
              {session.date && <span style={{ fontSize: 11, color: "#6B7280" }}>{session.date}</span>}
            </div>
          </div>
        </div>

        {/* ── 메인 콘텐츠 ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: "24px 32px", gap: 24 }}>

          {/* ════════════════════════════════
              STEP 1 — 정보 확인
          ════════════════════════════════ */}
          <div style={{ display: step === 1 ? "contents" : "none" }}>

            {/* 왼쪽: 세션 정보 + 내 프로필 */}
            <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", paddingRight: 4 }}>

              {/* 세션 참여자 카드 */}
              <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "20px 22px", border: "1px solid #E5E5E5", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#6B7280", textTransform: "uppercase" }}>참여자</p>
                  {isGroup && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#202123", background: "#F1F1F3", padding: "2px 10px", borderRadius: 99, border: "1px solid #E5E5E5" }}>
                      그룹 면접 · 멘티 {mentees.length}명
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                  {/* 멘토 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${isMentor ? "#D1D5DB" : "#E5E5E5"}`, background: isMentor ? "#F1F1F3" : "#F7F7F8" }}>
                    {isMentor && myProfileImg
                      ? <img src={myProfileImg} alt="me" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#202123", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {session.mentorName?.[0] ?? "M"}
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#202123", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{session.mentorName}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#067A5F", background: "#ECFDF5", padding: "2px 8px", borderRadius: 99 }}>멘토</span>
                        {isMentor && <span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", background: "#FFFFFF", padding: "2px 8px", borderRadius: 99, border: "1px solid #E5E5E5" }}>나</span>}
                      </div>
                      {session.mentorInfo && <p style={{ fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.mentorInfo}</p>}
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
                          border: `1px solid ${isSelected ? "#202123" : isMe ? "#D1D5DB" : "#E5E5E5"}`,
                          background: isSelected ? "#F1F1F3" : isMe ? "#F1F1F3" : "#F7F7F8",
                          cursor: isMentor ? "pointer" : "default",
                          transition: "all 0.18s",
                          position: "relative",
                        }}
                        onMouseEnter={e => { if (isMentor && !isSelected) { e.currentTarget.style.background = "#F1F1F3"; e.currentTarget.style.borderColor = "#D1D5DB"; } }}
                        onMouseLeave={e => { if (isMentor && !isSelected) { e.currentTarget.style.background = "#F7F7F8"; e.currentTarget.style.borderColor = "#E5E5E5"; } }}
                      >
                        {isMe && myProfileImg
                          ? <img src={myProfileImg} alt="me" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          : <div style={{ width: 38, height: 38, borderRadius: "50%", background: isSelected ? "#202123" : "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0, transition: "background 0.18s" }}>
                              {mentee.name?.[0] ?? "M"}
                            </div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: "#202123", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{mentee.name}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#202123", background: "#FFFFFF", padding: "2px 8px", borderRadius: 99, border: "1px solid #E5E5E5" }}>멘티</span>
                            {isMe && <span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", background: "#FFFFFF", padding: "2px 8px", borderRadius: 99, border: "1px solid #E5E5E5" }}>나</span>}
                            {isGroup && <span style={{ fontSize: 10, color: "#9CA3AF" }}>지원자 {i + 1}</span>}
                          </div>
                          {mentee.info && <p style={{ fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mentee.info}</p>}
                        </div>
                        {isMentor && (
                          <div style={{ flexShrink: 0 }}>
                            {isSelected
                              ? <span style={{ fontSize: 11, fontWeight: 700, color: "#202123" }}>확인 중</span>
                              : <span style={{ fontSize: 11, color: "#9CA3AF" }}>클릭</span>
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
                <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "18px 20px", border: "1px solid #E5E5E5", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#6B7280", textTransform: "uppercase", marginBottom: 14 }}>면접 진행 가이드</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { icon: "01", text: "질문당 답변 시간은 2~3분을 권장합니다" },
                      { icon: "02", text: "STAR 기법으로 구체적 답변을 유도하세요" },
                      { icon: "03", text: "AI 추천 질문을 참고하되 자유롭게 응용하세요" },
                      { icon: "04", text: "면접 종료 후 멘토링 세션에서 심층 피드백이 진행됩니다" },
                    ].map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#F1F1F3", color: "#6B7280", fontSize: 10, fontWeight: 800, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.icon}</span>
                        <p style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.65 }}>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 멘티 사전 전달 내용 (멘토만) */}
              {isMentor && (
                <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "18px 20px", border: "1px solid #E5E5E5", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#6B7280", textTransform: "uppercase", marginBottom: 10 }}>
                    {selectedMentee?.name ? `${selectedMentee.name} 사전 전달 내용` : "멘티 사전 전달 내용"}
                  </p>
                  {menteePreInterviewNote ? (
                    <p style={{ fontSize: 13, color: "#202123", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{menteePreInterviewNote}</p>
                  ) : (
                    <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.7 }}>
                      멘티가 따로 남긴 하고 싶은 말은 없습니다. 제출한 자기소개서는 오른쪽에서 확인할 수 있습니다.
                    </p>
                  )}
                </div>
              )}

              {/* 목표 / 한마디 (멘티만) */}
              {!isMentor && session.menteeGoal && (
                <div style={{ background: "#FFFFFF", borderRadius: 16, padding: "18px 20px", border: "1px solid #E5E5E5", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "#6B7280", textTransform: "uppercase", marginBottom: 10 }}>오늘 가져갈 것</p>
                  <p style={{ fontSize: 13, color: "#202123", lineHeight: 1.7 }}>{session.menteeGoal}</p>
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
                            <div key={i} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E5E5E5" }}>
                              <button type="button" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setOpenResumeIndex(openResumeIndex === i ? null : i); }} style={{
                                width: "100%", background: "#F7F7F8", border: "none", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", gap: 8, fontFamily: "inherit",
                              }}>
                                <span style={{ fontSize: 13, color: "#202123", fontWeight: 700, textAlign: "left" }}>{item.title}</span>
                                <span style={{ fontSize: 11, color: "#6B7280", flexShrink: 0 }}>{openResumeIndex === i ? "▼" : "▶"}</span>
                              </button>
                              {openResumeIndex === i && (
                                <div style={{ padding: "14px 16px", background: "#FFFFFF", borderTop: "1px solid #E5E5E5" }}>
                                  <p style={{ fontSize: 13, color: "#202123", lineHeight: 1.85, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{item.content}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic" }}>자기소개서가 없습니다</p>
                      )}
                    </Accordion>
                  </div>

                  {/* 오른쪽 열: AI 질문 */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {(() => {
                      const isQuestionForSelectedMentee = (q) => {
                        if (!isGroup) return true;
                        if (isCommonQuestion(q)) return false;
                        const candidateId = getQuestionCandidateId(q);
                        if (candidateId != null && selectedMenteeId != null) {
                          return Number(candidateId) === Number(selectedMenteeId);
                        }
                        return true;
                      };
                      const shownRecommended = recommendedQuestions.filter(isQuestionForSelectedMentee);
                      const shownSaved = questions.filter(isQuestionForSelectedMentee);
                      const commonRecommended = isGroup ? recommendedQuestions.filter(isCommonQuestion) : [];
                      const commonSaved = isGroup ? questions.filter(isCommonQuestion) : [];
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {isGroup && renderQuestionSection({
                          title: "AI 공통 질문",
                          accentColor: "#34D399",
                          loadScope: "common",
                          loadLabel: "공통질문 불러오기",
                          recommendedItems: commonRecommended,
                          savedItems: commonSaved,
                        })}
                        {renderQuestionSection({
                          title: isGroup ? `AI 질문 - ${selectedMentee?.name ?? "멘티"}` : "AI 예상 질문 리스트",
                          accentColor: "#F59E0B",
                          loadScope: "personal",
                          loadLabel: isGroup ? `${selectedMentee?.name ?? "멘티"} 개인질문 불러오기` : "AI 추천 질문 불러오기",
                          recommendedItems: shownRecommended,
                          savedItems: shownSaved,
                        })}
                        </div>
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
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#202123", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {session.mentorName?.[0] ?? "?"}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#202123" }}>{session.mentorName} 멘토</p>
                          <p style={{ fontSize: 11, color: "#6B7280" }}>{session.type}</p>
                        </div>
                      </div>
                      {session.mentorInfo && (
                        <p style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.7 }}>{session.mentorInfo}</p>
                      )}
                    </Accordion>
                  </div>

                  {/* 오른쪽 열: 자소서 */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    <Accordion title="제출한 자기소개서" accentColor="#818CF8" defaultOpen={true}>
                      {resumeContent ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {parseResumeContent(resumeContent).map((item, i) => (
                            <div key={i} style={{ background: "#F7F7F8", border: "1px solid #E5E5E5", borderRadius: 10, padding: "12px" }}>
                              <p style={{ fontSize: 11, fontWeight: 800, color: "#202123", marginBottom: 6 }}>{item.title}</p>
                              <p style={{ fontSize: 12, lineHeight: 1.75, color: "#4B5563", whiteSpace: "pre-wrap" }}>{item.content}</p>
                            </div>
                          ))}
                          {(sessionData?.jobPosting?.url || sessionData?.jobPostingUrl) && (
                            <div style={{ background: "#F7F7F8", borderRadius: 8, padding: "8px 12px" }}>
                              <p style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>채용공고 URL</p>
                              <p style={{ fontSize: 11, color: C_teal, wordBreak: "break-all" }}>{sessionData?.jobPosting?.url || sessionData?.jobPostingUrl}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p style={{ fontSize: 12, color: resumeError ? "#EF4444" : "#9CA3AF", fontStyle: "italic" }}>
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
                <div style={{ width: "100%", maxWidth: 460, background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 10, padding: "10px 16px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#F1F1F3", color: "#6B7280", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>!</span>
                  <p style={{ fontSize: 12, color: "#4B5563", fontWeight: 600 }}>카메라와 마이크가 정상 작동하는지 확인해주세요</p>
                </div>
              )}

              {/* 카메라 프리뷰 박스 */}
              <div style={{ width: "100%", maxWidth: 460, aspectRatio: "4/3", background: "#111827", borderRadius: 14, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E5E5E5", boxShadow: "0 12px 30px rgba(16,24,40,0.10)" }}>
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
              <div style={{ width: "100%", maxWidth: 460, background: "#FFFFFF", border: "1px solid #E5E5E5", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#F1F1F3", color: "#202123", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MicOnIcon /></span>
                <div>
                  <p style={{ fontSize: 13, color: "#202123", fontWeight: 700, marginBottom: 3 }}>마이크는 기본 음소거로 시작합니다</p>
                  <p style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.6 }}>
                    면접 중 <strong style={{ color: "#202123" }}>
                      {isMentor ? '"질문 시작" 버튼' : '"답변 시작" 버튼'}
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
                      background: btn.active ? "#FFFFFF" : "#FEE2E2",
                      border: `1.5px solid ${btn.active ? "#D1D5DB" : "#FCA5A5"}`,
                      color: btn.active ? "#202123" : "#EF4444",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s", boxShadow: "0 8px 20px rgba(16,24,40,0.08)",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = btn.active ? "#F1F1F3" : "#FEE2E2"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = btn.active ? "#FFFFFF" : "#FEE2E2"; }}
                    >
                      {btn.active ? btn.onIcon : btn.offIcon}
                    </button>
                    <span style={{ fontSize: 10, color: "#6B7280" }}>{btn.label}</span>
                  </div>
                ))}
              </div>

              {/* 카메라 선택 */}
              {videoDevices.length > 1 && (
                <div style={{ width: "100%", maxWidth: 360 }}>
                  <label style={{ fontSize: 11, color: "#6B7280", display: "block", marginBottom: 6 }}>카메라 선택</label>
                  <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "#FFFFFF", color: "#202123", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 12, cursor: "pointer", outline: "none" }}>
                    {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `카메라 ${d.deviceId.slice(0, 6)}`}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* 오른쪽: 장치 상태 + 체크리스트 */}
            <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* 마이크 레벨 미터 */}
              <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "18px 20px", border: "1px solid #E5E5E5", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>마이크 레벨</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>입력 감지</span>
                  {!micOn
                    ? <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600 }}>마이크 꺼짐</span>
                    : micOk
                      ? <span style={{ fontSize: 11, color: C_teal, fontWeight: 700 }}>✓ 정상 감지됨</span>
                      : <span style={{ fontSize: 11, color: "#9CA3AF" }}>말씀해보세요...</span>
                  }
                </div>
                <div style={{ height: 8, background: "#F1F1F3", borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${micOn ? micLevel : 0}%`, height: 8, borderRadius: 99, background: micLevel > 20 ? "#202123" : "#D1D5DB", transition: "width 0.08s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {["낮음", "적정"].map((l, i) => <span key={i} style={{ fontSize: 9, color: "#9CA3AF" }}>{l}</span>)}
                </div>
              </div>

              {/* 장치 상태 */}
              <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "18px 20px", border: "1px solid #E5E5E5", boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>장치 상태</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "카메라", ok: camStatus === "ok", okText: "정상 연결됨", failText: "확인 필요" },
                    { label: "마이크", ok: micOk, okText: "정상 감지됨", failText: "테스트 중", pulse: !micOk && micOn },
                  ].map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: d.ok ? "#ECFDF5" : "#F7F7F8", border: `1px solid ${d.ok ? "rgba(16,163,127,0.24)" : "#E5E5E5"}` }}>
                      <span style={{ fontSize: 13, color: "#202123", fontWeight: 600 }}>{d.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: d.ok ? C_teal : "#D1D5DB", animation: d.pulse ? "pulse 1.2s ease-in-out infinite" : "none" }} />
                        <span style={{ fontSize: 12, color: d.ok ? "#067A5F" : "#6B7280", fontWeight: 600 }}>{d.ok ? d.okText : d.failText}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 체크리스트 */}
              <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "18px 20px", border: "1px solid #E5E5E5", flex: 1, boxShadow: "0 8px 24px rgba(16,24,40,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>입장 전 체크</p>
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
                      <input type="checkbox" checked={item.auto || checklist[i]} onChange={() => !item.auto && setChecklist(prev => prev.map((v, j) => j === i ? !v : v))} style={{ accentColor: "#202123", width: 15, height: 15, flexShrink: 0 }} readOnly={item.auto} />
                      <span style={{ fontSize: 12, color: (item.auto || checklist[i]) ? "#4B5563" : "#9CA3AF", textDecoration: (item.auto || checklist[i]) ? "line-through" : "none" }}>{item.label}</span>
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
          borderTop: "1px solid #E5E5E5",
          background: "#FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            {step === 2 && (
              <button onClick={() => setStep(1)} style={{ padding: "10px 22px", borderRadius: 10, border: "1px solid #D1D5DB", background: "transparent", color: "#4B5563", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#9CA3AF"; e.currentTarget.style.color = "#202123"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.color = "#4B5563"; }}
              >← 이전</button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {step === 1 && (
              <button onClick={() => setStep(2)} style={{ padding: "12px 32px", borderRadius: 10, border: "1.5px solid #202123", background: "#202123", color: "#FFFFFF", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#111827"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#202123"; }}
              >장치 확인하기 →</button>
            )}
            {step === 2 && (
              <button onClick={handleEnter} disabled={entering} style={{ padding: "12px 36px", borderRadius: 10, border: "none", background: entering ? "#D1D5DB" : "#202123", color: "#fff", fontSize: 15, fontWeight: 700, cursor: entering ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "opacity 0.18s", boxShadow: entering ? "none" : "0 8px 20px rgba(16,24,40,0.14)", letterSpacing: "0.02em" }}
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
const C_teal  = "#10A37F";

const MicOnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="6" y="1" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="9" y1="14" x2="9" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const MicOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="6" y="1" width="6" height="9" rx="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="1" y1="1" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const CamOnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M13 7l4-2v8l-4-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);
const CamOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M13 7l4-2v8l-4-2V7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    <line x1="1" y1="1" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const SettingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
