import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getSession, getSessionReport, saveMentorAnswerEvaluation, saveMentorFeedback, saveMentorScore } from "../../api/sessions";
import mockAiReport from "./mockAiReport";

const USE_MOCK_REPORT = import.meta.env.VITE_USE_MOCK_REPORT === "true";

const NAVY   = "#0D2240";
const GREEN  = "#1D9E75";
const BG     = "#F4F7FA";
const CARD   = "#ffffff";
const CARD2  = "#F8FAFC";
const BORDER = "rgba(0,0,0,0.07)";
const TXT    = "#1a1b1e";
const MUTED  = "#6B7280";
const SHADOW = "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)";

const DEFAULT_SESSION_INFO = {
  title: "세션 로딩 중...",
  date: "",
  duration: "",
  type: "",
};

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StarPicker({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 24,
            color: star <= (hovered || value) ? "#F59E0B" : "#D1D5DB",
            transition: "color 0.1s, transform 0.1s",
            transform: star <= hovered ? "scale(1.2)" : "scale(1)",
            padding: 0, lineHeight: 1,
          }}
        >★</button>
      ))}
      <span style={{ marginLeft: 8, fontSize: 14, color: "#888", alignSelf: "center" }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

const TA = (extra = {}) => ({
  width: "100%", borderRadius: 8, border: "1px solid #D1D5DB",
  background: "#F9FAFB", padding: "10px 12px",
  fontSize: 13, lineHeight: 1.7, color: TXT,
  fontFamily: "inherit", resize: "vertical", outline: "none",
  transition: "border-color 0.15s, background 0.15s", boxSizing: "border-box",
  ...extra,
});

function QuestionCard({ qna, feedbacks, onChange }) {
  const fb = feedbacks[qna.id] || { score: qna.aiScore, reasoning: "", strengths: "", improvements: "", comment: "" };
  return (
    <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 14, boxShadow: SHADOW }}>
      <div style={{ background: CARD2, padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: TXT, marginBottom: 6 }}>{qna.question}</p>
        <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, fontStyle: "italic" }}>"{qna.transcript}"</p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ background: "#EFF6FF", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6", marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>AI 분석 (참고용)</p>
            <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>{qna.aiComment}</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", background: "#DBEAFE", padding: "3px 12px", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>
            AI {qna.aiScore.toFixed(1)}점
          </span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: TXT, marginBottom: 10 }}>
            멘토 별점
            <span style={{ fontSize: 11, fontWeight: 400, color: MUTED, marginLeft: 6 }}>AI 점수를 덮어씁니다</span>
          </p>
          <StarPicker value={fb.score} onChange={(v) => onChange(qna.id, "score", v)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: TXT, marginBottom: 8 }}>
            평가 근거
            <span style={{ fontSize: 11, fontWeight: 400, color: MUTED, marginLeft: 6 }}>DPO chosen reasoning</span>
          </p>
          <textarea
            value={fb.reasoning} onChange={e => onChange(qna.id, "reasoning", e.target.value)}
            placeholder="AI 평가를 현직자 관점에서 어떻게 수정했는지 근거를 작성해주세요."
            style={{ ...TA({ minHeight: 72 }) }}
            onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = "#fff"; }}
            onBlur={e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.background = "#F9FAFB"; }}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: TXT, marginBottom: 8 }}>좋은 점</p>
            <textarea value={fb.strengths} onChange={e => onChange(qna.id, "strengths", e.target.value)} placeholder="한 줄에 하나씩 작성"
              style={{ ...TA({ minHeight: 72 }) }}
              onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = "#fff"; }}
              onBlur={e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.background = "#F9FAFB"; }} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: TXT, marginBottom: 8 }}>개선할 점</p>
            <textarea value={fb.improvements} onChange={e => onChange(qna.id, "improvements", e.target.value)} placeholder="한 줄에 하나씩 작성"
              style={{ ...TA({ minHeight: 72 }) }}
              onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = "#fff"; }}
              onBlur={e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.background = "#F9FAFB"; }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMenteesFromQuestionReports(questionReports, sessionId, reportStatus) {
  const groups = new Map();

  questionReports.forEach((report, index) => {
    const menteeId = report.mentee_id || `session-${sessionId}`;
    const menteeName = report.mentee_name || "면접 참여자";
    if (!groups.has(menteeId)) {
      groups.set(menteeId, {
        menteeId,
        menteeName,
        menteeTrack: reportStatus === "final" ? "최종 리포트" : "1차 AI 리포트",
        qnas: [],
      });
    }

    groups.get(menteeId).qnas.push({
      id: report.answer_id || `${report.question_id}-${menteeId}-${index}`,
      questionId: report.question_id,
      answerId: report.answer_id,
      question: `Q${index + 1} · ${report.question}`,
      aiScore: Math.max(1, Math.min(5, Number(report.score || 0) / 2)),
      aiComment: report.reasoning || "",
      transcript: report.answer || "",
      strengths: report.strengths || [],
      improvements: report.improvements || [],
    });
  });

  return Array.from(groups.values());
}

