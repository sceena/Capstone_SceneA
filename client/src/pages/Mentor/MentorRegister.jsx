import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore, { clearAuthUser } from "../../store/authStore";
import { createMentorAvailability, deleteMentorAvailability, getMentorAvailabilities } from "../../api/reservations";
import { getMyProfile, updateMyProfile } from "../../api/users";

/* ============================================================
   멘토 정보 등록  (pages/mentor/InfoRegister.jsx)
   4단계: ① 직무·경력  ② 면접 강점  ③ 정원·일정 설정  ④ 최종 확인
   ============================================================ */

const C = {
  navy:     "#0D2240", navyMid:"#1B4F7A",
  cream:    "#E8EEF6", creamDark:"#E8EEF6",
  white:    "#FFFFFF", teal:"#0CA678",
  text:     "#1A1B1E", textSub:"#495057",
  textMuted:"#868E96", border:"#E9ECEF",
  bg:       "#F0F4F8", error:"#E03131",
  primaryGrad: "linear-gradient(135deg, #0D2240 0%, #1B4F7A 100%)",
};

const WEEKDAYS = ["일","월","화","수","목","금","토"];
const TIMES = ["09:00","10:00","11:00","14:00","15:00","16:00","19:00","20:00","21:00"];

const toDateKey = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
};

const getScheduleDays = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(tomorrow);
    date.setDate(tomorrow.getDate() + index);
    return {
      key: toDateKey(date),
      label: `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAYS[date.getDay()]})`,
    };
  });
};

const toLocalDateTimeString = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + "T" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(":");
};

const buildAvailabilityPayloads = (slotModes, durationLabel) => {
  const durationMinutes = Number(String(durationLabel).match(/\d+/)?.[0] || 60);

  return Object.entries(slotModes).map(([slot, maxParticipants]) => {
    const divider = slot.lastIndexOf("-");
    const dateKey = slot.slice(0, divider);
    const time = slot.slice(divider + 1);
    const [hour, minute] = time.split(":").map(Number);
    const start = new Date(`${dateKey}T00:00:00`);
    start.setHours(hour, minute, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + durationMinutes);

    return {
      start_time: toLocalDateTimeString(start),
      end_time: toLocalDateTimeString(end),
      max_participants: Number(maxParticipants) === 4 ? 4 : 1,
    };
  });
};

const availabilityToSlotConfig = (availability) => {
  const startTime = availability.start_time ?? availability.startTime;
  if (!startTime) return null;
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return null;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return {
    key: `${toDateKey(date)}-${time}`,
    maxParticipants: Number(availability.max_participants ?? availability.maxParticipants) === 4 ? 4 : 1,
  };
};

/* ── 헤더 ── */
const Header = ({ userName, accessToken }) => {
  const navigate = useNavigate();
  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } }); } catch {}
    clearAuthUser(); navigate("/");
  };
  return (
    <header style={{ background: C.white, padding: "0 5%", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 0 #E9ECEF, 0 2px 8px rgba(0,0,0,0.04)" }}>
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.03em" }}>면도리</span>
          <img src="/mascot_exact_embedded.svg" alt="" aria-hidden="true" style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />
        </div>
        {/* 우측: 네비게이션 + 로그아웃 */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {[
            { l: "대시보드", to: "/dashboard/mentor" },
            { l: "멘토 탐색", to: "/mentor/search" },
            { l: "마이페이지", to: "/mentor/mypage" },
          ].map((x, i) => (
            <Link key={i} to={x.to} style={{ fontSize: 14, color: C.textSub, textDecoration: "none", padding: "6px 14px", borderRadius: 8, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; }}
            >{x.l}</Link>
          ))}
          <div style={{ width: 1, height: 24, background: C.border, margin: "0 8px" }} />
          <button onClick={handleLogout} style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textSub, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.bg; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textSub; }}
          >로그아웃</button>
        </div>
      </nav>
    </header>
  );
};

