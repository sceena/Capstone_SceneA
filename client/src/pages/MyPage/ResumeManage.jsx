import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A",
  cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75", tealLight:"#E8F5EE",
  text:"#1A1818", textSub:"#6B6863", textMuted:"#9E9B95",
  border:"#E8E0D0", bg:"#FAF8F4",
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
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
    } catch {}
    clearAuthUser();
    navigate("/");
  };
  return (
    <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님</span>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{l:"대시보드",to:"/dashboard/mentee"},{l:"멘토 탐색",to:"/mentor/search"},{l:"MyPage",to:"/mentee/mypage"}].map((x,i)=>(
            <Link key={i} to={x.to} style={{ fontSize:14, fontWeight:400, color:C.white, textDecoration:"none", opacity:0.85 }}
              onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.85}>{x.l}</Link>
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

/* ── 자소서 항목 ── */
const CoverLetterItem = ({ idx, data, onChange, onRemove, isFirst }) => {
  const [focused, setFocused] = useState(false);
  const MAX = 1000;

  return (
    <div style={{
      background:C.white, borderRadius:14,
      border:`1.5px solid ${focused ? C.navy : C.border}`,
      overflow:"hidden", transition:"border-color 0.18s",
    }}>
      <div style={{
        padding:"14px 18px", borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", gap:10,
        background:C.bg,
      }}>
        <span style={{
          width:22, height:22, borderRadius:"50%",
          background:C.navy, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:700, color:C.white,
        }}>{idx+1}</span>
        <input
          placeholder="문항 제목 (예: 지원 동기를 작성해주세요)"
          value={data.title}
          onChange={e=>onChange("title", e.target.value)}
          style={{
            flex:1, border:"none", background:"transparent",
            fontSize:14, fontWeight:600, color:C.text,
            outline:"none", fontFamily:"inherit",
          }}
        />
        {!isFirst && (
          <button onClick={onRemove} style={{
            background:"none", border:"none", cursor:"pointer",
            color:C.textMuted, fontSize:18, padding:"0 4px", lineHeight:1,
            transition:"color 0.15s",
          }}
            onMouseEnter={e=>e.currentTarget.style.color="#EF4444"}
            onMouseLeave={e=>e.currentTarget.style.color=C.textMuted}
          >×</button>
        )}
      </div>

      <div style={{ position:"relative" }}>
        <textarea
          placeholder="자기소개서 내용을 입력해주세요..."
          value={data.content}
          onChange={e=>{ if(e.target.value.length<=MAX) onChange("content", e.target.value); }}
          onFocus={()=>setFocused(true)}
          onBlur={()=>setFocused(false)}
          rows={6}
          style={{
            width:"100%", padding:"16px 18px",
            border:"none", background:"transparent",
            fontSize:14, color:C.text, lineHeight:1.8,
            outline:"none", fontFamily:"inherit", resize:"none",
            boxSizing:"border-box",
          }}
        />
        <div style={{
          position:"absolute", bottom:10, right:16, fontSize:11,
          color: data.content.length > MAX*0.9 ? "#EF4444" : C.textMuted,
        }}>
          {data.content.length.toLocaleString()} / {MAX.toLocaleString()}자
        </div>
      </div>
    </div>
  );
};

const DRAFT_KEY = "scena_resume_draft";
const getResumeDraftKey = (user) => `${DRAFT_KEY}:${user?.email || user?.id || user?.memberId || "anonymous"}`;

export default function ResumeManage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const draftKey = getResumeDraftKey(user);

  const [items, setItems] = useState(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      if (Array.isArray(draft) && draft.length > 0) return draft;
    } catch {}
    return [
      { title:"지원 동기를 작성해주세요", content:"" },
      { title:"본인의 강점과 약점을 작성해주세요", content:"" },
    ];
  });

  const [jobUrl, setJobUrl] = useState("");
  const [jobUrlFocused, setJobUrlFocused] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);

  const updateItem = (i, key, val) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  const addItem = () => {
    if (items.length >= 5) return;
    setItems(prev => [...prev, { title:"", content:"" }]);
  };

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const validateItems = () => {
    const missingTitleIndex = items.findIndex(it => it.content.trim() && !it.title.trim());
    if (missingTitleIndex >= 0) {
      alert(`${missingTitleIndex + 1}번 자기소개서 문항의 제목을 입력해 주세요.`);
      return false;
    }
    return true;
  };

  const getFilledItems = () =>
    items
      .filter(it => it.content.trim())
      .map(it => ({ title: it.title.trim(), content: it.content.trim() }));

  const handleSave = () => {
    if (!validateItems()) return;
    localStorage.setItem(draftKey, JSON.stringify(items));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleComplete = () => {
    if (!validateItems()) return;
    const filledItems = getFilledItems();
    localStorage.setItem(draftKey, JSON.stringify(items));
    const resumeContent = filledItems.map(it => `[${it.title}]\n${it.content}`).join("\n\n");
    navigate("/mentor/search", {
      state: {
        jobPosting: { jobPostingUrl: jobUrl, rawText: jobUrl },
        resumeContent,
      },
    });
  };

  const isValid = items.some(it => it.content.trim().length > 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        textarea::placeholder,input::placeholder{color:${C.textMuted}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth:820, margin:"0 auto", padding:"36px 5% 80px" }}>

        {/* 뒤로가기 + 타이틀 */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <button onClick={() => navigate("/mentee/mypage")} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"8px 14px", borderRadius:8,
            border:`1.5px solid ${C.border}`,
            background:C.white, color:C.textSub,
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
            transition:"border-color 0.15s",
          }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            마이페이지로
          </button>
        </div>

        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontSize:26, fontWeight:700, color:C.text, letterSpacing:"-0.02em", marginBottom:6 }}>자소서 관리</h1>
          <p style={{ fontSize:14, color:C.textSub, lineHeight:1.6 }}>
            제출한 자소서를 바탕으로 AI가 맞춤 면접 질문을 생성하고, 멘토가 사전에 코칭 전략을 준비합니다.
          </p>
        </div>

        {/* 지원 정보 */}
        <div style={{ background:C.white, borderRadius:16, padding:"24px 28px", border:`1px solid ${C.border}`, marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:18 }}>지원 정보</h2>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:7 }}>채용공고 URL</label>
            <input
              placeholder="https://www.wanted.co.kr/wd/..."
              value={jobUrl}
              onChange={e => setJobUrl(e.target.value)}
              onFocus={() => setJobUrlFocused(true)}
              onBlur={() => setJobUrlFocused(false)}
              style={{
                width:"100%", padding:"11px 14px",
                background:jobUrlFocused ? C.white : C.bg,
                border:`1.5px solid ${jobUrlFocused ? C.navy : "transparent"}`,
                borderRadius:8, fontSize:14, color:C.text,
                outline:"none", fontFamily:"inherit", transition:"all 0.18s",
                boxSizing:"border-box",
              }}
            />
            <p style={{ fontSize:11, color:C.textMuted, marginTop:6, lineHeight:1.5 }}>
              채용공고 URL을 입력하면 AI가 자동으로 기업·직무 정보를 분석합니다.
            </p>
          </div>
        </div>

        {/* 자기소개서 */}
        <div style={{ background:C.white, borderRadius:16, padding:"24px 28px", border:`1px solid ${C.border}`, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <div>
              <h2 style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:2 }}>자기소개서</h2>
              <p style={{ fontSize:12, color:C.textMuted }}>문항별로 작성하면 AI가 더 정확한 질문을 생성해요 ({items.length}/5)</p>
            </div>
            <button onClick={addItem} disabled={items.length >= 5} style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"8px 16px",
              background:items.length>=5?C.bg:C.navy,
              color:items.length>=5?C.textMuted:C.white,
              border:"none", borderRadius:8, fontSize:13, fontWeight:600,
              cursor:items.length>=5?"not-allowed":"pointer", fontFamily:"inherit",
              transition:"background 0.18s",
            }}
              onMouseEnter={e=>{ if(items.length<5) e.currentTarget.style.background=C.navyMid; }}
              onMouseLeave={e=>{ if(items.length<5) e.currentTarget.style.background=C.navy; }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              문항 추가
            </button>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
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
              width:"100%", marginTop:14, padding:"12px",
              background:"transparent", border:`1.5px dashed ${C.border}`,
              borderRadius:10, fontSize:13, color:C.textMuted,
              cursor:"pointer", fontFamily:"inherit", transition:"border-color 0.15s",
            }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >
              + 자기소개서 문항 추가 ({items.length}/5)
            </button>
          )}
        </div>

        {/* AI 분석 안내 */}
        <div style={{
          background:C.navy, borderRadius:14, padding:"18px 24px",
          marginBottom:28, display:"flex", alignItems:"flex-start", gap:14,
        }}>
          <div style={{
            width:36, height:36, borderRadius:"50%",
            background:"rgba(255,255,255,0.12)", flexShrink:0,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3"/>
              <path d="M8 5v3.5l2 1.5" stroke="rgba(255,255,255,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:C.white, marginBottom:4 }}>AI 사전 분석이 시작됩니다</p>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:1.7 }}>
              자소서를 저장하면 AI가 자동으로 분석해 면접 예상 질문을 생성하고, 멘토에게 사전 브리핑을 전달합니다.
              분석 완료까지 약 1~2분 소요됩니다.
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={handleSave} style={{
            padding:"14px 28px",
            background:saved?C.teal:C.white,
            color:saved?C.white:C.text,
            border:`1.5px solid ${saved?C.teal:C.border}`,
            borderRadius:10, fontSize:14, fontWeight:500,
            cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s",
            display:"flex", alignItems:"center", gap:8,
          }}>
            {saved
              ? <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>저장됨</>
              : "임시 저장"
            }
          </button>

          <button onClick={handleComplete} disabled={!isValid || saving} style={{
            flex:1, padding:"14px",
            background:isValid?C.navy:C.creamDark,
            color:isValid?C.white:C.textMuted,
            border:"none", borderRadius:10,
            fontSize:15, fontWeight:700,
            cursor:isValid?"pointer":"not-allowed",
            fontFamily:"inherit", transition:"background 0.2s",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}
            onMouseEnter={e=>{ if(isValid&&!saving) e.currentTarget.style.background=C.navyMid; }}
            onMouseLeave={e=>{ if(isValid) e.currentTarget.style.background=C.navy; }}
          >
            {saving
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{animation:"spin 0.8s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>저장 중...</>
              : "저장하고 면접 준비하기 →"
            }
          </button>
        </div>
      </main>
    </>
  );
}
