import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSessionReport, saveMentorScore, saveMentorFeedback } from "../../api/sessions";

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";

const MOCK_SESSION_INFO = {
  sessionId: "sess-001",
  title: "백엔드 개발자 모의 면접",
  date: "2026.04.02 오후 7:00",
  duration: "60분",
  type: "그룹 세션",
};

const MOCK_MENTEES = [
  {
    menteeId: "m1",
    menteeName: "김민준",
    menteeTrack: "백엔드 · 신입",
    qnas: [
      { id: "m1-q1", question: "Q1 · 본인이 경험한 가장 큰 기술적 도전과 해결 과정을 말해주세요.", aiScore: 4.0, aiComment: "수치 기반 결과 제시 + STAR 구조 완성도 높음.", transcript: "카카오 인턴 당시 결제 서버 피크 타임 응답 지연 문제를 Redis 캐싱으로 해결, 응답 시간 340ms 달성." },
      { id: "m1-q2", question: "Q2 · 협업 중 기술적 의견 충돌 경험이 있나요?", aiScore: 5.0, aiComment: "상황-과제-행동-결과가 모두 명확하게 서술됨.", transcript: "REST API 설계 방향 충돌 → 장단점 문서화 → 팀 합의 도출 → API 일관성 향상." },
      { id: "m1-q3", question: "Q3 · MSA 환경에서의 서비스 간 통신 방식에 대해 설명해보세요.", aiScore: 2.0, aiComment: "만연체 + 이론 나열, R(결과) 누락. 구체적 경험 부재.", transcript: "MSA는 서비스들이 독립적으로 운영되고 REST, 메시지 큐, gRPC 방법이 있는데 저는 주로 REST를 많이 써봤고..." },
    ],
  },
  {
    menteeId: "m2",
    menteeName: "이서연",
    menteeTrack: "프론트엔드 · 신입",
    qnas: [
      { id: "m2-q1", question: "Q1 · React의 렌더링 최적화 방법에 대해 설명해보세요.", aiScore: 3.5, aiComment: "useMemo/useCallback 언급했으나 실제 활용 사례가 부족함.", transcript: "useMemo와 useCallback을 사용해 불필요한 렌더링을 방지하고, React.memo로 컴포넌트를 최적화합니다." },
      { id: "m2-q2", question: "Q2 · 상태 관리 라이브러리 선택 기준은 무엇인가요?", aiScore: 4.5, aiComment: "Redux vs Zustand 트레이드오프를 명확하게 비교함.", transcript: "프로젝트 규모와 팀 구성에 따라 다릅니다. 소규모는 Zustand, 대규모 엔터프라이즈는 Redux Toolkit을 선호합니다." },
    ],
  },
  {
    menteeId: "m3",
    menteeName: "박준혁",
    menteeTrack: "풀스택 · 신입",
    qnas: [
      { id: "m3-q1", question: "Q1 · REST API와 GraphQL의 차이를 설명해주세요.", aiScore: 4.8, aiComment: "오버페칭/언더페칭 문제를 정확히 짚어내고 실 사용 경험을 언급함.", transcript: "REST는 고정된 엔드포인트로 오버페칭이 발생할 수 있고, GraphQL은 필요한 데이터만 요청할 수 있어 모바일 환경에서 유리합니다." },
      { id: "m3-q2", question: "Q2 · CI/CD 파이프라인 구축 경험이 있나요?", aiScore: 3.0, aiComment: "개념은 이해하나 실제 구축 경험 미비. 도구 선택 이유 불명확.", transcript: "GitHub Actions를 사용해 자동 배포를 구현해봤습니다. Docker 컨테이너로 빌드하고 EC2에 배포했습니다." },
    ],
  },
];

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

function QuestionCard({ qna, feedbacks, onChange }) {
  const fb = feedbacks[qna.id] || { score: qna.aiScore, comment: "" };
  return (
    <div style={{ background: "white", borderRadius: 14, border: "1px solid #E0DDD8", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ background: "#F8F7F4", padding: "14px 20px", borderBottom: "1px solid #E0DDD8" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>{qna.question}</p>
        <p style={{ fontSize: 12, color: "#666", lineHeight: 1.6, fontStyle: "italic" }}>"{qna.transcript}"</p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 8, padding: "10px 12px", marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#0C4A6E", marginBottom: 4, letterSpacing: "0.5px" }}>AI 분석 (참고용)</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 12, color: "#0369A1" }}>{qna.aiComment}</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0C4A6E", background: "#E0F2FE", padding: "2px 10px", borderRadius: 99, whiteSpace: "nowrap", marginLeft: 12 }}>
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
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 8 }}>
            이 질문에 대한 코멘트
            <span style={{ fontSize: 11, fontWeight: 400, color: "#999", marginLeft: 6 }}>선택</span>
          </p>
          <textarea
            value={fb.comment}
            onChange={(e) => onChange(qna.id, "comment", e.target.value)}
            placeholder="해당 답변의 강점, 개선점을 구체적으로 작성해주세요."
            style={{
              width: "100%", borderRadius: 8, border: "1px solid #D1D5DB",
              padding: "10px 12px", fontSize: 13, lineHeight: 1.7, color: "#333",
              fontFamily: "inherit", resize: "vertical", outline: "none",
              minHeight: 72, transition: "border-color 0.15s", boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = GREEN)}
            onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
          />
        </div>
      </div>
    </div>
  );
}

