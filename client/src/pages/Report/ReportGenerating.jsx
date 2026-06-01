import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateSessionReport, getSessionReport, getSessionSttStatus } from "../../api/sessions";

const C = {
  primary:     "#0D2240",
  primaryGrad: "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
  success:     "#0CA678",
  successGrad: "linear-gradient(135deg, #0CA678 0%, #38D9A9 100%)",
  warning:     "#E67700",
  warningLight:"#FFF3BF",
  bg:          "#F0F4F8",
  white:       "#FFFFFF",
  border:      "#E9ECEF",
  text:        "#1A1B1E",
  textSub:     "#495057",
  textMuted:   "#868E96",
  shadow:      "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
};

const ANALYSIS_STEPS = [
  { icon: "🎙", label: "답변 음성 STT 변환 확인 중" },
  { icon: "📊", label: "WPM · 침묵 구간 측정 중" },
  { icon: "🧩", label: "STAR 구조화 지표 분류 중" },
  { icon: "🔍", label: "Fit-Gap 역량 교차 분석 중" },
  { icon: "✨", label: "AI 인사이트 생성 중" },
];

/* ── 테트리스 ── */
const COLS = 10, ROWS = 20, CELL = 26;
const PIECES = [
  { shape: [[1,1,1,1]], color: "#2563EB" },
  { shape: [[1,1],[1,1]], color: "#1B4F7A" },
  { shape: [[0,1,0],[1,1,1]], color: "#3B82F6" },
  { shape: [[0,1,1],[1,1,0]], color: "#0CA678" },
  { shape: [[1,1,0],[0,1,1]], color: "#0D2240" },
  { shape: [[1,0,0],[1,1,1]], color: "#60A5FA" },
  { shape: [[0,0,1],[1,1,1]], color: "#0891B2" },
];

function createGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
function randomPiece() { const p = PIECES[Math.floor(Math.random() * PIECES.length)]; return { shape: p.shape, color: p.color, x: Math.floor(COLS/2) - Math.floor(p.shape[0].length/2), y: 0 }; }
function rotatePiece(shape) { return shape[0].map((_, c) => shape.map(r => r[c]).reverse()); }
function isValid(grid, shape, px, py) { for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) { if (!shape[r][c]) continue; const nr = py+r, nc = px+c; if (nc < 0 || nc >= COLS || nr >= ROWS) return false; if (nr >= 0 && grid[nr][nc]) return false; } return true; }
function lockPiece(grid, shape, px, py, color) { const g = grid.map(r => [...r]); for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) if (shape[r][c] && py+r >= 0) g[py+r][px+c] = color; return g; }
function clearLines(grid) { const kept = grid.filter(row => row.some(cell => !cell)); const cleared = ROWS - kept.length; return { grid: [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...kept], lines: cleared }; }

function drawCell(ctx, c, r, color) {
  const x = c*CELL+1, y = r*CELL+1, s = CELL-2;
  ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
  ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(x, y, s, 4); ctx.fillRect(x, y, 4, s);
  ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x, y+s-4, s, 4); ctx.fillRect(x+s-4, y, 4, s);
}

