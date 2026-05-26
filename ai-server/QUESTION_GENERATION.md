# AI 추천 질문 생성

## AI 서버 API

### 세션 추천 질문 생성

`POST /api/generate-session-questions`

Request:

```json
{
  "session_type": "GROUP",
  "candidates": [
    {
      "candidate_id": 1,
      "name": "지원자명",
      "content": "지원자 제출 서류 전체 텍스트"
    }
  ]
}
```

Response:

```json
{
  "session_type": "GROUP",
  "common_questions": ["공통 질문"],
  "personal_questions": [
    {
      "candidate_id": 1,
      "questions": ["개인 질문"]
    }
  ]
}
```

- `ONE_TO_ONE`: 지원자 1명에 대한 개인 질문 10개를 반환하고 `common_questions`는 빈 배열이다.
- `GROUP`: 공통 질문 5개와 지원자별 개인 질문 5개를 반환한다.
- 개인 질문은 `candidate_id` 기준으로 매핑한다.

## 백엔드 연동 API

`POST /api/sessions/{sessionId}/questions/recommendations`

- 멘토 인증이 필요하다.
- 백엔드는 세션 참가자와 각 참가자의 이력서/자소서 내용을 조회한다.
- 조회한 서류 내용을 AI 서버의 `/api/generate-session-questions`로 전달한다.
- AI 서버 응답은 DB에 저장하지 않고 프론트엔드에 그대로 반환한다.
- 프론트엔드는 멘토가 추천 질문을 확인/수정/선택한 뒤 기존 질문 생성 API로 저장하면 된다.

백엔드의 AI 서버 주소 설정:

```yaml
ai:
  server:
    base-url: ${AI_SERVER_BASE_URL:http://localhost:8000}
```

로컬에서 AI 서버 주소를 바꾸려면:

```powershell
$env:AI_SERVER_BASE_URL="http://127.0.0.1:8000"
```

## 로컬 Fake 모드

Gemini quota나 모델 가용성 문제로 실제 호출이 막힐 때는 fake 모드로 연동 흐름만 확인할 수 있다.

```powershell
$env:QUESTION_GENERATION_FAKE="1"
```

fake 모드에서는 Gemini를 호출하지 않고 `QuestionGenerator` 내부의 테스트용 질문 템플릿을 반환한다.
이 모드는 API 계약과 백엔드/프론트엔드 연동 테스트용이며, 실제 질문 품질 검증용이 아니다.

실제 Gemini 호출을 테스트하려면 환경변수를 제거한다.

```powershell
Remove-Item Env:QUESTION_GENERATION_FAKE
```

## Gemini 테스트 설정

로컬 수동 테스트에서 quota 사용량을 줄이려면:

```powershell
$env:QUESTION_GENERATION_MAX_RETRIES="1"
$env:QUESTION_GENERATION_GROUP_PERSONAL_WORKERS="1"
$env:QUESTION_GENERATION_TIMEOUT_SEC="180"
```

다른 모델을 테스트하려면:

```powershell
$env:QUESTION_GENERATION_MODEL="gemini-2.5-flash"
$env:QUESTION_GENERATION_THINKING_LEVEL="NONE"
```
