import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser, setAuthUser, getAuthUser } from "../../store/authStore";
import { getMyProfile, updateMyProfile } from "../../api/users";
import { getSessionReport, getMySessions } from "../../api/sessions";
import { getMenteeReservations } from "../../api/reservations";
import JobAvatar from "../../components/JobAvatar";

const C = {
  primary:      "#0D2240",
  primaryLight: "#E8EEF6",
  primaryGrad:  "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
  success:      "#0CA678",
  successLight: "#E6FCF5",
  warning:      "#E67700",
  warningLight: "#FFF3BF",
  danger:       "#E03131",
  dangerLight:  "#FFF5F5",
  text:         "#1A1B1E",
  textSub:      "#495057",
  textMuted:    "#868E96",
  white:        "#FFFFFF",
  bg:           "#F0F4F8",
  border:       "#E9ECEF",
  shadow:       "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
};

/* ── 헤더 ── */
const Header = ({ userName, accessToken }) => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };
  const initials = userName ? userName.slice(0, 2) : "멘";
  return (
    <header style={{
      background: C.white, padding: "0 5%",
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)",
    }}>
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
        {/* 우측: 네비게이션 + 로그아웃 */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[
            { label: "대시보드", to: "/dashboard/mentee" },
            { label: "멘토 탐색", to: "/mentor/search" },
            { label: "마이페이지", to: "/mentee/mypage", active: true },
          ].map(({ label, to, active }) => (
            <Link key={label} to={to} style={{
              fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? C.primary : C.textSub,
              textDecoration: "none", padding: "6px 14px", borderRadius: 8,
              background: active ? C.primaryLight : "transparent", transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; } }}
            >{label}</Link>
          ))}
          <div style={{ width: 1, height: 24, background: C.border, margin: "0 8px" }} />
          <button onClick={handleLogout} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 레이더 차트 ── */
function RadarChart({ data, size = 210 }) {
  const cx = size / 2, cy = size / 2, R = size * 0.36, n = data.length;
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, r) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });
  const poly = r => data.map((_, i) => `${pt(i, r).x},${pt(i, r).y}`).join(" ");
  const dataPoints = data.map((d, i) => pt(i, R * (d.value / 100)));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((lv, i) => <polygon key={i} points={poly(R * lv)} fill="none" stroke={C.border} strokeWidth="1" />)}
      {data.map((_, i) => { const p = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={C.border} strokeWidth="1" />; })}
      <path d={dataPath} fill={C.primary} fillOpacity="0.12" stroke={C.primary} strokeWidth="2" strokeLinejoin="round" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={C.primary} />)}
      {data.map((d, i) => {
        const p = pt(i, R + 22);
        return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={C.textSub} fontFamily="'Noto Sans KR',sans-serif">{d.label}</text>;
      })}
    </svg>
  );
}

/* ── 라인 차트 ── */
function LineChart({ sessions }) {
  const W = 480, H = 110, pad = { l: 32, r: 16, t: 12, b: 28 };
  const iW = W - pad.l - pad.r, iH = H - pad.t - pad.b;
  const n = sessions.length;
  if (n < 2) return (
    <div style={{ textAlign: "center", padding: "28px 0", color: C.textMuted, fontSize: 13 }}>
      2회 이상의 세션이 있어야 추이를 볼 수 있어요
    </div>
  );
  const maxScore = 5;
  const xs = i => pad.l + (i / (n - 1)) * iW;
  const ys = v => pad.t + iH - (v / maxScore) * iH;
  const pathD = sessions.map((s, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(s.ai)}`).join(" ");
  const fillD = pathD + ` L${xs(n - 1)},${pad.t + iH} L${xs(0)},${pad.t + iH} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {[1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={pad.l} y1={ys(v)} x2={pad.l + iW} y2={ys(v)} stroke={C.border} strokeWidth="0.8" strokeDasharray="4,4" />
          <text x={pad.l - 6} y={ys(v)} textAnchor="end" dominantBaseline="central" fontSize="9" fill={C.textMuted}>{v}</text>
        </g>
      ))}
      <path d={fillD} fill={C.primary} fillOpacity="0.07" />
      <path d={pathD} fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {sessions.map((s, i) => (
        <g key={i}>
          <circle cx={xs(i)} cy={ys(s.ai)} r={5} fill={C.white} stroke={C.primary} strokeWidth="2.5" />
          <text x={xs(i)} y={pad.t + iH + 14} textAnchor="middle" fontSize="9" fill={C.textMuted}>{s.date?.slice(5) || `${i + 1}회`}</text>
          <text x={xs(i)} y={ys(s.ai) - 10} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.primary}>{s.ai}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── 도넛 차트 ── */
function DonutChart({ matched, total, size = 120 }) {
  const r = 44, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? matched / total : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.dangerLight} strokeWidth="12" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.primary} strokeWidth="12"
        strokeDasharray={`${pct * circ} ${circ}`} strokeDashoffset={circ * 0.25}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill={C.primary} fontFamily="'Noto Sans KR',sans-serif">{Math.round(pct * 100)}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill={C.textMuted} fontFamily="'Noto Sans KR',sans-serif">충족률</text>
    </svg>
  );
}

