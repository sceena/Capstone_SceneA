import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import mockAiReport from "./mockAiReport";

const NAVY = "#0D2240";
const GREEN = "#0CA678";
const BG = "#F0F4F8";
const CARD = "#FFFFFF";
const PRIMARY_GRAD = "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)";
const SUCCESS_GRAD = "linear-gradient(135deg, #0CA678 0%, #38D9A9 100%)";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const USE_MOCK_REPORT = import.meta.env.VITE_USE_MOCK_REPORT === "true";
const LOADING_STEPS = [
  "음성 데이터 분석 중...",
  "WPM · 침묵 구간 측정 중...",
  "STAR 구조화 지표 분류 중...",
  "Fit-Gap 역량 교차 분석 중...",
  "AI 리포트 생성 완료!",
];

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

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function createMockReport(sessionId) {
  const resolvedSessionId = Number(sessionId) || mockAiReport.session_id;

  return {
    ...mockAiReport,
    id: resolvedSessionId,
    session_id: resolvedSessionId,
    __mock: true,
    ai_report: {
      ...mockAiReport.ai_report,
      session_id: resolvedSessionId,
    },
  };
}

function getCurrentUserName() {
  try {
    const user = JSON.parse(localStorage.getItem("scena_auth") || "null");
    return user?.name || user?.nickname || user?.username || "";
  } catch {
    return "";
  }
}

function getDemoCandidateKey(name = "") {
  if (name.includes("지아")) return "최지아";
  if (name.includes("윤진")) return "정윤진";
  if (name.includes("동현")) return "강동현";
  return null;
}

function normalizeDemoQuestionReport(report, candidateName, index) {
  return {
    ...report,
    question_id: report.question_id ?? index + 1,
    answer_id: report.answer_id ?? null,
    mentee_id: report.mentee_id ?? null,
    mentee_name: report.mentee_name || candidateName,
    ai_model_name: report.ai_model_name || "demo-fallback",
    prompt_version: report.prompt_version || "demo_v1",
  };
}

function buildDemoTopSummary(questionReports = []) {
  if (!questionReports.length) return null;
  const sorted = [...questionReports].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const toHighlight = (report, fallbackReason) => ({
    question_id: report.question_id,
    question: report.question,
    reason: report.reasoning || fallbackReason,
    metrics_summary: {
      speaking_speed: "적정",
      silence: "침묵 없음",
      sentence_clarity: "명확",
      star_structure: "S/T/A/R 분석 완료",
    },
  });

  return {
    best_question: toHighlight(sorted[0], "가장 강점이 잘 드러난 답변입니다."),
    worst_question: toHighlight(sorted[sorted.length - 1], "추가 보완이 필요한 답변입니다."),
  };
}

function tagDemoItems(candidateName, items = []) {
  return items.map(item => `[${candidateName}] ${item}`);
}

function stripDemoItemTags(items = []) {
  return items.map(item => String(item).replace(/^\[[^:\]]+\]\s+(?=\[[^\]]+:)/, ""));
}

function buildSingleDemoReport(sessionId, candidateReport) {
  const candidateName = candidateReport?.candidate_name || "면접 참여자";
  const aiReport = candidateReport?.ai_report || {};
  const questionReports = (aiReport.question_reports || []).map((item, index) =>
    normalizeDemoQuestionReport(item, candidateName, index)
  );

  return {
    id: Number(sessionId) || 1,
    session_id: Number(sessionId) || 1,
    report_status: "first",
    total_score: aiReport.overall_score ?? 0,
    alignment_score: null,
    best_moment: aiReport.top_summary?.best_question?.reason || "",
    worst_moment: aiReport.top_summary?.worst_question?.reason || "",
    ai_summary: aiReport.fit_gap?.job_fit_summary || "",
    raw_ai_response_json: "",
    mentor_feedback: null,
    mentor_score: null,
    __mock: true,
    ai_report: {
      session_id: Number(sessionId) || aiReport.session_id || 1,
      overall_score: aiReport.overall_score ?? 0,
      top_summary: aiReport.top_summary || buildDemoTopSummary(questionReports),
      fit_gap: {
        matched_requirements: stripDemoItemTags(aiReport.fit_gap?.matched_requirements || []),
        missing_requirements: stripDemoItemTags(aiReport.fit_gap?.missing_requirements || []),
        recommendations: stripDemoItemTags(aiReport.fit_gap?.recommendations || []),
      },
      question_reports: questionReports,
    },
  };
}

function buildGroupDemoReport(sessionId, reports = []) {
  const questionReports = reports.flatMap(candidateReport => {
    const candidateName = candidateReport?.candidate_name || "면접 참여자";
    return (candidateReport?.ai_report?.question_reports || []).map((item, index) =>
      normalizeDemoQuestionReport(item, candidateName, index)
    );
  });
  const scores = reports.map(item => item?.ai_report?.overall_score).filter(score => typeof score === "number");

  return {
    id: Number(sessionId) || 1,
    session_id: Number(sessionId) || 1,
    report_status: "first",
    total_score: scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : 0,
    alignment_score: null,
    best_moment: "",
    worst_moment: "",
    ai_summary: "",
    raw_ai_response_json: "",
    mentor_feedback: null,
    mentor_score: null,
    __mock: true,
    ai_report: {
      session_id: Number(sessionId) || 1,
      overall_score: scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : 0,
      top_summary: buildDemoTopSummary(questionReports),
      fit_gap: {
        matched_requirements: reports.flatMap(item => tagDemoItems(item.candidate_name, item.ai_report?.fit_gap?.matched_requirements || [])),
        missing_requirements: reports.flatMap(item => tagDemoItems(item.candidate_name, item.ai_report?.fit_gap?.missing_requirements || [])),
        recommendations: reports.flatMap(item => tagDemoItems(item.candidate_name, item.ai_report?.fit_gap?.recommendations || [])),
      },
      question_reports: questionReports,
    },
  };
}

