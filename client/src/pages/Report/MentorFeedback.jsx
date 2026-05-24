import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSessionReport, saveMentorScore, saveMentorFeedback } from "../../api/sessions";

// ─── 상수 ────────────────────────────────────────────────────────
const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";

// ─── 더미 데이터 (실제 연동 시 API로 교체) ─────────────────────
const MOCK_SESSION = {
  sessionId: "sess-001",
  title: "백엔드 개발자 모의 면접",
  menteeName: "김민준",
  menteeTrack: "백엔드 · 신입",
  date: "2026.04.02 오후 7:00",
  duration: "60분",
  type: "1:1 세션",
  qnas: [
    {
      id: "q1",
      question: "Q1 · 본인이 경험한 가장 큰 기술적 도전과 해결 과정을 말해주세요.",
      aiScore: 4.0,
      aiComment: "수치 기반 결과 제시 + STAR 구조 완성도 높음.",
      transcript:
        "카카오 인턴 당시 결제 서버 피크 타임 응답 지연 문제를 Redis 캐싱으로 해결, 응답 시간 340ms 달성.",
    },
    {
      id: "q2",
      question: "Q2 · 협업 중 기술적 의견 충돌 경험이 있나요?",
      aiScore: 5.0,
      aiComment: "상황-과제-행동-결과가 모두 명확하게 서술됨.",
      transcript:
        "REST API 설계 방향 충돌 → 장단점 문서화 → 팀 합의 도출 → API 일관성 향상.",
    },
    {
      id: "q3",
      question: "Q3 · MSA 환경에서의 서비스 간 통신 방식에 대해 설명해보세요.",
      aiScore: 2.0,
      aiComment: "만연체 + 이론 나열, R(결과) 누락. 구체적 경험 부재.",
      transcript:
        "MSA는 서비스들이 독립적으로 운영되고 REST, 메시지 큐, gRPC 방법이 있는데 저는 주로 REST를 많이 써봤고...",
    },
  ],
};

// ─── StarPicker 컴포넌트 ─────────────────────────────────────────
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
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 24,
            color: star <= (hovered || value) ? "#F59E0B" : "#D1D5DB",
            transition: "color 0.1s, transform 0.1s",
            transform: star <= hovered ? "scale(1.2)" : "scale(1)",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
      <span
        style={{
          marginLeft: 8,
          fontSize: 14,
          color: "#888",
          alignSelf: "center",
        }}
      >
        {value.toFixed(1)}
      </span>
    </div>
  );
}