/* ── 문항별 점수 바 ── */
function QuestionScoreBar({ questions }) {
  if (!questions?.length) return <p style={{ fontSize: 13, color: C.textMuted, padding: "20px 0", textAlign: "center" }}>문항 데이터가 없어요</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {questions.map((q, i) => {
        const pct = (q.score / 10) * 100;
        const color = pct >= 70 ? C.success : pct >= 50 ? C.warning : C.danger;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: C.textSub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "82%" }}>
                Q{i + 1}. {q.question?.slice(0, 32)}{q.question?.length > 32 ? "…" : ""}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color, marginLeft: 8, flexShrink: 0 }}>{q.score}</span>
            </div>
            <div style={{ height: 6, background: C.bg, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: color, transition: "width 0.8s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 히스토리 아이템 ── */
const WPM_COLOR = {
  "안정":    { bg: "#E6FCF5", color: "#0CA678" },
  "양호":    { bg: "#EEF2FF", color: "#4F46E5" },
  "빠름":    { bg: "#FFF3BF", color: "#E67700" },
  "매우 빠름": { bg: "#FFF5F5", color: "#E03131" },
};

const HistoryItem = ({ num, title, ai, mentor, date, isGroup, id, navigate }) => {
  return (
    <div style={{ padding: "18px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: C.primaryLight, border: `1.5px solid ${C.primary}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: C.primary,
        }}>{num}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</p>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: C.successLight, color: C.success, fontWeight: 600 }}>완료</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {mentor && (
              <span style={{ fontSize: 12, color: C.textSub, display: "flex", alignItems: "center", gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {mentor} 멘토
              </span>
            )}
            {date && <span style={{ fontSize: 12, color: C.textMuted }}>· {date}</span>}
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
              background: isGroup ? "#FFF3BF" : C.primaryLight,
              color: isGroup ? "#E67700" : C.primary,
            }}>{isGroup ? "그룹" : "1:1"}</span>
            {ai > 0 && (
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: C.primaryLight, color: C.primary, fontWeight: 600 }}>
                AI {ai}점
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => id && navigate(`/report/ai/${id}`)} style={{
              padding: "8px 14px", background: C.white, color: C.primary,
              border: `1px solid ${C.primary}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              transition: "opacity 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >AI 리포트</button>
            <button onClick={() => id && navigate(`/report/final/${id}`, { state: { sessionId: id, role: "mentee" } })} style={{
              padding: "8px 14px", background: C.primaryGrad, color: C.white,
              border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 10px rgba(13,34,64,0.2)", transition: "opacity 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >최종 리포트 →</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── 멘토 신청 이력 아이템 ── */
const RESERVATION_STATUS = {
  PENDING:   { label: "대기 중", bg: "#FFF3BF", color: "#E67700" },
  CONFIRMED: { label: "수락됨",  bg: "#E6FCF5", color: "#0CA678" },
  CANCELLED: { label: "취소됨",  bg: C.bg,      color: C.textMuted },
  DONE:      { label: "완료",    bg: "#F0F4FF", color: "#4C6EF5" },
};

const ReservationItem = ({ r }) => {
  const reservStatus = r.status?.toUpperCase();
  const scheduledAt = r.scheduled_at || r.scheduledAt;
  const createdAt   = r.created_at   || r.createdAt;
  // 수락됐고 예약 시간이 지났으면 "완료"
  const isPast = scheduledAt && new Date(scheduledAt) < new Date();
  const statusKey = (reservStatus === "CONFIRMED" && isPast) ? "DONE" : reservStatus;
  const status = RESERVATION_STATUS[statusKey] || RESERVATION_STATUS.PENDING;
  const formatDate  = v => v ? new Date(v).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  return (
    <div style={{ padding: "18px 0", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: C.primaryLight,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            {r.mentor_name || r.mentorName || "멘토"} 멘토
          </p>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, background: status.bg, color: status.color }}>
            {status.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1.5" y="2" width="9" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 1v2M8 1v2M1.5 5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            면접 일정 {scheduledAt ? formatDate(scheduledAt) : "미정"}
          </span>
          <span style={{ fontSize: 12, color: C.textMuted }}>신청일 {formatDate(createdAt)}</span>
          {(r.session_type || r.sessionType) && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: C.bg, color: C.textSub }}>
              {r.session_type || r.sessionType}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── AI 리포트 데이터 파생 ── */
function deriveRadarFromReport(qr) {
  if (!qr?.length) return null;
  const n = qr.length;
  const avg = fn => qr.reduce((s, q) => s + fn(q), 0) / n;
  const starScore    = avg(q => { const s = q.metrics_summary?.star_structure || ""; return s.includes("충족") ? 90 : s.includes("부족") ? 40 : 65; });
  const speedScore   = avg(q => { const s = q.metrics_summary?.speaking_speed || ""; return s === "적정" ? 90 : s === "양호" ? 72 : 55; });
  const clarityScore = avg(q => { const s = q.metrics_summary?.sentence_clarity || ""; return s === "명확" ? 90 : s === "짧음" ? 52 : 68; });
  const silenceScore = avg(q => { const s = q.metrics_summary?.silence || ""; return s.includes("없음") ? 92 : s.includes("1") ? 72 : 45; });
  const avgScorePct  = (qr.reduce((s, q) => s + (q.score || 0), 0) / n) * 10;
  return [
    { label: "STAR 구조화", value: Math.round(starScore) },
    { label: "말하기 안정성", value: Math.round(speedScore) },
    { label: "논리적 답변", value: Math.round(avgScorePct) },
    { label: "문장 간결성", value: Math.round(clarityScore) },
    { label: "직무 역량", value: Math.round(avgScorePct * 0.85) },
    { label: "면접 전달력", value: Math.round((speedScore + silenceScore) / 2) },
  ];
}

/* ── 프로필 수정 모달 ── */
function EditProfileModal({ onClose, userEmail, onImageChange, initialBio, profile, onProfileRefresh, onNameSaved }) {
  const [tab, setTab] = useState("name");
  const [name, setName] = useState("");
  const [bio, setBio] = useState(initialBio || "");
  const [school, setSchool] = useState(() => profile?.tags?.find(t => t.category === "학교")?.name || "");
  const [major, setMajor] = useState(() => profile?.tags?.find(t => t.category === "전공")?.name || "");
  const [position, setPosition] = useState(() => profile?.tags?.find(t => t.category === "관심직무")?.name || "");
  const [targetCompany, setTargetCompany] = useState(() => profile?.tags?.find(t => t.category === "목표기업")?.name || "");
  const [techStack, setTechStack] = useState(() => profile?.tags?.filter(t => t.category === "기술스택").map(t => t.name).join(", ") || "");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile, setImgFile] = useState(null);

  const handleImageFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveImage = async () => {
    if (!imgFile) { setError("이미지를 선택해주세요."); return; }
    setSaving(true);
    try {
      await updateMyProfile({}, imgFile);
      // S3 URL은 img 태그에서 인증 없이 로드 불가 → base64 미리보기를 localStorage에 저장하고 즉시 표시
      onImageChange?.(imgPreview);
      try { if (imgPreview) localStorage.setItem(`profile_img_${userEmail}`, imgPreview); } catch {}
      await onProfileRefresh?.();
      setDone(true); setTimeout(onClose, 900);
    } catch { setError("이미지 저장에 실패했습니다."); setSaving(false); }
  };

  const handleSave = async () => {
    setError("");
    const data = {};
    if (tab === "name") {
      if (!name.trim()) { setError("이름을 입력해주세요."); return; }
      data.name = name.trim();
    } else if (tab === "bio") {
      data.bio = bio.trim();
    } else if (tab === "info") {
      const seen = new Set();
      const tags = [];
      const add = (val, category) => {
        const trimmed = val?.trim();
        if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); tags.push({ name: trimmed, category }); }
      };
      add(school, "학교");
      add(major, "전공");
      add(position, "관심직무");
      add(targetCompany, "목표기업");
      techStack.split(",").forEach(v => add(v, "기술스택"));
      data.tags = tags;
    } else {
      if (pwNew.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; }
      if (pwNew !== pwConfirm) { setError("비밀번호가 일치하지 않습니다."); return; }
      data.password = pwNew;
    }
    setSaving(true);
    try {
      await updateMyProfile(data);
      if (tab === "name" && data.name) onNameSaved?.(data.name);
      await onProfileRefresh?.();
      setDone(true); setTimeout(onClose, 900);
    }
    catch (e) { setError(e?.status === 401 ? "로그인이 만료되었습니다." : "저장에 실패했습니다."); setSaving(false); }
  };

  const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.white, borderRadius: 20, padding: "32px 36px", width: 420, boxShadow: "0 12px 48px rgba(13,34,64,0.18)" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>프로필 수정</h3>
        {done ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.successLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke={C.success} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ color: C.success, fontWeight: 700, fontSize: 15 }}>저장되었습니다</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 22 }}>
              {[{ k: "name", l: "이름" }, { k: "bio", l: "소개" }, { k: "info", l: "프로필" }, { k: "password", l: "비밀번호" }, { k: "image", l: "사진" }].map(t => (
                <button key={t.k} onClick={() => { setTab(t.k); setError(""); }} style={{
                  flex: 1, padding: "10px 0", background: "transparent", border: "none",
                  borderBottom: `2.5px solid ${tab === t.k ? C.primary : "transparent"}`,
                  fontSize: 12, fontWeight: tab === t.k ? 700 : 400,
                  color: tab === t.k ? C.primary : C.textMuted, cursor: "pointer", fontFamily: "inherit", marginBottom: -1,
                }}>{t.l}</button>
              ))}
            </div>
            {tab === "name" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>새 이름</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="변경할 이름" style={inp}
                  onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            )}
            {tab === "bio" && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>한줄 소개 ({bio.length}/100)</label>
                <textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 100))} placeholder="나를 간단히 소개해주세요" rows={3}
                  style={{ ...inp, resize: "none", lineHeight: 1.6 }}
                  onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
              </div>
            )}
            {tab === "info" && (
              <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>학교</label>
                    <input value={school} onChange={e => setSchool(e.target.value)} placeholder="예) 한양대학교" style={inp}
                      onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>전공</label>
                    <input value={major} onChange={e => setMajor(e.target.value)} placeholder="예) 컴퓨터공학과" style={inp}
                      onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>관심 직무</label>
                  <input value={position} onChange={e => setPosition(e.target.value)} placeholder="예) 백엔드 개발, 데이터 분석" style={inp}
                    onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>목표 기업</label>
                  <input value={targetCompany} onChange={e => setTargetCompany(e.target.value)} placeholder="예) 네이버, 카카오, IT 스타트업" style={inp}
                    onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 6 }}>기술 스택</label>
                  <input value={techStack} onChange={e => setTechStack(e.target.value)} placeholder="예) Python, React, Java (쉼표로 구분)" style={inp}
                    onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
              </div>
            )}
            {tab === "password" && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>새 비밀번호</label>
                  <input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="8자 이상" style={inp}
                    onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>비밀번호 확인</label>
                  <input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="다시 입력" style={inp}
                    onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border} />
                  {pwConfirm && pwNew === pwConfirm && pwNew.length >= 8 && <p style={{ fontSize: 11, color: C.success, marginTop: 5 }}>비밀번호가 일치합니다</p>}
                </div>
              </>
            )}
            {tab === "image" && (
              <div style={{ marginBottom: 20, textAlign: "center" }}>
                {imgPreview
                  ? <img src={imgPreview} alt="preview" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}`, margin: "0 auto 12px", display: "block" }} />
                  : <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.bg, border: `2px dashed ${C.border}`, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
                    </div>
                }
                <label style={{ display: "inline-block", padding: "8px 18px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.primary, cursor: "pointer" }}>
                  이미지 선택 <input type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }} />
                </label>
                <p style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>JPG, PNG · 최대 5MB</p>
              </div>
            )}
            {error && <p style={{ fontSize: 12, color: C.danger, marginBottom: 14, textAlign: "center" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
              <button onClick={tab === "image" ? handleSaveImage : handleSave} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: C.primaryGrad, color: C.white, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
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
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const userName  = user?.name || user?.email?.split("@")[0] || "사용자";

  const [activeTab, setActiveTab]     = useState("dashboard");
  const [profile, setProfile]         = useState(user?.profileData || null);
  const [apiSessions, setApiSessions] = useState([]);
  const [latestReport, setLatestReport] = useState(null);
  const [reservations, setReservations] = useState([]);

  const hasResume = (() => {
    try {
      const key = `scena_resume_draft:${user?.email || user?.id || "anonymous"}`;
      const job = localStorage.getItem(`${key}:job`);
      const items = localStorage.getItem(key);
      if (job) { const p = JSON.parse(job); if (p?.requirements || p?.looking_for) return true; }
      if (items) { const arr = JSON.parse(items); if (arr?.some(i => i.content?.trim())) return true; }
    } catch {}
    return false;
  })();
  const [showEdit, setShowEdit]       = useState(false);
  const [profileImage, setProfileImage] = useState(() => {
    const stored = localStorage.getItem(`profile_img_${user?.email}`);
    // data: URL(업로드) 또는 https:// URL(카카오 등 외부 CDN) 모두 허용
    return (stored?.startsWith("data:") || stored?.startsWith("https://")) ? stored : null;
  });

  useEffect(() => {
    getMyProfile().then(p => {
      setProfile(p);
      const stored = localStorage.getItem(`profile_img_${user?.email}`);
      const hasCached = stored?.startsWith("data:") || stored?.startsWith("https://");
      if (!hasCached && p?.profile_image_url) {
        const url = p.profile_image_url.replace(/^http:\/\//i, "https://");
        // fetch로 base64 변환 시도 → CORS 차단(카카오 등) 시 URL 그대로 저장
        fetch(url)
          .then(r => r.ok ? r.blob() : null)
          .then(blob => {
            if (!blob) throw new Error("no blob");
            const reader = new FileReader();
            reader.onload = e => {
              const b64 = e.target.result;
              try { localStorage.setItem(`profile_img_${user?.email}`, b64); } catch {}
              setProfileImage(b64);
            };
            reader.readAsDataURL(blob);
          })
          .catch(() => {
            // CORS 등으로 fetch 불가 → URL 직접 사용 (img 태그는 CORS 없이 로드 가능)
            try { localStorage.setItem(`profile_img_${user?.email}`, url); } catch {}
            setProfileImage(url);
          });
      }
    }).catch(() => {});

    getMySessions().then(data => {
      if (!data?.length) return;
      // 완료된 세션만, 최신순
      const completed = [...data]
        .filter(s => (s.status ?? "").toLowerCase() === "completed")
        .sort((a, b) => new Date(b.scheduledAt ?? b.scheduled_at ?? 0) - new Date(a.scheduledAt ?? a.scheduled_at ?? 0));
      setApiSessions(completed);
      const latestId = completed[0]?.id;
      if (latestId) getSessionReport(latestId).then(setLatestReport).catch(() => {});
    }).catch(() => {});

    getMenteeReservations().then(setReservations).catch(() => {});
  }, []);

  const historyAll = apiSessions.map((s, i, arr) => {
    const jobCat    = s.jobCategory ?? s.job_category ?? "";
    const mentorName = s.mentorName ?? s.mentor_name ?? "";
    const sessionType = s.sessionType ?? s.session_type ?? "1:1 면접";
    const isGroup   = sessionType.includes("그룹");
    const title     = jobCat ? `${jobCat} 모의 면접` : "모의 면접";
    const dateStr   = (s.scheduledAt ?? s.scheduled_at ?? s.startedAt ?? s.started_at ?? "").slice(0, 10).replace(/-/g, ".");
    return {
      id:      s.id,
      num:     arr.length - i,
      title,
      ai:      s.aiScore ?? 0,
      mentor:  mentorName,
      date:    dateStr,
      type:    sessionType,
      isGroup,
    };
  });

  const displayName    = profile?.name ?? userName;
  const sessionTrend   = [...historyAll].reverse().map(h => ({ ai: h.ai, date: h.date }));
  const aiReport       = latestReport?.ai_report;
  const qReports       = aiReport?.question_reports || [];
  const fitGapRaw      = aiReport?.fit_gap;

  const radarData = deriveRadarFromReport(qReports) || [
    { label: "STAR 구조화", value: 0 },
    { label: "말하기 안정성", value: 0 },
    { label: "논리적 답변", value: 0 },
    { label: "문장 간결성", value: 0 },
    { label: "직무 역량", value: 0 },
    { label: "면접 전달력", value: 0 },
  ];
  const hasRadar = qReports.length > 0;

  const recentQuestions = qReports.length > 0
    ? qReports.map(q => ({ question: q.question, score: q.score }))
    : [];

  const matchedCount = fitGapRaw?.matched_requirements?.length ?? 0;
  const missingCount = fitGapRaw?.missing_requirements?.length ?? 0;
  const fitGap = { matched: matchedCount, missing: missingCount, total: matchedCount + missingCount };
  const hasFitGap = fitGap.total > 0;

  const fitMatchedItems = fitGapRaw?.matched_requirements?.map(i => i.split(" / ")[0]?.replace(/^요구사항:\s*/, "") || i) ?? [];
  const fitMissingItems = fitGapRaw?.missing_requirements?.map(i => i.split(" / ")[0]?.replace(/^요구사항:\s*/, "") || i) ?? [];

  const latestSession  = historyAll[0];

  const latestScore = historyAll[0]?.ai ?? "-";
  const firstScore  = historyAll[historyAll.length - 1]?.ai ?? "-";
  const latestWpm   = historyAll[0]?.wpm ?? "-";

  const handleWithdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.")) return;
    try { await fetch("/api/auth/withdraw", { method: "DELETE", headers: { Authorization: `Bearer ${user?.accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };

  const TABS = [
    { k: "dashboard", l: "대시보드" },
    { k: "reservations", l: "신청 이력", count: reservations.length },
    { k: "history", l: "면접 히스토리", count: historyAll.length },
  ];

  const Card = ({ children, style }) => (
    <div style={{ background: C.white, borderRadius: 20, padding: "22px 24px", boxShadow: C.shadow, ...style }}>
      {children}
    </div>
  );

  const CardHeader = ({ label, title, sub }) => (
    <div style={{ marginBottom: 16 }}>
      {label && <p style={{ fontSize: 10, fontWeight: 800, color: C.primary, letterSpacing: "0.1em", marginBottom: 4 }}>{label}</p>}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h3>
      {sub && <p style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{sub}</p>}
    </div>
  );

  const EmptyState = ({ icon, title, sub }) => (
    <div style={{ textAlign: "center", padding: "36px 0" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        {icon}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.textSub, marginBottom: 4 }}>{title}</p>
      {sub && <p style={{ fontSize: 12, color: C.textMuted }}>{sub}</p>}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter','Noto Sans KR',-apple-system,sans-serif;background:${C.bg}}
        @media(max-width:900px){.mp-layout{flex-direction:column!important}.mp-sidebar{width:100%!important}}
        @media(max-width:640px){.stat-grid{grid-template-columns:1fr 1fr!important}.chart-grid{grid-template-columns:1fr!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5% 72px" }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.04em", marginBottom: 6 }}>마이페이지</h1>
          <p style={{ fontSize: 14, color: C.textMuted }}>나의 면접 성장 기록을 확인하세요</p>
        </div>

        <div className="mp-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* ── 사이드바 ── */}
          <div className="mp-sidebar" style={{ width: 224, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* 프로필 카드 */}
            <div style={{ background: C.white, borderRadius: 20, padding: "24px 20px", boxShadow: C.shadow }}>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                {profileImage
                  ? <img src={profileImage} alt="profile" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", margin: "0 auto 12px", display: "block", border: `2px solid ${C.border}` }} onError={e => { e.currentTarget.style.display = "none"; setProfileImage(null); }} />
                  : <JobAvatar jobStr={profile?.tags?.find(t => t.category === "관심직무")?.name || ""} size={72} style={{ margin: "0 auto 12px" }} />
                }
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 2 }}>{displayName}</p>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: C.primaryLight, color: C.primary }}>멘티</span>
                {profile?.bio && <p style={{ fontSize: 12, color: C.textSub, marginTop: 8, lineHeight: 1.6 }}>{profile.bio}</p>}
              </div>

              {/* 학교 · 전공 · 관심직무 · 목표기업 */}
              {(() => {
                const rows = [
                  { label: "관심 직무", cat: "관심직무" },
                  { label: "목표 기업", cat: "목표기업" },
                  { label: "학교",     cat: "학교" },
                  { label: "전공",     cat: "전공" },
                ].map(r => ({ ...r, value: profile?.tags?.find(t => t.category === r.cat)?.name }))
                  .filter(r => r.value);
                if (!rows.length) return null;
                return (
                  <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                    {rows.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* 스탯 */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  { l: "총 세션", v: `${historyAll.length}회` },
                  { l: "최근 AI 점수", v: latestScore !== "-" ? `${latestScore}점` : "-" },
                  { l: "최근 WPM", v: latestWpm !== "-" ? `${latestWpm}` : "-" },
                  { l: "Fit 충족률", v: hasFitGap ? `${Math.round((fitGap.matched / fitGap.total) * 100)}%` : "-" },
                  { l: "신청 이력", v: `${reservations.length}건` },
                ].map((r, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{r.l}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{r.v}</span>
                  </div>
                ))}
              </div>

              {/* 프로필 수정 버튼 — 프로필 카드 안에 배치 */}
              <button onClick={() => setShowEdit(true)} style={{
                marginTop: 14, width: "100%", padding: "10px",
                borderRadius: 10, border: `1px solid ${C.border}`,
                background: C.white, color: C.text,
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}
              >프로필 수정</button>
            </div>

            {/* 면접 정보 카드 — 미등록 시 등록 유도, 등록 시 수정 링크 */}
            <div style={{ background: C.primaryGrad, borderRadius: 16, padding: "18px 18px", boxShadow: "0 6px 20px rgba(13,34,64,0.2)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>
                {hasResume ? "면접 정보 관리" : "면접 정보 등록"}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, marginBottom: 14 }}>
                {hasResume
                  ? "등록한 채용공고·자소서를 수정할 수 있어요"
                  : "채용공고와 자소서를 등록하면 AI가 맞춤 질문을 생성해요"}
              </p>
              <Link to="/mentee/resume" style={{
                display: "block", textAlign: "center",
                padding: "9px", borderRadius: 8,
                background: C.white, color: C.primary,
                fontSize: 12, fontWeight: 700, textDecoration: "none",
                transition: "opacity 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >{hasResume ? "수정하러 가기 →" : "등록하러 가기 →"}</Link>
            </div>

            {/* 회원탈퇴 */}
            <button onClick={handleWithdraw} style={{ padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
            >회원탈퇴</button>
          </div>

          {/* ── 메인 콘텐츠 ── */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* 탭 */}
            <div style={{ background: C.white, borderRadius: 16, padding: "4px", boxShadow: C.shadow, marginBottom: 20, display: "flex", gap: 4 }}>
              {TABS.map(t => (
                <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
                  flex: 1, padding: "10px 8px",
                  background: activeTab === t.k ? C.primaryGrad : "transparent",
                  color: activeTab === t.k ? C.white : C.textSub,
                  border: "none", borderRadius: 12,
                  fontSize: 13, fontWeight: activeTab === t.k ? 700 : 500,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  boxShadow: activeTab === t.k ? "0 4px 12px rgba(13,34,64,0.25)" : "none",
                }}>
                  {t.l}
                  {t.count !== undefined && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                      background: activeTab === t.k ? "rgba(255,255,255,0.2)" : C.bg,
                      color: activeTab === t.k ? C.white : C.textMuted,
                    }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ══ 탭 콘텐츠 — 최소 높이 고정 ══ */}
            <div style={{ minHeight: 900 }}>

            {/* ══ 대시보드 탭 ══ */}
            {activeTab === "dashboard" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* 핵심 스탯 4개 */}
                <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                  {[
                    { label: "총 면접 횟수", value: `${historyAll.length}회`, sub: historyAll.length > 0 ? "면접 완료" : "면접 미완료", icon: "📋" },
                    { label: "AI 점수 성장", value: latestScore !== "-" ? `${latestScore}점` : "-", sub: (latestScore !== "-" && firstScore !== "-" && latestScore !== firstScore) ? `${firstScore} → ${latestScore}` : "첫 세션 기준", accent: C.success },
                    { label: "최근 WPM", value: latestWpm !== "-" ? `${latestWpm}` : "-", sub: "최근 세션 기준", accent: C.primary },
                    { label: "Fit 충족률", value: hasFitGap ? `${Math.round((fitGap.matched / fitGap.total) * 100)}%` : "-", sub: hasFitGap ? `${fitGap.matched}/${fitGap.total} 충족` : "AI 리포트 기반", accent: C.warning },
                  ].map((s, i) => (
                    <div key={i} style={{ background: C.white, borderRadius: 16, padding: "18px 18px", boxShadow: C.shadow }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <p style={{ fontSize: 11, color: C.textMuted }}>{s.label}</p>
                        {s.icon && <span style={{ fontSize: 16 }}>{s.icon}</span>}
                      </div>
                      <p style={{ fontSize: 24, fontWeight: 800, color: s.accent || C.primary, letterSpacing: "-0.04em", marginBottom: 4 }}>{s.value}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>{s.sub}</p>
                    </div>
                  ))}
                </div>

                {/* 최종 리포트 바로가기 */}
                {latestSession && (
                  <div style={{ background: C.white, borderRadius: 16, padding: "18px 22px", boxShadow: C.shadow, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: C.successLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2" strokeLinecap="round"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>
                          {latestReport?.report_status === "final" ? "최종 리포트 완성" : "최신 세션 리포트"}
                        </p>
                        <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
                          {latestReport?.report_status === "final"
                            ? "멘토 코멘트와 AI 분석이 모두 포함된 최종 리포트입니다"
                            : latestReport ? "AI 리포트가 준비됐어요 · 멘토 최종 리포트 작성 대기 중" : "리포트 준비 중입니다"}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {latestReport && (
                        <button onClick={() => navigate(`/report/ai/${latestSession.id}`)} style={{
                          padding: "9px 16px", borderRadius: 10, border: `1px solid ${C.primary}`, background: C.white,
                          color: C.primary, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >AI 리포트</button>
                      )}
                      {latestSession && (
                        <button onClick={() => navigate(`/report/final/${latestSession.id}`, { state: { sessionId: latestSession.id, role: "mentee" } })} style={{
                          padding: "9px 16px", borderRadius: 10, border: "none", background: C.primaryGrad,
                          color: C.white, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          boxShadow: "0 4px 12px rgba(13,34,64,0.2)", transition: "opacity 0.15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                        >최종 리포트 →</button>
                      )}
                    </div>
                  </div>
                )}

                {/* 레이더 + Fit-Gap */}
                <div className="chart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                  <Card>
                    <CardHeader label="CAPABILITY RADAR" title="역량 종합 분석" sub={hasRadar ? `AI 리포트 기반 · 최근 세션 (${qReports.length}문항)` : "AI 리포트 데이터 없음"} />
                    {hasRadar ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <RadarChart data={radarData} size={210} />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "center" }}>
                          {radarData.map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: d.value >= 70 ? C.success : d.value >= 50 ? C.warning : C.danger }} />
                              <span style={{ fontSize: 10, color: C.textSub }}>{d.label} {d.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><polygon points="12 2 22 20 2 20"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
                        title="아직 AI 리포트가 없어요"
                        sub="면접을 완료하면 역량 분석 차트가 표시됩니다"
                      />
                    )}
                  </Card>

                  <Card>
                    <CardHeader label="FIT-GAP ANALYSIS" title="채용 요구사항 충족도" sub={hasFitGap ? `AI 리포트 기반 · ${latestSession?.title?.slice(0, 14) || "최근 세션"}` : "AI 리포트 기반"} />
                    {hasFitGap ? (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
                          <DonutChart matched={fitGap.matched} total={fitGap.total} size={110} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary }} />
                              <span style={{ fontSize: 13, color: C.text }}>충족</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginLeft: "auto" }}>{fitGap.matched}개</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.danger }} />
                              <span style={{ fontSize: 13, color: C.text }}>미충족</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.danger, marginLeft: "auto" }}>{fitGap.missing}개</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "10px 12px" }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: C.success, marginBottom: 6 }}>충족</p>
                            {fitMatchedItems.map((it, i) => <p key={i} style={{ fontSize: 11, color: "#3F5F4B", lineHeight: 1.6, marginBottom: 3 }}>✓ {it}</p>)}
                          </div>
                          <div style={{ background: "#FFF5F5", borderRadius: 10, padding: "10px 12px" }}>
                            <p style={{ fontSize: 10, fontWeight: 800, color: C.danger, marginBottom: 6 }}>보완 필요</p>
                            {fitMissingItems.map((it, i) => <p key={i} style={{ fontSize: 11, color: "#6F4545", lineHeight: 1.6, marginBottom: 3 }}>✗ {it}</p>)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                        title="Fit-Gap 데이터 없음"
                        sub="AI 리포트 생성 후 채용공고 매칭 결과가 표시됩니다"
                      />
                    )}
                  </Card>
                </div>

                {/* 점수 추이 + 문항별 점수 */}
                <div className="chart-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>

                  <Card>
                    <CardHeader label="SCORE TREND" title="세션별 AI 점수 추이"
                      sub={sessionTrend.length >= 2 ? `${firstScore} → ${latestScore} · ${historyAll.length}회 세션` : "2회 이상 세션 완료 후 표시"}
                    />
                    <LineChart sessions={sessionTrend} />
                  </Card>

                  <Card>
                    <CardHeader label="QUESTION SCORES" title="문항별 점수"
                      sub={qReports.length > 0 ? `${latestSession?.title?.slice(0, 14) || "최근 세션"} · 10점 만점` : "최근 세션 기준"}
                    />
                    {qReports.length > 0 ? (
                      <>
                        <QuestionScoreBar questions={recentQuestions} />
                        <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
                          {[{ c: C.success, l: "우수 (7+)" }, { c: C.warning, l: "보통 (5~)" }, { c: C.danger, l: "보완 (~5)" }].map((x, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} />
                              <span style={{ fontSize: 10, color: C.textMuted }}>{x.l}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState
                        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
                        title="문항 데이터 없음"
                        sub="AI 리포트 생성 후 문항별 점수가 표시됩니다"
                      />
                    )}
                  </Card>
                </div>
              </div>
            )}

            {/* ══ 신청 이력 탭 ══ */}
            {activeTab === "reservations" && (
              <Card>
                <CardHeader title="멘토 신청 이력" sub="내가 멘토에게 신청한 면접 예약 목록입니다" />
                {reservations.length > 0 ? (
                  <div>
                    {reservations.map((r, i) => <ReservationItem key={r.id || i} r={r} />)}
                  </div>
                ) : (
                  <EmptyState
                    icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
                    title="신청 이력이 없어요"
                    sub="멘토 탐색에서 신청하면 여기에 표시됩니다"
                  />
                )}
                {reservations.length === 0 && (
                  <div style={{ textAlign: "center", marginTop: 12 }}>
                    <Link to="/mentor/search" style={{ fontSize: 13, fontWeight: 700, color: C.primary, textDecoration: "none", padding: "10px 24px", borderRadius: 10, background: C.primaryLight, display: "inline-block", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.color = C.white; }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.primaryLight; e.currentTarget.style.color = C.primary; }}
                    >멘토 탐색하러 가기 →</Link>
                  </div>
                )}
              </Card>
            )}

            {/* ══ 면접 히스토리 탭 ══ */}
            {activeTab === "history" && (
              <Card>
                <CardHeader title="면접 히스토리" sub={`총 ${historyAll.length}회 면접 완료`} />
                {historyAll.length > 0 ? (
                  <div>
                    {historyAll.map((h, i) => <HistoryItem key={i} {...h} navigate={navigate} />)}
                  </div>
                ) : (
                  <EmptyState
                    icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><rect x="3" y="5" width="16" height="14" rx="2"/><path d="M7 3v4M15 3v4M3 10h16" strokeLinecap="round"/></svg>}
                    title="완료된 면접이 없어요"
                    sub="첫 면접을 완료하면 여기에 기록됩니다"
                  />
                )}
              </Card>
            )}


            </div> {/* minHeight 래퍼 닫기 */}

          </div>
        </div>
      </main>

      {showEdit && <EditProfileModal
        onClose={() => setShowEdit(false)}
        userEmail={user?.email}
        onImageChange={img => setProfileImage(img)}
        initialBio={profile?.bio || ""}
        profile={profile}
        onNameSaved={(newName) => {
          const cur = getAuthUser();
          setAuthUser({ ...cur, name: newName });
          setProfile(prev => prev ? { ...prev, name: newName } : prev);
        }}
        onProfileRefresh={() => getMyProfile().then(setProfile).catch(() => {})}
      />}
    </>
  );
}
