import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { getMentors } from "../../api/users";
import JobAvatar from "../../components/JobAvatar";

const C = {
  primary:      "#0D2240",
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
            { label: "멘토 탐색", to: "/mentor/search", active: true },
            { label: "마이페이지", to: "/mentee/mypage" },
          ].map(({ label, to, active }) => (
            <Link key={label} to={to} style={{
              fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? C.primary : C.textSub,
              textDecoration: "none", padding: "6px 14px", borderRadius: 8,
              background: active ? C.primaryLight : "transparent",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; } }}
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

/* ── 필터 드롭다운 ── */
const Dropdown = ({ label, options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        padding: "9px 14px", borderRadius: 10, cursor: "pointer",
        background: value ? C.primary : C.white,
        color: value ? C.white : C.text,
        border: `1.5px solid ${value ? C.primary : C.border}`,
        fontSize: 13, fontWeight: value ? 600 : 400, fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 6,
        transition: "all 0.15s", whiteSpace: "nowrap",
        boxShadow: value ? "0 4px 12px rgba(13,34,64,0.2)" : "none",
      }}>
        {value || label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          background: C.white, borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          border: `1px solid ${C.border}`, zIndex: 50, minWidth: 160, overflow: "hidden",
        }} onMouseLeave={() => setOpen(false)}>
          <div onClick={() => { onChange(""); setOpen(false); }} style={{
            padding: "10px 16px", fontSize: 13, color: C.textMuted, cursor: "pointer",
            borderBottom: `1px solid ${C.border}`,
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.bg}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >전체</div>
          {options.map(opt => (
            <div key={opt} onClick={() => { onChange(opt); setOpen(false); }} style={{
              padding: "10px 16px", fontSize: 13, cursor: "pointer",
              color: value === opt ? C.primary : C.text,
              fontWeight: value === opt ? 700 : 400,
              background: value === opt ? C.primaryLight : "transparent",
            }}
              onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = C.bg; }}
              onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}
            >{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── 멘토 카드 ── */
const MentorCard = ({ m, onClick }) => {
  const { user } = useAuthStore();
  const isMentor = user?.role === "mentor";
  const jobStr = m.tags?.find(t => t.category === "직무")?.name
    || m.tags?.find(t => t.category === "기술스택")?.name
    || m.job_title || "";
  const careerTag = m.tags?.find(t => t.category === "경력" || t.category === "근속년수");

  return (
    <div onClick={onClick} style={{
      background: C.white, borderRadius: 20,
      padding: "24px 22px",
      boxShadow: C.shadow,
      cursor: "pointer",
      transition: "transform 0.2s, box-shadow 0.2s",
      display: "flex", flexDirection: "column",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(13,34,64,0.13)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = C.shadow; }}
    >
      {/* 상단: 아바타 + 이름 */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 16 }}>
        {m.profile_image_url ? (
          <img src={m.profile_image_url} alt={m.name}
            style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", marginBottom: 12, border: `2px solid ${C.border}` }}/>
        ) : (
          <JobAvatar jobStr={jobStr} size={68} style={{ marginBottom: 12 }}/>
        )}
        <p style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>{m.name} 멘토</p>
        {careerTag && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            background: C.primaryLight, color: C.primary,
            padding: "3px 10px", borderRadius: 99,
            marginBottom: 6,
          }}>{careerTag.name}</span>
        )}
        {m.bio && (
          <p style={{ fontSize: 12, color: C.textSub, lineHeight: 1.65, padding: "0 4px",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{m.bio}</p>
        )}
      </div>

      {/* 태그 */}
      {m.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", marginBottom: 16 }}>
          {m.tags.filter(t => t.category !== "경력" && t.category !== "근속년수").slice(0, 4).map((t, i) => (
            <span key={i} style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 99,
              background: C.bg, color: C.textSub, border: `1px solid ${C.border}`,
            }}>#{t.name}</span>
          ))}
        </div>
      )}

      {/* 구분선 */}
      <div style={{ height: 1, background: C.border, margin: "0 0 14px" }} />

      {/* 하단 버튼 */}
      {isMentor ? (
        <div style={{
          width: "100%", padding: "10px 0", borderRadius: 10,
          background: C.bg, fontSize: 13, fontWeight: 500,
          color: C.textMuted, textAlign: "center",
        }}>멘토는 신청할 수 없어요</div>
      ) : (
        <button style={{
          width: "100%", padding: "11px 0",
          background: C.primaryGrad, color: C.white,
          border: "none", borderRadius: 10,
          fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 4px 12px rgba(13,34,64,0.2)",
          transition: "opacity 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >신청하기</button>
      )}
    </div>
  );
};

