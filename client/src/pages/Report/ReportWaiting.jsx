import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSessionReport } from "../../api/sessions";

const C = {
  primary:     "#0D2240",
  primaryGrad: "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
  success:     "#0CA678",
  successGrad: "linear-gradient(135deg, #0CA678 0%, #38D9A9 100%)",
  bg:          "#F0F4F8",
  white:       "#FFFFFF",
  border:      "#E9ECEF",
  text:        "#1A1B1E",
  textSub:     "#495057",
  textMuted:   "#868E96",
  shadow:      "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
};

const STEPS = [
  { icon: "✍️", label: "멘토가 세션 피드백을 작성 중입니다" },
  { icon: "⭐", label: "Q&A 별점 및 코멘트 검토 중" },
  { icon: "📄", label: "최종 리포트 생성 중" },
  { icon: "🎉", label: "곧 최종 리포트가 전달됩니다" },
];

export default function ReportWaitingPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => {
        if (prev < STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId || !/^\d+$/.test(sessionId)) return;
    const poll = setInterval(async () => {
      try {
        const report = await getSessionReport(sessionId);
        if (report?.report_status === "final") {
          clearInterval(poll);
          navigate(`/report/final/${sessionId}`, { state: { sessionId, role: "mentee" } });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [sessionId, navigate]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* 헤더 */}
      <header style={{
        background: C.white, padding: "0 5%",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.primaryGrad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(13,34,64,0.3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>
              Scene<span style={{ color: C.primary }}>A</span>
            </span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: "#FFF3BF", color: "#E67700" }}>
            최종 리포트 준비 중
          </span>
        </nav>
      </header>

      {/* 본문 */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 24px", animation: "fadeUp 0.4s ease" }}>

        {/* 아이콘 + 타이틀 */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 24px" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.primaryGrad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(13,34,64,0.25)" }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <rect x="4" y="4" width="12" height="12" rx="2" fill="white" opacity="0.9"/>
                <rect x="20" y="4" width="12" height="12" rx="2" fill="white" opacity="0.55"/>
                <rect x="4" y="20" width="12" height="12" rx="2" fill="white" opacity="0.55"/>
                <rect x="20" y="20" width="12" height="12" rx="2" fill="#38D9A9"/>
              </svg>
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: "50%", background: "#FFF3BF", border: `2px solid ${C.white}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
              ⏳
            </div>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 10, letterSpacing: "-0.02em" }}>
            최종 리포트 준비 중
          </h1>
          <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7 }}>
            멘토가 피드백을 완료하면 리포트가 자동으로 전달됩니다
          </p>
        </div>

        {/* 안내 배너 */}
        <div style={{ background: "#FFF3BF", border: "1px solid #FFE066", borderRadius: 12, padding: "12px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⏱</span>
          <p style={{ fontSize: 13, color: "#7C4E00", fontWeight: 600, lineHeight: 1.5 }}>
            멘토의 최종 코멘트는 세션 종료 후 <strong>60분 이내</strong>에 전달됩니다
          </p>
        </div>

        {/* 진행 스텝 카드 */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "28px 24px", marginBottom: 20, boxShadow: C.shadow }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>진행 현황</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, opacity: i <= step ? 1 : 0.35, transition: "opacity 0.5s" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: done ? C.successGrad : active ? C.primaryGrad : C.bg,
                      border: `2px solid ${done ? C.success : active ? C.primary : C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, transition: "all 0.4s",
                      animation: active ? "pulse 1.4s ease-in-out infinite" : "none",
                    }}>
                      {done
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <span>{s.icon}</span>
                      }
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ width: 2, height: 28, background: done ? C.success : C.border, transition: "background 0.5s", margin: "4px 0" }} />
                    )}
                  </div>
                  <div style={{ paddingTop: 8, paddingBottom: i < STEPS.length - 1 ? 0 : 0 }}>
                    <p style={{ fontSize: 14, fontWeight: active ? 700 : 500, color: done ? C.success : active ? C.text : C.textMuted, transition: "all 0.4s" }}>
                      {s.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 세션 ID */}
        {sessionId && (
          <p style={{ textAlign: "center", fontSize: 12, color: C.textMuted, marginBottom: 20 }}>
            세션 ID · {sessionId}
          </p>
        )}

        {/* 버튼 */}
        <button
          onClick={() => navigate("/dashboard/mentee")}
          style={{
            width: "100%", padding: "14px", borderRadius: 12,
            border: `1.5px solid ${C.border}`, background: C.white,
            color: C.textSub, fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            transition: "border-color 0.18s, color 0.18s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
        >
          대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