export default function MentorFeedbackPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const [sessionInfo] = useState(MOCK_SESSION_INFO);
  const [menteeList, setMenteeList] = useState(MOCK_MENTEES);
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
    getSessionReport(sessionId)
      .then(data => {
        if (data?.mentees?.length) setMenteeList(data.mentees);
      })
      .catch(() => {});
  }, [sessionId]);

  // Init per-mentee feedback state
  useEffect(() => {
    const init = {};
    menteeList.forEach(m => {
      const fb = {};
      m.qnas.forEach(q => { fb[q.id] = { score: q.aiScore, comment: "" }; });
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
        saveMentorScore(sessionId, qId, qna.answerId, value).catch(() => {});
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
      await saveMentorFeedback(sessionId, currentFbData.totalFeedback);
    } catch {}
    const newSent = new Set([...sentMentees, currentMentee.menteeId]);
    setSentMentees(newSent);
    setIsSending(false);
    // Auto-advance to next unsent mentee
    const nextIdx = menteeList.findIndex((m, i) => i > currentMenteeIdx && !newSent.has(m.menteeId));
    if (nextIdx !== -1) setCurrentMenteeIdx(nextIdx);
  };

  const allSent = menteeList.length > 0 && menteeList.every(m => sentMentees.has(m.menteeId));

  const avgQScore = Object.values(currentFbData.feedbacks).length > 0
    ? (Object.values(currentFbData.feedbacks).reduce((a, b) => a + b.score, 0) / Object.values(currentFbData.feedbacks).length).toFixed(1)
    : "-";

  const timerColor = timeLeft < 300 ? "#EF4444" : timeLeft < 900 ? "#F59E0B" : GREEN;
  const timerUrgent = timeLeft < 300;

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN }} />
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>멘토 최종 코멘트 작성</span>
        </div>
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
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #E0DDD8", marginBottom: 24, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F0EDE8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
        <div style={{ background: "white", border: "1px solid #E0DDD8", borderRadius: 16, padding: "20px 24px", marginBottom: 28, display: "flex", alignItems: "center", gap: 20 }}>
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
              <p style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>질문별 멘토 별점 & 코멘트</p>
              <p style={{ fontSize: 12, color: "#888" }}>AI 별점을 멘토 별점으로 덮어쓰고, 구체적 피드백을 남겨주세요</p>
            </div>
            <div style={{ marginLeft: "auto", background: "#F8F7F4", borderRadius: 99, padding: "4px 14px" }}>
              <span style={{ fontSize: 12, color: "#888" }}>Q 평균 </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{avgQScore}</span>
            </div>
          </div>
          {currentMentee?.qnas.map((qna) => (
            <QuestionCard key={qna.id} qna={qna} feedbacks={currentFbData.feedbacks} onChange={handleQnaChange} />
          ))}
        </div>

        {/* Section 2: Overall score */}
        <div style={{ background: "white", border: "1px solid #E0DDD8", borderRadius: 14, padding: "20px 24px", marginBottom: 16 }}>
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
        <div style={{ background: "white", border: "1px solid #E0DDD8", borderRadius: 14, padding: "20px 24px", marginBottom: 28 }}>
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
            placeholder="전반적인 면접 인상, 강점, 개선 포인트, 다음 세션 전 준비사항 등을 자유롭게 작성해주세요."
            style={{
              width: "100%", borderRadius: 10, border: "1px solid #D1D5DB",
              padding: "14px 16px", fontSize: 14, lineHeight: 1.8, color: "#333",
              fontFamily: "inherit", resize: "vertical", outline: "none",
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
        <div style={{ background: "white", border: "1px solid #E0DDD8", borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, marginBottom: allSent ? 16 : 0 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
              {currentMentee?.menteeName}에게 최종 리포트 전송
            </p>
            <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              전송 후 멘티 마이페이지에 자동 전달됩니다
            </p>
          </div>
          {sentMentees.has(currentMentee?.menteeId) ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#E1F5EE", border: `1px solid ${GREEN}50`, borderRadius: 10, padding: "12px 24px" }}>
              <span style={{ color: GREEN, fontSize: 16 }}>✓</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>전송 완료</span>
            </div>
          ) : (
            <button type="button" onClick={handleSendCurrent} disabled={isSending} style={{
              padding: "13px 28px", borderRadius: 11, border: "none",
              background: isSending ? "#aaa" : NAVY, color: "white",
              fontSize: 14, fontWeight: 700,
              cursor: isSending ? "not-allowed" : "pointer",
              transition: "background 0.2s", whiteSpace: "nowrap",
            }}>
              {isSending ? "전송 중..." : `${currentMentee?.menteeName}에게 전송 →`}
            </button>
          )}
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
