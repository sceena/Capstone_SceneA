import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import useAuthStore from "../../store/authStore";
import { getAuthUser } from "../../store/authStore";
import { getSessionReport } from "../../api/sessions";

const MEDIA_SERVER = import.meta.env.VITE_MEDIA_SERVER_URL || "http://localhost:4000";

// ─── 상수 ────────────────────────────────────────────────────────
const NAVY = "#0D2240";
const GREEN = "#1D9E75";

// ─── 더미 세션 데이터 (실제 연동 시 API로 교체) ─────────────────
const MOCK_SESSION = {
  sessionId: "sess-001",
  title: "OOO 멘토 개인 멘토링 진행",
  date: "2026.04.02",
  time: "19:00",
  mentor: { id: "m1", name: "박지훈", role: "Moderator", avatar: null },
  mentee: { id: "u1", name: "김민준", avatar: null },
  report: {
    title: "AI 정밀 진단 리포트",
    menteeName: "김민준",
    date: "2026.04.02",
    totalScore: 85,
    bestMoment: {
      quote: "결국 벤치마킹 데이터를 정리해 팀원들을 설득했습니다.",
      reason: "수치 기반 결과 제시 + 행동-결과 인과관계가 명확해 설득력이 높아요.",
    },
    worstMoment: {
      quote: "어... 그러니까 제 생각에는 그게 좀...",
      reason: "만연체 + 경험 없는 이론 나열. 구체적 사례로 전환 필요해요.",
    },
    scriptSegments: [
      { text: "네, 저는 지난 캡스톤 프로젝트에서 팀원 간 역할 분담 문제로 갈등이 생긴 경험이 있습니다.", type: "S" },
      { text: " 어... 그러니까 제 생각에는 그게 좀...", type: "BAD" },
      { text: " 백엔드 팀원과 API 설계 방향에서 의견 충돌이 있었습니다.", type: "T" },
      { text: " 저는 상대방의 입장을 먼저 들어보자는 생각으로...", type: "A" },
    ],
    fitGap: [
      { label: "Java / Spring Boot", pct: 92 },
      { label: "대규모 트래픽 경험", pct: 78 },
      { label: "CI/CD · DevOps", pct: 51 },
      { label: "MSA · 분산 시스템", pct: 44 },
      { label: "데이터 파이프라인", pct: 22 },
    ],
    qnas: [
      {
        id: "q1",
        question: "Q1 · 기술적 도전과 해결 과정을 말해주세요.",
        aiScore: 4.0,
        transcript: "카카오 인턴 당시 결제 서버 피크 타임 응답 지연 문제를 Redis 캐싱으로 해결, 응답 시간 340ms 달성.",
      },
      {
        id: "q2",
        question: "Q2 · 협업 중 의견 충돌 경험이 있나요?",
        aiScore: 5.0,
        transcript: "REST API 설계 방향 충돌 → 장단점 문서화 → 팀 합의 도출 → API 일관성 향상.",
      },
      {
        id: "q3",
        question: "Q3 · MSA 서비스 간 통신 방식을 설명해보세요.",
        aiScore: 2.0,
        transcript: "MSA는 서비스들이 독립적으로 운영되고 REST, 메시지 큐, gRPC 방법이 있는데 저는 주로 REST를 많이 써봤고...",
      },
    ],
  },
};

// ─── 세그먼트 색상 맵 ─────────────────────────────────────────────
const SEGMENT_STYLE = {
  S:   { bg: "#DBEAFE", color: "#1E40AF" },
  T:   { bg: "#D1FAE5", color: "#065F46" },
  A:   { bg: "#FEF3C7", color: "#92400E" },
  R:   { bg: "#FCE7F3", color: "#9D174D" },
  BAD: { bg: "transparent", color: "#E24B4A", underline: true },
};

// ─── 아바타 컴포넌트 ─────────────────────────────────────────────
function Avatar({ name, size = 36, bg = NAVY, fontSize = 12 }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: 700,
        fontSize,
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {initials}
    </div>
  );
}