// ─── QuestionCard 컴포넌트 ────────────────────────────────────────
function QuestionCard({ qna, feedbacks, onChange }) {
  const fb = feedbacks[qna.id] || { score: qna.aiScore, comment: "" };

  return (
    <div
      style={{
        background: "white",
        borderRadius: 14,
        border: "1px solid #E0DDD8",
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {/* 질문 헤더 */}
      <div
        style={{
          background: "#F8F7F4",
          padding: "14px 20px",
          borderBottom: "1px solid #E0DDD8",
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NAVY,
            marginBottom: 6,
          }}
        >
          {qna.question}
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#666",
            lineHeight: 1.6,
            fontStyle: "italic",
          }}
        >
          "{qna.transcript}"
        </p>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {/* AI 분석 */}
        <div
          style={{
            background: "#F0F9FF",
            border: "1px solid #BAE6FD",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#0C4A6E",
              marginBottom: 4,
              letterSpacing: "0.5px",
            }}
          >
            AI 분석 (참고용)
          </p>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <p style={{ fontSize: 12, color: "#0369A1" }}>{qna.aiComment}</p>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#0C4A6E",
                background: "#E0F2FE",
                padding: "2px 10px",
                borderRadius: 99,
                whiteSpace: "nowrap",
                marginLeft: 12,
              }}
            >
              AI {qna.aiScore.toFixed(1)}점
            </span>
          </div>
        </div>

        {/* 멘토 별점 */}
        <div style={{ marginBottom: 16 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#333",
              marginBottom: 10,
            }}
          >
            멘토 별점
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: "#999",
                marginLeft: 6,
              }}
            >
              AI 점수를 덮어씁니다
            </span>
          </p>
          <StarPicker
            value={fb.score}
            onChange={(v) => onChange(qna.id, "score", v)}
          />
        </div>

        {/* 멘토 코멘트 */}
        <div>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#333",
              marginBottom: 8,
            }}
          >
            이 질문에 대한 코멘트
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: "#999",
                marginLeft: 6,
              }}
            >
              선택
            </span>
          </p>
          <textarea
            value={fb.comment}
            onChange={(e) => onChange(qna.id, "comment", e.target.value)}
            placeholder="해당 답변의 강점, 개선점을 구체적으로 작성해주세요."
            style={{
              width: "100%",
              borderRadius: 8,
              border: "1px solid #D1D5DB",
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.7,
              color: "#333",
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              minHeight: 72,
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = GREEN)}
            onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
          />
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────
export default function MentorFeedbackPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams(); // /mentor/feedback/:sessionId

  const [session, setSession] = useState(MOCK_SESSION);
  const [feedbacks, setFeedbacks] = useState({});
  const [totalFeedback, setTotalFeedback] = useState("");
  const [mentorScore, setMentorScore] = useState(4.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);

  // 세션 리포트 조회
  useEffect(() => {
    getSessionReport(sessionId)
      .then(data => setSession(prev => ({ ...prev, ...data })))
      .catch(() => {});
  }, [sessionId]);

  // 초기 피드백 세팅 (AI 점수 기본값)
  useEffect(() => {
    const initial = {};
    session.qnas.forEach((q) => {
      initial[q.id] = { score: q.aiScore, comment: "" };
    });
    setFeedbacks(initial);
  }, [session]);

  const handleQnaChange = (qId, field, value) => {
    setFeedbacks((prev) => ({
      ...prev,
      [qId]: { ...prev[qId], [field]: value },
    }));
    if (field === "score") {
      const qna = session.qnas.find(q => q.id === qId);
      if (qna?.answerId) {
        saveMentorScore(sessionId, qId, qna.answerId, value).catch(() => {});
      }
    }
  };

  const TEMPLATES = [
    {
      label: "강점 어필 권장",
      color: GREEN,
      bg: "#E1F5EE",
      text: "기술 스택 이해도는 탄탄합니다. 다음 면접에서는 경험 기반 근거를 수치와 함께 제시하면 더욱 설득력 있는 답변이 될 것입니다.",
    },
    {
      label: "속도·명확성 개선",
      color: "#9B1C1C",
      bg: "#FFF5F5",
      text: "말하기 속도를 130~150 WPM으로 맞추는 연습을 권장합니다. 타이머를 사용해 답변을 녹음하고 자가 점검해 보세요.",
    },
    {
      label: "STAR 구조 보완",
      color: "#92400E",
      bg: "#FEF3C7",
      text: "답변의 R(결과) 구간을 강화해주세요. '그래서 어떤 성과가 있었나요?'라는 질문에 항상 수치로 답할 수 있도록 준비해오세요.",
    },
    {
      label: "다음 세션 목표",
      color: "#185FA5",
      bg: "#E6F1FB",
      text: "다음 세션 목표: MSA 관련 학습 경험 1개 이상 준비, CS 기초 꼬리 질문 대비를 중점으로 준비해오세요.",
    },
  ];

  const insertTemplate = (tpl) => {
    setTotalFeedback((prev) => (prev ? prev + "\n\n" : "") + tpl.text);
    setActiveTemplate(tpl.label);
    setTimeout(() => setActiveTemplate(null), 1500);
  };

  const handleSubmit = async () => {
    if (!totalFeedback.trim()) {
      alert("총 피드백을 작성해주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      await saveMentorFeedback(sessionId, totalFeedback);
    } catch {}

    setTimeout(() => {
      navigate("/report/final", {
        state: {
          session,
          feedbacks,
          totalFeedback,
          mentorScore,
          sessionId,
        },
      });
    }, 800);
  };

  const avgQScore =
    Object.values(feedbacks).length > 0
      ? (
          Object.values(feedbacks).reduce((a, b) => a + b.score, 0) /
          Object.values(feedbacks).length
        ).toFixed(1)
      : "-";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      }}
    >
      {/* ── 상단 헤더 ──────────────────────────────────────────── */}
      <header
        style={{
          background: NAVY,
          padding: "0 32px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: GREEN,
            }}
          />
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
            멘토 최종 코멘트 작성
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ color: "#93C5FD", fontSize: 12 }}>{session.title}</p>
          <p style={{ color: "#60A5FA", fontSize: 11 }}>
            {session.menteeName} · {session.date}
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* ── 세션 요약 배너 ─────────────────────────────────────── */}
        <div
          style={{
            background: white,
            border: "1px solid #E0DDD8",
            borderRadius: 16,
            padding: "20px 24px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: NAVY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {session.menteeName.slice(0, 1)}M
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: "#111", marginBottom: 4 }}>
              {session.menteeName}
            </p>
            <p style={{ fontSize: 13, color: "#888" }}>{session.menteeTrack}</p>
          </div>
          {[
            ["면접 일시", session.date],
            ["세션 유형", session.type],
            ["진행 시간", session.duration],
          ].map(([k, v]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, color: "#999", marginBottom: 3 }}>{k}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>{v}</p>
            </div>
          ))}
        </div>

        {/* ── 섹션 1: 질문별 피드백 ─────────────────────────────── */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: NAVY,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              1
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>
                질문별 멘토 별점 & 코멘트
              </p>
              <p style={{ fontSize: 12, color: "#888" }}>
                AI 별점을 멘토 별점으로 덮어쓰고, 구체적 피드백을 남겨주세요
              </p>
            </div>
            <div
              style={{
                marginLeft: "auto",
                background: "#F8F7F4",
                borderRadius: 99,
                padding: "4px 14px",
              }}
            >
              <span style={{ fontSize: 12, color: "#888" }}>Q 평균 </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>
                {avgQScore}
              </span>
            </div>
          </div>

          {session.qnas.map((qna) => (
            <QuestionCard
              key={qna.id}
              qna={qna}
              feedbacks={feedbacks}
              onChange={handleQnaChange}
            />
          ))}
        </div>

        {/* ── 섹션 2: 총평 별점 ─────────────────────────────────── */}
        <div
          style={{
            background: "white",
            border: "1px solid #E0DDD8",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: NAVY,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              2
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>
                멘토 종합 평점
              </p>
              <p style={{ fontSize: 12, color: "#888" }}>
                이 멘티의 전체 면접 역량에 대한 최종 평점
              </p>
            </div>
          </div>
          <StarPicker value={mentorScore} onChange={setMentorScore} />
        </div>

        {/* ── 섹션 3: 총평 텍스트 ───────────────────────────────── */}
        <div
          style={{
            background: "white",
            border: "1px solid #E0DDD8",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: NAVY,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              3
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "#111" }}>
                멘토 총 피드백
              </p>
              <p style={{ fontSize: 12, color: "#888" }}>
                최종 리포트 맨 하단에 추가되어 멘티에게 전달됩니다
              </p>
            </div>
          </div>

          {/* 빠른 템플릿 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => insertTemplate(tpl)}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 99,
                  border: `1px solid ${tpl.color}30`,
                  background:
                    activeTemplate === tpl.label ? tpl.color : tpl.bg,
                  color:
                    activeTemplate === tpl.label ? "white" : tpl.color,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                + {tpl.label}
              </button>
            ))}
          </div>

          <textarea
            value={totalFeedback}
            onChange={(e) => setTotalFeedback(e.target.value)}
            placeholder="전반적인 면접 인상, 강점, 개선 포인트, 다음 세션 전 준비사항 등을 자유롭게 작성해주세요."
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid #D1D5DB",
              padding: "14px 16px",
              fontSize: 14,
              lineHeight: 1.8,
              color: "#333",
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
              minHeight: 160,
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = GREEN)}
            onBlur={(e) => (e.target.style.borderColor = "#D1D5DB")}
          />
          <p
            style={{
              textAlign: "right",
              fontSize: 11,
              color: "#aaa",
              marginTop: 6,
            }}
          >
            {totalFeedback.length}자
          </p>
        </div>

        {/* ── 제출 버튼 ─────────────────────────────────────────── */}
        <div
          style={{
            background: "white",
            border: "1px solid #E0DDD8",
            borderRadius: 14,
            padding: "20px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
              제출 후 최종 리포트가 자동 발송됩니다
            </p>
            <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              멘티({session.menteeName}) 및 멘토 본인 마이페이지에 동시 전달
            </p>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: "13px 32px",
              borderRadius: 11,
              border: "none",
              background: isSubmitting ? "#aaa" : NAVY,
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {isSubmitting ? "발행 중..." : "최종 리포트 발행 →"}
          </button>
        </div>
      </div>
    </div>
  );
}

const white = "white";
