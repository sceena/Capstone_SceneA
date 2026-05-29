import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setAuthUser } from "../../store/authStore";

/* ============================================================
   로그인 페이지  (pages/Auth/Login.jsx)
   디자인: 좌측 네이비 패널 / 우측 크림 폼 카드
   ============================================================ */

const C = {
  navy:     "#0D2240",
  navyMid:  "#1B4F7A",
  cream:    "#F4F2EE",
  creamDark:"#EDEAE4",
  white:    "#FFFFFF",
  teal:     "#1D9E75",
  text:     "#1A1818",
  textSub:  "#6B6863",
  textMuted:"#9E9B95",
  border:   "#DDD9D3",
  inputBg:  "#F4F2EE",
  error:    "#D94040",
};

/* ── 구글 아이콘 ── */
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.39a4.61 4.61 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.32z" fill="#4285F4"/>
    <path d="M10 20c2.7 0 4.97-.9 6.62-2.44l-3.23-2.51c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.6A10 10 0 0 0 10 20z" fill="#34A853"/>
    <path d="M4.41 11.89A6.01 6.01 0 0 1 4.1 10c0-.65.11-1.29.31-1.89V5.51H1.07A10 10 0 0 0 0 10c0 1.61.39 3.13 1.07 4.49l3.34-2.6z" fill="#FBBC05"/>
    <path d="M10 3.96c1.47 0 2.79.5 3.83 1.5l2.87-2.87C14.96.99 12.69 0 10 0A10 10 0 0 0 1.07 5.51l3.34 2.6C5.2 5.71 7.4 3.96 10 3.96z" fill="#EA4335"/>
  </svg>
);

/* ── 카카오 아이콘 ── */
const KakaoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.676 5.086 4.228 6.535l-1.08 3.97a.3.3 0 0 0 .46.326l4.37-2.9A12.4 12.4 0 0 0 12 18.6c5.523 0 10-3.477 10-7.8S17.523 3 12 3z" fill="#3C1E1E"/>
  </svg>
);

/* ── 네이버 아이콘 ── */
const NaverIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="4" fill="#03C75A"/>
    <path d="M13.6 12.7L10 7H7v10h3.4v-5.7L14 17h3V7h-3.4z" fill="white"/>
  </svg>
);

/* ── 눈 아이콘 (비밀번호 토글) ── */
const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    )}
  </svg>
);