export async function createDemoFallbackReport(sessionId, role = "mentee") {
  const response = await fetch("/demo-fallback-report.json", { cache: "no-store" });
  if (!response.ok) return createMockReport(sessionId);

  const data = await response.json();
  const reports = data?.reports || [];
  if (String(role).toLowerCase().includes("mentor")) {
    return buildGroupDemoReport(sessionId, reports);
  }

  const candidateKey = getDemoCandidateKey(getCurrentUserName());
  const candidateReport = reports.find(item => item.candidate_name === candidateKey) || reports[0];
  return buildSingleDemoReport(sessionId, candidateReport);
}

async function loadReport(sessionId, forceMock = false, role = "mentee") {
  if (forceMock) {
    return createDemoFallbackReport(sessionId, role);
  }

  try {
    return await requestJson(`/api/sessions/${sessionId}/report`);
  } catch (error) {
    if (error.status === 404) {
      return createDemoFallbackReport(sessionId, role);
    }
    if (USE_MOCK_REPORT) {
      return createMockReport(sessionId);
    }
    throw error;
  }
}

async function loadSession(sessionId) {
  return requestJson(`/api/sessions/${sessionId}`);
}

async function updateSessionStatus(sessionId, status) {
  return requestJson(`/api/sessions/${sessionId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

function toQuestionNo(questionId, reports = []) {
  const index = reports.findIndex((item) => item.question_id === questionId);
  return index >= 0 ? `Q${index + 1}` : `Q${questionId}`;
}

function scoreToStars(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 1;
  const fivePoint = numeric > 5 ? numeric / 2 : numeric;
  return Math.max(1, Math.min(5, Math.round(fivePoint)));
}

function toFivePointScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(1, Math.min(5, numeric > 5 ? numeric / 2 : numeric));
}

function formatReplayTime(replay = {}) {
  if (!replay.start_time || !replay.end_time) return "다시듣기";
  const start = replay.start_time.split("T").pop()?.slice(0, 8);
  const end = replay.end_time.split("T").pop()?.slice(0, 8);
  return start && end ? `${start} - ${end}` : "다시듣기";
}

async function loadQuestions(sessionId) {
  try {
    return await requestJson(`/api/sessions/${sessionId}/questions`);
  } catch {
    return [];
  }
}

function normalizeQuestionItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.questions)) return data.questions;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

function getReportQuestionId(item) {
  return item?.question_id ?? item?.questionId ?? item?.id ?? null;
}

function getReportMenteeId(item) {
  return item?.mentee_id ?? item?.menteeId ?? item?.candidate_id ?? item?.candidateId ?? null;
}

function getQuestionTypeValue(item) {
  const raw = item?.question_type ?? item?.questionType ?? item?.type ?? "";
  return String(raw || "").toUpperCase();
}

function getQuestionCandidateId(item) {
  const value = item?.candidate_id ?? item?.candidateId ?? item?.target_mentee_id ?? item?.targetMenteeId ?? null;
  return value == null ? null : Number(value);
}

function buildQuestionMetaMap(questions = []) {
  const map = new Map();
  normalizeQuestionItems(questions).forEach((question) => {
    const questionId = getReportQuestionId(question);
    if (questionId != null) map.set(String(questionId), question);
  });
  return map;
}

function useQuestionMetaMap(sessionId) {
  const [questionMetaMap, setQuestionMetaMap] = useState(() => new Map());

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    loadQuestions(sessionId).then((questions) => {
      if (!cancelled) setQuestionMetaMap(buildQuestionMetaMap(questions));
    });
    return () => { cancelled = true; };
  }, [sessionId]);

  return questionMetaMap;
}

function buildMenteeNameMap(questionReports = []) {
  const map = new Map();
  questionReports.forEach((report) => {
    const menteeId = getReportMenteeId(report);
    const menteeName = report?.mentee_name ?? report?.menteeName;
    if (menteeId != null && menteeName) map.set(String(menteeId), menteeName);
  });
  return map;
}

function getQuestionMetaForReport(report, questionMetaMap) {
  const questionId = getReportQuestionId(report);
  return questionId == null ? null : questionMetaMap.get(String(questionId));
}

function getQuestionKindLabel(report, questionMetaMap, menteeNameMap = new Map()) {
  const meta = getQuestionMetaForReport(report, questionMetaMap);
  const type = getQuestionTypeValue(report) || getQuestionTypeValue(meta);
  const candidateId = getQuestionCandidateId(report) ?? getQuestionCandidateId(meta);
  if (type === "COMMON") return "공통 질문";
  if (type === "PERSONAL" || candidateId != null) {
    const targetName = candidateId != null ? menteeNameMap.get(String(candidateId)) : "";
    return targetName ? `${targetName} 대상 개인 질문` : "개인 질문";
  }
  return "질문";
}

function getAnswererLabel(report) {
  const name = report?.mentee_name ?? report?.menteeName;
  return name ? `답변자 ${name}` : "";
}

function makeReportCardKey(report, index) {
  return report?.answer_id ?? report?.answerId ?? `${getReportQuestionId(report) ?? "q"}-${getReportMenteeId(report) ?? "m"}-${index}`;
}

function groupQuestionReportsByMentee(questionReports = [], sessionId) {
  const groups = new Map();
  questionReports.forEach((report, index) => {
    const menteeId = getReportMenteeId(report) ?? report?.mentee_name ?? report?.menteeName ?? `session-${sessionId}`;
    const key = String(menteeId);
    if (!groups.has(key)) {
      groups.set(key, {
        menteeId,
        menteeName: report?.mentee_name ?? report?.menteeName ?? "면접 참여자",
        reports: [],
      });
    }
    groups.get(key).reports.push({ ...report, __reportIndex: index });
  });
  return Array.from(groups.values());
}

function pickBestWorstReports(reports = []) {
  if (reports.length === 0) return { best: null, worst: null };
  return reports.reduce((acc, report) => {
    const score = toFivePointScore(report?.score);
    const bestScore = acc.best ? toFivePointScore(acc.best.score) : -Infinity;
    const worstScore = acc.worst ? toFivePointScore(acc.worst.score) : Infinity;
    return {
      best: score > bestScore ? report : acc.best,
      worst: score < worstScore ? report : acc.worst,
    };
  }, { best: null, worst: null });
}

// ─── Audio Player ────────────────────────────────────────────────
function AudioPlayer({ sessionId, questionId, answerId }) {
  const [state, setState] = useState("idle"); // idle | loading | playing | paused | error
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
    if (state === "playing") { audioRef.current?.pause(); setState("paused"); return; }
    if (state === "paused" && audioRef.current) { audioRef.current.play(); setState("playing"); return; }

    setState("loading");
    try {
      let resolvedAnswerId = answerId;
      if (!resolvedAnswerId) {
        const answers = await requestJson(`/api/sessions/${sessionId}/questions/${questionId}/answers`);
        if (!answers?.length) throw new Error("no answer");
        resolvedAnswerId = answers[0].id;
      }
      if (!resolvedAnswerId) throw new Error("no answer");

      const token = (() => {
        try { const u = JSON.parse(localStorage.getItem("scena_auth")); return u?.accessToken || u?.token || u?.access_token; } catch { return null; }
      })();
      const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/questions/${questionId}/answers/${resolvedAnswerId}/audio`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("audio fetch failed");

      const blob = await res.blob();
      blobUrlRef.current = URL.createObjectURL(blob);
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

  const cfg = {
    idle:    { label: "답변 듣기",    icon: "play",    color: GREEN },
    loading: { label: "불러오는 중…", icon: "spin",    color: GREEN },
    playing: { label: "일시정지",     icon: "pause",   color: GREEN },
    paused:  { label: "이어 듣기",    icon: "play",    color: GREEN },
    error:   { label: "오디오 없음",  icon: "none",    color: "#bbb" },
  }[state];

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading" || state === "error"}
      style={{
        fontSize: 12, color: cfg.color,
        border: `1px solid ${cfg.color}`,
        background: state === "playing" ? "#E8F5EE" : "transparent",
        borderRadius: 99, padding: "5px 12px",
        cursor: state === "loading" || state === "error" ? "default" : "pointer",
        display: "flex", alignItems: "center", gap: 6, transition: "background 0.15s",
        fontFamily: "inherit",
      }}
    >
      {state === "loading" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      ) : state === "pause" || state === "idle" || state === "paused" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill={state === "playing" ? GREEN : "none"} stroke={cfg.color} strokeWidth="2">
          {state === "playing"
            ? <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>
            : <polygon points="5 3 19 12 5 21 5 3"/>
          }
        </svg>
      ) : null}
      {cfg.label}
    </button>
  );
}

