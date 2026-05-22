import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

/* ============================================================
   회원가입 페이지  (pages/Auth/Register.jsx)
   3단계 멀티스텝: ① 계정 → ② 역할 선택 → ③ 프로필
   ============================================================ */

const C = {
  navy:      "#0D2240",
  navyMid:   "#1B4F7A",
  cream:     "#F4F2EE",
  creamDark: "#EDEAE4",
  white:     "#FFFFFF",
  teal:      "#1D9E75",
  text:      "#1A1818",
  textSub:   "#6B6863",
  textMuted: "#9E9B95",
  border:    "#DDD9D3",
  inputBg:   "#F4F2EE",
  error:     "#D94040",
  errorBg:   "#FCF0F0",
};

/* ──────────────────── 아이콘 모음 ──────────────────── */
const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={C.textMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
    ) : (
      <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/></>
    )}
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LogoIcon = ({ size = 26, color = C.white }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="2" fill={color}/>
    {[0,45,90,135,180,225,270,315].map((deg, i) => {
      const r = deg * Math.PI / 180;
      return <line key={i}
        x1={14+2.5*Math.cos(r)} y1={14+2.5*Math.sin(r)}
        x2={14+10 *Math.cos(r)} y2={14+10 *Math.sin(r)}
        stroke={color} strokeWidth="1.5" strokeLinecap="round"/>;
    })}
    {[0,90,180,270].map((deg, i) => {
      const r=deg*Math.PI/180, mx=14+7*Math.cos(r), my=14+7*Math.sin(r), o=r+Math.PI/2;
      return <g key={i}>
        <line x1={mx} y1={my} x2={mx+3*Math.cos(o)} y2={my+3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        <line x1={mx} y1={my} x2={mx-3*Math.cos(o)} y2={my-3*Math.sin(o)} stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      </g>;
    })}
  </svg>
);

/* ──────────────────── 공통 인풋 컴포넌트 ──────────────────── */
const Field = ({ label, hint, children }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
    <label style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</label>
    {hint && <p style={{ fontSize:11, color:C.textMuted, marginTop:-4 }}>{hint}</p>}
    {children}
  </div>
);

const TextInput = ({ placeholder, value, onChange, type="text", right, error, ...rest }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={()=>setFocused(true)}
        onBlur={()=>setFocused(false)}
        style={{
          width:"100%",
          padding: right ? "13px 44px 13px 16px" : "13px 16px",
          background: focused ? C.white : C.inputBg,
          border: `1.5px solid ${error ? C.error : focused ? C.navy : "transparent"}`,
          borderRadius:10,
          fontSize:14, color:C.text,
          outline:"none", fontFamily:"inherit",
          transition:"border-color 0.18s, background 0.18s",
        }}
        {...rest}
      />
      {right && (
        <div style={{
          position:"absolute", right:14, top:"50%",
          transform:"translateY(-50%)", lineHeight:0,
        }}>
          {right}
        </div>
      )}
      {error && (
        <p style={{ fontSize:11, color:C.error, marginTop:4 }}>{error}</p>
      )}
    </div>
  );
};

/* ──────────────────── 비밀번호 강도 바 ──────────────────── */
const PwStrength = ({ pw }) => {
  const checks = [
    pw.length >= 8,
    /[A-Za-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["", "약함", "보통", "좋음", "강함"];
  const colors = ["#E8E0D0","#EF4444","#F59E0B","#1D9E75","#0F6E56"];
  if (!pw) return null;
  return (
    <div style={{ marginTop:-4 }}>
      <div style={{ display:"flex", gap:4, marginBottom:4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex:1, height:3, borderRadius:999,
            background: i <= score ? colors[score] : "#DDD9D3",
            transition:"background 0.3s",
          }}/>
        ))}
      </div>
      <span style={{ fontSize:11, color: colors[score] }}>{labels[score]}</span>
    </div>
  );
};