/* ── 로고 SVG ── */
const LogoIcon = ({ size = 26, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="2" fill={color}/>
    {[0,45,90,135,180,225,270,315].map((deg, i) => {
      const r = deg * Math.PI / 180;
      return (
        <line key={i}
          x1={14 + 2.5 * Math.cos(r)} y1={14 + 2.5 * Math.sin(r)}
          x2={14 + 10  * Math.cos(r)} y2={14 + 10  * Math.sin(r)}
          stroke={color} strokeWidth="1.5" strokeLinecap="round"
        />
      );
    })}
    {[0,90,180,270].map((deg, i) => {
      const r = deg * Math.PI / 180;
      const mx = 14 + 7 * Math.cos(r), my = 14 + 7 * Math.sin(r);
      const offR = r + Math.PI / 2;
      return (
        <g key={`b${i}`}>
          <line x1={mx} y1={my} x2={mx + 3*Math.cos(offR)} y2={my + 3*Math.sin(offR)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
          <line x1={mx} y1={my} x2={mx - 3*Math.cos(offR)} y2={my - 3*Math.sin(offR)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        </g>
      );
    })}
  </svg>
);

/* ============================================================
   메인 컴포넌트
   ============================================================ */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  /* 이메일 포커스 상태 */
  const [emailFocused, setEmailFocused]   = useState(false);
  const [pwFocused,    setPwFocused]      = useState(false);
  const [oauthTarget, setOauthTarget]     = useState(null); // "google"|"kakao"|"naver"

  const handleOAuthRole = (role) => {
    document.cookie = `oauth_role=${role}; path=/; max-age=300`;
    window.location.href = `/oauth2/authorization/${oauthTarget}`;
  };

  const parseTokenRole = (token) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload.role?.toLowerCase();
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 401 || res.status === 403) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false);
        return;
      }
      if (res.status === 404) {
        setError("존재하지 않는 계정입니다.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("로그인에 실패했습니다. 다시 시도해주세요.");
        setLoading(false);
        return;
      }
      const { access_token, refresh_token } = await res.json();
      const role = parseTokenRole(access_token) || "mentee";
      let name = email.split("@")[0];
      try {
        const profileRes = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          if (profile.name) name = profile.name;
        }
      } catch {}
      setAuthUser({ role, email, name, accessToken: access_token, refreshToken: refresh_token });
      navigate(role === "mentor" ? "/dashboard/mentor" : "/dashboard/mentee");
    } catch {
      setError("서버에 연결할 수 없습니다. 백엔드를 실행한 뒤 다시 로그인해 주세요.");
      setLoading(false);
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: 'Noto Sans KR', sans-serif; }

        /* 인풋 자동완성 배경 제거 */
        input:-webkit-autofill,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #F4F2EE inset !important;
          -webkit-text-fill-color: #1A1818 !important;
        }

        .social-btn {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 12px 0;
          background: #FFFFFF;
          border: 1px solid #E2E6EA;
          border-radius: 12px;
          cursor: pointer;
          font-family: 'Noto Sans KR', sans-serif;
          font-size: 13px; font-weight: 500;
          color: #1A1818;
          transition: background 0.18s, border-color 0.18s, transform 0.15s;
          white-space: nowrap;
        }
        .social-btn:hover {
          background: #EDEAE4;
          border-color: #C8C3BB;
          transform: translateY(-1px);
        }

        .login-btn {
          width: 100%;
          padding: 15px;
          background: #0D2240;
          color: #fff;
          font-family: 'Noto Sans KR', sans-serif;
          font-size: 15px; font-weight: 700;
          border: none; border-radius: 12px;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: background 0.2s, transform 0.15s;
        }
        .login-btn:hover:not(:disabled) {
          background: #1B4F7A;
          transform: translateY(-1px);
        }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* 반응형 */
        @media (max-width: 820px) {
          .login-left  { display: none !important; }
          .login-right { width: 100% !important; }
        }
        @media (max-width: 480px) {
          .login-card  { padding: 36px 24px !important; margin: 16px !important; }
        }
      `}</style>

      {/* ── 전체 래퍼 ── */}
      <div style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        overflow: "hidden",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}>

        {/* ════════════════ 왼쪽 네이비 패널 ════════════════ */}
        <div className="login-left" style={{
          width: "30%",
          flexShrink: 0,
          background: C.navy,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "36px 48px 52px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* 배경 블롭 */}
          {[
            { bg:"#1B4F7A", top:"5%",  left:"55%", w:260, h:240, delay:"0s"  },
            { bg:"#1D9E75", top:"55%", left:"5%",  w:220, h:200, delay:"4s", opacity:0.12 },
            { bg:"#2B4A8A", top:"35%", left:"30%", w:180, h:160, delay:"2s"  },
          ].map((b, i) => (
            <div key={i} style={{
              position:"absolute", top:b.top, left:b.left,
              width:b.w, height:b.h,
              background:b.bg, opacity: b.opacity ?? 0.25,
              filter:"blur(60px)",
              borderRadius:"60% 40% 30% 70% / 60% 30% 70% 40%",
              pointerEvents:"none",
            }}/>
          ))}

          {/* 로고 */}
          <Link to="/" style={{
            display:"flex", alignItems:"center", gap:10,
            textDecoration:"none", position:"relative", zIndex:1,
          }}>
            <LogoIcon size={26} color={C.white}/>
            <span style={{ fontSize:18, fontWeight:700, color:C.white, letterSpacing:"-0.3px" }}>
              SceneA
            </span>
          </Link>

          {/* 카피 */}
          <div style={{ position:"relative", zIndex:1 }}>
            <p style={{
              fontSize: 30, fontWeight: 700, color: C.white,
              lineHeight: 1.35, letterSpacing: "-0.02em",
              marginBottom: 16,
            }}>
              당신의 가능성이
            </p>
            <p style={{
              fontSize: 22, fontWeight: 400, color: "rgba(255,255,255,0.72)",
              lineHeight: 1.6, letterSpacing: "-0.01em",
            }}>
              확신으로 바뀌는 시간,<br/>
              지금 시작해보세요.
            </p>

            {/* 장식 라인 */}
            <div style={{
              marginTop: 40,
              display: "flex", gap: 8,
            }}>
              {[1,0.35,0.2].map((op, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 999,
                  background: `rgba(255,255,255,${op})`,
                  width: i === 0 ? 32 : 12,
                }}/>
              ))}
            </div>
          </div>

          {/* 하단 소문구 */}
          <p style={{
            position:"relative", zIndex:1,
            fontSize:12, color:"rgba(255,255,255,0.3)",
            letterSpacing:"0.02em",
          }}>
            © 2026 SceneA. Capstone Design Project.
          </p>
        </div>

        {/* ════════════════ 오른쪽 크림 폼 영역 ════════════════ */}
        <div className="login-right" style={{
          flex: 1,
          background: C.cream,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 5%",
          overflowY: "auto",
        }}>
          <div className="login-card" style={{
            width: "100%",
            maxWidth: 440,
            background: C.creamDark,
            borderRadius: 20,
            padding: "44px 40px",
            boxShadow: "0 2px 16px rgba(13,34,68,0.09), 0 0 0 1px rgba(0,0,0,0.04)",
          }}>

            {/* 헤더 */}
            <h1 style={{
              fontSize: 24, fontWeight: 700, color: C.text,
              letterSpacing: "-0.02em", marginBottom: 8,
            }}>
              Back to your digital life
            </h1>
            <p style={{ fontSize: 14, color: C.textSub, marginBottom: 32, lineHeight: 1.6 }}>
              이메일과 비밀번호로 로그인하세요
            </p>

            {/* 폼 */}
            <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>

              {/* 이메일 */}
              <div style={{ position:"relative" }}>
                <input
                  type="email"
                  placeholder="get@ziontutorial.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={()  => setEmailFocused(false)}
                  style={{
                    width: "100%",
                    padding: "14px 18px",
                    background: emailFocused ? C.white : C.inputBg,
                    border: `1.5px solid ${emailFocused ? C.navy : "transparent"}`,
                    borderRadius: 12,
                    fontSize: 14, color: C.text,
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                />
              </div>

              {/* 비밀번호 */}
              <div style={{ position:"relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPwFocused(true)}
                  onBlur={()  => setPwFocused(false)}
                  style={{
                    width: "100%",
                    padding: "14px 48px 14px 18px",
                    background: pwFocused ? C.white : C.inputBg,
                    border: `1.5px solid ${pwFocused ? C.navy : "transparent"}`,
                    borderRadius: 12,
                    fontSize: 14, color: C.text,
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position:"absolute", right:14, top:"50%",
                    transform:"translateY(-50%)",
                    background:"none", border:"none",
                    cursor:"pointer", padding:0, lineHeight:0,
                  }}
                >
                  <EyeIcon open={showPw}/>
                </button>
              </div>

              {/* 비밀번호 찾기 */}
              <div style={{ textAlign:"right", marginTop:-4 }}>
                <Link to="/auth/forgot" style={{
                  fontSize:12, color:C.textMuted,
                  textDecoration:"none",
                  transition:"color 0.15s",
                }}
                  onMouseEnter={e => e.target.style.color = C.navy}
                  onMouseLeave={e => e.target.style.color = C.textMuted}
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div style={{ fontSize:13, color:C.error, background:"#FCF0F0", border:`1px solid #F5C6C6`, borderRadius:8, padding:"10px 14px" }}>
                  <p>{error}</p>
                </div>
              )}

              {/* 소셜 로그인 구분선 */}
              <div style={{
                display:"flex", alignItems:"center", gap:12,
                margin:"4px 0",
              }}>
                <div style={{ flex:1, height:"1px", background:C.border }}/>
                <span style={{ fontSize:12, color:C.textMuted, whiteSpace:"nowrap" }}>
                  Or continue with
                </span>
                <div style={{ flex:1, height:"1px", background:C.border }}/>
              </div>

              {/* 소셜 버튼 3개 */}
              <div style={{ display:"flex", gap:8 }}>
                <button
                  type="button"
                  className="social-btn"
                  onClick={() => setOauthTarget("google")}
                >
                  <GoogleIcon/> <span>Google</span>
                </button>
                <button
                  type="button"
                  className="social-btn"
                  onClick={() => setOauthTarget("kakao")}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "12px 0",
                    background: "#FEE500",
                    border: "1px solid #FEE500",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                    fontSize: 13, fontWeight: 500,
                    color: "#3C1E1E",
                    transition: "background 0.18s, transform 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F5DB00"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#FEE500"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <KakaoIcon/> <span>카카오</span>
                </button>
                <button
                  type="button"
                  className="social-btn"
                  onClick={() => setOauthTarget("naver")}
                  style={{
                    flex: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, padding: "12px 0",
                    background: "#03C75A",
                    border: "1px solid #03C75A",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontFamily: "'Noto Sans KR', sans-serif",
                    fontSize: 13, fontWeight: 500,
                    color: "#FFFFFF",
                    transition: "background 0.18s, transform 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#02B350"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#03C75A"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <NaverIcon/> <span>네이버</span>
                </button>
              </div>

              {/* 로그인 버튼 */}
              <button
                type="submit"
                className="login-btn"
                disabled={loading}
                style={{ marginTop:4 }}
              >
                {loading ? (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="2.5" strokeLinecap="round"
                      style={{ animation:"spin 0.8s linear infinite" }}
                    >
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    로그인 중...
                  </span>
                ) : "Log in"}
              </button>

            </form>

            {/* 회원가입 유도 */}
            <p style={{
              marginTop:24, textAlign:"center",
              fontSize:13, color:C.textSub,
            }}>
              아직 계정이 없으신가요?{" "}
              <Link to="/auth/register" style={{
                color:C.navy, fontWeight:700,
                textDecoration:"none",
              }}
                onMouseEnter={e => e.target.style.textDecoration = "underline"}
                onMouseLeave={e => e.target.style.textDecoration = "none"}
              >
                회원가입
              </Link>
            </p>

          </div>
        </div>

      </div>

      {/* 스피너 키프레임 */}
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* 소셜 로그인 역할 선택 팝업 */}
      {oauthTarget && (
        <div
          onClick={() => setOauthTarget(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 18,
              padding: "36px 40px", width: 360,
              boxShadow: "0 8px 40px rgba(13,34,68,0.18)",
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: "-0.02em" }}>
              역할을 선택해주세요
            </h3>
            <p style={{ fontSize: 13, color: C.textSub, marginBottom: 28, lineHeight: 1.6 }}>
              처음 소셜 로그인 시 역할이 지정됩니다.<br/>
              기존 계정은 자동으로 연결됩니다.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => handleOAuthRole("MENTEE")}
                style={{
                  flex: 1, padding: "16px 0",
                  borderRadius: 12, border: `2px solid ${C.border}`,
                  background: C.white, cursor: "pointer",
                  fontFamily: "inherit", transition: "border-color 0.18s, background 0.18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.background = "#F0F4F9"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>멘티</p>
                <p style={{ fontSize: 11, color: C.textMuted }}>면접 준비하기</p>
              </button>
              <button
                onClick={() => handleOAuthRole("MENTOR")}
                style={{
                  flex: 1, padding: "16px 0",
                  borderRadius: 12, border: `2px solid ${C.border}`,
                  background: C.white, cursor: "pointer",
                  fontFamily: "inherit", transition: "border-color 0.18s, background 0.18s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.background = "#F0F4F9"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.white; }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏆</div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>멘토</p>
                <p style={{ fontSize: 11, color: C.textMuted }}>면접 코칭하기</p>
              </button>
            </div>
            <button
              onClick={() => setOauthTarget(null)}
              style={{
                marginTop: 18, width: "100%", padding: "10px 0",
                borderRadius: 8, border: "none", background: "transparent",
                color: C.textMuted, fontSize: 13, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >취소</button>
          </div>
        </div>
      )}
    </>
  );
}
