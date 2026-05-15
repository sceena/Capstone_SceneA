import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

/* ============================================================
   내 서류 업로드  (pages/mentee/DocumentUpload.jsx)
   자기소개서 텍스트 입력 + 이력서/포트폴리오 파일 업로드
   ============================================================ */

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A",
  cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75",
  text:"#1A1818", textSub:"#6B6863",
  textMuted:"#9E9B95", border:"#E8E0D0",
  bg:"#FAF8F4",
};

/* ── 로고 ── */
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

const Header = () => (
  <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
    <nav style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
      <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>김민준</span>님</span>
      <Link to="/" style={{ textDecoration:"none" }}><LogoIcon size={28}/></Link>
      <div style={{ display:"flex", gap:32 }}>
        {[{l:"멘토 탐색",to:"/mentor/search"},{l:"예약 확인",to:"#"},{l:"MyPage",to:"#"}].map((x,i)=>(
          <Link key={i} to={x.to} style={{ fontSize:14, fontWeight:x.l==="MyPage"?700:400, color:C.white, textDecoration:"none", opacity:0.85 }}
            onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0.85}>{x.l}</Link>
        ))}
      </div>
    </nav>
  </header>
);

/* ── 파일 업로드 드롭존 ── */
const DropZone = ({ file, onFile, accept, label }) => {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if(f) onFile(f);
  };

  const handleChange = (e) => {
    const f = e.target.files[0];
    if(f) onFile(f);
  };

  const formatSize = (bytes) => {
    if(bytes < 1024) return `${bytes} B`;
    if(bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/(1024*1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onClick={() => !file && inputRef.current.click()}
      onDragOver={e=>{e.preventDefault();setDragging(true);}}
      onDragLeave={()=>setDragging(false)}
      onDrop={handleDrop}
      style={{
        border:`2px dashed ${dragging ? C.navy : file ? C.teal : C.border}`,
        borderRadius:12,
        padding: file ? "16px 20px" : "28px 20px",
        background: dragging ? C.navy+"08" : file ? C.teal+"08" : C.bg,
        cursor: file ? "default" : "pointer",
        transition:"all 0.18s",
        textAlign:"center",
      }}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display:"none" }}/>

      {file ? (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              width:40, height:40, borderRadius:8,
              background:C.teal+"18",
              display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 2h7l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke={C.teal} strokeWidth="1.4"/>
                <path d="M10 2v4h4" stroke={C.teal} strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M6 10h6M6 13h4" stroke={C.teal} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ textAlign:"left" }}>
              <p style={{ fontSize:14, fontWeight:600, color:C.text }}>{file.name}</p>
              <p style={{ fontSize:12, color:C.textMuted }}>{formatSize(file.size)}</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={e=>{e.stopPropagation();inputRef.current.click();}} style={{
              padding:"6px 12px", background:C.white,
              border:`1px solid ${C.border}`, borderRadius:6,
              fontSize:12, color:C.textSub, cursor:"pointer", fontFamily:"inherit",
            }}>교체</button>
            <button onClick={e=>{e.stopPropagation();onFile(null);}} style={{
              padding:"6px 12px", background:"#FEF2F2",
              border:"1px solid #FECACA", borderRadius:6,
              fontSize:12, color:"#EF4444", cursor:"pointer", fontFamily:"inherit",
            }}>삭제</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{
            width:44, height:44, borderRadius:"50%",
            background:C.creamDark, margin:"0 auto 12px",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 13V4M6 7l4-4 4 4" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 14v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:4 }}>{label}</p>
          <p style={{ fontSize:12, color:C.textMuted }}>
            파일을 끌어다 놓거나 <span style={{ color:C.navy, fontWeight:600 }}>클릭하여 업로드</span>
          </p>
          <p style={{ fontSize:11, color:C.textMuted, marginTop:6 }}>{accept.replace(/\./g,'').toUpperCase()} 파일 · 최대 10MB</p>
        </>
      )}
    </div>
  );
};

