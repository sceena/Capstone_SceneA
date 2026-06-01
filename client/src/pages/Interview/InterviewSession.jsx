import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import { updateSessionStatus, updateParticipantStatus, uploadAnswerAudio, uploadQuestionAudio, getQuestions, getSession, getQuestionAnswers } from "../../api/sessions";
import { getAuthUser } from "../../store/authStore";
import {
  describeMediaError,
  getStreamVideoDeviceId,
  openInterviewStream,
} from "../../utils/mediaDevices";

const MEDIA_SERVER = import.meta.env.VITE_MEDIA_SERVER_URL || undefined;
const MEDIA_SERVER_PATH = import.meta.env.VITE_MEDIA_SERVER_PATH || '/socket.io';
const THEME = {
  main: "#F7F7F8",
  card: "#FFFFFF",
  panel: "#F1F1F3",
  primary: "#10A37F",
  speaker: "#10A37F",
  ai: "#10A37F",
  text: "#202123",
  sub: "#6B7280",
  border: "#E5E5E5",
  danger: "#EF4444",
  success: "#10A37F",
  onAccent: "#FFFFFF",
};

function getPeerIdFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

function getAudioRecorderOptions() {
  if (typeof MediaRecorder === "undefined") return {};
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : {};
}

function createAudioBlob(chunks) {
  const type = chunks.find(chunk => chunk?.type)?.type || "audio/webm";
  return new Blob(chunks, { type });
}

function describeRecordingError(error) {
  if (typeof MediaRecorder === "undefined") {
    return "현재 브라우저가 녹음을 지원하지 않습니다. Chrome으로 다시 시도해주세요.";
  }
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return "브라우저 또는 macOS 마이크 권한을 허용해주세요.";
  }
  if (error?.message) return error.message;
  return "마이크 권한 또는 브라우저 녹음 지원을 확인해주세요.";
}

function getQuestionSttStatus(question) {
  return question?.stt_status ?? question?.sttStatus ?? null;
}

function getQuestionDisplayText(question) {
  const content = question?.content ?? "";
  return content === "질문 음성 변환 중입니다."
    ? "질문 텍스트 정제 중입니다."
    : content;
}

function splitSessionQuestions(items) {
  const list = Array.isArray(items) ? items : [];
  return {
    recommendations: list.filter(question => !getQuestionSttStatus(question)),
    spoken: list.filter(question => getQuestionSttStatus(question)),
  };
}

function getCachedRecommendations(sessionId) {
  try {
    const raw = sessionStorage.getItem(`scena_session_recommendations_${sessionId}`);
    const contents = JSON.parse(raw || "[]");
    return Array.isArray(contents)
      ? contents.filter(Boolean).map((content, index) => ({ id: `cached-${index}`, content }))
      : [];
  } catch {
    return [];
  }
}

function findNextSpokenQuestion(spokenQuestions, answeredQuestionIds) {
  const answered = new Set(answeredQuestionIds.map(String));
  return [...spokenQuestions].reverse().find(question => !answered.has(String(question.id))) || null;
}

function hasAnswerItems(data) {
  if (Array.isArray(data)) return data.length > 0;
  if (Array.isArray(data?.answers)) return data.answers.length > 0;
  if (Array.isArray(data?.content)) return data.content.length > 0;
  return false;
}

function RecordingWave({ level = 0 }) {
  const normalized = Math.min(1, Math.max(0.08, level * 5));
  const bars = Array.from({ length: 18 });
  return (
    <div className="voice-wave" style={{ display: "flex", alignItems: "center", gap: 3, height: 28, flex: 1 }}>
      {bars.map((_, i) => {
        const shape = (Math.sin(i * 0.85) + 1) / 2;
        const height = 5 + Math.round((8 + shape * 18) * normalized);
        return (
          <span key={i} style={{
            width: 3,
            height,
            borderRadius: 999,
            background: i % 3 === 0 ? THEME.speaker : THEME.success,
            opacity: 0.38 + normalized * 0.62,
            transition: "height 0.18s ease, opacity 0.18s ease",
          }} />
        );
      })}
    </div>
  );
}

function PulseDot({ active = false, color = THEME.danger }) {
  return (
    <span style={{
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: color,
      boxShadow: active ? `0 0 0 6px ${color}22` : `0 0 0 3px ${color}18`,
      animation: active ? "recordPulse 1.15s ease-in-out infinite" : "none",
      flexShrink: 0,
    }} />
  );
}

