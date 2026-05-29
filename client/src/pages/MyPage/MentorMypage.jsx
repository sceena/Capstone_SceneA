import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMyProfile, updateMyProfile, getUserSessions } from "../../api/users";
import { getAvatar } from "../../utils/avatar";

const C = {
  navy:     "#0D2240",
  accent:   "#1B4F7A",
  mid:      "#3A7FAF",
  cream:    "#e8e0d0",
  light:    "#F2EDE4",
  bg:       "#FAF8F4",
  white:    "#FFFFFF",
  text:     "#1A1818",
  textSub:  "#6B6863",
  textMuted:"#9E9B95",
  border:   "#E8E0D0",
  teal:     "#1D9E75", tealLight:"#E8F5EE",
  orange:   "#F59E0B", orangeLight:"#FEF3C7",
  red:      "#EF4444", redLight:"#FEF2F2",
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
    try {
      await fetch("/api/auth/logout", { method:"POST", headers:{ Authorization:`Bearer ${accessToken}` } });
    } catch {}
    clearAuthUser();
    navigate("/");
  };
  return (
    <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님</span>
        <Link to="/" style={{ textDecoration:"none" }}><LogoIcon size={28}/></Link>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{l:"대시보드",to:"/dashboard/mentor"},{l:"예약 확인",to:"#"},{l:"MyPage",to:"/mentor/mypage",bold:true}].map((x,i)=>(
            <Link key={i} to={x.to} style={{ fontSize:14, fontWeight:x.bold?700:400, color:C.white, textDecoration:"none", opacity:x.bold?1:0.85 }}
              onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=x.bold?1:0.85}>{x.l}</Link>
          ))}
          <button onClick={handleLogout} style={{
            padding:"7px 16px", borderRadius:8,
            border:"1px solid rgba(255,255,255,0.3)",
            background:"transparent", color:"rgba(255,255,255,0.85)",
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
          }}
            onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.6)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="rgba(255,255,255,0.3)"; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

const StatCard = ({ label, value, sub, subColor }) => (
  <div style={{ background:C.white, borderRadius:14, padding:"18px 20px", border:`1px solid ${C.border}`, flex:1, minWidth:0 }}>
    <p style={{ fontSize:12, color:C.textMuted, marginBottom:8 }}>{label}</p>
    <p style={{ fontSize:26, fontWeight:700, color:C.navy, letterSpacing:"-0.03em", marginBottom:4 }}>{value}</p>
    {sub && <p style={{ fontSize:12, color:subColor||C.textMuted }}>{sub}</p>}
  </div>
);

const SessionRequestItem = ({ date, time, title, detail, onAccept }) => (
  <div style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
    <div style={{ width:8, height:8, borderRadius:"50%", background:C.orange, flexShrink:0 }}/>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ fontSize:13, color:C.textMuted, marginBottom:2 }}>{date} {time}</p>
      <p style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:2 }}>{title}</p>
      <p style={{ fontSize:12, color:C.textMuted }}>{detail}</p>
    </div>
    <button onClick={onAccept} style={{
      padding:"7px 16px", background:C.navy, color:C.white,
      border:"none", borderRadius:20, fontSize:12, fontWeight:600,
      cursor:"pointer", fontFamily:"inherit", flexShrink:0,
    }}
      onMouseEnter={e=>e.currentTarget.style.background=C.accent}
      onMouseLeave={e=>e.currentTarget.style.background=C.navy}
    >수락하기</button>
  </div>
);

const ReviewCard = ({ initials, name, role, company, stars, text, bgColor }) => (
  <div style={{ marginBottom:20 }}>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:36, height:36, borderRadius:"50%", background:bgColor, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:C.white, flexShrink:0 }}>{initials}</div>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:C.text }}>{name}</p>
          <p style={{ fontSize:12, color:C.textMuted }}>{role} · {company}</p>
        </div>
      </div>
      <div style={{ display:"flex", gap:2 }}>
        {"★★★★★".split("").map((s,i)=>(
          <span key={i} style={{ fontSize:13, color:i<stars?"#F59E0B":"#D1CFC9" }}>★</span>
        ))}
      </div>
    </div>
    <p style={{ fontSize:13, color:C.textSub, lineHeight:1.75 }}>{text}</p>
  </div>
);

