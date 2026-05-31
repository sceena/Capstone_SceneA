import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";

const C = {
  primary:      "#0D2240",
  primaryDark:  "#081828",
  primaryLight: "#E8EEF6",
  primaryGrad:  "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
  success:      "#0CA678",
  successLight: "#E6FCF5",
  text:         "#1A1B1E",
  textSub:      "#495057",
  textMuted:    "#868E96",
  white:        "#FFFFFF",
  bg:           "#F0F4F8",
  border:       "#E9ECEF",
  shadow:       "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
  danger:       "#E03131",
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
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64, maxWidth: 1200, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: C.primaryGrad,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(13,34,64,0.3)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>
            Scene<span style={{ color: C.primary }}>A</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[
            { label: "대시보드", to: "/dashboard/mentee" },
            { label: "멘토 탐색", to: "/mentor/search" },
            { label: "마이페이지", to: "/mentee/mypage" },
          ].map(({ label, to }) => (
            <Link key={label} to={to} style={{
              fontSize: 14, fontWeight: 400, color: C.textSub,
              textDecoration: "none", padding: "6px 14px", borderRadius: 8,
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; }}
            >{label}</Link>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: C.primaryGrad,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(13,34,64,0.3)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{initials}</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{userName}님</p>
          </div>
          <div style={{ width: 1, height: 24, background: C.border }} />
          <button onClick={handleLogout} style={{
            padding: "7px 16px", borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: "transparent", color: C.textSub,
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 채용공고 텍스트 입력 필드 ── */
const JobPostingField = ({ label, description, placeholder, value, onChange, rows = 5 }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "block", marginBottom: 3 }}>{label}</label>
        {description && <p style={{ fontSize: 12, color: C.textMuted }}>{description}</p>}
      </div>
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={rows}
        style={{
          width: "100%", padding: "14px 16px",
          background: focused ? C.white : C.bg,
          border: `1.5px solid ${focused ? C.primary : C.border}`,
          borderRadius: 12, fontSize: 14, color: C.text, lineHeight: 1.75,
          outline: "none", fontFamily: "inherit", resize: "vertical",
          transition: "all 0.18s", boxSizing: "border-box",
        }}
      />
    </div>
  );
};

/* ── 자기소개서 항목 ── */
const CoverLetterItem = ({ idx, data, onChange, onRemove, isFirst }) => {
  const [focused, setFocused] = useState(false);
  const MAX = 1000;
  return (
    <div style={{
      background: C.white, borderRadius: 14,
      border: `1.5px solid ${focused ? C.primary : C.border}`,
      overflow: "hidden", transition: "border-color 0.18s",
      boxShadow: focused ? `0 0 0 3px ${C.primaryLight}` : "none",
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 10,
        background: C.bg,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          background: C.primaryGrad, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: C.white,
        }}>{idx + 1}</span>
        <input
          placeholder="문항 제목 (예: 지원 동기를 작성해주세요)"
          value={data.title}
          onChange={e => onChange("title", e.target.value)}
          style={{
            flex: 1, border: "none", background: "transparent",
            fontSize: 14, fontWeight: 600, color: C.text,
            outline: "none", fontFamily: "inherit",
          }}
        />
        {!isFirst && (
          <button onClick={onRemove} style={{
            background: "none", border: "none", cursor: "pointer",
            color: C.textMuted, fontSize: 18, padding: "0 4px", lineHeight: 1,
            transition: "color 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.color = C.danger}
            onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
          >×</button>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <textarea
          placeholder="자기소개서 내용을 입력해주세요..."
          value={data.content}
          onChange={e => { if (e.target.value.length <= MAX) onChange("content", e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={6}
          style={{
            width: "100%", padding: "16px 16px 32px",
            border: "none", background: "transparent",
            fontSize: 14, color: C.text, lineHeight: 1.8,
            outline: "none", fontFamily: "inherit", resize: "none",
            boxSizing: "border-box",
          }}
        />
        <div style={{
          position: "absolute", bottom: 10, right: 14, fontSize: 11,
          color: data.content.length > MAX * 0.9 ? C.danger : C.textMuted,
        }}>
          {data.content.length.toLocaleString()} / {MAX.toLocaleString()}자
        </div>
      </div>
    </div>
  );
};

/* ── 섹션 카드 ── */
const SectionCard = ({ step, title, sub, children, accentColor = C.primary }) => (
  <div style={{
    background: C.white, borderRadius: 20,
    padding: "28px 28px 32px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05)",
    marginBottom: 20,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: `${accentColor}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{step}</span>
      </div>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
    {children}
  </div>
);

const DRAFT_KEY = "scena_resume_draft";
const getResumeDraftKey = (user) => `${DRAFT_KEY}:${user?.email || user?.id || "anonymous"}`;

export default function ResumeManage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const draftKey = getResumeDraftKey(user);

  /* 채용공고 텍스트 3항목 */
  const [jobPosting, setJobPosting] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${draftKey}:job`));
      if (saved) return saved;
    } catch {}
    return { requirements: "", looking_for: "", preferred: "" };
  });

  /* 자기소개서 항목 */
  const [items, setItems] = useState(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      if (Array.isArray(draft) && draft.length > 0) return draft;
    } catch {}
    return [
      { title: "지원 동기를 작성해주세요", content: "" },
      { title: "본인의 강점과 약점을 작성해주세요", content: "" },
    ];
  });

  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);

  const updateJob = (key, val) => setJobPosting(p => ({ ...p, [key]: val }));
  const updateItem = (i, key, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const addItem = () => { if (items.length < 5) setItems(prev => [...prev, { title: "", content: "" }]); };
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const validateItems = () => {
    const bad = items.findIndex(it => it.content.trim() && !it.title.trim());
    if (bad >= 0) { alert(`${bad + 1}번 자기소개서 문항의 제목을 입력해 주세요.`); return false; }
    return true;
  };

  const handleSave = () => {
    if (!validateItems()) return;
    localStorage.setItem(draftKey, JSON.stringify(items));
    localStorage.setItem(`${draftKey}:job`, JSON.stringify(jobPosting));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleComplete = () => {
    if (!validateItems()) return;
    const filledItems = items.filter(it => it.content.trim()).map(it => ({ title: it.title.trim(), content: it.content.trim() }));
    localStorage.setItem(draftKey, JSON.stringify(items));
    localStorage.setItem(`${draftKey}:job`, JSON.stringify(jobPosting));
    const resumeContent = filledItems.map(it => `[${it.title}]\n${it.content}`).join("\n\n");
    const jobText = [
      jobPosting.requirements && `[업무 자격요건]\n${jobPosting.requirements}`,
      jobPosting.looking_for  && `[이런 경험을 가진 분을 찾습니다]\n${jobPosting.looking_for}`,
      jobPosting.preferred    && `[우대사항]\n${jobPosting.preferred}`,
    ].filter(Boolean).join("\n\n");
    navigate("/mentor/search", { state: { jobPosting: { rawText: jobText }, resumeContent } });
  };

  const hasJobInfo = jobPosting.requirements || jobPosting.looking_for || jobPosting.preferred;
  const hasCoverLetter = items.some(it => it.content.trim().length > 0);
  const isValid = hasJobInfo || hasCoverLetter;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter','Noto Sans KR',-apple-system,sans-serif;background:${C.bg}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        textarea::placeholder,input::placeholder{color:${C.textMuted}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 5% 80px" }}>

        {/* 뒤로가기 */}
        <button onClick={() => navigate("/mentee/mypage")} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: C.white, color: C.textSub,
          fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
          marginBottom: 20, transition: "all 0.15s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          마이페이지로
        </button>

        {/* 타이틀 */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.04em", marginBottom: 8 }}>
            면접 정보 등록
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.7 }}>
            채용공고 내용과 자기소개서를 입력하면 AI가 맞춤 면접 질문을 생성하고 멘토가 사전 코칭 전략을 준비합니다.
          </p>
        </div>

        {/* STEP 1: 채용공고 텍스트 */}
        <SectionCard
          step="1"
          title="채용공고 내용 입력"
          sub="AI가 채용공고를 분석해 맞춤 면접 질문을 생성합니다"
          accentColor={C.primary}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <JobPostingField
              label="업무 자격요건"
              description="공고의 '자격요건' 항목을 그대로 붙여넣으세요"
              placeholder={"예)\n· 관련 전공 학위 (컴퓨터공학, 소프트웨어공학 등)\n· 3년 이상의 백엔드 개발 경력\n· Java 또는 Python 개발 경험"}
              value={jobPosting.requirements}
              onChange={v => updateJob("requirements", v)}
              rows={5}
            />
            <div style={{ height: 1, background: C.border }} />
            <JobPostingField
              label="이런 경험을 가진 분을 찾습니다"
              description="공고의 '우리가 원하는 인재' 또는 '자격요건' 세부 항목"
              placeholder={"예)\n· 대규모 트래픽 처리 경험이 있으신 분\n· MSA 아키텍처 설계 및 운영 경험\n· 팀 리딩 또는 기술 멘토링 경험"}
              value={jobPosting.looking_for}
              onChange={v => updateJob("looking_for", v)}
              rows={5}
            />
            <div style={{ height: 1, background: C.border }} />
            <JobPostingField
              label="이런 경험을 우대합니다"
              description="공고의 '우대사항' 항목을 입력해주세요"
              placeholder={"예)\n· AWS, GCP 등 클라우드 플랫폼 경험\n· 오픈소스 프로젝트 기여 경험\n· 스타트업 초기 멤버 경험"}
              value={jobPosting.preferred}
              onChange={v => updateJob("preferred", v)}
              rows={4}
            />
          </div>
        </SectionCard>

        {/* STEP 2: 자기소개서 */}
        <SectionCard
          step="2"
          title="자기소개서 직접 입력"
          sub={`문항별로 작성하면 AI가 더 정확한 질문을 생성해요 (${items.length}/5)`}
          accentColor="#0CA678"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 14 }}>
            {items.map((it, i) => (
              <CoverLetterItem
                key={i} idx={i} data={it}
                isFirst={i === 0}
                onChange={(k, v) => updateItem(i, k, v)}
                onRemove={() => removeItem(i)}
              />
            ))}
          </div>

          {items.length < 5 && (
            <button onClick={addItem} style={{
              width: "100%", padding: "12px",
              background: "transparent", border: `1.5px dashed ${C.border}`,
              borderRadius: 12, fontSize: 13, color: C.textMuted,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
            >
              + 자기소개서 문항 추가 ({items.length}/5)
            </button>
          )}
        </SectionCard>

        {/* AI 분석 안내 배너 */}
        <div style={{
          background: C.primaryGrad, borderRadius: 16, padding: "20px 24px",
          marginBottom: 28, display: "flex", alignItems: "flex-start", gap: 16,
          boxShadow: "0 8px 24px rgba(13,34,64,0.2)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }}/>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "rgba(255,255,255,0.15)", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4l3 3"/>
            </svg>
          </div>
          <div style={{ position: "relative" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 5 }}>저장 후 AI 분석이 시작됩니다</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>
              입력한 채용공고 내용과 자기소개서를 AI가 자동으로 분석해 면접 예상 질문을 생성하고, 멘토에게 사전 브리핑을 전달합니다.
            </p>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={handleSave} style={{
            padding: "14px 24px",
            background: saved ? C.success : C.white,
            color: saved ? C.white : C.text,
            border: `1.5px solid ${saved ? C.success : C.border}`,
            borderRadius: 12, fontSize: 14, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: saved ? "0 4px 12px rgba(12,166,120,0.3)" : "none",
          }}>
            {saved ? (
              <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>저장됨</>
            ) : "임시 저장"}
          </button>

          <button onClick={handleComplete} disabled={!isValid || saving} style={{
            flex: 1, padding: "14px",
            background: isValid ? C.primaryGrad : C.bg,
            color: isValid ? C.white : C.textMuted,
            border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 700,
            cursor: isValid ? "pointer" : "not-allowed",
            fontFamily: "inherit", transition: "opacity 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: isValid ? "0 4px 16px rgba(13,34,64,0.25)" : "none",
          }}
            onMouseEnter={e => { if (isValid && !saving) e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            {saving ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>저장 중...</>
            ) : "저장하고 면접 준비하기 →"}
          </button>
        </div>

      </main>
    </>
  );
}
