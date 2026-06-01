import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAnswerAudio, getAnswerAudioByAnswerId, getFitGapAnalysis, getQuestionAnswers } from "../../api/sessions";

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const VIEWED_KEY = "scena_viewed_finals";

function getAuthHeaders() {
  const raw = localStorage.getItem("scena_auth");
  if (!raw) return {};
  try {
    const user = JSON.parse(raw);
    const token = user?.accessToken || user?.token || user?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function AudioPlayer({ sessionId, questionId, answerId, audioUrl }) {
  const [state, setState] = useState("idle");
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (state === "loading") return;
    if (state === "playing") {
      audioRef.current?.pause();
      setState("paused");
      return;
    }
    if (state === "paused" && audioRef.current) {
      await audioRef.current.play();
      setState("playing");
      return;
    }

    if (!sessionId || (!questionId && !answerId && !audioUrl)) {
      setState("error");
      return;
    }

    setState("loading");
    try {
      let resolvedAnswerId = answerId;
      if (!resolvedAnswerId && questionId) {
        const answers = await getQuestionAnswers(sessionId, questionId);
        resolvedAnswerId = answers?.[0]?.id;
      }

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);

      if (resolvedAnswerId) {
        try {
          blobUrlRef.current = await getAnswerAudioByAnswerId(sessionId, resolvedAnswerId);
        } catch (error) {
          if (!questionId) throw error;
          blobUrlRef.current = await getAnswerAudio(sessionId, questionId, resolvedAnswerId);
        }
      } else if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
        blobUrlRef.current = audioUrl;
      } else {
        throw new Error("answer audio not found");
      }
      const audio = new Audio(blobUrlRef.current);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("error");
      await audio.play();
      setState("playing");
    } catch {
      setState("error");
    }
  };

  const config = {
    idle: { label: "답변 듣기", color: GREEN },
    loading: { label: "불러오는 중...", color: GREEN },
    playing: { label: "일시정지", color: GREEN },
    paused: { label: "이어 듣기", color: GREEN },
    error: { label: "오디오 없음", color: "#999" },
  }[state];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "loading"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: config.color,
        border: `1px solid ${config.color}`,
        background: state === "playing" ? "#E8F5EE" : "transparent",
        borderRadius: 99,
        padding: "5px 12px",
        cursor: state === "loading" ? "default" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {state === "playing" ? "Ⅱ" : "▶"} {config.label}
    </button>
  );
}

function toFivePointScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(1, Math.min(5, numeric / 2));
}

function toFivePointMentorScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return null;
  const fivePoint = numeric > 5 ? numeric / 2 : numeric;
  return Math.max(1, Math.min(5, fivePoint));
}

function hasItems(items) {
  return Array.isArray(items) && items.length > 0;
}

function buildEvaluationMaps(evaluations = []) {
  const byAnswerId = new Map();
  const byQuestionId = new Map();
  const byQuestionMentee = new Map();
  evaluations.forEach((evaluation) => {
    const answerId = evaluation?.answer_id ?? evaluation?.answerId;
    const questionId = evaluation?.question_id ?? evaluation?.questionId;
    const menteeId = evaluation?.mentee_id ?? evaluation?.menteeId;
    if (answerId != null) byAnswerId.set(String(answerId), evaluation);
    if (questionId != null) byQuestionId.set(String(questionId), evaluation);
    if (questionId != null && menteeId != null) {
      byQuestionMentee.set(`${questionId}:${menteeId}`, evaluation);
    }
  });
  return { byAnswerId, byQuestionId, byQuestionMentee };
}

function findEvaluationForReport(report, maps) {
  const answerId = report?.answer_id ?? report?.answerId;
  const questionId = report?.question_id ?? report?.questionId;
  const menteeId = report?.mentee_id ?? report?.menteeId;
  if (answerId != null) {
    const evaluation = maps.byAnswerId.get(String(answerId));
    if (evaluation) return evaluation;
  }
  if (questionId != null && menteeId != null) {
    const evaluation = maps.byQuestionMentee.get(`${questionId}:${menteeId}`);
    if (evaluation) return evaluation;
  }
  if (questionId != null) {
    return maps.byQuestionId.get(String(questionId));
  }
  return null;
}

