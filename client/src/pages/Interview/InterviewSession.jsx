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
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 28, flex: 1 }}>
      {bars.map((_, i) => {
        const shape = (Math.sin(i * 0.85) + 1) / 2;
        const height = 5 + Math.round((8 + shape * 18) * normalized);
        return (
          <span key={i} style={{
            width: 3,
            height,
            borderRadius: 999,
            background: "#1D9E75",
            opacity: 0.38 + normalized * 0.62,
            transition: "height 0.18s ease, opacity 0.18s ease",
          }} />
        );
      })}
    </div>
  );
}

function RecordingTimerText({ time }) {
  return (
    <span style={{
      color: "rgba(255,255,255,0.78)",
      fontSize: 13,
      fontWeight: 800,
      fontFamily: "monospace",
      fontVariantNumeric: "tabular-nums",
      letterSpacing: 0,
      whiteSpace: "nowrap",
    }}>{time}</span>
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
    <div style={{
      position: "relative", width: "100%", height: "100%",
      background: "#0f172a", borderRadius: 12, overflow: "hidden",
      border: `2px solid ${isSpeaking ? "#1D9E75" : "rgba(255,255,255,0.1)"}`,
      transition: "border-color 0.3s",
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
            width: 56, height: 56, borderRadius: "50%", background: "#1B4F7A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, color: "#fff", fontWeight: 700,
            opacity: micOff ? 0.6 : 1, transition: "opacity 0.2s",
          }}>
            {(label || "?")[0]}
          </div>
        </div>
      )}
      {label && (
        <div style={{
          position: "absolute", bottom: 8, left: 8,
          background: "rgba(0,0,0,0.6)", borderRadius: 6, padding: "3px 10px",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          {micOff && (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="5" y="1" width="6" height="9" rx="3" stroke="#EF4444" strokeWidth="1.5"/>
              <path d="M3 7c0 2.76 2.24 5 5 5s5-2.24 5-5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="1" y1="1" x2="15" y2="15" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )}
          <span style={{ fontSize: 11, color: micOff ? "rgba(255,255,255,0.55)" : "#fff", fontWeight: 500 }}>{label}</span>
        </div>
      )}
      {/* 음소거 상태 배지 (우하단) */}
      {micOff && (
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          background: "#EF4444", borderRadius: "50%",
          width: 22, height: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.4)",
        }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="1" width="6" height="9" rx="3" stroke="#fff" strokeWidth="1.5"/>
            <line x1="1" y1="1" x2="15" y2="15" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
      {isSpeaking && !micOff && (
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "flex-end", gap: 2 }}>
          {[4, 8, 6, 10, 5].map((h, i) => (
            <div key={i} style={{
              width: 3, background: "#1D9E75", borderRadius: 2, height: h,
              animation: `speakPulse 0.5s ease-in-out ${i * 0.08}s infinite`,
            }} />
          ))}
        </div>
      )}
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
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => {
    const t = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const formatTime = (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  /* ── 컨트롤 상태 ── */
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [ending, setEnding] = useState(false);
  const [questionRecordStatus, setQuestionRecordStatus] = useState("idle");
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [recommendationsOpen, setRecommendationsOpen] = useState(true);
  const [spokenQuestions, setSpokenQuestions] = useState([]);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState([]);
  const questionRecorderRef = useRef(null);
  const questionAudioChunksRef = useRef([]);
  const questionCancelRef = useRef(false);
  const questionStartRef = useRef(null);

  /* ── 멘티 전용: 답변 상태 + 오디오 녹음 ── */
  const [answerStatus, setAnswerStatus] = useState("idle");
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
        if (!isMentor) {
          const nextQuestion = findNextSpokenQuestion(spoken, answeredQuestionIds);
          setActiveQuestion(prev => (
            prev?.id === nextQuestion?.id ? prev : nextQuestion
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
            audioProducerRef.current?.pause();
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
        localStream.getAudioTracks().forEach(t => { t.enabled = false; });
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
    await new Promise(r => setTimeout(r, 800));
    navigate(`/report/ai/${id}`, { state: { role: "mentor" } });
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
      setMicOn(true);
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });
      audioProducerRef.current?.resume();
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
        alert(describeRecordingError(error));
      }
    } else if (nextStatus === "done" && mediaRecorderRef.current?.state !== "inactive") {
      setAnswerStatus(nextStatus);
      setMicOn(false);
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      audioProducerRef.current?.pause();
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
          }
        } catch {
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
      setMicOn(false);
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      audioProducerRef.current?.pause();
      questionRecorderRef.current.onstop = async () => {
        questionRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
        questionRecorderRef.current = null;
        if (questionCancelRef.current) {
          questionAudioChunksRef.current = [];
          questionCancelRef.current = false;
          questionStartRef.current = null;
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
          questionCancelRef.current = false;
          questionStartRef.current = null;
          releaseRecordingLock();
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
      setMicOn(true);
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true; });
      audioProducerRef.current?.resume();
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
    setQuestionRecordStatus("idle");
    setMicOn(false);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
    audioProducerRef.current?.pause();

    const recorder = questionRecorderRef.current;
    const cleanupCancelledQuestion = () => {
      recorder?.stream?.getTracks().forEach(t => t.stop());
      questionAudioChunksRef.current = [];
      questionCancelRef.current = false;
      questionStartRef.current = null;
      questionRecorderRef.current = null;
      releaseRecordingLock();
      setQuestionRecordStatus("idle");
    };

    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = cleanupCancelledQuestion;
      recorder.stop();
      return;
    }

    cleanupCancelledQuestion();
  };

  const SPEAK_THRESHOLD = 0.025;
  // 참가자가 1명이라도 있으면 발화자 메인 뷰 활성화
  const mainViewId = peerIds.length > 0 ? (activeSpeakerId || peerIds[0]) : null;
  const recordingLockedByOther = Boolean(activeRecorder?.peerId && activeRecorder.peerId !== localPeerId);
  const staleQuestionLock = Boolean(activeQuestion?.id && activeRecorder?.recordingType === "QUESTION");
  const answerBlockedByRecorder = recordingLockedByOther && !staleQuestionLock;
  const waitingForAnswer = isMentor && Boolean(activeQuestion?.id) && questionRecordStatus !== "recording";
  const answerButtonDisabled = (!activeQuestion && answerStatus !== "answering") || (answerBlockedByRecorder && answerStatus !== "answering");
  const questionButtonDisabled = questionRecordStatus === "uploading" || waitingForAnswer || (recordingLockedByOther && questionRecordStatus !== "recording");
  const questionTimerStart = isMentor && questionRecordStatus === "recording"
    ? (activeRecorder?.recordingType === "QUESTION" ? activeRecorder.startedAt : questionStartRef.current)
    : null;
  const questionElapsed = questionTimerStart
    ? Math.max(0, Math.floor((clockNow - new Date(questionTimerStart).getTime()) / 1000))
    : 0;
  const answerTimerStart = !isMentor && answerStatus === "answering" ? answerStartRef.current : null;
  const answerElapsed = answerTimerStart
    ? Math.max(0, Math.floor((clockNow - new Date(answerTimerStart).getTime()) / 1000))
    : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;margin:0}
        #root{height:100%;overflow:hidden;min-height:0;width:100%;max-width:100%;margin:0;display:block;text-align:left}
        body{font-family:'Noto Sans KR',sans-serif;background:#0a1628;color:#fff}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes speakPulse{0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px}
        .ctrl-btn:hover{background:rgba(255,255,255,0.25)!important}
        .ctrl-btn-off:hover{background:rgba(239,68,68,0.85)!important}
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0a1628" }}>

        {/* ════ 재접속 / 연결 실패 배너 ════ */}
        {(connectionState === "reconnecting" || connectionState === "failed") && (
          <div style={{
            position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, width: "min(480px, calc(100vw - 32px))",
          }}>
            <div style={{
              background: "rgba(13,34,64,0.96)", borderRadius: 12, padding: "14px 18px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              {connectionState === "reconnecting" ? (
                <>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.15)", borderTopColor: "#1D9E75", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>미디어 서버 재연결 중</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>연결을 복구하고 있습니다. 녹음은 계속 진행됩니다.</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(239,68,68,0.2)", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>!</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", marginBottom: 2 }}>미디어 서버 연결 실패</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>상대 화면이 보이지 않을 수 있습니다.</p>
                  </div>
                  <button onClick={() => window.location.reload()} style={{ padding: "7px 14px", background: "#1D9E75", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    새로고침
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ════ 상단 헤더 ════ */}
        <div style={{
          background: "#0D2240", padding: "0 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 60, flexShrink: 0,
        }}>
          {/* 로고 + 상태 */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="4" width="11" height="9" rx="1.5" fill="white"/>
                  <path d="M12 7.5l5-2.5v8l-5-2.5V7.5z" fill="white"/>
                </svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>Scene<span style={{ color: "#1D9E75" }}>A</span></span>
            </div>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.15)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", animation: recording ? "pulse 1.2s ease-in-out infinite" : "none" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{formatTime(elapsed)}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>면접 진행 중</span>
            </div>
            {mediaError && <span style={{ fontSize: 11, color: "#EF4444" }}>{mediaError}</span>}
          </div>

          {/* 참가자 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#1B4F7A", border: "2px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>나</div>
            {peerIds.slice(0, 3).map((pid, i) => (
              <div key={pid} style={{ width: 30, height: 30, borderRadius: "50%", background: ["#533BA0","#0F6E56","#8B4513"][i], border: "2px solid rgba(255,255,255,0.2)", marginLeft: -6, zIndex: 3-i, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{i+1}</div>
            ))}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: 6 }}>참여자 {peerIds.length + 1}명</span>
          </div>

          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>세션 #{id}</div>
        </div>

        {/* ════ 본문 ════ */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── 메인 비디오 영역 ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* 비디오 그리드 */}
            <div style={{ flex: 1, overflow: "hidden", background: "#080f1e", position: "relative" }}>
              {peerIds.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%", height: "100%", padding: 20 }}>
                  <div style={{ width: "min(640px, 100%)", height: "min(480px, 100%)" }}>
                    <VideoTile stream={localMediaStream} label="나 (본인)" mirror muted
                      isSpeaking={(audioLevels['__local'] || 0) > SPEAK_THRESHOLD} camOff={!camOn} micOff={!micOn} />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "14px 14px 8px" }}>
                  <div style={{ flex: 1, minHeight: 0, marginBottom: 8 }}>
                    {mainViewId === '__local' ? (
                      <VideoTile stream={localMediaStream} label="나 (본인)" mirror muted isSpeaking camOff={!camOn} micOff={!micOn} />
                    ) : (
                      <VideoTile stream={peersRef.current[mainViewId]} label="상대방" isSpeaking={(audioLevels[mainViewId] || 0) > SPEAK_THRESHOLD} />
                    )}
                  </div>
                  <div style={{ height: 110, display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }}>
                    <div style={{ width: 150, flexShrink: 0, height: "100%", position: "relative" }}>
                      <VideoTile stream={localMediaStream} label="나" mirror muted isSpeaking={(audioLevels['__local'] || 0) > SPEAK_THRESHOLD} camOff={!camOn} micOff={!micOn} />
                      {mainViewId === '__local' && <div style={{ position: "absolute", top: 5, left: 5, zIndex: 2, background: "#1D9E75", borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#fff" }}>발화 중</div>}
                    </div>
                    {peerIds.map(peerId => (
                      <div key={peerId} style={{ width: 150, flexShrink: 0, height: "100%", position: "relative" }}>
                        <VideoTile stream={peersRef.current[peerId]} label="참여자" isSpeaking={(audioLevels[peerId] || 0) > SPEAK_THRESHOLD} />
                        {mainViewId === peerId && <div style={{ position: "absolute", top: 5, left: 5, zIndex: 2, background: "#1D9E75", borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#fff" }}>발화 중</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── 하단 컨트롤 바 ── */}
            <div style={{
              background: "#0D2240", padding: "10px 24px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 12, flexShrink: 0,
            }}>
              {/* 미디어 컨트롤 */}
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { icon: <CamIcon on={camOn} />, label: camOn ? "카메라" : "카메라 끔", active: camOn, click: handleCamToggle },
                ].map((btn, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <button className={btn.active ? "ctrl-btn" : "ctrl-btn-off"} onClick={btn.click} style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: !btn.active ? "#EF4444" : "rgba(255,255,255,0.12)",
                      border: `1.5px solid ${!btn.active ? "#EF4444" : "rgba(255,255,255,0.2)"}`,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s",
                    }}>{btn.icon}</button>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em" }}>{btn.label}</span>
                  </div>
                ))}
              </div>

              {/* 멘티 전용: 현재 질문 + 답변 버튼 */}
              {!isMentor && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, justifyContent: "center" }}>
                  <div style={{
                    maxWidth: 300, padding: "8px 14px", borderRadius: 8,
                    background: activeQuestion ? "rgba(29,158,117,0.15)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${activeQuestion ? "rgba(29,158,117,0.4)" : "rgba(255,255,255,0.1)"}`,
                    fontSize: 12, fontWeight: 600,
                    color: activeQuestion ? "#6ee7c5" : "rgba(255,255,255,0.4)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {activeQuestion ? `Q. ${activeQuestion.content}` : "멘토 질문 대기 중..."}
                  </div>
                  {answerTimerStart && <RecordingTimerText time={formatTime(answerElapsed)} />}
                  <button
                    onClick={() => handleAnswerStatus(answerStatus === "answering" ? "done" : "answering")}
                    disabled={answerButtonDisabled}
                    style={{
                      padding: "10px 22px", borderRadius: 22,
                      background: answerStatus === "answering" ? "#1D9E75" : activeQuestion ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                      color: answerStatus === "answering" ? "#fff" : activeQuestion ? "#fff" : "rgba(255,255,255,0.35)",
                      border: `1.5px solid ${answerStatus === "answering" ? "#1D9E75" : activeQuestion ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
                      fontSize: 13, fontWeight: 700, cursor: answerButtonDisabled ? "not-allowed" : "pointer",
                      fontFamily: "inherit", transition: "all 0.18s", flexShrink: 0,
                    }}
                  >
                    {answerStatus === "answering" ? "● 답변 완료" : "답변 시작"}
                  </button>
                </div>
              )}

              {/* 멘토 전용: 중앙 공간 */}
              {isMentor && <div style={{ flex: 1 }} />}

              {/* 종료 */}
              {isMentor ? (
                <button onClick={handleEndCall} disabled={ending} style={{
                  padding: "10px 22px", borderRadius: 22,
                  background: ending ? "rgba(255,255,255,0.1)" : "#EF4444",
                  color: "#fff", border: "none",
                  fontSize: 13, fontWeight: 700, cursor: ending ? "not-allowed" : "pointer",
                  fontFamily: "inherit", transition: "background 0.18s", flexShrink: 0,
                }}
                  onMouseEnter={e => { if (!ending) e.currentTarget.style.background = "#DC2626"; }}
                  onMouseLeave={e => { if (!ending) e.currentTarget.style.background = "#EF4444"; }}
                >
                  {ending ? "종료 중..." : "면접 종료"}
                </button>
              ) : (
                <div style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                  {ending ? "리포트로 이동 중..." : "멘토가 종료하면 자동 이동"}
                </div>
              )}
            </div>
          </div>

          {/* ════ 멘토 전용: 우측 질문 패널 ════ */}
          {isMentor && (
            <div style={{
              width: 300, flexShrink: 0,
              background: "#0D2240", borderLeft: "1px solid rgba(255,255,255,0.08)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}>
              {/* 패널 헤더 */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>질문 패널</p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>질문을 말하고 저장하세요</p>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 18 }}>

                {/* 질문 녹음 */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#1D9E75", textTransform: "uppercase", marginBottom: 10 }}>질문 녹음</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={handleQuestionRecordToggle} disabled={questionButtonDisabled} style={{
                      flex: 1, padding: "12px 14px", borderRadius: 10, border: "none",
                      background: questionRecordStatus === "recording" ? "#1D9E75" : questionRecordStatus === "uploading" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.12)",
                      color: "#fff", fontSize: 13, fontWeight: 700,
                      cursor: questionButtonDisabled ? "not-allowed" : "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.18s",
                    }}>
                      {questionRecordStatus === "recording" && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 0.8s ease-in-out infinite", flexShrink: 0 }} />
                      )}
                      {questionRecordStatus === "recording" ? "질문 완료" : questionRecordStatus === "uploading" ? "저장 중..." : "질문 시작"}
                    </button>
                    {questionRecordStatus === "recording" && (
                      <button type="button" onClick={handleQuestionCancel} style={{
                        padding: "0 12px", borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.45)", background: "rgba(239,68,68,0.12)",
                        color: "#FCA5A5", fontSize: 12, fontWeight: 800,
                        cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                      }}>
                        취소
                      </button>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginTop: 8 }}>
                    {waitingForAnswer ? "멘티 답변을 기다리는 중..." : recordingLockedByOther ? "다른 참여자가 말하는 중..." : "멘토의 질문 오디오가 STT로 변환되어 저장됩니다."}
                  </p>
                  {questionTimerStart && (
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                      <RecordingTimerText time={formatTime(questionElapsed)} />
                    </div>
                  )}
                  {questionRecordStatus === "recording" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} />
                      <RecordingWave level={audioLevels['__local'] || 0} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#1D9E75", flexShrink: 0 }}>녹음 중</span>
                    </div>
                  )}
                  {activeQuestion && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(29,158,117,0.12)", border: "1px solid rgba(29,158,117,0.3)" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#1D9E75", marginBottom: 4 }}>현재 답변 대상</p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{activeQuestion.content}</p>
                    </div>
                  )}
                </div>

                {/* AI 추천 질문 */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#F59E0B", textTransform: "uppercase" }}>AI 추천 질문</p>
                    <button type="button" onClick={() => setRecommendationsOpen(v => !v)} style={{
                      border: "1px solid rgba(245,158,11,0.3)", background: recommendationsOpen ? "rgba(245,158,11,0.12)" : "transparent",
                      color: "#F59E0B", borderRadius: 99, padding: "3px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {recommendationsOpen ? "접기" : "보기"}
                    </button>
                  </div>
                  {recommendationsOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {questions.length > 0 ? questions.map((q, i) => (
                        <div key={q.id ?? i} style={{
                          background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px",
                          border: "1px solid rgba(255,255,255,0.08)", borderLeft: "2px solid #F59E0B",
                          cursor: "default", transition: "background 0.15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(245,158,11,0.08)"}
                          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        >
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#F59E0B", display: "block", marginBottom: 4, letterSpacing: "0.05em" }}>추천 {i + 1}</span>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.65 }}>{q.content}</p>
                        </div>
                      )) : (
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
                          준비 화면에서 생성한 AI 추천 질문이 여기에 표시됩니다.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 실제 질문 기록 */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: 10 }}>질문 기록</p>
                  {spokenQuestions.length > 0 ? spokenQuestions.map((q, i) => (
                    <div key={q.id ?? i} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", display: "block", marginBottom: 4, letterSpacing: "0.05em" }}>Q{i + 1}</span>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>{q.content}</p>
                    </div>
                  )) : (
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
                      질문 완료 시 여기에 기록됩니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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
