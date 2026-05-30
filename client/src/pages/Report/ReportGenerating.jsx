import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateSessionReport, getSessionReport, getSessionSttStatus } from "../../api/sessions";

function getAuthHeaders() {
  const raw = localStorage.getItem("scena_auth");
  if (!raw) return {};
  try {
    const user = JSON.parse(raw);
    const token = user?.accessToken || user?.token || user?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";

const COLS = 10;
const ROWS = 20;
const CELL = 26;

const PIECES = [
  { shape: [[1,1,1,1]],               color: "#26C6DA" }, // I
  { shape: [[1,1],[1,1]],             color: "#FDD835" }, // O
  { shape: [[0,1,0],[1,1,1]],         color: "#AB47BC" }, // T
  { shape: [[0,1,1],[1,1,0]],         color: "#66BB6A" }, // S
  { shape: [[1,1,0],[0,1,1]],         color: "#EF5350" }, // Z
  { shape: [[1,0,0],[1,1,1]],         color: "#42A5F5" }, // J
  { shape: [[0,0,1],[1,1,1]],         color: "#FFA726" }, // L
];

const ANALYSIS_STEPS = [
  "답변 음성 STT 변환 확인 중...",
  "WPM · 침묵 구간 측정 중...",
  "STAR 구조화 지표 분류 중...",
  "Fit-Gap 역량 교차 분석 중...",
  "AI 인사이트 생성 중...",
];

/* ── 테트리스 유틸 ── */
function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  return { shape: p.shape, color: p.color, x: Math.floor(COLS / 2) - Math.floor(p.shape[0].length / 2), y: 0 };
}

function rotatePiece(shape) {
  return shape[0].map((_, c) => shape.map(r => r[c]).reverse());
}

function isValid(grid, shape, px, py) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nr = py + r, nc = px + c;
      if (nc < 0 || nc >= COLS || nr >= ROWS) return false;
      if (nr >= 0 && grid[nr][nc]) return false;
    }
  }
  return true;
}

function lockPiece(grid, shape, px, py, color) {
  const g = grid.map(r => [...r]);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c] && py + r >= 0) g[py + r][px + c] = color;
  return g;
}

function clearLines(grid) {
  const kept = grid.filter(row => row.some(cell => !cell));
  const cleared = ROWS - kept.length;
  const blanks = Array.from({ length: cleared }, () => Array(COLS).fill(null));
  return { grid: [...blanks, ...kept], lines: cleared };
}

/* ── 캔버스 렌더 ── */
function drawCanvas(ctx, grid, piece, ghost) {
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

  // 격자
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
  }

  // 고정된 블록
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (grid[r][c]) drawCell(ctx, c, r, grid[r][c]);
  }

  // 고스트
  if (ghost && piece) {
    ctx.globalAlpha = 0.2;
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c]) drawCell(ctx, piece.x + c, ghost + r, piece.color);
    ctx.globalAlpha = 1;
  }

  // 현재 피스
  if (piece) {
    for (let r = 0; r < piece.shape.length; r++)
      for (let c = 0; c < piece.shape[r].length; c++)
        if (piece.shape[r][c]) drawCell(ctx, piece.x + c, piece.y + r, piece.color);
  }
}

function drawCell(ctx, c, r, color) {
  const x = c * CELL + 1, y = r * CELL + 1, s = CELL - 2;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(x, y, s, 4);
  ctx.fillRect(x, y, 4, s);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x, y + s - 4, s, 4);
  ctx.fillRect(x + s - 4, y, 4, s);
}

function drawNext(ctx, piece) {
  ctx.fillStyle = "#1a2332";
  ctx.fillRect(0, 0, 120, 80);
  if (!piece) return;
  const offX = Math.floor((4 - piece.shape[0].length) / 2);
  const offY = Math.floor((3 - piece.shape.length) / 2);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) drawCell(ctx, offX + c, offY + r, piece.color);
}

