const MP_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection";
const FACE_DETECTION_SCRIPT = `${MP_CDN}/face_detection.js`;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

let mediaPipeLoadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.FaceDetection) resolve();
      else existing.addEventListener("load", resolve, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureMediaPipe() {
  if (window.FaceDetection) return;
  if (!mediaPipeLoadPromise) {
    mediaPipeLoadPromise = loadScript(FACE_DETECTION_SCRIPT);
  }
  await mediaPipeLoadPromise;
  if (!window.FaceDetection) {
    throw new Error("MediaPipe FaceDetection failed to load");
  }
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForDrawableVideo(video, timeoutMs = 4000) {
  const startedAt = performance.now();

  while (performance.now() - startedAt < timeoutMs) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      return true;
    }
    await nextAnimationFrame();
  }

  return video.videoWidth > 0 && video.videoHeight > 0;
}

function getSourceVideoTrack(sourceStream) {
  return sourceStream?.getVideoTracks?.().find((track) => track.readyState === "live") || null;
}

export const EMOJI_LIST = [
  { emoji: "🐻", label: "bear" },
  { emoji: "🐱", label: "cat" },
  { emoji: "🐰", label: "rabbit" },
  { emoji: "🐸", label: "frog" },
  { emoji: "🐹", label: "hamster" },
  { emoji: "🕶️", label: "sunglasses" },
  { emoji: "⭐", label: "star" },
];

export class FaceMaskEffect {
  constructor() {
    this._running = false;
    this._emoji = EMOJI_LIST[0].emoji;
    this._canvas = null;
    this._ctx = null;
    this._previewCanvas = null;
    this._previewCtx = null;
    this._video = null;
    this._detector = null;
    this._animId = null;
    this._canvasStream = null;
    this._previewStream = null;
    this._processing = false;
    this._latestDetections = [];
    this._sourceTrack = null;
  }

  get emoji() {
    return this._emoji;
  }

  set emoji(value) {
    this._emoji = value || EMOJI_LIST[0].emoji;
  }

  async start(sourceStream) {
    if (this._running) return this.getTrack();

    const sourceTrack = getSourceVideoTrack(sourceStream);
    if (!sourceTrack) {
      throw new Error("No live camera video track is available");
    }
    this._sourceTrack = sourceTrack.clone();

    const video = document.createElement("video");
    video.playsInline = true;
    video.autoplay = true;
    video.muted = true;
    video.srcObject = new MediaStream([this._sourceTrack]);
    video.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    this._video = video;

    await video.play();
    await waitForDrawableVideo(video);

    const width = video.videoWidth || sourceTrack.getSettings?.().width || DEFAULT_WIDTH;
    const height = video.videoHeight || sourceTrack.getSettings?.().height || DEFAULT_HEIGHT;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    this._canvas = canvas;
    this._ctx = canvas.getContext("2d", { alpha: false });

    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = width;
    previewCanvas.height = height;
    this._previewCanvas = previewCanvas;
    this._previewCtx = previewCanvas.getContext("2d", { alpha: false });

    this._drawPassthroughFrame();
    this._canvasStream = canvas.captureStream(30);
    this._drawMirroredPreviewFrame();
    this._previewStream = previewCanvas.captureStream(30);
    this._running = true;
    this._loop();

    this._initDetector().catch((error) => {
      console.warn("[FaceMask] Face detection disabled; video passthrough is still active.", error);
    });

    return this.getTrack();
  }

  getTrack() {
    return this._canvasStream?.getVideoTracks()[0] || null;
  }

  getPreviewTrack() {
    return this._previewStream?.getVideoTracks()[0] || null;
  }

  getSourceTrackClone() {
    if (this._sourceTrack?.readyState !== "live") return null;
    const clone = this._sourceTrack.clone();
    clone.enabled = this._sourceTrack.enabled;
    return clone;
  }

  async _initDetector() {
    await ensureMediaPipe();
    if (!this._running || !this._video) return;

    const detector = new window.FaceDetection({
      locateFile: (file) => `${MP_CDN}/${file}`,
    });
    detector.setOptions({
      model: "short",
      selfieMode: false,
      minDetectionConfidence: 0.5,
    });
    detector.onResults((results) => {
      this._latestDetections = results?.detections || [];
      this._processing = false;
    });
    this._detector = detector;
  }

  _resizeCanvasToVideo() {
    const video = this._video;
    const canvas = this._canvas;
    const previewCanvas = this._previewCanvas;
    if (!video || !canvas || video.videoWidth <= 0 || video.videoHeight <= 0) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    if (previewCanvas && (previewCanvas.width !== video.videoWidth || previewCanvas.height !== video.videoHeight)) {
      previewCanvas.width = video.videoWidth;
      previewCanvas.height = video.videoHeight;
    }
  }