/* ── 사이드바 단계 ── */
const Sidebar = ({ current }) => {
  const steps = [
    { n:1, title:"직무·경력",     sub:"기본 프로필 설정" },
    { n:2, title:"면접 가능 시간", sub:"일정 및 유형 설정" },
    { n:3, title:"최종 확인",     sub:"등록 완료" },
  ];
  return (
    <aside style={{ width:200, flexShrink:0 }}>
      <p style={{ fontSize:12, color:C.textMuted, marginBottom:20, letterSpacing:"0.05em" }}>등록 단계</p>
      <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
        {steps.map(s => {
          const done   = s.n < current;
          const active = s.n === current;
          return (
            <div key={s.n} style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{
                width:28, height:28, borderRadius:"50%", flexShrink:0,
                background: done ? C.navy : active ? C.navy : C.creamDark,
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"background 0.2s",
              }}>
                {done
                  ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9l5.5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <span style={{ fontSize:11, fontWeight:700, color: active ? C.white : C.textMuted }}>{s.n}</span>
                }
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight: active?700:400, color: (done||active) ? C.text : C.textMuted }}>{s.title}</p>
                <p style={{ fontSize:11, color:C.textMuted, marginTop:1 }}>{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

/* ── 공통 인풋 ── */
const Input = ({ label, hint, placeholder, value, onChange, type="text", multiline, rows=3 }) => {
  const [focused, setFocused] = useState(false);
  const base = {
    width:"100%", padding:"12px 14px",
    background: focused ? C.white : C.creamDark,
    border:`1.5px solid ${focused ? C.navy : "transparent"}`,
    borderRadius:8, fontSize:14, color:C.text,
    outline:"none", fontFamily:"inherit",
    transition:"border-color 0.18s, background 0.18s",
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      {label && <label style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</label>}
      {hint  && <p style={{ fontSize:11, color:C.textMuted, marginTop:-3 }}>{hint}</p>}
      {multiline
        ? <textarea rows={rows} placeholder={placeholder} value={value} onChange={onChange}
            onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
            style={{ ...base, resize:"vertical", lineHeight:1.7 }}/>
        : <input type={type} placeholder={placeholder} value={value} onChange={onChange}
            onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={base}/>
      }
    </div>
  );
};

/* ── 태그 입력 ── */
const TagInput = ({ label, tags, onAdd, onRemove, placeholder }) => {
  const [val, setVal] = useState("");
  const [focused, setFocused] = useState(false);
  const add = () => { const t = val.trim(); if(t && !tags.includes(t)) { onAdd(t); setVal(""); } };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {label && <label style={{ fontSize:13, fontWeight:600, color:C.text }}>{label}</label>}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:4 }}>
        {tags.map((t,i) => (
          <span key={i} style={{
            display:"inline-flex", alignItems:"center", gap:5,
            background:C.navy, color:C.white,
            fontSize:12, padding:"4px 10px", borderRadius:999,
          }}>
            {t}
            <button onClick={()=>onRemove(t)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", cursor:"pointer", padding:0, fontSize:14, lineHeight:1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <input
          value={val} onChange={e=>setVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&(e.preventDefault(),add())}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          placeholder={placeholder}
          style={{
            flex:1, padding:"10px 14px",
            background: focused?C.white:C.creamDark,
            border:`1.5px solid ${focused?C.navy:"transparent"}`,
            borderRadius:8, fontSize:13, color:C.text,
            outline:"none", fontFamily:"inherit",
          }}
        />
        <button onClick={add} style={{
          padding:"10px 16px", background:C.navy, color:C.white,
          border:"none", borderRadius:8, fontSize:13, fontWeight:600,
          cursor:"pointer", fontFamily:"inherit",
        }}>추가</button>
      </div>
    </div>
  );
};

/* ══════════════ STEP 1 — 직무·경력 ══════════════ */
const Step1 = ({ data, onChange }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
    <div>
      <h3 style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:4 }}>직무 · 경력 정보</h3>
      <p style={{ fontSize:13, color:C.textSub }}>멘티에게 보여질 기본 프로필을 설정해주세요</p>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
      <Input label="현 소속 기업" placeholder="예) 네이버" value={data.company} onChange={e=>onChange("company",e.target.value)}/>
      <Input label="직무" placeholder="예) 백엔드 개발" value={data.job} onChange={e=>onChange("job",e.target.value)}/>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
      <Input label="경력 (년차)" placeholder="예) 6" type="number" value={data.years} onChange={e=>onChange("years",e.target.value)}/>
      <Input label="이전 경력 (선택)" placeholder="예) 카카오페이, 쿠팡" value={data.prevCompany} onChange={e=>onChange("prevCompany",e.target.value)}/>
    </div>
    <TagInput
      label="전문 기술 스택"
      tags={data.techStack}
      onAdd={t=>onChange("techStack",[...data.techStack,t])}
      onRemove={t=>onChange("techStack",data.techStack.filter(x=>x!==t))}
      placeholder="예) Java, Spring Boot — Enter 또는 추가 버튼"
    />
    <Input
      label="멘토 소개" multiline rows={4}
      placeholder="현장에서의 경험과 코칭 방식을 자유롭게 적어주세요."
      value={data.bio} onChange={e=>onChange("bio",e.target.value)}
    />
  </div>
);

/* ══════════════ STEP 2 — 면접 강점 ══════════════ */
const INTERVIEW_TYPES = [
  { id:"tech",    label:"기술 면접",   desc:"CS, 알고리즘, 프로젝트 심층 질문" },
  { id:"culture", label:"인성 면접",   desc:"STAR 기법, 경험 구조화" },
  { id:"portfolio",label:"포트폴리오", desc:"프로젝트 리뷰 및 개선 방향 제시" },
  { id:"mock",    label:"모의 면접",   desc:"실전 환경 면접 연습" },
];

const Step2 = ({ data, onChange }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
    <div>
      <h3 style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:4 }}>면접 강점 설정</h3>
      <p style={{ fontSize:13, color:C.textSub }}>나의 코칭 유형과 핵심 강점을 알려주세요</p>
    </div>

    {/* 면접 유형 다중 선택 */}
    <div>
      <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:12 }}>집중 코칭 유형 (복수 선택)</label>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {INTERVIEW_TYPES.map(t => {
          const sel = data.types.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={()=>
              onChange("types", sel ? data.types.filter(x=>x!==t.id) : [...data.types,t.id])
            } style={{
              padding:"14px 16px", textAlign:"left",
              background: sel ? C.navy : C.white,
              border:`1.5px solid ${sel ? C.navy : C.border}`,
              borderRadius:10, cursor:"pointer", fontFamily:"inherit",
              transition:"all 0.18s",
            }}>
              <p style={{ fontSize:14, fontWeight:700, color: sel?C.white:C.text, marginBottom:3 }}>{t.label}</p>
              <p style={{ fontSize:12, color: sel?"rgba(255,255,255,0.65)":C.textSub }}>{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>

    <TagInput
      label="면접 집중 코칭 항목"
      tags={data.focusItems}
      onAdd={t=>onChange("focusItems",[...data.focusItems,t])}
      onRemove={t=>onChange("focusItems",data.focusItems.filter(x=>x!==t))}
      placeholder="예) CS 기초 및 프로젝트 Deep-Dive — Enter"
    />

    <Input
      label="한 줄 코칭 철학" multiline rows={3}
      placeholder='"단순한 정답 공유가 아닌, 현업에서 통하는 사고방식을 길러드립니다."'
      value={data.philosophy} onChange={e=>onChange("philosophy",e.target.value)}
    />
  </div>
);

/* ══════════════ STEP 3 — 정원·일정 설정 ══════════════ */
const CapacityCard = ({ n, label, sub, selected, onClick, color }) => (
  <button type="button" onClick={onClick} style={{
    flex:1, padding:"18px 8px", textAlign:"center",
    background: selected ? C.white : C.bg,
    border:`2px solid ${selected ? color : C.border}`,
    borderRadius:10, cursor:"pointer", fontFamily:"inherit",
    transition:"all 0.18s",
    boxShadow: selected ? "0 2px 12px rgba(13,34,68,0.12)" : "none",
  }}>
    <p style={{ fontSize:24, fontWeight:700, color: selected?color:C.textMuted, marginBottom:4 }}>{n}</p>
    <p style={{ fontSize:12, color: selected?C.textSub:C.textMuted }}>{label}</p>
    {sub && <p style={{ fontSize:11, color:selected?color:C.textMuted, marginTop:4 }}>{sub}</p>}
  </button>
);

const Step3 = ({ data, onChange }) => {
  const scheduleDays = getScheduleDays();

  const toggleSlot = (dateKey, time) => {
    const key = `${dateKey}-${time}`;
    const cur = data.slotModes || {};
    const mode = data.capacity === "4" ? 4 : 1;
    const next = { ...cur };
    if (next[key] === mode) {
      delete next[key];
    } else {
      next[key] = mode;
    }
    onChange("slotModes", next);
  };
  const getSlotMode = (dateKey, time) => data.slotModes?.[`${dateKey}-${time}`];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
      <div>
        <h3 style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:4 }}>면접 가능 시간 설정</h3>
        <p style={{ fontSize:13, color:C.textSub }}>면접 유형과 가능한 시간대를 선택해주세요</p>
      </div>

      {/* 정원 선택 */}
      <div>
        <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:12 }}>면접 유형</label>
        <div style={{ display:"flex", gap:10 }}>
          {[{n:"1:1",v:"1",l:"1:1 면접",s:"정원 1명",color:C.navy},{n:"그룹",v:"4",l:"그룹 면접",s:"정원 4명",color:C.teal}].map(c=>(
            <CapacityCard key={c.n} n={c.n} label={c.l}
              sub={c.s}
              color={c.color}
              selected={data.capacity===c.v}
              onClick={()=>onChange("capacity",c.v)}/>
          ))}
        </div>
        <p style={{ fontSize:12, color:C.textMuted, marginTop:8 }}>
          선택한 면접 유형으로 시간대를 클릭하면 1:1은 남색, 그룹은 초록색으로 저장됩니다.
        </p>
      </div>

      {/* 시간표 */}
      <div>
        <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:12 }}>멘토링 가능 시간</label>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"4px 4px", minWidth:560 }}>
            <thead>
              <tr>
                {scheduleDays.map(day=>(
                  <th key={day.key} style={{ fontSize:11, fontWeight:600, color:C.textMuted, padding:"4px 0", textAlign:"center" }}>{day.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMES.map(time=>(
                <tr key={time}>
                  {scheduleDays.map(day=>{
                    const slotMode = getSlotMode(day.key,time);
                    const on = Boolean(slotMode);
                    const activeColor = Number(slotMode) === 4 ? C.teal : C.navy;
                    return (
                      <td key={day.key} style={{ padding:"2px" }}>
                        <button type="button" onClick={()=>toggleSlot(day.key,time)} style={{
                          width:"100%", height:32, padding:"0 4px",
                          background: on ? activeColor : C.creamDark,
                          color: on ? C.white : C.textMuted,
                          border:`1px solid ${on?activeColor:C.border}`,
                          borderRadius:6, cursor:"pointer",
                          fontSize:11, fontWeight:600,
                          fontFamily:"inherit", transition:"all 0.15s",
                        }}>
                          {time}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", gap:16, marginTop:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:C.navy }}/>
            <span style={{ fontSize:11, color:C.textMuted }}>1:1 면접 가능 시간</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:C.teal }}/>
            <span style={{ fontSize:11, color:C.textMuted }}>그룹 면접 가능 시간</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:C.creamDark, border:`1px solid ${C.border}` }}/>
            <span style={{ fontSize:11, color:C.textMuted }}>임시 가능 슬롯 — 클릭으로 선택/해제</span>
          </div>
        </div>
      </div>

      {/* 세션 기본 설정 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div>
          <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:10 }}>세션 기본 길이</label>
          <div style={{ display:"flex", gap:8 }}>
            {["30분","60분","90분"].map(d=>(
              <button key={d} type="button" onClick={()=>onChange("duration",d)} style={{
                flex:1, padding:"10px 0",
                background: data.duration===d ? C.navy : C.white,
                color: data.duration===d ? C.white : C.text,
                border:`1.5px solid ${data.duration===d?C.navy:C.border}`,
                borderRadius:8, cursor:"pointer",
                fontSize:13, fontWeight:600, fontFamily:"inherit",
              }}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize:13, fontWeight:600, color:C.text, display:"block", marginBottom:10 }}>
            포인트 (세션당)
            <span style={{ fontSize:11, color:C.textMuted, fontWeight:400, marginLeft:6 }}>1 P = 1,000원</span>
          </label>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <input
              type="number" min="10" max="500" step="10"
              value={data.point}
              onChange={e=>onChange("point",e.target.value)}
              style={{
                width:100, padding:"10px 12px",
                background:C.creamDark, border:"1.5px solid transparent",
                borderRadius:8, fontSize:16, fontWeight:700,
                color:C.navy, outline:"none", fontFamily:"inherit",
                textAlign:"center",
              }}
              onFocus={e=>{e.target.style.borderColor=C.navy;e.target.style.background=C.white;}}
              onBlur={e=>{e.target.style.borderColor="transparent";e.target.style.background=C.creamDark;}}
            />
            <span style={{ fontSize:16, fontWeight:700, color:C.navy }}>P</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════ STEP 4 — 최종 확인 ══════════════ */
const ReviewRow = ({ label, value }) => (
  <div style={{ display:"flex", gap:16, padding:"12px 0", borderBottom:`1px solid ${C.border}` }}>
    <span style={{ width:120, flexShrink:0, fontSize:13, color:C.textMuted }}>{label}</span>
    <span style={{ fontSize:13, color:C.text, fontWeight:500, flex:1 }}>{value || "—"}</span>
  </div>
);

const Step4 = ({ d1, d3 }) => {
  const confirmedSlots = Object.keys(d3.slotModes || {}).length;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      <div>
        <h3 style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:4 }}>최종 확인</h3>
        <p style={{ fontSize:13, color:C.textSub }}>등록 내용을 한 번 더 확인해주세요</p>
      </div>
      <div style={{ background:C.white, borderRadius:14, padding:"20px 24px", border:`1px solid ${C.border}` }}>
        <p style={{ fontSize:12, fontWeight:700, color:C.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>기본 정보</p>
        <ReviewRow label="기업·직무" value={`${d1.company} / ${d1.job}`}/>
        <ReviewRow label="경력" value={`${d1.years}년차`}/>
        <ReviewRow label="기술 스택" value={d1.techStack.join(", ")}/>
      </div>
      <div style={{ background:C.white, borderRadius:14, padding:"20px 24px", border:`1px solid ${C.border}` }}>
        <p style={{ fontSize:12, fontWeight:700, color:C.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>일정·정원</p>
        <ReviewRow label="면접 유형" value={d3.capacity === "4" ? "그룹 면접 · 정원 4명" : "1:1 면접 · 정원 1명"}/>
        <ReviewRow label="세션 길이" value={d3.duration}/>
        <ReviewRow label="포인트" value={`${d3.point} P / 세션`}/>
        <ReviewRow label="가능 슬롯" value={`${confirmedSlots}개 시간대 선택됨`}/>
      </div>
      <div style={{ background:C.teal+"18", border:`1.5px solid ${C.teal}`, borderRadius:12, padding:"14px 18px" }}>
        <p style={{ fontSize:13, color:C.teal, fontWeight:600 }}>
          ✓ 등록 완료 후 멘토 탐색 페이지에 프로필이 공개됩니다.
        </p>
      </div>
    </div>
  );
};

/* ══════════════ 메인 컴포넌트 ══════════════ */
export default function MentorInfoRegister() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.email?.split("@")[0] || "사용자";
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [availabilityIds, setAvailabilityIds] = useState([]);
  const [preservedTags, setPreservedTags] = useState([]);

  const [d1, setD1] = useState({ company:"", job:"", years:"", prevCompany:"", techStack:[], bio:"" });
  const [d3, setD3] = useState({ capacity:"1", slotModes:{}, duration:"60분", point:"50" });

  const upd1 = (k,v) => setD1(p=>({...p,[k]:v}));
  const upd3 = (k,v) => setD3(p=>({...p,[k]:v}));

  useEffect(() => {
    getMyProfile()
      .then(profile => {
        const getTag = (category) => profile.tags?.find(t => t.category === category)?.name || "";
        const techStackTags = (profile.tags || []).filter(t => t.category === "기술스택").map(t => t.name);

        const careerStr = getTag("경력");
        let yearsStr = "";
        if (careerStr) {
          const exact = careerStr.match(/^(\d+)년$/);
          const range = careerStr.match(/^(\d+)[~-](\d+)년/);
          if (exact) yearsStr = exact[1];
          else if (range) yearsStr = range[1];
          else if (careerStr === "1년 미만") yearsStr = "0";
          else if (careerStr === "10년 이상") yearsStr = "10";
        }

        setD1(prev => ({
          ...prev,
          company:   getTag("소속기업") || prev.company,
          job:       getTag("직무")     || prev.job,
          years:     yearsStr           || prev.years,
          techStack: techStackTags.length > 0 ? techStackTags : prev.techStack,
          bio:       profile.bio        || prev.bio,
        }));

        const kept = (profile.tags || [])
          .filter(t => t.category === "코칭유형" || t.category === "집중항목")
          .map(t => ({ name: t.name, category: t.category }));
        setPreservedTags(kept);
        return getMentorAvailabilities(profile.id);
      })
      .then(items => {
        setAvailabilityIds(items.map(item => item.id).filter(Boolean));
        const slotModes = items
          .map(availabilityToSlotConfig)
          .filter(Boolean)
          .reduce((acc, item) => ({ ...acc, [item.key]: item.maxParticipants }), {});
        if (Object.keys(slotModes).length > 0) {
          setD3(prev => ({ ...prev, slotModes }));
        }
      })
      .catch(() => {});
  }, []);

  const handleNext = () => { if(step<3) setStep(s=>s+1); };
  const handlePrev = () => { if(step>1) setStep(s=>s-1); };

  const handleSubmit = async () => {
    if (Object.keys(d3.slotModes || {}).length === 0) {
      alert("예약 가능 시간을 하나 이상 선택해주세요.");
      return;
    }
    setLoading(true);
    try {
      const typeNameMap = { tech:"기술 면접", culture:"인성 면접", portfolio:"포트폴리오", mock:"모의 면접" };

      const yearsToRange = (years) => {
        const n = parseInt(years);
        if (isNaN(n)) return null;
        if (n < 1) return "1년 미만";
        if (n <= 3) return "1~3년";
        if (n <= 5) return "3~5년";
        if (n <= 7) return "5~7년";
        if (n <= 10) return "7~10년";
        return "10년 이상";
      };

      const slotValues = Object.values(d3.slotModes || {});
      const has1on1 = slotValues.some(v => Number(v) === 1);
      const hasGroup = slotValues.some(v => Number(v) === 4);

      const tags = [
        d1.company?.trim() ? { name: d1.company.trim(), category: "소속기업" } : null,
        d1.job?.trim()     ? { name: d1.job.trim(),     category: "직무" }     : null,
        yearsToRange(d1.years) ? { name: yearsToRange(d1.years), category: "경력" } : null,
        ...d1.techStack.map(t => ({ name: t, category: "기술스택" })),
        ...preservedTags,
        has1on1 ? { name: "1:1 면접", category: "면접유형" } : null,
        hasGroup ? { name: "그룹 면접", category: "면접유형" } : null,
      ].filter(Boolean);

      const bio = d1.bio?.trim() || null;
      if (bio || tags.length > 0) {
        await updateMyProfile({ bio, tags: tags.length > 0 ? tags : null }, null);
      }

      const payloads = buildAvailabilityPayloads(d3.slotModes, d3.duration);
      await Promise.all(payloads.map(createMentorAvailability));
      const deleteResults = await Promise.allSettled(availabilityIds.map(deleteMentorAvailability));
      const failedDeletes = deleteResults.filter(result => result.status === "rejected");
      if (failedDeletes.length > 0) {
        console.warn("[MentorRegister] 일부 기존 예약 가능 시간은 신청/예약 이력이 있어 삭제하지 않았습니다.", failedDeletes);
      }
      navigate("/dashboard/mentor");
    } catch (error) {
      alert(error?.message || "예약 가능 시간 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:${C.bg}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media(max-width:768px){
          .reg-layout{flex-direction:column !important}
          .reg-sidebar{display:none !important}
        }
      `}</style>

      <Header userName={userName} accessToken={user?.accessToken}/>

      {/* 페이지 타이틀 */}
      <div style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:"14px 5%" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <p style={{ fontSize:15, fontWeight:700, color:C.text }}>면접 일정 · 정보 관리</p>
          <p style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>멘토 프로필과 면접 가능 시간을 설정하세요</p>
        </div>
      </div>

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"40px 5% 60px" }}>
        <div className="reg-layout" style={{ display:"flex", gap:48, alignItems:"flex-start" }}>

          {/* 사이드바 */}
          <div className="reg-sidebar"><Sidebar current={step}/></div>

          {/* 메인 폼 카드 */}
          <div style={{ flex:1 }}>
            <div style={{
              background:C.white, borderRadius:16,
              padding:"36px 40px",
              border:`1px solid ${C.border}`,
              minHeight:520,
              display:"flex", flexDirection:"column",
            }}>
              <div style={{ flex:1 }}>
                {step===1 && <Step1 data={d1} onChange={upd1}/>}
                {step===2 && <Step3 data={d3} onChange={upd3}/>}
                {step===3 && <Step4 d1={d1} d3={d3}/>}
              </div>

              {/* 버튼 */}
              <div style={{ display:"flex", justifyContent:"flex-end", gap:12, marginTop:36, paddingTop:24, borderTop:`1px solid ${C.border}` }}>
                {step>1 && (
                  <button onClick={handlePrev} style={{
                    padding:"12px 28px",
                    background:C.white, color:C.text,
                    border:`1.5px solid ${C.border}`, borderRadius:8,
                    fontSize:14, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
                    transition:"border-color 0.18s",
                  }} onMouseEnter={e=>e.currentTarget.style.borderColor=C.navy}
                     onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    이전
                  </button>
                )}
                <button onClick={step===3?handleSubmit:handleNext} disabled={loading} style={{
                  padding:"12px 36px",
                  background:C.navy, color:C.white,
                  border:"none", borderRadius:8,
                  fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                  opacity:loading?0.7:1, transition:"background 0.18s",
                }} onMouseEnter={e=>{if(!loading)e.currentTarget.style.background=C.navyMid}}
                   onMouseLeave={e=>e.currentTarget.style.background=C.navy}>
                  {loading
                    ? <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{animation:"spin 0.8s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        처리 중...
                      </span>
                    : step===3 ? "등록 완료하기" : "다음 단계"
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