function Tetris() {
  const canvasRef = useRef(null);
  const nextCanvasRef = useRef(null);
  const gameRef = useRef({ grid: createGrid(), piece: null, next: null, score: 0, lines: 0, level: 1, over: false, paused: false });
  const [display, setDisplay] = useState({ score: 0, lines: 0, level: 1, over: false, paused: false });
  const rafRef = useRef(null), lastTimeRef = useRef(0), dropIntervalRef = useRef(800), dropTimerRef = useRef(0);

  const getGhost = useCallback((g, piece) => {
    if (!piece) return null;
    let gy = piece.y;
    while (isValid(g, piece.shape, piece.x, gy + 1)) gy++;
    return gy;
  }, []);

  const drawNextCanvas = useCallback((piece) => {
    const ctx = nextCanvasRef.current?.getContext("2d");
    if (!ctx || !piece) return;
    ctx.fillStyle = "#F0F4F8"; ctx.fillRect(0, 0, 120, 80);
    const offX = Math.floor((4 - piece.shape[0].length) / 2);
    const offY = Math.floor((3 - piece.shape.length) / 2);
    for (let r = 0; r < piece.shape.length; r++) for (let c = 0; c < piece.shape[r].length; c++) if (piece.shape[r][c]) drawCell(ctx, offX+c, offY+r, piece.color);
  }, []);

  const spawnPiece = useCallback(() => {
    const g = gameRef.current;
    const piece = g.next || randomPiece();
    const next = randomPiece();
    if (!isValid(g.grid, piece.shape, piece.x, piece.y)) { g.over = true; setDisplay(d => ({ ...d, over: true })); return; }
    g.piece = piece; g.next = next;
    drawNextCanvas(next);
  }, [drawNextCanvas]);

  const lock = useCallback(() => {
    const g = gameRef.current;
    if (!g.piece) return;
    g.grid = lockPiece(g.grid, g.piece.shape, g.piece.x, g.piece.y, g.piece.color);
    const { grid: newGrid, lines } = clearLines(g.grid);
    g.grid = newGrid; g.lines += lines;
    const pts = [0,100,300,500,800][lines] || 0;
    g.score += pts * g.level; g.level = Math.floor(g.lines/10)+1;
    dropIntervalRef.current = Math.max(100, 800-(g.level-1)*70);
    setDisplay({ score: g.score, lines: g.lines, level: g.level, over: g.over, paused: g.paused });
    g.piece = null; spawnPiece();
  }, [spawnPiece]);

  const gameLoop = useCallback((time) => {
    const g = gameRef.current;
    if (!g.over && !g.paused) {
      const delta = time - lastTimeRef.current; lastTimeRef.current = time; dropTimerRef.current += delta;
      if (dropTimerRef.current >= dropIntervalRef.current) {
        dropTimerRef.current = 0;
        if (g.piece && isValid(g.grid, g.piece.shape, g.piece.x, g.piece.y+1)) g.piece.y++;
        else lock();
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, COLS*CELL, ROWS*CELL);
        ctx.strokeStyle = "rgba(13,34,64,0.06)"; ctx.lineWidth = 0.5;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) ctx.strokeRect(c*CELL, r*CELL, CELL, CELL);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (g.grid[r][c]) drawCell(ctx, c, r, g.grid[r][c]);
        const ghost = getGhost(g.grid, g.piece);
        if (ghost && g.piece) { ctx.globalAlpha = 0.18; for (let r = 0; r < g.piece.shape.length; r++) for (let c = 0; c < g.piece.shape[r].length; c++) if (g.piece.shape[r][c]) drawCell(ctx, g.piece.x+c, ghost+r, g.piece.color); ctx.globalAlpha = 1; }
        if (g.piece) for (let r = 0; r < g.piece.shape.length; r++) for (let c = 0; c < g.piece.shape[r].length; c++) if (g.piece.shape[r][c]) drawCell(ctx, g.piece.x+c, g.piece.y+r, g.piece.color);
      }
    }
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [lock, getGhost]);

  useEffect(() => { spawnPiece(); lastTimeRef.current = performance.now(); rafRef.current = requestAnimationFrame(gameLoop); return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }; }, [spawnPiece, gameLoop]);

  useEffect(() => {
    const onKey = (e) => {
      const g = gameRef.current;
      if (g.over) return;
      if (e.key === "p" || e.key === "P") { g.paused = !g.paused; setDisplay(d => ({ ...d, paused: g.paused })); if (!g.paused) lastTimeRef.current = performance.now(); return; }
      if (g.paused || !g.piece) return;
      if (e.key === "ArrowLeft") { if (isValid(g.grid, g.piece.shape, g.piece.x-1, g.piece.y)) g.piece.x--; e.preventDefault(); }
      else if (e.key === "ArrowRight") { if (isValid(g.grid, g.piece.shape, g.piece.x+1, g.piece.y)) g.piece.x++; e.preventDefault(); }
      else if (e.key === "ArrowDown") { if (isValid(g.grid, g.piece.shape, g.piece.x, g.piece.y+1)) { g.piece.y++; dropTimerRef.current = 0; } e.preventDefault(); }
      else if (e.key === "ArrowUp") { const rotated = rotatePiece(g.piece.shape); if (isValid(g.grid, rotated, g.piece.x, g.piece.y)) g.piece.shape = rotated; e.preventDefault(); }
      else if (e.key === " ") { const gy = getGhost(g.grid, g.piece); if (gy !== null) { g.piece.y = gy; lock(); } e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lock, getGhost]);

  const restart = () => {
    const g = gameRef.current;
    g.grid = createGrid(); g.piece = null; g.next = null; g.score = 0; g.lines = 0; g.level = 1; g.over = false; g.paused = false;
    dropIntervalRef.current = 800; dropTimerRef.current = 0;
    setDisplay({ score: 0, lines: 0, level: 1, over: false, paused: false });
    spawnPiece(); lastTimeRef.current = performance.now();
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", userSelect: "none" }}>
      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} width={COLS*CELL} height={ROWS*CELL} style={{ display: "block", borderRadius: 12, border: `1.5px solid ${C.border}`, boxShadow: "0 2px 12px rgba(13,34,64,0.08)" }} />
        {(display.over || display.paused) && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <p style={{ color: C.primary, fontSize: 18, fontWeight: 800 }}>{display.over ? "GAME OVER" : "PAUSED"}</p>
            {display.over && <p style={{ color: C.textMuted, fontSize: 13 }}>점수: {display.score}</p>}
            <button onClick={restart} style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: C.successGrad, color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {display.over ? "다시 시작" : "계속하기"}
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 110 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.1em", marginBottom: 6 }}>NEXT</p>
          <canvas ref={nextCanvasRef} width={120} height={80} style={{ borderRadius: 8, border: `1px solid ${C.border}` }} />
        </div>
        {[["SCORE", display.score], ["LINES", display.lines], ["LEVEL", display.level]].map(([label, val]) => (
          <div key={label} style={{ background: C.bg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, letterSpacing: "0.1em", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>{val}</p>
          </div>
        ))}
        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em", marginBottom: 8 }}>CONTROLS</p>
          {[["←→","이동"],["↑","회전"],["↓","내리기"],["Space","즉시 낙하"],["P","일시정지"]].map(([k,v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: C.success, fontWeight: 700 }}>{k}</span>
              <span style={{ fontSize: 10, color: C.textMuted }}>{v}</span>
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

  const goToReport = useCallback(() => {
    navigate(`/report/ai/${sessionId}`, { state: { role: "mentee" } });
  }, [navigate, sessionId]);

  useEffect(() => {
    const id = setInterval(() => setStepIdx(prev => (prev + 1) % ANALYSIS_STEPS.length), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!sessionId || !/^\d+$/.test(sessionId)) return;
    let cancelled = false;
    const poll = async () => {
      if (generatingRef.current || cancelled) return;
      try {
        const existingReport = await getSessionReport(sessionId).catch(() => null);
        if (cancelled) return;
        if (existingReport?.ai_report) { goToReport(); return; }
        const summary = await getSessionSttStatus(sessionId);
        if (cancelled) return;
        setStatusSummary(summary); setError("");
        if (!summary.total_count) { setPhase("waiting_answers"); return; }
        if (!summary.ready) { setPhase("waiting_stt"); return; }
        generatingRef.current = true; setPhase("generating_report");
        await generateSessionReport(sessionId);
        if (!cancelled) goToReport();
      } catch (err) {
        if (!cancelled) { setError("리포트 생성 준비 중 문제가 발생했습니다."); generatingRef.current = false; }
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionId, goToReport]);

  const progressLabel = phase === "waiting_answers" ? "저장된 답변 확인 중"
    : phase === "waiting_stt" ? "답변 음성 변환 대기 중"
    : phase === "generating_report" ? "AI 리포트 생성 중"
    : "분석 중";

  const statusText = statusSummary
    ? `답변 ${statusSummary.completed_count}/${statusSummary.total_count}개 STT 완료`
    : "답변 상태 확인 중";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* 헤더 */}
      <header style={{ background: C.white, padding: "0 5%", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E03131", animation: "pulse 1.2s ease-in-out infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textSub }}>{progressLabel}</span>
          </div>
        </nav>
      </header>

      {/* 본문 */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "36px 5%", display: "flex", gap: 24, alignItems: "flex-start", animation: "fadeUp 0.4s ease" }}>

        {/* 좌측: AI 상태 */}
        <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 상태 카드 */}
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px 20px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.success, animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{progressLabel}</p>
                <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{statusText}</p>
              </div>
            </div>

            <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>분석 단계</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ANALYSIS_STEPS.map((s, i) => {
                const done = i < stepIdx, active = i === stepIdx;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i <= stepIdx ? 1 : 0.3, transition: "opacity 0.4s" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: done ? C.successGrad : active ? C.primaryGrad : C.bg, border: `1.5px solid ${done ? C.success : active ? C.primary : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, transition: "all 0.4s" }}>
                      {done
                        ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <span style={{ fontSize: 10 }}>{s.icon}</span>
                      }
                    </div>
                    <span style={{ fontSize: 12, color: done ? C.success : active ? C.text : C.textMuted, fontWeight: active ? 700 : 400 }}>{s.label}</span>
                  </div>
                );
              })}
            </div>

            {statusSummary && (
              <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: "0.05em" }}>STT 상태</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[["완료", statusSummary.completed_count, C.success], ["진행", statusSummary.processing_count, "#2563EB"], ["대기", statusSummary.pending_count, C.warning], ["실패", statusSummary.failed_count, "#E03131"]].map(([label, value, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: C.textMuted }}>{label}</span>
                      <span style={{ color, fontWeight: 800 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p style={{ marginTop: 12, fontSize: 11, color: "#E03131", lineHeight: 1.6 }}>{error}</p>}
          </div>

          {/* 건너뛰기 버튼 */}
          <button
            onClick={goToReport}
            style={{ padding: "13px", borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.white, color: C.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.18s, color 0.18s", boxShadow: C.shadow }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
          >
            건너뛰고 리포트 보기 →
          </button>
        </div>

        {/* 우측: 테트리스 */}
        <div style={{ flex: 1 }}>
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px", boxShadow: C.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.primaryGrad, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(13,34,64,0.25)" }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="7" height="7" rx="1.5" fill="white" opacity="0.9"/><rect x="10" y="1" width="7" height="7" rx="1.5" fill="white" opacity="0.55"/><rect x="1" y="10" width="7" height="7" rx="1.5" fill="white" opacity="0.55"/><rect x="10" y="10" width="7" height="7" rx="1.5" fill="#38D9A9"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>테트리스로 기다려보세요</p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>분석 완료 시 자동으로 리포트 페이지로 이동합니다</p>
              </div>
            </div>
            <Tetris />
          </div>
        </div>
      </div>
    </div>
  );
}
