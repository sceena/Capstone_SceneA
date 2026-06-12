import { getJobAvatar } from "../utils/avatar";

const ICONS = {
  backend: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="8" rx="2"/>
      <rect x="2" y="13" width="20" height="8" rx="2"/>
      <circle cx="6" cy="7" r="1" fill="white" stroke="none"/>
      <circle cx="6" cy="17" r="1" fill="white" stroke="none"/>
      <line x1="10" y1="7" x2="14" y2="7"/>
      <line x1="10" y1="17" x2="14" y2="17"/>
    </svg>
  ),
  frontend: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
      <path d="M9 9l-2 2 2 2M15 9l2 2-2 2"/>
    </svg>
  ),
  fullstack: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
      <line x1="12" y1="4" x2="12" y2="20" strokeOpacity="0.5"/>
    </svg>
  ),
  mobile: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="3"/>
      <circle cx="12" cy="17.5" r="1" fill="white" stroke="none"/>
    </svg>
  ),
  data: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="3" y1="20" x2="21" y2="20" strokeWidth="1.4"/>
    </svg>
  ),
  devops: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>
      <path d="M12 13v4M10 15h4" strokeWidth="1.5"/>
    </svg>
  ),
  design: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7-3-3-7 7 3 3z"/>
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      <circle cx="4.5" cy="19.5" r="1.5" fill="white" stroke="none"/>
    </svg>
  ),
  pm: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  ),
  marketing: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  qa: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  default: (
    <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"/>
    </svg>
  ),
};

export default function JobAvatar({ jobStr = "", size = 64, style = {} }) {
  const av = getJobAvatar(jobStr);
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: av.gradient,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      boxShadow: `0 4px 14px ${av.shadowColor}`,
      ...style,
    }}>
      {ICONS[av.type] || ICONS.default}
    </div>
  );
}
