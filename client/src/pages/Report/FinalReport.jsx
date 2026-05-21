import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getFitGapAnalysis } from "../../api/sessions";

// ─── 상수 ────────────────────────────────────────────────────────
const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";

// ─── 유틸 ────────────────────────────────────────────────────────
function Stars({ score, size = 14, color = "#F59E0B" }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{ fontSize: size, color: i <= Math.round(score) ? color : "#D1D5DB" }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function Tag({ children, bg, color }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 99,
        background: bg,
        color,
        fontWeight: 700,
        display: "inline-block",
        marginRight: 6,
        marginBottom: 4,
      }}
    >
      {children}
    </span>
  );
}

function FitGapBar({ label, pct }) {
  const color = pct >= 70 ? GREEN : pct >= 45 ? "#F59E0B" : "#E24B4A";
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 5,
        }}
      >
        <span style={{ color: "#333" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div
        style={{
          background: "#E8E5DF",
          borderRadius: 99,
          height: 7,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: 7,
            borderRadius: 99,
            background: color,
            transition: "width 1.2s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── export 유틸 ─────────────────────────────────────────────────
function exportToPDF(reportData) {
  const el = document.getElementById("final-report-content");
  const bodyHtml = el ? el.innerHTML : "<p>리포트 내용을 불러올 수 없습니다.</p>";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; max-width: 860px; margin: 40px auto; color: #111; line-height: 1.8; background: #FAF8F4; }
    button { display: none !important; }
    svg { display: none !important; }
  </style>
  </head><body>${bodyHtml}</body></html>`;

  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `최종리포트_${reportData.session.menteeName}_${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────
export default function FinalReportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // navigate("/report/final", { state: { session, feedbacks, totalFeedback, mentorScore, role } })
  const reportData = location.state;

  const [notified, setNotified] = useState(false);
  const [showMentorComment, setShowMentorComment] = useState(false);
  const [fitGap, setFitGap] = useState(null);

  useEffect(() => {
    if (!reportData?.sessionId) return;
    getFitGapAnalysis(reportData.sessionId).then(setFitGap).catch(() => {});
  }, [reportData?.sessionId]);

  // 리포트 데이터가 없으면 마이페이지로
  useEffect(() => {
    if (!reportData) {
      navigate("/mypage");
    }
  }, [reportData, navigate]);

  // 멘토 코멘트 섹션 애니메이션 지연
  useEffect(() => {
    const t = setTimeout(() => setShowMentorComment(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!reportData) return null;

  const { session, feedbacks, totalFeedback, mentorScore } = reportData;
  const role = reportData?.role || "mentee"; // "mentor" | "mentee"

  const avgMentorScore = (
    Object.values(feedbacks).reduce((a, b) => a + b.score, 0) /
    Object.values(feedbacks).length
  ).toFixed(1);

  const handleNotify = () => {
    // ── API 연동 포인트 ──────────────────────────────────────────
    // await api.sendFinalReport({ sessionId: session.sessionId });
    setNotified(true);
  };

  // ── Q&A 배경색 (STAR 하이라이트) ──────────────────────────────
  const STAR_COLORS = {
    S: { bg: "#DBEAFE", text: "#1E40AF" },
    T: { bg: "#D1FAE5", text: "#065F46" },
    A: { bg: "#FEF3C7", text: "#92400E" },
    R: { bg: "#FCE7F3", text: "#9D174D" },
  };

  const FIT_GAP = fitGap?.skills?.map(s => [s.label, s.pct]) ?? [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* ── 헤더 ──────────────────────────────────────────────── */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "none",
              color: "white",
              borderRadius: 7,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← 뒤로
          </button>
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
            최종 리포트
          </span>
          <span
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 99,
              background: GREEN,
              color: "white",
              fontWeight: 700,
            }}
          >
            멘토 코멘트 포함
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {/* 멘토만: 멘티 전송 버튼 */}
          {role === "mentor" && (
            <button
              onClick={handleNotify}
              disabled={notified}
              style={{
                padding: "8px 18px",
                borderRadius: 9,
                border: "none",
                background: notified ? "#555" : GREEN,
                color: "white",
                fontSize: 13,
                fontWeight: 700,
                cursor: notified ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.2s",
              }}
            >
              {notified ? "✓ 멘티에게 전송 완료" : "멘티에게 전송하기"}
            </button>
          )}
          <button
            onClick={() => exportToPDF(reportData)}
            style={{
              padding: "8px 16px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "transparent",
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Word 저장
          </button>
        </div>
      </header>

      <div id="final-report-content" style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px" }}>
        {/* ── 메타 정보 ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <Tag bg="#E8E5DF" color="#555">1차 AI 리포트</Tag>
          <Tag bg={GREEN} color="white">멘토 코멘트 완료</Tag>
          <Tag bg="#0D2240" color="white">최종 리포트</Tag>
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#111",
            marginBottom: 6,
          }}
        >
          {session.title}
        </h1>
        <p style={{ color: "#888", fontSize: 13, marginBottom: 32 }}>
          {session.date} · 멘토 박지훈 · {session.type} · {session.duration}
        </p>

        {/* ── BEST / WORST ──────────────────────────────────────── */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#888",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          AI가 뽑은 핵심 문항
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              background: "#1E3A5F",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#7DD3FC",
                  letterSpacing: 1,
                }}
              >
                ● BEST 문항
              </span>
              <span style={{ fontSize: 10, color: "#7DD3FC" }}>Q1</span>
            </div>
            <p
              style={{
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.6,
                marginBottom: 8,
              }}
            >
              "결과적으로 평균 응답 시간을 340ms까지 줄이는 데 성공했습니다."
            </p>
            <p style={{ color: "#93C5FD", fontSize: 12, lineHeight: 1.5 }}>
              수치 기반 결과 + 행동-결과 인과관계가 명확해 설득력 높음.
            </p>
          </div>
          <div
            style={{
              background: "#4A1515",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#FCA5A5",
                  letterSpacing: 1,
                }}
              >
                ● WORST 문항
              </span>
              <span style={{ fontSize: 10, color: "#FCA5A5" }}>Q3</span>
            </div>
            <p
              style={{
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.6,
                marginBottom: 8,
              }}
            >
              "REST를 쓰거나 아니면 메시지 큐를 쓰는 방법도 있고 또 gRPC라는..."
            </p>
            <p style={{ color: "#FCA5A5", fontSize: 12, lineHeight: 1.5 }}>
              만연체 + 이론 나열. 구체적 경험 또는 학습 의지로 전환 필요.
            </p>
          </div>
        </div>

        {/* ── 정량 지표 요약 ──────────────────────────────────────── */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#888",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          정량 평가 요약
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            {
              label: "BEST — 잘한 점",
              bg: "#F0FDF4",
              border: "#BBF7D0",
              textColor: "#166534",
              items: [
                ["말하기 속도", "118 WPM · 안정적", "#166534"],
                ["STAR 구조화", "4 / 4 구성", "#166534"],
                ["평균 반응 속도", "1.8초", "#166534"],
              ],
            },
            {
              label: "WORST — 개선 필요",
              bg: "#FFF5F5",
              border: "#FED7D7",
              textColor: "#9B1C1C",
              items: [
                ["Q3 말하기 속도", "187 WPM · 1.6배 빠름", "#E24B4A"],
                ["침묵 (Dead Air)", "3초↑ · 4회", "#E24B4A"],
                ["문장 간결성", "만연체 패턴 감지", "#E24B4A"],
              ],
            },
          ].map((section) => (
            <div
              key={section.label}
              style={{
                background: section.bg,
                border: `1px solid ${section.border}`,
                borderRadius: 12,
                padding: 18,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: section.textColor,
                  fontWeight: 700,
                  letterSpacing: 1,
                  marginBottom: 12,
                }}
              >
                {section.label}
              </p>
              {section.items.map(([k, v, c]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: `1px solid ${section.border}`,
                  }}
                >
                  <span style={{ fontSize: 13, color: "#333" }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Fit-Gap ────────────────────────────────────────────── */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#888",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          핏-갭 (Fit-Gap) 역량 분석
        </p>
        <div
          style={{
            background: "white",
            border: "1px solid #E0DDD8",
            borderRadius: 14,
            padding: 22,
            marginBottom: 28,
          }}
        >
          <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
            채용 공고 요구 역량 대비 자소서 & 답변 커버리지
          </p>
          {FIT_GAP.map(([l, p]) => (
            <FitGapBar key={l} label={l} pct={p} />
          ))}
          <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
            {[
              ["충분히 커버", GREEN],
              ["보완 필요", "#F59E0B"],
              ["갭 발생", "#E24B4A"],
            ].map(([l, c]) => (
              <div
                key={l}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#666",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: c,
                  }}
                />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* ── Q&A 스크립트 + 멘토 별점 ────────────────────────────── */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#888",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          전체 Q&A 스크립트
        </p>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {Object.entries(STAR_COLORS).map(([k, v]) => (
            <span
              key={k}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 99,
                background: v.bg,
                color: v.text,
                fontWeight: 700,
              }}
            >
              {k} {k === "S" ? "상황" : k === "T" ? "과제" : k === "A" ? "행동" : "결과"}
            </span>
          ))}
        </div>

        {session.qnas.map((qna) => {
          const fb = feedbacks[qna.id] || {};
          const isBad = qna.aiScore <= 2.5;
          const mentorScore_q = fb.score || qna.aiScore;

          return (
            <div
              key={qna.id}
              style={{
                background: "white",
                border: `1px solid ${isBad ? "#FED7D7" : "#E0DDD8"}`,
                borderRadius: 14,
                padding: 20,
                marginBottom: 14,
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: NAVY,
                  marginBottom: 12,
                }}
              >
                {qna.question}
              </p>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.8,
                  color: "#333",
                  marginBottom: 16,
                }}
              >
                {qna.transcript}
              </p>

              {/* 별점 행 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 12,
                  borderTop: "1px solid #FAF8F4",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* AI 별점 */}
                  <div>
                    <p
                      style={{
                        fontSize: 10,
                        color: "#aaa",
                        marginBottom: 3,
                      }}
                    >
                      AI 점수
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Stars score={qna.aiScore} color="#D1D5DB" />
                      <span
                        style={{
                          fontSize: 12,
                          color: "#aaa",
                          textDecoration: "line-through",
                        }}
                      >
                        {qna.aiScore.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* 화살표 */}
                  <span style={{ color: "#999", fontSize: 16 }}>→</span>

                  {/* 멘토 별점 */}
                  <div>
                    <p
                      style={{
                        fontSize: 10,
                        color: "#888",
                        marginBottom: 3,
                        fontWeight: 700,
                      }}
                    >
                      멘토 점수
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Stars score={mentorScore_q} color="#F59E0B" />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#333",
                        }}
                      >
                        {Number(mentorScore_q).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 오디오 재생 버튼 */}
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: GREEN,
                    border: `1px solid ${GREEN}`,
                    background: "transparent",
                    borderRadius: 99,
                    padding: "5px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ▶ 답변 듣기
                </button>
              </div>

              {/* 멘토 개별 코멘트 */}
              {fb.comment && (
                <div
                  style={{
                    marginTop: 12,
                    background: "#F0F9F4",
                    border: "1px solid #BBF7D0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    borderLeft: `3px solid ${GREEN}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#166534",
                      marginBottom: 4,
                    }}
                  >
                    멘토 코멘트
                  </p>
                  <p style={{ fontSize: 13, color: "#333", lineHeight: 1.7 }}>
                    {fb.comment}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* ── 멘토 총평 섹션 (최종 추가 영역) ─────────────────────── */}
        <div
          style={{
            marginTop: 28,
            background: "white",
            border: `2px solid ${GREEN}`,
            borderRadius: 16,
            padding: 24,
            opacity: showMentorComment ? 1 : 0,
            transform: showMentorComment ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
              paddingBottom: 14,
              borderBottom: `1px solid #E0DDD8`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: NAVY,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                박J
              </div>
              <div>
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: "#111",
                    marginBottom: 2,
                  }}
                >
                  박지훈 멘토 총평
                </p>
                <p style={{ fontSize: 12, color: "#888" }}>
                  네이버 · 백엔드 6년차 · 멘토링 세션 직후 작성
                </p>
              </div>
            </div>

            {/* 멘토 종합 평점 */}
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                멘토 종합 평점
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  justifyContent: "flex-end",
                }}
              >
                <Stars score={Number(mentorScore)} size={16} color="#F59E0B" />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#333",
                  }}
                >
                  {Number(mentorScore).toFixed(1)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#aaa",
                    textDecoration: "line-through",
                  }}
                >
                  AI {avgMentorScore}
                </span>
              </div>
            </div>
          </div>

          {/* 총평 본문 */}
          <div
            style={{
              background: "#F8FFFE",
              borderRadius: 10,
              padding: "16px 18px",
              borderLeft: `4px solid ${GREEN}`,
            }}
          >
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.9,
                color: "#333",
                whiteSpace: "pre-wrap",
              }}
            >
              {totalFeedback ||
                "멘토 총평이 작성되지 않았습니다."}
            </p>
          </div>

          {/* 자동 생성 태그 */}
          <div style={{ marginTop: 14 }}>
            {Number(mentorScore) >= 4 && (
              <Tag bg="#E1F5EE" color="#0F6E56">추천 멘티</Tag>
            )}
            {session.qnas.some(
              (q) => (feedbacks[q.id]?.score || q.aiScore) >= 4
            ) && <Tag bg="#E6F1FB" color="#185FA5">STAR 구조 우수</Tag>}
            {session.qnas.some(
              (q) => (feedbacks[q.id]?.score || q.aiScore) <= 2
            ) && <Tag bg="#FFF5F5" color="#9B1C1C">보완 필요 항목 있음</Tag>}
          </div>

          {/* 전송 안내 (멘티 뷰에서만) */}
          {role === "mentee" && (
            <div
              style={{
                marginTop: 16,
                background: "#FAF8F4",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#666",
              }}
            >
              이 리포트는 멘토가 최종 제출한 후 자동으로 전달된 최종 리포트입니다.
              마이페이지에서 언제든 다시 확인할 수 있습니다.
            </div>
          )}
        </div>

        {/* ── 하단 액션 ─────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => navigate("/mypage")}
            style={{
              padding: "11px 24px",
              borderRadius: 10,
              border: "1px solid #D1D5DB",
              background: "white",
              color: "#555",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            마이페이지로 이동
          </button>
          <button
            onClick={() => exportToPDF(reportData)}
            style={{
              padding: "11px 24px",
              borderRadius: 10,
              border: "none",
              background: NAVY,
              color: "white",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Word로 저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
