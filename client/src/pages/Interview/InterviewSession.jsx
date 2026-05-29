import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import { updateSessionStatus, updateParticipantStatus, uploadAnswerAudio, getQuestions } from "../../api/sessions";
import { getAuthUser } from "../../store/authStore";

const MEDIA_SERVER = import.meta.env.VITE_MEDIA_SERVER_URL || undefined;

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
  const [checkedQs, setCheckedQs] = useState([]);
  const [chatMsg, setChatMsg] = useState("");
  const [chatHistory, setChatHistory] = useState([]);

  /* ── 멘티 전용: 답변 상태 + 오디오 녹음 ── */
  const [answerStatus, setAnswerStatus] = useState("idle");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const answerStartRef = useRef(null);

  /* ── 질문 목록 ── */
  const [questions, setQuestions] = useState([]);
  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) return;
    getQuestions(id).then(data => {
      if (Array.isArray(data)) setQuestions(data);
    }).catch(() => {});
  }, [id]);

  /* ── WebRTC refs ── */
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const videoProducerRef = useRef(null);
  const audioProducerRef = useRef(null);
  const consumersRef = useRef(new Map());

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

  const isMentor = role === "mentor";

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

        const { rtpCapabilities, existingProducers } = res;

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
        const videoConstraint = preferredCameraId ? { deviceId: { exact: preferredCameraId } } : true;
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: true });
        } catch {
          try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMediaError("카메라를 사용할 수 없습니다. 마이크만 연결됩니다.");
          } catch {
            setMediaError("카메라/마이크에 접근할 수 없습니다.");
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
      }

      /* 2. 소켓 연결 (reconnection 활성화) */
      socket = io(MEDIA_SERVER, {
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
    if (!window.confirm("면접을 종료하시겠습니까?")) return;
    setEnding(true);
    try {
      if (isMentor) await updateSessionStatus(id, "completed");
    } catch {}
    await new Promise(r => setTimeout(r, 800));
    if (isMentor) {
      navigate(`/report/ai/${id}`, { state: { role: "mentor" } });
    } else {
      navigate(`/report/generating/${id}`);
    }
  };

  /* ── 답변 상태 / 녹음 ── */
  const handleAnswerStatus = async (nextStatus) => {
    setAnswerStatus(nextStatus);
    try {
      const user = getAuthUser();
      if (user?.id) await updateParticipantStatus(id, user.id, nextStatus);
    } catch {}

    if (nextStatus === "answering") {
      answerStartRef.current = new Date().toISOString();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorderRef.current = recorder;
        recorder.start();
      } catch {}
    } else if (nextStatus === "done" && mediaRecorderRef.current?.state !== "inactive") {
      const answerEnd = new Date().toISOString();
      const user = getAuthUser();
      const questionId = questions[currentQuestionIdx]?.id;
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (questionId) {
          uploadAnswerAudio(id, questionId, blob, {
            answerStart: answerStartRef.current,
            answerEnd,
            menteeId: user?.id,
          }).catch(() => {});
        }
        mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.stop();
      setCurrentQuestionIdx(prev => prev + 1);
    }
  };

  const sendChat = () => {
    if (!chatMsg.trim()) return;
    setChatHistory(prev => [...prev, { me: true, text: chatMsg }]);
    setChatMsg("");
  };

  const toggleCheck = (i) => {
    setCheckedQs(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const SPEAK_THRESHOLD = 0.025;
  // 참가자가 1명이라도 있으면 발화자 메인 뷰 활성화
  const mainViewId = peerIds.length > 0 ? (activeSpeakerId || peerIds[0]) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;margin:0}
        #root{height:100%;overflow:hidden;min-height:0;width:100%;max-width:100%;margin:0;display:block;text-align:left}
        body{font-family:'Noto Sans KR',sans-serif;background:#f5f5f5;color:#111}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes speakPulse{0%,100%{transform:scaleY(0.4)}50%{transform:scaleY(1)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px}
        .ctrl-btn:hover{background:rgba(13,34,64,0.85)!important}
        .ctrl-btn-off:hover{background:rgba(239,68,68,0.85)!important}
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#FAF8F4" }}>

        {/* ════ 재접속 / 연결 실패 배너 ════ */}
        {(connectionState === "reconnecting" || connectionState === "failed") && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.65)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "36px 48px",
              textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
            }}>
              {connectionState === "reconnecting" ? (
                <>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    border: "4px solid #E8E0D0", borderTopColor: "#1D9E75",
                    animation: "spin 0.9s linear infinite", margin: "0 auto 20px",
                  }} />
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#1A1818", marginBottom: 6 }}>재연결 중...</p>
                  <p style={{ fontSize: 13, color: "#9E9B95" }}>잠시만 기다려 주세요.</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#EF4444", marginBottom: 6 }}>연결에 실패했습니다</p>
                  <p style={{ fontSize: 13, color: "#9E9B95", marginBottom: 20 }}>네트워크를 확인하고 다시 시도해 주세요.</p>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      padding: "10px 28px", background: "#0D2240", color: "#fff",
                      border: "none", borderRadius: 24, fontSize: 14, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
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
        <div style={{
          background: "#fff", padding: "0 20px",
          borderBottom: "1px solid #E8E0D0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 64, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0D2240", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="4" width="11" height="9" rx="1.5" fill="white"/>
                <path d="M12 7.5l5-2.5v8l-5-2.5V7.5z" fill="white"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1A1818" }}>면접 진행 중</p>
              <p style={{ fontSize: 11, color: "#9E9B95" }}>
                {mediaError ? <span style={{ color: "#EF4444" }}>{mediaError}</span> : "실시간 면접 세션"}
              </p>
            </div>
          </div>

          {/* 참가자 수 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "#1B4F7A", border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
            }}>나</div>
            {peerIds.slice(0, 3).map((pid, i) => (
              <div key={pid} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: ["#533BA0", "#0F6E56", "#8B4513"][i],
                border: "2px solid #fff", marginLeft: -8, zIndex: 3 - i,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "#fff",
              }}>{i + 1}</div>
            ))}
            {peerIds.length > 3 && (
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#e5e7eb", border: "2px solid #fff", marginLeft: -8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "#6b7280",
              }}>+{peerIds.length - 3}</div>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#9E9B95" }}>
            세션 #{id} · 참여자 {peerIds.length + 1}명
          </div>
        </div>

        {/* ════ 본문 영역 ════ */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── 메인 비디오 영역 ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* ── 비디오 그리드 ── */}
            <div style={{ flex: 1, overflow: "hidden", background: "#111827", position: "relative" }}>
              {/* 타이머 */}
              <div style={{
                position: "absolute", top: 16, left: 16, zIndex: 10,
                background: "rgba(0,0,0,0.55)", borderRadius: 20,
                padding: "5px 12px", display: "flex", alignItems: "center", gap: 7,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", animation: recording ? "pulse 1.2s ease-in-out infinite" : "none" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{formatTime(elapsed)}</span>
              </div>

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
                      {mainViewId === '__local' && (
                        <div style={{
                          position: "absolute", top: 6, left: 6, zIndex: 2,
                          background: "#1D9E75", borderRadius: 4,
                          padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#fff",
                        }}>발화 중</div>
                      )}
                    </div>
                    {/* 원격 참가자 전원 */}
                    {peerIds.map(peerId => (
                      <div key={peerId} style={{ width: 160, flexShrink: 0, height: "100%", position: "relative" }}>
                        <VideoTile stream={peersRef.current[peerId]} label="참여자"
                          isSpeaking={(audioLevels[peerId] || 0) > SPEAK_THRESHOLD} />
                        {mainViewId === peerId && (
                          <div style={{
                            position: "absolute", top: 6, left: 6, zIndex: 2,
                            background: "#1D9E75", borderRadius: 4,
                            padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#fff",
                          }}>발화 중</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── 하단 컨트롤 바 ── */}
            <div style={{
              background: "#0D2240", padding: "12px 20px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, flexShrink: 0,
            }}>
              {[
                { icon: <MicIcon on={micOn} />, label: micOn ? "마이크" : "음소거", active: micOn, click: handleMicToggle },
                { icon: <CamIcon on={camOn} />, label: camOn ? "카메라" : "카메라 끔", active: camOn, click: handleCamToggle },
                { icon: <ChatIcon />, label: "채팅", active: !chatOpen, click: () => setChatOpen(v => !v) },
              ].map((btn, i) => (
                <button key={i} className={btn.active ? "ctrl-btn" : "ctrl-btn-off"} onClick={btn.click} style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: btn.pink && !btn.active ? "#FEE2E2"
                    : !btn.active ? "#EF4444"
                    : "rgba(255,255,255,0.15)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.18s",
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
                      background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 24, fontSize: 13, color: "#fff",
                      outline: "none", fontFamily: "inherit",
                    }}
                  />
                  <button onClick={sendChat} style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "#1D9E75", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M14 8L2 2l2 6-2 6 12-6z" fill="white" />
                    </svg>
                  </button>
                </div>
              )}

              {/* 멘티 전용: 답변 상태 버튼 */}
              {!isMentor && (
                <button
                  onClick={() => handleAnswerStatus(answerStatus === "answering" ? "done" : "answering")}
                  style={{
                    padding: "12px 20px",
                    background: answerStatus === "answering" ? "#1D9E75" : "#f3f4f6",
                    color: answerStatus === "answering" ? "#fff" : "#374151",
                    border: `1.5px solid ${answerStatus === "answering" ? "#1D9E75" : "#d1d5db"}`,
                    borderRadius: 24,
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    fontFamily: "inherit", transition: "all 0.18s",
                  }}
                >
                  {answerStatus === "answering" ? "● 답변 중..." : "답변 시작"}
                </button>
              )}

              {/* End Call */}
              <button onClick={handleEndCall} disabled={ending} style={{
                padding: "12px 24px",
                background: ending ? "#9ca3af" : "#EF4444",
                color: "#fff", border: "none", borderRadius: 24,
                fontSize: 14, fontWeight: 700, cursor: ending ? "not-allowed" : "pointer",
                fontFamily: "inherit", transition: "background 0.18s", marginLeft: 8,
              }}
                onMouseEnter={e => { if (!ending) e.currentTarget.style.background = "#DC2626"; }}
                onMouseLeave={e => { if (!ending) e.currentTarget.style.background = "#EF4444"; }}
              >
                {ending ? "종료 중..." : "End Call"}
              </button>
            </div>
          </div>

          {/* ════ 멘토 전용: 우측 사이드패널 ════ */}
          {isMentor && (
            <div style={{
              width: 300, flexShrink: 0,
              background: "#fff", borderLeft: "1px solid #E8E0D0",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              <div style={{ padding: "13px 16px", borderBottom: "1px solid #E8E0D0", background: "#0D2240" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>면접 질문 패널</p>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#1D9E75", textTransform: "uppercase", marginBottom: 10 }}>AI 추천질문</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {questions.map((q, i) => (
                      <div key={i} style={{
                        background: "#FAF8F4", borderRadius: 10, padding: "12px 14px",
                        border: "1px solid #E8E0D0", cursor: "pointer",
                        borderLeft: "3px solid #1D9E75", transition: "background 0.15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "#E8F5EE"}
                        onMouseLeave={e => e.currentTarget.style.background = "#FAF8F4"}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#1D9E75", display: "block", marginBottom: 4 }}>Q{i + 1}</span>
                        <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.65 }}>{q.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: 10 }}>질문 리스트</p>
                  {questions.map((q, i) => {
                    const checked = checkedQs.includes(i);
                    return (
                      <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCheck(i)}
                          style={{ marginTop: 2, accentColor: "#0D2240", width: 14, height: 14, flexShrink: 0 }} />
                        <p style={{ fontSize: 12, color: checked ? "#9ca3af" : "#374151", lineHeight: 1.7, textDecoration: checked ? "line-through" : "none" }}>
                          {q.content}
                        </p>
                      </label>
                    );
                  })}
                  {questions.length > 0 && checkedQs.length === questions.length && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px", background: "#f0fdf4", borderRadius: 8 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#1D9E75" /><path d="M4.5 8l2.5 2.5 4-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600 }}>And you're good to go!</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: "12px 14px", borderTop: "1px solid #E8E0D0", display: "flex", gap: 8 }}>
                <input placeholder="메시지 입력..." value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "#1A1818", outline: "none", fontFamily: "inherit" }}
                />
                <button onClick={sendChat} style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#0D2240", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M11.5 6.5L1.5 1.5l1.5 5-1.5 5 10-5z" fill="white" />
                  </svg>
                </button>
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
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M2 3h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5l-3 3V4a1 1 0 0 1 1-1z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M5 7h8M5 10h5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
