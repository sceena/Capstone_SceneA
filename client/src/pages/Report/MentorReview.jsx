import { useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { saveMentorReview } from "../../api/sessions";

const NAVY = "#0D2240";
const GREEN = "#1D9E75";
const BG = "#FAF8F4";

const QUICK_TAGS = [
  { label: "설명이 명확해요", emoji: "💬" },
  { label: "실전 팁이 도움됐어요", emoji: "🎯" },
  { label: "피드백이 구체적이에요", emoji: "📝" },
  { label: "편안한 분위기였어요", emoji: "😊" },
  { label: "시간 관리가 좋았어요", emoji: "⏱" },
  { label: "다음에도 신청할게요", emoji: "⭐" },
];

const RATING_LABELS = ["", "아쉬웠어요", "보통이에요", "괜찮았어요", "좋았어요", "최고였어요!"];

export default function MentorReviewPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const location = useLocation();
  const mentorName = location.state?.mentorName ?? "멘토";
  const nextPath = location.state?.nextPath ?? `/report/ai-stream/${sessionId}`;

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (label) => {
    setSelectedTags(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      alert("별점을 선택해주세요.");
      return;
    }
    setIsSubmitting(true);
    const fullComment = [
      selectedTags.length ? selectedTags.join(", ") : "",
      comment.trim(),
    ].filter(Boolean).join("\n");

    try {
      await saveMentorReview(sessionId, { rating, comment: fullComment });
    } catch {}

    setSubmitted(true);
    setTimeout(() => navigate(nextPath), 1800);
  };

  const handleSkip = () => navigate(nextPath);

  if (submitted) {
    return (
      <div style={{
        minHeight: "100vh", background: BG,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Noto Sans KR', sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "#E1F5EE", border: `2px solid ${GREEN}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 36,
          }}>✓</div>
          <p style={{ fontSize: 20, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
            후기가 전달됐어요!
          </p>
          <p style={{ fontSize: 14, color: "#888" }}>잠시 후 리포트 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  const displayRating = hovered || rating;

  return (
    <div style={{
      minHeight: "100vh", background: BG,
      fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "48px 24px 80px",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        {/* Top label */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#E1F5EE", borderRadius: 99, padding: "5px 16px", marginBottom: 20,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>멘토링 세션 완료</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, marginBottom: 10, lineHeight: 1.3 }}>
            {mentorName} 멘토님은<br />어떠셨나요?
          </h1>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7 }}>
            솔직한 후기가 멘토 성장과<br />다른 멘티들에게 큰 도움이 돼요.
          </p>
        </div>

        {/* Mentor avatar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: NAVY, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 800, color: "white",
            boxShadow: "0 4px 20px rgba(13,34,68,0.15)",
          }}>
            {mentorName[0]}
          </div>
        </div>

        {/* Star rating */}
        <div style={{
          background: "white", borderRadius: 20, border: "1px solid #E8E4DE",
          padding: "28px 24px", marginBottom: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#333", textAlign: "center", marginBottom: 20 }}>
            전체적인 만족도를 선택해주세요
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => setRating(star)}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  fontSize: 44,
                  filter: star <= displayRating ? "none" : "grayscale(1) opacity(0.25)",
                  transform: star <= displayRating ? "scale(1.1)" : "scale(1)",
                  transition: "all 0.15s",
                  lineHeight: 1,
                }}
              >
                ⭐
              </button>
            ))}
          </div>
          {displayRating > 0 && (
            <p style={{ textAlign: "center", fontSize: 15, fontWeight: 700, color: "#F59E0B" }}>
              {RATING_LABELS[displayRating]}
            </p>
          )}
        </div>

        {/* Quick tags */}
        <div style={{
          background: "white", borderRadius: 20, border: "1px solid #E8E4DE",
          padding: "20px 24px", marginBottom: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 14 }}>
            어떤 점이 좋았나요?
            <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa", marginLeft: 6 }}>선택 (중복 가능)</span>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {QUICK_TAGS.map(({ label, emoji }) => {
              const selected = selectedTags.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleTag(label)}
                  style={{
                    padding: "7px 14px", borderRadius: 99, fontSize: 13,
                    border: selected ? `1.5px solid ${GREEN}` : "1.5px solid #E0DDD8",
                    background: selected ? "#E1F5EE" : "white",
                    color: selected ? GREEN : "#555",
                    fontWeight: selected ? 700 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  <span>{emoji}</span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment textarea */}
        <div style={{
          background: "white", borderRadius: 20, border: "1px solid #E8E4DE",
          padding: "20px 24px", marginBottom: 28,
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 10 }}>
            추가로 하고 싶은 말이 있나요?
            <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa", marginLeft: 6 }}>선택</span>
          </p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="멘토님께 전하고 싶은 솔직한 피드백을 남겨주세요."
            maxLength={500}
            style={{
              width: "100%", borderRadius: 10, border: "1px solid #D1D5DB",
              padding: "12px 14px", fontSize: 13, lineHeight: 1.75, color: "#333",
              fontFamily: "inherit", resize: "vertical", outline: "none",
              minHeight: 100, transition: "border-color 0.15s", boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = GREEN)}
            onBlur={e => (e.target.style.borderColor = "#D1D5DB")}
          />
          <p style={{ textAlign: "right", fontSize: 11, color: "#ccc", marginTop: 4 }}>
            {comment.length} / 500
          </p>
        </div>

        {/* Buttons */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          style={{
            width: "100%", padding: "16px",
            borderRadius: 14, border: "none",
            background: rating === 0 ? "#D1D5DB" : NAVY,
            color: "white", fontSize: 15, fontWeight: 700,
            cursor: rating === 0 || isSubmitting ? "not-allowed" : "pointer",
            transition: "background 0.2s", fontFamily: "inherit",
            marginBottom: 12,
          }}
        >
          {isSubmitting ? "전송 중..." : "후기 남기기"}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          style={{
            width: "100%", padding: "12px",
            borderRadius: 14, border: "none", background: "transparent",
            color: "#aaa", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          건너뛰기
        </button>

      </div>
    </div>
  );
}