// ─── Loading Screen ──────────────────────────────────────────────
function LoadingScreen({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 2.2;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onDone, 600);
          return 100;
        }
        setStep(Math.floor((next / 100) * (LOADING_STEPS.length - 1)));
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      {/* Animated logo */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ width: 82, height: 82, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "pulse 1.5s ease-in-out infinite" }}>
          <img src="/mascot_exact_embedded.svg" alt="면도리" style={{ width: 82, height: 82, objectFit: "contain" }} />
        </div>
        <h2 style={{ textAlign: "center", color: NAVY, fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>AI 면접 분석 리포트</h2>
        <p style={{ textAlign: "center", color: "#868E96", fontSize: 14, margin: "8px 0 0" }}>면접 데이터를 정밀 분석하고 있습니다</p>
      </div>

      {/* Progress bar */}
      <div style={{ width: 340, background: "#E0DDD8", borderRadius: 99, height: 6, margin: "0 auto 16px" }}>
        <div style={{ height: 6, borderRadius: 99, background: GREEN, width: `${progress}%`, transition: "width 0.08s linear" }} />
      </div>
      <p style={{ color: "#555", fontSize: 13, textAlign: "center", minHeight: 20, transition: "opacity 0.3s" }}>{LOADING_STEPS[step]}</p>
      <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>{Math.round(progress)}%</p>

      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }`}</style>
    </div>
  );
}

// ─── Shared Header ────────────────────────────────────────────────
function Header({ onExportWord, role }) {
  return (
    <header style={{ background: CARD, padding: "0 5%", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, maxWidth: 1200, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#1A1B1E", letterSpacing: "-0.03em" }}>
            면도리
          </span>
          <img src="/mascot_exact_embedded.svg" alt="" aria-hidden="true" style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "#868E96", marginLeft: 4 }}>/ AI 면접 분석 리포트</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: role === "mentor" ? "#E8EEF6" : "#E6FCF5", color: role === "mentor" ? NAVY : GREEN, marginLeft: 4 }}>
            {role === "mentor" ? "멘토 보기" : "멘티 보기"}
          </span>
        </div>
        <button onClick={onExportWord} style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: SUCCESS_GRAD, color: "white", fontSize: 13, cursor: "pointer", fontWeight: 700, boxShadow: "0 2px 8px rgba(12,166,120,0.3)", whiteSpace: "nowrap" }}>
          PDF 저장
        </button>
      </div>
    </header>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────
function Stars({ score, color = "#F59E0B" }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill={i <= score ? color : "#DDD"}>
          <path d="M7 1l1.545 3.13 3.455.502-2.5 2.436.59 3.44L7 8.885l-3.09 1.623.59-3.44L2 4.632l3.455-.502z" />
        </svg>
      ))}
    </span>
  );
}

// ─── STAR Highlight ───────────────────────────────────────────────
function StarText({ text, highlights }) {
  if (!highlights) return <span style={{ color: "#333", lineHeight: 1.8 }}>{text}</span>;
  const parts = [];
  let last = 0;
  highlights.forEach(({ start, end, type }) => {
    if (start > last) parts.push({ t: text.slice(last, start), type: null });
    parts.push({ t: text.slice(start, end), type });
    last = end;
  });
  if (last < text.length) parts.push({ t: text.slice(last), type: null });
  const colors = { S: "#DBEAFE", T: "#D1FAE5", A: "#FEF3C7", R: "#FCE7F3" };
  const textC = { S: "#1E40AF", T: "#065F46", A: "#92400E", R: "#9D174D" };
  return (
    <span style={{ lineHeight: 1.9, fontSize: 14 }}>
      {parts.map((p, i) =>
        p.type ? (
          <mark key={i} style={{ background: colors[p.type], color: textC[p.type], borderRadius: 3, padding: "1px 3px", fontWeight: 500 }}>{p.t}</mark>
        ) : (
          <span key={i} style={{ color: "#333" }}>{p.t}</span>
        )
      )}
    </span>
  );
}

function MetricRows({ metrics, tone }) {
  const isBest = tone === "best";
  const rows = [
    ["말하기 속도", metrics?.speaking_speed || "미측정"],
    ["침묵", metrics?.silence || "미측정"],
    ["문장 명료도", metrics?.sentence_clarity || "미측정"],
    ["답변 구조", metrics?.star_structure || "미측정"],
  ];
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(13,34,64,0.08)" }}>
      <p style={{ color: NAVY, fontSize: 11, fontWeight: 700, opacity: 0.6, margin: "0 0 8px", letterSpacing: "0.06em" }}>정량 평가</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ background: isBest ? "rgba(12,166,120,0.06)" : "rgba(192,57,43,0.05)", borderRadius: 10, padding: "9px 12px" }}>
            <p style={{ color: NAVY, fontSize: 10, fontWeight: 700, opacity: 0.55, margin: "0 0 3px" }}>{label}</p>
            <p style={{ color: NAVY, fontSize: 13, fontWeight: 700, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: NAVY, opacity: 0.4, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>{eyebrow}</p>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: "0 0 6px", letterSpacing: "-0.02em" }}>{title}</h2>
      {description && <p style={{ fontSize: 14, color: "#868E96", lineHeight: 1.65, margin: 0 }}>{description}</p>}
    </div>
  );
}

function CoreQuestionCard({ type, question, report, questionNo }) {
  const isBest = type === "best";
  const accentColor = isBest ? GREEN : "#C0392B";
  const accentBg   = isBest ? "rgba(12,166,120,0.07)" : "rgba(192,57,43,0.05)";
  const title    = isBest ? "BEST 문항" : "WORST 문항";
  const subtitle = isBest ? "가장 설득력 있었던 답변" : "보완이 가장 필요한 답변";

  return (
    <div style={{ background: CARD, border: "1px solid rgba(13,34,64,0.09)", borderTop: `3px solid ${accentColor}`, borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(13,34,64,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 800, color: accentColor, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 4px" }}>{title}</p>
          <p style={{ fontSize: 13, color: "#868E96", margin: 0 }}>{subtitle}</p>
        </div>
        <span style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 800, color: accentColor, background: accentBg, borderRadius: 99, padding: "5px 12px" }}>{questionNo}</span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: NAVY, opacity: 0.45, letterSpacing: "0.08em", margin: "0 0 6px" }}>질문</p>
        <p style={{ color: NAVY, fontSize: 15, fontWeight: 700, lineHeight: 1.6, margin: 0 }}>{question?.question || `${title} 정보가 없습니다.`}</p>
      </div>

      <div style={{ background: BG, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: NAVY, opacity: 0.45, letterSpacing: "0.08em", margin: "0 0 6px" }}>답변</p>
        <p style={{ color: "#495057", fontSize: 14, lineHeight: 1.8, margin: 0 }}>{report?.answer || "답변 정보가 없습니다."}</p>
      </div>

      <div style={{ background: accentBg, borderRadius: 12, padding: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: accentColor, letterSpacing: "0.08em", margin: "0 0 6px" }}>AI 분석</p>
        <p style={{ color: NAVY, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{question?.reason || "분석 사유가 없습니다."}</p>
      </div>

      <MetricRows metrics={question?.metrics_summary} tone={type} />
    </div>
  );
}

function normalizeReportDisplayText(value) {
  return String(value || "")
    .replace(/면접\(Q[0-9, ]+\)에서/g, "답변에서")
    .replace(/면접 중/g, "답변 과정에서")
    .replace(/면접 과정에서/g, "답변 과정에서");
}

function parseFitGapItem(item) {
  const text = normalizeReportDisplayText(item).replace(/^\[[^:\]]+\]\s+(?=\[[^\]]+:)/, "").trim();
  const bracketMatch = text.match(/^\[([^\]]+)\]\s*-\s*\[([^:]+):\s*([\s\S]+)\]$/);
  if (bracketMatch) {
    return {
      requirement: normalizeReportDisplayText(bracketMatch[1]).replace(/^[^:]+:\s*/, "").trim(),
      detail: normalizeReportDisplayText(bracketMatch[3]).replace(/\]$/, "").trim(),
    };
  }

  const [requirementPart, detailPart] = text.split(" / ");
  const requirement = (requirementPart || text)
    .replace(/^\[[^:\]]+\]\s+(?=\[[^\]]+:)/, "")
    .replace(/^\[[^\]]+\]\s*/, "")
    .replace(/^[^:]+:\s*/, "")
    .trim();
  const detail = detailPart
    ?.replace(/^[^(]+\(([^)]+)\):\s*/, "$1 - ")
    ?.replace(/^[^:]+:\s*/, "")
    ?.replace(/\]$/, "")
    ?.trim()
    || "";

  return {
    requirement: normalizeReportDisplayText(requirement),
    detail: normalizeReportDisplayText(detail),
  };
}

function FitGapList({ title, items = [], tone }) {
  const isMatched = tone === "matched";
  const accent   = isMatched ? GREEN : "#C0392B";
  const accentBg = isMatched ? "rgba(12,166,120,0.06)" : "rgba(192,57,43,0.05)";
  const label    = isMatched ? "충족 근거" : "부족 근거";

  return (
    <div style={{ background: accentBg, border: `1px solid rgba(13,34,64,0.08)`, borderRadius: 18, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: NAVY, margin: 0 }}>{title}</p>
        <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: CARD, borderRadius: 99, padding: "3px 10px", border: `1px solid rgba(13,34,64,0.1)` }}>{items.length}개</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, index) => {
          const parsed = parseFitGapItem(item);
          return (
            <div key={index} style={{ background: CARD, borderRadius: 12, padding: 14, border: "1px solid rgba(13,34,64,0.06)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0, marginTop: 7 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: NAVY, lineHeight: 1.55, margin: parsed.detail ? "0 0 6px" : 0 }}>{parsed.requirement}</p>
                  {parsed.detail && (
                    <>
                      <p style={{ fontSize: 10, fontWeight: 700, color: accent, opacity: 0.8, letterSpacing: "0.06em", margin: "0 0 3px" }}>{label}</p>
                      <p style={{ fontSize: 13, color: "#495057", lineHeight: 1.65, margin: 0 }}>{parsed.detail}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationList({ items = [] }) {
  return (
    <div style={{ marginTop: 14, background: BG, border: "1px solid rgba(13,34,64,0.08)", borderRadius: 18, padding: 18 }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: NAVY, margin: "0 0 14px" }}>추천 보완 방향</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, index) => (
          <div key={index} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: PRIMARY_GRAD, color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{index + 1}</span>
            <p style={{ fontSize: 14, color: "#495057", lineHeight: 1.75, margin: 0 }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mentee Report ────────────────────────────────────────────────
function MenteeReport({ sessionId, report }) {
  const aiReport = report?.ai_report;
  const questionReports = aiReport?.question_reports || [];
  const questionMetaMap = useQuestionMetaMap(sessionId);
  const menteeNameMap = buildMenteeNameMap(questionReports);
  const topSummary = aiReport?.top_summary;
  const best = topSummary?.best_question;
  const worst = topSummary?.worst_question;
  const bestReport = questionReports.find((item) => item.question_id === best?.question_id);
  const worstReport = questionReports.find((item) => item.question_id === worst?.question_id);
  const fitGap = aiReport?.fit_gap;
  const qnas = questionReports.map((item, index) => ({
    q: `Q${index + 1} · ${item.question}`,
    text: item.answer || "답변 내용이 없습니다.",
    highlights: null,
    score: scoreToStars(item.score),
    rawScore: item.score,
    time: formatReplayTime(item.replay),
    note: item.evaluation_source === "sft" ? "SFT 평가" : "AI 평가",
    bad: item.question_id === worst?.question_id,
    reasoning: item.reasoning,
    strengths: item.strengths || [],
    improvements: item.improvements || [],
    replay: item.replay,
    questionId: item.question_id,
    answerId: item.answer_id,
    questionKind: getQuestionKindLabel(item, questionMetaMap, menteeNameMap),
    answererLabel: getAnswererLabel(item),
  }));
  const metaBadges = report?.__mock
    ? ["1차 AI 리포트", "분석 완료", "개발 mock"]
    : ["1차 AI 리포트", "분석 완료"];

  return (
    <div id="report-content" style={{ background: BG, minHeight: "100vh", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 80, textAlign: "left" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 24px" }}>
        {/* Meta */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
          {metaBadges.map((t, i) => (
            <span key={i} style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 6,
              background: "transparent",
              border: `1px solid ${i === 0 ? "rgba(12,166,120,0.4)" : i === 2 ? "rgba(13,34,64,0.2)" : "rgba(13,34,64,0.15)"}`,
              color: i === 0 ? GREEN : "#868E96",
              fontWeight: 600, letterSpacing: "0.02em",
            }}>{t}</span>
          ))}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, margin: "0 0 8px", letterSpacing: "-0.02em" }}>AI 면접 분석 리포트</h1>
        <p style={{ color: "#868E96", fontSize: 14, margin: "0 0 36px" }}>세션 #{report?.session_id || sessionId} · 종합 점수 <strong style={{ color: NAVY }}>{aiReport?.overall_score ?? report?.total_score ?? "-"} / 5</strong></p>

        {/* BEST / WORST */}
        <SectionTitle
          eyebrow="KEY QUESTIONS"
          title="AI가 뽑은 핵심 문항"
          description="가장 강점이 잘 드러난 답변과 보완이 필요한 답변을 함께 비교합니다."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 34 }}>
          <CoreQuestionCard
            type="best"
            question={best}
            report={bestReport}
            questionNo={toQuestionNo(best?.question_id, questionReports)}
          />
          <CoreQuestionCard
            type="worst"
            question={worst}
            report={worstReport}
            questionNo={toQuestionNo(worst?.question_id, questionReports)}
          />
        </div>

        {/* Fit-Gap */}
        <SectionTitle
          eyebrow="FIT-GAP"
          title="채용 요구사항 대비 역량 분석"
          description="지원자 제출 문서와 면접 답변을 근거로 충족/부족 요구사항을 정리합니다."
        />
        <div style={{ background: CARD, border: "1px solid rgba(13,34,64,0.08)", borderRadius: 20, padding: 22, marginBottom: 34, boxShadow: "0 2px 12px rgba(13,34,64,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
            <FitGapList title="충족한 요구사항" items={fitGap?.matched_requirements || []} tone="matched" />
            <FitGapList title="부족한 요구사항" items={fitGap?.missing_requirements || []} tone="missing" />
          </div>
          <RecommendationList items={fitGap?.recommendations || []} />
        </div>

        {/* Q&A Scripts */}
        <SectionTitle
          eyebrow="QUESTION REPORTS"
          title="전체 Q&A 답변 분석"
          description="문항별 답변 내용, 점수, 강점과 개선점을 확인합니다."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {qnas.map((qa, i) => (
            <div key={i} style={{ background: CARD, border: "1px solid rgba(13,34,64,0.08)", borderTop: `3px solid ${qa.bad ? "#C0392B" : GREEN}`, borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(13,34,64,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: NAVY, lineHeight: 1.55, margin: "0 0 8px" }}>{qa.q}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: NAVY, background: "rgba(13,34,64,0.06)", padding: "3px 10px", borderRadius: 99, border: "1px solid rgba(13,34,64,0.08)", fontWeight: 700 }}>{qa.questionKind}</span>
                    {qa.answererLabel && <span style={{ fontSize: 11, color: "#495057", background: BG, padding: "3px 10px", borderRadius: 99, border: "1px solid rgba(13,34,64,0.08)" }}>{qa.answererLabel}</span>}
                    {qa.note && <span style={{ fontSize: 11, color: "#868E96", background: BG, padding: "3px 10px", borderRadius: 99, border: "1px solid rgba(13,34,64,0.08)" }}>{qa.note}</span>}
                    {qa.bad && <span style={{ fontSize: 11, color: "#C0392B", background: "rgba(13,34,64,0.06)", padding: "3px 10px", borderRadius: 99, fontWeight: 700 }}>보완 필요</span>}
                  </div>
                </div>
                <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                  <Stars score={qa.score} />
                  <p style={{ fontSize: 12, color: "#868E96", fontWeight: 700, margin: "4px 0 0" }}>AI {qa.rawScore}</p>
                </div>
              </div>

              <div style={{ background: BG, borderRadius: 14, padding: 16, marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: NAVY, opacity: 0.45, letterSpacing: "0.08em", margin: "0 0 6px" }}>답변</p>
                <StarText text={qa.text} highlights={qa.highlights} />
              </div>

              {qa.reasoning && (
                <div style={{ background: "rgba(13,34,64,0.04)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: NAVY, opacity: 0.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>평가 근거</p>
                  <p style={{ fontSize: 14, color: "#495057", lineHeight: 1.75, margin: 0 }}>{qa.reasoning}</p>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <AudioPlayer sessionId={sessionId} questionId={qa.questionId} answerId={qa.answerId} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                <div style={{ background: "rgba(12,166,120,0.06)", borderRadius: 14, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: GREEN, margin: "0 0 8px" }}>강점</p>
                  {qa.strengths.map((item, idx) => <p key={idx} style={{ fontSize: 13, color: NAVY, opacity: 0.75, margin: "0 0 5px", lineHeight: 1.65 }}>· {item}</p>)}
                </div>
                <div style={{ background: "rgba(192,57,43,0.05)", borderRadius: 14, padding: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#C0392B", margin: "0 0 8px" }}>개선점</p>
                  {qa.improvements.map((item, idx) => <p key={idx} style={{ fontSize: 13, color: NAVY, opacity: 0.75, margin: "0 0 5px", lineHeight: 1.65 }}>· {item}</p>)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, background: CARD, border: "1px solid rgba(13,34,64,0.08)", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(13,34,64,0.05)" }}>
          <p style={{ color: NAVY, fontSize: 15, fontWeight: 800, margin: "0 0 6px" }}>멘토 리뷰 대기 중</p>
          <p style={{ color: "#495057", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
            멘토가 리포트를 검토하고 최종 피드백을 제출하면 마이페이지에서 최종 리포트를 확인할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Mentor Report ────────────────────────────────────────────────
function MentorReport({ sessionId, report }) {
  const navigate = useNavigate();
  const aiReport = report?.ai_report;
  const questionReports = aiReport?.question_reports || [];
  const questionMetaMap = useQuestionMetaMap(sessionId);
  const menteeNameMap = buildMenteeNameMap(questionReports);
  const menteeGroups = groupQuestionReportsByMentee(questionReports, sessionId);
  const fitGap = aiReport?.fit_gap || {};
  const overallScore = aiReport?.overall_score ?? report?.total_score ?? "-";

  const byMenteeName = (items = [], menteeName) => {
    const prefix = `[${menteeName}] `;
    const filtered = items.filter(item => String(item).startsWith(prefix));
    return filtered.length ? filtered : items;
  };

  return (
    <div id="report-content" style={{ background: BG, minHeight: "100vh", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 96, textAlign: "left" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 24px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          {["멘토용 AI 리포트", `세션 #${report?.session_id || sessionId}`, `${menteeGroups.length}명`].map((t, i) => (
            <span key={i} style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 6,
              background: "transparent",
              border: `1px solid ${i === 0 ? "rgba(12,166,120,0.4)" : "rgba(13,34,64,0.15)"}`,
              color: i === 0 ? GREEN : "#868E96",
              fontWeight: 700, letterSpacing: "0.02em",
            }}>{t}</span>
          ))}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, margin: "0 0 8px", letterSpacing: "-0.02em" }}>멘티별 AI 면접 분석 리포트</h1>
        <p style={{ color: "#868E96", fontSize: 14, margin: "0 0 36px" }}>
          그룹 면접 결과를 멘티별로 나누어 확인합니다. 종합 평균 점수 <strong style={{ color: NAVY }}>{overallScore} / 5</strong>
        </p>

        <SectionTitle
          eyebrow="MENTEE REPORTS"
          title="멘티별 분석 결과"
          description="각 멘티마다 BEST/WORST 문항, 채용 요구사항 대비 Fit-Gap, 전체 답변 분석을 분리해서 보여줍니다."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {menteeGroups.map((group) => {
            const { best, worst } = pickBestWorstReports(group.reports);
            const matchedItems = byMenteeName(fitGap.matched_requirements || [], group.menteeName);
            const missingItems = byMenteeName(fitGap.missing_requirements || [], group.menteeName);
            const recommendationItems = byMenteeName(fitGap.recommendations || [], group.menteeName);

            return (
              <section key={group.menteeId} style={{ background: CARD, border: "1px solid rgba(13,34,64,0.08)", borderRadius: 20, padding: 24, boxShadow: "0 2px 12px rgba(13,34,64,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 800, color: GREEN, letterSpacing: "0.08em", margin: "0 0 5px" }}>MENTEE</p>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: 0 }}>{group.menteeName}</h2>
                  </div>
                  <span style={{ fontSize: 12, color: NAVY, background: BG, border: "1px solid rgba(13,34,64,0.08)", borderRadius: 99, padding: "6px 12px", fontWeight: 800 }}>
                    답변 {group.reports.length}개
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
                  <CoreQuestionCard
                    type="best"
                    question={best ? { question_id: best.question_id, question: best.question, reason: best.reasoning } : null}
                    report={best}
                    questionNo={best ? `Q${group.reports.findIndex(item => makeReportCardKey(item, item.__reportIndex) === makeReportCardKey(best, best.__reportIndex)) + 1}` : "BEST"}
                  />
                  <CoreQuestionCard
                    type="worst"
                    question={worst ? { question_id: worst.question_id, question: worst.question, reason: worst.reasoning } : null}
                    report={worst}
                    questionNo={worst ? `Q${group.reports.findIndex(item => makeReportCardKey(item, item.__reportIndex) === makeReportCardKey(worst, worst.__reportIndex)) + 1}` : "WORST"}
                  />
                </div>

                <div style={{ background: BG, border: "1px solid rgba(13,34,64,0.08)", borderRadius: 18, padding: 18, marginBottom: 24 }}>
                  <p style={{ fontSize: 14, fontWeight: 900, color: NAVY, margin: "0 0 14px" }}>채용 요구사항 대비 Fit-Gap</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                    <FitGapList title="충족한 요구사항" items={matchedItems} tone="matched" />
                    <FitGapList title="부족한 요구사항" items={missingItems} tone="missing" />
                  </div>
                  <RecommendationList items={recommendationItems} />
                </div>

                <div>
                  <p style={{ fontSize: 14, fontWeight: 900, color: NAVY, margin: "0 0 14px" }}>답변별 분석</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {group.reports.map((qr, i) => {
                      const questionKind = getQuestionKindLabel(qr, questionMetaMap, menteeNameMap);
                      const isWorst = worst && makeReportCardKey(qr, qr.__reportIndex ?? i) === makeReportCardKey(worst, worst.__reportIndex ?? 0);
                      return (
                        <div key={makeReportCardKey(qr, qr.__reportIndex ?? i)} style={{ background: BG, borderRadius: 14, padding: 16, borderLeft: `3px solid ${isWorst ? "#C0392B" : GREEN}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 800, color: NAVY, lineHeight: 1.55, margin: "0 0 7px" }}>Q{i + 1} · {qr.question}</p>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, color: NAVY, background: CARD, padding: "3px 10px", borderRadius: 99, border: "1px solid rgba(13,34,64,0.08)", fontWeight: 800 }}>{questionKind}</span>
                                {isWorst && <span style={{ fontSize: 11, color: "#C0392B", background: "rgba(192,57,43,0.06)", padding: "3px 10px", borderRadius: 99, fontWeight: 800 }}>보완 필요</span>}
                              </div>
                            </div>
                            <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                              <Stars score={scoreToStars(qr.score)} />
                              <p style={{ fontSize: 12, color: "#868E96", fontWeight: 700, margin: "4px 0 0" }}>AI {qr.score}</p>
                            </div>
                          </div>
                          <div style={{ background: CARD, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: NAVY, opacity: 0.45, letterSpacing: "0.08em", margin: "0 0 6px" }}>답변</p>
                            <p style={{ color: "#495057", fontSize: 14, lineHeight: 1.75, margin: 0 }}>{qr.answer}</p>
                          </div>
                          {qr.reasoning && (
                            <div style={{ background: "rgba(13,34,64,0.04)", borderRadius: 12, padding: 14, marginBottom: 12 }}>
                              <p style={{ fontSize: 10, fontWeight: 800, color: NAVY, opacity: 0.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>평가 근거</p>
                              <p style={{ fontSize: 13, color: "#495057", lineHeight: 1.7, margin: 0 }}>{qr.reasoning}</p>
                            </div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 12 }}>
                            <div style={{ background: "rgba(12,166,120,0.06)", borderRadius: 14, padding: 14 }}>
                              <p style={{ fontSize: 12, fontWeight: 800, color: GREEN, margin: "0 0 8px" }}>강점</p>
                              {(qr.strengths || []).length > 0
                                ? qr.strengths.map((item, idx) => <p key={idx} style={{ fontSize: 13, color: NAVY, opacity: 0.75, margin: "0 0 5px", lineHeight: 1.65 }}>· {item}</p>)
                                : <p style={{ fontSize: 13, color: NAVY, opacity: 0.55, margin: 0, lineHeight: 1.65 }}>분석된 강점이 없습니다.</p>}
                            </div>
                            <div style={{ background: "rgba(192,57,43,0.05)", borderRadius: 14, padding: 14 }}>
                              <p style={{ fontSize: 12, fontWeight: 800, color: "#C0392B", margin: "0 0 8px" }}>개선점</p>
                              {(qr.improvements || []).length > 0
                                ? qr.improvements.map((item, idx) => <p key={idx} style={{ fontSize: 13, color: NAVY, opacity: 0.75, margin: "0 0 5px", lineHeight: 1.65 }}>· {item}</p>)
                                : <p style={{ fontSize: 13, color: NAVY, opacity: 0.55, margin: 0, lineHeight: 1.65 }}>분석된 개선점이 없습니다.</p>}
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <AudioPlayer sessionId={sessionId} questionId={qr.question_id} answerId={qr.answer_id} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div data-no-print style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={async () => {
              try { await updateSessionStatus(sessionId, "in_progress"); } catch {}
              navigate(`/mentoring/mentor/${sessionId}`);
            }}
            style={{ padding: "14px 26px", borderRadius: 12, border: "none", background: SUCCESS_GRAD, color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 24px rgba(12,166,120,0.24)", whiteSpace: "nowrap" }}
          >
            멘토링 세션 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
function exportWord(role) {
  window.print();
}

// ─── Page Root ────────────────────────────────────────────────────
export default function AIReportPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const role = location.state?.role || "mentee";
  const forceMockReport = location.state?.forceMockReport === true;

  useEffect(() => {
    let cancelled = false;

    async function fetchReport() {
      setError("");
      setPhase("loading");
      try {
        const data = await loadReport(sessionId, forceMockReport, role);
        if (cancelled) return;
        if (!data?.ai_report) {
          throw new Error("AI 리포트 데이터가 없습니다.");
        }
        setReport(data);
        setPhase("report");
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404) {
          navigate(`/report/generating/${sessionId}`, { state: { role }, replace: true });
          return;
        }
        setError(err.status === 401 ? "로그인이 필요하거나 인증이 만료되었습니다." : "AI 리포트를 불러오지 못했습니다.");
        setPhase("error");
      }
    }

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate, role, forceMockReport]);

  useEffect(() => {
    if (role !== "mentee" || !sessionId || !/^\d+$/.test(String(sessionId))) return;
    let cancelled = false;
    const checkMentoringStarted = async () => {
      try {
        const data = await loadSession(sessionId);
        const status = String(data?.status || "").toLowerCase();
        if (!cancelled && status === "in_progress") {
          navigate(`/mentoring/mentee/${sessionId}`);
        }
      } catch {}
    };
    const interval = window.setInterval(checkMentoringStarted, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [role, sessionId, navigate]);

  return (
    <div style={{ fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      <style>{`
        @media print {
          header, nav, button, [data-no-print] { display: none !important; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0 !important; padding: 10mm 12mm !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #report-content p, #report-content li, #report-content span {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
      {phase === "loading" ? (
        <LoadingScreen onDone={() => {}} />
      ) : phase === "error" ? (
        <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, width: "100%", background: CARD, border: "1px solid #E9ECEF", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFF5F5", border: "1px solid #FED7D7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>⚠️</div>
            <h2 style={{ color: NAVY, fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>리포트를 불러올 수 없습니다</h2>
            <p style={{ color: "#495057", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{ padding: "11px 28px", borderRadius: 10, border: "none", background: PRIMARY_GRAD, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              다시 시도
            </button>
          </div>
        </div>
      ) : (
        <>
          <Header onExportWord={() => exportWord(role)} role={role} />
          {role === "mentee"
            ? <MenteeReport sessionId={sessionId} report={report} />
            : <MentorReport sessionId={sessionId} report={report} />
          }
        </>
      )}
    </div>
  );
}
