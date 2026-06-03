import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getQuestionAnswers, getSession, getSessionReport, saveMentorFeedback } from "../../api/sessions";
import mockAiReport from "./mockAiReport";
import { createDemoFallbackReport } from "./AIReport";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_REPORT === "true";

function autoResize(e) {
  const el = e.target;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

const NAVY = "#0D2240";
const GREEN = "#0CA678";
const BG = "#F0F4F8";
const CARD = "#FFFFFF";
const PRIMARY_GRAD = "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)";

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
  const displayValue = Number.isFinite(Number(value)) ? Number(value) : 0;
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
            color: star <= (hovered || displayValue) ? "#F59E0B" : "#D1D5DB",
            transition: "color 0.1s, transform 0.1s",
            transform: star <= hovered ? "scale(1.2)" : "scale(1)",
            padding: 0, lineHeight: 1,
          }}
        >★</button>
      ))}
      <span style={{ marginLeft: 8, fontSize: 14, color: "#888", alignSelf: "center" }}>
        {displayValue.toFixed(1)}
      </span>
    </div>
  );
}

function QuestionCard({ qna, feedbacks, onChange }) {
  const fb = feedbacks[qna.id] || { score: qna.mentorScore ?? qna.aiScore, reasoning: "", strengths: "", improvements: "", comment: "" };
  return (
    <div style={{ background: CARD, borderRadius: 14, border: "1px solid #E9ECEF", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ background: "#d4e7f2ca", padding: "14px 20px", borderBottom: "1px solid #7DD3FC" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#0C4A6E", marginBottom: 6 }}>{qna.question}</p>
        <p style={{ fontSize: 12, color: "#0369A1", lineHeight: 1.6, fontStyle: "italic" }}>"{qna.transcript}"</p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#14532D", marginBottom: 4, letterSpacing: "0.5px" }}>AI 분석 (참고용)</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 12, color: "#166534" }}>{qna.aiComment}</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#14532D", background: "#DCFCE7", padding: "2px 10px", borderRadius: 99, whiteSpace: "nowrap", marginLeft: 12 }}>
              AI {qna.aiScore.toFixed(1)}점
            </span>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 10 }}>
            멘토 별점
            <span style={{ fontSize: 11, fontWeight: 400, color: "#999", marginLeft: 6 }}>AI 점수를 덮어씁니다</span>
          </p>
          <StarPicker value={fb.score} onChange={(v) => onChange(qna.id, "score", v)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 8 }}>
            평가 근거
            <span style={{ fontSize: 11, fontWeight: 400, color: "#999", marginLeft: 6 }}>DPO chosen reasoning</span>
          </p>
          <textarea
            value={fb.reasoning}
            onChange={(e) => onChange(qna.id, "reasoning", e.target.value)}
            onInput={autoResize}
            placeholder="AI 평가를 현직자 관점에서 어떻게 수정했는지 근거를 작성해주세요."
            style={{
              width: "100%", borderRadius: 8, border: "1px solid #D1D5DB",
              padding: "10px 12px", fontSize: 13, lineHeight: 1.7, color: "#333",
              fontFamily: "inherit", resize: "none", overflow: "hidden", outline: "none",
              minHeight: 72, transition: "border-color 0.15s", boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = GREEN)}
            onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 8 }}>좋은 점</p>
            <textarea
              value={fb.strengths}
              onChange={(e) => onChange(qna.id, "strengths", e.target.value)}
              onInput={autoResize}
              placeholder="한 줄에 하나씩 작성"
              style={{ width: "100%", minHeight: 72, borderRadius: 8, background: "#FFFFFF", border: "1.5px solid #D1D5DB", padding: "10px 12px", fontSize: 13, lineHeight: 1.7, color: "#333", fontFamily: "inherit", resize: "none", overflow: "hidden", boxSizing: "border-box", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 8 }}>개선할 점</p>
            <textarea
              value={fb.improvements}
              onChange={(e) => onChange(qna.id, "improvements", e.target.value)}
              onInput={autoResize}
              placeholder="한 줄에 하나씩 작성"
              style={{ width: "100%", minHeight: 72, borderRadius: 8, background: "#FFFFFF", border: "1.5px solid #D1D5DB", padding: "10px 12px", fontSize: 13, lineHeight: 1.7, color: "#333", fontFamily: "inherit", resize: "none", overflow: "hidden", boxSizing: "border-box", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function buildEvaluationMap(answerEvaluations = []) {
  const byAnswerId = new Map();
  const byQuestionMentee = new Map();
  answerEvaluations.forEach((evaluation) => {
    const answerId = evaluation?.answer_id ?? evaluation?.answerId;
    const questionId = evaluation?.question_id ?? evaluation?.questionId;
    const menteeId = evaluation?.mentee_id ?? evaluation?.menteeId;
    if (answerId != null) byAnswerId.set(String(answerId), evaluation);
    if (questionId != null && menteeId != null) {
      byQuestionMentee.set(`${questionId}:${menteeId}`, evaluation);
    }
  });
  return { byAnswerId, byQuestionMentee };
}

function toFivePointMentorScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return null;
  const fivePoint = numeric > 5 ? numeric / 2 : numeric;
  return Math.max(1, Math.min(5, fivePoint));
}

function toApiMentorScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return null;
  const fivePoint = numeric > 5 ? numeric / 2 : numeric;
  return Math.max(1, Math.min(5, fivePoint));
}

