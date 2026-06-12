import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

/* ============================================================
   SceneA — 메인 홈 페이지  (pages/Home/index.jsx)
   딥 네이비 + 크림 컬러 시스템 / 반응형
   ============================================================ */

/* ── 컬러 & 스타일 상수 ── */
const C = {
  navy:     "#0D2240",   // Main 딥 네이비
  accent:   "#1B4F7A",   // Accent 미드 블루
  mid:      "#3A7FAF",   // Mid 스틸 블루
  cream:    "#E9ECEF",   // Border / Divider
  light:    "#E8EEF6",   // Light tint
  bg:       "#F0F4F8",   // BG 백그라운드
  white:    "#FFFFFF",
  text:     "#1A1B1E",
  textSub:  "#495057",
  textMuted:"#868E96",
};

/* ── 글로벌 CSS ── */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { scroll-behavior: smooth; overflow-x: hidden; }

    body {
      font-family: 'Inter', 'Noto Sans KR', -apple-system, sans-serif;
      background: ${C.bg};
      color: ${C.text};
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* ── 스크롤 애니메이션 ── */
    .fade-up {
      opacity: 0;
      transform: translateY(32px);
      transition: opacity 0.7s ease, transform 0.7s ease;
    }
    .fade-up.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Hero blob ── */
    @keyframes blobDrift {
      0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
      50%       { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
    }

    /* ── Hero 파티클 ── */
    @keyframes floatUp {
      0%   { transform: translateY(0px) scale(1);   opacity: 0;   }
      8%   { opacity: 1; }
      88%  { opacity: 0.65; }
      100% { transform: translateY(-105vh) scale(1.15); opacity: 0; }
    }

    /* ── Hero 링 회전 ── */
    @keyframes ringRotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes ringRotateRev {
      from { transform: rotate(0deg); }
      to   { transform: rotate(-360deg); }
    }

    /* ── 반응형 브레이크포인트 ── */
    @media (max-width: 768px) {
      .step-row { flex-direction: column !important; }
      .step-row.reverse { flex-direction: column !important; }
      .mentor-grid { grid-template-columns: 1fr 1fr !important; }
      .review-grid { grid-template-columns: 1fr !important; }
      .hero-title { font-size: 32px !important; }
      .section-title { font-size: 26px !important; }
      .bottom-cta-wrap { flex-direction: column !important; gap: 2rem !important; text-align: center; }
    }
    @media (max-width: 480px) {
      .mentor-grid { grid-template-columns: 1fr !important; }
      .hero-title { font-size: 26px !important; }
    }

    @keyframes marquee {
      from { transform: translateX(0); }
      to   { transform: translateX(-50%); }
    }
  `}</style>
);

/* ── 로고 아이콘 SVG ── */
const LogoIcon = ({ size = 28, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="2" fill={color} />
    {[0,45,90,135,180,225,270,315].map((deg, i) => {
      const r = deg * Math.PI / 180;
      const x1 = 14 + 2.5 * Math.cos(r), y1 = 14 + 2.5 * Math.sin(r);
      const x2 = 14 + 10 * Math.cos(r), y2 = 14 + 10 * Math.sin(r);
      return (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      );
    })}
    {[0,90,180,270].map((deg, i) => {
      const r = deg * Math.PI / 180;
      const mx = 14 + 7 * Math.cos(r), my = 14 + 7 * Math.sin(r);
      const offR = r + Math.PI / 2;
      return (
        <g key={`branch-${i}`}>
          <line x1={mx} y1={my}
            x2={mx + 3 * Math.cos(offR)} y2={my + 3 * Math.sin(offR)}
            stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <line x1={mx} y1={my}
            x2={mx - 3 * Math.cos(offR)} y2={my - 3 * Math.sin(offR)}
            stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    })}
  </svg>
);

/* ── 헤더 ── */
const Header = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: C.navy,
      borderBottom: scrolled ? `1px solid rgba(255,255,255,0.08)` : "none",
      transition: "border-bottom 0.3s ease",
      padding: "0 5%",
    }}>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 68,
      }}>
        {/* 로고 */}
        <Link to="/" style={{
          display: "flex", alignItems: "center", gap: 10,
          textDecoration: "none",
        }}>
          <LogoIcon size={28} color={C.white} />
          <span style={{
            fontFamily: "'Noto Sans KR', sans-serif",
            fontWeight: 700, fontSize: 18, color: C.white, letterSpacing: "-0.3px",
          }}>
            SceneA
          </span>
        </Link>

        {/* 우측 버튼 */}
        <Link to="/auth/login" style={{
          background: C.white, color: C.navy,
          fontFamily: "'Noto Sans KR', sans-serif",
          fontSize: 14, fontWeight: 500,
          padding: "9px 22px", borderRadius: 999,
          textDecoration: "none",
          transition: "background 0.2s",
        }}
          onMouseEnter={e => e.target.style.background = C.cream}
          onMouseLeave={e => e.target.style.background = C.white}
        >
          로그인
        </Link>
      </nav>
    </header>
  );
};

/* ── 히어로 파티클 · 링 데이터 (정적) ── */
const HERO_PARTICLES = [
  { size:4,  left:7,  dur:13, delay:0    },
  { size:6,  left:16, dur:17, delay:-3.5 },
  { size:3,  left:25, dur:11, delay:-7   },
  { size:8,  left:33, dur:19, delay:-1.2 },
  { size:4,  left:41, dur:14, delay:-9   },
  { size:5,  left:50, dur:13, delay:-4.8 },
  { size:3,  left:58, dur:18, delay:-11  },
  { size:7,  left:67, dur:15, delay:-2.3 },
  { size:4,  left:76, dur:12, delay:-6.5 },
  { size:6,  left:85, dur:20, delay:-14  },
  { size:3,  left:12, dur:10, delay:-5.5 },
  { size:5,  left:39, dur:16, delay:-8.2 },
  { size:6,  left:63, dur:14, delay:-10  },
  { size:4,  left:82, dur:15, delay:-13  },
  { size:8,  left:93, dur:18, delay:-3   },
];

const HERO_RINGS = [
  { size:520, opacity:0.055, dur:32, delay:0,   tilt:22,  rev:false },
  { size:340, opacity:0.075, dur:21, delay:-8,  tilt:-18, rev:true  },
  { size:720, opacity:0.03,  dur:46, delay:-20, tilt:38,  rev:false },
];

/* ── 히어로 섹션 ── */
const Hero = () => (
  <section style={{
    background: C.navy,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    padding: "80px 5% 80px",
    textAlign: "center",
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
  }}>
    {/* 블롭 배경 */}
    {[
      { color: "#3A7FAF", top: "10%", left: "5%",  w: 380, h: 340, delay: "0s"   },
      { color: "#1B4F7A", top: "5%",  left: "45%", w: 320, h: 290, delay: "4s"   },
      { color: "#E8E0D0", top: "40%", left: "60%", w: 300, h: 260, delay: "2s"   },
      { color: "#3A7FAF", top: "50%", left: "10%", w: 260, h: 240, delay: "6s"   },
      { color: "#1B4F7A", top: "25%", left: "30%", w: 200, h: 180, delay: "3s"   },
    ].map((b, i) => (
      <div key={i} style={{
        position: "absolute", top: b.top, left: b.left,
        width: b.w, height: b.h,
        background: b.color,
        opacity: 0.18,
        filter: "blur(60px)",
        borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
        animation: `blobDrift 12s ease-in-out ${b.delay} infinite alternate`,
        pointerEvents: "none",
      }} />
    ))}

    {/* 회전 링 */}
    {HERO_RINGS.map((ring, i) => (
      <div key={`ring-${i}`} style={{
        position: "absolute",
        top: "50%", left: "50%",
        width: ring.size, height: ring.size,
        marginTop: -ring.size / 2,
        marginLeft: -ring.size / 2,
        transform: `rotateX(${ring.tilt}deg)`,
        pointerEvents: "none",
      }}>
        <div style={{
          width: "100%", height: "100%",
          borderRadius: "50%",
          border: `1px solid rgba(255,255,255,${ring.opacity})`,
          animation: `${ring.rev ? "ringRotateRev" : "ringRotate"} ${ring.dur}s linear ${ring.delay}s infinite`,
        }}>
          {/* 링 위의 작은 점 */}
          <div style={{
            position: "absolute", top: -3, left: "50%",
            width: 6, height: 6, marginLeft: -3,
            borderRadius: "50%",
            background: `rgba(255,255,255,${ring.opacity * 3.5})`,
          }}/>
        </div>
      </div>
    ))}

    {/* 플로팅 파티클 */}
    {HERO_PARTICLES.map((p, i) => (
      <div key={`p-${i}`} style={{
        position: "absolute",
        bottom: "-5%",
        left: `${p.left}%`,
        width: p.size,
        height: p.size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.55)",
        boxShadow: p.size >= 6 ? "0 0 8px rgba(255,255,255,0.3)" : "none",
        animation: `floatUp ${p.dur}s ease-in-out ${p.delay}s infinite`,
        pointerEvents: "none",
      }}/>
    ))}

    {/* 콘텐츠 */}
    <div style={{ position: "relative", zIndex: 1, maxWidth: 760 }}>
      <p style={{
        fontSize: 12, fontWeight: 500, letterSpacing: "0.15em",
        color: "rgba(255,255,255,0.55)", textTransform: "uppercase",
        marginBottom: 24,
      }}>
        AI × 현직자 하이브리드 모의 면접 플랫폼
      </p>

      <h1 className="hero-title" style={{
        fontSize: 48, fontWeight: 700, color: C.white,
        lineHeight: 1.25, letterSpacing: "-0.02em",
        marginBottom: 20,
      }}>
        "면접, 더 이상
        <br />
        혼자 준비하지 마세요"
      </h1>

      <h2 style={{
        fontSize: 22, fontWeight: 400, color: "rgba(255,255,255,0.72)",
        lineHeight: 1.5, marginBottom: 48,
      }}>
        AI가 분석하고, 현직자가 완성합니다
      </h2>

      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <Link to="/auth/register" style={{
          background: C.white, color: C.navy,
          fontSize: 15, fontWeight: 700,
          padding: "14px 36px", borderRadius: 999,
          textDecoration: "none",
          transition: "transform 0.2s, background 0.2s",
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          면접 참여하러 가기
        </Link>
      </div>
    </div>

    {/* 하단 페이드 */}
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: 100,
      background: `linear-gradient(to bottom, transparent, ${C.bg})`,
    }} />
  </section>
);

/* ── STEP 피처 섹션 ── */
const steps = [
  {
    num: "STEP 01",
    title: "AI 기반 정밀 역량 매칭",
    desc: "AI가 목표 기업의 공고와 당신의 자소서를 교차 분석하여 핵심 역량을 추출합니다. 이를 바탕으로 현직자 멘토가 당신만을 위한 맞춤형 면접 질문을 설계합니다.",
    reverse: false,
    accent: "#D6E8F5",
    tag: "Smart Matching",
  },
  {
    num: "STEP 02",
    title: "실시간 하이브리드 모의 면접",
    desc: "화상 면접이 진행됩니다. AI는 실시간으로 당신의 발화 속도와 답변 구조를 분석하고, 멘토는 맞은편에서 당신의 태도와 경험의 전달성을 놓치지 않고 체크합니다.",
    reverse: true,
    accent: "#E0EBF5",
    tag: "Live Session",
  },
  {
    num: "STEP 03",
    title: "데이터와 경험이 결합된 진화형 리포트",
    desc: "AI 정량적 평가(말하기 속도, 침묵, 논리성)와 멘토의 경험 기반 코칭이 결합된 1차·2차 리포트를 제공합니다. 당신의 약점을 정확하게 알고 강화할 수 있는 가장 완벽한 피드백을 만나보세요.",
    reverse: false,
    accent: "#DDE6F2",
    tag: "Dual Report",
  },
];

/* ── STEP 03 리포트 일러스트 ── */
const ReportIllustration = () => {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActive(true); },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const bars = [
    { pct: 72, color: "#1D9E75" },
    { pct: 85, color: "#3A7FAF" },
    { pct: 58, color: "#1D9E75" },
    { pct: 80, color: "#3A7FAF" },
  ];
  return (
    <div ref={ref} style={{
      background: C.navy,
      borderRadius: 20,
      overflow: "hidden",
      aspectRatio: "16/10",
      display: "flex",
      flexDirection: "column",
      padding: "18px 20px",
      gap: 12,
      boxShadow: "0 24px 60px rgba(13,34,68,0.18)",
      position: "relative",
    }}>
      <style>{`
        @keyframes rBar {
          0%, 5%    { transform: scaleX(0); }
          50%       { transform: scaleX(1); }
          82%       { transform: scaleX(1); }
          96%, 100% { transform: scaleX(0); }
        }
      `}</style>

      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#1D9E75" }}/>
          <span style={{ color:"rgba(255,255,255,0.9)", fontSize:11, fontWeight:700, fontFamily:"'Noto Sans KR',sans-serif", letterSpacing:"-0.2px" }}>
            면접 리포트
          </span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {["AI 분석","멘토 평가"].map((t,i) => (
            <div key={i} style={{
              padding:"2px 8px", borderRadius:999, fontSize:8.5,
              background: i===0 ? "rgba(29,158,117,0.2)" : "rgba(58,127,175,0.2)",
              color: i===0 ? "#1D9E75" : "#3A7FAF",
              fontFamily:"'Noto Sans KR',sans-serif", fontWeight:600,
              border: `1px solid ${i===0 ? "rgba(29,158,117,0.35)" : "rgba(58,127,175,0.3)"}`,
            }}>{t}</div>
          ))}
        </div>
      </div>

      {/* 본문 2열 */}
      <div style={{ flex:1, display:"flex", gap:14, minHeight:0 }}>

        {/* 왼쪽: 게이지 바 */}
        <div style={{ flex:1.1, display:"flex", flexDirection:"column", justifyContent:"space-evenly" }}>
          {bars.map((b, i) => (
            <div key={i} style={{ height:9, background:"rgba(255,255,255,0.07)", borderRadius:999, overflow:"hidden" }}>
              <div style={{
                height:"100%", borderRadius:999,
                background:`linear-gradient(90deg, ${b.color}, ${b.color}77)`,
                width:`${b.pct}%`,
                transformOrigin:"left center",
                animation: active
                  ? `rBar 3.8s ${0.3*i}s cubic-bezier(0.4,0,0.2,1) infinite`
                  : "none",
              }}/>
            </div>
          ))}
        </div>

        {/* 구분선 */}
        <div style={{ width:1, background:"rgba(255,255,255,0.07)", flexShrink:0 }}/>

        {/* 오른쪽: 멘토 코칭 */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:8.5, color:"rgba(255,255,255,0.4)", fontFamily:"'Noto Sans KR',sans-serif", letterSpacing:"0.08em", textTransform:"uppercase" }}>
            멘토 코칭
          </div>
          {/* 별점 */}
          <div style={{ display:"flex", gap:2 }}>
            {[1,2,3,4,5].map(s => (
              <div key={s} style={{ fontSize:11, color: s<=4 ? "#F59E0B" : "rgba(255,255,255,0.15)" }}>★</div>
            ))}
            <span style={{ fontSize:9, color:"rgba(255,255,255,0.5)", marginLeft:4, fontFamily:"'Noto Sans KR',sans-serif" }}>4.2</span>
          </div>
          {/* 피드백 줄 */}
          {[
            { w:"90%", color:"rgba(255,255,255,0.18)" },
            { w:"75%", color:"rgba(255,255,255,0.12)" },
            { w:"85%", color:"rgba(255,255,255,0.18)" },
            { w:"60%", color:"rgba(255,255,255,0.12)" },
            { w:"80%", color:"rgba(255,255,255,0.18)" },
          ].map((l,i) => (
            <div key={i} style={{ height:5, background:l.color, borderRadius:999, width:l.w }}/>
          ))}
          {/* 개선 포인트 태그 */}
          <div style={{ display:"flex", gap:5, marginTop:2, flexWrap:"wrap" }}>
            {["말하기 속도","STAR 구조"].map((t,i) => (
              <div key={i} style={{
                padding:"2px 7px", borderRadius:999, fontSize:7.5,
                background:"rgba(245,255,78,0.1)",
                color:"#F5FF4E",
                border:"1px solid rgba(245,255,78,0.25)",
                fontFamily:"'Noto Sans KR',sans-serif",
              }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 종합 점수 */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:10,
      }}>
        <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontFamily:"'Noto Sans KR',sans-serif" }}>종합 역량 점수</span>
        <div style={{ display:"flex", alignItems:"baseline", gap:3 }}>
          <span style={{ fontSize:18, fontWeight:800, color:"#1D9E75", fontFamily:"'Noto Sans KR',sans-serif" }}>82</span>
          <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", fontFamily:"'Noto Sans KR',sans-serif" }}>/100</span>
        </div>
      </div>
    </div>
  );
};

/* 플레이스홀더 "화면 미리보기" 카드 */
const ScreenPreview = ({ accent, num }) => (
  <div style={{
    background: C.navy,
    borderRadius: 20,
    overflow: "hidden",
    aspectRatio: "16/10",
    display: "flex",
    flexDirection: "column",
    padding: 20,
    gap: 10,
    boxShadow: `0 24px 60px rgba(13,34,68,0.18)`,
  }}>
    {/* 가짜 헤더 바 */}
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {["#F87171","#FBBF24","#34D399"].map((c, i) => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
      ))}
    </div>
    {/* 가짜 컨텐츠 */}
    <div style={{ flex: 1, display: "flex", gap: 10 }}>
      <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 10, background: "rgba(255,255,255,0.12)", borderRadius: 4, width: "60%" }} />
        <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4, width: "80%" }} />
        <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4, width: "55%" }} />
        <div style={{ height: 40, background: accent, borderRadius: 10, marginTop: 8, opacity: 0.7 }} />
        <div style={{ height: 40, background: "rgba(255,255,255,0.06)", borderRadius: 10 }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 10 }} />
        <div style={{ height: 30, background: C.mid, borderRadius: 8, opacity: 0.8 }} />
      </div>
    </div>
  </div>
);

/* ── STEP 01 3D 구 일러스트 ── */
const NetworkGraphIllustration = () => {
  const R = 125;
  const kwList = [
    { label: "역량",    size: 13, bold: true  },
    { label: "인재상",  size: 12, bold: false },
    { label: "자소서",  size: 11, bold: false },
    { label: "직무",    size: 13, bold: true  },
    { label: "강점",    size: 11, bold: false },
    { label: "경험",    size: 12, bold: false },
    { label: "핵심역량", size: 11, bold: true  },
    { label: "분석",    size: 12, bold: false },
    { label: "매칭",    size: 13, bold: false },
    { label: "면접준비", size: 11, bold: false },
    { label: "AI 분석", size: 13, bold: true  },
    { label: "역량분석", size: 11, bold: false },
  ];
  const n = kwList.length;
  const items = kwList.map((kw, i) => {
    const phi   = Math.acos(1 - 2 * (i + 0.5) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const ry = ((theta * 180 / Math.PI) % 360).toFixed(2);
    const rx = (-(phi * 180 / Math.PI - 90)).toFixed(2);
    return { ...kw, ry, rx };
  });

  return (
    <div style={{
      background: "#0D2240",
      borderRadius: 20,
      overflow: "hidden",
      aspectRatio: "16/10",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      perspective: "600px",
      position: "relative",
      boxShadow: "0 24px 60px rgba(13,34,68,0.18)",
    }}>
      <style>{`
        @keyframes ngSphere {
          0%   { transform: rotateY(0deg)   rotateX(18deg); }
          50%  { transform: rotateY(180deg) rotateX(-6deg); }
          100% { transform: rotateY(360deg) rotateX(18deg); }
        }
        @keyframes ngCG { 0%,100%{opacity:0.22} 50%{opacity:0.06} }
      `}</style>

      {/* 배경 도트 */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
        {[...Array(5)].map((_,r) => [...Array(10)].map((_,c) => (
          <circle key={`${r}${c}`} cx={c*46+23} cy={r*50+25} r="1" fill="rgba(255,255,255,0.04)"/>
        )))}
      </svg>

      {/* 중앙 글로우 레이어 */}
      <div style={{
        position:"absolute", zIndex:5, pointerEvents:"none",
        display:"flex", flexDirection:"column", alignItems:"center", gap:4,
      }}>
        <div style={{
          width:80, height:80, borderRadius:"60%",
          background:"radial-gradient(circle, rgba(245,255,78,0.18) 0%, rgba(245,255,78,0.03) 70%)",
          animation:"ngCG 3s ease-in-out infinite",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 0 36px rgba(245,255,78,0.25)",
        }}>
          <span style={{
            color:"#eef73c", fontSize:15, fontWeight:900,
            fontFamily:"'Noto Sans KR', sans-serif",
            letterSpacing:"-0.5px",
            textShadow:"0 0 16px rgba(218, 222, 145, 0.9), 0 0 32px rgba(245,255,78,0.4)",
          }}>AI 분석</span>
        </div>
      </div>

      {/* 3D 회전 구 */}
      <div style={{
        position:"relative",
        width:240, height:240,
        transformStyle:"preserve-3d",
        animation:"ngSphere 26s linear infinite",
      }}>
        {items.map(({ label, ry, rx, size, bold }, i) => (
          <div key={i} style={{
            position:"absolute",
            left:"50%", top:"50%",
            transform:`rotateY(${ry}deg) rotateX(${rx}deg) translateZ(${R}px) translateX(-50%) translateY(-50%)`,
            color: bold ? "rgba(29,158,117,0.95)" : "rgba(255,255,255,0.78)",
            fontSize: size,
            whiteSpace:"nowrap",
            fontFamily:"'Noto Sans KR', sans-serif",
            fontWeight: bold ? 600 : 400,
            letterSpacing:"-0.2px",
            textShadow: bold ? "0 0 12px rgba(29,158,117,0.5)" : "none",
          }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── STEP 02 화상면접 일러스트 ── */
const VideoCallIllustration = () => (
  <div style={{
    background: "#0A1929",
    borderRadius: 20,
    overflow: "hidden",
    aspectRatio: "16/10",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 60px rgba(13,34,68,0.18)",
    position: "relative",
  }}>
    <style>{`
      @keyframes speakRing { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.15);opacity:1} }
      @keyframes wb1 { 0%,100%{height:6px} 50%{height:18px} }
      @keyframes wb2 { 0%,100%{height:10px} 50%{height:24px} }
      @keyframes wb3 { 0%,100%{height:4px} 50%{height:14px} }
      @keyframes recDot { 0%,100%{opacity:1} 50%{opacity:0} }
    `}</style>

    {/* 상단 바 */}
    <div style={{ background:"#0D2240", padding:"7px 14px", display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:"#1D9E75" }}/>
      <div style={{ width:42, height:5, background:"rgba(255,255,255,0.15)", borderRadius:3 }}/>
      <div style={{ width:24, height:5, background:"rgba(255,255,255,0.08)", borderRadius:3 }}/>
      <div style={{ flex:1 }}/>
      {["#1B4F7A","#3A7FAF","#1D9E75"].map((c,i) => (
        
        <div key={i} style={{ width:20, height:20, borderRadius:"50%", background:c, marginLeft:i>0?-8:0, border:"1.5px solid #0A1929" }}/>
      ))}
      <div style={{ width:7, height:7, borderRadius:"50%", background:"#F87171", animation:"recDot 1.4s ease-in-out infinite", marginLeft:6 }}/>
      <div style={{ width:36, height:16, background:"rgba(255,255,255,0.08)", borderRadius:6 }}/>
    </div>

    {/* 메인 영상 영역 */}
    <div style={{ flex:1, display:"flex", gap:5, padding:"5px", minHeight:0 }}>
      {/* 메인 타일 (멘토) */}
      <div style={{ flex:3, position:"relative", background:"#0D2240", borderRadius:12, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {/* 발언 링 */}
        <div style={{ position:"absolute", width:62, height:62, borderRadius:"50%", border:"2px solid #1D9E75", animation:"speakRing 2s ease-in-out infinite" }}/>
        {/* 아바타 */}
        <div style={{ width:48, height:48, borderRadius:"50%", background:"#1B4F7A", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1 }}>
          <div style={{ width:18, height:18, borderRadius:"50%", background:"rgba(255,255,255,0.4)" }}/>
        </div>
        {/* 몸 형태 */}
        <div style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:58, height:28, background:"#1B4F7A", borderRadius:"28px 28px 0 0", opacity:0.55 }}/>
        {/* 파형 */}
        <div style={{ position:"absolute", bottom:10, left:12, display:"flex", alignItems:"flex-end", gap:2 }}>
          {[1,2,1,3,2,1,2].map((h,i) => (
            <div key={i} style={{ width:3, borderRadius:2, background:"#1D9E75", animation:`wb${(i%3)+1} ${0.7+i*0.12}s ease-in-out infinite`, height:6*h }}/>
          ))}
        </div>
        {/* 이름 뱃지 형태 */}
        <div style={{ position:"absolute", bottom:8, right:10, background:"rgba(0,0,0,0.4)", borderRadius:6, width:48, height:10 }}/>
      </div>

      {/* 우측 서브 타일 2개 */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:5 }}>
        {["#1B4F7A","#3A7FAF"].map((c,i) => (
          <div key={i} style={{ flex:1, background:c, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:"rgba(255,255,255,0.22)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:"rgba(255,255,255,0.4)" }}/>
            </div>
            {i===1 && (
              <svg style={{ position:"absolute", bottom:5, right:5 }} width="12" height="12" viewBox="0 0 12 12">
                <line x1="2" y1="2" x2="10" y2="10" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="10" y1="2" x2="2" y2="10" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* 하단 컨트롤 바 */}
    <div style={{ background:"#0D2240", padding:"7px 14px", display:"flex", alignItems:"center", justifyContent:"center", gap:8, flexShrink:0 }}>
      {/* 마이크 */}
      <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
          <rect x="3" y="1" width="6" height="8" rx="3" fill="rgba(255,255,255,0.6)"/>
          <path d="M1 7c0 2.76 2.24 5 5 5s5-2.24 5-5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <line x1="6" y1="12" x2="6" y2="14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      {/* 카메라 */}
      <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <rect x="1" y="1" width="8" height="8" rx="2" fill="rgba(255,255,255,0.6)"/>
          <path d="M9 3.5L13 1.5v7L9 6.5V3.5Z" fill="rgba(255,255,255,0.6)"/>
        </svg>
      </div>
      {/* 공유 */}
      <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
          <rect x="1" y="4" width="11" height="7" rx="1.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2"/>
          <path d="M4.5 4V3a2 2 0 014 0v1" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
      {/* 답변 버튼 형태 */}
      <div style={{ width:52, height:22, background:"#1D9E75", borderRadius:999 }}/>
      {/* 종료 */}
      <div style={{ width:30, height:30, borderRadius:"50%", background:"#F87171", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <svg width="13" height="8" viewBox="0 0 13 8" fill="none">
          <path d="M1 4C2 1 11 1 12 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <path d="M1 4l1.5 2.5M12 4l-1.5 2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  </div>
);

const FeaturesSection = () => (
  <section style={{ background: C.bg, padding: "100px 5%" }}>
      {steps.map((step, i) => (
        <div
          key={i}
          className={`step-row fade-up ${step.reverse ? "reverse" : ""}`}
          style={{
            display: "flex",
            flexDirection: step.reverse ? "row-reverse" : "row",
            alignItems: "center",
            gap: "6%",
            marginBottom: i < steps.length - 1 ? 120 : 0,
          }}
        >
          {/* 텍스트 */}
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 22, fontWeight: 800, letterSpacing: "0.22em",
              color: C.mid, textTransform: "uppercase", display: "block",
              marginBottom: 16,
            }}>
              {step.num}
            </span>
            <h3 className="section-title" style={{
              fontSize: 30, fontWeight: 700, color: C.navy,
              lineHeight: 1.3, letterSpacing: "-0.02em", marginBottom: 20,
            }}>
              {step.title}
            </h3>
            <p style={{
              fontSize: 15, color: C.textSub, lineHeight: 1.85,
              wordBreak: "keep-all",
            }}>
              {step.desc}
            </p>
            <div style={{
              display: "inline-block", marginTop: 28,
              background: step.accent, color: C.accent,
              fontSize: 12, fontWeight: 600, padding: "6px 16px",
              borderRadius: 999, letterSpacing: "0.05em",
            }}>
              {step.tag}
            </div>
          </div>

          {/* 비주얼 */}
          <div style={{ flex: 0.85 }}>
            {i === 0
              ? <NetworkGraphIllustration />
              : i === 1
                ? <VideoCallIllustration />
                : <ReportIllustration />}
          </div>
        </div>
      ))}
  </section>
);

/* ── 멘토 카드 섹션 ── */
const mentors = [
  { initials: "박J", name: "박지훈", company: "네이버", role: "백엔드 개발", years: 6, tags: ["기술 면접", "JAVA/Spring", "대규모 보안 처리 경험"], rating: 4.9, reviews: 42 },
  { initials: "이S", name: "이수연", company: "카카오", role: "프론트엔드", years: 5, tags: ["기술 면접", "React", "성능 최적화"], rating: 4.8, reviews: 38 },
  { initials: "최H", name: "최현아", company: "라인", role: "풀스택 개발", years: 4, tags: ["포트폴리오 리뷰", "TypeScript", "DevOps"], rating: 4.7, reviews: 29 },
  { initials: "김D", name: "김도현", company: "쿠팡", role: "데이터 엔지니어", years: 7, tags: ["기술 면접", "Python", "데이터 파이프라인"], rating: 5.0, reviews: 55 },
  { initials: "정M", name: "정민서", company: "토스", role: "iOS 개발", years: 3, tags: ["기술 면접", "Swift", "앱 아키텍처"], rating: 4.6, reviews: 21 },
  { initials: "한G", name: "한기욱", company: "배달의민족", role: "인프라/SRE", years: 8, tags: ["인성 면접", "클라우드", "MSA"], rating: 4.9, reviews: 63 },
];

const StarRating = ({ val }) => (
  <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
    {"★★★★★".split("").map((s, i) => (
      <span key={i} style={{
        fontSize: 12,
        color: i < Math.floor(val) ? "#F59E0B" : "#D1CFC9",
      }}>★</span>
    ))}
    <span style={{ fontSize: 12, color: C.textSub, marginLeft: 4 }}>{val}</span>
  </span>
);

const MentorCard = ({ mentor }) => {
  const colors = ["#1B4F7A","#0F6E56","#533BA0","#8B4513","#1A5276","#145A32"];
  const bg = colors[mentors.indexOf(mentor) % colors.length];

  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      padding: "20px 20px 18px",
      border: `1px solid ${C.cream}`,
      transition: "transform 0.25s, box-shadow 0.25s",
      cursor: "pointer",
      width: 300,
      flexShrink: 0,
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 12px 32px rgba(13,34,68,0.12)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* 상단 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: bg, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: C.white,
        }}>
          {mentor.initials}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>{mentor.name} 멘토</div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 1 }}>
            {mentor.company} · {mentor.role} {mentor.years}년차
          </div>
        </div>
      </div>

      {/* 태그 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {mentor.tags.map((t, i) => (
          <span key={i} style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 999,
            background: C.light, color: C.textSub,
          }}>
            #{t}
          </span>
        ))}
      </div>

      {/* 하단 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.cream}`, paddingTop: 12 }}>
        <StarRating val={mentor.rating} />
        <span style={{ fontSize: 12, color: C.textMuted }}>후기 {mentor.reviews}건</span>
      </div>
    </div>
  );
};