/* ── 테트리스 컴포넌트 ── */
function Tetris() {
  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);
  const gameRef = useRef({
    grid: createGrid(),
    piece: null,
    next: null,
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    paused: false,
  });
  const [display, setDisplay] = useState({ score: 0, lines: 0, level: 1, over: false, paused: false });
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const dropIntervalRef = useRef(800);
  const dropTimerRef = useRef(0);

  const getGhost = useCallback((g, piece) => {
    if (!piece) return null;
    let gy = piece.y;
    while (isValid(g, piece.shape, piece.x, gy + 1)) gy++;
    return gy;
  }, []);

  const spawnPiece = useCallback(() => {
    const g = gameRef.current;
    const piece = g.next || randomPiece();
    const next = randomPiece();
    if (!isValid(g.grid, piece.shape, piece.x, piece.y)) {
      g.over = true;
      setDisplay(d => ({ ...d, over: true }));
      return;
    }
    g.piece = piece;
    g.next = next;
    if (nextCanvasRef.current) {
      const ctx = nextCanvasRef.current.getContext("2d");
      drawNext(ctx, next);
    }
  }, []);

  const lock = useCallback(() => {
    const g = gameRef.current;
    if (!g.piece) return;
    g.grid = lockPiece(g.grid, g.piece.shape, g.piece.x, g.piece.y, g.piece.color);
    const { grid: newGrid, lines } = clearLines(g.grid);
    g.grid = newGrid;
    g.lines += lines;
    const pts = [0, 100, 300, 500, 800][lines] || 0;
    g.score += pts * g.level;
    g.level = Math.floor(g.lines / 10) + 1;
    dropIntervalRef.current = Math.max(100, 800 - (g.level - 1) * 70);
    setDisplay({ score: g.score, lines: g.lines, level: g.level, over: g.over, paused: g.paused });
    g.piece = null;
    spawnPiece();
  }, [spawnPiece]);

  const gameLoop = useCallback((time) => {
    const g = gameRef.current;
    if (!g.over && !g.paused) {
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;
      dropTimerRef.current += delta;
      if (dropTimerRef.current >= dropIntervalRef.current) {
        dropTimerRef.current = 0;
        if (g.piece && isValid(g.grid, g.piece.shape, g.piece.x, g.piece.y + 1)) {
          g.piece.y++;
        } else {
          lock();
        }
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const ghost = getGhost(g.grid, g.piece);
        drawCanvas(ctx, g.grid, g.piece, ghost);
      }
    }
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [lock, getGhost]);

  useEffect(() => {
    spawnPiece();
    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(gameLoop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [spawnPiece, gameLoop]);

  useEffect(() => {
    const onKey = (e) => {
      const g = gameRef.current;
      if (g.over) return;
      if (e.key === "p" || e.key === "P") {
        g.paused = !g.paused;
        setDisplay(d => ({ ...d, paused: g.paused }));
        if (!g.paused) lastTimeRef.current = performance.now();
        return;
      }
      if (g.paused || !g.piece) return;
      if (e.key === "ArrowLeft") {
        if (isValid(g.grid, g.piece.shape, g.piece.x - 1, g.piece.y)) g.piece.x--;
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        if (isValid(g.grid, g.piece.shape, g.piece.x + 1, g.piece.y)) g.piece.x++;
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        if (isValid(g.grid, g.piece.shape, g.piece.x, g.piece.y + 1)) { g.piece.y++; dropTimerRef.current = 0; }
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        const rotated = rotatePiece(g.piece.shape);
        if (isValid(g.grid, rotated, g.piece.x, g.piece.y)) g.piece.shape = rotated;
        e.preventDefault();
      } else if (e.key === " ") {
        const gy = getGhost(g.grid, g.piece);
        if (gy !== null) { g.piece.y = gy; lock(); }
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lock, getGhost]);

  const restart = () => {
    const g = gameRef.current;
    g.grid = createGrid();
    g.piece = null;
    g.next = null;
    g.score = 0; g.lines = 0; g.level = 1;
    g.over = false; g.paused = false;
    dropIntervalRef.current = 800;
    dropTimerRef.current = 0;
    setDisplay({ score: 0, lines: 0, level: 1, over: false, paused: false });
    spawnPiece();
    lastTimeRef.current = performance.now();
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", userSelect: "none" }}>
      {/* 게임 보드 */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          style={{ display: "block", borderRadius: 10, border: "2px solid rgba(255,255,255,0.1)" }}
        />
        {(display.over || display.paused) && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 10,
            background: "rgba(0,0,0,0.72)", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <p style={{ color: "white", fontSize: 18, fontWeight: 800, margin: 0 }}>
              {display.over ? "GAME OVER" : "PAUSED"}
            </p>
            {display.over && (
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, margin: 0 }}>
                점수: {display.score}
              </p>
            )}
            <button onClick={restart} style={{
              padding: "9px 24px", borderRadius: 8, border: "none",
              background: GREEN, color: "white", fontSize: 13, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {display.over ? "다시 시작" : "계속하기"}
            </button>
          </div>
        )}
      </div>

      {/* 우측 정보 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 110 }}>
        {/* NEXT */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", marginBottom: 6 }}>NEXT</p>
          <canvas ref={nextCanvasRef} width={120} height={80} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }} />
        </div>

        {/* 점수 */}
        {[["SCORE", display.score], ["LINES", display.lines], ["LEVEL", display.level]].map(([label, val]) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 14px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", margin: "0 0 4px" }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0, fontVariantNumeric: "tabular-nums" }}>{val}</p>
          </div>
        ))}

        {/* 조작 방법 */}
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 12px" }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 8 }}>CONTROLS</p>
          {[["←→", "이동"], ["↑", "회전"], ["↓", "내리기"], ["Space", "즉시 낙하"], ["P", "일시정지"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>{k}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function ReportGeneratingPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [stepIdx, setStepIdx] = useState(0);
  const [statusSummary, setStatusSummary] = useState(null);
  const [phase, setPhase] = useState("waiting_stt");
  const [error, setError] = useState("");
  const generatingRef = useRef(false);
  const [generationStarted, setGenerationStarted] = useState(false);

  const goToReport = useCallback(() => {
    navigate(`/report/ai/${sessionId}`, { state: { role: "mentee" } });
  }, [navigate, sessionId]);

  // AI 분석 단계 사이클
  useEffect(() => {
    const id = setInterval(() => setStepIdx(prev => (prev + 1) % ANALYSIS_STEPS.length), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!sessionId || generationStarted) return;
    setGenerationStarted(true);
    fetch(`/api/sessions/${sessionId}/report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    })
      .then(res => {
        if (res.ok) goToReport();
      })
      .catch(() => {});
  }, [sessionId, generationStarted, goToReport]);

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
          <p style={{ fontSize: 13, fontWeight: 700, color: "white" }}>AI 면접 리포트 생성 중</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>STT 완료 후 자동으로 리포트를 생성합니다 — 테트리스로 기다려보세요!</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#E24B4A", animation: "pulse 1.2s ease-in-out infinite" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{progressLabel}</span>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, display: "flex", gap: 28, padding: "28px 5%", maxWidth: 960, margin: "0 auto", width: "100%", alignItems: "flex-start" }}>

        {/* 좌측: AI 상태 */}
        <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #E8E0D0", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #E8E0D0", borderTopColor: GREEN, animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{progressLabel}</p>
                <p style={{ fontSize: 11, color: "#9E9B95" }}>{statusText}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {ANALYSIS_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, opacity: i <= stepIdx ? 1 : 0.3, transition: "opacity 0.4s" }}>
                  <div style={{
                    width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
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
                  <span style={{ fontSize: 11, color: i <= stepIdx ? "#333" : "#bbb" }}>{step}</span>
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
              padding: "11px", borderRadius: 10,
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

        {/* 우측: 테트리스 */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: "#AB47BC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🟪</div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>테트리스</p>
              <p style={{ fontSize: 12, color: "#9E9B95" }}>분석 완료 시 자동으로 리포트 페이지로 이동합니다</p>
            </div>
          </div>
          <div style={{ background: "#0D2240", borderRadius: 16, padding: "24px", display: "inline-flex", animation: "fadeIn 0.3s ease" }}>
            <Tetris />
          </div>
        </div>
      </div>
    </div>
  );
}