export default function MentorFeedbackPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const [sessionInfo, setSessionInfo] = useState(DEFAULT_SESSION_INFO);
  const [menteeList, setMenteeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMenteeIdx, setCurrentMenteeIdx] = useState(0);

  // { [menteeId]: { feedbacks: {qId: {score, comment}}, totalFeedback: "", mentorScore: 4.0 } }
  const [allFeedbacks, setAllFeedbacks] = useState({});
  const [sentMentees, setSentMentees] = useState(new Set());
  const [isSending, setIsSending] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);

  // 1-hour countdown
  const [timeLeft, setTimeLeft] = useState(3600);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    /* 더미 데이터 (로컬 UI 확인용) */
    if (!sessionId || !/^\d+$/.test(sessionId)) {
      setSessionInfo({ title: "네이버 백엔드 모의 면접", date: "2026-06-01 14:00", duration: "45분", type: "1:1" });
      setMenteeList([{
        menteeId: "dummy-1",
        menteeName: "이멘티",
        menteeTrack: "1차 AI 리포트",
        qnas: [
          { id: "q1", questionId: 1, answerId: null, question: "Q1 · Spring Boot와 JPA를 사용하면서 N+1 문제를 경험한 적 있나요?", aiScore: 3.5, aiComment: "문제 인식은 명확하나 해결 방안이 구체적이지 않습니다.", transcript: "네, N+1 문제를 경험했습니다. Fetch 타입을 LAZY로 설정하고 필요 시 fetch join을 사용했습니다.", strengths: ["문제 인식 명확"], improvements: ["해결 방안 수치 근거 부족"] },
          { id: "q2", questionId: 2, answerId: null, question: "Q2 · 대용량 트래픽 처리를 위한 설계 방식은?", aiScore: 2.5, aiComment: "경험 기반 답변이 부족합니다.", transcript: "캐싱과 로드밸런서를 활용할 것 같습니다.", strengths: ["방향성 적절"], improvements: ["실제 경험 기반 답변 필요", "수치 근거 부족"] },
        ],
      }]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [sessionData, reportData] = await Promise.allSettled([
          getSession(sessionId),
          getSessionReport(sessionId),
        ]);

        if (cancelled) return;

        if (sessionData.status === "fulfilled" && sessionData.value) {
          const s = sessionData.value;
          setSessionInfo({
            title: s.title || `세션 #${sessionId}`,
            date: s.scheduledAt ? s.scheduledAt.slice(0, 16).replace("T", " ") : "",
            duration: s.duration || "",
            type: s.sessionType || "1:1",
          });
        }

        const reportValue = reportData.status === "fulfilled" ? reportData.value : null;
        const questionReports = reportValue?.ai_report?.question_reports
          || (USE_MOCK_REPORT ? mockAiReport.ai_report?.question_reports : null)
          || [];

        if (reportValue?.mentees?.length) {
          setMenteeList(reportValue.mentees);
        } else if (questionReports.length) {
          setMenteeList(buildMenteesFromQuestionReports(
            questionReports,
            sessionId,
            reportValue?.report_status || "first",
          ));
        }
      } catch {}
      if (!cancelled) setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Init per-mentee feedback state
  useEffect(() => {
    const init = {};
    menteeList.forEach(m => {
      const fb = {};
      m.qnas.forEach(q => {
        fb[q.id] = {
          score: q.aiScore,
          reasoning: q.aiComment || "",
          strengths: (q.strengths || []).join("\n"),
          improvements: (q.improvements || []).join("\n"),
          comment: "",
        };
      });
      init[m.menteeId] = { feedbacks: fb, totalFeedback: "", mentorScore: 4.0 };
    });
    setAllFeedbacks(init);
  }, [menteeList]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const currentMentee = menteeList[currentMenteeIdx];
  const currentFbData = allFeedbacks[currentMentee?.menteeId] || { feedbacks: {}, totalFeedback: "", mentorScore: 4.0 };

  const updateCurrentFb = (updater) => {
    setAllFeedbacks(prev => ({
      ...prev,
      [currentMentee.menteeId]: updater(prev[currentMentee.menteeId] || { feedbacks: {}, totalFeedback: "", mentorScore: 4.0 }),
    }));
  };

  const handleQnaChange = (qId, field, value) => {
    updateCurrentFb(fb => ({
      ...fb,
      feedbacks: { ...fb.feedbacks, [qId]: { ...(fb.feedbacks[qId] || {}), [field]: value } },
    }));
    if (field === "score") {
      const qna = currentMentee?.qnas.find(q => q.id === qId);
      if (qna?.answerId) {
        saveMentorScore(sessionId, qna.questionId || qId, qna.answerId, value).catch(() => {});
      }
    }
  };

  const handleTotalFeedbackChange = (val) => {
    updateCurrentFb(fb => ({ ...fb, totalFeedback: val }));
  };

  const handleMentorScoreChange = (val) => {
    updateCurrentFb(fb => ({ ...fb, mentorScore: val }));
  };

  const TEMPLATES = [
    { label: "강점 어필 권장", color: GREEN, bg: "#E1F5EE", text: "기술 스택 이해도는 탄탄합니다. 다음 면접에서는 경험 기반 근거를 수치와 함께 제시하면 더욱 설득력 있는 답변이 될 것입니다." },
    { label: "속도·명확성 개선", color: "#9B1C1C", bg: "#FFF5F5", text: "말하기 속도를 130~150 WPM으로 맞추는 연습을 권장합니다. 타이머를 사용해 답변을 녹음하고 자가 점검해 보세요." },
    { label: "STAR 구조 보완", color: "#92400E", bg: "#FEF3C7", text: "답변의 R(결과) 구간을 강화해주세요. '그래서 어떤 성과가 있었나요?'라는 질문에 항상 수치로 답할 수 있도록 준비해오세요." },
    { label: "다음 세션 목표", color: "#185FA5", bg: "#E6F1FB", text: "다음 세션 목표: MSA 관련 학습 경험 1개 이상 준비, CS 기초 꼬리 질문 대비를 중점으로 준비해오세요." },
  ];

  const insertTemplate = (tpl) => {
    const prev = currentFbData.totalFeedback;
    handleTotalFeedbackChange((prev ? prev + "\n\n" : "") + tpl.text);
    setActiveTemplate(tpl.label);
    setTimeout(() => setActiveTemplate(null), 1500);
  };

  const handleSendCurrent = async () => {
    if (!currentFbData.totalFeedback.trim()) {
      alert(`${currentMentee.menteeName}에게 보낼 총 피드백을 작성해주세요.`);
      return;
    }
    setIsSending(true);
    try {
      await Promise.all(currentMentee.qnas
        .filter((qna) => qna.answerId)
        .map((qna) => {
          const fb = currentFbData.feedbacks[qna.id] || {};
          return saveMentorAnswerEvaluation(sessionId, qna.answerId, {
            reasoning: fb.reasoning || fb.comment || "멘토가 점수와 피드백을 검토했습니다.",
            score: Number(fb.score || qna.aiScore || 0) * 2,
            strengths: splitLines(fb.strengths),
            improvements: splitLines(fb.improvements),
          });
        }));
      await saveMentorFeedback(sessionId, currentFbData.totalFeedback);
    } catch {}
    const newSent = new Set([...sentMentees, currentMentee.menteeId]);
    setSentMentees(newSent);
    setIsSending(false);
    // Auto-advance to next unsent mentee
    const nextIdx = menteeList.findIndex((m, i) => i > currentMenteeIdx && !newSent.has(m.menteeId));
    if (nextIdx !== -1) setCurrentMenteeIdx(nextIdx);
  };

  const splitLines = (text) => (text || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const allSent = menteeList.length > 0 && menteeList.every(m => sentMentees.has(m.menteeId));

  const avgQScore = Object.values(currentFbData.feedbacks).length > 0
    ? (Object.values(currentFbData.feedbacks).reduce((a, b) => a + b.score, 0) / Object.values(currentFbData.feedbacks).length).toFixed(1)
    : "-";

  const timerColor = timeLeft < 300 ? "#EF4444" : timeLeft < 900 ? "#F59E0B" : GREEN;
  const timerUrgent = timeLeft < 300;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, border: `3px solid ${GREEN}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6B7280", fontSize: 14 }}>세션 리포트를 불러오는 중...</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (menteeList.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ textAlign: "center", background: CARD, borderRadius: 20, padding: "40px 48px", border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: TXT, marginBottom: 8 }}>아직 리포트가 없습니다</p>
          <p style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>면접 종료 후 AI 리포트가 생성되면 피드백을 작성할 수 있습니다.</p>
          <button onClick={() => navigate("/dashboard/mentor")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: NAVY, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(13,34,64,0.3)" }}>
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      {timerUrgent && (
        <style>{`@keyframes pulse-border{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.4)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}`}</style>
      )}

      {/* Header */}
      <header style={{
        background: NAVY, padding: "0 32px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* 좌측: 로고 + 페이지명 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/dashboard/mentor" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 12L2 8l4-4M10 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 500 }}>대시보드</span>
          </Link>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>/</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN }} />
            <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>멘토 최종 코멘트 작성</span>
          </div>
        </div>

        {/* 우측: 타이머 + 진행 상황 */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Countdown */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: timeLeft < 300 ? "rgba(239,68,68,0.15)" : timeLeft < 900 ? "rgba(245,158,11,0.15)" : "rgba(29,158,117,0.15)",
            border: `1px solid ${timerColor}40`, borderRadius: 10, padding: "6px 16px",
            animation: timerUrgent ? "pulse-border 1.5s ease-in-out infinite" : "none",
          }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>⏱ 남은 시간</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: timerColor, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#93C5FD", fontSize: 12 }}>{sessionInfo.title}</p>
            <p style={{ color: "#60A5FA", fontSize: 11 }}>
              {sentMentees.size} / {menteeList.length}명 전송 완료
            </p>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Mentee tabs */}
        <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, marginBottom: 20, overflow: "hidden", boxShadow: SHADOW }}>
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: TXT }}>멘티 선택</p>
            <p style={{ fontSize: 11, color: MUTED }}>멘티별로 피드백 작성 후 각각 전송해주세요</p>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {menteeList.map((m, i) => {
              const isSent = sentMentees.has(m.menteeId);
              const isActive = i === currentMenteeIdx;
              return (
                <button key={m.menteeId} onClick={() => setCurrentMenteeIdx(i)} style={{
                  padding: "7px 16px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                  border: isActive ? `2px solid ${NAVY}` : `1px solid ${isSent ? GREEN + "60" : "#D1D5DB"}`,
                  background: isActive ? NAVY : isSent ? "#E6FDF5" : "#fff",
                  color: isActive ? "white" : isSent ? GREEN : "#555",
                  cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                }}>
                  {isSent && <span>✓</span>}
                  {m.menteeName}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>{m.menteeTrack.split(" · ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mentee info banner */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "18px 22px", marginBottom: 24, display: "flex", alignItems: "center", gap: 18, boxShadow: SHADOW }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#0D2240,#1B4F7A)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
            {currentMentee?.menteeName.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: TXT, marginBottom: 3 }}>{currentMentee?.menteeName}</p>
            <p style={{ fontSize: 12, color: MUTED }}>{currentMentee?.menteeTrack}</p>
          </div>
          {[["면접 일시", sessionInfo.date], ["세션 유형", sessionInfo.type], ["진행 시간", sessionInfo.duration]].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center", background: CARD2, borderRadius: 10, padding: "8px 14px", border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 10, color: MUTED, marginBottom: 3 }}>{k}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: TXT }}>{v}</p>
            </div>
          ))}
          {sentMentees.has(currentMentee?.menteeId) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#E6FDF5", border: `1px solid ${GREEN}50`, borderRadius: 99, padding: "6px 14px", flexShrink: 0 }}>
              <span style={{ color: GREEN }}>✓</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>전송 완료</span>
            </div>
          )}
        </div>

        {/* Section 1 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#0D2240,#1B4F7A)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>1</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: TXT }}>질문별 멘토 평가 수정</p>
              <p style={{ fontSize: 11, color: MUTED }}>AI 초안은 보존하고, 멘토의 점수·근거·좋은 점·개선점을 수정본으로 저장합니다</p>
            </div>
            <div style={{ marginLeft: "auto", background: CARD2, borderRadius: 99, padding: "4px 14px", border: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 11, color: MUTED }}>Q 평균 </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{avgQScore}</span>
            </div>
          </div>
          {currentMentee?.qnas.map((qna) => (
            <QuestionCard key={qna.id} qna={qna} feedbacks={currentFbData.feedbacks} onChange={handleQnaChange} />
          ))}
        </div>

        {/* Section 2 */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 22px", marginBottom: 14, boxShadow: SHADOW }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#0D2240,#1B4F7A)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>2</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: TXT }}>멘토 종합 평점</p>
              <p style={{ fontSize: 11, color: MUTED }}>이 멘티의 전체 면접 역량에 대한 최종 평점</p>
            </div>
          </div>
          <StarPicker value={currentFbData.mentorScore} onChange={handleMentorScoreChange} />
        </div>

        {/* Section 3 */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 22px", marginBottom: 24, boxShadow: SHADOW }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#0D2240,#1B4F7A)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>3</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: TXT }}>멘토 총 피드백</p>
              <p style={{ fontSize: 11, color: MUTED }}>최종 리포트 맨 하단에 추가되어 멘티에게 전달됩니다</p>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {TEMPLATES.map((tpl) => (
              <button key={tpl.label} type="button" onClick={() => insertTemplate(tpl)} style={{
                fontSize: 11, padding: "5px 12px", borderRadius: 99,
                border: `1px solid ${tpl.color}40`,
                background: activeTemplate === tpl.label ? tpl.color : tpl.bg,
                color: activeTemplate === tpl.label ? "white" : tpl.color,
                fontWeight: 600, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
              }}>+ {tpl.label}</button>
            ))}
          </div>
          <textarea
            value={currentFbData.totalFeedback}
            onChange={e => handleTotalFeedbackChange(e.target.value)}
            placeholder="전반적인 면접 인상, 강점, 개선 포인트, 다음 세션 전 준비사항 등을 자유롭게 작성해주세요."
            style={{ ...TA({ minHeight: 150, fontSize: 14, lineHeight: 1.8 }) }}
            onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.background = "#fff"; }}
            onBlur={e => { e.target.style.borderColor = "#D1D5DB"; e.target.style.background = "#F9FAFB"; }}
          />
          <p style={{ textAlign: "right", fontSize: 11, color: MUTED, marginTop: 6 }}>{currentFbData.totalFeedback.length}자</p>
        </div>

        {/* Send button */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, marginBottom: allSent ? 14 : 0, boxShadow: SHADOW }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: TXT }}>{currentMentee?.menteeName}에게 최종 리포트 전송</p>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>전송 후 멘티 마이페이지에 자동 전달됩니다</p>
          </div>
          {sentMentees.has(currentMentee?.menteeId) ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#E6FDF5", border: `1px solid ${GREEN}50`, borderRadius: 10, padding: "12px 24px" }}>
              <span style={{ color: GREEN, fontSize: 16 }}>✓</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>전송 완료</span>
            </div>
          ) : (
            <button type="button" onClick={handleSendCurrent} disabled={isSending} style={{
              padding: "12px 26px", borderRadius: 10, border: "none",
              background: isSending ? "#D1D5DB" : NAVY, color: "white",
              fontSize: 14, fontWeight: 700, cursor: isSending ? "not-allowed" : "pointer",
              boxShadow: isSending ? "none" : "0 4px 12px rgba(13,34,64,0.3)",
              transition: "all 0.2s", whiteSpace: "nowrap",
            }}>
              {isSending ? "전송 중..." : `${currentMentee?.menteeName}에게 전송 →`}
            </button>
          )}
        </div>

        {allSent && (
          <div style={{ background: "#E6FDF5", border: `1px solid ${GREEN}40`, borderRadius: 14, padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>모든 멘티에게 피드백 전송 완료!</p>
              <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{menteeList.length}명의 멘티 모두에게 최종 리포트가 전달됐습니다.</p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/mentor")} style={{
              padding: "12px 22px", borderRadius: 10, border: "none",
              background: GREEN, color: "white", fontSize: 14, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(29,158,117,0.3)",
            }}>
              대시보드로 이동 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