const MentorsSection = () => {
  const doubled = [...mentors, ...mentors];
  return (
    <section style={{ background: C.navy, padding: "100px 0" }}>
      <div className="fade-up" style={{ textAlign: "center", marginBottom: 56, padding: "0 5%" }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.18em",
          color: C.mid, textTransform: "uppercase", marginBottom: 14 }}>
          지금 당신을 기다리는
        </p>
        <h2 className="section-title" style={{
          fontSize: 34, fontWeight: 700, color: C.white,
          letterSpacing: "-0.02em",
        }}>
          현직자 멘토
        </h2>
        <p style={{ marginTop: 16, fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}>
          SceneA와 함께한 멘티들의 이야기
        </p>
      </div>

      {/* 무한 마퀴 */}
      <div style={{ overflow: "hidden", position: "relative" }}>
        {/* 좌우 페이드 엣지 */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 100,
          background: `linear-gradient(to right, ${C.navy}, transparent)`,
          zIndex: 2, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 100,
          background: `linear-gradient(to left, ${C.navy}, transparent)`,
          zIndex: 2, pointerEvents: "none",
        }} />

        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "8px 0 16px",
            width: "max-content",
            animation: "marquee 32s linear infinite",
          }}
          onMouseEnter={e => { e.currentTarget.style.animationPlayState = "paused"; }}
          onMouseLeave={e => { e.currentTarget.style.animationPlayState = "running"; }}
        >
          {doubled.map((m, i) => <MentorCard key={i} mentor={m} />)}
        </div>
      </div>

      <div className="fade-up" style={{ textAlign: "center", marginTop: 48, padding: "0 5%" }}>
        <Link to="/auth/login" style={{
          display: "inline-block",
          background: C.mid, color: C.white,
          fontSize: 15, fontWeight: 600,
          padding: "14px 40px", borderRadius: 999,
          textDecoration: "none",
          transition: "background 0.2s, transform 0.2s",
        }}
          onMouseEnter={e => {
            e.currentTarget.style.background = C.accent;
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = C.mid;
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          전체 멘토 보기 →
        </Link>
      </div>
    </section>
  );
};