function ReportStepsOverlay({ role }) {
  const steps = role === "mentor"
    ? ["면접 종료 동기화", "STT 작업 확인", "AI 리포트 생성", "멘토 검토 화면 준비"]
    : ["종료 신호 수신", "답변 음성 정리", "AI 리포트 생성", "리포트 화면 이동"];

  return (
    <div className="report-overlay">
      <div className="report-modal">
        <div className="report-loader">
          <span />
          <span />
          <span />
        </div>
        <h2>리포트 생성 준비 중</h2>
        <p>저장된 질문과 답변을 확인하고 분석 단계로 넘기고 있습니다.</p>
        <div className="report-steps">
          {steps.map((step, index) => (
            <div key={step} className="report-step" style={{ animationDelay: `${index * 0.18}s` }}>
              <PulseDot active color={index < 2 ? THEME.success : THEME.speaker} />
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 통합 비디오 타일 ── */
function VideoTile({ stream, label, mirror = false, muted = false, isSpeaking = false, camOff = false, micOff = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = muted;
    video.play().catch(() => {});
  }, [stream, muted]);
  return (
    <div className={`video-tile ${isSpeaking && !micOff ? "is-speaking" : ""}`} style={{
      position: "relative", width: "100%", height: "100%",
      background: `linear-gradient(180deg, ${THEME.card}, ${THEME.panel})`, borderRadius: 18, overflow: "hidden",
      border: `1px solid ${isSpeaking && !micOff ? THEME.text : THEME.border}`,
      boxShadow: isSpeaking && !micOff
        ? "0 0 0 3px rgba(32,33,35,0.14), 0 18px 42px rgba(32,33,35,0.12)"
        : "0 16px 42px rgba(32,33,35,0.08)",
      transition: "border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease",
    }}>
      <video ref={ref} autoPlay playsInline style={{
        width: "100%", height: "100%", objectFit: "cover",
        transform: mirror ? "scaleX(-1)" : "none",
        display: camOff ? "none" : "block",
        filter: micOff && !camOff ? "brightness(0.65)" : "none",
        transition: "filter 0.2s",
      }} />
      {camOff && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: micOff ? "rgba(0,0,0,0.15)" : "transparent",
          transition: "background 0.2s",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, color: THEME.onAccent, fontWeight: 700,
            opacity: micOff ? 0.6 : 1, transition: "opacity 0.2s",
          }}>
            {(label || "?")[0]}
          </div>
        </div>
      )}
      {label && (
        <div style={{
          position: "absolute", bottom: 8, left: 8,
          background: "rgba(255,255,255,0.70)", borderRadius: 999, padding: "4px 10px",
          display: "flex", alignItems: "center", gap: 5,
          border: "1px solid rgba(255,255,255,0.36)",
          backdropFilter: "blur(12px)",
        }}>
          {micOff && (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="1" width="6" height="9" rx="3" stroke={THEME.danger} strokeWidth="1.5"/>
              <path d="M3 7c0 2.76 2.24 5 5 5s5-2.24 5-5" stroke={THEME.danger} strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="1" y1="1" x2="15" y2="15" stroke={THEME.danger} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          <span style={{ fontSize: 11, color: micOff ? THEME.sub : THEME.text, fontWeight: 700 }}>{label}</span>
        </div>
      )}
      {/* 음소거 상태 배지 (우하단) */}
      {micOff && (
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          background: THEME.danger, borderRadius: "50%",
          width: 22, height: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 2px rgba(255,255,255,0.72)",
        }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="1" width="6" height="9" rx="3" stroke="#fff" strokeWidth="1.5"/>
            <line x1="1" y1="1" x2="15" y2="15" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function MenteeProgressPanel({
  activeQuestion,
  answerStatus,
  answerSaveState,
  answerSaveMessage,
  answeredQuestionIds,
  spokenQuestions,
  answerButtonDisabled,
  answerBlockedByRecorder,
  recordingLockedByOther,
  activeRecorder,
  audioLevel,
  answerElapsedText,
  onToggleAnswer,
}) {
  const answeredSet = new Set(answeredQuestionIds.map(String));
  const actualQuestions = Array.isArray(spokenQuestions) ? [...spokenQuestions] : [];
  if (activeQuestion?.id && !actualQuestions.some(q => String(q.id) === String(activeQuestion.id))) {
    actualQuestions.push(activeQuestion);
  }

  const answeredCount = actualQuestions.filter(q => answeredSet.has(String(q.id))).length;
  const totalCount = actualQuestions.length;
  const progressRatio = totalCount > 0 ? Math.min(100, Math.round((answeredCount / totalCount) * 100)) : 0;
  const isAnswering = answerStatus === "answering";
  const isUploading = answerSaveState === "uploading";
  const hasSaveError = answerSaveState === "failed";

  const status = (() => {
    if (isAnswering) {
      return { label: "답변 녹음 중", tone: THEME.success, bg: THEME.panel, text: "답변 완료를 누르면 음성이 저장되고 분석 대기열에 들어갑니다." };
    }
    if (isUploading) {
      return { label: "답변 저장 중", tone: THEME.primary, bg: THEME.panel, text: "오디오를 업로드하고 있습니다. 창을 닫지 말고 잠시 기다려주세요." };
    }
    if (hasSaveError) {
      return { label: "저장 확인 필요", tone: THEME.danger, bg: THEME.panel, text: answerSaveMessage || "답변 저장에 실패했습니다. 같은 질문에 다시 답변해 주세요." };
    }
    if (answerSaveState === "saved") {
      return { label: "답변 저장 완료", tone: THEME.success, bg: THEME.panel, text: answerSaveMessage || "" };
    }
    if (activeQuestion) {
      return { label: "답변 차례", tone: THEME.success, bg: THEME.panel, text: "질문을 읽고 핵심 경험부터 차분히 답변하세요." };
    }
    if (answerBlockedByRecorder) {
      return { label: "다른 답변 진행 중", tone: THEME.ai, bg: THEME.panel, text: "다른 참여자의 발화가 끝나면 내 답변을 시작할 수 있습니다." };
    }
    if (recordingLockedByOther && activeRecorder?.recordingType === "QUESTION") {
      return { label: "멘토 질문 중", tone: THEME.speaker, bg: THEME.panel, text: "멘토가 질문을 확정하고 있습니다. 질문이 표시되면 답변을 시작하세요." };
    }
    return { label: "질문 대기 중", tone: THEME.sub, bg: THEME.panel, text: "멘토가 실제 질문을 기록하면 이 영역에 질문 전문이 표시됩니다." };
  })();

  return (
    <div className="interview-side-panel" style={{
      width: 320,
      flexShrink: 0,
      background: THEME.card,
      borderLeft: `1px solid ${THEME.border}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${THEME.border}`, background: THEME.card }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: THEME.text }}>내 답변 흐름</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <section style={{ border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 14, background: status.bg, backdropFilter: "blur(18px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: status.tone }}>{status.label}</p>
            <span style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: status.tone,
              boxShadow: isAnswering ? `0 0 0 5px ${status.tone}22` : "none",
              animation: isAnswering ? "pulse 1s ease-in-out infinite" : "none",
              flexShrink: 0,
            }} />
          </div>
          {status.text && <p style={{ fontSize: 12, color: THEME.sub, lineHeight: 1.6 }}>{status.text}</p>}
          {isAnswering && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <RecordingWave level={audioLevel || 0} />
              <span style={{ fontSize: 11, fontWeight: 800, color: THEME.success, flexShrink: 0 }}>녹음 중 {answerElapsedText}</span>
            </div>
          )}
        </section>

        <section style={{ border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 14, background: THEME.panel, backdropFilter: "blur(18px)" }}>
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: THEME.speaker, marginBottom: 8 }}>
            현재 질문
          </p>
          {activeQuestion ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: THEME.text, lineHeight: 1.65, marginBottom: 12 }}>
                {getQuestionDisplayText(activeQuestion)}
              </p>
              <button
                type="button"
                onClick={onToggleAnswer}
                disabled={answerButtonDisabled}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 9,
                  border: "none",
                  background: isAnswering ? THEME.success : THEME.primary,
                  color: THEME.onAccent,
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: answerButtonDisabled ? "not-allowed" : "pointer",
                  opacity: answerButtonDisabled ? 0.55 : 1,
                  fontFamily: "inherit",
                }}
              >
                {isUploading ? "저장 중..." : isAnswering ? "답변 완료" : "답변 시작"}
              </button>
            </>
          ) : (
            <p style={{ fontSize: 12, color: THEME.sub, lineHeight: 1.7 }}>
              아직 확정된 질문이 없습니다. 멘토가 질문을 완료하면 이곳에 표시됩니다.
            </p>
          )}
        </section>

        <section style={{ border: `1px solid ${THEME.border}`, borderRadius: 14, padding: 14, background: THEME.panel, backdropFilter: "blur(18px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: THEME.primary }}>답변 진행</p>
            <span style={{ fontSize: 11, color: THEME.sub, fontWeight: 800 }}>{answeredCount}/{totalCount}</span>
          </div>
          <div style={{ height: 8, background: THEME.card, borderRadius: 999, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ width: `${progressRatio}%`, height: "100%", background: THEME.success, borderRadius: 999, transition: "width 0.2s ease" }} />
          </div>
          {actualQuestions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {actualQuestions.slice(-4).map((q, index) => {
                const answered = answeredSet.has(String(q.id));
                const current = activeQuestion?.id && String(activeQuestion.id) === String(q.id);
                return (
                  <div key={q.id ?? index} style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: "8px 9px",
                    borderRadius: 8,
                    background: current ? "rgba(16,163,127,0.10)" : THEME.card,
                  }}>
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: answered ? THEME.success : current ? THEME.speaker : THEME.border,
                      color: THEME.text,
                      fontSize: 10,
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>{answered ? "✓" : index + 1}</span>
                    <p style={{ fontSize: 11, color: THEME.text, lineHeight: 1.55 }}>
                      {getQuestionDisplayText(q)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: THEME.sub, lineHeight: 1.6 }}>아직 기록된 질문이 없습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════ */
export default function InterviewSession({ role = "mentee" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isMentor = role === "mentor";

  /* ── 타이머 ── */
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(true);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  const formatTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  /* ── 컨트롤 상태 ── */
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  /* ── 멘토 전용 ── */
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [questionRecordStatus, setQuestionRecordStatus] = useState("idle");
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [recommendationsOpen, setRecommendationsOpen] = useState(true);
  const [spokenQuestions, setSpokenQuestions] = useState([]);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState([]);
  const questionRecorderRef = useRef(null);
  const questionAudioChunksRef = useRef([]);
  const questionStartRef = useRef(null);
  const questionCancelRef = useRef(false);

  /* ── 멘티 전용: 답변 상태 + 오디오 녹음 ── */
  const [answerStatus, setAnswerStatus] = useState("idle");
  const [answerSaveState, setAnswerSaveState] = useState("idle"); // idle | recording | uploading | saved | failed
  const [answerSaveMessage, setAnswerSaveMessage] = useState("");
  const [activeRecorder, setActiveRecorder] = useState(null);
  const [localPeerId, setLocalPeerId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const answerStartRef = useRef(null);
  const answerQuestionRef = useRef(null);

  /* ── 질문 목록 ── */
  const [questions, setQuestions] = useState([]);
  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) return;
    let cancelled = false;

    const loadQuestions = async () => {
      try {
        const data = await getQuestions(id);
        if (cancelled) return;
        const { recommendations, spoken } = splitSessionQuestions(data);
        setQuestions(recommendations.length > 0 ? recommendations : getCachedRecommendations(id));
        setSpokenQuestions(spoken);
        setActiveQuestion(prev => {
          if (!prev?.id) return prev;
          const updated = spoken.find(question => String(question.id) === String(prev.id));
          return updated ? { ...prev, ...updated } : prev;
        });
        if (!isMentor) {
          const nextQuestion = findNextSpokenQuestion(spoken, answeredQuestionIds);
          setActiveQuestion(prev => (
            prev?.id === nextQuestion?.id && prev?.content === nextQuestion?.content
              ? prev
              : nextQuestion
          ));
        }
      } catch {}
    };

    loadQuestions();
    const interval = window.setInterval(loadQuestions, isMentor ? 8000 : 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [id, isMentor, answeredQuestionIds]);

  /* ── WebRTC refs ── */
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const videoProducerRef = useRef(null);
  const audioProducerRef = useRef(null);
  const consumersRef = useRef(new Map());
  const redirectedByEndRef = useRef(false);

  /* recvTransport 준비 전 도착한 newProducer 이벤트 큐 */
  const pendingProducersRef = useRef([]);
  const recvTransportReadyRef = useRef(false);

  /* ── 오디오 레벨 (활성 발화자) refs ── */
  const audioCtxRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const peerAnalysersRef = useRef({});

  /* ── 원격 참여자 상태 ── */
  const peersRef = useRef({});
  const [peerIds, setPeerIds] = useState([]);
  const [mediaError, setMediaError] = useState(null);
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [audioLevels, setAudioLevels] = useState({});
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting"); // connecting | connected | reconnecting | failed

  /* ── 미디어 소비 ── */
  const consumeProducer = useCallback((producerId, peerId, kind) => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!socket || !device || !recvTransport) { resolve(); return; }

      socket.emit("consume", {
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      }, async (res) => {
        if (res.error) { console.error("consume 실패:", res.error); resolve(); return; }
        try {
          const consumer = await recvTransport.consume({
            id: res.id,
            producerId: res.producerId,
            kind: res.kind,
            rtpParameters: res.rtpParameters,
          });
          consumersRef.current.set(consumer.id, consumer);

          if (!peersRef.current[peerId]) {
            peersRef.current[peerId] = new MediaStream();
          }
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
        } catch (e) {
          console.error("consumer 생성 실패:", e);
        }
        resolve();
      });
    });
  }, []);

  /* ── WebRTC 초기화 ── */
  useEffect(() => {
    const user = getAuthUser();
    // SKIP_AUTH 모드(로컬 테스트)에서는 토큰 없이도 연결 허용
    const token = user?.accessToken || (import.meta.env.VITE_SKIP_AUTH === 'true' ? 'dev' : null);
    if (!token) return;
    setLocalPeerId(getPeerIdFromToken(token));

    let isCancelled = false;
    let socket;

    /* mediasoup 객체만 초기화 (카메라 스트림은 유지) */
    const resetMediasoup = () => {
      recvTransportReadyRef.current = false;
      pendingProducersRef.current = [];
      videoProducerRef.current?.close();
      videoProducerRef.current = null;
      audioProducerRef.current?.close();
      audioProducerRef.current = null;
      sendTransportRef.current?.close();
      sendTransportRef.current = null;
      recvTransportRef.current?.close();
      recvTransportRef.current = null;
      consumersRef.current.forEach(c => c.close());
      consumersRef.current.clear();
      deviceRef.current = null;
      Object.keys(peersRef.current).forEach(k => delete peersRef.current[k]);
      Object.keys(peerAnalysersRef.current).forEach(k => delete peerAnalysersRef.current[k]);
      setPeerIds([]);
    };

    /* 방 입장 + mediasoup 전체 시그널링 (최초 & 재접속 공통) */
    const joinAndInit = async (localStream) => {
      if (isCancelled) return;
      resetMediasoup();
      setConnectionState("connecting");

      socket.emit("join", { sessionId: id, token }, async (res) => {
        if (isCancelled) return;
        if (res.error) { console.error("join 실패:", res.error); setConnectionState("failed"); return; }

        const { rtpCapabilities, existingProducers, activeQuestion: roomActiveQuestion, activeRecorder: roomActiveRecorder } = res;
        setActiveRecorder(roomActiveRecorder || null);
        if (roomActiveQuestion) {
          setActiveQuestion(roomActiveQuestion);
          setSpokenQuestions(prev => prev.some(q => q.id === roomActiveQuestion.id) ? prev : [...prev, roomActiveQuestion]);
        }

        /* Device 초기화 */
        const device = new Device();
        try {
          await device.load({ routerRtpCapabilities: rtpCapabilities });
        } catch (e) { console.error("Device.load 실패:", e); return; }
        if (isCancelled) return;
        deviceRef.current = device;

        /* Send Transport */
        socket.emit("createTransport", { direction: "send" }, async (sendRes) => {
          if (isCancelled) return;
          if (sendRes.error) { console.error("send transport 실패:", sendRes.error); return; }

          const sendTransport = device.createSendTransport(sendRes);
          sendTransportRef.current = sendTransport;

          sendTransport.on("connect", ({ dtlsParameters }, cb, errback) => {
            socket.emit("connectTransport", { transportId: sendTransport.id, dtlsParameters }, (r) => {
              r.error ? errback(new Error(r.error)) : cb();
            });
          });

          sendTransport.on("produce", ({ kind, rtpParameters }, cb, errback) => {
            socket.emit("produce", { transportId: sendTransport.id, kind, rtpParameters }, (r) => {
              r.error ? errback(new Error(r.error)) : cb({ id: r.producerId });
            });
          });

          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack) {
            try { videoProducerRef.current = await sendTransport.produce({ track: videoTrack }); }
            catch (e) { console.error("video produce 실패:", e); }
          }

          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            try { audioProducerRef.current = await sendTransport.produce({ track: audioTrack }); }
            catch (e) { console.error("audio produce 실패:", e); }
          }
        });

        /* Recv Transport */
        socket.emit("createTransport", { direction: "recv" }, async (recvRes) => {
          if (isCancelled) return;
          if (recvRes.error) { console.error("recv transport 실패:", recvRes.error); return; }

          const recvTransport = device.createRecvTransport(recvRes);
          recvTransportRef.current = recvTransport;

          recvTransport.on("connect", ({ dtlsParameters }, cb, errback) => {
            socket.emit("connectTransport", { transportId: recvTransport.id, dtlsParameters }, (r) => {
              r.error ? errback(new Error(r.error)) : cb();
            });
          });

          for (const { producerId, peerId, kind } of existingProducers) {
            if (isCancelled) return;
            await consumeProducer(producerId, peerId, kind);
          }

          /* recvTransport 준비 완료 → 큐에 쌓인 newProducer 처리 */
          recvTransportReadyRef.current = true;
          for (const pending of pendingProducersRef.current) {
            if (isCancelled) break;
            await consumeProducer(pending.producerId, pending.peerId, pending.kind);
          }
          pendingProducersRef.current = [];

          if (!isCancelled) setConnectionState("connected");
        });
      });
    };

    const init = async () => {
      /* 1. 로컬 카메라/마이크 (재접속 시 재사용) */
      let localStream = localStreamRef.current;
      if (!localStream) {
        const preferredCameraId = localStorage.getItem('preferredCameraId');
        const media = await openInterviewStream(preferredCameraId);
        localStream = media.stream;
        const actualDeviceId = getStreamVideoDeviceId(localStream);
        if (actualDeviceId) {
          localStorage.setItem('preferredCameraId', actualDeviceId);
        } else if (preferredCameraId) {
          localStorage.removeItem('preferredCameraId');
        }
        if (!media.videoAvailable) {
          setMediaError(`${describeMediaError(media.error)} 마이크만 연결됩니다.`);
        } else {
          setMediaError(null);
        }
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
      }

      /* 2. 소켓 연결 (reconnection 활성화) */
      socket = io(MEDIA_SERVER, {
        path: MEDIA_SERVER_PATH,
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
      });
      socketRef.current = socket;

      /* 소켓 connect: 최초 접속 & 재접속 모두 처리 */
      socket.on("connect", () => {
        joinAndInit(localStream);
      });

      socket.on("disconnect", (reason) => {
        if (isCancelled) return;
        // 사용자가 직접 종료한 경우가 아니면 재접속 중 표시
        if (reason !== "io client disconnect") {
          setConnectionState("reconnecting");
        }
      });

      socket.on("reconnect_failed", () => {
        if (!isCancelled) setConnectionState("failed");
      });

      socket.on("connect_error", (e) => {
        console.error("미디어 서버 연결 실패:", e.message);
      });

      /* 새 참여자 입장 - recvTransport 미준비 시 큐에 보관 */
      socket.on("newProducer", ({ producerId, peerId, kind }) => {
        if (isCancelled) return;
        if (!recvTransportReadyRef.current) {
          pendingProducersRef.current.push({ producerId, peerId, kind });
        } else {
          consumeProducer(producerId, peerId, kind);
        }
      });

      /* 참여자 퇴장 */
      socket.on("peerLeft", ({ peerId }) => {
        delete peersRef.current[peerId];
        delete peerAnalysersRef.current[peerId];
        setPeerIds(prev => prev.filter(p => p !== peerId));
      });

      socket.on("activeQuestion", ({ question }) => {
        setActiveQuestion(question || null);
        if (question) {
          setSpokenQuestions(prev => prev.some(q => q.id === question.id) ? prev : [...prev, question]);
        }
      });

      socket.on("activeRecorder", ({ activeRecorder }) => {
        setActiveRecorder(activeRecorder || null);
      });
    };

    init();

    return () => {
      isCancelled = true;
      recvTransportReadyRef.current = false;
      pendingProducersRef.current = [];
      videoProducerRef.current?.close();
      audioProducerRef.current?.close();
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      consumersRef.current.forEach(c => c.close());
      consumersRef.current.clear();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      localAnalyserRef.current = null;
      Object.keys(peerAnalysersRef.current).forEach(k => delete peerAnalysersRef.current[k]);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      socket?.disconnect();
    };
  }, [id, consumeProducer]);

  /* ── 오디오 레벨 폴링 (활성 발화자 감지) ── */
  useEffect(() => {
    const THRESHOLD = 0.025;
    const getLevel = (analyser) => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      return data.reduce((a, b) => a + b, 0) / data.length / 255;
    };
    const interval = setInterval(() => {
      const levels = {};
      if (localAnalyserRef.current) levels['__local'] = getLevel(localAnalyserRef.current);
      Object.entries(peerAnalysersRef.current).forEach(([pid, an]) => { levels[pid] = getLevel(an); });
      setAudioLevels(levels);
      let maxLevel = THRESHOLD, speaker = null;
      Object.entries(levels).forEach(([id, lv]) => { if (lv > maxLevel) { maxLevel = lv; speaker = id; } });
      setActiveSpeakerId(speaker);
    }, 300);
    return () => clearInterval(interval);
  }, []);

  /* ── 마이크 토글 ── */
  const handleMicToggle = () => {
    const next = !micOn;
    setMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    if (next) audioProducerRef.current?.resume();
    else audioProducerRef.current?.pause();
  };

  /* ── 카메라 토글 ── */
  const handleCamToggle = () => {
    const next = !camOn;
    setCamOn(next);
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
    if (next) videoProducerRef.current?.resume();
    else videoProducerRef.current?.pause();
  };

  /* ── 통화 종료 ── */
  const handleEndCall = async () => {
    if (!isMentor) return;
    if (!window.confirm("면접을 종료하시겠습니까?")) return;
    setEnding(true);
    try {
      await updateSessionStatus(id, "completed");
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
    navigate(`/report/generating/${id}`, { state: { role: "mentor" } });
  };

  useEffect(() => {
    if (isMentor || !id || !/^\d+$/.test(id)) return;
    let cancelled = false;
    const checkSessionEnd = async () => {
      try {
        const data = await getSession(id);
        const status = String(data?.status || "").toLowerCase();
        if (!cancelled && status === "completed" && !redirectedByEndRef.current) {
          redirectedByEndRef.current = true;
          setEnding(true);
          navigate(`/report/generating/${id}`);
        }
      } catch {}
    };
    const interval = window.setInterval(checkSessionEnd, 3000);
    checkSessionEnd();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [id, isMentor, navigate]);

  const requestRecordingLock = (recordingType) => new Promise((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      resolve(true);
      return;
    }
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn("recordingStart 응답 지연: 로컬 녹음을 우선 시작합니다.");
      resolve(true);
    }, 1500);
    socket.emit("recordingStart", { recordingType }, (res = {}) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (res.error) {
        setActiveRecorder(res.activeRecorder || null);
        alert("다른 참여자가 말하는 중입니다. 발화가 끝난 뒤 다시 시도해주세요.");
        resolve(false);
        return;
      }
      setActiveRecorder(res.activeRecorder || null);
      resolve(true);
    });
  });

  const releaseRecordingLock = () => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setActiveRecorder(null);
      return;
    }
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setActiveRecorder(null);
    }, 1000);
    socket.emit("recordingStop", {}, (res = {}) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      setActiveRecorder(res.activeRecorder || null);
    });
  };

  useEffect(() => {
    if (!isMentor || !activeQuestion?.id || !id || !/^\d+$/.test(id)) return;
    let cancelled = false;
    const checkAnswerSaved = async () => {
      try {
        const data = await getQuestionAnswers(id, activeQuestion.id);
        if (cancelled || !hasAnswerItems(data)) return;
        const key = String(activeQuestion.id);
        setAnsweredQuestionIds(prev => prev.includes(key) ? prev : [...prev, key]);
        setActiveQuestion(null);
      } catch {}
    };
    const interval = window.setInterval(checkAnswerSaved, 3000);
    checkAnswerSaved();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeQuestion?.id, id, isMentor]);

  useEffect(() => {
    if (isMentor || !activeQuestion?.id) return;
    setAnswerSaveState("idle");
    setAnswerSaveMessage("");
  }, [activeQuestion?.id, isMentor]);

  /* ── 답변 상태 / 녹음 ── */
  const handleAnswerStatus = async (nextStatus) => {
    if (nextStatus === "answering" && !activeQuestion?.id) {
      alert("멘토가 실제 질문을 확정하면 답변을 시작할 수 있습니다.");
      return;
    }

    if (nextStatus === "answering") {
      const locked = await requestRecordingLock("ANSWER");
      if (!locked) return;
      setAnswerStatus(nextStatus);
      setAnswerSaveState("recording");
      setAnswerSaveMessage("답변 녹음이 시작되었습니다.");
      try {
        const user = getAuthUser();
        const memberId = user?.id || getPeerIdFromToken(user?.accessToken || "");
        if (memberId) await updateParticipantStatus(id, memberId, nextStatus);
      } catch {}
      answerStartRef.current = new Date().toISOString();
      answerQuestionRef.current = activeQuestion;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, getAudioRecorderOptions());
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorderRef.current = recorder;
        recorder.start(250);
      } catch (error) {
        releaseRecordingLock();
        setAnswerStatus("idle");
        setAnswerSaveState("failed");
        setAnswerSaveMessage(describeRecordingError(error));
        alert(describeRecordingError(error));
      }
    } else if (nextStatus === "done" && mediaRecorderRef.current?.state !== "inactive") {
      setAnswerStatus(nextStatus);
      setAnswerSaveState("uploading");
      setAnswerSaveMessage("답변 오디오를 저장하고 있습니다.");
      try {
        const user = getAuthUser();
        const memberId = user?.id || getPeerIdFromToken(user?.accessToken || "");
        if (memberId) await updateParticipantStatus(id, memberId, nextStatus);
      } catch {}
      const answerEnd = new Date().toISOString();
      const user = getAuthUser();
      const memberId = user?.id || getPeerIdFromToken(user?.accessToken || "");
      const questionId = answerQuestionRef.current?.id;
      mediaRecorderRef.current.onstop = async () => {
        try {
          const blob = createAudioBlob(audioChunksRef.current);
          if (!blob.size) throw new Error("녹음된 답변 오디오가 없습니다. 답변 시작 후 1초 이상 말한 뒤 완료해주세요.");
          if (!questionId) throw new Error("답변 대상 질문을 찾지 못했습니다. 멘토가 질문을 다시 확정한 뒤 시도해주세요.");
          if (questionId) {
            await uploadAnswerAudio(id, questionId, blob, {
              answerStart: answerStartRef.current,
              answerEnd,
              menteeId: memberId,
            });
            setAnsweredQuestionIds(prev => {
              const key = String(questionId);
              return prev.includes(key) ? prev : [...prev, key];
            });
            setActiveQuestion(prev => String(prev?.id) === String(questionId) ? null : prev);
            setAnswerSaveState("saved");
            setAnswerSaveMessage("");
          }
        } catch (error) {
          setAnswerStatus("idle");
          setAnswerSaveState("failed");
          setAnswerSaveMessage(error?.message || "답변 저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.");
        } finally {
          releaseRecordingLock();
          mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
          answerQuestionRef.current = null;
        }
      };
      mediaRecorderRef.current.stop();
    }
  };

  const handleQuestionRecordToggle = async () => {
    if (questionRecordStatus === "recording") {
      setQuestionRecordStatus("uploading");
      questionRecorderRef.current.onstop = async () => {
        questionRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
        questionRecorderRef.current = null;
        if (questionCancelRef.current) {
          questionAudioChunksRef.current = [];
          questionStartRef.current = null;
          questionCancelRef.current = false;
          releaseRecordingLock();
          setQuestionRecordStatus("idle");
          return;
        }
        try {
          const blob = createAudioBlob(questionAudioChunksRef.current);
          if (!blob.size) throw new Error("녹음된 질문 오디오가 없습니다. 질문 시작 후 1초 이상 말한 뒤 완료해주세요.");
          const question = await uploadQuestionAudio(id, blob);
          setSpokenQuestions(prev => prev.some(q => q.id === question.id) ? prev : [...prev, question]);
          setActiveQuestion(question);
          socketRef.current?.emit("activeQuestion", { question });
        } catch (error) {
          alert(error?.message || "질문 오디오 저장에 실패했습니다.");
        } finally {
          releaseRecordingLock();
          questionStartRef.current = null;
          setQuestionRecordStatus("idle");
        }
      };
      questionRecorderRef.current.stop();
      return;
    }

    try {
      const locked = await requestRecordingLock("QUESTION");
      if (!locked) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      questionCancelRef.current = false;
      questionStartRef.current = new Date().toISOString();
      questionAudioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, getAudioRecorderOptions());
      recorder.ondataavailable = (e) => { if (e.data.size > 0) questionAudioChunksRef.current.push(e.data); };
      questionRecorderRef.current = recorder;
      recorder.start(250);
      setQuestionRecordStatus("recording");
    } catch (error) {
      releaseRecordingLock();
      setQuestionRecordStatus("idle");
      questionStartRef.current = null;
      alert(describeRecordingError(error));
    }
  };

  const handleQuestionCancel = () => {
    if (questionRecordStatus !== "recording") return;
    questionCancelRef.current = true;
    const recorder = questionRecorderRef.current;
    const cleanup = () => {
      recorder?.stream?.getTracks().forEach(t => t.stop());
      questionRecorderRef.current = null;
      questionAudioChunksRef.current = [];
      questionStartRef.current = null;
      questionCancelRef.current = false;
      releaseRecordingLock();
      setQuestionRecordStatus("idle");
    };

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = cleanup;
      recorder.stop();
    } else {
      cleanup();
    }
  };

  const sendChat = () => {
    if (!chatMsg.trim()) return;
    setChatHistory(prev => [...prev, { me: true, text: chatMsg }]);
    setChatMsg("");
  };

  const SPEAK_THRESHOLD = 0.025;
  // 참가자가 1명이라도 있으면 발화자 메인 뷰 활성화
  const mainViewId = peerIds.length > 0 ? (activeSpeakerId || peerIds[0]) : null;
  const recordingLockedByOther = Boolean(activeRecorder?.peerId && activeRecorder.peerId !== localPeerId);
  const staleQuestionLock = Boolean(activeQuestion?.id && activeRecorder?.recordingType === "QUESTION");
  const answerBlockedByRecorder = recordingLockedByOther && !staleQuestionLock;
  const waitingForAnswer = isMentor && Boolean(activeQuestion?.id) && questionRecordStatus !== "recording";
  const answerButtonDisabled = answerSaveState === "uploading"
    || (!activeQuestion && answerStatus !== "answering")
    || (answerBlockedByRecorder && answerStatus !== "answering");
  const questionButtonDisabled = questionRecordStatus === "uploading" || waitingForAnswer || (recordingLockedByOther && questionRecordStatus !== "recording");
  const nowMs = Date.now();
  const localAnswerStartedAt = answerStartRef.current ? new Date(answerStartRef.current).getTime() : null;
  const remoteAnswerStartedAt = activeRecorder?.recordingType === "ANSWER" && activeRecorder?.startedAt
    ? new Date(activeRecorder.startedAt).getTime()
    : null;
  const localQuestionStartedAt = questionStartRef.current ? new Date(questionStartRef.current).getTime() : null;
  const remoteQuestionStartedAt = activeRecorder?.recordingType === "QUESTION" && activeRecorder?.startedAt
    ? new Date(activeRecorder.startedAt).getTime()
    : null;
  const answerElapsedText = formatTime(Math.max(0, Math.floor((nowMs - (localAnswerStartedAt || remoteAnswerStartedAt || nowMs)) / 1000)));
  const questionElapsedText = formatTime(Math.max(0, Math.floor((nowMs - (localQuestionStartedAt || remoteQuestionStartedAt || nowMs)) / 1000)));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;margin:0}
        #root{height:100%;overflow:hidden;min-height:0;width:100%;max-width:100%;margin:0;display:block;text-align:left}
        body{font-family:'Noto Sans KR',sans-serif;background:${THEME.main};color:${THEME.text}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes recordPulse{0%{transform:scale(1);opacity:1}70%{transform:scale(1.35);opacity:.58}100%{transform:scale(1);opacity:1}}
        @keyframes speakPulse{0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}
        @keyframes cardFloat{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes stepIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${THEME.border};border-radius:4px}
        .session-shell{
          display:flex;flex-direction:column;height:100vh;
          background:${THEME.main};
        }
        .session-header{
          height:68px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;
          background:${THEME.card};border-bottom:1px solid ${THEME.border};
          color:${THEME.text};flex-shrink:0;
        }
        .recording-chip{
          background:${THEME.card};
          border:1px solid ${THEME.border};box-shadow:0 12px 34px rgba(32,33,35,.08);
        }
        .floating-control-bar{
          position:absolute;left:50%;bottom:20px;transform:translateX(-50%);z-index:20;
          display:flex;align-items:center;justify-content:center;gap:10px;
          width:max-content;max-width:calc(100% - 36px);padding:10px 12px;border-radius:999px;
          background:${THEME.card};border:1px solid ${THEME.border};
          box-shadow:0 20px 54px rgba(32,33,35,.12);
        }
        .ctrl-btn:hover{background:#111827!important;transform:translateY(-1px)}
        .ctrl-btn-off:hover{background:#6B7280!important;transform:translateY(-1px)}
        .report-overlay{
          position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
          background:rgba(247,247,248,.76);backdrop-filter:blur(18px);animation:cardFloat .24s ease both;
        }
        .report-modal{
          width:min(440px,calc(100vw - 34px));border-radius:24px;padding:26px;
          background:${THEME.card};border:1px solid ${THEME.border};
          box-shadow:0 32px 90px rgba(32,33,35,.14);text-align:left;
        }
        .report-loader{height:42px;display:flex;align-items:flex-end;gap:5px;margin-bottom:18px}
        .report-loader span{width:9px;border-radius:999px;background:${THEME.success};animation:speakPulse .8s ease-in-out infinite}
        .report-loader span:nth-child(1){height:18px}
        .report-loader span:nth-child(2){height:30px;animation-delay:.1s;background:${THEME.speaker}}
        .report-loader span:nth-child(3){height:24px;animation-delay:.2s;background:${THEME.ai}}
        .report-modal h2{font-size:22px;font-weight:900;color:${THEME.text};margin:0 0 7px}
        .report-modal p{font-size:13px;line-height:1.6;color:${THEME.sub};margin:0 0 18px}
        .report-steps{display:flex;flex-direction:column;gap:10px}
        .report-step{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:${THEME.panel};color:${THEME.text};font-size:12px;font-weight:900;animation:stepIn .34s ease both}
        @media(max-width:980px){.interview-side-panel{display:none!important}.floating-control-bar{bottom:14px}}
      `}</style>

      <div className="session-shell">

        {/* ════ 재접속 / 연결 실패 배너 ════ */}
        {(connectionState === "reconnecting" || connectionState === "failed") && (
          <div style={{
            position: "fixed", top: 76, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, width: "min(520px, calc(100vw - 32px))",
          }}>
            <div style={{
              background: THEME.card, borderRadius: 14, padding: "14px 18px",
              boxShadow: "0 16px 40px rgba(32,33,35,0.08)", border: `1px solid ${THEME.border}`,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              {connectionState === "reconnecting" ? (
                <>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: `3px solid ${THEME.border}`, borderTopColor: THEME.success,
                    animation: "spin 0.9s linear infinite", flexShrink: 0,
                  }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: THEME.text, marginBottom: 2 }}>미디어 서버 재연결 중</p>
                    <p style={{ fontSize: 11, color: THEME.sub }}>화면 공유 연결을 복구하고 있습니다. 질문/답변 녹음은 계속 시도할 수 있습니다.</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: "rgba(239,68,68,0.14)", color: THEME.danger,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 900, flexShrink: 0,
                  }}>!</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: THEME.danger, marginBottom: 2 }}>미디어 서버 연결 실패</p>
                    <p style={{ fontSize: 11, color: THEME.sub }}>상대 화면이 보이지 않을 수 있습니다. 로컬 녹음과 오디오 저장은 계속 진행할 수 있습니다.</p>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      padding: "8px 12px", background: THEME.primary, color: THEME.onAccent,
                      border: "none", borderRadius: 999, fontSize: 12, fontWeight: 800,
                      cursor: "pointer", fontFamily: "inherit",
                      flexShrink: 0,
                    }}
                  >
                    새로고침
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ════ 상단 헤더 바 ════ */}
        <div className="session-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: THEME.text, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(32,33,35,.14)" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="4" width="11" height="9" rx="1.5" fill="white"/>
                <path d="M12 7.5l5-2.5v8l-5-2.5V7.5z" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: THEME.text }}>면접 진행 중</p>
              <p style={{ fontSize: 11, color: THEME.sub }}>
                {mediaError ? <span style={{ color: THEME.danger }}>{mediaError}</span> : "실시간 면접 세션"}
              </p>
            </div>
          </div>

          {/* 참가자 수 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: THEME.text, border: `2px solid ${THEME.card}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: THEME.onAccent,
            }}>나</div>
            {peerIds.slice(0, 3).map((pid, i) => (
              <div key={pid} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: [THEME.panel, THEME.sub, THEME.text][i],
                border: `2px solid ${THEME.card}`, marginLeft: -8, zIndex: 3 - i,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: i === 0 ? THEME.text : THEME.onAccent,
              }}>{i + 1}</div>
            ))}
            {peerIds.length > 3 && (
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: THEME.panel, border: `2px solid ${THEME.card}`, marginLeft: -8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: THEME.sub,
              }}>+{peerIds.length - 3}</div>
            )}
          </div>

          <div style={{ fontSize: 12, color: THEME.sub, fontWeight: 800 }}>
            세션 #{id} · 참여자 {peerIds.length + 1}명
          </div>
        </div>

        {/* ════ 본문 영역 ════ */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── 메인 비디오 영역 ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

            {/* ── 비디오 그리드 ── */}
            <div style={{ flex: 1, overflow: "hidden", background: THEME.main, position: "relative" }}>
              {isMentor && (
                <div className="recording-chip" style={{
                  position: "absolute", top: 16, left: 16, zIndex: 10,
                  padding: "5px 12px", display: "flex", alignItems: "center", gap: 7,
                }}>
                  <PulseDot active={recording} color={THEME.danger} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: THEME.text, fontFamily: "monospace" }}>{formatTime(elapsed)}</span>
                </div>
              )}

              {peerIds.length === 0 ? (
                /* ── 혼자: 자신 화면 중앙 ── */
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", padding: 20 }}>
                  <div style={{ width: "min(640px, 100%)", height: "min(480px, 100%)" }}>
                    <VideoTile stream={localMediaStream} label="나 (본인)" mirror muted
                      isSpeaking={(audioLevels['__local'] || 0) > SPEAK_THRESHOLD} camOff={!camOn} micOff={!micOn} />
                  </div>
                </div>
              ) : (
                /* ── 발화자 메인 + 전원 하단 스트립 (1:1 / 1:N 공통) ── */
                <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "16px 16px 8px" }}>

                  {/* 메인: 현재 발화자 (아무도 안 말하면 첫 번째 참가자) */}
                  <div style={{ flex: 1, minHeight: 0, marginBottom: 8 }}>
                    {mainViewId === '__local' ? (
                      <VideoTile stream={localMediaStream} label="나 (본인)" mirror muted
                        isSpeaking camOff={!camOn} micOff={!micOn} />
                    ) : (
                      <VideoTile stream={peersRef.current[mainViewId]} label="상대방"
                        isSpeaking={(audioLevels[mainViewId] || 0) > SPEAK_THRESHOLD} />
                    )}
                  </div>

                  {/* 하단 스트립: 나 + 모든 참가자 전원 표시 */}
                  <div style={{ height: 120, display: "flex", gap: 8, overflowX: "auto", flexShrink: 0, paddingBottom: 4 }}>
                    {/* 내 화면은 항상 첫 번째 */}
                    <div style={{ width: 160, flexShrink: 0, height: "100%", position: "relative" }}>
                      <VideoTile stream={localMediaStream} label="나" mirror muted
                        isSpeaking={(audioLevels['__local'] || 0) > SPEAK_THRESHOLD} camOff={!camOn} micOff={!micOn} />
                    </div>
                    {/* 원격 참가자 전원 */}
                    {peerIds.map(peerId => (
                      <div key={peerId} style={{ width: 160, flexShrink: 0, height: "100%", position: "relative" }}>
                        <VideoTile stream={peersRef.current[peerId]} label="참여자"
                          isSpeaking={(audioLevels[peerId] || 0) > SPEAK_THRESHOLD} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── 하단 컨트롤 바 ── */}
            <div className="floating-control-bar">
              {[
                { icon: <MicIcon on={micOn} />, label: micOn ? "마이크" : "음소거", active: micOn, click: handleMicToggle },
                { icon: <CamIcon on={camOn} />, label: camOn ? "카메라" : "카메라 끔", active: camOn, click: handleCamToggle },
                { icon: <ChatIcon />, label: "채팅", active: !chatOpen, click: () => setChatOpen(v => !v) },
              ].map((btn, i) => (
                <button key={i} className={btn.active ? "ctrl-btn" : "ctrl-btn-off"} onClick={btn.click} style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: btn.active ? THEME.text : THEME.sub,
                  border: `1px solid ${THEME.border}`, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.18s, transform 0.18s",
                  boxShadow: "0 10px 22px rgba(32,33,35,.12)",
                }}>
                  {btn.icon}
                </button>
              ))}

              {/* 채팅 입력창 */}
              {chatOpen && (
                <div style={{ display: "flex", gap: 8, flex: 1, maxWidth: 340 }}>
                  <input
                    placeholder="Type Something..."
                    value={chatMsg} onChange={e => setChatMsg(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendChat()}
                    style={{
                      flex: 1, padding: "10px 14px",
                      background: THEME.card, border: `1px solid ${THEME.border}`,
                      borderRadius: 24, fontSize: 13, color: THEME.text,
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <button onClick={sendChat} style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: THEME.text, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 8L2 2l2 6-2 6 12-6z" fill="white" />
                    </svg>
                  </button>
                </div>
              )}

              {/* End Call */}
              {isMentor ? (
                <button onClick={handleEndCall} disabled={ending} style={{
                  padding: "12px 24px",
                  background: ending ? THEME.sub : THEME.danger,
                  color: THEME.onAccent, border: "none", borderRadius: 24,
                  fontSize: 14, fontWeight: 700, cursor: ending ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "background 0.18s, transform 0.18s", marginLeft: 8,
                  boxShadow: "0 10px 22px rgba(255,59,48,.18)",
                }}
                  onMouseEnter={e => { if (!ending) e.currentTarget.style.background = "#DC2626"; }}
                  onMouseLeave={e => { if (!ending) e.currentTarget.style.background = THEME.danger; }}
                >
                  {ending ? "종료 중..." : "면접 종료"}
                </button>
              ) : null}
            </div>
          </div>

          {!isMentor && (
            <MenteeProgressPanel
              activeQuestion={activeQuestion}
              answerStatus={answerStatus}
              answerSaveState={answerSaveState}
              answerSaveMessage={answerSaveMessage}
              answeredQuestionIds={answeredQuestionIds}
              spokenQuestions={spokenQuestions}
              answerButtonDisabled={answerButtonDisabled}
              answerBlockedByRecorder={answerBlockedByRecorder}
              recordingLockedByOther={recordingLockedByOther}
              activeRecorder={activeRecorder}
              audioLevel={audioLevels['__local'] || 0}
              answerElapsedText={answerElapsedText}
              onToggleAnswer={() => handleAnswerStatus(answerStatus === "answering" ? "done" : "answering")}
            />
          )}

          {/* ════ 멘토 전용: 우측 사이드패널 ════ */}
          {isMentor && (
            <div style={{
              width: 300, flexShrink: 0,
              background: THEME.card, borderLeft: `1px solid ${THEME.border}`,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              <div style={{ padding: "13px 16px", borderBottom: `1px solid ${THEME.border}`, background: THEME.card }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: THEME.text }}>면접 질문 패널</p>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: THEME.speaker, textTransform: "uppercase" }}>실제 질문 기록</p>
                    <span style={{
                      minWidth: 54,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: questionRecordStatus === "recording" ? "rgba(16,163,127,0.10)" : THEME.panel,
                      border: `1px solid ${THEME.border}`,
                      color: questionRecordStatus === "recording" ? THEME.speaker : THEME.sub,
                      fontSize: 11,
                      fontWeight: 900,
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "center",
                    }}>
                      {questionElapsedText}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleQuestionRecordToggle}
                      disabled={questionButtonDisabled}
                      style={{
                        flex: 1, padding: "12px 14px",
                        borderRadius: 12, border: "none",
                        background: questionRecordStatus === "recording" ? THEME.panel : questionRecordStatus === "uploading" ? THEME.sub : THEME.primary,
                        color: questionRecordStatus === "recording" ? THEME.text : THEME.onAccent, fontSize: 13, fontWeight: 800,
                        cursor: questionButtonDisabled ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {questionRecordStatus === "recording"
                        ? "질문 완료"
                        : questionRecordStatus === "uploading"
                          ? "질문 저장 중..."
                          : "질문 시작"}
                    </button>
                    {questionRecordStatus === "recording" && (
                      <button
                        type="button"
                        onClick={handleQuestionCancel}
                        style={{
                          padding: "0 14px",
                          borderRadius: 12,
                          border: `1px solid ${THEME.border}`,
                          background: THEME.card,
                          color: THEME.sub,
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        취소
                      </button>
                    )}
                  </div>
                  {(waitingForAnswer || recordingLockedByOther) && (
                    <p style={{ fontSize: 11, color: THEME.sub, lineHeight: 1.6, marginTop: 8 }}>
                      {waitingForAnswer
                        ? "멘티 답변을 기다리는 중입니다. 답변 저장 후 다음 질문을 진행하세요."
                        : "다른 참여자가 말하는 중입니다. 발화가 끝난 뒤 질문을 시작하세요."}
                    </p>
                  )}
                  {questionRecordStatus === "recording" && (
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 10,
                      padding: "9px 10px",
                      borderRadius: 14,
                      background: THEME.panel,
                      border: `1px solid ${THEME.border}`,
                    }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: THEME.danger,
                        boxShadow: "0 0 0 4px rgba(239,68,68,0.12)",
                        flexShrink: 0,
                        animation: "pulse 1s ease-in-out infinite",
                      }} />
                      <RecordingWave level={audioLevels['__local'] || 0} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: THEME.speaker, flexShrink: 0 }}>
                        질문 녹음 중
                      </span>
                    </div>
                  )}
                  {activeQuestion && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 14, background: THEME.panel, border: `1px solid ${THEME.border}`, backdropFilter: "blur(18px)" }}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: THEME.speaker, marginBottom: 4 }}>현재 답변 대상 질문</p>
                      <p style={{ fontSize: 12, color: THEME.text, lineHeight: 1.6 }}>{getQuestionDisplayText(activeQuestion)}</p>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: THEME.ai, textTransform: "uppercase" }}>AI 추천질문</p>
                    <button
                      type="button"
                      onClick={() => setRecommendationsOpen(v => !v)}
                      style={{
                        border: `1px solid ${THEME.border}`,
                        background: recommendationsOpen ? "rgba(16,163,127,0.10)" : THEME.card,
                        color: THEME.ai,
                        borderRadius: 999,
                        padding: "4px 9px",
                        fontSize: 10,
                        fontWeight: 800,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {recommendationsOpen ? "접기" : "보기"}
                    </button>
                  </div>
                  {recommendationsOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {questions.length > 0 ? questions.map((q, i) => (
                        <div key={q.id ?? i} style={{
                          background: THEME.panel, borderRadius: 14, padding: "12px 14px",
                          border: `1px solid ${THEME.border}`,
                          borderLeft: `3px solid ${THEME.ai}`, transition: "background 0.15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(16,163,127,0.10)"}
                          onMouseLeave={e => e.currentTarget.style.background = THEME.panel}
                        >
                          <span style={{ fontSize: 10, fontWeight: 700, color: THEME.ai, display: "block", marginBottom: 4 }}>추천 {i + 1}</span>
                          <p style={{ fontSize: 12, color: THEME.text, lineHeight: 1.65 }}>{getQuestionDisplayText(q)}</p>
                        </div>
                      )) : (
                        <p style={{ fontSize: 12, color: THEME.sub, lineHeight: 1.6 }}>
                          준비 화면에서 생성한 AI 추천 질문이 여기에 표시됩니다.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: THEME.sub, textTransform: "uppercase", marginBottom: 10 }}>실제 질문 기록</p>
                  {spokenQuestions.length > 0 ? spokenQuestions.map((q, i) => (
                    <div key={q.id ?? i} style={{ padding: "10px 0", borderBottom: `1px solid ${THEME.border}` }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: THEME.sub, display: "block", marginBottom: 4 }}>
                        질문 {i + 1}
                      </span>
                      <p style={{ fontSize: 12, color: THEME.text, lineHeight: 1.7 }}>
                        {getQuestionDisplayText(q)}
                      </p>
                    </div>
                  )) : (
                    <p style={{ fontSize: 12, color: THEME.sub, lineHeight: 1.6 }}>
                      질문 완료를 누르면 멘토가 실제로 말한 질문이 여기에 기록됩니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {ending && <ReportStepsOverlay role={role} />}
      </div>
    </>
  );
}

/* ── 컨트롤 아이콘 ── */
const MicIcon = ({ on }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    {on
      ? <><rect x="6" y="1" width="6" height="9" rx="3" fill="white" /><path d="M3 8c0 3.314 2.686 6 6 6s6-2.686 6-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" /><line x1="9" y1="14" x2="9" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></>
      : <><rect x="6" y="1" width="6" height="9" rx="3" fill="white" opacity=".5" /><line x1="2" y1="2" x2="16" y2="16" stroke="white" strokeWidth="1.6" strokeLinecap="round" /></>
    }
  </svg>
);
const CamIcon = ({ on }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="11" height="9" rx="1.5" fill={on ? "white" : "rgba(255,255,255,0.5)"} />
    <path d="M12 7l5-2.5v8L12 10V7z" fill={on ? "white" : "rgba(255,255,255,0.5)"} />
    {!on && <line x1="2" y1="2" x2="16" y2="16" stroke="white" strokeWidth="1.6" strokeLinecap="round" />}
  </svg>
);
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 3h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5l-3 3V4a1 1 0 0 1 1-1z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M5 7h8M5 10h5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