function Stars({ score, size = 14, color = "#F59E0B" }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ fontSize: size, color: i <= Math.round(score) ? color : "#D1D5DB" }}>★</span>
      ))}
    </span>
  );
}

function Tag({ children, bg, color }) {
  return (
    <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: bg, color, fontWeight: 700, display: "inline-block", marginRight: 6, marginBottom: 4 }}>
      {children}
    </span>
  );
}

function FitGapBar({ label, pct }) {
  const color = pct >= 70 ? GREEN : pct >= 45 ? "#F59E0B" : "#E24B4A";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: "#333" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ background: "#E8E5DF", borderRadius: 99, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: 7, borderRadius: 99, background: color, transition: "width 1.2s ease" }} />
      </div>
    </div>
  );
}

function parseFitGapItem(item) {
  const [requirementPart, detailPart] = String(item || "").split(" / ");
  const requirement = requirementPart?.replace(/^요구사항:\s*/, "") || item;
  const detail = detailPart
    ?.replace(/^근거\(([^)]+)\):\s*/, "$1 · ")
    ?.replace(/^부족 근거:\s*/, "")
    || "";

  return { requirement, detail };
}

function FitGapList({ title, items = [], tone }) {
  const isMatched = tone === "matched";
  const accent = isMatched ? GREEN : "#E24B4A";
  const bg = isMatched ? "#F0FDF4" : "#FFF5F5";
  const borderColor = isMatched ? "#BBF7D0" : "#FED7D7";
  const detailLabel = isMatched ? "충족 근거" : "부족 근거";
  return (
    <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: accent, margin: 0 }}>{title}</p>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, background: "white", borderRadius: 99, padding: "4px 8px" }}>{items.length}개</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ background: "white", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#777", lineHeight: 1.6 }}>
            해당 항목이 없습니다.
          </div>
        ) : items.map((item, i) => {
          const parsed = parseFitGapItem(item);
          return (
            <div key={i} style={{ background: "white", borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${accent}`, fontSize: 13, color: "#333", lineHeight: 1.6 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#222", margin: parsed.detail ? "0 0 6px" : 0 }}>{parsed.requirement}</p>
              {parsed.detail && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 800, color: accent, margin: "0 0 3px" }}>{detailLabel}</p>
                  <p style={{ fontSize: 12, color: "#555", margin: 0, lineHeight: 1.6 }}>{parsed.detail}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function exportToPDF(session, reportData) {
  const el = document.getElementById("final-report-content");
  const bodyHtml = el ? el.innerHTML : "<p>리포트 내용을 불러올 수 없습니다.</p>";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Malgun Gothic','Noto Sans KR',sans-serif;max-width:860px;margin:40px auto;color:#111;line-height:1.8;background:#FAF8F4;}button{display:none!important;}svg{display:none!important;}</style></head><body>${bodyHtml}</body></html>`;
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `최종리포트_${session?.menteeName || "멘티"}_${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinalReportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();
  const reportData = location.state || {};

  const [notified, setNotified] = useState(false);
  const [showMentorComment, setShowMentorComment] = useState(false);
  const [fitGap, setFitGap] = useState(null);
  const [aiData, setAiData] = useState(null);
  // 멘티 경로: sessionId만 있을 때 세션 상세 별도 fetch
  const [sessionMeta, setSessionMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const sessionId = reportData?.sessionId || routeSessionId;
  const role = reportData?.role || "mentee";

  // 리다이렉트: state와 route param이 모두 없으면 대시보드로
  useEffect(() => {
    if (!sessionId) navigate("/dashboard/mentee");
  }, [sessionId, navigate]);

  // 읽음 표시 (멘티가 열었을 때)
  useEffect(() => {
    if (role !== "mentee" || !sessionId) return;
    const viewed = JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]");
    const sid = String(sessionId);
    if (!viewed.includes(sid)) {
      localStorage.setItem(VIEWED_KEY, JSON.stringify([...viewed, sid]));
    }
  }, [role, sessionId]);

  // Fit-Gap 프로그레스바
  useEffect(() => {
    if (!sessionId) return;
    getFitGapAnalysis(sessionId).then(setFitGap).catch(() => {});
  }, [sessionId]);

  // 전체 AI 리포트
  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API_BASE}/api/sessions/${sessionId}/report`, {
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setAiData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

  // 멘티 경로: session 객체가 없으면 세션 상세 fetch
  useEffect(() => {
    if (reportData?.session || !sessionId) return;
    fetch(`${API_BASE}/api/sessions/${sessionId}`, {
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setSessionMeta)
      .catch(() => {});
  }, [sessionId]);

  // 멘토 코멘트 애니메이션
  useEffect(() => {
    const t = setTimeout(() => setShowMentorComment(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!sessionId) return null;

  // ── 데이터 통합 ──────────────────────────────────────────────
  const aiReport = aiData?.ai_report;
  const questionReports = aiReport?.question_reports || [];
  const answerEvaluations = aiData?.answer_evaluations || [];
  const evaluationMaps = buildEvaluationMaps(answerEvaluations);
  const { byAnswerId, byQuestionId, byQuestionMentee } = evaluationMaps;
  const mentorEvaluationScores = answerEvaluations
    .map((evaluation) => evaluation?.mentor_score ?? evaluation?.mentorScore)
    .filter((score) => Number.isFinite(Number(score)));

  // session: nav state에서 오거나, sessionMeta + questionReports로 구성
  const session = reportData?.session || (sessionMeta ? {
    title: sessionMeta.title || `세션 #${sessionId}`,
    date: (sessionMeta.scheduledAt ?? sessionMeta.scheduled_at)?.slice(0, 10) || "",
    type: sessionMeta.sessionType ?? sessionMeta.session_type ?? "1:1",
    duration: sessionMeta.duration || "",
    menteeName: sessionMeta.menteeName ?? sessionMeta.mentee_name ?? "",
    qnas: [],
  } : null);

  // feedbacks: nav state에서 오거나 빈 객체
  const feedbacks = reportData?.feedbacks || {};
  const totalFeedback = reportData?.totalFeedback || aiData?.mentor_feedback || "";
  const mentorScore = reportData?.mentorScore
    ?? aiData?.mentor_score
    ?? aiData?.mentorScore
    ?? (mentorEvaluationScores.length > 0
      ? mentorEvaluationScores.reduce((sum, score) => sum + toFivePointMentorScore(score), 0) / mentorEvaluationScores.length
      : 0);

  // 로딩 중이고 session도 없으면 스피너
  if (loading && !session) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, border: `3px solid ${GREEN}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#666", fontSize: 14 }}>최종 리포트를 불러오는 중...</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // session 없으면 AI 데이터로 최소 구성
  const resolvedSession = session || {
    title: `세션 #${sessionId}`,
    date: "", type: "1:1", duration: "", menteeName: "", qnas: [],
  };

  const feedbackValues = Object.values(feedbacks);
  const avgMentorScore = feedbackValues.length > 0
    ? (feedbackValues.reduce((a, b) => a + b.score, 0) / feedbackValues.length).toFixed(1)
    : mentorEvaluationScores.length > 0
      ? (mentorEvaluationScores.reduce((sum, score) => sum + toFivePointMentorScore(score), 0) / mentorEvaluationScores.length).toFixed(1)
    : "0.0";

  // AI 파생
  const topSummary = aiReport?.top_summary;
  const best = topSummary?.best_question;
  const worst = topSummary?.worst_question;
  const bestReport = questionReports.find((r) => r.question_id === best?.question_id);
  const worstReport = questionReports.find((r) => r.question_id === worst?.question_id);
  const legacyMatched = fitGap?.matched || [];
  const legacyMissing = fitGap?.unmatched || [];
  const fitGapAi = aiReport?.fit_gap || (
    legacyMatched.length > 0 || legacyMissing.length > 0
      ? { matched_requirements: legacyMatched, missing_requirements: legacyMissing, recommendations: [] }
      : null
  );
  const matchedRequirements = fitGapAi?.matched_requirements || fitGapAi?.matchedRequirements || [];
  const missingRequirements = fitGapAi?.missing_requirements || fitGapAi?.missingRequirements || [];
  const mentorRecommendations = answerEvaluations
    .flatMap((evaluation) => evaluation?.mentor_improvements ?? evaluation?.mentorImprovements ?? [])
    .filter(Boolean);
  const fitGapRecommendations = [
    ...(fitGapAi?.recommendations || []),
    ...mentorRecommendations.map((item) => `멘토 보완 코멘트: ${item}`),
  ].filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 5);
  const requirementCount = matchedRequirements.length + missingRequirements.length;
  const coveragePct = requirementCount > 0
    ? Math.round((matchedRequirements.length / requirementCount) * 100)
    : null;

  const toQNum = (qId) => {
    const idx = questionReports.findIndex((r) => r.question_id === qId);
    return idx >= 0 ? `Q${idx + 1}` : "";
  };

  // Q&A 기반: nav state qnas 또는 AI questionReports로 fallback
  const baseQnas = (resolvedSession.qnas?.length > 0)
    ? resolvedSession.qnas
    : questionReports.length > 0
    ? questionReports.map((qr) => {
        const evaluation = findEvaluationForReport(qr, evaluationMaps);
        const aiScore = evaluation?.ai_score ?? evaluation?.aiScore ?? qr.score;
        const aiReasoning = evaluation?.ai_reasoning ?? evaluation?.aiReasoning ?? qr.reasoning;
        const aiStrengths = evaluation?.ai_strengths ?? evaluation?.aiStrengths ?? qr.strengths;
        const aiImprovements = evaluation?.ai_improvements ?? evaluation?.aiImprovements ?? qr.improvements;
        return {
          id: qr.question_id,
          answerId: qr.answer_id,
          menteeId: qr.mentee_id ?? qr.menteeId,
          question: qr.question,
          transcript: qr.answer || "",
          aiScore: toFivePointScore(aiScore),
          aiReasoning,
          aiStrengths,
          aiImprovements,
          audioUrl: qr.replay?.audio_url ?? qr.replay?.audioUrl ?? null,
        };
      })
    : answerEvaluations.map((evaluation, index) => ({
        id: evaluation.question_id ?? evaluation.questionId ?? evaluation.answer_id ?? evaluation.answerId ?? `evaluation-${index}`,
        questionId: evaluation.question_id ?? evaluation.questionId,
        answerId: evaluation.answer_id ?? evaluation.answerId,
        menteeId: evaluation.mentee_id ?? evaluation.menteeId,
        question: evaluation.question_text ?? evaluation.questionText ?? "",
        transcript: evaluation.answer_text ?? evaluation.answerText ?? "",
        aiScore: toFivePointScore(evaluation.ai_score ?? evaluation.aiScore),
        audioUrl: evaluation.audio_url ?? evaluation.audioUrl ?? null,
      }));

  const enrichedQnas = baseQnas.map((qna) => {
    const aiQ = questionReports.find((r) =>
      (qna.answerId != null && String(r.answer_id) === String(qna.answerId))
      || String(r.question_id) === String(qna.id)
    );
    const answerId = qna.answerId ?? aiQ?.answer_id;
    const questionId = qna.questionId ?? qna.question_id ?? aiQ?.question_id ?? qna.id;
    const menteeId = qna.menteeId ?? qna.mentee_id ?? aiQ?.mentee_id ?? aiQ?.menteeId;
    const evaluation = answerId != null
      ? byAnswerId.get(String(answerId)) || byQuestionMentee.get(`${questionId}:${menteeId}`) || byQuestionId.get(String(questionId))
      : byQuestionMentee.get(`${questionId}:${menteeId}`) || byQuestionId.get(String(questionId));
    const mentorReasoning = evaluation?.mentor_reasoning ?? evaluation?.mentorReasoning;
    const mentorScoreValue = evaluation?.mentor_score ?? evaluation?.mentorScore;
    const mentorStrengths = evaluation?.mentor_strengths ?? evaluation?.mentorStrengths;
    const mentorImprovements = evaluation?.mentor_improvements ?? evaluation?.mentorImprovements;

    return {
      ...qna,
      answerId,
      questionId,
      menteeId,
      question: evaluation?.question_text || evaluation?.questionText || qna.question || aiQ?.question || "",
      transcript: evaluation?.answer_text || evaluation?.answerText || qna.transcript || aiQ?.answer || "",
      audioUrl: evaluation?.audio_url ?? evaluation?.audioUrl ?? qna.audioUrl ?? aiQ?.replay?.audio_url ?? aiQ?.replay?.audioUrl ?? null,
      strengths: hasItems(mentorStrengths) ? mentorStrengths : (qna.aiStrengths || aiQ?.strengths || []),
      improvements: hasItems(mentorImprovements) ? mentorImprovements : (qna.aiImprovements || aiQ?.improvements || []),
      reasoning: mentorReasoning || aiQ?.reasoning || "",
      aiReasoning: qna.aiReasoning ?? evaluation?.ai_reasoning ?? evaluation?.aiReasoning ?? aiQ?.reasoning ?? "",
      hasMentorRevision: Boolean(mentorReasoning || hasItems(mentorStrengths) || hasItems(mentorImprovements) || mentorScoreValue != null),
      mentorScore: toFivePointMentorScore(mentorScoreValue),
    };
  });

  const findFinalQna = (questionId, fallbackIndex) => {
    const matched = questionId != null
      ? enrichedQnas.find((qna) => String(qna.questionId ?? qna.id) === String(questionId))
      : null;
    return matched || enrichedQnas[fallbackIndex] || null;
  };
  const bestFinalQna = findFinalQna(best?.question_id, 0);
  const worstFinalQna = findFinalQna(worst?.question_id, enrichedQnas.length - 1);
  const bestTranscript = bestFinalQna?.transcript || bestReport?.answer || baseQnas[0]?.transcript || "";
  const worstTranscript = worstFinalQna?.transcript || worstReport?.answer || baseQnas[baseQnas.length - 1]?.transcript || "";

  const STAR_COLORS = {
    S: { bg: "#DBEAFE", text: "#1E40AF" },
    T: { bg: "#D1FAE5", text: "#065F46" },
    A: { bg: "#FEF3C7", text: "#92400E" },
    R: { bg: "#FCE7F3", text: "#9D174D" },
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 80 }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── 헤더 ── */}
      <header style={{ background: NAVY, padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "white", borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            ← 뒤로
          </button>
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>최종 리포트</span>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: GREEN, color: "white", fontWeight: 700 }}>멘토 코멘트 포함</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {role === "mentor" && (
            <button onClick={() => setNotified(true)} disabled={notified}
              style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: notified ? "#555" : GREEN, color: "white", fontSize: 13, fontWeight: 700, cursor: notified ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.2s" }}>
              {notified ? "✓ 멘티에게 전송 완료" : "멘티에게 전송하기"}
            </button>
          )}
          <button onClick={() => exportToPDF(resolvedSession, reportData)}
            style={{ padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Word 저장
          </button>
        </div>
      </header>

      <div id="final-report-content" style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>
        {/* ── 메타 ── */}
        <div style={{ marginBottom: 10 }}>
          <Tag bg={NAVY} color="white">최종 리포트</Tag>
          <Tag bg={GREEN} color="white">멘토 수정 반영</Tag>
          <Tag bg="#E8E5DF" color="#555">AI 초안 보존</Tag>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111", marginBottom: 6 }}>{resolvedSession.title}</h1>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 32 }}>
          {resolvedSession.date} · {resolvedSession.type} · {resolvedSession.duration}
          {aiReport?.overall_score != null && (
            <span style={{ marginLeft: 10, color: GREEN, fontWeight: 700 }}>AI 종합 {aiReport.overall_score}점</span>
          )}
        </p>

        {/* ── BEST / WORST ── */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 12 }}>AI가 뽑은 핵심 문항</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          <div style={{ background: "#1E3A5F", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#7DD3FC", letterSpacing: 1 }}>● BEST 문항</span>
              <span style={{ fontSize: 10, color: "#7DD3FC" }}>{best ? toQNum(best.question_id) : "Q1"}</span>
            </div>
            <p style={{ color: "#93C5FD", fontSize: 12, fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
              {bestFinalQna?.question || best?.question || baseQnas[0]?.question || "질문 정보 없음"}
            </p>
            {bestTranscript && (
              <p style={{ color: "white", fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                "{bestTranscript.slice(0, 100)}{bestTranscript.length > 100 ? "..." : ""}"
              </p>
            )}
            <p style={{ color: "#93C5FD", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              {(bestFinalQna?.hasMentorRevision && bestFinalQna?.reasoning) || best?.reason || "수치 기반 결과와 행동-결과 인과관계가 명확해 설득력이 높습니다."}
            </p>
          </div>

          <div style={{ background: "#4A1515", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FCA5A5", letterSpacing: 1 }}>● WORST 문항</span>
              <span style={{ fontSize: 10, color: "#FCA5A5" }}>{worst ? toQNum(worst.question_id) : ""}</span>
            </div>
            <p style={{ color: "#FCA5A5", fontSize: 12, fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
              {worstFinalQna?.question || worst?.question || baseQnas[baseQnas.length - 1]?.question || "질문 정보 없음"}
            </p>
            {worstTranscript && (
              <p style={{ color: "white", fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
                "{worstTranscript.slice(0, 100)}{worstTranscript.length > 100 ? "..." : ""}"
              </p>
            )}
            <p style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              {(worstFinalQna?.hasMentorRevision && worstFinalQna?.reasoning) || worst?.reason || "구체적 경험 또는 수치 근거가 부족하며 보완이 필요합니다."}
            </p>
          </div>
        </div>

        {/* ── 정량 평가 요약 ── */}
        {(best?.metrics_summary || worst?.metrics_summary) && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 12 }}>정량 평가 요약</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
              {[
                { label: "BEST — 잘한 점", bg: "#F0FDF4", border: "#BBF7D0", textColor: "#166534", valueColor: "#166534", metrics: best?.metrics_summary },
                { label: "WORST — 개선 필요", bg: "#FFF5F5", border: "#FED7D7", textColor: "#9B1C1C", valueColor: "#E24B4A", metrics: worst?.metrics_summary },
              ].map(({ label, bg, border, textColor, valueColor, metrics }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 18 }}>
                  <p style={{ fontSize: 11, color: textColor, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>{label}</p>
                  {metrics
                    ? [["말하기 속도", metrics.speaking_speed], ["침묵 구간", metrics.silence], ["문장 명료도", metrics.sentence_clarity], ["답변 구조", metrics.star_structure]]
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${border}` }}>
                            <span style={{ fontSize: 13, color: "#333" }}>{k}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: valueColor }}>{v}</span>
                          </div>
                        ))
                    : <p style={{ fontSize: 13, color: "#999" }}>데이터 없음</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Fit-Gap ── */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 12 }}>핏-갭 (Fit-Gap) 역량 분석</p>

        {fitGapAi && (
          <div style={{ marginBottom: 16 }}>
            {coveragePct != null && (
              <div style={{ background: "white", border: "1px solid #E0DDD8", borderRadius: 14, padding: 18, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: NAVY, margin: 0 }}>채용공고 요구사항 커버리지</p>
                  <span style={{ fontSize: 18, fontWeight: 900, color: coveragePct >= 70 ? GREEN : coveragePct >= 45 ? "#F59E0B" : "#E24B4A" }}>{coveragePct}%</span>
                </div>
                <div style={{ background: "#E8E5DF", borderRadius: 99, height: 8, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${coveragePct}%`, height: "100%", background: coveragePct >= 70 ? GREEN : coveragePct >= 45 ? "#F59E0B" : "#E24B4A" }} />
                </div>
                <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
                  충족 {matchedRequirements.length}개 · 보완 필요 {missingRequirements.length}개
                </p>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <FitGapList title="충족한 요구사항" items={matchedRequirements} tone="matched" />
              <FitGapList title="부족한 요구사항" items={missingRequirements} tone="missing" />
            </div>
            {fitGapRecommendations.length > 0 && (
              <div style={{ background: "#F8F7F4", border: "1px solid #E8E5DF", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 12px" }}>추천 보완 방향</p>
                <div style={{ display: "grid", gap: 8 }}>
                  {fitGapRecommendations.map((item, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, alignItems: "start" }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: NAVY, color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: 0 }}>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!fitGapAi && !loading && (
          <div style={{ background: "white", border: "1px solid #E0DDD8", borderRadius: 14, padding: 22, marginBottom: 28 }}>
            <p style={{ fontSize: 12, color: "#999" }}>Fit-Gap 분석 데이터를 불러오는 중입니다...</p>
          </div>
        )}

        {/* ── Q&A 스크립트 ── */}
        <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 12 }}>전체 Q&amp;A 스크립트</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {Object.entries(STAR_COLORS).map(([k, v]) => (
            <span key={k} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: v.bg, color: v.text, fontWeight: 700 }}>
              {k} {k === "S" ? "상황" : k === "T" ? "과제" : k === "A" ? "행동" : "결과"}
            </span>
          ))}
        </div>

        {enrichedQnas.map((qna, idx) => {
          const fb = feedbacks[qna.id] || {};
          const isBad = qna.aiScore <= 2.5;
          const mentorScore_q = fb.score || qna.mentorScore || qna.aiScore;
          const hasDifferentAiReasoning = qna.hasMentorRevision
            && qna.aiReasoning
            && qna.aiReasoning !== qna.reasoning;
          return (
            <div key={qna.id ?? idx} style={{ background: "white", border: `1px solid ${isBad ? "#FED7D7" : "#E0DDD8"}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Q{idx + 1} · {qna.question}</p>
              <p style={{ fontSize: 13, lineHeight: 1.8, color: "#333", marginBottom: 14 }}>{qna.transcript}</p>

              {qna.reasoning && (
                <div style={{ borderLeft: "3px solid #CAD3DF", paddingLeft: 12, marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#667085", marginBottom: 4 }}>
                    {qna.hasMentorRevision ? "멘토 수정 평가 근거" : "AI 평가 근거"}
                  </p>
                  <p style={{ fontSize: 13, color: "#444", lineHeight: 1.7, margin: 0 }}>{qna.reasoning}</p>
                </div>
              )}

              {hasDifferentAiReasoning && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", cursor: "pointer" }}>
                    AI 초안 평가 근거 보기
                  </summary>
                  <p style={{ marginTop: 8, fontSize: 12, color: "#6B7280", lineHeight: 1.7, background: "#F8F7F4", borderRadius: 8, padding: "10px 12px" }}>
                    {qna.aiReasoning}
                  </p>
                </details>
              )}

              {(qna.strengths.length > 0 || qna.improvements.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {qna.strengths.length > 0 && (
                    <div style={{ background: "#F0FDF4", borderRadius: 8, padding: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 6 }}>강점</p>
                      {qna.strengths.map((s, i) => <p key={i} style={{ fontSize: 12, color: "#3F5F4B", margin: "0 0 4px", lineHeight: 1.6 }}>• {s}</p>)}
                    </div>
                  )}
                  {qna.improvements.length > 0 && (
                    <div style={{ background: "#FFF5F5", borderRadius: 8, padding: 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#E24B4A", marginBottom: 6 }}>개선점</p>
                      {qna.improvements.map((s, i) => <p key={i} style={{ fontSize: 12, color: "#6F4545", margin: "0 0 4px", lineHeight: 1.6 }}>• {s}</p>)}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid #FAF8F4" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, color: "#aaa", marginBottom: 3 }}>AI 점수</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Stars score={qna.aiScore} color="#D1D5DB" />
                      <span style={{ fontSize: 12, color: "#aaa", textDecoration: "line-through" }}>{Number(qna.aiScore).toFixed(1)}</span>
                    </div>
                  </div>
                  <span style={{ color: "#999", fontSize: 16 }}>→</span>
                  <div>
                    <p style={{ fontSize: 10, color: "#888", marginBottom: 3, fontWeight: 700 }}>멘토 점수</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Stars score={mentorScore_q} color="#F59E0B" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{Number(mentorScore_q).toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <AudioPlayer
                  sessionId={sessionId}
                  questionId={qna.questionId ?? qna.id}
                  answerId={qna.answerId}
                  audioUrl={qna.audioUrl}
                />
              </div>

              {fb.comment && (
                <div style={{ marginTop: 12, background: "#F0F9F4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${GREEN}` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 4 }}>멘토 코멘트</p>
                  <p style={{ fontSize: 13, color: "#333", lineHeight: 1.7 }}>{fb.comment}</p>
                </div>
              )}
            </div>
          );
        })}

        {/* ── 멘토 총평 ── */}
        <div style={{ marginTop: 28, background: "white", border: `2px solid ${GREEN}`, borderRadius: 16, padding: 24, opacity: showMentorComment ? 1 : 0, transform: showMentorComment ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #E0DDD8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>멘</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 2 }}>멘토 총평</p>
                <p style={{ fontSize: 12, color: "#888" }}>멘토링 세션 직후 작성</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>멘토 종합 평점</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                <Stars score={Number(mentorScore)} size={16} color="#F59E0B" />
                <span style={{ fontSize: 16, fontWeight: 700, color: "#333" }}>{Number(mentorScore).toFixed(1)}</span>
                <span style={{ fontSize: 11, color: "#aaa", textDecoration: "line-through" }}>AI {avgMentorScore}</span>
              </div>
            </div>
          </div>

          <div style={{ background: "#F8FFFE", borderRadius: 10, padding: "16px 18px", borderLeft: `4px solid ${GREEN}` }}>
            <p style={{ fontSize: 14, lineHeight: 1.9, color: "#333", whiteSpace: "pre-wrap" }}>
              {totalFeedback || "멘토 총평이 작성되지 않았습니다."}
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            {Number(mentorScore) >= 4 && <Tag bg="#E1F5EE" color="#0F6E56">추천 멘티</Tag>}
            {baseQnas.some((q) => (feedbacks[q.id]?.score || q.aiScore) >= 4) && <Tag bg="#E6F1FB" color="#185FA5">STAR 구조 우수</Tag>}
            {baseQnas.some((q) => (feedbacks[q.id]?.score || q.aiScore) <= 2) && <Tag bg="#FFF5F5" color="#9B1C1C">보완 필요 항목 있음</Tag>}
          </div>

          {role === "mentee" && (
            <div style={{ marginTop: 16, background: "#FAF8F4", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#666" }}>
              이 리포트는 멘토가 최종 제출한 후 자동으로 전달된 최종 리포트입니다. 마이페이지에서 언제든 다시 확인할 수 있습니다.
            </div>
          )}
        </div>

        {/* ── 하단 버튼 ── */}
        <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => navigate("/dashboard/mentee")}
            style={{ padding: "11px 24px", borderRadius: 10, border: "1px solid #D1D5DB", background: "white", color: "#555", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            대시보드로 이동
          </button>
          <button onClick={() => exportToPDF(resolvedSession, reportData)}
            style={{ padding: "11px 24px", borderRadius: 10, border: "none", background: NAVY, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Word로 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