/* ── 멘티 후기 섹션 ── */
const reviews = [
  { initials: "김M", name: "김민준", bg: "#1B4F7A", company: "카카오 백엔드 개발자 지원", stars: 5,
    text: "실제 현장에서 어떤 답변을 원하는지 구체적으로 알려주셔서 너무 좋았어요. STAR 구조 피드백 덕분에 다음 면접에서 훨씬 자신감 있게 답변할 수 있었습니다!" },
  { initials: "박S", name: "박서연", bg: "#0F6E56", company: "네이버 프론트엔드 지원", stars: 4,
    text: "AI 리포트로 제 약점을 정확히 파악하고, 멘토님이 그 부분을 집중 코칭해주셔서 단기간에 많이 성장한 느낌이에요. 강력 추천합니다." },
  { initials: "이J", name: "이준석", bg: "#533BA0", company: "라인 지원", stars: 4,
    text: "기술 면접 준비에 정말 큰 도움이 됐어요. 다음 세션도 꼭 신청할 예정입니다. WPM 분석으로 말하기 속도가 문제였다는 걸 처음 알게 됐어요." },
];

const ReviewCard = ({ review }) => (
  <div style={{
    background: C.white, borderRadius: 16, padding: "24px",
    border: `1px solid ${C.cream}`,
  }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
      {"★★★★★".split("").map((s, i) => (
        <span key={i} style={{ fontSize: 14, color: i < review.stars ? "#F59E0B" : "#D1CFC9" }}>★</span>
      ))}
    </div>
    <p style={{ fontSize: 14, color: C.text, lineHeight: 1.8, marginBottom: 20, wordBreak: "keep-all" }}>
      {review.text}
    </p>
    <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid ${C.cream}`, paddingTop: 16 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: review.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: C.white, flexShrink: 0,
      }}>
        {review.initials}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{review.name}</div>
        <div style={{ fontSize: 12, color: C.textMuted }}>{review.company}</div>
      </div>
    </div>
  </div>
);


const ReviewsAndCTA = () => (
  <section style={{
    background: C.bg,
    padding: "100px 5%",
    /* 가로 스크롤 차단 */
    overflow: "hidden",
  }}>
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
      gap: "60px",
      alignItems: "start",
    }}>

      {/* ── 왼쪽: 실제 멘티들의 후기 ── */}
      <div className="fade-up">
        <p style={{
          fontSize: 12, fontWeight: 600, letterSpacing: "0.18em",
          color: C.mid, textTransform: "uppercase",
          marginBottom: 14,
        }}>
          Real Story
        </p>
        <h2 style={{
          fontSize: 28, fontWeight: 700, color: C.navy,
          letterSpacing: "-0.02em", marginBottom: 6,
        }}>
          실제 멘티들의 후기
        </h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 36 }}>
          현직자 멘토와 함께한 실제 멘티들의 솔직한 후기입니다.
        </p>

        {/* 후기 카드 리스트 — 세로 스택 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            {
              initials: "박S", bg: "#533BA0", name: "박서연", role: "카카오 프론트엔드 개발자 최종 합격", stars: 5,
              text: "AI 리포트로 제 WPM이 기준보다 30% 빠르다는 걸 처음 알았어요. 멘토님이 그 부분만 집중 코칭해주셔서 실제 면접에서 훨씬 안정적으로 말할 수 있었습니다. 강력 추천합니다.",
            },
            {
              initials: "이J", bg: "#8B4513", name: "이준석", role: "네이버 백엔드 1차 통과", stars: 5,
              text: "기술 면접에서 매번 두루뭉술하게 답했는데, STAR 구조 피드백 받고 나서 완전히 달라졌어요. 멘토님이 현장에서 어떤 걸 원하는지 구체적으로 알려주셔서 너무 좋았습니다.",
            },
            {
              initials: "김M", bg: "#145A32", name: "김민준", role: "토스 iOS 개발자 지원", stars: 4,
              text: "SceneA 없었으면 면접 준비 방향 자체를 잘못 잡았을 것 같아요. AI가 제 답변의 논리 구조 문제를 짚어주고 멘토님이 개선 방향을 잡아줘서 단기간에 많이 성장했습니다.",
            },
          ].map((r, i) => (
            <div key={i} style={{
              background: C.white,
              borderRadius: 14,
              padding: "18px 20px",
              border: `1px solid ${C.cream}`,
            }}>
              {/* 별점 */}
              <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
                {"★★★★★".split("").map((s, j) => (
                  <span key={j} style={{ fontSize: 13, color: j < r.stars ? "#F59E0B" : "#D1CFC9" }}>★</span>
                ))}
              </div>
              {/* 본문 */}
              <p style={{
                fontSize: 13, color: C.text, lineHeight: 1.75,
                marginBottom: 16, wordBreak: "keep-all",
              }}>
                {r.text}
              </p>
              {/* 작성자 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: r.bg, flexShrink: 0,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 11,
                  fontWeight: 700, color: C.white,
                }}>
                  {r.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 오른쪽: Why SceneA ── */}
      <div className="fade-up" style={{ display: "flex", flexDirection: "column" }}>
        <p style={{
          fontSize: 12, fontWeight: 600, letterSpacing: "0.18em",
          color: C.mid, textTransform: "uppercase",
          marginBottom: 14,
        }}>
          Why SceneA
        </p>
        <h2 style={{
          fontSize: 28, fontWeight: 700, color: C.navy,
          lineHeight: 1.35, letterSpacing: "-0.02em",
          marginBottom: 12,
        }}>
          취준생이라면 꼭 알아야 할
          <br />
          <span style={{ color: C.accent }}>SceneA를 써야 하는 이유</span>
        </h2>
        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.7, marginBottom: 28 }}>
          혼자 반복하는 연습엔 한계가 있습니다. 데이터와 현직자 경험을 동시에 활용하세요.
        </p>

        <div style={{ marginBottom: 32 }}>
          <a href="/auth/register" style={{
            display: "inline-block",
            background: C.navy, color: C.white,
            fontFamily: "inherit", fontSize: 14, fontWeight: 700,
            padding: "13px 32px", borderRadius: 999,
            textDecoration: "none",
            transition: "transform 0.2s, background 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.navy; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            지금 시작하기 →
          </a>
        </div>

        {/* 가치 카드 4개 — 2×2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minWidth: 0 }}>
          {[
            {
              bg: "#C6DCEF", accent: "#0D2240",
              num: "01", title: "AI 실시간 분석",
              desc: "말하기 속도·침묵·논리 구조를 데이터로 정확히 잡아냅니다",
            },
            {
              bg: "#B8E2CE", accent: "#0A4A35",
              num: "02", title: "현직자 1:1 코칭",
              desc: "네이버·카카오 출신 멘토의 실무 경험이 직접 피드백이 됩니다",
            },
            {
              bg: "#D2C6EC", accent: "#3B2070",
              num: "03", title: "목표 기업 맞춤 전략",
              desc: "공고 분석부터 예상 질문 설계까지 나만의 준비 로드맵",
            },
            {
              bg: "#F6DFA4", accent: "#7A4E00",
              num: "04", title: "성장을 눈으로 확인",
              desc: "세션마다 쌓이는 리포트로 내 면접 실력 변화를 추적하세요",
            },
          ].map((card, i) => (
            <div key={i} style={{
              background: card.bg,
              borderRadius: 16,
              padding: "20px 18px",
              minWidth: 0, overflow: "hidden",
              position: "relative",
            }}>
              <span style={{
                position: "absolute", top: 14, right: 16,
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                color: card.accent, opacity: 0.45,
              }}>{card.num}</span>
              <p style={{
                fontSize: 14, fontWeight: 700, color: C.navy,
                marginBottom: 7, lineHeight: 1.3, wordBreak: "keep-all",
              }}>{card.title}</p>
              <p style={{
                fontSize: 12, color: C.textSub,
                lineHeight: 1.65, wordBreak: "keep-all",
              }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </div>

    {/* ── 반응형 스타일 (좁은 화면에서 1열로) ── */}
    <style>{`
      @media (max-width: 768px) {
        .reviews-cta-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  </section>
);



/* ── 푸터 ── */
const Footer = () => (
  <footer style={{
    background: "#080F1D",
    padding: "20px 5%",
    borderTop: `1px solid rgba(255,255,255,0.06)`,
  }}>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <LogoIcon size={22} color="rgba(255,255,255,0.5)" />
        <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>SceneA</span>
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
        © 2026 SceneA. Capstone Design Project.
      </p>
    </div>
  </footer>
);

/* ── 스크롤 애니메이션 훅 ── */
const useScrollFadeUp = () => {
  useEffect(() => {
    const elements = document.querySelectorAll(".fade-up");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12 }
    );
    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
};

/* ── 메인 컴포넌트 ── */
export default function Home() {
  useScrollFadeUp();

  return (
    <>
      <GlobalStyle />
      <Header />
      <main style={{ paddingTop: 68 }}>
        <Hero />
        <FeaturesSection />
        <MentorsSection />
        <ReviewsAndCTA />
      </main>
      <Footer />
    </>
  );
}