/* ── 프로필 수정 모달 ── */
function EditProfileModal({ onClose, userEmail, onImageChange, initialBio }) {
  const [tab, setTab]           = useState("name");
  const [name, setName]         = useState("");
  const [bio, setBio]           = useState(initialBio || "");
  const [pwNew, setPwNew]       = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile, setImgFile]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  const pwMismatch = pwConfirm.length > 0 && pwNew !== pwConfirm;
  const pwMatch    = pwConfirm.length > 0 && pwNew === pwConfirm;
  const pwTooShort = pwNew.length > 0 && pwNew.length < 8;

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
      if (e?.status === 401) setError("로그인이 만료되었습니다. 다시 로그인해주세요.");
      else if (e?.status === 400) setError("입력값을 확인해주세요.");
      else setError("저장에 실패했습니다. 다시 시도해주세요.");
      setSaving(false);
    }
  };

  const inputStyle = () => ({
    width:"100%", padding:"11px 14px", borderRadius:10,
    border:`1.5px solid ${C.border}`,
    fontSize:14, fontFamily:"inherit", outline:"none", background:C.bg, boxSizing:"border-box",
  });

  return (
    <div
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}
    >
      <div style={{ background:C.white, borderRadius:18, padding:"32px 36px", width:420, boxShadow:"0 8px 40px rgba(13,34,68,0.18)" }}>
        <h3 style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:20 }}>프로필 수정</h3>

        {done ? (
          <div style={{ textAlign:"center", padding:"24px 0" }}>
            <div style={{ fontSize:40, marginBottom:10 }}>✓</div>
            <p style={{ color:C.teal, fontWeight:600, fontSize:15 }}>저장되었습니다!</p>
          </div>
        ) : (
          <>
            {/* 탭 */}
            <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginBottom:22 }}>
              {[{k:"name",l:"이름"},{k:"bio",l:"한줄 소개"},{k:"pw",l:"비밀번호"},{k:"image",l:"이미지"}].map(t=>(
                <button key={t.k} onClick={()=>{ setTab(t.k); setError(""); }} style={{
                  flex:1, padding:"10px 0", background:"transparent", border:"none",
                  borderBottom:`2.5px solid ${tab===t.k?C.navy:"transparent"}`,
                  fontSize:12, fontWeight:tab===t.k?700:400,
                  color:tab===t.k?C.navy:C.textMuted,
                  cursor:"pointer", fontFamily:"inherit", marginBottom:-1,
                }}>{t.l}</button>
              ))}
            </div>

            {tab === "name" && (
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:7 }}>새 이름</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="변경할 이름을 입력하세요"
                  style={inputStyle()}
                  onFocus={e=>e.target.style.borderColor=C.navy}
                  onBlur={e=>e.target.style.borderColor=C.border}
                />
              </div>
            )}

            {tab === "bio" && (
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:7 }}>
                  한줄 소개 <span style={{ color:bio.length>100?C.red:C.textMuted }}>({bio.length}/100)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={e=>setBio(e.target.value.slice(0,100))}
                  placeholder="나를 간단히 소개해주세요 (최대 100자)"
                  rows={3}
                  style={{ ...inputStyle(), resize:"none", lineHeight:1.6 }}
                  onFocus={e=>e.target.style.borderColor=C.navy}
                  onBlur={e=>e.target.style.borderColor=C.border}
                />
              </div>
            )}

            {tab === "pw" && (
              <>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:7 }}>새 비밀번호</label>
                  <input type="password" value={pwNew} onChange={e=>setPwNew(e.target.value)} placeholder="8자 이상 입력"
                    style={inputStyle()}
                    onFocus={e=>e.target.style.borderColor=C.navy}
                    onBlur={e=>e.target.style.borderColor=C.border}
                  />
                  {pwTooShort && <p style={{ fontSize:11, color:C.red, marginTop:5 }}>비밀번호는 8자 이상이어야 합니다.</p>}
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12, color:C.textMuted, display:"block", marginBottom:7 }}>새 비밀번호 확인</label>
                  <input type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} placeholder="비밀번호를 다시 입력"
                    style={{ ...inputStyle(), borderColor: pwMismatch ? C.red : pwMatch ? C.teal : C.border }}
                    onFocus={e=>e.target.style.borderColor= pwMismatch ? C.red : pwMatch ? C.teal : C.navy}
                    onBlur={e=>e.target.style.borderColor= pwMismatch ? C.red : pwMatch ? C.teal : C.border}
                  />
                  {pwMismatch && <p style={{ fontSize:11, color:C.red, marginTop:5 }}>비밀번호가 일치하지 않습니다.</p>}
                  {pwMatch    && <p style={{ fontSize:11, color:C.teal, marginTop:5 }}>비밀번호가 일치합니다.</p>}
                </div>
              </>
            )}

            {tab === "image" && (
              <div style={{ marginBottom:20 }}>
                <div style={{ textAlign:"center", marginBottom:16 }}>
                  {imgPreview ? (
                    <img src={imgPreview} alt="preview" style={{ width:80, height:80, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.border}`, margin:"0 auto 10px", display:"block" }}/>
                  ) : (
                    <div style={{ width:80, height:80, borderRadius:"50%", background:C.bg, border:`2px dashed ${C.border}`, margin:"0 auto 10px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
                    </div>
                  )}
                  <label style={{ display:"inline-block", padding:"8px 18px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontWeight:600, color:C.navy, cursor:"pointer", background:C.white }}>
                    이미지 선택<input type="file" accept="image/*" onChange={handleImageFile} style={{ display:"none" }}/>
                  </label>
                </div>
                <p style={{ fontSize:11, color:C.textMuted, textAlign:"center" }}>JPG, PNG, GIF · 최대 5MB</p>
              </div>
            )}

            {error && <p style={{ fontSize:12, color:C.red, marginBottom:14, textAlign:"center" }}>{error}</p>}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose} style={{ flex:1, padding:"12px", borderRadius:10, border:`1px solid ${C.border}`, background:C.white, color:C.textSub, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>취소</button>
              <button
                onClick={tab === "image" ? handleSaveImage : handleSave}
                disabled={saving || (tab==="pw" && (pwMismatch || pwTooShort))}
                style={{ flex:1, padding:"12px", borderRadius:10, border:"none", background:(saving||(tab==="pw"&&(pwMismatch||pwTooShort)))?C.textMuted:C.navy, color:C.white, fontSize:14, fontWeight:700, cursor:(saving||(tab==="pw"&&(pwMismatch||pwTooShort)))?"not-allowed":"pointer", fontFamily:"inherit" }}
              >
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
export default function MentorMyPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const [activeTab, setActiveTab] = useState("pending");

  const [profile, setProfile]   = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [profileImage, setProfileImage] = useState(
    () => localStorage.getItem(`profile_img_${user?.email}`) || null
  );

  const [requests, setRequests] = useState([]);
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
      const fmt = (s) => ({
        id: s.id,
        date: s.started_at?.slice(5,10).replace("-",".") ?? "",
        time: s.started_at?.slice(11,16) ?? "",
        title: s.job_category ? `${s.job_category} 면접` : "모의 면접",
        detail: `${s.session_type ?? "1:1"} · ${s.mentee_name ?? ""}`,
        reportStatus: s.report_status,
      });
      const pending   = data.filter(s => s.status === "pending").map(fmt);
      const confirmed = data.filter(s => s.status === "scheduled").map(fmt);
      const completed = data.filter(s => s.status === "completed").map(fmt);
      const needsFeedback = completed.filter(s => s.reportStatus !== "final");

      setRequests(pending);
      setConfirmed(confirmed);
      setCompletedSessions(completed);
      setPendingFeedbackSessions(needsFeedback);
    }).catch(() => {});
  }, []);

  const displayName = profile?.name ?? userName;
  const tags = profile?.tags?.map(t => t.name) ?? ["기술 면접", "인성 면접", "포트폴리오"];

  const totalSessions = completedSessions.length || 42;
  const thisMonth = completedSessions.filter(s => {
    const now = new Date();
    return s.date?.startsWith(`${String(now.getMonth()+1).padStart(2,"0")}.`);
  }).length || 7;

  const handleWithdraw = async () => {
    if (!window.confirm("정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      await fetch("/api/auth/withdraw", {
        method:"DELETE",
        headers:{ Authorization:`Bearer ${user?.accessToken}` },
      });
    } catch {}
    clearAuthUser();
    navigate("/");
  };

  const handleAccept = (id) => setRequests(r=>r.filter(x=>x.id!==id));

  const tabData = { pending: requests, confirmed, completed: completedSessions };
  const tabList = [
    { key:"pending",   label:"대기중",  count:requests.length, color:C.orange },
    { key:"confirmed", label:"확정",    count:confirmed.length },
    { key:"completed", label:"완료",    count:completedSessions.length || 37 },
  ];

  const MOCK_REVIEWS = [
    { initials:"김M", name:"김민준", role:"백엔드", company:"카카오 지원", stars:5, bgColor:"#1B4F7A",
      text:"실제 현장에서 어떤 답변을 원하는지 구체적으로 알려주셔서 너무 좋았어요. STAR 구조 피드백 덕분에 다음 면접에서 훨씬 자신감 있게 답변할 수 있었습니다!" },
    { initials:"박S", name:"박서연", role:"프론트엔드", company:"네이버 지원", stars:4, bgColor:"#0F6E56",
      text:"AI 리포트로 제 약점을 정확히 파악하고, 멘토님이 그 부분을 집중 코칭해주셔서 단기간에 많이 성장한 느낌이에요. 강력 추천합니다." },
    { initials:"이J", name:"이준석", role:"백엔드", company:"라인 지원", stars:4, bgColor:"#533BA0",
      text:"기술 면접 준비에 정말 큰 도움이 됐어요. 다음 세션도 꼭 신청할 예정입니다." },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @media(max-width:900px){.mypage-layout{flex-direction:column!important}.mypage-sidebar{width:100%!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 5% 60px" }}>

        {/* 페이지 타이틀 */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color:C.text, letterSpacing:"-0.02em", marginBottom:4 }}>마이페이지</h1>
            <p style={{ fontSize:13, color:C.textMuted }}>멘토 활동 현황과 예약을 관리하세요</p>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>navigate("/mentor/register")} style={{
              padding:"10px 18px", background:C.white, color:C.text,
              border:`1.5px solid ${C.border}`, borderRadius:8,
              fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >가능 시간 관리</button>
            <button onClick={()=>setShowEdit(true)} style={{
              padding:"10px 18px", background:C.white, color:C.text,
              border:`1.5px solid ${C.border}`, borderRadius:8,
              fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >프로필 수정</button>
            <button onClick={handleWithdraw} style={{
              padding:"10px 18px", background:C.white, color:C.red,
              border:`1.5px solid ${C.border}`, borderRadius:8,
              fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.red}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >회원탈퇴</button>
          </div>
        </div>

        <div className="mypage-layout" style={{ display:"flex", gap:24, alignItems:"flex-start" }}>

          {/* ── 사이드바 프로필 ── */}
          <div className="mypage-sidebar" style={{ width:220, flexShrink:0 }}>
            <div style={{ background:C.white, borderRadius:16, padding:"24px 20px", border:`1px solid ${C.border}`, marginBottom:16 }}>
              {/* 아바타 */}
              <div style={{ textAlign:"center", marginBottom:16 }}>
                {profileImage ? (
                  <img src={profileImage} alt="profile" style={{ width:68, height:68, borderRadius:"50%", objectFit:"cover", margin:"0 auto 10px", display:"block", border:`2px solid ${C.border}` }}/>
                ) : (() => { const av = getAvatar(user?.email); return (
                  <div style={{ width:68, height:68, borderRadius:"50%", background:av.color, margin:"0 auto 10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>{av.animal}</div>
                ); })()}
                <p style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:2 }}>{displayName}</p>
                <p style={{ fontSize:12, color:C.textSub }}>멘토</p>
                {profile?.bio && (
                  <p style={{ fontSize:12, color:C.textSub, marginTop:6, lineHeight:1.6, padding:"0 4px" }}>{profile.bio}</p>
                )}
              </div>

              {/* 태그 */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:5, justifyContent:"center", marginBottom:16 }}>
                {tags.map((t,i)=>(
                  <span key={i} style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:C.bg, color:C.textSub }}>{t}</span>
                ))}
              </div>

              {/* 미니 스탯 */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18, padding:"12px 0", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
                {[
                  {n: String(totalSessions), l:"총 멘티"},
                  {n: "4.9", l:"평균평점"},
                  {n: String(thisMonth), l:"이번달"},
                ].map((s,i)=>(
                  <div key={i} style={{ textAlign:"center" }}>
                    <p style={{ fontSize:16, fontWeight:700, color:C.navy }}>{s.n}</p>
                    <p style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{s.l}</p>
                  </div>
                ))}
              </div>

              {/* 상세 정보 */}
              {[
                {l:"대기 요청",v:`${requests.length}건`},
                {l:"확정 세션",v:`${confirmed.length}건`},
                {l:"완료 세션",v:`${totalSessions}건`},
                {l:"피드백 미작성",v:`${pendingFeedbackSessions.length}건`},
                {l:"보유 포인트",v:"2,100 P"},
              ].map((r,i,arr)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none" }}>
                  <span style={{ fontSize:12, color:C.textMuted }}>{r.l}</span>
                  <span style={{ fontSize:12, fontWeight:600, color:r.l==="피드백 미작성"&&pendingFeedbackSessions.length>0?C.red:C.text }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 메인 콘텐츠 ── */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:20 }}>


            {/* 수익 카드 */}
            <div style={{ background:C.white, borderRadius:16, padding:"20px 24px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                <div>
                  <p style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>이번 달 수익</p>
                  <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.02em", marginBottom:4 }}>{thisMonth * 50} P</p>
                  <p style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>세션 {thisMonth}회 × 50P</p>
                  <p style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>정산 상태</p>
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:999, background:C.tealLight, color:C.teal }}>정산 예정</span>
                </div>
                <div style={{ borderLeft:`1px solid ${C.border}`, paddingLeft:16 }}>
                  <p style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>누적 수익</p>
                  <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.02em", marginBottom:4 }}>{totalSessions * 50} P</p>
                  <p style={{ fontSize:11, color:C.textMuted }}>총 {totalSessions}회 누적</p>
                </div>
                <div style={{ borderLeft:`1px solid ${C.border}`, paddingLeft:16 }}>
                  <p style={{ fontSize:12, color:C.textMuted, marginBottom:6 }}>정산 예정일</p>
                  <p style={{ fontSize:24, fontWeight:700, color:C.navy, letterSpacing:"-0.02em", marginBottom:4 }}>매월 말일</p>
                  <p style={{ fontSize:11, color:C.orange, fontWeight:600 }}>자동 정산</p>
                </div>
              </div>
            </div>

            {/* 피드백 미작성 알림 */}
            {pendingFeedbackSessions.length > 0 && (
              <div style={{
                background:"#FFF8F0", border:`1.5px solid ${C.orange}40`,
                borderRadius:12, padding:"14px 20px",
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:16,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:C.red, flexShrink:0 }}/>
                  <p style={{ fontSize:13, color:C.text, fontWeight:500 }}>
                    완료된 세션 중 <strong style={{ color:C.red }}>피드백 미작성 {pendingFeedbackSessions.length}건</strong>이 있어요. 멘티가 최종 리포트를 기다리고 있어요!
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/mentor/feedback/${pendingFeedbackSessions[0].id}`)}
                  style={{
                    padding:"8px 16px", background:C.white, color:C.navy,
                    border:`1.5px solid ${C.border}`, borderRadius:8,
                    fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", flexShrink:0,
                  }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
                >바로 작성하기</button>
              </div>
            )}

            {/* 요청 탭 */}
            <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              <div style={{ display:"flex", borderBottom:`1px solid ${C.border}` }}>
                {tabList.map(t=>(
                  <button key={t.key} onClick={()=>setActiveTab(t.key)} style={{
                    flex:1, padding:"14px 0", background:"transparent", border:"none",
                    borderBottom:`2.5px solid ${activeTab===t.key?C.navy:"transparent"}`,
                    fontSize:14, fontWeight:activeTab===t.key?700:400,
                    color:activeTab===t.key?C.navy:C.textMuted,
                    cursor:"pointer", fontFamily:"inherit",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                  }}>
                    {t.label}
                    <span style={{
                      fontSize:11, fontWeight:700, padding:"2px 7px", borderRadius:999,
                      background:activeTab===t.key?C.navy:C.bg,
                      color:activeTab===t.key?C.white:C.textMuted,
                    }}>{t.count}</span>
                  </button>
                ))}
              </div>

              <div style={{ padding:"4px 24px 8px" }}>
                {activeTab==="pending" && (
                  requests.length > 0
                    ? requests.map(r=>(
                        <SessionRequestItem key={r.id} date={r.date} time={r.time} title={r.title} detail={r.detail} onAccept={()=>handleAccept(r.id)}/>
                      ))
                    : <div style={{ padding:"32px 0", textAlign:"center", color:C.textMuted, fontSize:13 }}>대기 중인 요청이 없습니다</div>
                )}
                {activeTab==="confirmed" && (
                  confirmed.length > 0
                    ? confirmed.map(r=>(
                        <div key={r.id} style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:C.teal, flexShrink:0 }}/>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:13, color:C.textMuted, marginBottom:2 }}>{r.date} {r.time}</p>
                            <p style={{ fontSize:14, fontWeight:600, color:C.text }}>{r.title}</p>
                            <p style={{ fontSize:12, color:C.textMuted }}>{r.detail}</p>
                          </div>
                          <span style={{ fontSize:11, padding:"4px 10px", borderRadius:999, background:C.tealLight, color:C.teal, fontWeight:600 }}>확정</span>
                        </div>
                      ))
                    : <div style={{ padding:"32px 0", textAlign:"center", color:C.textMuted, fontSize:13 }}>확정된 세션이 없습니다</div>
                )}
                {activeTab==="completed" && (
                  completedSessions.length > 0
                    ? completedSessions.slice(0, 5).map(r=>(
                        <div key={r.id} style={{ display:"flex", alignItems:"center", gap:16, padding:"14px 0", borderBottom:`1px solid ${C.border}` }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:C.textMuted, flexShrink:0 }}/>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:13, color:C.textMuted, marginBottom:2 }}>{r.date}</p>
                            <p style={{ fontSize:14, fontWeight:600, color:C.text }}>{r.title}</p>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {r.reportStatus === "final" ? (
                              <span style={{ fontSize:11, padding:"4px 10px", borderRadius:999, background:C.tealLight, color:C.teal, fontWeight:600 }}>피드백 완료</span>
                            ) : (
                              <button onClick={() => navigate(`/mentor/feedback/${r.id}`)} style={{
                                fontSize:11, padding:"4px 12px", borderRadius:999,
                                background:"#FFF8F0", color:C.orange,
                                border:`1px solid ${C.orange}40`, fontWeight:700,
                                cursor:"pointer", fontFamily:"inherit",
                              }}>피드백 작성</button>
                            )}
                          </div>
                        </div>
                      ))
                    : <div style={{ padding:"20px 0", textAlign:"center", color:C.textMuted, fontSize:13 }}>완료된 세션이 없습니다</div>
                )}
              </div>
            </div>

            {/* 최근 멘티 리뷰 */}
            <div style={{ background:C.white, borderRadius:16, padding:"24px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <h3 style={{ fontSize:16, fontWeight:700, color:C.text }}>최근 멘티 리뷰</h3>
                <span style={{ fontSize:12, color:C.textMuted }}>멘티가 남긴 후기</span>
              </div>
              {MOCK_REVIEWS.map((r,i)=>(
                <div key={i}>
                  <ReviewCard {...r}/>
                  {i<MOCK_REVIEWS.length-1&&<div style={{ borderBottom:`1px solid ${C.border}`, marginBottom:20 }}/>}
                </div>
              ))}
            </div>

          </div>
        </div>
      </main>

      {showEdit && (
        <EditProfileModal
          onClose={() => setShowEdit(false)}
          userEmail={user?.email}
          onImageChange={(img) => setProfileImage(img)}
          initialBio={profile?.bio || ""}
        />
      )}
    </>
  );
}
