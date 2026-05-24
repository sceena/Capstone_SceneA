import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSessionReport } from "../../api/sessions";

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";

const steps = [
  "멘토가 세션 피드백을 작성 중입니다...",
  "Q&A 별점 및 코멘트 검토 중...",
  "최종 리포트 생성 중...",
  "곧 최종 리포트가 전달됩니다!",
];

export default function ReportWaitingPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => {
        if (prev < steps.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const poll = setInterval(async () => {
      try {
        const report = await getSessionReport(sessionId);
        if (report?.report_status === "final") {
          clearInterval(poll);
          navigate("/report/final", { state: { sessionId, role: "mentee" } });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [sessionId, navigate]);

  return (
    <div style={{
      minHeight: "100vh", background: BG,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      gap: 32,
    }}>
      <div style={{
        width: 72, height: 72, background: NAVY, borderRadius: 18,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <rect x="4" y="4" width="12" height="12" rx="2" fill="white" opacity="0.9" />
          <rect x="20" y="4" width="12" height="12" rx="2" fill="white" opacity="0.6" />
          <rect x="4" y="20" width="12" height="12" rx="2" fill="white" opacity="0.6" />
          <rect x="20" y="20" width="12" height="12" rx="2" fill={GREEN} />
        </svg>
      </div>

      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: "0 0 10px" }}>
          최종 리포트 준비 중
        </h2>
        <p style={{ fontSize: 14, color: "#666", margin: 0 }}>
          멘토가 피드백을 완료하면 리포트가 자동 전달됩니다
        </p>
      </div>

      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            opacity: i <= step ? 1 : 0.3,
            transition: "opacity 0.4s",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: i < step ? GREEN : i === step ? "#2563EB" : "#D1D5DB",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.4s",
            }}>
              {i < step && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5 4-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13, color: i <= step ? "#333" : "#aaa" }}>{s}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/dashboard/mentee")}
        style={{
          marginTop: 8, padding: "11px 28px", borderRadius: 10,
          border: `1px solid ${NAVY}`, background: "transparent",
          color: NAVY, fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        대시보드로 돌아가기
      </button>

      <p style={{ fontSize: 12, color: "#aaa" }}>세션 ID: {sessionId}</p>
    </div>
  );
}
