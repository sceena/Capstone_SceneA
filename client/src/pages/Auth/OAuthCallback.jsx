import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthUser } from "../../store/authStore";

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken) {
      navigate("/auth/login", { replace: true });
      return;
    }

    const parseRole = (token) => {
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return payload.role?.toLowerCase();
      } catch {
        return null;
      }
    };

    const role = parseRole(accessToken) || "mentee";

    (async () => {
      let name = "";
      let email = "";
      try {
        const res = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const profile = await res.json();
          name = profile.name || "";
          email = profile.email || "";
        }
      } catch {}

      setAuthUser({ role, name, email, accessToken, refreshToken });
      navigate(role === "mentor" ? "/dashboard/mentor" : "/dashboard/mentee", { replace: true });
    })();
  }, []);

  return (
    <div style={{
      display: "flex", height: "100vh",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif",
      background: "#F4F2EE", flexDirection: "column", gap: 16,
    }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke="#0D2240" strokeWidth="2.5" strokeLinecap="round"
        style={{ animation: "spin 0.8s linear infinite" }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <p style={{ fontSize: 15, color: "#6B6863" }}>소셜 로그인 처리 중...</p>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