/* ════════════════════════════════════════ */
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
  const [filters, setFilters]   = useState({ job: "", career: "", sessType: "" });

  const fetchMentors = (kw = "") => {
    setLoading(true); setError("");
    getMentors({ keyword: kw })
      .then(data => { setMentors(data); setLoading(false); })
      .catch(() => { setError("멘토 목록을 불러오지 못했어요."); setLoading(false); });
  };

  useEffect(() => { fetchMentors(); }, []);
  const handleSearch = () => fetchMentors(search);

  const filtered = mentors.filter(m => {
    const tags = m.tags || [];
    if (filters.job) {
      const jobTag = tags.find(t => t.category === "직무");
      if (!jobTag || !jobTag.name.includes(filters.job)) return false;
    }
    if (filters.career) {
      const careerTag = tags.find(t => t.category === "경력" || t.category === "근속년수");
      if (!careerTag || !careerTag.name.includes(filters.career)) return false;
    }
    if (filters.sessType) {
      const techTags = tags.filter(t => t.category === "기술스택").map(t => t.name);
      if (!techTags.some(n => n.toLowerCase().includes(filters.sessType.toLowerCase()))) return false;
    }
    return true;
  });

  const hasFilter = filters.job || filters.career || filters.sessType;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Inter','Noto Sans KR',-apple-system,sans-serif;background:${C.bg}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:960px){.mgrid{grid-template-columns:repeat(2,1fr)!important}}
        @media(max-width:520px){.mgrid{grid-template-columns:1fr!important}}
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 5% 72px" }}>

        {/* 페이지 타이틀 */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: "-0.04em", marginBottom: 6 }}>
            멘토 탐색
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted }}>나에게 맞는 현직자 멘토를 찾아 면접을 준비해보세요</p>
        </div>

        {/* 검색 + 필터 바 */}
        <div style={{
          background: C.white, borderRadius: 16, padding: "16px 20px",
          boxShadow: C.shadow, marginBottom: 24,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          {/* 검색창 */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="6" cy="6" r="4.5" stroke={C.textMuted} strokeWidth="1.4"/>
              <path d="M9.5 9.5l3 3" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              placeholder="이름, 태그, 소개 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                padding: "10px 16px 10px 36px", width: "100%",
                background: focused ? C.white : C.bg,
                border: `1.5px solid ${focused ? C.primary : C.border}`,
                borderRadius: 10, fontSize: 14, color: C.text,
                outline: "none", fontFamily: "inherit", transition: "all 0.18s",
              }}
            />
          </div>
          <button onClick={handleSearch} style={{
            padding: "10px 22px", borderRadius: 10,
            background: C.primaryGrad, color: C.white, border: "none",
            fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 4px 12px rgba(13,34,64,0.2)", whiteSpace: "nowrap",
          }}>검색</button>

          <div style={{ width: 1, height: 28, background: C.border }}/>

          {/* 3단 필터 */}
          <Dropdown
            label="직무"
            options={["백엔드","프론트엔드","풀스택","모바일","데이터","인프라","기획/PM","디자인"]}
            value={filters.job}
            onChange={v => setFilters(p => ({ ...p, job: v }))}
          />
          <Dropdown
            label="경력"
            options={["1년","2년","3년","4년","5년","6년","7년","8년","9년","10년"]}
            value={filters.career}
            onChange={v => setFilters(p => ({ ...p, career: v }))}
          />
          <Dropdown
            label="기술스택"
            options={["Java","Python","JavaScript","TypeScript","React","Spring","Node.js","Swift","Kotlin","Flutter","AWS","Docker"]}
            value={filters.sessType}
            onChange={v => setFilters(p => ({ ...p, sessType: v }))}
          />

          {(search || hasFilter) && (
            <button onClick={() => { setSearch(""); fetchMentors(""); setFilters({ job: "", career: "", sessType: "" }); }} style={{
              padding: "9px 14px", borderRadius: 10,
              background: "transparent", color: C.textMuted,
              border: `1px solid ${C.border}`, fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>초기화</button>
          )}
        </div>

        {/* 결과 수 */}
        {!loading && !error && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <p style={{ fontSize: 15, color: C.textSub }}>
              <span style={{ fontWeight: 700, color: C.text }}>{filtered.length}명</span>의 멘토
              {hasFilter && <span style={{ fontSize: 12, color: C.primary, marginLeft: 8, fontWeight: 600 }}>필터 적용 중</span>}
            </p>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 40, height: 40, border: `3px solid ${C.border}`,
              borderTop: `3px solid ${C.primary}`, borderRadius: "50%",
              animation: "spin 0.8s linear infinite", margin: "0 auto 14px",
            }}/>
            <p style={{ fontSize: 14, color: C.textMuted }}>멘토 목록 불러오는 중...</p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#FFF5F5",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E03131" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>{error}</p>
            <button onClick={() => window.location.reload()} style={{
              padding: "10px 24px", background: C.primaryGrad, color: C.white,
              border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>다시 시도</button>
          </div>
        )}

        {/* 멘토 유도 배너 */}
        {!loading && !error && user?.role === "mentor" && (
          <div style={{
            background: C.primaryGrad, borderRadius: 16, padding: "24px 32px", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
            boxShadow: "0 8px 24px rgba(13,34,64,0.2)", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", right: -20, top: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }}/>
            <div style={{ position: "relative" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", marginBottom: 6 }}>MENTOR PROFILE</p>
              <p style={{ fontSize: 17, fontWeight: 700, color: C.white, marginBottom: 5 }}>멘토 프로필을 등록해보세요</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                가능 시간과 태그를 등록하면 멘티들이 나를 찾을 수 있어요
              </p>
            </div>
            <button onClick={() => navigate("/mentor/register")} style={{
              padding: "12px 28px", background: C.white, color: C.primary,
              border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              flexShrink: 0, transition: "transform 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
            >지금 등록하기</button>
          </div>
        )}

        {/* 멘토 그리드 */}
        {!loading && !error && filtered.length > 0 && (
          <div className="mgrid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {filtered.map(m => (
              <MentorCard key={m.id} m={m} onClick={() => navigate(`/mentor/apply/${m.id}`, { state: { mentor: m } })}/>
            ))}
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: C.bg,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
              {search || hasFilter ? "검색 결과가 없어요" : "아직 등록된 멘토가 없어요"}
            </p>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>
              {search || hasFilter ? "다른 검색어나 필터를 시도해보세요" : "멘토로 회원가입하면 여기에 표시돼요"}
            </p>
            {(search || hasFilter) && (
              <button onClick={() => { setSearch(""); fetchMentors(""); setFilters({ job: "", career: "", sessType: "" }); }} style={{
                padding: "11px 28px", background: C.primaryGrad, color: C.white,
                border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 4px 12px rgba(13,34,64,0.2)",
              }}>전체 멘토 보기</button>
            )}
          </div>
        )}

      </main>
    </>
  );
}
