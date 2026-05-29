import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMentors } from "../../api/users";
import { getAvatar } from "../../utils/avatar";

const C = {
  navy:"#0D2240", navyMid:"#1B4F7A",
  cream:"#F2EDE4", creamDark:"#E8E0D0",
  white:"#FFFFFF", teal:"#1D9E75",
  text:"#1A1818", textSub:"#6B6863",
  textMuted:"#9E9B95", border:"#E8E0D0",
  bg:"#FAF8F4",
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
    try { await fetch("/api/auth/logout", { method:"POST", headers:{ Authorization:`Bearer ${accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };
  return (
    <header style={{ background:C.navy, padding:"0 5%", position:"sticky", top:0, zIndex:100 }}>
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        <span style={{ fontSize:15, fontWeight:600, color:C.white }}>안녕하세요 <span style={{ color:"rgba(255,255,255,0.75)" }}>{userName}</span>님</span>
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {[{l:"대시보드",to:"/dashboard/mentee"},{l:"멘토 탐색",to:"/mentor/search",bold:true},{l:"MyPage",to:"/mentee/mypage"}].map((x,i)=>(
            <Link key={i} to={x.to} style={{ fontSize:14, fontWeight:x.bold?700:400, color:C.white, textDecoration:"none", opacity:x.bold?1:0.85 }}
              onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=x.bold?1:0.85}>{x.l}</Link>
          ))}
          <button onClick={handleLogout} style={{
            padding:"7px 16px", borderRadius:8, border:"1px solid rgba(255,255,255,0.3)",
            background:"transparent", color:"rgba(255,255,255,0.85)",
            fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
          }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.12)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

const MentorCard = ({ m, onClick }) => {
  const av = getAvatar(m.email);
  return (
    <div onClick={onClick} style={{
      background:C.white, borderRadius:16, padding:"24px 20px",
      border:`1px solid ${C.border}`, cursor:"pointer",
      transition:"transform 0.2s, box-shadow 0.2s",
    }}
      onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(13,34,68,0.12)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}
    >
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", marginBottom:14 }}>
        {m.profileImageUrl ? (
          <img src={m.profileImageUrl} alt={m.name} style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", marginBottom:10, border:`2px solid ${C.border}` }}/>
        ) : (
          <div style={{ width:64, height:64, borderRadius:"50%", background:av.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, marginBottom:10 }}>{av.animal}</div>
        )}
        <p style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:4 }}>{m.name} 멘토</p>
        {m.bio && <p style={{ fontSize:13, color:C.textSub, lineHeight:1.6, padding:"0 4px" }}>{m.bio}</p>}
      </div>

      {m.tags?.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, justifyContent:"center", marginBottom:14 }}>
          {m.tags.slice(0, 4).map((t, i) => (
            <span key={i} style={{ fontSize:12, padding:"4px 10px", borderRadius:999, background:C.bg, color:C.textSub }}>#{t.name}</span>
          ))}
        </div>
      )}

      <button style={{
        width:"100%", padding:"10px 0",
        background:C.navy, color:C.white,
        border:"none", borderRadius:10,
        fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
        marginTop: m.tags?.length > 0 ? 0 : 8,
      }}>신청하기</button>
    </div>
  );
};

export default function MentorSearch() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";

  const [mentors, setMentors]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");
  const [focused, setFocused]   = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    getMentors()
      .then(data => {
        setMentors(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("멘토 목록을 불러오지 못했어요.");
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const cats = new Set();
    mentors.forEach(m => m.tags?.forEach(t => { if (t.category) cats.add(t.category); }));
    return [...cats];
  }, [mentors]);

  const filtered = useMemo(() => {
    return mentors.filter(m => {
      if (categoryFilter) {
        const hasCategory = m.tags?.some(t => t.category === categoryFilter);
        if (!hasCategory) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          m.name?.toLowerCase().includes(q) ||
          m.bio?.toLowerCase().includes(q) ||
          m.tags?.some(t => t.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [mentors, search, categoryFilter]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @media(max-width:900px){.mgrid{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:480px){.mgrid{grid-template-columns:1fr!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"36px 5% 60px" }}>

        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color:C.text, letterSpacing:"-0.02em", marginBottom:4 }}>멘토 탐색</h1>
          <p style={{ fontSize:13, color:C.textMuted }}>나에게 맞는 멘토를 찾아 면접을 준비해보세요</p>
        </div>

        {/* 검색 + 필터 */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28, flexWrap:"wrap" }}>
          <div style={{ position:"relative" }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
              <circle cx="6" cy="6" r="4.5" stroke={C.textMuted} strokeWidth="1.4"/>
              <path d="M9.5 9.5l3 3" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              placeholder="이름, 태그, 소개 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                padding:"11px 16px 11px 36px", width:280,
                background:focused?C.white:C.creamDark,
                border:`1.5px solid ${focused?C.navy:"transparent"}`,
                borderRadius:999, fontSize:14, color:C.text,
                outline:"none", fontFamily:"inherit", transition:"all 0.18s",
              }}
            />
          </div>

          {categories.length > 0 && (
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <button onClick={() => setCategoryFilter("")} style={{
                padding:"9px 16px", borderRadius:999, fontSize:13, fontWeight:500,
                background:!categoryFilter?C.navy:C.white,
                color:!categoryFilter?C.white:C.textSub,
                border:`1px solid ${!categoryFilter?C.navy:C.border}`,
                cursor:"pointer", fontFamily:"inherit",
              }}>전체</button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategoryFilter(cat)} style={{
                  padding:"9px 16px", borderRadius:999, fontSize:13, fontWeight:500,
                  background:categoryFilter===cat?C.navy:C.white,
                  color:categoryFilter===cat?C.white:C.textSub,
                  border:`1px solid ${categoryFilter===cat?C.navy:C.border}`,
                  cursor:"pointer", fontFamily:"inherit",
                }}>{cat}</button>
              ))}
            </div>
          )}
        </div>

        {/* 결과 수 */}
        {!loading && !error && (
          <p style={{ fontSize:15, color:C.textSub, marginBottom:20 }}>
            <span style={{ fontWeight:700, color:C.text }}>{filtered.length}명</span>의 멘토를 찾았어요
          </p>
        )}

        {/* 로딩 */}
        {loading && (
          <div style={{ textAlign:"center", padding:"80px 0" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              stroke={C.navy} strokeWidth="2.5" strokeLinecap="round"
              style={{ animation:"spin 0.8s linear infinite", marginBottom:12 }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <p style={{ fontSize:14, color:C.textMuted }}>멘토 목록 불러오는 중...</p>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{ textAlign:"center", padding:"80px 0" }}>
            <p style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:6 }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{
              padding:"10px 24px", background:C.navy, color:C.white,
              border:"none", borderRadius:999, fontSize:13, fontWeight:600,
              cursor:"pointer", fontFamily:"inherit",
            }}>다시 시도</button>
          </div>
        )}

        {/* 그리드 */}
        {!loading && !error && filtered.length > 0 && (
          <div className="mgrid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:18 }}>
            {filtered.map(m => (
              <MentorCard key={m.id} m={m} onClick={() => navigate(`/mentor/apply/${m.id}`, { state: navState })}/>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign:"center", padding:"80px 0" }}>
            <p style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:6 }}>
              {mentors.length === 0 ? "아직 등록된 멘토가 없어요" : "조건에 맞는 멘토가 없어요"}
            </p>
            <p style={{ fontSize:13, color:C.textMuted, marginBottom:20 }}>
              {mentors.length === 0 ? "멘토로 회원가입하면 여기에 표시돼요" : "검색어나 필터를 변경해보세요"}
            </p>
            {mentors.length > 0 && (
              <button onClick={() => { setSearch(""); setCategoryFilter(""); }} style={{
                padding:"10px 24px", background:C.navy, color:C.white,
                border:"none", borderRadius:999, fontSize:13, fontWeight:600,
                cursor:"pointer", fontFamily:"inherit",
              }}>전체 멘토 보기</button>
            )}
          </div>
        )}

      </main>
    </>
  );
}
