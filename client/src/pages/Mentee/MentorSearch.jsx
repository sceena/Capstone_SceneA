import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

/* ============================================================
   멘토 탐색  (pages/mentee/MentorSearch.jsx)
   ============================================================ */

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A",
  cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75",
  text:"#1A1818", textSub:"#6B6863",
  textMuted:"#9E9B95", border:"#E8E0D0",
  bg:"#FAF8F4",
};

const CATEGORIES = {
  "IT/개발":    ["백엔드", "프론트엔드", "풀스택", "iOS/Android", "게임 개발", "임베디드/시스템"],
  "데이터/AI":  ["데이터 엔지니어", "데이터 분석", "ML/AI 엔지니어", "데이터 사이언티스트"],
  "인프라/보안": ["서버/클라우드", "DevOps/SRE", "정보보안", "네트워크"],
  "기획/PM":    ["서비스 기획", "프로덕트 매니저", "프로젝트 매니저", "사업 기획"],
  "디자인":     ["UI/UX", "그래픽 디자인", "브랜드 디자인", "영상/모션"],
  "마케팅":     ["브랜드 마케팅", "퍼포먼스 마케팅", "콘텐츠 마케팅", "CRM/그로스해킹"],
  "영업/세일즈": ["B2B 영업", "B2C 영업", "해외영업", "파트너십/BD"],
  "금융/투자":  ["투자/VC", "IB/증권", "자산운용", "핀테크"],
  "인사/HR":    ["채용", "조직문화/HRD", "노무", "HRBP"],
  "회계/재무":  ["재무관리", "회계", "세무", "전략재무"],
  "컨설팅":     ["경영컨설팅", "IT컨설팅", "전략기획", "스타트업 컨설팅"],
  "연구개발":   ["하드웨어/반도체", "바이오/제약", "소재/화학", "기계/로봇"],
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

const Header = () => (
  <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
    <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
      <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>김민준</span>님</span>
      <Link to="/" style={{ textDecoration:"none" }}><LogoIcon size={28}/></Link>
      <div style={{ display:"flex", gap:32 }}>
        {[{l:"대시보드",to:"/dashboard/mentee"},{l:"멘토 탐색",to:"/mentor/search",active:true},{l:"예약 확인",to:"#"},{l:"MyPage",to:"/mentee/mypage"}].map((x,i)=>(
          <Link key={i} to={x.to} style={{
            fontSize:14, fontWeight:x.active||x.l==="MyPage"?700:400,
            color:C.white, textDecoration:"none", opacity:x.active?1:0.85,
            borderBottom:x.active?"2px solid white":"2px solid transparent", paddingBottom:2,
          }}>{x.l}</Link>
        ))}
      </div>
    </nav>
  </header>
);

const MENTORS = [
  { id:1,  name:"박지훈", company:"네이버",     job:"백엔드 개발",         years:6, tags:["기술 면접","JAVA/Spring","대규모 트래픽"],    rating:4.9, reviews:42, point:50, available:"4/3(목)",  jobMajor:"IT/개발",    jobSub:"백엔드",           careerR:"5년 이상", sessType:"1:1", ac:"#1B4F7A" },
  { id:2,  name:"이수연", company:"카카오",     job:"프론트엔드 개발",      years:5, tags:["기술 면접","React","성능 최적화"],            rating:4.8, reviews:38, point:45, available:"4/5(토)",  jobMajor:"IT/개발",    jobSub:"프론트엔드",        careerR:"3-5년",   sessType:"1:1", ac:"#0F6E56" },
  { id:3,  name:"최현아", company:"라인",       job:"풀스택 개발",          years:4, tags:["포트폴리오 리뷰","TypeScript","DevOps"],      rating:4.7, reviews:29, point:30, available:"4/4(금)",  jobMajor:"IT/개발",    jobSub:"풀스택",            careerR:"3-5년",   sessType:"그룹", ac:"#533BA0" },
  { id:4,  name:"김도현", company:"쿠팡",       job:"데이터 엔지니어",      years:7, tags:["기술 면접","Python","데이터 파이프라인"],      rating:5.0, reviews:55, point:60, available:"4/6(일)",  jobMajor:"데이터/AI",  jobSub:"데이터 엔지니어",   careerR:"5년 이상", sessType:"1:1", ac:"#8B4513" },
  { id:5,  name:"정민서", company:"토스",       job:"iOS 개발",             years:3, tags:["기술 면접","Swift","앱 아키텍처"],            rating:4.6, reviews:21, point:40, available:"4/7(월)",  jobMajor:"IT/개발",    jobSub:"iOS/Android",      careerR:"1-3년",   sessType:"1:1", ac:"#1A5276" },
  { id:6,  name:"한기욱", company:"배달의민족", job:"인프라/SRE",            years:8, tags:["인성 면접","클라우드","MSA"],                rating:4.9, reviews:63, point:35, available:"4/8(화)",  jobMajor:"인프라/보안", jobSub:"서버/클라우드",     careerR:"5년 이상", sessType:"그룹", ac:"#145A32" },
  { id:7,  name:"강유진", company:"카카오페이", job:"프로덕트 매니저",       years:4, tags:["인성 면접","케이스 스터디","전략 사고"],       rating:4.7, reviews:33, point:45, available:"4/9(수)",  jobMajor:"기획/PM",    jobSub:"프로덕트 매니저",   careerR:"3-5년",   sessType:"1:1", ac:"#7B2D8B" },
  { id:8,  name:"윤상호", company:"당근마켓",   job:"Android 개발",         years:5, tags:["기술 면접","Kotlin","아키텍처 패턴"],          rating:4.8, reviews:27, point:50, available:"4/10(목)", jobMajor:"IT/개발",    jobSub:"iOS/Android",      careerR:"3-5년",   sessType:"1:1", ac:"#C0392B" },
  { id:9,  name:"오세진", company:"삼성SDS",    job:"ML/AI 엔지니어",       years:6, tags:["딥러닝","PyTorch","LLM 파인튜닝"],            rating:4.8, reviews:31, point:55, available:"4/11(금)", jobMajor:"데이터/AI",  jobSub:"ML/AI 엔지니어",   careerR:"5년 이상", sessType:"1:1", ac:"#2C3E50" },
  { id:10, name:"임지은", company:"올리브영",   job:"브랜드 마케팅",         years:5, tags:["브랜드 전략","캠페인 기획","소비자 분석"],    rating:4.7, reviews:19, point:40, available:"4/12(토)", jobMajor:"마케팅",     jobSub:"브랜드 마케팅",    careerR:"3-5년",   sessType:"1:1", ac:"#E91E8C" },
  { id:11, name:"장현우", company:"카카오뱅크", job:"투자/VC",               years:7, tags:["스타트업 투자","재무 모델링","IR 피칭"],       rating:4.9, reviews:44, point:65, available:"4/13(일)", jobMajor:"금융/투자",  jobSub:"투자/VC",           careerR:"5년 이상", sessType:"1:1", ac:"#F39C12" },
  { id:12, name:"박소현", company:"삼성전자",   job:"채용/HR",               years:6, tags:["이력서 첨삭","면접 코칭","HR 전략"],          rating:4.8, reviews:52, point:35, available:"4/14(월)", jobMajor:"인사/HR",    jobSub:"채용",              careerR:"5년 이상", sessType:"그룹", ac:"#1ABC9C" },
  { id:13, name:"김태양", company:"맥킨지",     job:"경영컨설팅",            years:5, tags:["케이스 면접","전략 프레임워크","비즈니스 분석"], rating:5.0, reviews:61, point:70, available:"4/15(화)", jobMajor:"컨설팅",     jobSub:"경영컨설팅",        careerR:"3-5년",   sessType:"1:1", ac:"#2980B9" },
  { id:14, name:"서나영", company:"무신사",     job:"퍼포먼스 마케팅",        years:4, tags:["그로스 해킹","데이터 기반 마케팅","ROI 최적화"], rating:4.6, reviews:23, point:40, available:"4/16(수)", jobMajor:"마케팅",     jobSub:"퍼포먼스 마케팅",  careerR:"3-5년",   sessType:"1:1", ac:"#D35400" },
  { id:15, name:"이준혁", company:"LG CNS",    job:"정보보안",               years:8, tags:["보안 아키텍처","취약점 분석","CISO 준비"],     rating:4.9, reviews:37, point:55, available:"4/17(목)", jobMajor:"인프라/보안", jobSub:"정보보안",          careerR:"5년 이상", sessType:"1:1", ac:"#6C3483" },
];

/* ── 직무 2단계 선택 ── */
const CategorySelector = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  // activeMajor: 마우스가 올라간 탭 (오른쪽 소분류 표시 결정용, 호버로 변경)
  // value.major: 실제 확정 선택값 (왼쪽 패널에서 고정 강조)
  const [activeMajor, setActiveMajor] = useState(value.major || Object.keys(CATEGORIES)[0]);

  // 패널 열릴 때 선택된 대분류로 초기화
  useEffect(() => {
    if (open) setActiveMajor(value.major || Object.keys(CATEGORIES)[0]);
  }, [open]);

  const handleSelect = (major, sub) => { onChange({ major, sub }); setOpen(false); };
  const handleMajorOnly = (major) => { onChange({ major, sub:"" }); setOpen(false); };

  const label = value.sub || value.major || "직무 선택";
  const isSelected = !!(value.major || value.sub);

  return (
    <div style={{ position:"relative" }}>
      <button type="button" onClick={()=>setOpen(o=>!o)} style={{
        display:"flex", alignItems:"center", gap:8, padding:"11px 20px",
        background:isSelected?C.navy:C.navyMid, color:C.white,
        border:"none", borderRadius:999, fontSize:15, fontWeight:500,
        cursor:"pointer", fontFamily:"inherit",
      }}>
        {label}
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d={open?"M1.5 7.5l4-4 4 4":"M1.5 3.5l4 4 4-4"} stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:40 }} onClick={()=>setOpen(false)}/>
          <div style={{
            position:"absolute", top:"calc(100% + 8px)", left:0, zIndex:50,
            background:C.white, borderRadius:16, border:`1px solid ${C.border}`,
            boxShadow:"0 12px 40px rgba(13,34,68,0.18)",
            display:"flex", overflow:"hidden", minWidth:500,
          }}>
            {/* 좌: 대분류 */}
            <div style={{ width:160, background:C.bg, borderRight:`1px solid ${C.border}`, padding:"8px 0", flexShrink:0 }}>
              <p style={{ fontSize:10, fontWeight:700, color:C.textMuted, letterSpacing:"0.08em", padding:"8px 16px 4px", textTransform:"uppercase" }}>직종 선택</p>
              {Object.keys(CATEGORIES).map(major=>{
                const isActive   = activeMajor === major;   // 현재 호버 탭
                const isSelected = value.major === major;   // 확정 선택된 대분류
                return (
                  <div key={major}
                    onClick={()=>setActiveMajor(major)}
                    style={{
                      padding:"10px 16px", fontSize:13,
                      fontWeight: isActive || isSelected ? 700 : 400,
                      color: isActive ? C.navy : isSelected ? C.teal : C.textSub,
                      background: isActive ? C.white : isSelected ? `${C.teal}10` : "transparent",
                      borderLeft: isActive
                        ? `3px solid ${C.navy}`
                        : isSelected
                        ? `3px solid ${C.teal}`
                        : "3px solid transparent",
                      cursor:"pointer", transition:"all 0.12s",
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                    }}
                  >
                    <span>{major}</span>
                    {isSelected && (
                      <span className={isActive ? "" : "cat-check"} style={{ lineHeight:1, flexShrink:0 }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke={C.teal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 우: 소분류 */}
            <div style={{ flex:1, padding:"14px 18px" }}>
              <p style={{ fontSize:11, fontWeight:700, color:C.textMuted, marginBottom:10, letterSpacing:"0.05em" }}>
                {activeMajor} 세부 직무
              </p>
              {/* 전체 선택 */}
              <div
                onClick={()=>handleMajorOnly(activeMajor)}
                style={{
                  padding:"8px 12px", borderRadius:8, marginBottom:10,
                  fontSize:13, cursor:"pointer",
                  fontWeight: value.major===activeMajor&&!value.sub ? 700 : 400,
                  color: value.major===activeMajor&&!value.sub ? C.navy : C.textSub,
                  background: value.major===activeMajor&&!value.sub ? C.cream : "transparent",
                  border:`1px solid ${value.major===activeMajor&&!value.sub ? C.border : "transparent"}`,
                }}
                onMouseEnter={e=>{ if(!(value.major===activeMajor&&!value.sub)) e.currentTarget.style.background=C.bg; }}
                onMouseLeave={e=>{ e.currentTarget.style.background=value.major===activeMajor&&!value.sub?C.cream:"transparent"; }}
              >
                {activeMajor} 전체
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {CATEGORIES[activeMajor].map(sub=>{
                  const sel = value.major===activeMajor && value.sub===sub;
                  return (
                    <button
                      key={sel ? `${sub}-sel` : sub}
                      className={sel ? "cat-sub-sel" : ""}
                      onClick={()=>handleSelect(activeMajor,sub)}
                      style={{
                        padding:"7px 14px", borderRadius:999,
                        border:`1.5px solid ${sel?C.navy:C.border}`,
                        background:sel?C.navy:C.white,
                        color:sel?C.white:C.text,
                        fontSize:13, fontWeight:sel?700:400,
                        cursor:"pointer", fontFamily:"inherit", transition:"background 0.15s, border-color 0.15s",
                        display:"inline-flex", alignItems:"center", gap:5,
                      }}
                      onMouseEnter={e=>{ if(!sel){e.currentTarget.style.borderColor=C.navy;e.currentTarget.style.background=C.bg;} }}
                      onMouseLeave={e=>{ if(!sel){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.white;} }}
                    >
                      {sub}
                      {sel && (
                        <span className="cat-check" style={{ lineHeight:1 }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── 드롭다운 ── */
const Dropdown = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button type="button" onClick={()=>setOpen(o=>!o)} style={{
        display:"flex", alignItems:"center", gap:8, padding:"11px 20px",
        background:value?C.navy:C.navyMid, color:C.white,
        border:"none", borderRadius:999, fontSize:15, fontWeight:500,
        cursor:"pointer", fontFamily:"inherit",
      }}>
        {value||label}
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d={open?"M1.5 7.5l4-4 4 4":"M1.5 3.5l4 4 4-4"} stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:50,
          background:C.white, borderRadius:12, border:`1px solid ${C.border}`,
          boxShadow:"0 8px 24px rgba(13,34,68,0.14)", minWidth:160, overflow:"hidden",
        }}>
          <button onClick={()=>{onChange("");setOpen(false);}} style={{
            width:"100%", padding:"11px 18px", textAlign:"left", background:"transparent",
            border:"none", borderBottom:`1px solid ${C.border}`,
            fontSize:14, color:C.textMuted, cursor:"pointer", fontFamily:"inherit",
          }}>전체</button>
          {options.map((o,i)=>(
            <button key={i} onClick={()=>{onChange(o);setOpen(false);}} style={{
              width:"100%", padding:"11px 18px", textAlign:"left",
              background:value===o?C.cream:"transparent", border:"none",
              borderBottom:i<options.length-1?`1px solid ${C.border}`:"none",
              fontSize:14, color:value===o?C.navy:C.text,
              fontWeight:value===o?700:400, cursor:"pointer", fontFamily:"inherit",
            }}
              onMouseEnter={e=>{if(value!==o)e.currentTarget.style.background=C.cream}}
              onMouseLeave={e=>{if(value!==o)e.currentTarget.style.background="transparent"}}
            >{o}</button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── 멘토 카드 ── */
const MentorCard = ({ m, onClick }) => (
  <div onClick={onClick} style={{
    background:C.white, borderRadius:16, padding:"22px 18px",
    border:`1px solid ${C.border}`, cursor:"pointer",
    transition:"transform 0.2s, box-shadow 0.2s",
  }}
    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(13,34,68,0.12)";}}
    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}
  >
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", marginBottom:14 }}>
      <div style={{
        width:60, height:60, borderRadius:"50%",
        background:m.ac, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:20, fontWeight:700,
        color:C.white, marginBottom:10,
      }}>{m.name[0]}</div>
      <p style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>{m.name} 멘토</p>
      <p style={{ fontSize:14, color:C.textSub }}>{m.company} / {m.job} {m.years}년차</p>
    </div>
    <div style={{ display:"flex", flexWrap:"wrap", gap:5, justifyContent:"center", marginBottom:14 }}>
      {m.tags.map((t,i)=>(
        <span key={i} style={{ fontSize:12, padding:"4px 10px", borderRadius:999, background:C.bg, color:C.textSub }}>#{t}</span>
      ))}
    </div>
    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ display:"flex", gap:2 }}>
          {"★★★★★".split("").map((s,i)=>(
            <span key={i} style={{ fontSize:14, color:i<Math.floor(m.rating)?"#F59E0B":"#D1CFC9" }}>★</span>
          ))}
          <span style={{ fontSize:13, color:C.textSub, marginLeft:3 }}>{m.rating}</span>
        </div>
        <span style={{ fontSize:13, color:C.textMuted }}>후기 {m.reviews}건</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:6 }}>
          <span style={{
            fontSize:12, padding:"3px 10px", borderRadius:999, fontWeight:600,
            background:m.sessType==="1:1"?"#EEF5FF":"#E8F5EE",
            color:m.sessType==="1:1"?"#185FA5":C.teal,
          }}>{m.sessType}</span>
          <span style={{ fontSize:12, color:C.textMuted, alignSelf:"center" }}>{m.available}</span>
        </div>
        <span style={{ fontSize:15, fontWeight:700, color:C.navy }}>{m.point} P<span style={{ fontSize:12, fontWeight:400, color:C.textMuted }}>/세션</span></span>
      </div>
    </div>
  </div>
);

export default function MentorSearch() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ major:"", sub:"", career:"", sess:"" });
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState("rating");
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(()=>{
    return MENTORS.filter(m=>{
      if(filters.sub    && m.jobSub!==filters.sub)          return false;
      else if(!filters.sub && filters.major && m.jobMajor!==filters.major) return false;
      if(filters.career && m.careerR!==filters.career)       return false;
      if(filters.sess   && m.sessType!==filters.sess)        return false;
      if(search){
        const q=search.toLowerCase();
        return m.name.includes(search)||m.company.includes(search)||m.job.toLowerCase().includes(q)||m.tags.some(t=>t.toLowerCase().includes(q));
      }
      return true;
    }).sort((a,b)=>sortBy==="rating"?b.rating-a.rating:sortBy==="reviews"?b.reviews-a.reviews:a.point-b.point);
  },[filters,search,sortBy]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @media(max-width:900px){.mgrid{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:480px){.mgrid{grid-template-columns:1fr!important}}
        @keyframes catPop{0%{transform:scale(1)}35%{transform:scale(1.13)}65%{transform:scale(0.96)}100%{transform:scale(1)}}
        @keyframes checkIn{0%{opacity:0;transform:scale(0.3) rotate(-20deg)}60%{transform:scale(1.2) rotate(4deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}
        @keyframes selectedPulse{0%,100%{box-shadow:0 0 0 0 rgba(13,34,68,0.25)}50%{box-shadow:0 0 0 5px rgba(13,34,68,0.08)}}
        .cat-sub-sel{animation:catPop 0.35s cubic-bezier(0.34,1.56,0.64,1),selectedPulse 2s ease 0.35s infinite}
        .cat-check{display:inline-flex;animation:checkIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both}
      `}</style>
      <Header/>
      <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 5% 60px" }}>

        {/* 검색 + 정렬 */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, marginBottom:16, flexWrap:"wrap" }}>
          <div style={{ position:"relative" }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
              <circle cx="6" cy="6" r="4.5" stroke={C.textMuted} strokeWidth="1.4"/>
              <path d="M9.5 9.5l3 3" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input placeholder="기업, 직무, 기술 스택 검색" value={search}
              onChange={e=>setSearch(e.target.value)}
              onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
              style={{
                padding:"11px 16px 11px 36px", width:300,
                background:focused?C.white:C.creamDark,
                border:`1.5px solid ${focused?C.navy:"transparent"}`,
                borderRadius:999, fontSize:14, color:C.text,
                outline:"none", fontFamily:"inherit", transition:"all 0.18s",
              }}/>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:14, color:C.textMuted, marginRight:2 }}>정렬</span>
            {[{v:"rating",l:"평점순"},{v:"reviews",l:"후기순"},{v:"point",l:"저렴한순"}].map(s=>(
              <button key={s.v} onClick={()=>setSortBy(s.v)} style={{
                padding:"8px 14px", borderRadius:999,
                background:sortBy===s.v?C.navy:C.white,
                color:sortBy===s.v?C.white:C.textSub,
                border:`1px solid ${sortBy===s.v?C.navy:C.border}`,
                fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
              }}>{s.l}</button>
            ))}
          </div>
        </div>

        {/* 필터 버튼들 */}
        <div style={{ display:"flex", gap:10, marginBottom:32, flexWrap:"wrap", alignItems:"center" }}>
          <CategorySelector
            value={{ major:filters.major, sub:filters.sub }}
            onChange={({major,sub})=>setFilters(p=>({...p,major,sub}))}
          />
          <Dropdown label="경력" options={["1-3년","3-5년","5년 이상"]} value={filters.career} onChange={v=>setFilters(p=>({...p,career:v}))}/>
          <Dropdown label="세션 유형" options={["1:1","그룹"]} value={filters.sess} onChange={v=>setFilters(p=>({...p,sess:v}))}/>
          {(filters.major||filters.sub||filters.career||filters.sess) && (
            <button onClick={()=>setFilters({major:"",sub:"",career:"",sess:""})} style={{
              padding:"10px 14px", background:"transparent",
              border:`1px solid ${C.border}`, borderRadius:999,
              fontSize:12, color:C.textSub, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:4,
            }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              초기화
            </button>
          )}
        </div>

        {/* 결과 수 */}
        <p style={{ fontSize:15, color:C.textSub, marginBottom:20 }}>
          <span style={{ fontWeight:700, color:C.text }}>{filtered.length}명</span>의 멘토를 찾았어요
        </p>

        {/* 그리드 */}
        {filtered.length > 0 ? (
          <div className="mgrid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18 }}>
            {filtered.map(m=>(
              <MentorCard key={m.id} m={m} onClick={()=>navigate(`/mentor/apply/${m.id}`)}/>
            ))}
          </div>
        ) : (
          <div style={{ textAlign:"center", padding:"80px 0" }}>
            <p style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:6 }}>조건에 맞는 멘토가 없어요</p>
            <p style={{ fontSize:13, color:C.textMuted, marginBottom:20 }}>필터를 변경하거나 검색어를 수정해보세요</p>
            <button onClick={()=>{setFilters({major:"",sub:"",career:"",sess:""});setSearch("");}} style={{
              padding:"10px 24px", background:C.navy, color:C.white,
              border:"none", borderRadius:999, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            }}>전체 멘토 보기</button>
          </div>
        )}
      </main>
    </>
  );
}
