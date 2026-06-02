import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { generateSessionReport, getSessionReport, getSessionSttStatus } from "../../api/sessions";
import { getAuthUser } from "../../store/authStore";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_REPORT === "true";

const C = {
  primary:     "#0D2240",
  primaryGrad: "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
  success:     "#0CA678",
  successLight:"#E6FCF5",
  text:        "#1A1B1E",
  textSub:     "#495057",
  textMuted:   "#868E96",
  white:       "#FFFFFF",
  bg:          "#F0F4F8",
  border:      "#E9ECEF",
  shadow:      "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
};
const NAVY  = C.primary;
const GREEN = C.success;
const COLS = 10;
const ROWS = 20;
const CELL = 24;

const PIECES = [
  { shape: [[1, 1, 1, 1]], color: "#0D2240" },
  { shape: [[1, 1], [1, 1]], color: "#1B4F7A" },
  { shape: [[0, 1, 0], [1, 1, 1]], color: "#2563EB" },
  { shape: [[0, 1, 1], [1, 1, 0]], color: "#1E3A5F" },
  { shape: [[1, 1, 0], [0, 1, 1]], color: "#3B82F6" },
  { shape: [[1, 0, 0], [1, 1, 1]], color: "#60A5FA" },
  { shape: [[0, 0, 1], [1, 1, 1]], color: "#93C5FD" },
];

const ANALYSIS_STEPS = [
  "답변 음성 STT 변환 확인 중...",
  "WPM · 침묵 구간 측정 중...",
  "STAR 구조화 지표 분류 중...",
  "Fit-Gap 역량 교차 분석 중...",
  "AI 인사이트 생성 중...",
];

function createGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: piece.shape,
    color: piece.color,
    x: Math.floor(COLS / 2) - Math.ceil(piece.shape[0].length / 2),
    y: 0,
  };
}

function rotate(shape) {
  return shape[0].map((_, col) => shape.map(row => row[col]).reverse());
}

function isValid(grid, shape, x, y) {
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const nextX = x + col;
      const nextY = y + row;
      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) return false;
      if (nextY >= 0 && grid[nextY][nextX]) return false;
    }
  }
  return true;
}

function drawCell(ctx, x, y, color) {
  const px = x * CELL + 1;
  const py = y * CELL + 1;
  const size = CELL - 2;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(px, py, size, 4);
  ctx.fillRect(px, py, 4, size);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(px, py + size - 4, size, 4);
  ctx.fillRect(px + size - 4, py, 4, size);
}

function drawBoard(canvas, grid, piece) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
  ctx.strokeStyle = "rgba(13,34,64,0.04)";
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.strokeRect(col * CELL, row * CELL, CELL, CELL);
      if (grid[row][col]) drawCell(ctx, col, row, grid[row][col]);
    }
  }
  if (!piece) return;
  piece.shape.forEach((line, row) => {
    line.forEach((filled, col) => {
      if (filled) drawCell(ctx, piece.x + col, piece.y + row, piece.color);
    });
  });
}

const NEXT_CELL = 20  ;
const NEXT_SIZE = 6;

function drawNextCanvas(canvas, piece) {
  const ctx = canvas?.getContext("2d");
  if (!ctx || !piece) return;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, NEXT_SIZE * NEXT_CELL, NEXT_SIZE * NEXT_CELL);
  const offX = Math.floor((NEXT_SIZE - piece.shape[0].length) / 2);
  const offY = Math.floor((NEXT_SIZE - piece.shape.length) / 2);
  piece.shape.forEach((line, row) => {
    line.forEach((filled, col) => {
      if (!filled) return;
      const px = (offX + col) * NEXT_CELL + 1;
      const py = (offY + row) * NEXT_CELL + 1;
      const s = NEXT_CELL - 2;
      ctx.fillStyle = piece.color;
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(px, py, s, 3);
      ctx.fillRect(px, py, 3, s);
    });
  });
}