// ─── Fit-Gap Bar ─────────────────────────────────────────────────
function FitBar({ label, pct }) {
  const color = pct >= 70 ? GREEN : pct >= 45 ? "#F59E0B" : "#E24B4A";
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: "#444" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ background: "#E8E5DF", borderRadius: 99, height: 6 }}>
        <div style={{ width: `${pct}%`, height: 6, borderRadius: 99, background: color }} />
      </div>
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
    <div style={{
      flex: 1, minHeight: 0, position: "relative",
      background: "#0A0A0A", overflow: "hidden",
      border: `2px solid ${isSpeaking ? GREEN : "transparent"}`,
      transition: "border-color 0.3s",
    }}>
      <video ref={ref} autoPlay playsInline style={{
        width: "100%", height: "100%", objectFit: "cover",
        transform: mirror ? "scaleX(-1)" : "none",
        display: camOff ? "none" : "block",
      }} />
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
            <div key={i} style={{
              width: 2, background: GREEN, borderRadius: 2, height: h,
              animation: `speakPulse 0.5s ease-in-out ${i * 0.08}s infinite`,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 공유 리포트 뷰 (좌측 패널) ─────────────────────────────────
function SharedReport({ report }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#EDEBE6",
        overflowY: "auto",
        padding: "24px",
        scrollBehavior: "smooth",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 14,
          padding: "28px 32px",
          maxWidth: 680,
          margin: "0 auto",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* 리포트 헤더 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 6 }}>
            {report.title}
          </h2>
          <p style={{ fontSize: 13, color: "#888" }}>
            {report.menteeName} 멘티 · {report.date}
          </p>
        </div>

        {/* 발화 효율성 */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: "#999", fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            발화 효율성 분석
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>종합 진단 점수</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#111" }}>
              {report.totalScore} / 100
            </span>
          </div>
          <div style={{ background: "#E8E5DF", borderRadius: 99, height: 8 }}>
            <div
              style={{
                width: `${report.totalScore}%`,
                height: 8,
                borderRadius: 99,
                background: "#111",
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>

        {/* 결정적 승부처 */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: "#999", fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            결정적 승부처
          </p>
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 10,
              padding: "14px 16px",
              marginBottom: 10,
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, color: GREEN, letterSpacing: 1, marginBottom: 6 }}>
              BEST MOMENT
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111", lineHeight: 1.6, marginBottom: 6 }}>
              "{report.bestMoment.quote}"
            </p>
            <p style={{ fontSize: 12, color: "#166534", lineHeight: 1.5 }}>
              {report.bestMoment.reason}
            </p>
          </div>
          <div
            style={{
              background: "#FFF5F5",
              border: "1px solid #FED7D7",
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, color: "#E24B4A", letterSpacing: 1, marginBottom: 6 }}>
              WORST MOMENT
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#111", lineHeight: 1.6, marginBottom: 6 }}>
              "{report.worstMoment.quote}"
            </p>
            <p style={{ fontSize: 12, color: "#9B1C1C", lineHeight: 1.5 }}>
              {report.worstMoment.reason}
            </p>
          </div>
        </div>

        {/* 지능형 스크립트 분석 */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: "#999", fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            지능형 스크립트 분석
          </p>
          <p style={{ fontSize: 14, lineHeight: 2 }}>
            {report.scriptSegments.map((seg, i) => {
              const style = SEGMENT_STYLE[seg.type] || {};
              return (
                <span
                  key={i}
                  style={{
                    background: style.bg || "transparent",
                    color: style.color || "#333",
                    borderRadius: style.bg && style.bg !== "transparent" ? 3 : 0,
                    padding: style.bg && style.bg !== "transparent" ? "1px 3px" : 0,
                    borderBottom: style.underline ? "2px solid #E24B4A" : "none",
                  }}
                >
                  {seg.text}
                </span>
              );
            })}
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#AAA",
              textAlign: "center",
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px dashed #E0DDD8",
            }}
          >
            아래로 스크롤하면 더 많은 결과를 확인할 수 있어요
          </p>
        </div>

        {/* Fit-Gap */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, color: "#999", fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
            핏-갭 (Fit-Gap) 역량 분석
          </p>
          {report.fitGap.map((item) => (
            <FitBar key={item.label} label={item.label} pct={item.pct} />
          ))}
        </div>

        {/* Q&A */}
        <div>
          <p style={{ fontSize: 11, color: "#999", fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
            Q&A 스크립트 요약
          </p>
          {report.qnas.map((qna) => {
            const scoreColor = qna.aiScore >= 4 ? GREEN : qna.aiScore >= 3 ? "#F59E0B" : "#E24B4A";
            return (
              <div
                key={qna.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #FAF8F4",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 6,
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{qna.question}</p>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: scoreColor,
                      whiteSpace: "nowrap",
                      background: `${scoreColor}15`,
                      padding: "2px 9px",
                      borderRadius: 99,
                    }}
                  >
                    AI {qna.aiScore.toFixed(1)}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
                  {qna.transcript}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────
export default function MentoringSessionPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams(); // /session/:sessionId
  const { user } = useAuthStore(); // { role: 'mentor' | 'mentee', name: '...' }

  const [session, setSession] = useState(MOCK_SESSION);
  const [elapsed, setElapsed] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isSharing, setIsSharing] = useState(true);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const timerRef = useRef(null);

  /* ── WebRTC refs ── */
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const videoProducerRef = useRef(null);
  const audioProducerRef = useRef(null);
  const consumersRef = useRef(new Map());
  const audioCtxRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const peerAnalysersRef = useRef({});
  const peersRef = useRef({});

  const [peerIds, setPeerIds] = useState([]);
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [audioLevels, setAudioLevels] = useState({});
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  /* ── 드로잉(형광펜) ── */
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState("highlight"); // highlight | pen | eraser
  const [drawColor, setDrawColor] = useState("#FFD700");
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

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
    lastPosRef.current = getPos(e, canvasRef.current);
  };

  const draw = (e) => {
    if (!drawMode || !isDrawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (drawTool === "highlight") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawColor + "55";
      ctx.lineWidth = 22;
    } else if (drawTool === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 3;
    } else {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 32;
    }
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const stopDraw = () => { isDrawingRef.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };

  const initCanvas = useCallback((node) => {
    if (!node) return;
    canvasRef.current = node;
    const parent = node.parentElement;
    node.width = parent.clientWidth;
    node.height = parent.clientHeight;
  }, []);

  // 세션 리포트 조회
  useEffect(() => {
    getSessionReport(sessionId)
      .then(data => setSession(prev => ({ ...prev, ...data })))
      .catch(() => {});
  }, [sessionId]);

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
      const videoConstraint = preferredCameraId ? { deviceId: { exact: preferredCameraId } } : true;
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: true });
      } catch {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          localStream = new MediaStream();
        }
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

      socket = io(MEDIA_SERVER, { withCredentials: true });
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
            socket.emit("connectTransport", { transportId: sendTransport.id, dtlsParameters }, (r) => { r.error ? errback(new Error(r.error)) : cb(); });
          });
          sendTransport.on("produce", ({ kind, rtpParameters }, cb, errback) => {
            socket.emit("produce", { transportId: sendTransport.id, kind, rtpParameters }, (r) => { r.error ? errback(new Error(r.error)) : cb({ id: r.producerId }); });
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
            socket.emit("connectTransport", { transportId: recvTransport.id, dtlsParameters }, (r) => { r.error ? errback(new Error(r.error)) : cb(); });
          });
          for (const { producerId, peerId, kind } of existingProducers) {
            if (isCancelled) return;
            await consumeProducer(producerId, peerId, kind);
          }
        });
      });

      socket.on("newProducer", ({ producerId, peerId, kind }) => { if (!isCancelled) consumeProducer(producerId, peerId, kind); });
      socket.on("peerLeft", ({ peerId }) => {
        delete peersRef.current[peerId];
        delete peerAnalysersRef.current[peerId];
        setPeerIds(prev => prev.filter(p => p !== peerId));
      });
    };

    init();
    return () => {
      isCancelled = true;
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

  /* ── 오디오 레벨 폴링 ── */
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

  // 세션 타이머
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

  // 세션 종료 처리
  const handleEndSession = useCallback(() => {
    clearInterval(timerRef.current);

    // ── API 연동 포인트 ────────────────────────────────────────────
    // await api.endSession(session.sessionId);
    // WebRTC 연결 해제: peerConnection.close();
    // ──────────────────────────────────────────────────────────────

    if (user?.role === "mentor") {
      navigate(`/mentor/feedback/${session.sessionId}`);
    } else {
      // 멘티: 리포트 대기 화면 또는 마이페이지
      navigate(`/report/ai-stream/${session.sessionId}`);
    }
  }, [navigate, session.sessionId, user?.role]);

  const isMentor = user?.role === "mentor";

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
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
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Noto Sans KR', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ══════════════════════════════════════════════════════════
          상단 헤더
      ══════════════════════════════════════════════════════════ */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #E8E0D0",
          padding: "0 28px",
          height: 72,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* 비디오 아이콘 */}
        <div
          style={{
            width: 44,
            height: 44,
            background: "#0D2240",
            borderRadius: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="22" height="16" viewBox="0 0 22 16" fill="white">
            <rect x="0" y="2" width="14" height="12" rx="2" />
            <path d="M15 5.5l7-3.5v12l-7-3.5V5.5z" />
          </svg>
        </div>

        {/* 세션 정보 */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{session.title}</p>
          <p style={{ fontSize: 12, color: "#888" }}>
            {session.date} | {session.time} KST
          </p>
        </div>

        {/* 참여자 아바타 */}
        <div style={{ display: "flex", gap: -6 }}>
          <Avatar name={session.mentor.name} size={36} bg={NAVY} />
          <Avatar name={session.mentee.name} size={36} bg="#3A6A5A" />
        </div>

        {/* 참여자 정보 카드 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "white",
            border: "1px solid #E0DDD8",
            borderRadius: 12,
            padding: "10px 16px",
          }}
        >
          <Avatar name={session.mentor.name} size={36} bg={NAVY} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>
              {session.mentor.name}
            </p>
            <p style={{ fontSize: 11, color: "#888" }}>{session.mentor.role}</p>
          </div>
          {/* 더보기 버튼 */}
          <button
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#999",
              padding: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#999">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </div>

        {/* 타이머 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#111",
            borderRadius: 8,
            padding: "6px 14px",
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#E24B4A",
              animation: "blink 1.2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(elapsed)}
          </span>
        </div>

      </header>

      {/* ══════════════════════════════════════════════════════════
          메인 콘텐츠 (공유 리포트 + 비디오 패널)
      ══════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 좌측: 공유 리포트 + 드로잉 레이어 */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <div style={{ width: "100%", height: "100%", overflowY: "auto" }}>
            <SharedReport report={session.report} />
          </div>

          {/* 캔버스 오버레이 */}
          <canvas
            ref={initCanvas}
            style={{
              position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
              pointerEvents: drawMode ? "auto" : "none",
              cursor: drawMode ? (drawTool === "eraser" ? "cell" : "crosshair") : "default",
              touchAction: "none",
            }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
          />

          {/* 드로잉 툴바 */}
          {drawMode && (
            <div style={{
              position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
              background: "#fff", borderRadius: 14, padding: "8px 14px",
              display: "flex", alignItems: "center", gap: 10,
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)", zIndex: 10,
              border: "1px solid #E8E0D0",
            }}>
              {/* 형광펜 색상 */}
              {[["#FFD700","노랑"],["#FF6B6B","빨강"],["#51CF66","초록"],["#74C0FC","파랑"],["#F783AC","분홍"]].map(([c, name]) => (
                <button key={c} title={name} onClick={() => { setDrawColor(c); setDrawTool("highlight"); }} style={{
                  width: 22, height: 22, borderRadius: "50%", border: (drawColor === c && drawTool === "highlight") ? "3px solid #0D2240" : "2px solid #ddd",
                  background: c + "99", cursor: "pointer", padding: 0, transition: "transform 0.1s",
                }} />
              ))}

              <div style={{ width: 1, height: 20, background: "#E0DDD8" }} />

              {/* 펜 */}
              <button title="펜" onClick={() => setDrawTool("pen")} style={{
                width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
                background: drawTool === "pen" ? "#0D2240" : "rgba(0,0,0,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={drawTool === "pen" ? "#fff" : "#555"} strokeWidth="2" strokeLinecap="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
              </button>

              {/* 지우개 */}
              <button title="지우개" onClick={() => setDrawTool("eraser")} style={{
                width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
                background: drawTool === "eraser" ? "#0D2240" : "rgba(0,0,0,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={drawTool === "eraser" ? "#fff" : "#555"} strokeWidth="2" strokeLinecap="round">
                  <path d="M20 20H7L3 16l10-10 7 7-1.5 1.5"/><path d="M6 14l4 4"/>
                </svg>
              </button>

              {/* 전체 지우기 */}
              <button title="전체 지우기" onClick={clearCanvas} style={{
                width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
                background: "rgba(0,0,0,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* 우측: 비디오 + 공유 안내 */}
        <div
          style={{
            width: 220,
            background: "#111",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            borderLeft: "1px solid #222",
          }}
        >
          {/* 멘토 비디오 */}
          <VideoTile
            stream={isMentor ? localMediaStream : (peersRef.current[peerIds[0]] ?? null)}
            label={`${session.mentor.name} (멘토)`}
            mirror={isMentor} muted={isMentor}
            isSpeaking={(audioLevels[isMentor ? '__local' : peerIds[0]] || 0) > 0.025}
            camOff={isMentor && !isCamOn}
          />
          <div style={{ height: 1, background: "#222", flexShrink: 0 }} />
          {/* 멘티 비디오 */}
          <VideoTile
            stream={!isMentor ? localMediaStream : (peersRef.current[peerIds[0]] ?? null)}
            label={`${session.mentee.name} (멘티)`}
            mirror={!isMentor} muted={!isMentor}
            isSpeaking={(audioLevels[!isMentor ? '__local' : peerIds[0]] || 0) > 0.025}
            camOff={!isMentor && !isCamOn}
          />

          {/* 화면 공유 안내 */}
          <div
            style={{
              background: "#0D2240",
              padding: "14px 14px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <polyline points="8 21 12 17 16 21" />
              </svg>
              <span style={{ color: "#1D9E75", fontSize: 11, fontWeight: 700 }}>
                스크린 공유 중
              </span>
            </div>
            <p style={{ color: "#888", fontSize: 11, lineHeight: 1.6 }}>
              멘토가 리포트를 스크롤하면 멘티 화면도 동기화됩니다. 특정 구간 클릭 시 피드백을 나누세요.
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          하단 컨트롤 바
      ══════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: "#0D2240",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: "0 28px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        {/* 좌측: 미디어 컨트롤 */}
        <div style={{ display: "flex", gap: 8 }}>
          {/* 마이크 */}
          <ControlButton
            active={isMicOn}
            onClick={handleMicToggle}
            label={isMicOn ? "마이크 끄기" : "마이크 켜기"}
          >
            {isMicOn ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            )}
          </ControlButton>

          {/* 카메라 */}
          <ControlButton
            active={isCamOn}
            onClick={handleCamToggle}
            label={isCamOn ? "카메라 끄기" : "카메라 켜기"}
          >
            {isCamOn ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
          </ControlButton>

          {/* 형광펜 토글 */}
          <ControlButton
            active={drawMode}
            onClick={() => setDrawMode(v => !v)}
            label={drawMode ? "그리기 끄기" : "형광펜"}
            activeColor="#F59E0B"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </ControlButton>

          {/* 화면 공유 토글 (멘토 전용) */}
          {isMentor && (
            <ControlButton
              active={isSharing}
              onClick={() => setIsSharing((v) => !v)}
              label={isSharing ? "공유 중지" : "화면 공유"}
              activeColor="#1D9E75"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <polyline points="8 21 12 17 16 21" />
              </svg>
            </ControlButton>
          )}
        </div>

        {/* 중앙: 세션 정보 */}
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
          {session.title} · {session.mentee.name} 멘티
        </p>

        {/* 우측: 세션 종료 */}
        <button
          onClick={() => setShowEndConfirm(true)}
          style={{
            padding: "9px 22px",
            borderRadius: 9,
            border: "none",
            background: "#E24B4A",
            color: "white",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.target.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.target.style.opacity = "1")}
        >
          {isMentor ? "세션 종료 → 코멘트 작성" : "세션 나가기"}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          세션 종료 확인 모달 (position:fixed 대신 overlay div 사용)
      ══════════════════════════════════════════════════════════ */}
      {showEndConfirm && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: "32px 36px",
              width: 380,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "#FFF5F5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 9.88a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.32 8.91" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111", marginBottom: 8 }}>
              세션을 종료하시겠어요?
            </h3>
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, marginBottom: 24 }}>
              {isMentor
                ? "세션 종료 후 멘토 코멘트 작성 페이지로 이동합니다.\n코멘트 작성 후 최종 리포트가 멘티에게 자동 전달됩니다."
                : "세션을 나가면 멘토가 최종 코멘트를 작성한 후 리포트가 전달됩니다."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "1px solid #D1D5DB",
                  background: "white",
                  color: "#555",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                취소
              </button>
              <button
                onClick={handleEndSession}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: "none",
                  background: "#E24B4A",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {isMentor ? "종료 후 코멘트 작성" : "나가기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ─── 컨트롤 버튼 (미디어 컨트롤용) ─────────────────────────────
function ControlButton({ children, active, onClick, label, activeColor = GREEN }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "6px 12px",
        borderRadius: 8,
        border: "none",
        background: active ? `${activeColor}22` : "rgba(255,255,255,0.06)",
        color: active ? activeColor : "#888",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
      <span style={{ fontSize: 10 }}>{label}</span>
    </button>
  );
}
