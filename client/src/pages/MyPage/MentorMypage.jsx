import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMyProfile, updateMyProfile, getUserSessions } from "../../api/users";
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
    <header style={{ background: C.white, padding: "0 5%", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)" }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.primaryGrad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(13,34,64,0.3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>Scene<span style={{ color: C.primary }}>A</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[
            { label: "대시보드", to: "/dashboard/mentor" },
            { label: "멘토 탐색", to: "/mentor/search" },
            { label: "마이페이지", to: "/mentor/mypage", active: true },
          ].map(({ label, to, active }) => (
            <Link key={label} to={to} style={{
              fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? C.primary : C.textSub, textDecoration: "none",
              padding: "6px 14px", borderRadius: 8,
              background: active ? C.primaryLight : "transparent", transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; } }}
            >{label}</Link>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.primaryGrad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(13,34,64,0.3)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{initials}</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{userName} 멘토</p>
          </div>
          <div style={{ width: 1, height: 24, background: C.border }} />
          <button onClick={handleLogout} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 프로필 수정 모달 ── */
function EditProfileModal({ onClose, userEmail, onImageChange, initialBio }) {
  const [tab, setTab]       = useState("name");
  const [name, setName]     = useState("");
  const [bio, setBio]       = useState(initialBio || "");
  const [pwNew, setPwNew]   = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile, setImgFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState("");

  const handleImageFile = e => {
    const file = e.target.files?.[0]; if (!file) return;
    setImgFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveImage = async () => {
    if (!imgFile) { setError("이미지를 선택해주세요."); return; }
    setSaving(true);
    try {
      const res = await updateMyProfile({}, imgFile);
      const url = res?.profile_image_url || imgPreview;
      localStorage.setItem(`profile_img_${userEmail}`, url);
      onImageChange?.(url); setDone(true); setTimeout(onClose, 900);
    } catch { setError("이미지 저장에 실패했습니다."); setSaving(false); }
  };

  const handleSave = async () => {
    setError("");
    const data = {};
    if (tab === "name") { if (!name.trim()) { setError("이름을 입력해주세요."); return; } data.name = name.trim(); }
    else if (tab === "bio") { data.bio = bio.trim(); }
    else { if (pwNew.length < 8) { setError("비밀번호는 8자 이상이어야 합니다."); return; } if (pwNew !== pwConfirm) { setError("비밀번호가 일치하지 않습니다."); return; } data.password = pwNew; }
    setSaving(true);
    try { await updateMyProfile(data); setDone(true); setTimeout(onClose, 900); }
    catch (e) { setError(e?.status === 401 ? "로그인이 만료되었습니다." : "저장에 실패했습니다."); setSaving(false); }
  };

  const inp = { width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
              {[{ k: "name", l: "이름" }, { k: "bio", l: "소개" }, { k: "pw", l: "비밀번호" }, { k: "image", l: "사진" }].map(t => (
                <button key={t.k} onClick={() => { setTab(t.k); setError(""); }} style={{
                  flex: 1, padding: "10px 0", background: "transparent", border: "none",
                  borderBottom: `2.5px solid ${tab === t.k ? C.primary : "transparent"}`,
                  fontSize: 12, fontWeight: tab === t.k ? 700 : 400,
                  color: tab === t.k ? C.primary : C.textMuted, cursor: "pointer", fontFamily: "inherit", marginBottom: -1,
                }}>{t.l}</button>
              ))}
            </div>
            {tab === "name" && <div style={{ marginBottom: 20 }}><label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>새 이름</label><input value={name} onChange={e => setName(e.target.value)} placeholder="변경할 이름" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border}/></div>}
            {tab === "bio" && <div style={{ marginBottom: 20 }}><label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>한줄 소개 ({bio.length}/100)</label><textarea value={bio} onChange={e => setBio(e.target.value.slice(0, 100))} placeholder="나를 간단히 소개해주세요" rows={3} style={{ ...inp, resize: "none", lineHeight: 1.6 }} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border}/></div>}
            {tab === "pw" && (<><div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>새 비밀번호</label><input type="password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="8자 이상" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border}/></div><div style={{ marginBottom: 20 }}><label style={{ fontSize: 12, color: C.textMuted, display: "block", marginBottom: 7 }}>비밀번호 확인</label><input type="password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} placeholder="다시 입력" style={inp} onFocus={e => e.target.style.borderColor = C.primary} onBlur={e => e.target.style.borderColor = C.border}/>{pwConfirm && pwNew === pwConfirm && <p style={{ fontSize: 11, color: C.success, marginTop: 5 }}>비밀번호가 일치합니다</p>}</div></>)}
            {tab === "image" && (<div style={{ marginBottom: 20, textAlign: "center" }}>{imgPreview ? <img src={imgPreview} alt="preview" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}`, margin: "0 auto 12px", display: "block" }}/> : <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.bg, border: `2px dashed ${C.border}`, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg></div>}<label style={{ display: "inline-block", padding: "8px 18px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.primary, cursor: "pointer" }}>이미지 선택<input type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }}/></label><p style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>JPG, PNG · 최대 5MB</p></div>)}
            {error && <p style={{ fontSize: 12, color: C.danger, marginBottom: 14, textAlign: "center" }}>{error}</p>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.textSub, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
              <button onClick={tab === "image" ? handleSaveImage : handleSave} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: C.primaryGrad, color: C.white, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>{saving ? "저장 중..." : "저장"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════ 메인 ══════════════ */
export default function MentorMyPage() {
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const userName  = user?.name || user?.email?.split("@")[0] || "사용자";
  const [activeTab, setActiveTab] = useState("pending");
  const [profile, setProfile]     = useState(null);
  const [showEdit, setShowEdit]   = useState(false);
  const [profileImage, setProfileImage] = useState(() => localStorage.getItem(`profile_img_${user?.email}`) || null);
  const [requests, setRequests]   = useState([]);
  const [confirmed, setConfirmed] = useState([]);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [pendingFeedbackSessions, setPendingFeedbackSessions] = useState([]);

  useEffect(() => {
    getMyProfile().then(p => {
      setProfile(p);
      if (p?.profile_image_url) {
        setProfileImage(p.profile_image_url);
        localStorage.setItem(`profile_img_${user?.email}`, p.profile_image_url);
      }
    }).catch(() => {});

    getUserSessions().then(data => {
      if (!data?.length) return;
      const fmt = s => ({
        id: s.id,
        date: s.started_at?.slice(5, 10).replace("-", ".") ?? "",
        time: s.started_at?.slice(11, 16) ?? "",
        title: s.job_category ? `${s.job_category} 면접` : "모의 면접",
        detail: `${s.session_type ?? "1:1"} · ${s.mentee_name ?? ""}`,
        reportStatus: s.report_status,
      });
      const pending   = data.filter(s => s.status === "pending").map(fmt);
      const conf      = data.filter(s => s.status === "scheduled").map(fmt);
      const completed = data.filter(s => s.status === "completed").map(fmt);
      setRequests(pending);
      setConfirmed(conf);
      setCompletedSessions(completed);
      setPendingFeedbackSessions(completed.filter(s => s.reportStatus !== "final"));
    }).catch(() => {});
  }, []);

  const displayName    = profile?.name ?? userName;
  const tags           = profile?.tags?.map(t => t.name) ?? [];
  const jobStr         = profile?.tags?.find(t => t.category === "직무")?.name || "";
  const totalSessions  = completedSessions.length;
  const now            = new Date();
  const thisMonth      = completedSessions.filter(s => s.date?.startsWith(`${String(now.getMonth() + 1).padStart(2, "0")}.`)).length;

  const handleWithdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.")) return;
    try { await fetch("/api/auth/withdraw", { method: "DELETE", headers: { Authorization: `Bearer ${user?.accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };

  const handleAccept = id => setRequests(r => r.filter(x => x.id !== id));

  const TABS = [
    { key: "pending",   label: "대기 중",  count: requests.length,           color: C.warning },
    { key: "confirmed", label: "확정",     count: confirmed.length,           color: C.success },
    { key: "completed", label: "완료",     count: completedSessions.length,   color: C.primary },
  ];

  const Card = ({ children, style }) => (
    <div style={{ background: C.white, borderRadius: 20, padding: "22px 24px", boxShadow: C.shadow, ...style }}>{children}</div>
  );

  const EmptyState = ({ text, sub }) => (
    <div style={{ textAlign: "center", padding: "36px 0", color: C.textMuted }}>
      <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{text}</p>
      {sub && <p style={{ fontSize: 12 }}>{sub}</p>}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter','Noto Sans KR',-apple-system,sans-serif;background:${C.bg}}
        @media(max-width:900px){.mp-layout{flex-direction:column!important}.mp-sidebar{width:100%!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5% 72px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.04em", marginBottom: 6 }}>마이페이지</h1>
            <p style={{ fontSize: 14, color: C.textMuted }}>멘토 활동 현황을 확인하고 일정을 관리하세요</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => navigate("/mentor/register")} style={{
              padding: "11px 22px", background: C.primaryGrad, color: C.white,
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 12px rgba(13,34,64,0.25)",
              transition: "opacity 0.15s",
              display: "flex", alignItems: "center", gap: 8,
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              면접 일정 관리
            </button>
          </div>
        </div>

        <div className="mp-layout" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

          {/* ── 사이드바 ── */}
          <div className="mp-sidebar" style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            <Card>
              {/* 아바타 + 이름 */}
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                {profileImage
                  ? <img src={profileImage} alt="profile" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", margin: "0 auto 12px", display: "block", border: `2px solid ${C.border}` }}/>
                  : <JobAvatar jobStr={jobStr} size={72} style={{ margin: "0 auto 12px" }}/>
                }
                <p style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{displayName}</p>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99, background: C.primaryLight, color: C.primary }}>멘토</span>
                {profile?.bio && <p style={{ fontSize: 12, color: C.textSub, marginTop: 8, lineHeight: 1.6 }}>{profile.bio}</p>}
              </div>

              {/* 현 소속 기업 · 직무 · 경력 */}
              {(() => {
                const company = profile?.tags?.find(t => t.category === "소속기업")?.name;
                const job     = profile?.tags?.find(t => t.category === "직무")?.name;
                const career  = profile?.tags?.find(t => t.category === "경력" || t.category === "근속년수")?.name;
                if (!company && !job && !career) return null;
                return (
                  <div style={{ background: C.bg, borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                    {[
                      { label: "소속 기업", value: company },
                      { label: "직무",     value: job },
                      { label: "경력",     value: career },
                    ].filter(r => r.value).map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                        <span style={{ fontSize: 11, color: C.textMuted }}>{r.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", marginBottom: 16 }}>
                  {tags.slice(0, 6).map((t, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: C.bg, color: C.textSub, border: `1px solid ${C.border}` }}>{t}</span>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "14px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, marginBottom: 14 }}>
                {[
                  { n: String(totalSessions), l: "총 멘티" },
                  { n: "-",                   l: "평균평점" },
                  { n: String(thisMonth),     l: "이번달" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: C.primary, margin: 0 }}>{s.n}</p>
                    <p style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{s.l}</p>
                  </div>
                ))}
              </div>

              {[
                { l: "대기 요청",      v: `${requests.length}건`,          alert: false },
                { l: "확정 세션",      v: `${confirmed.length}건`,         alert: false },
                { l: "완료 세션",      v: `${totalSessions}건`,            alert: false },
                { l: "피드백 미작성",  v: `${pendingFeedbackSessions.length}건`, alert: pendingFeedbackSessions.length > 0 },
              ].map((r, i, arr) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{r.l}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: r.alert ? C.danger : C.primary }}>{r.v}</span>
                </div>
              ))}
            </Card>

            {/* 프로필 수정 · 회원탈퇴 */}
            <button onClick={() => setShowEdit(true)} style={{ padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.text, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", boxShadow: C.shadow }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}
            >프로필 수정</button>
            <button onClick={handleWithdraw} style={{ padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
            >회원탈퇴</button>
          </div>

          {/* ── 메인 콘텐츠 ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>

            {/* 피드백 미작성 알림 */}
            {pendingFeedbackSessions.length > 0 && (
              <div style={{
                background: "linear-gradient(135deg, #FFFBEB 0%, #FFF3CD 100%)",
                border: "1px solid #FFD43B", borderRadius: 16, padding: "16px 22px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                boxShadow: "0 4px 16px rgba(255,193,7,0.15)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "#F59F00", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#7A4F00", marginBottom: 2 }}>
                      피드백 미작성 {pendingFeedbackSessions.length}건이 있어요
                    </p>
                    <p style={{ fontSize: 12, color: "#9C6A00" }}>멘티가 최종 리포트를 기다리고 있어요</p>
                  </div>
                </div>
                <button onClick={() => navigate(`/mentor/feedback/${pendingFeedbackSessions[0].id}`)} style={{
                  padding: "9px 18px", background: "#7A4F00", color: "white",
                  border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                  transition: "opacity 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >바로 작성하기 →</button>
              </div>
            )}

            {/* 세션 통계 카드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                {
                  gradient: C.primaryGrad, shadowColor: "rgba(13,34,64,0.25)",
                  label: "이번 달 세션", value: `${thisMonth}회`,
                  sub: "완료 기준",
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
                },
                {
                  gradient: "linear-gradient(135deg, #0CA678 0%, #38D9A9 100%)", shadowColor: "rgba(12,166,120,0.25)",
                  label: "총 완료 세션", value: `${totalSessions}회`,
                  sub: "누적 기준",
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
                },
                {
                  gradient: "linear-gradient(135deg, #F76707 0%, #FFA94D 100%)", shadowColor: "rgba(247,103,7,0.25)",
                  label: "대기 중인 요청", value: `${requests.length}건`,
                  sub: requests.length > 0 ? "확인 필요" : "요청 없음",
                  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
                },
              ].map((s, i) => (
                <div key={i} style={{
                  background: s.gradient, borderRadius: 16, padding: "20px 22px",
                  boxShadow: `0 6px 20px ${s.shadowColor}`,
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: -16, right: -16, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}/>
                  <div style={{ position: "relative" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{s.icon}</div>
                    <p style={{ fontSize: 26, fontWeight: 800, color: C.white, letterSpacing: "-0.04em", marginBottom: 4 }}>{s.value}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>{s.label}</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 세션 탭 */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              {/* 탭 헤더 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: `1px solid ${C.border}` }}>
                {TABS.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                    padding: "15px 12px", background: activeTab === t.key ? C.bg : "transparent",
                    border: "none", borderBottom: `2px solid ${activeTab === t.key ? C.primary : "transparent"}`,
                    fontSize: 14, fontWeight: activeTab === t.key ? 700 : 400,
                    color: activeTab === t.key ? C.primary : C.textSub,
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "all 0.15s",
                  }}>
                    {t.label}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                      background: activeTab === t.key ? C.primaryLight : C.bg,
                      color: activeTab === t.key ? C.primary : C.textMuted,
                    }}>{t.count}</span>
                  </button>
                ))}
              </div>

              {/* 탭 콘텐츠 */}
              <div style={{ padding: "0 24px 8px", minHeight: 200 }}>
                {activeTab === "pending" && (
                  requests.length > 0 ? requests.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.warning, flexShrink: 0 }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 3 }}>{r.date} {r.time}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{r.title}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>{r.detail}</p>
                      </div>
                      <button onClick={() => handleAccept(r.id)} style={{
                        padding: "8px 18px", background: C.primaryGrad, color: C.white,
                        border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                        boxShadow: "0 4px 10px rgba(13,34,64,0.2)", transition: "opacity 0.15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                      >수락하기</button>
                    </div>
                  )) : <EmptyState text="대기 중인 요청이 없습니다" sub="멘티 신청이 오면 여기에 표시됩니다"/>
                )}

                {activeTab === "confirmed" && (
                  confirmed.length > 0 ? confirmed.map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.success, flexShrink: 0 }}/>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 3 }}>{r.date} {r.time}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{r.title}</p>
                        <p style={{ fontSize: 12, color: C.textMuted }}>{r.detail}</p>
                      </div>
                      <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 99, background: C.successLight, color: C.success, fontWeight: 700 }}>확정</span>
                    </div>
                  )) : <EmptyState text="확정된 세션이 없습니다" sub="신청을 수락하면 여기에 표시됩니다"/>
                )}

                {activeTab === "completed" && (
                  completedSessions.length > 0 ? completedSessions.slice(0, 10).map(r => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.textMuted, flexShrink: 0 }}/>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 3 }}>{r.date}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.title}</p>
                      </div>
                      {r.reportStatus === "final"
                        ? <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 99, background: C.successLight, color: C.success, fontWeight: 700 }}>피드백 완료</span>
                        : <button onClick={() => navigate(`/mentor/feedback/${r.id}`)} style={{
                            fontSize: 11, padding: "6px 14px", borderRadius: 99,
                            background: C.warningLight, color: C.warning,
                            border: `1px solid ${C.warning}40`, fontWeight: 700,
                            cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.15s",
                          }}
                            onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
                            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                          >피드백 작성</button>
                      }
                    </div>
                  )) : <EmptyState text="완료된 세션이 없습니다" sub="세션 완료 후 여기에 기록됩니다"/>
                )}
              </div>
            </Card>

          </div>
        </div>
      </main>

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} userEmail={user?.email} onImageChange={img => setProfileImage(img)} initialBio={profile?.bio || ""}/>}
    </>
  );
}
