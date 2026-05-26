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
- AI 서버 응답은 추천 질문 전용 테이블에 저장한 뒤 프론트엔드에 반환한다.
- 이미 생성 완료된 추천 질문이 있으면 AI 서버를 다시 호출하지 않고 DB에 저장된 질문을 반환한다.
- 프론트엔드는 멘토가 추천 질문을 확인/수정/선택한 뒤 기존 질문 생성 API로 저장하면 된다.

## 백엔드 저장 구조

추천 질문은 최종 면접 질문(`interview_question`)과 분리해서 저장한다.

- `recommended_question_batch`
  - 세션 단위 추천 질문 생성 상태를 저장한다.
  - `session_id`는 세션당 하나만 존재한다.
  - `status`: `PENDING`, `COMPLETED`, `FAILED`
  - `session_type`: `ONE_TO_ONE` 또는 `GROUP`
  - `error_message`: AI 서버 호출 실패 사유

- `recommended_question`
  - 실제 추천 질문 문항을 저장한다.
  - `type`: `COMMON` 또는 `PERSONAL`
  - `candidate_id`: 개인 질문일 때 지원자 ID, 공통 질문일 때 `null`
  - `content`: 추천 질문 내용
  - `order_index`: 표시 순서

현재 구현은 동기 방식이다.
첫 호출 시 AI 서버를 호출해 질문을 생성하고 저장한다.
이후 같은 세션으로 다시 호출하면 저장된 질문을 재사용한다.

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