/* ──────────────────── 단계 탭 ──────────────────── */
const StepTabs = ({ current }) => {
  const steps = ["계정", "역할 선택", "프로필"];
  return (
    <div style={{ display:"flex", marginBottom:28, borderBottom:`1px solid ${C.border}` }}>
      {steps.map((s, i) => {
        const idx   = i + 1;
        const done  = idx < current;
        const active = idx === current;
        return (
          <div key={i} style={{
            flex:1, textAlign:"center",
            paddingBottom:12,
            borderBottom: active ? `2px solid ${C.navy}` : "2px solid transparent",
            marginBottom:-1,
            transition:"border-color 0.2s",
          }}>
            <span style={{
              fontSize:13,
              fontWeight: active ? 700 : 400,
              color: done ? C.teal : active ? C.navy : C.textMuted,
              display:"inline-flex", alignItems:"center", gap:6,
            }}>
              {done
                ? <span style={{
                    width:18, height:18, borderRadius:"50%",
                    background:C.teal, display:"inline-flex",
                    alignItems:"center", justifyContent:"center", flexShrink:0,
                  }}><CheckIcon/></span>
                : <span style={{
                    width:18, height:18, borderRadius:"50%",
                    background: active ? C.navy : "#DDD9D3",
                    color: active ? C.white : C.textMuted,
                    display:"inline-flex", alignItems:"center",
                    justifyContent:"center", fontSize:10, fontWeight:700, flexShrink:0,
                  }}>{idx}</span>
              }
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ──────────────────── STEP 1: 계정 ──────────────────── */
const Step1 = ({ data, onChange, errors }) => {
  const [showPw,   setShowPw]   = useState(false);
  const [showConf, setShowConf] = useState(false);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <p style={{ fontSize:12, fontWeight:600, color:C.textMuted, letterSpacing:"0.08em", textTransform:"uppercase" }}>
        계정 정보
      </p>

      <Field label="이메일 (아이디)" error={errors.email}>
        <TextInput
          placeholder="example@email.com"
          value={data.email}
          onChange={e => onChange("email", e.target.value)}
          type="email"
          error={errors.email}
        />
      </Field>

      <Field label="비밀번호" hint="8자 이상, 영문 + 숫자 + 특수문자">
        <TextInput
          placeholder="8자 이상, 영문 + 숫자 + 특수문자"
          value={data.password}
          onChange={e => onChange("password", e.target.value)}
          type={showPw ? "text" : "password"}
          error={errors.password}
          right={
            <button type="button" onClick={() => setShowPw(v=>!v)}
              style={{ background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:0 }}>
              <EyeIcon open={showPw}/>
            </button>
          }
        />
        <PwStrength pw={data.password}/>
      </Field>

      <Field label="비밀번호 확인">
        <TextInput
          placeholder="비밀번호 재입력"
          value={data.confirm}
          onChange={e => onChange("confirm", e.target.value)}
          type={showConf ? "text" : "password"}
          error={errors.confirm}
          right={
            <button type="button" onClick={() => setShowConf(v=>!v)}
              style={{ background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:0 }}>
              <EyeIcon open={showConf}/>
            </button>
          }
        />
        {/* 일치 여부 표시 */}
        {data.confirm && !errors.confirm && data.password === data.confirm && (
          <p style={{ fontSize:11, color:C.teal, marginTop:4 }}>✓ 비밀번호가 일치합니다</p>
        )}
      </Field>
    </div>
  );
};

/* ──────────────────── STEP 2: 역할 선택 ──────────────────── */
const RoleCard = ({ role, selected, onClick }) => {
  const isMentor  = role === "mentor";
  const tag       = isMentor ? "MENTOR" : "MENTEE";
  const title     = isMentor ? "멘토" : "멘티";
  const desc      = isMentor ? "면접 진행 및 피드백 제공" : "면접 연습 및 AI 분석 수령";
  const tagBg     = selected && isMentor  ? C.white
                  : selected && !isMentor ? C.navy
                  : "#E8E4DC";
  const tagColor  = selected && isMentor  ? C.navy
                  : selected && !isMentor ? C.white
                  : C.textMuted;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex:1, textAlign:"left",
        padding:"20px 18px",
        background: selected ? C.navy : C.white,
        border: `1.5px solid ${selected ? C.navy : C.border}`,
        borderRadius:14,
        cursor:"pointer",
        transition:"all 0.2s",
        outline:"none",
      }}
      onMouseEnter={e => { if(!selected) e.currentTarget.style.borderColor = C.navyMid; }}
      onMouseLeave={e => { if(!selected) e.currentTarget.style.borderColor = C.border; }}
    >
      <span style={{
        display:"inline-block",
        fontSize:10, fontWeight:700, letterSpacing:"0.12em",
        background: tagBg, color: tagColor,
        padding:"3px 8px", borderRadius:4,
        marginBottom:12,
        transition:"background 0.2s, color 0.2s",
      }}>
        {tag}
      </span>
      <p style={{
        fontSize:18, fontWeight:700,
        color: selected ? C.white : C.text,
        marginBottom:6, transition:"color 0.2s",
      }}>
        {title}
      </p>
      <p style={{
        fontSize:13,
        color: selected ? "rgba(255,255,255,0.65)" : C.textSub,
        transition:"color 0.2s",
      }}>
        {desc}
      </p>
    </button>
  );
};

const Step2 = ({ data, onChange, errors }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
    {/* 역할 */}
    <div>
      <p style={{ fontSize:12, fontWeight:600, color:C.textMuted, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>
        역할 선택
      </p>
      <div style={{ display:"flex", gap:12 }}>
        <RoleCard role="mentor"  selected={data.role==="mentor"}  onClick={() => onChange("role","mentor")}/>
        <RoleCard role="mentee"  selected={data.role==="mentee"}  onClick={() => onChange("role","mentee")}/>
      </div>
      {errors.role && (
        <p style={{ fontSize:11, color:C.error, marginTop:8 }}>{errors.role}</p>
      )}
    </div>

    {/* 기본 정보 */}
    <div>
      <p style={{ fontSize:12, fontWeight:600, color:C.textMuted, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>
        기본 정보
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <Field label="이름">
          <TextInput
            placeholder="홍길동"
            value={data.name}
            onChange={e => onChange("name", e.target.value)}
            error={errors.name}
          />
        </Field>
        <Field label="생년월일">
          <TextInput
            placeholder="YYYY.MM.DD"
            value={data.birth}
            onChange={e => onChange("birth", e.target.value)}
            error={errors.birth}
          />
        </Field>
      </div>
    </div>
  </div>
);

/* ──────────────────── STEP 3: 프로필 ──────────────────── */
const Step3Mentee = ({ data, onChange }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:18 }}>

    {/* 헤더 */}
    <div style={{ paddingBottom:4 }}>
      <p style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:4 }}>
        편하게 알려주세요 :)
      </p>
      <p style={{ fontSize:12, color:C.textSub, lineHeight:1.6 }}>
        아는 만큼만 적어도 돼요 — 나중에 언제든 수정할 수 있어요
      </p>
    </div>

    {/* 학교 · 전공 */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      <Field label="학교" hint="재학 중인 곳">
        <TextInput
          placeholder="예) 한양대학교"
          value={data.school || ""}
          onChange={e => onChange("school", e.target.value)}
        />
      </Field>
      <Field label="전공 · 학과">
        <TextInput
          placeholder="예) 컴퓨터공학과"
          value={data.major || ""}
          onChange={e => onChange("major", e.target.value)}
        />
      </Field>
    </div>

    {/* 관심 직무 */}
    <Field label="관심 직무" hint="어떤 일을 해보고 싶어요?">
      <TextInput
        placeholder="예) 백엔드 개발, 데이터 분석, UX 디자인..."
        value={data.position}
        onChange={e => onChange("position", e.target.value)}
      />
    </Field>

    {/* 목표 기업 */}
    <Field label="목표 기업 · 업계" hint="없어도 전혀 괜찮아요!">
      <TextInput
        placeholder="예) 네이버, 카카오, IT 스타트업 등"
        value={data.targetCompany}
        onChange={e => onChange("targetCompany", e.target.value)}
      />
    </Field>

    {/* 기술 도구 */}
    <Field label="다룰 줄 아는 기술 · 도구" hint="없으면 비워도 돼요 — 진짜로요!">
      <TextInput
        placeholder="예) Python, Figma, Excel, Git... 뭐든"
        value={data.techStack}
        onChange={e => onChange("techStack", e.target.value)}
      />
    </Field>

    {/* 자기소개 */}
    <Field label="한 줄 소개" hint="자소서 아니에요, 자유롭게 :)">
      <textarea
        placeholder="예) 개발에 관심 생긴 지 1년 된 컴공 3학년입니다!"
        value={data.bio}
        onChange={e => onChange("bio", e.target.value)}
        rows={2}
        style={{
          width:"100%", padding:"13px 16px",
          background:C.inputBg, border:"1.5px solid transparent",
          borderRadius:10, fontSize:14, color:C.text,
          outline:"none", fontFamily:"inherit", resize:"none",
          lineHeight:1.7, transition:"border-color 0.18s, background 0.18s",
        }}
        onFocus={e => { e.target.style.background=C.white; e.target.style.borderColor=C.navy; }}
        onBlur={e  => { e.target.style.background=C.inputBg; e.target.style.borderColor="transparent"; }}
      />
    </Field>
  </div>
);

const Step3Mentor = ({ data, onChange, errors }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
    <p style={{ fontSize:12, fontWeight:600, color:C.textMuted, letterSpacing:"0.08em", textTransform:"uppercase" }}>
      멘토 프로필
    </p>

    <Field label="현 소속 기업">
      <TextInput
        placeholder="예) 네이버, 카카오, 라인"
        value={data.company}
        onChange={e => onChange("company", e.target.value)}
        error={errors.company}
      />
    </Field>

    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
      <Field label="직무">
        <TextInput
          placeholder="예) 백엔드 개발"
          value={data.jobTitle}
          onChange={e => onChange("jobTitle", e.target.value)}
          error={errors.jobTitle}
        />
      </Field>
      <Field label="경력 (년차)">
        <TextInput
          placeholder="예) 5"
          value={data.years}
          onChange={e => onChange("years", e.target.value)}
          type="number"
          error={errors.years}
        />
      </Field>
    </div>

    <Field label="전문 기술 스택">
      <TextInput
        placeholder="예) Java, Spring Boot, Kubernetes"
        value={data.techStack}
        onChange={e => onChange("techStack", e.target.value)}
      />
    </Field>

    <Field label="멘토 소개" hint="멘티가 나를 더 잘 이해할 수 있도록 작성해주세요">
      <textarea
        placeholder="면접에서 자주 나오는 포인트나 나만의 코칭 방식을 알려주세요."
        value={data.bio}
        onChange={e => onChange("bio", e.target.value)}
        rows={3}
        style={{
          width:"100%", padding:"13px 16px",
          background:C.inputBg, border:"1.5px solid transparent",
          borderRadius:10, fontSize:14, color:C.text,
          outline:"none", fontFamily:"inherit", resize:"vertical",
          lineHeight:1.7, transition:"border-color 0.18s, background 0.18s",
        }}
        onFocus={e => { e.target.style.background=C.white; e.target.style.borderColor=C.navy; }}
        onBlur={e  => { e.target.style.background=C.inputBg; e.target.style.borderColor="transparent"; }}
      />
    </Field>
  </div>
);

/* ──────────────────── 메인 컴포넌트 ──────────────────── */
export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  /* 폼 데이터 */
  const [account, setAccount] = useState({ email:"", password:"", confirm:"" });
  const [roleInfo, setRoleInfo] = useState({ role:"", name:"", birth:"" });
  const [profile, setProfile] = useState({
    /* 멘티 */
    school:"", major:"", targetCompany:"", position:"", techStack:"", bio:"",
    /* 멘토 */
    company:"", jobTitle:"", years:"",
  });

  const [errors, setErrors] = useState({});

  const updateAccount = (k, v) => { setAccount(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:""})); };
  const updateRole    = (k, v) => { setRoleInfo(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:""})); };
  const updateProfile = (k, v) => { setProfile(p=>({...p,[k]:v})); };

  /* 유효성 검사 */
  const validateStep1 = () => {
    const errs = {};
    if (!account.email)    errs.email    = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email))
                           errs.email    = "올바른 이메일 형식이 아닙니다.";
    if (!account.password) errs.password = "비밀번호를 입력해주세요.";
    else if (account.password.length < 8)
                           errs.password = "8자 이상 입력해주세요.";
    if (!account.confirm)  errs.confirm  = "비밀번호를 한 번 더 입력해주세요.";
    else if (account.password !== account.confirm)
                           errs.confirm  = "비밀번호가 일치하지 않습니다.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!roleInfo.role)   errs.role  = "역할을 선택해주세요.";
    if (!roleInfo.name)   errs.name  = "이름을 입력해주세요.";
    if (!roleInfo.birth)  errs.birth = "생년월일을 입력해주세요.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setErrors({});
    setStep(s => s + 1);
    /* 폼 카드 스크롤 상단으로 */
    document.getElementById("register-card")?.scrollTo({ top:0, behavior:"smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
          name: roleInfo.name,
          nickname: roleInfo.name,
          role: roleInfo.role.toUpperCase(),
        }),
      });
      if (!res.ok) throw new Error("signup failed");
      navigate("/auth/login");
    } catch {
      setErrors({ submit:"회원가입 중 오류가 발생했습니다. 다시 시도해주세요." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: 'Noto Sans KR', sans-serif; }

        input:-webkit-autofill,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #F4F2EE inset !important;
          -webkit-text-fill-color: #1A1818 !important;
        }

        .reg-btn-primary {
          flex: 1;
          padding: 14px;
          background: ${C.navy};
          color: #fff;
          font-family: 'Noto Sans KR', sans-serif;
          font-size: 15px; font-weight: 700;
          border: none; border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .reg-btn-primary:hover:not(:disabled) {
          background: ${C.navyMid};
          transform: translateY(-1px);
        }
        .reg-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .reg-btn-ghost {
          padding: 14px 20px;
          background: transparent;
          color: ${C.textSub};
          font-family: 'Noto Sans KR', sans-serif;
          font-size: 14px; font-weight: 500;
          border: 1.5px solid ${C.border};
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.18s, color 0.18s;
        }
        .reg-btn-ghost:hover {
          border-color: ${C.navyMid};
          color: ${C.navy};
        }

        /* 좁은 화면 */
        @media (max-width: 820px) {
          .reg-left  { display: none !important; }
          .reg-right { width: 100% !important; }
        }
        @media (max-width: 480px) {
          .reg-card { padding: 28px 20px !important; margin: 16px !important; }
        }

        /* 스피너 */
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", overflow:"hidden", fontFamily:"'Noto Sans KR', sans-serif" }}>

        {/* ════════ 왼쪽 네이비 패널 ════════ */}
        <div className="reg-left" style={{
          width:"30%", flexShrink:0,
          background:C.navy,
          display:"flex", flexDirection:"column",
          justifyContent:"space-between",
          padding:"36px 48px 52px",
          position:"relative", overflow:"hidden",
        }}>
          {/* 블롭 */}
          {[
            { bg:"#1B4F7A", top:"8%",  left:"50%", w:280, h:260, op:0.28 },
            { bg:"#1D9E75", top:"60%", left:"5%",  w:230, h:210, op:0.14 },
            { bg:"#2B4A8A", top:"38%", left:"28%", w:190, h:170, op:0.22 },
          ].map((b,i) => (
            <div key={i} style={{
              position:"absolute", top:b.top, left:b.left,
              width:b.w, height:b.h,
              background:b.bg, opacity:b.op,
              filter:"blur(64px)",
              borderRadius:"60% 40% 30% 70% / 60% 30% 70% 40%",
              pointerEvents:"none",
            }}/>
          ))}

          {/* 로고 */}
          <Link to="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none", position:"relative", zIndex:1 }}>
            <LogoIcon size={26} color={C.white}/>
            <span style={{ fontSize:18, fontWeight:700, color:C.white, letterSpacing:"-0.3px" }}>SceneA</span>
          </Link>

          {/* 카피 */}
          <div style={{ position:"relative", zIndex:1 }}>
            <p style={{ fontSize:30, fontWeight:700, color:C.white, lineHeight:1.35, letterSpacing:"-0.02em", marginBottom:12 }}>
              실무자와 함께<br/>완성하는
            </p>
            <p style={{ fontSize:26, fontWeight:700, color:"rgba(255,255,255,0.72)", lineHeight:1.4, letterSpacing:"-0.01em" }}>
              진짜 면접 준비
            </p>

            {/* 단계 안내 */}
            <div style={{ marginTop:44, display:"flex", flexDirection:"column", gap:14 }}>
              {[
                { n:"01", t:"계정 생성",    d:"이메일과 비밀번호를 설정하세요" },
                { n:"02", t:"역할 선택",    d:"멘토 또는 멘티로 시작하세요" },
                { n:"03", t:"프로필 완성",  d:"나를 소개하는 정보를 입력하세요" },
              ].map((s, i) => (
                <div key={i} style={{
                  display:"flex", alignItems:"center", gap:14,
                  opacity: step >= i+1 ? 1 : 0.4,
                  transition:"opacity 0.3s",
                }}>
                  <div style={{
                    width:28, height:28, borderRadius:"50%", flexShrink:0,
                    background: step > i+1 ? C.teal : step === i+1 ? C.white : "rgba(255,255,255,0.12)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:700,
                    color: step > i+1 ? C.white : step === i+1 ? C.navy : "rgba(255,255,255,0.5)",
                    transition:"all 0.3s",
                  }}>
                    {step > i+1 ? <CheckIcon/> : s.n}
                  </div>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:C.white }}>{s.t}</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:36, display:"flex", gap:8 }}>
              {[1,2,3].map(s => (
                <div key={s} style={{
                  height:3, borderRadius:999,
                  background: `rgba(255,255,255,${step > s ? 0.55 : step === s ? 1 : 0.2})`,
                  width: step === s ? 32 : step > s ? 20 : 12,
                  transition: "width 0.35s ease, background 0.35s ease",
                }}/>
              ))}
            </div>
          </div>

          <p style={{ position:"relative", zIndex:1, fontSize:12, color:"rgba(255,255,255,0.3)" }}>
            © 2026 SceneA. Capstone Design Project.
          </p>
        </div>

        {/* ════════ 오른쪽 폼 영역 ════════ */}
        <div className="reg-right" style={{
          flex:1, background:C.cream,
          display:"flex", alignItems:"flex-start",
          justifyContent:"center", padding:"40px 5%",
          overflowY:"auto",
        }}>
          <div id="register-card" className="reg-card" style={{
            width:"100%", maxWidth:460,
            background:C.creamDark,
            borderRadius:20, padding:"40px 36px",
            boxShadow:"0 2px 16px rgba(13,34,68,0.09), 0 0 0 1px rgba(0,0,0,0.04)",
          }}>

            {/* 헤더 */}
            <div style={{ marginBottom:28 }}>
              <h1 style={{ fontSize:22, fontWeight:700, color:C.text, letterSpacing:"-0.02em", marginBottom:6 }}>
                회원가입
              </h1>
              <p style={{ fontSize:13, color:C.textSub }}>
                정보를 입력하고 면접 준비를 시작하세요
              </p>
            </div>

            {/* 단계 탭 */}
            <StepTabs current={step}/>

            {/* 폼 */}
            <form onSubmit={step === 3 ? handleSubmit : e => { e.preventDefault(); handleNext(); }}>
              {/* 각 단계별 폼 */}
              <div style={{ minHeight:320 }}>
                {step === 1 && <Step1 data={account} onChange={updateAccount} errors={errors}/>}
                {step === 2 && <Step2 data={roleInfo} onChange={updateRole} errors={errors}/>}
                {step === 3 && roleInfo.role === "mentee" && (
                  <Step3Mentee data={profile} onChange={updateProfile} errors={errors}/>
                )}
                {step === 3 && roleInfo.role === "mentor" && (
                  <Step3Mentor data={profile} onChange={updateProfile} errors={errors}/>
                )}
              </div>

              {/* 에러 */}
              {errors.submit && (
                <p style={{
                  fontSize:13, color:C.error,
                  background:C.errorBg, border:`1px solid #F5C6C6`,
                  borderRadius:8, padding:"10px 14px",
                  marginTop:16,
                }}>
                  {errors.submit}
                </p>
              )}

              {/* 하단 버튼 */}
              <div style={{ display:"flex", gap:10, marginTop:28 }}>
                {step > 1 && (
                  <button
                    type="button"
                    className="reg-btn-ghost"
                    onClick={() => { setErrors({}); setStep(s=>s-1); }}
                  >
                    이전
                  </button>
                )}
                <button type="submit" className="reg-btn-primary" disabled={loading}>
                  {loading ? (
                    <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="white" strokeWidth="2.5" strokeLinecap="round"
                        style={{ animation:"spin 0.8s linear infinite" }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      처리 중...
                    </span>
                  ) : step === 3 ? "가입 완료하기" : "다음 단계"}
                </button>
              </div>
            </form>

            {/* 로그인 유도 */}
            <p style={{ marginTop:24, textAlign:"center", fontSize:13, color:C.textSub }}>
              이미 계정이 있으신가요?{" "}
              <Link to="/auth/login" style={{ color:C.navy, fontWeight:700, textDecoration:"none" }}
                onMouseEnter={e => e.target.style.textDecoration="underline"}
                onMouseLeave={e => e.target.style.textDecoration="none"}
              >
                로그인
              </Link>
            </p>

          </div>
        </div>

      </div>
    </>
  );
}