/* ── 자소서 항목 ── */
const CoverLetterItem = ({ idx, data, onChange, onRemove }) => {
  const [focused, setFocused] = useState(false);
  const charCount = data.content.length;
  const MAX = 1000;

  return (
    <div style={{
      background:C.white, borderRadius:14,
      border:`1px solid ${focused ? C.navy : C.border}`,
      overflow:"hidden", transition:"border-color 0.18s",
    }}>
      {/* 제목 */}
      <div style={{
        padding:"14px 18px",
        borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", gap:10,
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
        {idx > 0 && (
          <button onClick={onRemove} style={{
            background:"none", border:"none", cursor:"pointer",
            color:C.textMuted, fontSize:16, padding:"0 4px", lineHeight:1,
          }}>×</button>
        )}
      </div>

      {/* 내용 */}
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
          position:"absolute", bottom:10, right:16,
          fontSize:11,
          color: charCount > MAX*0.9 ? "#EF4444" : C.textMuted,
        }}>
          {charCount.toLocaleString()} / {MAX.toLocaleString()}자
        </div>
      </div>
    </div>
  );
};

/* ══════════════ 메인 컴포넌트 ══════════════ */
export default function DocumentUpload() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  /* 자소서 항목들 */
  const [items, setItems] = useState([
    { title:"지원 동기를 작성해주세요", content:"" },
    { title:"본인의 강점과 약점을 작성해주세요", content:"" },
  ]);

  /* 파일 */
  const [resumeFile,    setResumeFile]    = useState(null);
  const [portfolioFile, setPortfolioFile] = useState(null);

  /* 목표 기업/직무 */
  const [targetCompany, setTargetCompany] = useState("");
  const [targetJob,     setTargetJob]     = useState("");

  const updateItem = (i, key, val) => {
    setItems(prev => prev.map((it,idx) => idx===i ? {...it,[key]:val} : it));
  };

  const addItem = () => {
    if(items.length >= 5) return;
    setItems(prev => [...prev, { title:"", content:"" }]);
  };

  const removeItem = (i) => {
    setItems(prev => prev.filter((_,idx)=>idx!==i));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(()=>setSaved(false), 3000);
  };

  const handleComplete = () => {
    const resumeContent = items.map(it => `[${it.title}]\n${it.content}`).join("\n\n");
    navigate("/mentor/search", {
      state: {
        jobPosting: { company: targetCompany, jobCategory: targetJob, rawText: targetCompany + " " + targetJob },
        resumeContent,
      },
    });
  };

  const isValid = items.some(it=>it.content.trim().length>0) || resumeFile;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        textarea::placeholder,input::placeholder{color:${C.textMuted}}
        input:-webkit-autofill{-webkit-box-shadow:0 0 0 1000px ${C.white} inset!important}
      `}</style>

      <Header/>

      <main style={{ maxWidth:820, margin:"0 auto", padding:"44px 5% 80px" }}>

        {/* 페이지 타이틀 */}
        <div style={{ marginBottom:36 }}>
          <h1 style={{ fontSize:28, fontWeight:700, color:C.text, letterSpacing:"-0.02em" }}>
            [ 내 서류 업로드 ]
          </h1>
          <p style={{ fontSize:14, color:C.textSub, marginTop:8, lineHeight:1.6 }}>
            제출한 서류를 바탕으로 AI가 맞춤 면접 질문을 생성하고, 멘토가 사전에 코칭 전략을 준비합니다.
          </p>
        </div>

        {/* 목표 기업 · 직무 */}
        <div style={{
          background:C.white, borderRadius:16,
          padding:"24px 28px",
          border:`1px solid ${C.border}`,
          marginBottom:24,
        }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:18 }}>지원 정보</h2>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            {[
              { label:"목표 기업", val:targetCompany, set:setTargetCompany, ph:"예) 네이버, 카카오" },
              { label:"지원 직무", val:targetJob,     set:setTargetJob,     ph:"예) 백엔드 개발" },
            ].map((f,i)=>{
              const [focused, setFocused] = useState(false);
              return (
                <div key={i}>
                  <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:7 }}>{f.label}</label>
                  <input
                    placeholder={f.ph} value={f.val}
                    onChange={e=>f.set(e.target.value)}
                    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                    style={{
                      width:"100%", padding:"11px 14px",
                      background:focused?C.white:C.bg,
                      border:`1.5px solid ${focused?C.navy:"transparent"}`,
                      borderRadius:8, fontSize:14, color:C.text,
                      outline:"none", fontFamily:"inherit", transition:"all 0.18s",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 자기소개서 */}
        <div style={{
          background:C.white, borderRadius:16,
          padding:"24px 28px",
          border:`1px solid ${C.border}`,
          marginBottom:24,
        }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <div>
              <h2 style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:2 }}>자기 소개서</h2>
              <p style={{ fontSize:12, color:C.textMuted }}>문항별로 작성하면 AI가 더 정확한 질문을 생성해요</p>
            </div>
            <button onClick={addItem} disabled={items.length>=5} style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"8px 14px",
              background:items.length>=5?C.bg:C.navy, color:items.length>=5?C.textMuted:C.white,
              border:"none", borderRadius:8, fontSize:13, fontWeight:600,
              cursor:items.length>=5?"not-allowed":"pointer", fontFamily:"inherit",
              transition:"background 0.18s",
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              문항 추가
            </button>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {items.map((it,i)=>(
              <CoverLetterItem
                key={i} idx={i} data={it}
                onChange={(k,v)=>updateItem(i,k,v)}
                onRemove={()=>removeItem(i)}
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

        {/* 이력서 / 포트폴리오 */}
        <div style={{
          background:C.white, borderRadius:16,
          padding:"24px 28px",
          border:`1px solid ${C.border}`,
          marginBottom:32,
        }}>
          <h2 style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:20 }}>이력서 / 포트폴리오</h2>

          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:8 }}>
                이력서
                <span style={{ fontSize:11, color:C.teal, fontWeight:500, marginLeft:6 }}>필수</span>
              </label>
              <DropZone
                file={resumeFile} onFile={setResumeFile}
                accept=".pdf,.doc,.docx"
                label="이력서 파일을 업로드하세요"
              />
            </div>

            <div>
              <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:8 }}>
                포트폴리오
                <span style={{ fontSize:11, color:C.textMuted, fontWeight:400, marginLeft:6 }}>선택</span>
              </label>
              <DropZone
                file={portfolioFile} onFile={setPortfolioFile}
                accept=".pdf,.zip,.pptx,.url"
                label="포트폴리오 파일을 업로드하세요"
              />
            </div>

            {/* URL 입력 옵션 */}
            <div>
              <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:8 }}>
                포트폴리오 링크
                <span style={{ fontSize:11, color:C.textMuted, fontWeight:400, marginLeft:6 }}>선택</span>
              </label>
              {[useState("")].map(([url, setUrl])=>{
                const [focused, setFocused] = useState(false);
                return (
                  <input key="url"
                    placeholder="https://github.com/username 또는 Notion 링크"
                    value={url} onChange={e=>setUrl(e.target.value)}
                    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                    style={{
                      width:"100%", padding:"11px 14px",
                      background:focused?C.white:C.bg,
                      border:`1.5px solid ${focused?C.navy:"transparent"}`,
                      borderRadius:8, fontSize:13, color:C.text,
                      outline:"none", fontFamily:"inherit", transition:"all 0.18s",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* AI 분석 안내 배너 */}
        <div style={{
          background: C.navy,
          borderRadius:14, padding:"18px 24px",
          marginBottom:28,
          display:"flex", alignItems:"flex-start", gap:14,
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
              서류를 저장하면 AI가 자동으로 분석해 면접 예상 질문을 생성하고, 멘토에게 사전 브리핑을 전달합니다.
              분석 완료까지 약 1~2분 소요됩니다.
            </p>
          </div>
        </div>

        {/* 저장 / 완료 버튼 */}
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={handleSave} style={{
            padding:"14px 28px",
            background:saved ? C.teal : C.white,
            color:saved ? C.white : C.text,
            border:`1.5px solid ${saved ? C.teal : C.border}`,
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
            background:isValid ? C.navy : C.creamDark,
            color:isValid ? C.white : C.textMuted,
            border:"none", borderRadius:10,
            fontSize:15, fontWeight:700,
            cursor:isValid?"pointer":"not-allowed",
            fontFamily:"inherit", transition:"background 0.2s",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
          }}
            onMouseEnter={e=>{if(isValid&&!saving)e.currentTarget.style.background=C.navyMid;}}
            onMouseLeave={e=>{if(isValid)e.currentTarget.style.background=C.navy;}}
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
