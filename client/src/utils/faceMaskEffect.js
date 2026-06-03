const MP_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/face_detection";
const FACE_DETECTION_SCRIPT = `${MP_CDN}/face_detection.js`;
const SEGMENTATION_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation";
const SEGMENTATION_SCRIPT = `${SEGMENTATION_CDN}/selfie_segmentation.js`;
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

let mediaPipeLoadPromise = null;
let segmentationLoadPromise = null;

function loadScript(src, globalName) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window[globalName]) resolve();
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
    mediaPipeLoadPromise = loadScript(FACE_DETECTION_SCRIPT, "FaceDetection");
  }
  await mediaPipeLoadPromise;
  if (!window.FaceDetection) {
    throw new Error("MediaPipe FaceDetection failed to load");
  }
}

async function ensureSelfieSegmentation() {
  if (window.SelfieSegmentation) return;
  if (!segmentationLoadPromise) {
    segmentationLoadPromise = loadScript(SEGMENTATION_SCRIPT, "SelfieSegmentation");
  }
  await segmentationLoadPromise;
  if (!window.SelfieSegmentation) {
    throw new Error("MediaPipe SelfieSegmentation failed to load");
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
  { emoji: "◐", label: "블러", type: "blur" },
  { emoji: "▣", label: "배경 블러", type: "backgroundBlur" },
  { emoji: "🐻", label: "곰" },
  { emoji: "🐱", label: "고양이" },
  { emoji: "🐰", label: "토끼" },
  { emoji: "🐸", label: "개구리" },
  { emoji: "🐹", label: "햄스터" },
];

export class FaceMaskEffect {
  constructor() {
    this._running = false;
    this._emoji = EMOJI_LIST[0].emoji;
    this._displayName = "";
    this._canvas = null;
    this._ctx = null;
    this._previewCanvas = null;
    this._previewCtx = null;
    this._scratchCanvas = null;
    this._scratchCtx = null;
    this._composeCanvas = null;
    this._composeCtx = null;
    this._video = null;
    this._detector = null;
    this._segmenter = null;
    this._segmenterInitPromise = null;
    this._animId = null;
    this._canvasStream = null;
    this._previewStream = null;
    this._processing = false;
    this._segmenting = false;
    this._segmentationMask = null;
    this._latestDetections = [];
    this._sourceTrack = null;
  }

  get emoji() {
    return this._emoji;
  }

  set emoji(value) {
    this._emoji = value || EMOJI_LIST[0].emoji;
  }

  set displayName(value) {
    this._displayName = String(value || "").trim();
  }

  get _maskOption() {
    return EMOJI_LIST.find((option) => option.emoji === this._emoji) || EMOJI_LIST[0];
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
    this._scratchCanvas = document.createElement("canvas");
    this._scratchCtx = this._scratchCanvas.getContext("2d", { alpha: false });
    this._composeCanvas = document.createElement("canvas");
    this._composeCtx = this._composeCanvas.getContext("2d");

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

  async _initSegmenter() {
    await ensureSelfieSegmentation();
    if (!this._running || !this._video) return;

    const segmenter = new window.SelfieSegmentation({
      locateFile: (file) => `${SEGMENTATION_CDN}/${file}`,
    });
    segmenter.setOptions({
      modelSelection: 1,
      selfieMode: false,
    });
    segmenter.onResults((results) => {
      this._segmentationMask = results?.segmentationMask || null;
      this._segmenting = false;
    });
    this._segmenter = segmenter;
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

  _getMaskBounds({ cx, cy, fw, fh }, padding = 0.28, canvas = this._canvas) {
    if (!canvas) return null;

    const width = Math.max(32, fw * (1 + padding));
    const height = Math.max(32, fh * (1 + padding));
    const x = Math.max(0, Math.round(cx - width / 2));
    const y = Math.max(0, Math.round(cy - height / 2));
    const w = Math.min(canvas.width - x, Math.round(width));
    const h = Math.min(canvas.height - y, Math.round(height));

    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
  }

  _applyBlurMask(parsed, ctx = this._ctx, canvas = this._canvas, drawLabel = true) {
    const scratch = this._scratchCanvas;
    const scratchCtx = this._scratchCtx;
    if (!ctx || !canvas || !scratch || !scratchCtx) return;

    const bounds = this._getMaskBounds(parsed, 0.5, canvas);
    if (!bounds) return;

    const { x, y, w, h } = bounds;
    scratch.width = w;
    scratch.height = h;
    scratchCtx.clearRect(0, 0, w, h);
    scratchCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(parsed.cx, parsed.cy - parsed.fh * 0.04, w * 0.46, h * 0.48, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = "blur(16px)";
    ctx.drawImage(scratch, 0, 0, w, h, x, y, w, h);
    ctx.filter = "none";
    ctx.fillStyle = "rgba(15, 23, 42, 0.12)";
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    if (drawLabel) {
      this._drawBlurLabel(parsed, w, ctx);
    }
  }

  _drawBlurLabel(parsed, maskWidth, ctx = this._ctx) {
    const label = this._displayName;
    if (!ctx || !label) return;

    const maxText = label.length > 10 ? `${label.slice(0, 10)}...` : label;
    const fontSize = Math.max(13, Math.min(22, Math.round(maskWidth * 0.13)));
    const y = parsed.cy - parsed.fh * 0.02;

    ctx.save();
    ctx.font = `700 ${fontSize}px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.fillText(maxText, parsed.cx, y);
    ctx.restore();
  }

  _drawSilhouetteMask(parsed) {
    const ctx = this._ctx;
    if (!ctx) return;

    const radius = Math.max(28, Math.max(parsed.fw, parsed.fh) * 0.52);
    const centerY = parsed.cy - parsed.fh * 0.04;

    ctx.save();
    ctx.fillStyle = "rgba(17, 24, 39, 0.92)";
    ctx.beginPath();
    ctx.ellipse(parsed.cx, centerY, radius * 0.78, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(parsed.cx, centerY - radius * 0.16, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(parsed.cx, centerY + radius * 0.28, radius * 0.42, radius * 0.22, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  _drawCoverMask(parsed) {
    const ctx = this._ctx;
    if (!ctx) return;

    const bounds = this._getMaskBounds(parsed, 0.18);
    if (!bounds) return;

    const { x, y, w, h } = bounds;
    const radius = Math.min(18, w * 0.16, h * 0.16);

    ctx.save();
    ctx.fillStyle = "rgba(31, 41, 55, 0.94)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = Math.max(2, Math.round(w * 0.018));
    ctx.stroke();
    ctx.restore();
  }

  _drawBackgroundBlur() {
    const ctx = this._ctx;
    const canvas = this._canvas;
    const scratch = this._scratchCanvas;
    const scratchCtx = this._scratchCtx;
    const compose = this._composeCanvas;
    const composeCtx = this._composeCtx;
    const mask = this._segmentationMask;
    if (!ctx || !canvas || !scratch || !scratchCtx || !compose || !composeCtx || !mask) return;

    const { width, height } = canvas;
    if (scratch.width !== width || scratch.height !== height) {
      scratch.width = width;
      scratch.height = height;
    }
    if (compose.width !== width || compose.height !== height) {
      compose.width = width;
      compose.height = height;
    }

    scratchCtx.clearRect(0, 0, width, height);
    scratchCtx.drawImage(canvas, 0, 0, width, height);

    composeCtx.save();
    composeCtx.clearRect(0, 0, width, height);
    composeCtx.filter = "blur(18px)";
    composeCtx.drawImage(scratch, 0, 0, width, height);
    composeCtx.filter = "none";
    composeCtx.globalCompositeOperation = "destination-out";
    composeCtx.drawImage(mask, 0, 0, width, height);
    composeCtx.restore();

    ctx.drawImage(compose, 0, 0, width, height);
  }

  _drawFaceMasks() {
    const ctx = this._ctx;
    if (!ctx) return;

    const option = this._maskOption;
    if (option.type === "backgroundBlur") return;

    for (const det of this._latestDetections) {
      const parsed = this._parseBoundingBox(det);
      if (!parsed) continue;

      if (option.type === "blur") {
        this._applyBlurMask(parsed);
        continue;
      }

      if (option.type === "silhouette") {
        this._drawSilhouetteMask(parsed);
        continue;
      }

      if (option.type === "cover") {
        this._drawCoverMask(parsed);
        continue;
      }

      const { cx, cy, fw, fh } = parsed;
    const size = Math.max(38, Math.round(Math.max(fw, fh) * 1.36));
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

    if (this._maskOption.type !== "blur") return;

    for (const det of this._latestDetections) {
      const parsed = this._parseBoundingBox(det);
      if (!parsed) continue;

      const mirrored = {
        ...parsed,
        cx: target.width - parsed.cx,
      };
      const bounds = this._getMaskBounds(mirrored, 0.5, target);
      if (!bounds) continue;

      this._applyBlurMask(mirrored, ctx, target, false);
      this._drawBlurLabel(mirrored, bounds.w, ctx);
    }
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

  _requestSegmentation() {
    if (this._maskOption.type !== "backgroundBlur" || !this._video) return;
    if (!this._segmenter) {
      if (!this._segmenterInitPromise) {
        this._segmenterInitPromise = this._initSegmenter().catch((error) => {
          console.warn("[FaceMask] Background blur disabled; segmentation failed to load.", error);
          this._segmenting = false;
        });
      }
      return;
    }
    if (this._segmenting || this._video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    this._segmenting = true;
    this._segmenter.send({ image: this._video }).catch((error) => {
      console.warn("[FaceMask] Segmentation frame failed.", error);
      this._segmenting = false;
    });
  }

  _loop() {
    if (!this._running) return;

    const drewFrame = this._drawPassthroughFrame();
    if (drewFrame) {
      if (this._maskOption.type === "backgroundBlur") {
        this._drawBackgroundBlur();
      }
      this._drawFaceMasks();
      this._drawMirroredPreviewFrame();
      this._requestSegmentation();
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
    try {
      this._segmenter?.close();
    } catch {}
    this._detector = null;
    this._segmenter = null;
    this._segmenterInitPromise = null;
    this._canvas = null;
    this._ctx = null;
    this._previewCanvas = null;
    this._previewCtx = null;
    this._scratchCanvas = null;
    this._scratchCtx = null;
    this._composeCanvas = null;
    this._composeCtx = null;
    this._latestDetections = [];
    this._segmentationMask = null;
    this._processing = false;
    this._segmenting = false;
    this._sourceTrack?.stop();
    this._sourceTrack = null;
  }
}
