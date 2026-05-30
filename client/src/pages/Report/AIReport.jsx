import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import mockAiReport from "./mockAiReport";

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";
const CARD = "#FFFFFF";
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

async function loadReport(sessionId) {
  try {
    return await requestJson(`/api/sessions/${sessionId}/report`);
  } catch (error) {
    try {
      if (error.status !== 404) throw error;
      return await requestJson(`/api/sessions/${sessionId}/report/generate`, { method: "POST" });
    } catch (finalError) {
      if (USE_MOCK_REPORT) {
        console.warn("Using mock AI report because the report API is unavailable.", finalError);
        return createMockReport(sessionId);
      }
      throw finalError;
    }
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
  return Math.max(1, Math.min(5, Math.round((Number(score) || 0) / 2)));
}

function formatReplayTime(replay = {}) {
  if (!replay.start_time || !replay.end_time) return "다시듣기";
  const start = replay.start_time.split("T").pop()?.slice(0, 8);
  const end = replay.end_time.split("T").pop()?.slice(0, 8);
  return start && end ? `${start} - ${end}` : "다시듣기";
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
        <div style={{ width: 72, height: 72, background: NAVY, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "pulse 1.5s ease-in-out infinite" }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect x="4" y="4" width="12" height="12" rx="2" fill="white" opacity="0.9" />
            <rect x="20" y="4" width="12" height="12" rx="2" fill="white" opacity="0.6" />
            <rect x="4" y="20" width="12" height="12" rx="2" fill="white" opacity="0.6" />
            <rect x="20" y="20" width="12" height="12" rx="2" fill={GREEN} opacity="1" />
          </svg>
        </div>
        <h2 style={{ textAlign: "center", color: NAVY, fontSize: 22, fontWeight: 700, margin: 0 }}>AI 면접 분석 리포트</h2>
        <p style={{ textAlign: "center", color: "#666", fontSize: 14, margin: "8px 0 0" }}>면접 데이터를 정밀 분석하고 있습니다</p>
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
function Header({ onExportWord }) {
  return (
    <header style={{ background: NAVY, padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.12)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
            <rect x="4" y="4" width="12" height="12" rx="2" fill="white" opacity="0.9" />
            <rect x="20" y="4" width="12" height="12" rx="2" fill="white" opacity="0.6" />
            <rect x="4" y="20" width="12" height="12" rx="2" fill="white" opacity="0.6" />
            <rect x="20" y="20" width="12" height="12" rx="2" fill={GREEN} />
          </svg>
        </div>
        <span style={{ color: "white", fontWeight: 600, fontSize: 15 }}>AI 면접 분석 리포트</span>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onExportWord} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: GREEN, color: "white", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          Word 내보내기
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
  const labelColor = isBest ? "#166534" : "#9B1C1C";
  const valueColor = isBest ? "#14532D" : "#7F1D1D";
  const borderColor = isBest ? "#BBF7D0" : "#FED7D7";
  const bgColor = isBest ? "#F0FDF4" : "#FFF5F5";
  const rows = [
    ["말하기 속도", metrics?.speaking_speed || "미측정"],
    ["침묵", metrics?.silence || "미측정"],
    ["문장 명료도", metrics?.sentence_clarity || "미측정"],
    ["답변 구조", metrics?.star_structure || "미측정"],
  ];

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${borderColor}` }}>
      <p style={{ color: labelColor, fontSize: 11, fontWeight: 700, margin: "0 0 8px" }}>이 답변의 정량 평가</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ background: bgColor, borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ color: labelColor, fontSize: 10, fontWeight: 700, margin: "0 0 4px" }}>{label}</p>
      <p style={{ color: valueColor, fontSize: 13, fontWeight: 700, margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 800, color: GREEN, letterSpacing: 1, margin: "0 0 6px" }}>{eyebrow}</p>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: "0 0 6px" }}>{title}</h2>
      {description && <p style={{ fontSize: 14, color: "#666", lineHeight: 1.65, margin: 0 }}>{description}</p>}
    </div>
  );
}

function CoreQuestionCard({ type, question, report, questionNo }) {
  const isBest = type === "best";
  const accent = isBest ? GREEN : "#E24B4A";
  const softBg = isBest ? "#F0FDF4" : "#FFF5F5";
  const title = isBest ? "BEST 문항" : "WORST 문항";
  const subtitle = isBest ? "가장 설득력 있었던 답변" : "보완이 가장 필요한 답변";

  return (
    <div style={{ background: CARD, border: "1px solid #E8E5DF", borderTop: `4px solid ${accent}`, borderRadius: 14, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: 0.5, margin: "0 0 4px" }}>{title}</p>
          <p style={{ fontSize: 13, color: "#777", margin: 0 }}>{subtitle}</p>
        </div>
        <span style={{ flex: "0 0 auto", fontSize: 12, fontWeight: 800, color: accent, background: softBg, borderRadius: 99, padding: "5px 10px" }}>{questionNo}</span>
      </div>

      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#777", margin: "0 0 6px" }}>질문</p>
        <p style={{ color: "#111", fontSize: 15, fontWeight: 700, lineHeight: 1.55, margin: 0 }}>{question?.question || `${title} 정보가 없습니다.`}</p>
      </div>

      <div style={{ background: "#F8F7F4", borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#777", margin: "0 0 6px" }}>답변</p>
        <p style={{ color: "#333", fontSize: 14, lineHeight: 1.75, margin: 0 }}>{report?.answer || "답변 정보가 없습니다."}</p>
      </div>

      <div style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: accent, margin: "0 0 6px" }}>AI 분석</p>
        <p style={{ color: "#444", fontSize: 14, lineHeight: 1.7, margin: 0 }}>{question?.reason || "분석 사유가 없습니다."}</p>
      </div>

      <MetricRows metrics={question?.metrics_summary} tone={type} />
    </div>
  );
}

function parseFitGapItem(item) {
  const [requirementPart, detailPart] = item.split(" / ");
  const requirement = requirementPart?.replace(/^요구사항:\s*/, "") || item;
  const detail = detailPart?.replace(/^근거\(([^)]+)\):\s*/, "$1 · ")?.replace(/^부족 근거:\s*/, "") || "";

  return { requirement, detail };
}

function FitGapList({ title, items = [], tone }) {
  const isMatched = tone === "matched";
  const accent = isMatched ? GREEN : "#E24B4A";
  const bg = isMatched ? "#F0FDF4" : "#FFF5F5";
  const label = isMatched ? "충족 근거" : "부족 근거";

  return (
    <div style={{ background: bg, border: `1px solid ${isMatched ? "#BBF7D0" : "#FED7D7"}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: accent, margin: 0 }}>{title}</p>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent, background: CARD, borderRadius: 99, padding: "4px 8px" }}>{items.length}개</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, index) => {
          const parsed = parseFitGapItem(item);
          return (
            <div key={index} style={{ background: CARD, borderRadius: 10, padding: 13, border: "1px solid rgba(0,0,0,0.04)", borderLeft: `3px solid ${accent}` }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#222", lineHeight: 1.5, margin: parsed.detail ? "0 0 8px" : 0 }}>{parsed.requirement}</p>
              {parsed.detail && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: 0.5, margin: "0 0 4px" }}>{label}</p>
                  <p style={{ fontSize: 14, color: "#555", lineHeight: 1.65, margin: 0 }}>{parsed.detail}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecommendationList({ items = [] }) {
  return (
    <div style={{ marginTop: 16, background: "#F8F7F4", border: "1px solid #E8E5DF", borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 12px" }}>추천 보완 방향</p>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, alignItems: "start" }}>
            <span style={{ width: 24, height: 24, borderRadius: "50%", background: NAVY, color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{index + 1}</span>
            <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: 0 }}>{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mentee Report ────────────────────────────────────────────────
function MenteeReport({ sessionId, report }) {
  const navigate = useNavigate();
  const aiReport = report?.ai_report;
  const questionReports = aiReport?.question_reports || [];
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
  }));
  const metaBadges = report?.__mock
    ? ["1차 AI 리포트", "분석 완료", "개발 mock"]
    : ["1차 AI 리포트", "분석 완료"];

  return (
    <div id="report-content" style={{ background: BG, minHeight: "100vh", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 80, textAlign: "left" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "36px 24px" }}>
        {/* Meta */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {metaBadges.map((t, i) => (
            <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: i === 0 ? "#E1F5EE" : i === 2 ? "#FFF3CD" : "#E8E5DF", color: i === 0 ? "#0F6E56" : i === 2 ? "#8A5A00" : "#666", fontWeight: 600 }}>{t}</span>
          ))}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111", margin: "0 0 8px" }}>AI 면접 분석 리포트</h1>
        <p style={{ color: "#666", fontSize: 14, margin: "0 0 34px" }}>세션 #{report?.session_id || sessionId} · 종합 점수 {aiReport?.overall_score ?? report?.total_score ?? "-"}점</p>

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
        <div style={{ background: CARD, border: "1px solid #E8E5DF", borderRadius: 14, padding: 20, marginBottom: 34 }}>
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
            <div key={i} style={{ background: CARD, border: `1px solid ${qa.bad ? "#FED7D7" : "#E8E5DF"}`, borderLeft: `4px solid ${qa.bad ? "#E24B4A" : GREEN}`, borderRadius: 14, padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: NAVY, lineHeight: 1.55, margin: "0 0 6px" }}>{qa.q}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {qa.note && <span style={{ fontSize: 11, color: "#666", background: "#FAF8F4", padding: "3px 8px", borderRadius: 99 }}>{qa.note}</span>}
                    {qa.bad && <span style={{ fontSize: 11, color: "#9B1C1C", background: "#FFF5F5", padding: "3px 8px", borderRadius: 99, fontWeight: 700 }}>개선 우선</span>}
                  </div>
                </div>
                <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                  <Stars score={qa.score} />
                  <p style={{ fontSize: 13, color: "#666", fontWeight: 800, margin: "4px 0 0" }}>AI {qa.rawScore}</p>
                </div>
              </div>

              <div style={{ background: "#F8F7F4", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: "#777", margin: "0 0 6px" }}>답변</p>
                <StarText text={qa.text} highlights={qa.highlights} />
              </div>

              {qa.reasoning && (
                <div style={{ borderLeft: "3px solid #CAD3DF", paddingLeft: 12, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#667085", margin: "0 0 6px" }}>평가 근거</p>
                  <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: 0 }}>{qa.reasoning}</p>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <AudioPlayer sessionId={sessionId} questionId={qa.questionId} answerId={qa.answerId} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                <div style={{ background: "#F0FDF4", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: GREEN, margin: "0 0 8px" }}>장점</p>
                  {qa.strengths.map((item, idx) => <p key={idx} style={{ fontSize: 14, color: "#3F5F4B", margin: "0 0 5px", lineHeight: 1.6 }}>• {item}</p>)}
                </div>
                <div style={{ background: "#FFF5F5", borderRadius: 10, padding: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#E24B4A", margin: "0 0 8px" }}>개선점</p>
                  {qa.improvements.map((item, idx) => <p key={idx} style={{ fontSize: 14, color: "#6F4545", margin: "0 0 5px", lineHeight: 1.6 }}>• {item}</p>)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 멘토링 세션 입장 */}
        <div style={{ marginTop: 32, background: NAVY, borderRadius: 16, padding: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
          <div>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 8px" }}>AI 리포트 분석이 완료되었습니다</p>
            <p style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>멘토와 함께 리포트를 리뷰하는 시간을 가져보세요</p>
          </div>
          <button
            onClick={() => navigate(`/mentoring/mentee/${sessionId}`)}
            style={{ flex: "0 0 auto", padding: "14px 28px", borderRadius: 12, border: "none", background: GREEN, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            멘토링 세션 입장하기 →
          </button>
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
  const overallScore = aiReport?.overall_score ?? report?.total_score ?? 0;
  const scoreColor = overallScore >= 8 ? GREEN : overallScore >= 6 ? "#F59E0B" : "#E24B4A";
  const topSummary = aiReport?.top_summary;
  const best = topSummary?.best_question;
  const worst = topSummary?.worst_question;

  return (
    <div id="report-content" style={{ background: BG, minHeight: "100vh", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {/* 세션 헤더 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["멘토 리포트 보기", `세션 #${report?.session_id ?? sessionId}`].map((t, i) => (
            <span key={i} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: i === 0 ? "#E1F5EE" : CARD, border: "1px solid #E0DDD8", color: i === 0 ? "#0F6E56" : "#555", fontWeight: 600 }}>{t}</span>
          ))}
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111", margin: "0 0 6px" }}>멘티 AI 면접 분석 리포트</h1>
        <p style={{ color: "#666", fontSize: 14, margin: "0 0 28px" }}>멘티의 면접 결과를 확인하고 멘토링 세션을 준비하세요</p>

        {/* 종합 점수 */}
        <div style={{ background: CARD, border: "1px solid #E8E5DF", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: 0 }}>AI 종합 점수</p>
            <span style={{ fontSize: 28, fontWeight: 800, color: scoreColor }}>{overallScore}<span style={{ fontSize: 13, color: "#999", fontWeight: 400 }}> / 10</span></span>
          </div>
          <div style={{ background: "#E8E5DF", borderRadius: 99, height: 8 }}>
            <div style={{ width: `${Math.min(overallScore * 10, 100)}%`, height: 8, borderRadius: 99, background: scoreColor, transition: "width 1s ease" }} />
          </div>
        </div>

        {/* Best / Worst 문항 */}
        {(best || worst) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            {[{ type: "best", data: best, accent: GREEN, label: "BEST 문항" }, { type: "worst", data: worst, accent: "#E24B4A", label: "WORST 문항" }].map(({ type, data, accent, label }) => (
              data ? (
                <div key={type} style={{ background: CARD, border: `1px solid ${accent}30`, borderTop: `3px solid ${accent}`, borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: accent, margin: "0 0 8px" }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#111", margin: "0 0 6px", lineHeight: 1.5 }}>{data.question}</p>
                  <p style={{ fontSize: 12, color: "#666", margin: 0 }}>{data.reason}</p>
                </div>
              ) : null
            ))}
          </div>
        )}

        {/* Q&A 답변 목록 */}
        {questionReports.length > 0 && (
          <div style={{ background: CARD, border: "1px solid #E8E5DF", borderRadius: 14, padding: 20, marginBottom: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#111", margin: "0 0 16px" }}>전체 Q&A 답변</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {questionReports.map((qr, i) => {
                const sc = qr.score ?? 0;
                const scColor = sc >= 8 ? GREEN : sc >= 6 ? "#F59E0B" : "#E24B4A";
                const isBad = qr.question_id === worst?.question_id;
                return (
                  <div key={qr.question_id ?? i} style={{ borderLeft: `3px solid ${isBad ? "#E24B4A" : GREEN}`, paddingLeft: 12, paddingBottom: i < questionReports.length - 1 ? 14 : 0, borderBottom: i < questionReports.length - 1 ? "1px solid #F0EDE8" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, lineHeight: 1.5, margin: 0 }}>Q{i + 1} · {qr.question}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, color: scColor, background: `${scColor}18`, padding: "2px 8px", borderRadius: 99, flexShrink: 0 }}>AI {sc}</span>
                    </div>
                    <p style={{ fontSize: 12, color: "#555", lineHeight: 1.7, background: "#FAF8F4", borderRadius: 7, padding: "8px 10px", margin: 0 }}>{qr.answer}</p>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <AudioPlayer sessionId={sessionId} questionId={qr.question_id} answerId={qr.answer_id} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 멘토링 세션 입장 */}
        <div style={{ background: NAVY, borderRadius: 16, padding: 28, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 8px" }}>AI 분석이 완료되었습니다</p>
          <p style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>멘티와 함께 리포트를 리뷰하는 멘토링 세션을 시작해보세요</p>
          <button
            onClick={async () => {
              try { await updateSessionStatus(sessionId, "in_progress"); } catch {}
              navigate(`/mentoring/mentor/${sessionId}`);
            }}
            style={{ padding: "14px 40px", borderRadius: 12, border: "none", background: GREEN, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            멘토링 세션 시작하기 →
          </button>
        </div>
      </div>
    </div>
  );
}

function exportWord(role) {
  const el = document.getElementById("report-content");
  const bodyHtml = el ? el.innerHTML : "<p>리포트 내용을 불러올 수 없습니다.</p>";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; max-width: 860px; margin: 40px auto; color: #111; line-height: 1.8; background: #FAF8F4; }
    button { display: none !important; }
    svg { display: none !important; }
  </style>
  </head><body>${bodyHtml}</body></html>`;

  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `면접_리포트_${role === "mentee" ? "멘티" : "멘토"}_${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
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

  useEffect(() => {
    let cancelled = false;

    async function fetchReport() {
      setError("");
      setPhase("loading");
      try {
        const data = await loadReport(sessionId);
        if (cancelled) return;
        if (!data?.ai_report) {
          throw new Error("AI 리포트 데이터가 없습니다.");
        }
        setReport(data);
        setPhase("report");
      } catch (err) {
        if (cancelled) return;
        setError(err.status === 401 ? "로그인이 필요하거나 인증이 만료되었습니다." : "AI 리포트를 불러오지 못했습니다.");
        setPhase("error");
      }
    }

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

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
      {phase === "loading" ? (
        <LoadingScreen onDone={() => {}} />
      ) : phase === "error" ? (
        <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, width: "100%", background: CARD, border: "1px solid #E8E5DF", borderRadius: 14, padding: 28, textAlign: "center", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
            <h2 style={{ color: NAVY, fontSize: 20, margin: "0 0 10px" }}>리포트를 불러올 수 없습니다</h2>
            <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: GREEN, color: "white", fontWeight: 700, cursor: "pointer" }}
            >
              다시 시도
            </button>
          </div>
        </div>
      ) : (
        <>
          <Header onExportWord={() => exportWord(role)} />
          {role === "mentee"
            ? <MenteeReport sessionId={sessionId} report={report} />
            : <MentorReport sessionId={sessionId} report={report} />
          }
        </>
      )}
    </div>
  );
}