function TetrisPanel() {
  const canvasRef = useRef(null);
  const nextRef = useRef(null);
  const gameRef = useRef({ grid: createGrid(), piece: randomPiece(), next: randomPiece(), score: 0, lines: 0, level: 1, over: false, paused: false });
  const [display, setDisplay] = useState({ score: 0, lines: 0, level: 1, over: false, paused: false });

  const refresh = useCallback(() => {
    const g = gameRef.current;
    setDisplay({ score: g.score, lines: g.lines, level: g.level, over: g.over, paused: g.paused });
  }, []);

  const restart = useCallback(() => {
    const next = randomPiece();
    gameRef.current = { grid: createGrid(), piece: randomPiece(), next, score: 0, lines: 0, level: 1, over: false, paused: false };
    drawBoard(canvasRef.current, gameRef.current.grid, gameRef.current.piece);
    drawNextCanvas(nextRef.current, next);
    refresh();
  }, [refresh]);

  const lockPiece = useCallback(() => {
    const game = gameRef.current;
    const { grid, piece } = game;
    piece.shape.forEach((line, row) => {
      line.forEach((filled, col) => {
        if (filled && piece.y + row >= 0) grid[piece.y + row][piece.x + col] = piece.color;
      });
    });
    const kept = grid.filter(row => row.some(cell => !cell));
    const cleared = ROWS - kept.length;
    game.grid = [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...kept];
    game.lines += cleared;
    game.score += [0, 100, 300, 500, 800][cleared] || 0;
    game.level = Math.floor(game.lines / 10) + 1;
    game.piece = game.next;
    game.next = randomPiece();
    drawNextCanvas(nextRef.current, game.next);
    if (!isValid(game.grid, game.piece.shape, game.piece.x, game.piece.y)) {
      game.over = true;
    }
    refresh();
  }, [refresh]);

  const getGhostY = useCallback((piece, grid) => {
    let gy = piece.y;
    while (isValid(grid, piece.shape, piece.x, gy + 1)) gy++;
    return gy;
  }, []);

  const drawFull = useCallback(() => {
    const { grid, piece } = gameRef.current;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.strokeStyle = "rgba(13,34,64,0.04)";
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        ctx.strokeRect(col * CELL, row * CELL, CELL, CELL);
        if (grid[row][col]) drawCell(ctx, col, row, grid[row][col]);
      }
    }
    if (!piece) return;
    const gy = getGhostY(piece, grid);
    if (gy !== piece.y) {
      piece.shape.forEach((line, row) => {
        line.forEach((filled, col) => {
          if (!filled) return;
          const px = (piece.x + col) * CELL + 1;
          const py = (gy + row) * CELL + 1;
          const s = CELL - 2;
          ctx.fillStyle = "rgba(13,34,64,0.12)";
          ctx.strokeStyle = "rgba(13,34,64,0.25)";
          ctx.lineWidth = 1;
          ctx.fillRect(px, py, s, s);
          ctx.strokeRect(px, py, s, s);
        });
      });
    }
    piece.shape.forEach((line, row) => {
      line.forEach((filled, col) => {
        if (filled) drawCell(ctx, piece.x + col, piece.y + row, piece.color);
      });
    });
  }, [getGhostY]);

  const stepDown = useCallback(() => {
    const game = gameRef.current;
    if (game.over || game.paused) return;
    const nextY = game.piece.y + 1;
    if (isValid(game.grid, game.piece.shape, game.piece.x, nextY)) {
      game.piece.y = nextY;
    } else {
      lockPiece();
    }
    drawFull();
  }, [lockPiece, drawFull]);

  useEffect(() => {
    drawFull();
    drawNextCanvas(nextRef.current, gameRef.current.next);
    const speed = Math.max(100, 700 - (gameRef.current.level - 1) * 60);
    const timer = window.setInterval(stepDown, speed);
    return () => window.clearInterval(timer);
  }, [stepDown, drawFull, display.level]);

  useEffect(() => {
    const onKey = (event) => {
      const game = gameRef.current;
      if (event.key === "p" || event.key === "P") {
        game.paused = !game.paused;
        refresh();
        return;
      }
      if (game.over || game.paused || !game.piece) return;
      const { piece, grid } = game;
      if (event.key === "ArrowLeft" && isValid(grid, piece.shape, piece.x - 1, piece.y)) piece.x -= 1;
      if (event.key === "ArrowRight" && isValid(grid, piece.shape, piece.x + 1, piece.y)) piece.x += 1;
      if (event.key === "ArrowDown" && isValid(grid, piece.shape, piece.x, piece.y + 1)) piece.y += 1;
      if (event.key === "ArrowUp") {
        const rotated = rotate(piece.shape);
        if (isValid(grid, rotated, piece.x, piece.y)) piece.shape = rotated;
      }
      if (event.key === " ") {
        let dropY = piece.y;
        while (isValid(grid, piece.shape, piece.x, dropY + 1)) dropY++;
        piece.y = dropY;
        lockPiece();
        event.preventDefault();
        drawFull();
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        drawFull();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lockPiece, drawFull, refresh]);

  return (
    <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: "22px 20px", boxShadow: C.shadow, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", marginBottom: 16 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: "0 0 3px", letterSpacing: "-0.02em", textAlign: "center" }}>기다리는 동안 테트리스 한 판</p>
        <p style={{ fontSize: 12, color: C.textMuted, margin: 0, textAlign: "center" }}>리포트 완성되면 자동으로 이동해요</p>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ position: "relative" }}>
          <canvas ref={canvasRef} width={COLS * CELL} height={ROWS * CELL}
            style={{ borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", display: "block", background: "#ffffff" }} />
          {(display.over || display.paused) && (
            <div style={{
              position: "absolute", inset: 0, borderRadius: 10, background: "rgba(0,0,0,0.72)",
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10,
            }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>{display.over ? "GAME OVER" : "PAUSED"}</p>
              {display.over && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0 }}>점수: {display.score}</p>}
              <button onClick={display.over ? restart : () => { gameRef.current.paused = false; refresh(); }}
                style={{ border: "none", borderRadius: 9, background: GREEN, color: "white", padding: "9px 18px", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {display.over ? "다시 시작" : "계속하기"}
              </button>
            </div>
          )}
        </div>

        {/* 우측 패널: NEXT + 스탯 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 140, flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em", margin: "0 0 6px" }}>NEXT</p>
            <canvas ref={nextRef} width={NEXT_SIZE * NEXT_CELL} height={NEXT_SIZE * NEXT_CELL}
              style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, display: "block" }} />
          </div>
          {[["SCORE", display.score], ["LINES", display.lines], ["LEVEL", display.level]].map(([label, val]) => (
            <div key={label} style={{ background: C.bg, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, letterSpacing: "0.08em", margin: "0 0 3px" }}>{label}</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: C.primary, margin: 0, fontVariantNumeric: "tabular-nums" }}>{val}</p>
            </div>
          ))}
          <p style={{ fontSize: 9, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
            ←→ 이동<br/>↑ 회전<br/>↓ 내리기<br/>Space 즉시낙하<br/>P 일시정지
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function ReportGeneratingPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const location = useLocation();
  const [stepIdx, setStepIdx] = useState(0);
  const [statusSummary, setStatusSummary] = useState(null);
  const [phase, setPhase] = useState("waiting_stt");
  const [error, setError] = useState("");
  const generatingRef = useRef(false);
  const role = String(location.state?.role || getAuthUser()?.role || "mentee").toLowerCase();
  const isMentorRole = role.includes("mentor");

  const goToReport = useCallback(() => {
    navigate(`/report/ai/${sessionId}`, { state: { role } });
  }, [navigate, role, sessionId]);

  // AI 분석 단계 사이클
  useEffect(() => {
    const id = setInterval(() => setStepIdx(prev => (prev + 1) % ANALYSIS_STEPS.length), 4000);
    return () => clearInterval(id);
  }, []);

  // STT 완료 대기 -> 리포트 생성 -> 완료 시 리포트 화면 이동
  useEffect(() => {
    if (!sessionId) return;
    if (USE_MOCK && /^\d+$/.test(String(sessionId))) { goToReport(); return; }
    if (!sessionId || !/^\d+$/.test(String(sessionId))) return;

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

        if ((summary.failed_count ?? 0) > 0 || (summary.question_failed_count ?? 0) > 0) {
          setPhase("stt_failed");
          setError("질문 또는 답변 음성 변환에 실패한 항목이 있어 리포트를 생성할 수 없습니다. 면접방에서 해당 질문/답변을 다시 진행한 뒤 시도해 주세요.");
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
          setError(err?.message || "리포트 생성 준비 중 문제가 발생했습니다. 잠시 후 다시 확인합니다.");
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
    if (phase === "stt_failed") return "음성 변환 실패 항목 확인 필요";
    if (phase === "generating_report") return "AI 리포트 생성 중";
    return "분석 중";
  })();

  const statusText = statusSummary
    ? `답변 ${statusSummary.completed_count}/${statusSummary.total_count}개 변환 완료 · 질문 대기 ${statusSummary.question_pending_count} · 진행 ${statusSummary.question_processing_count} · 실패 ${statusSummary.question_failed_count}`
    : "답변 상태 확인 중";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @media (max-width: 860px) { .rg-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* 헤더 — 대시보드와 동일한 흰 헤더 */}
      <header style={{ background: C.white, padding: "0 5%", position: "sticky", top: 0, zIndex: 100, boxShadow: `0 1px 0 ${C.border}, 0 2px 8px rgba(0,0,0,0.04)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.primaryGrad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(13,34,64,0.3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>Scene<span style={{ color: C.primary }}>A</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.success, animation: "pulse 1.2s ease-in-out infinite" }} />
            <span style={{ fontSize: 13, color: C.textSub, fontWeight: 600 }}>{progressLabel}</span>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "40px 5%", width: "100%" }}>
        <div className="rg-grid" style={{
          width: "100%",
          maxWidth: 1100,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "start",
        }}>

          {/* 왼쪽: 상태 카드 */}
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: "24px 26px", boxShadow: C.shadow, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* 타이틀 */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${C.border}`, borderTopColor: C.success, animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "0 0 2px", letterSpacing: "-0.03em" }}>AI 리포트 생성 중</p>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{statusText}</p>
              </div>
            </div>

            {/* 진행 단계 배너 */}
            <div style={{ background: C.successLight, border: `1px solid ${C.success}33`, borderRadius: 10, padding: "10px 14px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.success, margin: "0 0 2px" }}>{progressLabel}</p>
              <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6, margin: 0 }}>STT가 끝나면 AI 리포트가 자동 생성됩니다.</p>
            </div>

            {/* 단계 리스트 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ANALYSIS_STEPS.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: i <= stepIdx ? 1 : 0.35, transition: "opacity 0.4s" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: i < stepIdx ? C.success : i === stepIdx ? C.primary : C.border, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.4s" }}>
                    {i < stepIdx && <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{ fontSize: 12, color: i <= stepIdx ? C.text : C.textMuted }}>{step}</span>
                </div>
              ))}
            </div>

            {/* STT 상태 */}
            {statusSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["완료", statusSummary.completed_count, C.success], ["진행 중", statusSummary.processing_count, C.primary], ["대기", statusSummary.pending_count, "#F59E0B"], ["실패", statusSummary.failed_count, "#E03131"]].map(([label, value, color]) => (
                  <div key={label} style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: C.textSub }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color }}>{value ?? 0}</span>
                  </div>
                ))}
              </div>
            )}

            {error && <p style={{ fontSize: 12, color: "#B91C1C", background: "#FFF5F5", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 12px", margin: 0 }}>{error}</p>}

            {/* 건너뛰기 버튼 */}
            <button onClick={goToReport} style={{ padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
            >건너뛰고 리포트 보기 →</button>
          </div>

          {/* 오른쪽: 테트리스 */}
          <TetrisPanel />
        </div>
      </div>
    </div>
  );
}
