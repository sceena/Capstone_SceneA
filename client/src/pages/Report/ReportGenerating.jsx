import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { generateSessionReport, getSessionReport, getSessionSttStatus } from "../../api/sessions";
import { getAuthUser } from "../../store/authStore";

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";

const ANALYSIS_STEPS = [
  "답변 음성 STT 변환 확인 중...",
  "WPM · 침묵 구간 측정 중...",
  "STAR 구조화 지표 분류 중...",
  "Fit-Gap 역량 교차 분석 중...",
  "AI 인사이트 생성 중...",
];

/* ── 메인 페이지 ── */
export default function ReportGeneratingPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const location = useLocation();
  const [stepIdx, setStepIdx] = useState(0);
  const [statusSummary, setStatusSummary] = useState(null);
  const [phase, setPhase] = useState("waiting_stt");
  const [error, setError] = useState("");
  const generatingRef = useRef(false);
  const role = String(location.state?.role || getAuthUser()?.role || "mentee").toLowerCase();

  const goToReport = useCallback(() => {
    navigate(`/report/ai/${sessionId}`, { state: { role } });
  }, [navigate, role, sessionId]);

  // AI 분석 단계 사이클
  useEffect(() => {
    const id = setInterval(() => setStepIdx(prev => (prev + 1) % ANALYSIS_STEPS.length), 4000);
    return () => clearInterval(id);
  }, []);

  // STT 완료 대기 -> 리포트 생성 -> 완료 시 리포트 화면 이동
  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    const poll = async () => {
      if (generatingRef.current || cancelled) return;
      try {
        const existingReport = await getSessionReport(sessionId).catch(() => null);
        if (cancelled) return;
        if (existingReport?.ai_report) {
          goToReport();
          return;
        }

        const summary = await getSessionSttStatus(sessionId);
        if (cancelled) return;
        setStatusSummary(summary);
        setError("");

        if (!summary.total_count) {
          setPhase("waiting_answers");
          return;
        }

        if (!summary.ready) {
          setPhase("waiting_stt");
          return;
        }

        generatingRef.current = true;
        setPhase("generating_report");
        await generateSessionReport(sessionId);
        if (!cancelled) goToReport();
      } catch (err) {
        if (!cancelled) {
          setError("리포트 생성 준비 중 문제가 발생했습니다. 잠시 후 다시 확인합니다.");
          generatingRef.current = false;
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, goToReport]);

  const progressLabel = (() => {
    if (phase === "waiting_answers") return "저장된 답변을 확인하는 중";
    if (phase === "waiting_stt") return "답변 음성 변환 대기 중";
    if (phase === "generating_report") return "AI 리포트 생성 중";
    return "분석 중";
  })();

  const statusText = statusSummary
    ? `답변 ${statusSummary.completed_count}/${statusSummary.total_count}개 STT 완료`
    : "답변 상태 확인 중";

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* 헤더 */}
      <div style={{ background: NAVY, padding: "0 32px", height: 58, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, background: GREEN, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>리포트 생성 대기중</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>답변 음성 정리 후 자동으로 리포트를 생성합니다.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#E24B4A", animation: "pulse 1.2s ease-in-out infinite" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{progressLabel}</span>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 5%", width: "100%" }}>

        <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "white", borderRadius: 18, border: "1px solid #E8E0D0", padding: "28px 30px", boxShadow: "0 18px 50px rgba(13,34,64,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", border: "4px solid #E8E0D0", borderTopColor: GREEN, animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: "0 0 4px" }}>리포트 생성 대기중</p>
                <p style={{ fontSize: 13, color: "#6B6863", margin: 0 }}>{statusText}</p>
              </div>
            </div>

            <div style={{ background: "#F8F7F4", border: "1px solid #E8E0D0", borderRadius: 14, padding: "16px 18px", marginBottom: 18 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: GREEN, margin: "0 0 8px", letterSpacing: "0.04em" }}>{progressLabel}</p>
              <p style={{ fontSize: 13, color: "#555", lineHeight: 1.7, margin: 0 }}>
                STT가 끝나면 AI 리포트가 자동 생성되고, 완료 즉시 리포트 화면으로 이동합니다.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {ANALYSIS_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: i <= stepIdx ? 1 : 0.3, transition: "opacity 0.4s" }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: i < stepIdx ? GREEN : i === stepIdx ? "#2563EB" : "#D1D5DB",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.4s",
                  }}>
                    {i < stepIdx && (
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: i <= stepIdx ? "#333" : "#999" }}>{step}</span>
                </div>
              ))}
            </div>

            {statusSummary && (
              <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "#F8F7F4", border: "1px solid #E8E0D0" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: NAVY, margin: "0 0 6px" }}>STT 상태</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    ["완료", statusSummary.completed_count, GREEN],
                    ["진행", statusSummary.processing_count, "#2563EB"],
                    ["대기", statusSummary.pending_count, "#F59E0B"],
                    ["실패", statusSummary.failed_count, "#E24B4A"],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: "#777" }}>{label}</span>
                      <span style={{ color, fontWeight: 800 }}>{value}</span>
                    </div>
                  ))}
                </div>
                {(statusSummary.question_pending_count > 0 || statusSummary.question_processing_count > 0 || statusSummary.question_failed_count > 0) && (
                  <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, margin: "8px 0 0" }}>
                    질문 STT 대기 {statusSummary.question_pending_count} · 진행 {statusSummary.question_processing_count} · 실패 {statusSummary.question_failed_count}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p style={{ margin: "12px 0 0", fontSize: 11, color: "#E24B4A", lineHeight: 1.6 }}>{error}</p>
            )}
          </div>

          <button
            onClick={goToReport}
            style={{
              alignSelf: "center",
              padding: "11px 20px", borderRadius: 10,
              border: `1px solid ${NAVY}`, background: "transparent",
              color: NAVY, fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", transition: "background 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#E8E0D0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            건너뛰고 리포트 보기 →
          </button>
        </div>
      </div>
    </div>
  );
}
