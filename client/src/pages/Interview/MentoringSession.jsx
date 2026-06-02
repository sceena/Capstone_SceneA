import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import useAuthStore from "../../store/authStore";
import { getAuthUser } from "../../store/authStore";
import { getSession, getSessionReport, updateSessionStatus } from "../../api/sessions";
import {
  getStreamVideoDeviceId,
  openInterviewStream,
} from "../../utils/mediaDevices";

const MEDIA_SERVER = import.meta.env.VITE_MEDIA_SERVER_URL || "http://localhost:4000";
const MEDIA_SERVER_PATH = import.meta.env.VITE_MEDIA_SERVER_PATH || '/socket.io';

const NAVY  = "#0D2240";
const GREEN = "#1D9E75";
const BG    = "#F0F4F8";

function parseFitGapItem(item) {
  const [requirementPart, detailPart] = item.split(" / ");
  const requirement = requirementPart?.replace(/^요구사항:\s*/, "") || item;
  const detail = detailPart?.replace(/^근거\(([^)]+)\):\s*/, "$1 · ")?.replace(/^부족 근거:\s*/, "") || "";
  return { requirement, detail };
}

function toFivePointScore(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(1, Math.min(5, numeric > 5 ? numeric / 2 : numeric));
}

// ─── 아바타 ─────────────────────────────────────────────────────
function Avatar({ name, size = 36, bg = NAVY, fontSize = 12 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ─── 비디오 타일 ─────────────────────────────────────────────────
function VideoTile({ stream, label, mirror = false, muted = false, isSpeaking = false, camOff = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = muted;
    video.play().catch(() => {});
  }, [stream, muted]);
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#0A0A0A", overflow: "hidden", border: `2px solid ${isSpeaking ? GREEN : "transparent"}`, transition: "border-color 0.3s" }}>
      <video ref={ref} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none", display: camOff ? "none" : "block" }} />
      {camOff && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Avatar name={label || "?"} size={48} bg="#1E3A5F" fontSize={16} />
        </div>
      )}
      {label && (
        <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.65)", borderRadius: 5, padding: "2px 8px" }}>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>{label}</span>
        </div>
      )}
      {isSpeaking && (
        <div style={{ position: "absolute", top: 6, right: 6, display: "flex", alignItems: "flex-end", gap: 2 }}>
          {[3, 6, 4, 8, 4].map((h, i) => (
            <div key={i} style={{ width: 2, background: GREEN, borderRadius: 2, height: h, animation: `speakPulse 0.5s ease-in-out ${i * 0.08}s infinite` }} />
          ))}
        </div>
      )}
    </div>
  );
}

const D = {
  bg:     "#F4F7FA",
  card:   "#ffffff",
  card2:  "#F8FAFC",
  border: "rgba(0,0,0,0.07)",
  text:   "#1a1b1e",
  muted:  "#6B7280",
  dim:    "#9CA3AF",
  shadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06)",
};

