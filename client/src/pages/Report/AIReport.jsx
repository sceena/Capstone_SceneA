import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getSessionAnalysisSummary, getAnswerAnalysis, getAnswerSegments, getFitGapAnalysis, getAnswerAudio } from "../../api/sessions";

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";
const CARD = "#FFFFFF";

// ─── Loading Screen ──────────────────────────────────────────────
function LoadingScreen({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const steps = [
    "음성 데이터 분석 중...",
    "WPM · 침묵 구간 측정 중...",
    "STAR 구조화 지표 분류 중...",
    "Fit-Gap 역량 교차 분석 중...",
    "AI 리포트 생성 완료!",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 2.2;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onDone, 600);
          return 100;
        }
        setStep(Math.floor((next / 100) * (steps.length - 1)));
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

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
      <p style={{ color: "#555", fontSize: 13, textAlign: "center", minHeight: 20, transition: "opacity 0.3s" }}>{steps[step]}</p>
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

// ─── Fit-Gap Bar ─────────────────────────────────────────────────
function FitGapBar({ label, pct }) {
  const color = pct >= 70 ? GREEN : pct >= 45 ? "#F59E0B" : "#E24B4A";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: "#333" }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{pct}%</span>
      </div>
      <div style={{ background: "#E8E5DF", borderRadius: 99, height: 8 }}>
        <div style={{ width: `${pct}%`, height: 8, borderRadius: 99, background: color, transition: "width 1s ease" }} />
      </div>
    </div>
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

// ─── Mentee Report ────────────────────────────────────────────────
function MenteeReport({ sessionId }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [qnaAnalysis, setQnaAnalysis] = useState({});
  const [fitGap, setFitGap] = useState(null);
  const audioRef = useRef(new Audio());

  /* 세션 AI 분석 요약 조회 */
  useEffect(() => {
    getSessionAnalysisSummary(sessionId).then(setSummary).catch(() => {});
    getFitGapAnalysis(sessionId).then(setFitGap).catch(() => {});
  }, [sessionId]);

  const handlePlayAudio = async (questionId, answerId) => {
    if (!questionId || !answerId) return;
    try {
      const url = await getAnswerAudio(sessionId, questionId, answerId);
      audioRef.current.src = url;
      audioRef.current.play();
    } catch {}
  };

  /* 요약에 질문 목록이 있으면 각 답변의 분석 + 세그먼트 조회 */
  useEffect(() => {
    if (!summary?.questions) return;
    summary.questions.forEach(({ questionId, answerId }) => {
      Promise.all([
        getAnswerAnalysis(sessionId, questionId, answerId).catch(() => null),
        getAnswerSegments(sessionId, questionId, answerId).catch(() => null),
      ]).then(([analysis, segments]) => {
        setQnaAnalysis(prev => ({
          ...prev,
          [`${questionId}_${answerId}`]: { analysis, segments },
        }));
      });
    });
  }, [summary, sessionId]);

  /* API 데이터 우선, 없으면 하드코딩 fallback */
  const qnas = summary?.questions?.map(q => ({
    q: q.questionText ?? "",
    text: qnaAnalysis[`${q.questionId}_${q.answerId}`]?.analysis?.sttText ?? q.sttText ?? "",
    highlights: qnaAnalysis[`${q.questionId}_${q.answerId}`]?.segments ?? null,
    score: q.aiScore ?? 0,
    time: q.duration ?? "",
    bad: q.isBest === false && q.isWorst === true,
    note: q.note ?? null,
    questionId: q.questionId,
    answerId: q.answerId,
  })) ?? [
    {
      q: "Q1 · 본인이 경험한 가장 큰 기술적 도전과 해결 과정을 말해주세요.",
      text: "카카오 인턴 당시 결제 서버가 피크 타임에 응답 지연이 3초를 넘는 상황이 발생했습니다. 원인 분석과 성능 개선을 2주 내에 마무리해야 했고, DB 쿼리 최적화와 Redis 캐싱을 도입했습니다. N+1 문제를 해결하고 캐시 히트율을 80%까지 끌어올렸습니다. 결과적으로 평균 응답 시간을 340ms까지 줄이는 데 성공했습니다.",
      highlights: [{ start: 0, end: 41, type: "S" }, { start: 41, end: 78, type: "T" }, { start: 78, end: 157, type: "A" }, { start: 157, end: 210, type: "R" }],
      score: 4, time: "1:24", note: "논리성✓"
    },
    {
      q: "Q2 · 협업 중 기술적 의견 충돌이 있었던 경험이 있나요?",
      text: "팀 프로젝트에서 REST API 설계 방식을 두고 팀원과 의견 차이가 있었는데요. 서로 다른 컨벤션을 가지고 있어서 통합이 필요했습니다. 제가 먼저 양쪽 방식의 장단점을 문서화해서 공유하고 팀 미팅을 통해 합의를 이끌어냈어요. 이후 API 일관성이 높아져서 개발 속도가 빨라졌습니다.",
      highlights: [{ start: 0, end: 43, type: "S" }, { start: 43, end: 79, type: "T" }, { start: 79, end: 159, type: "A" }, { start: 159, end: 210, type: "R" }],
      score: 5, time: "0:58"
    },
    {
      q: "Q3 · MSA 환경에서의 서비스 간 통신 방식에 대해 설명해보세요.",
      text: "MSA는 마이크로서비스 아키텍처인데 서비스들이 독립적으로 운영되고 그리고 서로 통신할 때는 REST를 쓰거나 아니면 메시지 큐를 쓰는 방법도 있고 또 gRPC라는 방법도 있는데 저는 주로 REST를 많이 써봤고...",
      highlights: null,
      score: 2, time: "2:11", bad: true, note: "논리성△"
    },
  ];

  return (
    <div id="report-content" style={{ background: BG, minHeight: "100vh", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>
        {/* Meta */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["1차 AI 리포트", "분석 완료"].map((t, i) => (
            <span key={i} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: i === 0 ? "#E1F5EE" : "#E8E5DF", color: i === 0 ? "#0F6E56" : "#666", fontWeight: 600 }}>{t}</span>
          ))}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111", margin: "0 0 6px" }}>백엔드 개발자 모의 면접</h1>
        <p style={{ color: "#888", fontSize: 13, margin: "0 0 32px" }}>2026.04.02 오후 7:00 · 멘토 박지훈 · 1:1 세션 · 60분</p>

        {/* BEST / WORST */}
        <p style={{ fontSize: 12, fontWeight: 700, color: "#666", letterSpacing: 1, marginBottom: 12 }}>AI가 뽑은 핵심 문항</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          <div style={{ background: "#1E3A5F", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7DD3FC", letterSpacing: 1 }}>● BEST 문항</span>
              <span style={{ fontSize: 11, color: "#7DD3FC" }}>Q1</span>
            </div>
            <p style={{ color: "white", fontSize: 14, fontWeight: 600, lineHeight: 1.6, margin: "0 0 12px" }}>"결과적으로 평균 응답 시간을 340ms까지 줄이는 데 성공했습니다."</p>
            <p style={{ color: "#93C5FD", fontSize: 12, margin: 0, lineHeight: 1.5 }}>수치 기반 결과 제시 + 행동-결과 인과관계가 명확해 설득력이 높아요.</p>
          </div>
          <div style={{ background: "#4A1515", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FCA5A5", letterSpacing: 1 }}>● WORST 문항</span>
              <span style={{ fontSize: 11, color: "#FCA5A5" }}>Q3</span>
            </div>
            <p style={{ color: "white", fontSize: 14, fontWeight: 600, lineHeight: 1.6, margin: "0 0 12px" }}>"REST를 쓰거나 아니면 메시지 큐를 쓰는 방법도 있고 또 gRPC라는 방법도 있는데..."</p>
            <p style={{ color: "#FCA5A5", fontSize: 12, margin: 0, lineHeight: 1.5 }}>만연체 + 경험 없는 이론 나열. 구체적 사례나 학습 의지로 전환이 필요해요.</p>
          </div>
        </div>

        {/* Quantitative metrics */}
        <p style={{ fontSize: 12, fontWeight: 700, color: "#666", letterSpacing: 1, marginBottom: 12 }}>정량 평가 요약</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: 18 }}>
            <p style={{ fontSize: 11, color: "#166534", fontWeight: 700, margin: "0 0 14px", letterSpacing: 1 }}>BEST — 잘한 점</p>
            {[["말하기 속도", "118 WPM · 안정적", "양호"], ["STAR 구조화", "4 / 4 구성", null], ["평균 반응 속도", "1.8초", null]].map(([k, v, badge]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #D1FAE5" }}>
                <span style={{ fontSize: 13, color: "#333" }}>{k}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>{v}</span>
                  {badge && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: GREEN, color: "white" }}>{badge}</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 12, padding: 18 }}>
            <p style={{ fontSize: 11, color: "#9B1C1C", fontWeight: 700, margin: "0 0 14px", letterSpacing: 1 }}>WORST — 개선 필요</p>
            {[["Q3 말하기 속도", "187 WPM · 평소 대비 1.6배 빠름", "긴장"], ["침묵 (Dead Air)", "3초 이상 · 4회", null], ["문장 간결성", "만연체 패턴 감지", null]].map(([k, v, badge]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #FED7D7" }}>
                <span style={{ fontSize: 13, color: "#333" }}>{k}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#9B1C1C" }}>{v}</span>
                  {badge && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#E24B4A", color: "white" }}>{badge}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fit-Gap */}
        <p style={{ fontSize: 12, fontWeight: 700, color: "#666", letterSpacing: 1, marginBottom: 12 }}>핏-갭 (Fit-Gap) 역량 분석</p>
        <div style={{ background: CARD, border: "1px solid #E8E5DF", borderRadius: 14, padding: 22, marginBottom: 28 }}>
          <p style={{ fontSize: 12, color: "#999", marginBottom: 16, margin: "0 0 16px" }}>채용 공고 요구 역량 대비 자소서 & 답변 커버리지</p>
          {(fitGap?.skills?.map(s => [s.label, s.pct]) ?? [
            ["Java / Spring Boot", 92], ["대규모 트래픽 경험", 78], ["CI/CD · DevOps", 51], ["MSA · 분산 시스템", 44], ["데이터 파이프라인", 22]
          ]).map(([l, p]) => (
            <FitGapBar key={l} label={l} pct={p} />
          ))}
          <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
            {[["충분히 커버", GREEN], ["보완 필요", "#F59E0B"], ["갭 발생", "#E24B4A"]].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#666" }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, background: c }} /> {l}
              </div>
            ))}
          </div>
        </div>

        {/* Q&A Scripts */}
        <p style={{ fontSize: 12, fontWeight: 700, color: "#666", letterSpacing: 1, marginBottom: 12 }}>전체 Q&A 스크립트</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[["S 상황", "#DBEAFE", "#1E40AF"], ["T 과제", "#D1FAE5", "#065F46"], ["A 행동", "#FEF3C7", "#92400E"], ["R 결과", "#FCE7F3", "#9D174D"]].map(([l, bg, c]) => (
            <span key={l} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: bg, color: c, fontWeight: 600 }}>{l}</span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {qnas.map((qa, i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${qa.bad ? "#FED7D7" : "#E8E5DF"}`, borderRadius: 14, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 12 }}>{qa.q}</p>
              <StarText text={qa.text} highlights={qa.highlights} />
              {qa.note && <span style={{ fontSize: 11, color: "#666", background: "#FAF8F4", padding: "2px 8px", borderRadius: 99, marginLeft: 6 }}>{qa.note}</span>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Stars score={qa.score} />
                  <span style={{ fontSize: 12, color: "#888" }}>AI {qa.score}.0</span>
                </div>
                <button
                  onClick={() => handlePlayAudio(qa.questionId, qa.answerId)}
                  style={{ fontSize: 12, color: GREEN, border: `1px solid ${GREEN}`, background: "transparent", borderRadius: 99, padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  답변 듣기 · {qa.time}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 멘토링 세션 입장 */}
        <div style={{ marginTop: 32, background: NAVY, borderRadius: 16, padding: 28, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 8px" }}>AI 리포트 분석이 완료되었습니다</p>
          <p style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>멘토와 함께 리포트를 리뷰하는 시간을 가져보세요</p>
          <button
            onClick={() => navigate(`/mentoring/mentee/${sessionId}`)}
            style={{ padding: "14px 40px", borderRadius: 12, border: "none", background: GREEN, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.2s" }}
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
function MentorReport({ sessionId }) {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState("");
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState("전체");
  const mentees = [
    { initials: "김M", name: "김민준", track: "백엔드·신입", wpm: 118, star: "4/4", silence: 2, score: 4.2, color: "#3B5A8A",
      quotes: ["평균 응답 시간을 340ms까지 줄이는 데 성공했습니다.", "REST를 쓰거나 메시지 큐를 쓰는 방법도 있고 gRPC라는 방법도 있는데..."],
      myScore: 4, done: true },
    { initials: "박S", name: "박서연", track: "프론트엔드·1년차", wpm: 142, star: "3/4", silence: 1, score: 3.5, color: "#3A7A6A",
      quotes: ["React 렌더링 최적화로 LCP를 2.1초에서 0.8초로 단축했어요.", "결과가 어떻게 됐는지는 정확히 기억이 잘 안 나서..."],
      myScore: 3.5, done: false },
    { initials: "최H", name: "최현아", track: "풀스택·신입", wpm: 192, star: "2/4", silence: 5, score: 2.8, color: "#7A4A6A",
      quotes: ["사용자 불편을 직접 인터뷰해서 문제를 정의했습니다.", "그래서 그냥 다 고쳐보려고 했는데 잘 안 됐어요 뭔가..."],
      myScore: 2, done: false },
    { initials: "이J", name: "이준석", track: "백엔드·2년차", wpm: 125, star: "4/4", silence: 0, score: 4.7, color: "#5A6A3A",
      quotes: ["팀 배포 사이클을 3일에서 당일로 줄인 CI/CD 파이프라인을 구축했습니다.", "단점이라고 하면 딱히 생각나는 게 없는데요..."],
      myScore: 4.7, done: false },
  ];

  const filtered = filter === "전체" ? mentees : filter === "AI 분석 완료" ? mentees.slice(0, 2) : mentees.filter(m => !m.done);

  const wpmColor = (wpm) => wpm < 130 ? GREEN : wpm < 160 ? "#F59E0B" : "#E24B4A";

  return (
    <div id="report-content" style={{ background: BG, minHeight: "100vh", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
        {/* Session info */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {["그룹 면접·4인", "2026.04.07 오후 8:00", "프론트엔드 직무"].map((t, i) => (
            <span key={i} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: i === 1 ? "#E1F5EE" : CARD, border: "1px solid #E0DDD8", color: i === 1 ? "#0F6E56" : "#555", fontWeight: 600 }}>{t}</span>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          {["전체 (4)", "AI 분석 완료", "피드백 작성 필요"].map((f) => {
            const label = f.split(" ")[0];
            return (
              <button key={f} onClick={() => setFilter(label)}
                style={{ padding: "7px 18px", borderRadius: 99, border: `1.5px solid ${filter === label ? NAVY : "#DDD"}`, background: filter === label ? NAVY : "white", color: filter === label ? "white" : "#555", fontSize: 13, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" }}>
                {f}
              </button>
            );
          })}
        </div>

        {/* Mentee cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 36 }}>
          {filtered.map((m, i) => (
            <div key={i} style={{ background: CARD, border: `2px solid ${m.done ? NAVY : "#E8E5DF"}`, borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: m.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700 }}>{m.initials}</div>
                <div>
                  <p style={{ fontWeight: 700, margin: 0, fontSize: 15, color: "#111" }}>{m.name}</p>
                  <p style={{ color: "#888", fontSize: 12, margin: 0 }}>{m.track}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[["말하기 속도", `${m.wpm} WPM`, wpmColor(m.wpm)], ["STAR 구조화", m.star, GREEN], ["침묵 횟수", `${m.silence}회`, m.silence <= 2 ? "#555" : "#E24B4A"], ["AI 종합점수", m.score, m.score >= 4 ? GREEN : m.score >= 3 ? "#F59E0B" : "#E24B4A"]].map(([k, v, c]) => (
                  <div key={k} style={{ background: "#F8F7F4", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ fontSize: 11, color: "#999", margin: "0 0 4px" }}>{k}</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: c, margin: 0 }}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                {m.quotes.map((q, j) => (
                  <p key={j} style={{ fontSize: 12, color: "#555", lineHeight: 1.6, margin: "0 0 4px", paddingLeft: 12, borderLeft: `3px solid ${j === 0 ? GREEN : "#E24B4A"}` }}>"{q}"</p>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Stars score={Math.round(m.myScore)} />
                  <span style={{ fontSize: 12, color: "#888" }}>{m.myScore}</span>
                </div>
                <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: m.done ? "#E1F5EE" : "#FFF5F5", color: m.done ? "#0F6E56" : "#E24B4A", fontWeight: 600 }}>{m.done ? "피드백 완료" : "피드백 필요"}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 멘토링 세션 입장 */}
        <div style={{ background: NAVY, borderRadius: 16, padding: 28, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 8px" }}>AI 분석이 완료되었습니다</p>
          <p style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>멘티와 함께 리포트를 리뷰하는 멘토링 세션을 시작해보세요</p>
          <button
            onClick={() => navigate(`/mentoring/mentor/${sessionId}`)}
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
  const [phase, setPhase] = useState("loading");
  const role = location.state?.role || "mentee";

  return (
    <div style={{ fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      {phase === "loading" ? (
        <LoadingScreen onDone={() => setPhase("report")} />
      ) : (
        <>
          <Header onExportWord={() => exportWord(role)} />
          {role === "mentee"
            ? <MenteeReport sessionId={sessionId} />
            : <MentorReport sessionId={sessionId} />
          }
        </>
      )}
    </div>
  );
}
