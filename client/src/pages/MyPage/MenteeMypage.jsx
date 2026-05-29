import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMyProfile, updateMyProfile, getUserSessions } from "../../api/users";
import { getSessionReport } from "../../api/sessions";
import { getAvatar } from "../../utils/avatar";

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A",
  cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75", tealLight:"#E8F5EE",
  text:"#1A1818", textSub:"#6B6863", textMuted:"#9E9B95",
  border:"#E8E0D0", bg:"#FAF8F4",
  orange:"#F59E0B", red:"#EF4444",
};

const LogoIcon = ({ size=26, color=C.white }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="2" fill={color}/>
    {[0,45,90,135,180,225,270,315].map((deg,i)=>{
      const r=deg*Math.PI/180;
      return <line key={i} x1={14+2.5*Math.cos(r)} y1={14+2.5*Math.sin(r)} x2={14+10*Math.cos(r)} y2={14+10*Math.sin(r)} stroke={color} strokeWidth="1.5" strokeLinecap="round"/>;
    })}
    {[0,90,180,270].map((deg,i)=>{
      const r=deg*Math.PI/180,mx=14+7*Math.cos(r),my=14+7*Math.sin(r),o=r+Math.PI/2;
      return <g key={i}><line x1={mx} y1={my} x2={mx+3*Math.cos(o)} y2={my+3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/><line x1={mx} y1={my} x2={mx-3*Math.cos(o)} y2={my-3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/></g>;
    })}
  </svg>
);

const Header = ({ userName, accessToken }) => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try { await fetch("/api/auth/logout",{ method:"POST", headers:{ Authorization:`Bearer ${accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };
  return (
    <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님</span>
        <Link to="/" style={{ textDecoration:"none" }}><LogoIcon size={28}/></Link>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{l:"대시보드",to:"/dashboard/mentee"},{l:"멘토 탐색",to:"/mentor/search"},{l:"예약 확인",to:"#"},{l:"MyPage",to:"/mentee/mypage",bold:true}].map((x,i)=>(
            <Link key={i} to={x.to} style={{ fontSize:14, fontWeight:x.bold?700:400, color:C.white, textDecoration:"none", opacity:x.bold?1:0.85 }}
              onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=x.bold?1:0.85}>{x.l}</Link>
          ))}
          <button onClick={handleLogout} style={{
            padding:"7px 16px", borderRadius:8, border:"1px solid rgba(255,255,255,0.3)",
            background:"transparent", color:"rgba(255,255,255,0.85)",
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
          }}
            onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.12)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 상단 스탯 카드 ── */
const StatCard = ({ label, before, after, note, noteColor, icon }) => (
  <div style={{ background:C.white, borderRadius:14, padding:"18px 20px", border:`1px solid ${C.border}`, flex:1, minWidth:0 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
      <p style={{ fontSize:12, color:C.textMuted }}>{label}</p>
      {icon && <span style={{ fontSize:18 }}>{icon}</span>}
    </div>
    {before ? (
      <div style={{ display:"flex", alignItems:"baseline", gap:6, marginBottom:4 }}>
        <span style={{ fontSize:13, color:C.textMuted }}>{before}</span>
        <span style={{ fontSize:13, color:C.textMuted }}>→</span>
        <span style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.03em" }}>{after}</span>
      </div>
    ) : (
      <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.03em", marginBottom:4 }}>{after}</p>
    )}
    {note && <p style={{ fontSize:12, color:noteColor||C.teal, fontWeight:500 }}>{note}</p>}
  </div>
);

/* ── SVG 레이더 차트 ── */
function RadarChart({ data, size = 220 }) {
  const cx = size / 2, cy = size / 2;
  const R = size * 0.38;
  const n = data.length;

  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, r) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });
  const poly = (r) => data.map((_, i) => `${pt(i, r).x},${pt(i, r).y}`).join(" ");
  const dataPoints = data.map((d, i) => pt(i, R * (d.value / 100)));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 배경 그리드 */}
      {gridLevels.map((lv, i) => (
        <polygon key={i} points={poly(R * lv)}
          fill="none" stroke={C.border} strokeWidth="1" />
      ))}
      {/* 축선 */}
      {data.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.border} strokeWidth="1" />;
      })}
      {/* 데이터 영역 */}
      <path d={dataPath} fill={C.teal} fillOpacity="0.18" stroke={C.teal} strokeWidth="2" strokeLinejoin="round" />
      {/* 데이터 포인트 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={C.teal} />
      ))}
      {/* 라벨 */}
      {data.map((d, i) => {
        const labelR = R + 22;
        const p = pt(i, labelR);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
            fontSize="10" fill={C.textSub} fontFamily="'Noto Sans KR', sans-serif">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ── SVG 라인 차트 ── */
function LineChart({ sessions }) {
  const W = 520, H = 110, pad = { l: 32, r: 16, t: 12, b: 28 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const n = sessions.length;
  if (n < 2) return null;

  const maxScore = 5;
  const xs = (i) => pad.l + (i / (n - 1)) * iW;
  const ys = (v) => pad.t + iH - (v / maxScore) * iH;

  const pathD = sessions.map((s, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(s.ai)}`).join(" ");
  const fillD = pathD + ` L${xs(n - 1)},${pad.t + iH} L${xs(0)},${pad.t + iH} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Y축 가이드라인 */}
      {[1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={pad.l} y1={ys(v)} x2={pad.l + iW} y2={ys(v)}
            stroke={C.border} strokeWidth="0.8" strokeDasharray="4,4" />
          <text x={pad.l - 6} y={ys(v)} textAnchor="end" dominantBaseline="central"
            fontSize="9" fill={C.textMuted}>{v}</text>
        </g>
      ))}
      {/* 면적 */}
      <path d={fillD} fill={C.teal} fillOpacity="0.08" />
      {/* 라인 */}
      <path d={pathD} fill="none" stroke={C.teal} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* 포인트 + 날짜 */}
      {sessions.map((s, i) => (
        <g key={i}>
          <circle cx={xs(i)} cy={ys(s.ai)} r={5} fill={C.white} stroke={C.teal} strokeWidth="2.5" />
          <text x={xs(i)} y={pad.t + iH + 14} textAnchor="middle" fontSize="9" fill={C.textMuted}>
            {s.date?.slice(5) || `${i + 1}회`}
          </text>
          <text x={xs(i)} y={ys(s.ai) - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.teal}>
            {s.ai}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ── Fit-Gap 도넛 차트 ── */
function DonutChart({ matched, total, size = 120 }) {
  const r = 44, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? matched / total : 0;
  const dash = pct * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FED7D7" strokeWidth="12" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.teal} strokeWidth="12"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill={C.navy}
        fontFamily="'Noto Sans KR', sans-serif">{Math.round(pct * 100)}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill={C.textMuted}
        fontFamily="'Noto Sans KR', sans-serif">충족률</text>
    </svg>
  );
}

/* ── 문항별 점수 바 ── */
function QuestionScoreBar({ questions }) {
  if (!questions?.length) return null;
  const max = 10;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {questions.map((q, i) => {
        const pct = (q.score / max) * 100;
        const color = pct >= 70 ? C.teal : pct >= 50 ? C.orange : C.red;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.textSub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                Q{i + 1}. {q.question?.slice(0, 30)}{q.question?.length > 30 ? "…" : ""}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color, marginLeft: 8, flexShrink: 0 }}>{q.score}</span>
            </div>
            <div style={{ height: 6, background: C.creamDark, borderRadius: 999 }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.8s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 히스토리 아이템 ── */
const wpmColor = (level) => {
  if (level === "안정") return { bg: C.tealLight, color: C.teal };
  if (level === "양호") return { bg: "#E8F4FF", color: "#185FA5" };
  if (level === "빠름") return { bg: "#FEF3C7", color: C.orange };
  if (level === "매우 빠름") return { bg: "#FEF2F2", color: C.red };
  return { bg: C.bg, color: C.textSub };
};

const HistoryItem = ({ num, title, wpm, wpmLevel, star, ai, silence, mentor, date, type, hasAudio, id, navigate }) => {
  const wc = wpmColor(wpmLevel);
  return (
    <div style={{ padding: "18px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: `${C.teal}18`, border: `1.5px solid ${C.teal}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: C.teal,
        }}>{num}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</p>
            <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: C.tealLight, color: C.teal, fontWeight: 600 }}>완료</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: wc.bg, color: wc.color, fontWeight: 600 }}>WPM {wpm} · {wpmLevel}</span>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: C.bg, color: C.textSub }}>STAR {star}</span>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: C.bg, color: C.textSub }}>AI {ai}점</span>
            {silence && <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "#FEF2F2", color: C.red }}>침묵 {silence}회</span>}
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>멘토 {mentor} · {date} · {type}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => id && navigate(`/report/ai/${id}`)} style={{
              padding: "7px 16px", background: C.navy, color: C.white,
              border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>리포트 보기</button>
            {hasAudio && (
              <button style={{
                padding: "7px 16px", background: C.white, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: 8,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4.5 4l4 2-4 2V4z" fill="currentColor" />
                </svg>
                답변 다시 듣기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── AI 리포트 데이터 파생 헬퍼 ── */
function deriveRadarFromReport(questionReports) {
  if (!questionReports?.length) return null;
  const n = questionReports.length;
  const avg = (fn) => questionReports.reduce((s, q) => s + fn(q), 0) / n;

  const starScore = avg(q => {
    const s = q.metrics_summary?.star_structure || "";
    return s.includes("충족") ? 90 : s.includes("부족") ? 40 : 65;
  });
  const speedScore = avg(q => {
    const s = q.metrics_summary?.speaking_speed || "";
    return s === "적정" ? 90 : s === "양호" ? 72 : (s === "느림" || s === "빠름") ? 55 : 65;
  });
  const clarityScore = avg(q => {
    const s = q.metrics_summary?.sentence_clarity || "";
    return s === "명확" ? 90 : s === "짧음" ? 52 : 68;
  });
  const silenceScore = avg(q => {
    const s = q.metrics_summary?.silence || "";
    return s.includes("없음") ? 92 : s.includes("1") ? 72 : s.includes("2") ? 55 : 40;
  });
  const avgScorePct = (questionReports.reduce((s, q) => s + (q.score || 0), 0) / n) * 10;

  return [
    { label: "STAR 구조화", value: Math.round(starScore) },
    { label: "말하기 안정성", value: Math.round(speedScore) },
    { label: "논리적 답변", value: Math.round(avgScorePct) },
    { label: "문장 간결성", value: Math.round(clarityScore) },
    { label: "직무 역량", value: Math.round(avgScorePct * 0.85) },
    { label: "면접 전달력", value: Math.round((speedScore + silenceScore) / 2) },
  ];
}

function parseRequirementLabel(item) {
  return item.split(" / ")[0]?.replace(/^요구사항:\s*/, "") || item;
}

const DUMMY_HISTORY = [
  { num:5, title:"백엔드 개발자 모의 면접", wpm:118, wpmLevel:"안정", star:"4/4", ai:4.4, silence:2, mentor:"박지훈", date:"2026.04.02", type:"1:1", hasAudio:true },
  { num:4, title:"프론트엔드 그룹 면접 연습", wpm:129, wpmLevel:"양호", star:"3/4", ai:4.1, silence:null, mentor:"이수연", date:"2026.03.20", type:"그룹 3인", hasAudio:true },
  { num:3, title:"인성 면접 집중 코칭", wpm:141, wpmLevel:"양호", star:"3/4", ai:3.9, silence:4, mentor:"박지훈", date:"2026.03.05", type:"1:1", hasAudio:true },
  { num:2, title:"기술 면접 기초 세션", wpm:158, wpmLevel:"빠름", star:"2/4", ai:3.5, silence:null, mentor:"김도현", date:"2026.02.18", type:"1:1", hasAudio:false },
  { num:1, title:"첫 모의 면접 세션", wpm:182, wpmLevel:"매우 빠름", star:"1/4", ai:2.8, silence:7, mentor:"박지훈", date:"2026.02.01", type:"1:1", hasAudio:false },
];

/* ── 프로필 수정 모달 ── */
function EditProfileModal({ onClose, userEmail, onImageChange, initialBio }) {
  const [tab, setTab] = useState("name");
  const [name, setName] = useState("");
  const [bio, setBio] = useState(initialBio || "");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile, setImgFile] = useState(null);

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveImage = async () => {
    if (!imgFile) { setError("이미지를 선택해주세요."); return; }
    setSaving(true);
    try {
      const res = await updateMyProfile({}, imgFile);
      const url = res?.profile_image_url || imgPreview;
      localStorage.setItem(`profile_img_${userEmail}`, url);
      onImageChange?.(url);
      setDone(true);
      setTimeout(onClose, 900);
    } catch {
      setError("이미지 저장에 실패했습니다.");
      setSaving(false);
    }
  };

  const inputStyle = (borderColor) => ({
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: `1.5px solid ${borderColor || C.border}`,
    fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box",
  });

  const handleSave = async () => {
    setError("");
    const data = {};
    if (tab === "name") {
      if (!name.trim()) { setError("이름을 입력해주세요."); return; }
      data.name = name.trim();
    } else if (tab === "bio") {
      data.bio = bio.trim();
    } else {
      if (pwNew.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
      if (pwNew !== pwConfirm) { setError("비밀번호가 일치하지 않습니다."); return; }
      data.password = pwNew;
    }
    setSaving(true);
    try {
      await updateMyProfile(data);
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e) {
      if (e?.status === 401) setError("로그인이 만료되었습니다.");
      else if (e?.status === 400) setError("입력값을 확인해주세요.");
      else setError("저장에 실패했습니다.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.white, borderRadius: 18, padding: "32px 36px", width: 400, boxShadow: "0 8px 40px rgba(13,34,68,0.18)" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>프로필 수정</h3>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
            <p style={{ color: C.teal, fontWeight: 600, fontSize: 15 }}>저장되었습니다!</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 22 }}>
              {[{ k: "name", l: "이름" }, { k: "bio", l: "한줄 소개" }, { k: "password", l: "비밀번호" }, { k: "image", l: "이미지" }].map(t => (
                <button key={t.k} onClick={() => { setTab(t.k); setError(""); }} style={{
                  flex: 1, padding: "10px 0", background: "transparent", border: "none",
                  borderBottom: `2.5px solid ${tab === t.k ? C.navy : "transparent"}`,
                  fontSize: 12, fontWeight: tab === t.k ? 700 : 400,
                  color: tab === t.k ? C.navy : C.textMuted, cursor: "pointer", fontFamily: "inherit", marginBottom: -1,
                }}>{t.l}</button>
              ))}
            </div>
            {tab === "name" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>새 이름</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="변경할 이름을 입력하세요"
                  style={inputStyle()}
                  onFocus={e => e.target.style.borderColor = C.navy}
                  onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            )}
            {tab === "bio" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>
                  한줄 소개 <span style={{ color: bio.length > 100 ? C.red : C.textMuted }}>({bio.length}/100)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, 100))}
                  placeholder="나를 간단히 소개해주세요 (최대 100자)"
                  rows={3}
                  style={{ ...inputStyle(), resize: "none", lineHeight: 1.6 }}
                  onFocus={e => e.target.style.borderColor = C.navy}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
            )}
            {tab === "password" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>새 비밀번호</label>
                  <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="8자 이상 입력"
                    style={inputStyle()} onFocus={e => e.target.style.borderColor = C.navy} onBlur={e => e.target.style.borderColor = C.border} />
                  {pwNew.length > 0 && pwNew.length < 8 && <p style={{ fontSize: 11, color: C.red, marginTop: 5 }}>비밀번호는 8자 이상이어야 합니다.</p>}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>새 비밀번호 확인</label>
                  <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="비밀번호를 다시 입력"
                    style={inputStyle(pwConfirm && pwConfirm !== pwNew ? C.red : undefined)}
                    onFocus={e => e.target.style.borderColor = C.navy} onBlur={e => e.target.style.borderColor = C.border} />
                  {pwConfirm && pwNew !== pwConfirm && <p style={{ fontSize: 11, color: C.red, marginTop: 5 }}>비밀번호가 일치하지 않습니다.</p>}
                  {pwConfirm && pwNew === pwConfirm && pwNew.length >= 8 && <p style={{ fontSize: 11, color: C.teal, marginTop: 5 }}>비밀번호가 일치합니다.</p>}
                </div>
              </>
            )}
            {tab === "image" && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  {imgPreview ? (
                    <img src={imgPreview} alt="preview" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}`, margin: "0 auto 10px", display: "block" }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.bg, border: `2px dashed ${C.border}`, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
                    </div>
                  )}
                  <label style={{ display: "inline-block", padding: "8px 18px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.navy, cursor: "pointer", background: C.white }}>
                    이미지 선택<input type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }} />
                  </label>
                </div>
                <p style={{ fontSize: 11, color: C.textMuted, textAlign: "center" }}>JPG, PNG, GIF · 최대 5MB</p>
              </div>
            )}
            {error && <p style={{ fontSize: 12, color: C.red, marginBottom: 14, textAlign: "center" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
              <button onClick={tab === "image" ? handleSaveImage : handleSave} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: saving ? C.textMuted : C.navy, color: C.white, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════ 메인 ══════════════ */
export default function MenteeMyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const [activeTab, setActiveTab] = useState("all");
  const [profile, setProfile] = useState(null);
  const [apiSessions, setApiSessions] = useState([]);
  const [latestReport, setLatestReport] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem(`profile_img_${user?.email}`) || null);

  useEffect(() => {
    getMyProfile().then(p => {
      setProfile(p);
      if (p?.profileImageUrl) {
        setProfileImage(p.profileImageUrl);
        localStorage.setItem(`profile_img_${user?.email}`, p.profileImageUrl);
      }
    }).catch(() => {});
    getUserSessions().then(data => {
      if (data?.length) {
        setApiSessions(data);
        const latestId = data[0]?.id;
        if (latestId) {
          getSessionReport(latestId).then(setLatestReport).catch(() => {});
        }
      }
    }).catch(() => {});
  }, []);

  const historyAll = apiSessions.length > 0
    ? apiSessions.map((s, i, arr) => ({
        id: s.id,
        num: arr.length - i,
        title: s.title ?? "",
        wpm: s.wpm ?? 0,
        wpmLevel: s.wpmLevel ?? "양호",
        star: s.star ?? "-",
        ai: s.aiScore ?? 0,
        silence: s.silence ?? null,
        mentor: s.mentorName ?? "",
        date: s.scheduledAt?.slice(0, 10).replace(/-/g, ".") ?? "",
        type: s.sessionType ?? "1:1",
        hasAudio: !!s.reportStatus,
      }))
    : DUMMY_HISTORY;

  const displayName = profile?.name ?? userName;

  const handleWithdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.")) return;
    try { await fetch("/api/auth/withdraw", { method: "DELETE", headers: { Authorization: `Bearer ${user?.accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };

  // 점수 추이용 (최신 → 오래된 순 역전)
  const sessionTrend = [...historyAll].reverse().map(h => ({ ai: h.ai, date: h.date }));

  // AI 리포트 → 파생 데이터
  const aiReport = latestReport?.ai_report;
  const questionReports = aiReport?.question_reports || [];
  const fitGapRaw = aiReport?.fit_gap;

  const radarData = deriveRadarFromReport(questionReports) || [
    { label: "STAR 구조화", value: 75 },
    { label: "말하기 안정성", value: 80 },
    { label: "논리적 답변", value: 65 },
    { label: "문장 간결성", value: 60 },
    { label: "직무 역량", value: 40 },
    { label: "면접 전달력", value: 70 },
  ];

  const recentQuestions = questionReports.length > 0
    ? questionReports.map(q => ({ question: q.question, score: q.score }))
    : [
        { question: "MSA 경험과 트레이드오프를 설명해주세요", score: 8.8 },
        { question: "대용량 트래픽 처리 방안에 대해 말씀해주세요", score: 7.2 },
        { question: "팀 갈등 상황을 해결한 경험이 있나요", score: 6.5 },
        { question: "본인의 단점과 개선 노력을 말씀해주세요", score: 5.0 },
        { question: "5년 후 목표와 커리어 방향은 무엇인가요", score: 7.8 },
      ];

  const matchedCount = fitGapRaw?.matched_requirements?.length ?? 4;
  const missingCount = fitGapRaw?.missing_requirements?.length ?? 3;
  const fitGap = { matched: matchedCount, missing: missingCount, total: matchedCount + missingCount };

  const fitMatchedItems = fitGapRaw?.matched_requirements?.map(parseRequirementLabel) ?? [
    "Java Spring 백엔드 개발 역량",
    "RESTful API 설계 경험",
    "팀 협업 및 커뮤니케이션",
    "성과 수치화 답변 능력",
  ];
  const fitMissingItems = fitGapRaw?.missing_requirements?.map(parseRequirementLabel) ?? [
    "MSA 아키텍처 실무 경험",
    "클라우드 인프라 (AWS/GCP)",
    "CI/CD 파이프라인 구축 경험",
  ];

  const apiMentorFeedback = latestReport?.mentor_feedback;
  const latestSession = historyAll[0];
  const comments = apiMentorFeedback
    ? [{
        initials: latestSession?.mentor?.slice(0, 2) || "멘T",
        name: `${latestSession?.mentor || "멘토"} 멘토`,
        bg: "#1B4F7A",
        date: latestSession?.date?.slice(5) || "",
        session: `${latestSession?.num}회차 · ${latestSession?.title}`,
        text: apiMentorFeedback,
      }]
    : [
        { initials: "박J", name: "박지훈 멘토", bg: "#1B4F7A", date: "04.02", session: "5회차 · 백엔드 개발자 모의 면접", text: "수치 기반 답변이 훨씬 자연스러워졌어요. 이제 MSA처럼 경험 없는 영역은 학습 의지를 보여주는 방향으로 연습하면 다음 면접 충분히 통과할 수 있을 것 같아요." },
        { initials: "이S", name: "이수연 멘토", bg: "#0F6E56", date: "03.20", session: "4회차 · 프론트엔드 그룹 면접 연습", text: "STAR 구조가 많이 잡혔어요! Result 부분을 항상 수치나 구체적 성과로 마무리하는 습관만 들이면 완벽할 것 같습니다." },
      ];

  const latestScore = historyAll[0]?.ai ?? "-";
  const firstScore = historyAll[historyAll.length - 1]?.ai ?? "-";
  const avgWpm = historyAll.length ? Math.round(historyAll.reduce((s, h) => s + h.wpm, 0) / historyAll.length) : "-";
  const latestWpm = historyAll[0]?.wpm ?? "-";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @media(max-width:900px){.mypage-layout{flex-direction:column!important}.mypage-sidebar{width:100%!important}}
        @media(max-width:600px){.stat-grid{grid-template-columns:1fr 1fr!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 5% 60px" }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", marginBottom: 4 }}>마이페이지</h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>나의 면접 성장 기록을 확인하세요</p>
        </div>

        <div className="mypage-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* ── 사이드바 ── */}
          <div className="mypage-sidebar" style={{ width: 210, flexShrink: 0 }}>
            <div style={{ background: C.white, borderRadius: 16, padding: "24px 20px", border: `1px solid ${C.border}` }}>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                {profileImage ? (
                  <img src={profileImage} alt="profile" style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px", display: "block", border: `2px solid ${C.border}` }} />
                ) : (() => { const av = getAvatar(user?.email); return (
                  <div style={{ width: 68, height: 68, borderRadius: "50%", background: av.color, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>{av.animal}</div>
                ); })()}
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 2 }}>{displayName}</p>
                <p style={{ fontSize: 12, color: C.textSub }}>멘티</p>
                {profile?.bio && (
                  <p style={{ fontSize: 12, color: C.textSub, marginTop: 6, lineHeight: 1.6, padding: "0 4px" }}>{profile.bio}</p>
                )}
              </div>

              <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                <p style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>목표 직무 & 기업</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>백엔드 개발자</p>
                <p style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>카카오 · 네이버 · 라인</p>
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                {[
                  { l: "총 세션", v: `${historyAll.length}회` },
                  { l: "최근 AI 점수", v: `${latestScore}점` },
                  { l: "최근 WPM", v: `${latestWpm} WPM` },
                  { l: "Fit 충족률", v: fitGap.total > 0 ? `${Math.round((fitGap.matched / fitGap.total) * 100)}%` : "-" },
                  { l: "보유 포인트", v: "320 P" },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < 4 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{r.l}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 메인 콘텐츠 ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>

            {/* 자소서 관리 */}
            <div style={{ background: C.white, borderRadius: 16, padding: "20px 24px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 3 }}>자소서 관리</h3>
                <p style={{ fontSize: 12, color: C.textMuted }}>면접 전 미리 작성해두면 멘토가 맞춤 질문을 준비합니다</p>
              </div>
              <Link to="/mentee/resume" style={{ textDecoration: "none" }}>
                <button style={{ padding: "9px 18px", borderRadius: 8, background: C.navy, color: C.white, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                  자소서 입력
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </Link>
            </div>

            {/* ── 핵심 스탯 4개 ── */}
            <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              <StatCard label="총 면접 횟수" after={`${historyAll.length}회`} icon="📋" />
              <StatCard label="AI 점수 변화" before={String(firstScore)} after={String(latestScore)} note={latestScore !== "-" && firstScore !== "-" ? `+${(Number(latestScore) - Number(firstScore)).toFixed(1)} 성장` : ""} />
              <StatCard label="WPM 안정화" before={String(avgWpm > latestWpm ? avgWpm : "")} after={`${latestWpm}`} note="최근 기준" noteColor={C.teal} />
              <StatCard label="Fit 충족 역량" after={`${fitGap.matched}/${fitGap.total || "-"}`} note={fitGap.total > 0 ? `${Math.round((fitGap.matched / fitGap.total) * 100)}% 충족` : ""} />
            </div>

            {/* ── 레이더 차트 + Fit-Gap 도넛 ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* 역량 레이더 */}
              <div style={{ background: C.white, borderRadius: 16, padding: "22px 24px", border: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.teal, letterSpacing: 1, marginBottom: 4 }}>CAPABILITY RADAR</p>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>역량 종합 분석</h3>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{questionReports.length > 0 ? `AI 리포트 기반 · 최근 세션 (${questionReports.length}문항)` : "AI 리포트 기반 · 최근 5회 평균"}</p>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <RadarChart data={radarData} size={220} />
                </div>
                {/* 범례 */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "center" }}>
                  {radarData.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: d.value >= 70 ? C.teal : d.value >= 50 ? C.orange : C.red }} />
                      <span style={{ fontSize: 10, color: C.textSub }}>{d.label} {d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fit-Gap 분석 */}
              <div style={{ background: C.white, borderRadius: 16, padding: "22px 24px", border: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.teal, letterSpacing: 1, marginBottom: 4 }}>FIT-GAP ANALYSIS</p>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>채용 요구사항 충족도</h3>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{fitGapRaw ? `AI 리포트 기반 · ${latestSession?.title?.slice(0, 14) || "최근 세션"}` : "AI 리포트 기반 · 최근 세션 기준"}</p>
                </div>

                {/* 도넛 + 수치 */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
                  <DonutChart matched={fitGap.matched} total={fitGap.total} size={120} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.teal }} />
                      <span style={{ fontSize: 13, color: C.text }}>충족 요구사항</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.teal, marginLeft: "auto" }}>{fitGap.matched}개</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.red }} />
                      <span style={{ fontSize: 13, color: C.text }}>미충족 요구사항</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.red, marginLeft: "auto" }}>{fitGap.missing}개</span>
                    </div>
                  </div>
                </div>

                {/* 충족/미충족 리스트 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: C.teal, marginBottom: 6 }}>충족</p>
                    {fitMatchedItems.map((item, i) => (
                      <p key={i} style={{ fontSize: 11, color: "#3F5F4B", lineHeight: 1.6, marginBottom: 3 }}>✓ {item}</p>
                    ))}
                  </div>
                  <div style={{ background: "#FFF5F5", borderRadius: 10, padding: "10px 12px" }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: C.red, marginBottom: 6 }}>보완 필요</p>
                    {fitMissingItems.map((item, i) => (
                      <p key={i} style={{ fontSize: 11, color: "#6F4545", lineHeight: 1.6, marginBottom: 3 }}>✗ {item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 세션별 점수 추이 + 문항별 점수 ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>

              {/* 점수 추이 라인 차트 */}
              <div style={{ background: C.white, borderRadius: 16, padding: "22px 24px", border: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.teal, letterSpacing: 1, marginBottom: 4 }}>SCORE TREND</p>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>세션별 AI 점수 추이</h3>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                    {firstScore} → <strong style={{ color: C.teal }}>{latestScore}</strong>
                    {latestScore !== "-" && firstScore !== "-" && (
                      <span style={{ color: C.teal, fontWeight: 600 }}> (+{(Number(latestScore) - Number(firstScore)).toFixed(1)})</span>
                    )}
                  </p>
                </div>
                <LineChart sessions={sessionTrend} />
              </div>

              {/* 문항별 점수 바 */}
              <div style={{ background: C.white, borderRadius: 16, padding: "22px 24px", border: `1px solid ${C.border}` }}>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.teal, letterSpacing: 1, marginBottom: 4 }}>QUESTION SCORES</p>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>문항별 점수</h3>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{questionReports.length > 0 ? `${latestSession?.title?.slice(0, 14) || "최근 세션"} · 10점 만점` : "최근 세션 기준 · 10점 만점"}</p>
                </div>
                <QuestionScoreBar questions={recentQuestions} />
                {/* 범례 */}
                <div style={{ display: "flex", gap: 12, marginTop: 12, justifyContent: "flex-end" }}>
                  {[{ c: C.teal, l: "우수 (7+)" }, { c: C.orange, l: "보통 (5~)" }, { c: C.red, l: "보완 (~5)" }].map((x, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />
                      <span style={{ fontSize: 10, color: C.textMuted }}>{x.l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── 히스토리 ── */}
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
                {[
                  { k: "all", l: "전체 히스토리", count: historyAll.length },
                  { k: "unread", l: "리포트 미확인", count: 1, accent: true },
                ].map(t => (
                  <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
                    padding: "14px 24px", background: "transparent", border: "none",
                    borderBottom: `2.5px solid ${activeTab === t.k ? C.navy : "transparent"}`,
                    fontSize: 14, fontWeight: activeTab === t.k ? 700 : 400,
                    color: activeTab === t.k ? C.navy : C.textMuted,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {t.l}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      background: t.accent ? (activeTab === t.k ? C.red : "#FEF2F2") : (activeTab === t.k ? C.navy : C.bg),
                      color: t.accent ? C.red : (activeTab === t.k ? C.white : C.textMuted),
                    }}>{t.count}</span>
                  </button>
                ))}
              </div>
              <div style={{ padding: "0 24px 8px" }}>
                {(activeTab === "all" ? historyAll : historyAll.slice(0, 1)).map((h, i) => (
                  <HistoryItem key={i} {...h} navigate={navigate} />
                ))}
              </div>
            </div>

            {/* ── 멘토 코멘트 ── */}
            <div style={{ background: C.white, borderRadius: 16, padding: "24px", border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>멘토 코멘트 모음</h3>
                <Link to="#" style={{ fontSize: 13, color: C.textMuted, textDecoration: "none" }}>전체보기 →</Link>
              </div>
              {comments.map((c, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: 12, padding: "16px 18px", marginBottom: i < comments.length - 1 ? 14 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.white }}>{c.initials}</div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.name}</p>
                    </div>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{c.date}</span>
                  </div>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.75, marginBottom: 8 }}>{c.text}</p>
                  <p style={{ fontSize: 11, color: C.textMuted }}>{c.session}</p>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* 프로필 수정 / 회원탈퇴 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 32, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setShowEdit(true)} style={{ padding: "10px 18px", background: C.white, color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.navy}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>프로필 수정</button>
          <button onClick={handleWithdraw} style={{ padding: "10px 18px", background: C.white, color: C.red, border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.red}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>회원탈퇴</button>
        </div>

      </main>

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} userEmail={user?.email} onImageChange={(img) => setProfileImage(img)} initialBio={profile?.bio || ""} />}
    </>
  );
}