// ─── 공유 리포트 뷰 ──────────────────────────────────────────────
function SharedReport({ report, isMentor = false, mentorComments = {}, onCommentChange, onPublish, isPublished = false }) {
  if (!report?.ai_report) {
    return (
      <div style={{ background: D.bg, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(13,34,64,0.06)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1.2s linear infinite" }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <p style={{ color: D.muted, fontSize: 14 }}>AI 리포트 로딩 중...</p>
        </div>
      </div>
    );
  }

  const aiReport = report.ai_report;
  const questionReports = aiReport?.question_reports || [];
  const topSummary = aiReport?.top_summary;
  const best = topSummary?.best_question;
  const worst = topSummary?.worst_question;
  const bestReport  = questionReports.find(item => item.question_id === best?.question_id);
  const worstReport = questionReports.find(item => item.question_id === worst?.question_id);
  const fitGap = aiReport?.fit_gap;
  const overallScore = toFivePointScore(aiReport?.overall_score ?? report?.total_score ?? 0);
  const scoreColor = overallScore >= 4 ? GREEN : overallScore >= 3 ? "#F59E0B" : "#C0392B";

  const commentedCount = questionReports.filter(qr => (mentorComments[qr.question_id] || "").trim().length > 0).length;
  const allCommented  = questionReports.length > 0 && commentedCount === questionReports.length;

  return (
    <div style={{ background: D.bg, minHeight: "100%", padding: "22px 20px", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── META ── */}
        <div style={{ background: D.card, borderRadius: 16, padding: "20px 24px", boxShadow: D.shadow }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["1차 AI 리포트", "분석 완료"].map((t, i) => (
              <span key={i} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: `1px solid ${i === 0 ? "rgba(29,158,117,0.35)" : "rgba(0,0,0,0.1)"}`, color: i === 0 ? GREEN : D.muted, fontWeight: 600 }}>{t}</span>
            ))}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: D.text, margin: "0 0 4px", letterSpacing: "-0.02em" }}>AI 면접 분석 리포트</h2>
          <p style={{ color: D.muted, fontSize: 12, margin: "0 0 14px" }}>세션 #{report?.session_id} · 종합 점수 <strong style={{ color: D.text }}>{overallScore} / 5</strong></p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: D.text }}>AI 종합 점수</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor }}>{overallScore}<span style={{ fontSize: 12, color: D.dim, fontWeight: 400 }}> / 5</span></span>
          </div>
          <div style={{ background: "#E9ECEF", borderRadius: 99, height: 7 }}>
            <div style={{ width: `${Math.min(overallScore * 20, 100)}%`, height: 7, borderRadius: 99, background: scoreColor, transition: "width 1s ease" }} />
          </div>
        </div>

        {/* ── KEY QUESTIONS ── */}
        <div style={{ background: D.card, borderRadius: 16, padding: "18px 22px", boxShadow: D.shadow }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: D.dim, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>KEY QUESTIONS</p>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: D.text, margin: "0 0 14px" }}>AI가 뽑은 핵심 문항</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[{ type: "best", question: best, qreport: bestReport }, { type: "worst", question: worst, qreport: worstReport }].map(({ type, question, qreport }) => {
              const isBest = type === "best";
              const accent = isBest ? GREEN : "#E53E3E";
              const accentBg = isBest ? "#F0FDF4" : "#FFF5F5";
              const accentBorder = isBest ? "rgba(29,158,117,0.2)" : "rgba(229,62,62,0.2)";
              return (
                <div key={type} style={{ background: D.card2, border: `1px solid ${accentBorder}`, borderTop: `3px solid ${accent}`, borderRadius: 12, padding: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 6px" }}>{isBest ? "BEST 문항" : "WORST 문항"}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: D.text, lineHeight: 1.5, margin: "0 0 8px" }}>{question?.question || "정보 없음"}</p>
                  {qreport?.answer && (
                    <p style={{ fontSize: 11, color: D.muted, lineHeight: 1.7, background: D.bg, borderRadius: 8, padding: "8px 10px", margin: "0 0 8px" }}>
                      {qreport.answer.length > 90 ? qreport.answer.slice(0, 90) + "…" : qreport.answer}
                    </p>
                  )}
                  {question?.reason && (
                    <div style={{ background: accentBg, borderRadius: 8, padding: "8px 10px" }}>
                      <p style={{ fontSize: 11, color: D.text, lineHeight: 1.6, margin: 0 }}>{question.reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── FIT-GAP ── */}
        <div style={{ background: D.card, borderRadius: 16, padding: "18px 22px", boxShadow: D.shadow }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: D.dim, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>FIT-GAP</p>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: D.text, margin: "0 0 14px" }}>채용 요구사항 대비 역량 분석</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[
              { title: "충족한 요구사항", items: fitGap?.matched_requirements || [], tone: "matched" },
              { title: "부족한 요구사항", items: fitGap?.missing_requirements || [], tone: "missing" },
            ].map(({ title, items, tone }) => {
              const isMatched = tone === "matched";
              const accent = isMatched ? GREEN : "#E53E3E";
              const bg = isMatched ? "#F0FDF4" : "#FFF5F5";
              const border = isMatched ? "rgba(29,158,117,0.2)" : "rgba(229,62,62,0.2)";
              return (
                <div key={tone} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: D.text, margin: 0 }}>{title}</p>
                    <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: "#fff", borderRadius: 99, padding: "2px 8px", border: `1px solid ${border}` }}>{items.length}개</span>
                  </div>
                  {items.map((item, idx) => {
                    const parsed = parseFitGapItem(item);
                    return (
                      <div key={idx} style={{ background: "#fff", borderRadius: 8, padding: "7px 10px", marginBottom: idx < items.length - 1 ? 6 : 0, display: "flex", gap: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent, flexShrink: 0, marginTop: 6 }} />
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 600, color: D.text, margin: parsed.detail ? "0 0 3px" : 0 }}>{parsed.requirement}</p>
                          {parsed.detail && <p style={{ fontSize: 10, color: D.muted, lineHeight: 1.5, margin: 0 }}>{parsed.detail}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {(fitGap?.recommendations || []).length > 0 && (
            <div style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: D.text, margin: "0 0 10px" }}>추천 보완 방향</p>
              {fitGap.recommendations.map((item, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: idx < fitGap.recommendations.length - 1 ? 8 : 0 }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "linear-gradient(135deg,#0D2240,#1B4F7A)", color: "white", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{idx + 1}</span>
                  <p style={{ fontSize: 12, color: D.muted, lineHeight: 1.7, margin: 0 }}>{item}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── QUESTION REPORTS ── */}
        <div style={{ background: D.card, borderRadius: 16, padding: "18px 22px", boxShadow: D.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: D.dim, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>QUESTION REPORTS</p>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: D.text, margin: 0 }}>전체 Q&A 답변 분석</h3>
            </div>
            {isMentor && questionReports.length > 0 && (
              <span style={{ fontSize: 11, color: allCommented ? GREEN : D.muted, fontWeight: 700, background: allCommented ? "#F0FDF4" : D.card2, padding: "4px 12px", borderRadius: 99, border: `1px solid ${allCommented ? "rgba(29,158,117,0.3)" : D.border}` }}>
                코멘트 {commentedCount}/{questionReports.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {questionReports.map((qr, i) => {
              const isBad = qr.question_id === worst?.question_id;
              const score = toFivePointScore(qr.score);
              const scColor = score >= 4 ? GREEN : score >= 3 ? "#F59E0B" : "#E53E3E";
              const hasComment = (mentorComments[qr.question_id] || "").trim().length > 0;
              return (
                <div key={qr.question_id ?? i} style={{ background: D.card2, border: `1px solid ${D.border}`, borderLeft: `3px solid ${isBad ? "#E53E3E" : GREEN}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: D.text, lineHeight: 1.55, margin: "0 0 4px" }}>Q{i + 1} · {qr.question}</p>
                      {isBad && <span style={{ fontSize: 10, color: "#E53E3E", background: "#FFF5F5", padding: "2px 8px", borderRadius: 99, fontWeight: 700, border: "1px solid rgba(229,62,62,0.2)" }}>보완 필요</span>}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 1 }}>
                        {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: 13, color: n <= Math.round(score) ? "#F59E0B" : "#E5E7EB" }}>★</span>)}
                      </span>
                      <p style={{ fontSize: 11, color: scColor, fontWeight: 700, margin: "2px 0 0" }}>AI {score}</p>
                    </div>
                  </div>
                  <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", marginBottom: 10, border: `1px solid ${D.border}` }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: D.dim, letterSpacing: "0.08em", margin: "0 0 5px", textTransform: "uppercase" }}>답변</p>
                    <p style={{ fontSize: 12, color: "#495057", lineHeight: 1.8, margin: 0 }}>{qr.answer || "답변 내용 없음"}</p>
                  </div>
                  {qr.reasoning && (
                    <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "10px 12px", marginBottom: 10, borderLeft: "2px solid #3B82F6" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#3B82F6", letterSpacing: "0.08em", margin: "0 0 4px", textTransform: "uppercase" }}>평가 근거</p>
                      <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.75, margin: 0 }}>{qr.reasoning}</p>
                    </div>
                  )}
                  {(qr.strengths?.length > 0 || qr.improvements?.length > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      {qr.strengths?.length > 0 && (
                        <div style={{ background: "#F0FDF4", borderRadius: 8, padding: 10, border: "1px solid rgba(29,158,117,0.15)" }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: GREEN, margin: "0 0 5px" }}>강점</p>
                          {qr.strengths.map((s, j) => <p key={j} style={{ fontSize: 11, color: "#374151", lineHeight: 1.6, margin: "0 0 3px" }}>· {s}</p>)}
                        </div>
                      )}
                      {qr.improvements?.length > 0 && (
                        <div style={{ background: "#FFF5F5", borderRadius: 8, padding: 10, border: "1px solid rgba(229,62,62,0.15)" }}>
                          <p style={{ fontSize: 10, fontWeight: 700, color: "#E53E3E", margin: "0 0 5px" }}>개선점</p>
                          {qr.improvements.map((s, j) => <p key={j} style={{ fontSize: 11, color: "#374151", lineHeight: 1.6, margin: "0 0 3px" }}>· {s}</p>)}
                        </div>
                      )}
                    </div>
                  )}
                  {isMentor && (
                    <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: hasComment ? GREEN : D.dim, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        멘토 코멘트 {hasComment ? "✓" : ""}
                      </p>
                      <textarea
                        value={mentorComments[qr.question_id] || ""}
                        onChange={e => onCommentChange(qr.question_id, e.target.value)}
                        placeholder="이 답변에 대한 코멘트를 입력해주세요..."
                        style={{
                          width: "100%", minHeight: 68, borderRadius: 8,
                          border: `1px solid ${hasComment ? "rgba(29,158,117,0.4)" : "#D1D5DB"}`,
                          background: hasComment ? "#F0FDF4" : "#fff",
                          padding: "9px 12px", fontSize: 12, color: D.text,
                          fontFamily: "inherit", lineHeight: 1.6, resize: "vertical",
                          outline: "none", transition: "border-color 0.15s, background 0.15s",
                          boxSizing: "border-box",
                        }}
                        onFocus={e => { e.target.style.borderColor = GREEN; }}
                        onBlur={e => { e.target.style.borderColor = hasComment ? "rgba(29,158,117,0.4)" : "#D1D5DB"; }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 최종 리포트 발행 ── */}
        {isMentor && (
          <div style={{
            background: isPublished ? "linear-gradient(135deg,#0CA678,#38D9A9)" : "linear-gradient(135deg,#0D2240,#1B4F7A)",
            borderRadius: 16, padding: "22px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            boxShadow: "0 4px 20px rgba(13,34,64,0.15)",
          }}>
            <div>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, margin: "0 0 4px" }}>
                {isPublished ? "발행 완료" : allCommented ? "모든 문항 코멘트 완료 — 발행 준비됨" : `${commentedCount}/${questionReports.length}개 코멘트 작성됨`}
              </p>
              <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
                {isPublished ? "최종 리포트가 멘티에게 전달됩니다" : "코멘트 작성 후 최종 리포트를 발행하세요"}
              </p>
            </div>
            <button onClick={onPublish} disabled={isPublished} style={{
              flexShrink: 0, padding: "12px 24px", borderRadius: 10, border: "none",
              background: isPublished ? "rgba(255,255,255,0.2)" : allCommented ? "linear-gradient(135deg,#0CA678,#38D9A9)" : "rgba(255,255,255,0.15)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: isPublished ? "default" : "pointer",
              fontFamily: "inherit", boxShadow: allCommented && !isPublished ? "0 4px 12px rgba(12,166,120,0.4)" : "none",
              transition: "all 0.2s", whiteSpace: "nowrap",
            }}>
              {isPublished ? "✓ 발행 완료" : "최종 리포트 발행 →"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────
export default function MentoringSessionPage() {
  const navigate   = useNavigate();
  const { sessionId } = useParams();
  const { user }   = useAuthStore();

  const [session, setSession]   = useState({ mentor: { name: "" }, title: "", date: "", time: "" });
  const [reportData, setReportData] = useState(null);
  const [elapsed, setElapsed]   = useState(0);
  const [isMicOn, setIsMicOn]   = useState(true);
  const [isCamOn, setIsCamOn]   = useState(true);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const [menteeList, setMenteeList]         = useState([]);
  const [currentMenteeIdx, setCurrentMenteeIdx] = useState(0);

  /* 멘토 코멘트 & 발행 상태 */
  const [mentorComments, setMentorComments] = useState({});
  const [isPublished, setIsPublished]       = useState(false);

  const timerRef = useRef(null);

  /* ── WebRTC refs ── */
  const localStreamRef      = useRef(null);
  const socketRef           = useRef(null);
  const deviceRef           = useRef(null);
  const sendTransportRef    = useRef(null);
  const recvTransportRef    = useRef(null);
  const videoProducerRef    = useRef(null);
  const audioProducerRef    = useRef(null);
  const consumersRef        = useRef(new Map());
  const audioCtxRef         = useRef(null);
  const localAnalyserRef    = useRef(null);
  const peerAnalysersRef    = useRef({});
  const peersRef            = useRef({});
  const pendingProducersRef = useRef([]);
  const recvTransportReadyRef = useRef(false);

  const [peerIds, setPeerIds]               = useState([]);
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [audioLevels, setAudioLevels]       = useState({});
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  /* ── 드로잉 ── */
  const [drawMode, setDrawMode]   = useState(false);
  const [drawTool, setDrawTool]   = useState("pen");
  const [drawColor, setDrawColor] = useState("#FFD700");
  const canvasRef          = useRef(null);
  const scrollContainerRef = useRef(null);
  const isDrawingRef       = useRef(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };
  const startDraw = (e) => {
    if (!drawMode) return;
    e.preventDefault();
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    if (drawTool === "eraser") { ctx.globalCompositeOperation = "destination-out"; }
    else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = drawColor; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; }
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };
  const draw = (e) => {
    if (!drawMode || !isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    if (drawTool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
  };
  const stopDraw  = () => { isDrawingRef.current = false; };
  const clearCanvas = () => { const c = canvasRef.current; if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height); };
  const initCanvas = useCallback((node) => {
    if (!node) return;
    canvasRef.current = node;
    const parent = node.parentElement;
    node.width  = parent.clientWidth;
    node.height = parent.clientHeight;
  }, []);

  /* ── 세션 & 리포트 로드 ── */
  useEffect(() => {
    getSession(sessionId)
      .then(data => {
        const sessionMentees = (data.participants || []).filter(p => p.role !== 'mentor');
        if (sessionMentees.length > 0) setMenteeList(sessionMentees.map(m => ({ ...m, report: null })));
        setSession(prev => ({ ...prev, ...data, mentor: data.mentor || prev.mentor }));
      })
      .catch(() => {});
    getSessionReport(sessionId)
      .then(data => {
        if (data?.ai_report) setReportData(data);
        if (data) {
          setSession(prev => ({ ...prev, report: data }));
          setMenteeList(prev => prev.map((m, i) => i === 0 ? { ...m, report: { ...data, menteeName: m.name } } : m));
        }
      })
      .catch(() => {});
  }, [sessionId]);

  /* ── 멘티 네비게이션 ── */
  const handleMenteeNav = useCallback((newIdx) => {
    const clamped = Math.max(0, Math.min(newIdx, menteeList.length - 1));
    setCurrentMenteeIdx(clamped);
    socketRef.current?.emit("reportSync", { index: clamped });
  }, [menteeList.length]);

  /* ── 코멘트 핸들러 ── */
  const handleCommentChange = useCallback((questionId, value) => {
    setMentorComments(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const handlePublish = useCallback(async () => {
    setIsPublished(true);
  }, []);

  /* ── 미디어 소비 ── */
  const consumeProducer = useCallback((producerId, peerId, kind) => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!socket || !device || !recvTransport) { resolve(); return; }
      socket.emit("consume", { producerId, rtpCapabilities: device.rtpCapabilities }, async (res) => {
        if (res.error) { resolve(); return; }
        try {
          const consumer = await recvTransport.consume({ id: res.id, producerId: res.producerId, kind: res.kind, rtpParameters: res.rtpParameters });
          consumersRef.current.set(consumer.id, consumer);
          if (!peersRef.current[peerId]) peersRef.current[peerId] = new MediaStream();
          peersRef.current[peerId].addTrack(consumer.track);
          setPeerIds(prev => prev.includes(peerId) ? [...prev] : [...prev, peerId]);
          if (consumer.track.kind === 'audio') {
            try {
              if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
              const analyser = audioCtxRef.current.createAnalyser();
              analyser.fftSize = 256;
              audioCtxRef.current.createMediaStreamSource(peersRef.current[peerId]).connect(analyser);
              peerAnalysersRef.current[peerId] = analyser;
            } catch {}
          }
          socket.emit("resumeConsumer", { consumerId: consumer.id }, () => {});
        } catch {}
        resolve();
      });
    });
  }, []);

  /* ── WebRTC 초기화 ── */
  useEffect(() => {
    const user = getAuthUser();
    const token = user?.accessToken;
    if (!token) return;
    let isCancelled = false;
    let socket;

    const init = async () => {
      const preferredCameraId = localStorage.getItem('preferredCameraId');
      const media = await openInterviewStream(preferredCameraId);
      const localStream = media.stream;
      const actualDeviceId = getStreamVideoDeviceId(localStream);
      if (actualDeviceId) localStorage.setItem('preferredCameraId', actualDeviceId);
      else if (preferredCameraId) localStorage.removeItem('preferredCameraId');
      if (isCancelled) { localStream.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = localStream;
      setLocalMediaStream(localStream);
      try {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
        const analyser = audioCtxRef.current.createAnalyser();
        analyser.fftSize = 256;
        audioCtxRef.current.createMediaStreamSource(localStream).connect(analyser);
        localAnalyserRef.current = analyser;
      } catch {}

      recvTransportReadyRef.current = false;
      pendingProducersRef.current   = [];

      socket = io(MEDIA_SERVER, { path: MEDIA_SERVER_PATH, withCredentials: true });
      socketRef.current = socket;

      socket.emit("join", { sessionId, token }, async (res) => {
        if (isCancelled || res.error) return;
        const { rtpCapabilities, existingProducers } = res;
        const device = new Device();
        try { await device.load({ routerRtpCapabilities: rtpCapabilities }); } catch { return; }
        if (isCancelled) return;
        deviceRef.current = device;

        socket.emit("createTransport", { direction: "send" }, async (sendRes) => {
          if (isCancelled || sendRes.error) return;
          const sendTransport = device.createSendTransport(sendRes);
          sendTransportRef.current = sendTransport;
          sendTransport.on("connect", ({ dtlsParameters }, cb, errback) => {
            socket.emit("connectTransport", { transportId: sendTransport.id, dtlsParameters }, r => r.error ? errback(new Error(r.error)) : cb());
          });
          sendTransport.on("produce", ({ kind, rtpParameters }, cb, errback) => {
            socket.emit("produce", { transportId: sendTransport.id, kind, rtpParameters }, r => r.error ? errback(new Error(r.error)) : cb({ id: r.producerId }));
          });
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) try { videoProducerRef.current = await sendTransport.produce({ track: videoTrack }); } catch {}
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) try { audioProducerRef.current = await sendTransport.produce({ track: audioTrack }); } catch {}
        });

        socket.emit("createTransport", { direction: "recv" }, async (recvRes) => {
          if (isCancelled || recvRes.error) return;
          const recvTransport = device.createRecvTransport(recvRes);
          recvTransportRef.current = recvTransport;
          recvTransport.on("connect", ({ dtlsParameters }, cb, errback) => {
            socket.emit("connectTransport", { transportId: recvTransport.id, dtlsParameters }, r => r.error ? errback(new Error(r.error)) : cb());
          });
          for (const { producerId, peerId, kind } of existingProducers) {
            if (isCancelled) return;
            await consumeProducer(producerId, peerId, kind);
          }
          recvTransportReadyRef.current = true;
          for (const pending of pendingProducersRef.current) {
            if (isCancelled) break;
            await consumeProducer(pending.producerId, pending.peerId, pending.kind);
          }
          pendingProducersRef.current = [];
        });
      });

      socket.on("newProducer", ({ producerId, peerId, kind }) => {
        if (isCancelled) return;
        if (!recvTransportReadyRef.current) pendingProducersRef.current.push({ producerId, peerId, kind });
        else consumeProducer(producerId, peerId, kind);
      });
      socket.on("peerLeft", ({ peerId }) => {
        delete peersRef.current[peerId];
        delete peerAnalysersRef.current[peerId];
        setPeerIds(prev => prev.filter(p => p !== peerId));
      });
      socket.on("reportSync", ({ index }) => { if (!isCancelled) setCurrentMenteeIdx(index); });
    };

    init();
    return () => {
      isCancelled = true;
      recvTransportReadyRef.current = false;
      pendingProducersRef.current   = [];
      videoProducerRef.current?.close();
      audioProducerRef.current?.close();
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      consumersRef.current.forEach(c => c.close());
      consumersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localAnalyserRef.current = null;
      Object.keys(peerAnalysersRef.current).forEach(k => delete peerAnalysersRef.current[k]);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      socket?.disconnect();
    };
  }, [sessionId, consumeProducer]);

  /* ── 오디오 레벨 ── */
  useEffect(() => {
    const THRESHOLD = 0.025;
    const getLevel = (an) => { const d = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(d); return d.reduce((a, b) => a + b, 0) / d.length / 255; };
    const interval = setInterval(() => {
      const levels = {};
      if (localAnalyserRef.current) levels['__local'] = getLevel(localAnalyserRef.current);
      Object.entries(peerAnalysersRef.current).forEach(([pid, an]) => { levels[pid] = getLevel(an); });
      setAudioLevels(levels);
      let maxLv = THRESHOLD, speaker = null;
      Object.entries(levels).forEach(([id, lv]) => { if (lv > maxLv) { maxLv = lv; speaker = id; } });
      setActiveSpeakerId(speaker);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  /* ── 타이머 ── */
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };

  const handleMicToggle = () => {
    const next = !isMicOn;
    setIsMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    if (next) audioProducerRef.current?.resume();
    else audioProducerRef.current?.pause();
  };
  const handleCamToggle = () => {
    const next = !isCamOn;
    setIsCamOn(next);
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
    if (next) videoProducerRef.current?.resume();
    else videoProducerRef.current?.pause();
  };

  const handleEndSession = useCallback(async () => {
    clearInterval(timerRef.current);
    const sid = session.sessionId || sessionId;
    try { await updateSessionStatus(sid, "completed"); } catch {}
    if (user?.role === "mentor") {
      navigate(`/mentor/feedback/${sid}`);
    } else {
      navigate(`/report/mentor-review/${sid}`, {
        state: {
          mentorName: session.mentor?.name || "멘토",
          nextPath: `/report/ai-stream/${sid}`,
        },
      });
    }
  }, [navigate, session.sessionId, session.mentor?.name, sessionId, user?.role]);

  const isMentor      = user?.role === "mentor";
  const currentMentee = menteeList[currentMenteeIdx] || null;

  const getPeerName = (peerId) => {
    const found = menteeList.find(m => String(m.id) === String(peerId));
    return found ? found.name : null;
  };

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;800&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      html,body{height:100%;overflow:hidden;margin:0}
      #root{height:100%;overflow:hidden;min-height:0;width:100%;max-width:100%;margin:0;display:block;text-align:left}
      body{font-family:'Noto Sans KR',sans-serif;background:#FAF8F4;color:#1A1818}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
      @keyframes speakPulse{0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}
      ::-webkit-scrollbar{width:4px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px}
    `}</style>
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Noto Sans KR', sans-serif", overflow: "hidden" }}>

      {/* ── 헤더 ── */}
      <header style={{ background: "#fff", borderBottom: "1px solid #E8E0D0", padding: "0 28px", height: 64, display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, background: NAVY, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="14" viewBox="0 0 22 16" fill="white"><rect x="0" y="2" width="14" height="12" rx="2"/><path d="M15 5.5l7-3.5v12l-7-3.5V5.5z"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111", margin: 0 }}>{session.title || "멘토링 세션"}</p>
          <p style={{ fontSize: 11, color: "#888", margin: 0 }}>{session.date} {session.time && `| ${session.time} KST`}</p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Avatar name={session.mentor?.name || "멘토"} size={30} bg={NAVY} fontSize={10} />
          {menteeList.map((m, i) => <Avatar key={m.id} name={m.name} size={30} bg={i === currentMenteeIdx ? GREEN : "#3A6A5A"} fontSize={10} />)}
        </div>
        {isPublished && (
          <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: "rgba(12,166,120,0.1)", border: "1px solid rgba(12,166,120,0.3)", borderRadius: 99, padding: "4px 12px" }}>
            ✓ 리포트 발행 완료
          </span>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111", borderRadius: 8, padding: "6px 14px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#E24B4A", animation: "blink 1.2s ease-in-out infinite" }} />
          <span style={{ color: "white", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatTime(elapsed)}</span>
        </div>
      </header>

      {/* ── 본문 ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* 좌측: 리포트 + 드로잉 레이어 */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* 멘티 전환 네비게이터 */}
          <div style={{ background: "#fff", borderBottom: "1px solid #E8E0D0", padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 16 }}>
            <button onClick={() => handleMenteeNav(currentMenteeIdx - 1)} disabled={currentMenteeIdx === 0 || !isMentor}
              style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #D1D5DB", background: currentMenteeIdx === 0 || !isMentor ? "#F3F4F6" : "#fff", color: currentMenteeIdx === 0 || !isMentor ? "#9CA3AF" : NAVY, fontSize: 13, fontWeight: 700, cursor: currentMenteeIdx === 0 || !isMentor ? "default" : "pointer", fontFamily: "inherit" }}>
              ← 이전
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {menteeList.map((m, i) => (
                <button key={m.id} onClick={() => isMentor && handleMenteeNav(i)} style={{ width: 30, height: 30, borderRadius: "50%", border: `2px solid ${i === currentMenteeIdx ? NAVY : "#D1D5DB"}`, background: i === currentMenteeIdx ? NAVY : "#fff", color: i === currentMenteeIdx ? "#fff" : "#555", fontSize: 12, fontWeight: 700, cursor: isMentor ? "pointer" : "default", fontFamily: "inherit", transition: "all 0.15s" }}>{i + 1}</button>
              ))}
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111", marginLeft: 4 }}>{currentMentee?.name} 멘티</span>
              {!isMentor && <span style={{ fontSize: 11, color: GREEN, fontWeight: 600 }}>· 멘토가 화면을 제어합니다</span>}
            </div>
            <button onClick={() => handleMenteeNav(currentMenteeIdx + 1)} disabled={currentMenteeIdx >= menteeList.length - 1 || !isMentor}
              style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #D1D5DB", background: currentMenteeIdx >= menteeList.length - 1 || !isMentor ? "#F3F4F6" : "#fff", color: currentMenteeIdx >= menteeList.length - 1 || !isMentor ? "#9CA3AF" : NAVY, fontSize: 13, fontWeight: 700, cursor: currentMenteeIdx >= menteeList.length - 1 || !isMentor ? "default" : "pointer", fontFamily: "inherit" }}>
              다음 →
            </button>
          </div>

          {/* 리포트 스크롤 영역 */}
          <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto" }}>
            <SharedReport
              report={reportData}
              isMentor={isMentor}
              mentorComments={mentorComments}
              onCommentChange={handleCommentChange}
              onPublish={handlePublish}
              isPublished={isPublished}
            />
          </div>

          {/* 캔버스 오버레이 */}
          <canvas
            ref={initCanvas}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: drawMode ? "auto" : "none", cursor: drawMode ? (drawTool === "eraser" ? "cell" : "crosshair") : "default", touchAction: "none" }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />

          {/* 드로잉 툴바 */}
          {drawMode && (
            <div style={{ position: "absolute", top: 60, left: 14, background: "#fff", borderRadius: 14, padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.18)", zIndex: 10, border: "1px solid #E8E0D0" }}>
              {[["#111111","검정"],["#E24B4A","빨강"],["#2563EB","파랑"],["#1D9E75","초록"],["#F59E0B","주황"]].map(([c, name]) => (
                <button key={c} title={name} onClick={() => { setDrawColor(c); setDrawTool("pen"); }} style={{ width: 22, height: 22, borderRadius: "50%", border: drawColor === c && drawTool === "pen" ? "3px solid #0D2240" : "2px solid #ddd", background: c, cursor: "pointer", padding: 0 }} />
              ))}
              <div style={{ width: 1, height: 20, background: "#E0DDD8" }} />
              <button title="펜" onClick={() => setDrawTool("pen")} style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: drawTool === "pen" ? NAVY : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={drawTool === "pen" ? "#fff" : "#555"} strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button title="지우개" onClick={() => setDrawTool("eraser")} style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: drawTool === "eraser" ? NAVY : "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={drawTool === "eraser" ? "#fff" : "#555"} strokeWidth="2" strokeLinecap="round"><path d="M20 20H7L3 16l10-10 7 7-1.5 1.5"/><path d="M6 14l4 4"/></svg>
              </button>
              <button title="전체 지우기" onClick={clearCanvas} style={{ width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* 우측: 비디오 + 프로필 패널 */}
        <div style={{ width: 300, background: "#111", display: "flex", flexDirection: "column", flexShrink: 0, borderLeft: "1px solid #222", overflowY: "auto" }}>

          {/* 비디오 */}
          <div style={{ overflowY: "auto", flexShrink: 0, maxHeight: "45vh" }}>
            <div style={{ height: 155, flexShrink: 0, display: "flex" }}>
              <VideoTile stream={localMediaStream} label={`나 (${isMentor ? "멘토" : "멘티"})`} mirror muted isSpeaking={(audioLevels["__local"] || 0) > 0.025} camOff={!isCamOn} />
            </div>
            {peerIds.map((pid, i) => (
              <div key={pid} style={{ height: 155, flexShrink: 0, display: "flex", borderTop: "1px solid #222" }}>
                <VideoTile stream={peersRef.current[pid] ?? null} label={getPeerName(pid) || `참여자 ${i + 1}`} isSpeaking={(audioLevels[pid] || 0) > 0.025} />
              </div>
            ))}
          </div>

          {/* 멘티 프로필 */}
          <div style={{ background: NAVY, padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Avatar name={currentMentee?.name || "?"} size={34} bg="#1E6A5A" fontSize={11} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{currentMentee?.name}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>멘티 {currentMenteeIdx + 1} / {menteeList.length}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>AI 종합 점수</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>
                {toFivePointScore(reportData?.ai_report?.overall_score) || "--"}
                <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>/5</span>
              </span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height: 4 }}>
              <div style={{ width: `${Math.min(toFivePointScore(reportData?.ai_report?.overall_score) * 20, 100)}%`, height: 4, borderRadius: 99, background: GREEN, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
              {(reportData?.ai_report?.fit_gap?.missing_requirements || []).slice(0, 3).map((req, i) => {
                const label = parseFitGapItem(req).requirement;
                return <span key={i} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(226,75,74,0.18)", color: "#E24B4A", fontWeight: 600 }}>{label.length > 14 ? label.slice(0, 14) + "…" : label}</span>;
              })}
            </div>
          </div>

          {/* 코칭 포인트 */}
          <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>코칭 포인트</p>
            {[
              { emoji: "💡", text: "BEST 구간을 칭찬하고 자신감을 높여주세요" },
              { emoji: "🔧", text: "WORST 구간은 구체적 개선 방향을 제시해주세요" },
              { emoji: "📊", text: "수치 기반 성과 제시를 권장해주세요" },
              { emoji: "🎯", text: "다음 면접 전략을 함께 수립해주세요" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{item.emoji}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{item.text}</span>
              </div>
            ))}
          </div>

          {/* 멘토 메모 */}
          <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", flex: 1, display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>세션 메모</p>
            <textarea
              placeholder="세션 중 메모를 남겨두세요..."
              style={{ flex: 1, minHeight: 72, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px 12px", color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: "inherit", lineHeight: 1.6, resize: "none", outline: "none" }}
              onFocus={e => { e.target.style.borderColor = "rgba(29,158,117,0.5)"; }}
              onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; }}
            />
          </div>
        </div>
      </div>

      {/* ── 하단 컨트롤 바 ── */}
      <div style={{ background: NAVY, borderTop: "1px solid rgba(255,255,255,0.1)", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <ControlButton active={isMicOn} onClick={handleMicToggle} label={isMicOn ? "마이크" : "음소거"}>
            {isMicOn
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
            }
          </ControlButton>
          <ControlButton active={isCamOn} onClick={handleCamToggle} label={isCamOn ? "카메라" : "카메라 끔"}>
            {isCamOn
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            }
          </ControlButton>
          <ControlButton active={drawMode} onClick={() => setDrawMode(v => !v)} label={drawMode ? "그리기 끄기" : "펜"} activeColor="#F59E0B">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </ControlButton>
        </div>

        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{session.title} · {currentMentee?.name} ({currentMenteeIdx + 1}/{menteeList.length})</p>

        <button onClick={() => setShowEndConfirm(true)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#E24B4A", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s" }}
          onMouseEnter={e => { e.target.style.opacity = "0.85"; }} onMouseLeave={e => { e.target.style.opacity = "1"; }}>
          세션 종료
        </button>
      </div>

      {/* ── 종료 확인 모달 ── */}
      {showEndConfirm && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: 18, padding: "32px 36px", width: 380, textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 9.88a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.32 8.91"/>
                <line x1="23" y1="1" x2="1" y2="23"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>세션을 종료하시겠어요?</h3>
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 24 }}>
              {isMentor
                ? "세션 종료 후 최종 피드백 작성 페이지로 이동합니다."
                : "세션을 나가면 멘토가 최종 코멘트 작성 후 리포트가 전달됩니다."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowEndConfirm(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #D1D5DB", background: "white", color: "#555", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                취소
              </button>
              <button onClick={handleEndSession} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#E24B4A", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                종료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function ControlButton({ children, active, onClick, label, activeColor = GREEN }) {
  return (
    <button onClick={onClick} title={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "5px 12px", borderRadius: 8, border: "none", background: active ? `${activeColor}22` : "rgba(255,255,255,0.06)", color: active ? activeColor : "#888", cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s, color 0.15s" }}>
      {children}
      <span style={{ fontSize: 9 }}>{label}</span>
    </button>
  );
}
