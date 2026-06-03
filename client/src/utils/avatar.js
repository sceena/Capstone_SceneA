const JOB_MAP = [
  {
    keywords: ["백엔드", "backend", "서버", "server", "java", "spring", "node", "python", "django", "go", "rust", "api"],
    gradient: "linear-gradient(135deg, #1E3A5F 0%, #3B82F6 100%)",
    shadowColor: "rgba(59,130,246,0.35)",
    type: "backend",
  },
  {
    keywords: ["프론트", "frontend", "front-end", "react", "vue", "angular", "웹 개발", "web", "html", "css", "next"],
    gradient: "linear-gradient(135deg, #4C1D95 0%, #8B5CF6 100%)",
    shadowColor: "rgba(139,92,246,0.35)",
    type: "frontend",
  },
  {
    keywords: ["풀스택", "fullstack", "full-stack", "full stack"],
    gradient: "linear-gradient(135deg, #1E3A5F 0%, #7C3AED 100%)",
    shadowColor: "rgba(124,58,237,0.35)",
    type: "fullstack",
  },
  {
    keywords: ["ios", "swift", "android", "kotlin", "모바일", "mobile", "앱 개발", "flutter"],
    gradient: "linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 100%)",
    shadowColor: "rgba(14,165,233,0.35)",
    type: "mobile",
  },
  {
    keywords: ["데이터", "data", "ml", "ai", "머신러닝", "딥러닝", "분석", "analytics", "scientist", "mlops", "llm"],
    gradient: "linear-gradient(135deg, #064E3B 0%, #10B981 100%)",
    shadowColor: "rgba(16,185,129,0.35)",
    type: "data",
  },
  {
    keywords: ["devops", "인프라", "infra", "cloud", "클라우드", "sre", "kubernetes", "docker", "aws", "gcp", "azure", "플랫폼"],
    gradient: "linear-gradient(135deg, #0F172A 0%, #0284C7 100%)",
    shadowColor: "rgba(2,132,199,0.35)",
    type: "devops",
  },
  {
    keywords: ["디자인", "design", "ux", "ui", "ux/ui", "figma", "sketch", "그래픽", "브랜드"],
    gradient: "linear-gradient(135deg, #831843 0%, #EC4899 100%)",
    shadowColor: "rgba(236,72,153,0.35)",
    type: "design",
  },
  {
    keywords: ["pm", "기획", "product manager", "프로덕트", "po", "서비스 기획"],
    gradient: "linear-gradient(135deg, #7C2D12 0%, #F97316 100%)",
    shadowColor: "rgba(249,115,22,0.35)",
    type: "pm",
  },
  {
    keywords: ["마케팅", "marketing", "growth", "그로스", "콘텐츠", "sns", "광고"],
    gradient: "linear-gradient(135deg, #713F12 0%, #EAB308 100%)",
    shadowColor: "rgba(234,179,8,0.35)",
    type: "marketing",
  },
  {
    keywords: ["qa", "테스트", "quality", "보안", "security"],
    gradient: "linear-gradient(135deg, #134E4A 0%, #14B8A6 100%)",
    shadowColor: "rgba(20,184,166,0.35)",
    type: "qa",
  },
];

const DEFAULT_AVATAR = {
  gradient: "linear-gradient(135deg, #1E3A5F 0%, #3B6EA5 100%)",
  shadowColor: "rgba(30,58,95,0.3)",
  type: "default",
};

export function getJobAvatar(jobStr = "") {
  const lower = (jobStr || "").toLowerCase();
  const match = JOB_MAP.find(j => j.keywords.some(k => lower.includes(k)));
  return match || DEFAULT_AVATAR;
}