function buildMenteesFromQuestionReports(
  questionReports,
  sessionId,
  reportStatus,
  answerEvaluations = [],
  mentorFeedback = "",
  reportMentorScore = null,
  menteeReportFeedbacks = []
) {
  const groups = new Map();
  const { byAnswerId: evaluationsByAnswerId, byQuestionMentee: evaluationsByQuestionMentee } = buildEvaluationMap(answerEvaluations);
  const reportMenteeKeys = new Set(
    questionReports
      .map((report) => report?.mentee_id ?? report?.menteeId ?? report?.mentee_name ?? report?.menteeName)
      .filter((menteeKey) => menteeKey != null)
      .map(String)
  );
  const isGroupReport = reportMenteeKeys.size > 1;
  const feedbackByMentee = new Map();
  menteeReportFeedbacks.forEach((feedback) => {
    const menteeId = feedback?.mentee_id ?? feedback?.menteeId;
    if (menteeId != null) feedbackByMentee.set(String(menteeId), feedback);
  });

  questionReports.forEach((report, index) => {
    const menteeName = report.mentee_name || report.menteeName || "면접 참여자";
    const menteeId = report.mentee_id ?? report.menteeId ?? menteeName ?? `session-${sessionId}`;
    const menteeFeedback = feedbackByMentee.get(String(menteeId));
    if (!groups.has(menteeId)) {
      groups.set(menteeId, {
        menteeId,
        menteeName,
        menteeTrack: menteeFeedback || reportStatus === "final" ? "최종 리포트" : "1차 AI 리포트",
        mentorFeedback: menteeFeedback?.mentor_feedback ?? menteeFeedback?.mentorFeedback ?? (isGroupReport ? "" : mentorFeedback),
        mentorScore: menteeFeedback?.mentor_score ?? menteeFeedback?.mentorScore ?? (isGroupReport ? null : reportMentorScore),
        qnas: [],
      });
    }

    const evaluation = evaluationsByAnswerId.get(String(report.answer_id))
      || evaluationsByQuestionMentee.get(`${report.question_id}:${menteeId}`);
    const mentorReasoning = evaluation?.mentor_reasoning ?? evaluation?.mentorReasoning;
    const mentorScore = evaluation?.mentor_score ?? evaluation?.mentorScore;
    const mentorStrengths = evaluation?.mentor_strengths ?? evaluation?.mentorStrengths;
    const mentorImprovements = evaluation?.mentor_improvements ?? evaluation?.mentorImprovements;
    const aiScore = evaluation?.ai_score ?? evaluation?.aiScore ?? report.score;
    const aiReasoning = evaluation?.ai_reasoning ?? evaluation?.aiReasoning ?? report.reasoning;
    const aiStrengths = evaluation?.ai_strengths ?? evaluation?.aiStrengths ?? report.strengths;
    const aiImprovements = evaluation?.ai_improvements ?? evaluation?.aiImprovements ?? report.improvements;

    groups.get(menteeId).qnas.push({
      id: report.answer_id || `${report.question_id}-${menteeId}-${index}`,
      questionId: report.question_id,
      answerId: report.answer_id,
      audioUrl: report.replay?.audio_url ?? report.replay?.audioUrl ?? null,
      question: `Q${groups.get(menteeId).qnas.length + 1} · ${report.question}`,
      questionText: report.question || "",
      aiScore: toFivePointMentorScore(aiScore) ?? 3,
      aiComment: aiReasoning || "",
      transcript: report.answer || "",
      strengths: aiStrengths || [],
      improvements: aiImprovements || [],
      mentorScore: toFivePointMentorScore(mentorScore),
      mentorReasoning: mentorReasoning || "",
      mentorStrengths: Array.isArray(mentorStrengths) ? mentorStrengths : [],
      mentorImprovements: Array.isArray(mentorImprovements) ? mentorImprovements : [],
    });
  });

  return Array.from(groups.values()).map((mentee) => {
    const mentorScores = mentee.qnas
      .map((qna) => qna.mentorScore)
      .filter((score) => Number.isFinite(Number(score)));
    return {
      ...mentee,
      mentorScore: Number.isFinite(Number(mentee.mentorScore))
        ? Number(mentee.mentorScore)
        : mentorScores.length
        ? mentorScores.reduce((sum, score) => sum + Number(score), 0) / mentorScores.length
        : null,
    };
  });
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
  const [usesLocalFallbackReport, setUsesLocalFallbackReport] = useState(false);

  const applyReportData = (data) => {
    if (data?.__mock) {
      setUsesLocalFallbackReport(true);
    }
    if (data?.mentees?.length) {
      setMenteeList(data.mentees);
      return;
    }

    const questionReports = data?.ai_report?.question_reports || [];
    if (questionReports.length) {
      setMenteeList(buildMenteesFromQuestionReports(
        questionReports,
        sessionId,
        data?.report_status,
        data?.answer_evaluations || [],
        data?.mentor_feedback || "",
        data?.mentor_score ?? null,
        data?.mentee_report_feedbacks || data?.menteeReportFeedbacks || []
      ));
    }
  };

  // 1-hour countdown
  const [timeLeft, setTimeLeft] = useState(3600);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
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

        if (reportData.status === "fulfilled" && reportData.value) {
          applyReportData(reportData.value);
        } else {
          applyReportData(await createDemoFallbackReport(sessionId, "mentor"));
        }
      } catch {
        applyReportData(await createDemoFallbackReport(sessionId, "mentor"));
      }
      if (!cancelled) setLoading(false);
    };

    fetchData();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Init per-mentee feedback state
  useEffect(() => {
    setAllFeedbacks(prev => {
      const next = {};
      menteeList.forEach(m => {
        const existing = prev[m.menteeId];
        const fb = {};
        m.qnas.forEach(q => {
          fb[q.id] = existing?.feedbacks?.[q.id] ?? {
            score: q.mentorScore ?? q.aiScore,
            reasoning: q.mentorReasoning || q.aiComment || "",
            strengths: ((q.mentorStrengths || []).length ? q.mentorStrengths : (q.strengths || [])).join("\n"),
            improvements: ((q.mentorImprovements || []).length ? q.mentorImprovements : (q.improvements || [])).join("\n"),
            comment: "",
          };
        });
        next[m.menteeId] = {
          feedbacks: fb,
          totalFeedback: existing?.totalFeedback ?? m.mentorFeedback ?? "",
          mentorScore: existing?.mentorScore ?? m.mentorScore ?? 4.0,
        };
      });
      return next;
    });
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
  };

  const handleTotalFeedbackChange = (val) => {
    updateCurrentFb(fb => ({ ...fb, totalFeedback: val }));
  };

  const handleMentorScoreChange = (val) => {
    updateCurrentFb(fb => ({ ...fb, mentorScore: val }));
  };

  const currentMenteeTarget = () => {
    const numericId = Number(currentMentee?.menteeId);
    return {
      menteeId: Number.isInteger(numericId) ? numericId : null,
      menteeName: currentMentee?.menteeName || null,
    };
  };

  const resolveAnswerId = async (qna) => {
    if (qna.answerId) return qna.answerId;
    if (usesLocalFallbackReport || !qna.questionId) return null;

    const answers = await getQuestionAnswers(sessionId, qna.questionId).catch(() => []);
    const matched = answers.find((answer) =>
      String(answer.mentee_id ?? answer.menteeId ?? "") === String(currentMentee?.menteeId ?? "")
    ) || answers[0];

    return matched?.id ?? null;
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
    const wasAlreadySent = sentMentees.has(currentMentee.menteeId);
    const markCurrentAsSent = () => {
      const newSent = new Set([...sentMentees, currentMentee.menteeId]);
      setSentMentees(newSent);
      if (!wasAlreadySent) {
        const nextIdx = menteeList.findIndex((m, i) => i > currentMenteeIdx && !newSent.has(m.menteeId));
        if (nextIdx !== -1) setCurrentMenteeIdx(nextIdx);
      }
    };

    setIsSending(true);
    if (usesLocalFallbackReport) {
      try {
        const answerEvaluations = currentMentee.qnas
          .map((qna) => {
            const fb = currentFbData.feedbacks[qna.id] || {};
            const score = Number.isFinite(Number(fb.score))
              ? Number(fb.score)
              : qna.mentorScore ?? qna.aiScore;
            return {
              answer_id: qna.answerId ?? null,
              question_id: qna.questionId ?? null,
              mentee_id: currentMenteeTarget().menteeId,
              mentee_name: currentMenteeTarget().menteeName,
              question_text: qna.questionText || qna.question?.replace(/^Q\d+\s*[·.-]\s*/, "") || "",
              answer_text: qna.transcript || "",
              reasoning: fb.reasoning || fb.comment || "멘토가 점수와 피드백을 검토했습니다.",
              score: toApiMentorScore(score),
              strengths: splitLines(fb.strengths),
              improvements: splitLines(fb.improvements),
            };
          });
        await saveMentorFeedback(
          sessionId,
          currentFbData.totalFeedback,
          currentFbData.mentorScore,
          answerEvaluations,
          currentMenteeTarget()
        );
        const latestReport = await getSessionReport(sessionId);
        applyReportData(latestReport);
        markCurrentAsSent();
        setIsSending(false);
        return;
      } catch (error) {
        alert(error?.message || "최종 리포트 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        setIsSending(false);
        return;
      }
    }

    try {
      const answerEvaluations = await Promise.all(currentMentee.qnas
        .map(async (qna) => {
          const answerId = await resolveAnswerId(qna);
          const fb = currentFbData.feedbacks[qna.id] || {};
          const score = Number.isFinite(Number(fb.score))
            ? Number(fb.score)
            : qna.mentorScore ?? qna.aiScore;
          return {
            answer_id: answerId ?? null,
            question_id: qna.questionId ?? null,
            mentee_id: currentMenteeTarget().menteeId,
            mentee_name: currentMenteeTarget().menteeName,
            question_text: qna.questionText || qna.question?.replace(/^Q\d+\s*[·.-]\s*/, "") || "",
            answer_text: qna.transcript || "",
            reasoning: fb.reasoning || fb.comment || "멘토가 점수와 피드백을 검토했습니다.",
            score: toApiMentorScore(score),
            strengths: splitLines(fb.strengths),
            improvements: splitLines(fb.improvements),
          };
        }));
      await saveMentorFeedback(
        sessionId,
        currentFbData.totalFeedback,
        currentFbData.mentorScore,
        answerEvaluations,
        currentMenteeTarget()
      );
      const latestReport = await getSessionReport(sessionId);
      applyReportData(latestReport);
    } catch (error) {
      alert(error?.message || "최종 리포트 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setIsSending(false);
      return;
    }
    markCurrentAsSent();
    setIsSending(false);
  };

  const splitLines = (text) => (text || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const allSent = menteeList.length > 0 && menteeList.every(m => sentMentees.has(m.menteeId));
  const currentSent = sentMentees.has(currentMentee?.menteeId);

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
          <p style={{ color: "#666", fontSize: 14 }}>세션 리포트를 불러오는 중...</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (menteeList.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: NAVY, marginBottom: 8 }}>아직 리포트가 없습니다</p>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 24 }}>면접 종료 후 AI 리포트가 생성되면 피드백을 작성할 수 있습니다.</p>
          <button onClick={() => navigate("/dashboard/mentor")} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: NAVY, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
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
        background: CARD, padding: "0 5%", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: PRIMARY_GRAD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(13,34,64,0.3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#1A1B1E", letterSpacing: "-0.03em" }}>Scene<span style={{ color: NAVY }}>A</span></span>
          <span style={{ color: "#E9ECEF", fontSize: 18 }}>|</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN }} />
            <span style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>멘토 최종 코멘트 작성</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: timeLeft < 300 ? "#FFF5F5" : timeLeft < 900 ? "#FFFBEB" : "#F0FDF4",
            border: `1px solid ${timerColor}40`, borderRadius: 10, padding: "6px 14px",
            animation: timerUrgent ? "pulse-border 1.5s ease-in-out infinite" : "none",
          }}>
            <span style={{ fontSize: 11, color: "#868E96" }}>⏱ 남은 시간</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: timerColor, fontVariantNumeric: "tabular-nums" }}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: NAVY, fontSize: 12, fontWeight: 600, margin: 0 }}>{sessionInfo.title}</p>
            <p style={{ color: "#868E96", fontSize: 11, margin: 0 }}>{sentMentees.size} / {menteeList.length}명 전송 완료</p>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Mentee tabs */}
        <div style={{ background: CARD, borderRadius: 16, border: "1px solid #E9ECEF", marginBottom: 24, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #E9ECEF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>멘티 선택</p>
            <p style={{ fontSize: 11, color: "#888" }}>멘티별로 피드백 작성 후 각각 전송해주세요</p>
          </div>
          <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {menteeList.map((m, i) => {
              const isSent = sentMentees.has(m.menteeId);
              const isActive = i === currentMenteeIdx;
              return (
                <button
                  key={m.menteeId}
                  onClick={() => setCurrentMenteeIdx(i)}
                  style={{
                    padding: "8px 16px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                    border: isActive ? `2px solid ${NAVY}` : `1px solid ${isSent ? GREEN + "60" : "#D1D5DB"}`,
                    background: isActive ? NAVY : isSent ? "#E1F5EE" : "white",
                    color: isActive ? "white" : isSent ? GREEN : "#555",
                    cursor: "pointer", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {isSent && <span>✓</span>}
                  {m.menteeName}
                  <span style={{ fontSize: 10, opacity: 0.65 }}>{m.menteeTrack.split(" · ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mentee info banner */}
        <div style={{ background: CARD, border: "1px solid #E9ECEF", borderRadius: 16, padding: "20px 24px", marginBottom: 28, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
            {currentMentee?.menteeName.slice(0, 1)}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: "#111", marginBottom: 4 }}>{currentMentee?.menteeName}</p>
            <p style={{ fontSize: 13, color: "#888" }}>{currentMentee?.menteeTrack}</p>
          </div>
          {[["면접 일시", sessionInfo.date], ["세션 유형", sessionInfo.type], ["진행 시간", sessionInfo.duration]].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#999", marginBottom: 3 }}>{k}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{v}</p>
            </div>
          ))}
          {sentMentees.has(currentMentee?.menteeId) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#E1F5EE", border: `1px solid ${GREEN}60`, borderRadius: 99, padding: "6px 14px", flexShrink: 0 }}>
              <span style={{ color: GREEN }}>✓</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>전송 완료</span>
            </div>
          )}
        </div>

        {/* Section 1: Per-question feedback */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: NAVY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>1</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>질문별 멘토 평가 수정</p>
              <p style={{ fontSize: 12, color: "#888" }}>AI 초안은 보존하고, 멘토의 점수·근거·좋은 점·개선점을 DPO용 수정본으로 저장합니다</p>
            </div>
            <div style={{ marginLeft: "auto", background: "#D6E4F0", borderRadius: 99, padding: "4px 14px" }}>
              <span style={{ fontSize: 12, color: "#888" }}>Q 평균 </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{avgQScore}</span>
            </div>
          </div>
          {currentMentee?.qnas.map((qna) => (
            <QuestionCard key={qna.id} qna={qna} feedbacks={currentFbData.feedbacks} onChange={handleQnaChange} />
          ))}
        </div>

        {/* Section 2: Overall score */}
        <div style={{ background: CARD, border: "1px solid #E9ECEF", borderRadius: 14, padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: NAVY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>2</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>멘토 종합 평점</p>
              <p style={{ fontSize: 12, color: "#888" }}>이 멘티의 전체 면접 역량에 대한 최종 평점</p>
            </div>
          </div>
          <StarPicker value={currentFbData.mentorScore} onChange={handleMentorScoreChange} />
        </div>

        {/* Section 3: Total feedback */}
        <div style={{ background: CARD, border: "1px solid #E9ECEF", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: NAVY, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>3</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>멘토 총 피드백</p>
              <p style={{ fontSize: 12, color: "#888" }}>최종 리포트 맨 하단에 추가되어 멘티에게 전달됩니다</p>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {TEMPLATES.map((tpl) => (
              <button key={tpl.label} type="button" onClick={() => insertTemplate(tpl)} style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 99,
                border: `1px solid ${tpl.color}30`,
                background: activeTemplate === tpl.label ? tpl.color : tpl.bg,
                color: activeTemplate === tpl.label ? "white" : tpl.color,
                fontWeight: 600, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
              }}>+ {tpl.label}</button>
            ))}
          </div>
          <textarea
            value={currentFbData.totalFeedback}
            onChange={(e) => handleTotalFeedbackChange(e.target.value)}
            onInput={autoResize}
            placeholder="전반적인 면접 인상, 강점, 개선 포인트, 다음 세션 전 준비사항 등을 자유롭게 작성해주세요."
            style={{
              width: "100%", borderRadius: 10, border: "1.5px solid #D1D5DB",
              background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              padding: "14px 16px", fontSize: 14, lineHeight: 1.8, color: "#333",
              fontFamily: "inherit", resize: "none", overflow: "hidden", outline: "none",
              minHeight: 160, transition: "border-color 0.15s", boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = GREEN)}
            onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
          />
          <p style={{ textAlign: "right", fontSize: 11, color: "#aaa", marginTop: 6 }}>
            {currentFbData.totalFeedback.length}자
          </p>
        </div>

        {/* Send button for current mentee */}
        <div style={{ background: CARD, border: "1px solid #E9ECEF", borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, marginBottom: allSent ? 16 : 0 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
              {currentMentee?.menteeName}에게 최종 리포트 전송
            </p>
            <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              질문별 평가, 별점, 총평을 저장한 뒤 멘티 마이페이지에 전달됩니다
            </p>
          </div>
          {currentSent && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#E1F5EE", border: `1px solid ${GREEN}50`, borderRadius: 10, padding: "12px 24px" }}>
              <span style={{ color: GREEN, fontSize: 16 }}>✓</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>저장 완료</span>
            </div>
          )}
          {!allSent && (
            <button type="button" onClick={() => navigate("/dashboard/mentor")} style={{
              padding: "13px 22px", borderRadius: 11, border: `1px solid ${NAVY}`,
              background: "white", color: NAVY, fontSize: 14, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              대시보드로 이동
            </button>
          )}
          <button type="button" onClick={handleSendCurrent} disabled={isSending} style={{
            padding: "13px 28px", borderRadius: 11, border: "none",
            background: isSending ? "#aaa" : NAVY, color: "white",
            fontSize: 14, fontWeight: 700,
            cursor: isSending ? "not-allowed" : "pointer",
            transition: "background 0.2s", whiteSpace: "nowrap",
          }}>
            {isSending
              ? "저장 중..."
              : currentSent
              ? "수정본 다시 저장"
              : "수정본 저장 후 전송 →"}
          </button>
        </div>

        {/* All done */}
        {allSent && (
          <div style={{ background: "#E1F5EE", border: `1px solid ${GREEN}50`, borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>모든 멘티에게 피드백 전송 완료!</p>
              <p style={{ fontSize: 12, color: "#444", marginTop: 4 }}>
                {menteeList.length}명의 멘티 모두에게 최종 리포트가 전달됐습니다.
              </p>
            </div>
            <button type="button" onClick={() => navigate("/dashboard/mentor")} style={{
              padding: "13px 24px", borderRadius: 11, border: "none",
              background: GREEN, color: "white", fontSize: 14, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              대시보드로 이동 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