  _drawPassthroughFrame() {
    const ctx = this._ctx;
    const video = this._video;
    const canvas = this._canvas;
    if (!ctx || !video || !canvas) return false;

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0 || video.videoHeight <= 0) {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width || DEFAULT_WIDTH, canvas.height || DEFAULT_HEIGHT);
      return false;
    }

    this._resizeCanvasToVideo();
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return true;
    } catch (error) {
      console.warn("[FaceMask] Failed to draw source video frame.", error);
      return false;
    }
  }

  _parseBoundingBox(det) {
    const canvas = this._canvas;
    const bb = det?.boundingBox;
    if (!canvas || !bb) return null;

    const cw = canvas.width;
    const ch = canvas.height;
    let cx;
    let cy;
    let fw;
    let fh;

    if (typeof bb.xCenter === "number") {
      const normalized = bb.xCenter <= 1 && bb.yCenter <= 1 && bb.width <= 1 && bb.height <= 1;
      fw = normalized ? bb.width * cw : bb.width;
      fh = normalized ? bb.height * ch : bb.height;
      cx = normalized ? bb.xCenter * cw : bb.xCenter;
      cy = normalized ? bb.yCenter * ch : bb.yCenter;
    } else if (typeof bb.originX === "number") {
      const normalized = bb.originX <= 1 && bb.originY <= 1 && bb.width <= 1 && bb.height <= 1;
      fw = normalized ? bb.width * cw : bb.width;
      fh = normalized ? bb.height * ch : bb.height;
      cx = (normalized ? bb.originX * cw : bb.originX) + fw / 2;
      cy = (normalized ? bb.originY * ch : bb.originY) + fh / 2;
    } else if (typeof bb.x === "number") {
      fw = bb.width;
      fh = bb.height;
      cx = bb.x + fw / 2;
      cy = bb.y + fh / 2;
    } else if (typeof bb.xMin === "number") {
      const normalized = bb.xMin <= 1 && bb.yMin <= 1 && bb.width <= 1 && bb.height <= 1;
      fw = normalized ? bb.width * cw : bb.width;
      fh = normalized ? bb.height * ch : bb.height;
      cx = (normalized ? bb.xMin * cw : bb.xMin) + fw / 2;
      cy = (normalized ? bb.yMin * ch : bb.yMin) + fh / 2;
    } else {
      return null;
    }

    if (![cx, cy, fw, fh].every(Number.isFinite) || fw <= 0 || fh <= 0) return null;
    return { cx, cy, fw, fh };
  }

  _drawEmojiMasks() {
    const ctx = this._ctx;
    if (!ctx) return;

    for (const det of this._latestDetections) {
      const parsed = this._parseBoundingBox(det);
      if (!parsed) continue;

      const { cx, cy, fw, fh } = parsed;
      const size = Math.max(32, Math.round(Math.max(fw, fh) * 1.15));
      const y = cy - fh * 0.08;

      ctx.save();
      ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this._emoji, cx, y);
      ctx.restore();
    }
  }

  _drawMirroredPreviewFrame() {
    const ctx = this._previewCtx;
    const source = this._canvas;
    const target = this._previewCanvas;
    if (!ctx || !source || !target) return;

    ctx.save();
    ctx.setTransform(-1, 0, 0, 1, target.width, 0);
    ctx.drawImage(source, 0, 0, target.width, target.height);
    ctx.restore();
  }

  _requestDetection() {
    if (this._processing || !this._detector || !this._video) return;
    if (this._video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    this._processing = true;
    this._detector.send({ image: this._video }).catch((error) => {
      console.warn("[FaceMask] Face detection frame failed.", error);
      this._processing = false;
    });
  }

  _loop() {
    if (!this._running) return;

    const drewFrame = this._drawPassthroughFrame();
    if (drewFrame) {
      this._drawEmojiMasks();
      this._drawMirroredPreviewFrame();
      this._requestDetection();
    }

    this._animId = requestAnimationFrame(() => this._loop());
  }

  stop() {
    this._running = false;
    if (this._animId) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
    this._canvasStream?.getTracks().forEach((track) => track.stop());
    this._canvasStream = null;
    this._previewStream?.getTracks().forEach((track) => track.stop());
    this._previewStream = null;
    if (this._video) {
      this._video.srcObject = null;
      this._video.remove();
      this._video = null;
    }
    try {
      this._detector?.close();
    } catch {}
    this._detector = null;
    this._canvas = null;
    this._ctx = null;
    this._previewCanvas = null;
    this._previewCtx = null;
    this._latestDetections = [];
    this._processing = false;
    this._sourceTrack?.stop();
    this._sourceTrack = null;
  }
}
