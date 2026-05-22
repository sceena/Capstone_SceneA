import re

RESULT_PATTERNS = [
    r"\d+%",
    r"\d+\s?ms",
    r"\d+\s?초",
    r"\d+\s?분",
    r"개선",
    r"감소",
    r"증가",
    r"측정",
    r"비교",
]


def has_result(text: str) -> bool:
    return any(re.search(pattern, text, re.IGNORECASE) for pattern in RESULT_PATTERNS)


def has_action(text: str) -> bool:
    action_words = ["구현", "적용", "설계", "개선", "분석", "해결", "도입", "튜닝", "작성"]
    return any(word in text for word in action_words)


def infer_star(text: str) -> str:
    has_situation = any(word in text for word in ["상황", "문제", "요구", "과제"])
    action = has_action(text)
    result = has_result(text)

    if has_situation and action and result:
        return "S/T/A/R 모두 충족"
    if action and result:
        return "Action/Result 충족"
    if action:
        return "Result 부족"
    return "Action/Result 부족"


def infer_sentence_clarity(text: str) -> str:
    if not text.strip():
        return "미측정"
    sentences = [part for part in re.split(r"[.!?。！？]|다\.|요\.", text) if part.strip()]
    avg_len = len(text) / max(1, len(sentences))
    if avg_len > 80:
        return "장황함"
    if avg_len < 20:
        return "짧음"
    return "보통"
