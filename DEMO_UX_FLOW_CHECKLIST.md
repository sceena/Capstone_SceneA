# SceneA 데모 UX/면접 플로우 점검 문서

이 문서는 캡스톤 데모 영상을 찍을 수 있는 수준으로, 멘토-멘티 신청부터 면접 진행, STT, 리포트 생성, 멘토 수정, DPO 데이터 축적까지 단계별로 확인하기 위한 체크리스트이다.

## 1. 데모 목표

- 멘토가 가능한 면접 시간을 등록한다.
- 멘티가 멘토를 탐색하고, 자소서/요청사항을 포함해 면접을 신청한다.
- 멘토가 신청을 확인하고 수락한다.
- 확정된 세션에 멘토/멘티가 각각 준비 화면으로 들어간다.
- 준비 화면에서 카메라/마이크 권한과 화면 송출을 확인한다.
- 멘토는 추천 질문을 참고하되, 실제 질문은 직접 말한다.
- 면접 중 멘토 질문 발화와 멘티 답변 발화를 버튼으로 구분해 녹음한다.
- Whisper STT로 질문/답변 텍스트를 생성하고 DB에 저장한다.
- 답변 오디오는 리포트에서 다시 듣기 가능해야 한다.
- 면접 종료 후 AI 리포트와 Fit-Gap 분석이 생성된다.
- 멘토가 리포트의 점수, 평가 근거, 좋은 점, 개선점을 수정한다.
- AI 초안과 멘토 수정본을 분리 보존해 향후 DPO 데이터로 export할 수 있다.

## 2. 실행 환경 구성

### 현재 데모 디버깅 원칙

신청조차 안 되는 상황에서는 면접방/WebRTC/STT를 보기 전에 아래 순서로 끊어서 확인한다.

1. 프론트가 어느 백엔드를 보고 있는지 확인한다.
2. 로그인 토큰의 role/id와 실제 요청 payload가 맞는지 확인한다.
3. `POST /api/reservation/request`가 `resume_content`를 포함해 성공하는지 확인한다.
4. 신청 직후 reservation의 `session_id`가 null이어도 정상이다. 아직 멘토가 수락하지 않았기 때문이다.
5. 멘토 대시보드에서 `GET /api/reservation/mentor?status=PENDING`가 성공하는지 확인한다.
6. 멘토가 `POST /api/reservation/{id}/response`로 수락했을 때 `session_id`가 생성되는지 확인한다.
7. 수락 후 생성된 세션에 멘티 참여자와 자소서가 붙어 추천 질문 생성에 사용되는지 확인한다.

핵심 기준:

- 신청 직후 `session_id: null`은 정상이고, 수락 후에도 null이면 문제다.
- 최신 main 흐름에서는 멘티 신청 화면이 `POST /api/sessions`를 직접 호출하지 않는다.
- 신청 화면에서 여전히 `POST /api/sessions`가 먼저 보이면 프론트가 오래된 코드로 실행 중인지 확인한다.
- `GET /api/sessions/{id}/report`의 404는 “아직 리포트 없음”일 수 있으므로 신청 실패와 분리해서 본다.
- `POST /api/reservation/request` 또는 수락 API의 500은 치명적이다. 이 경우 백엔드 로그의 stacktrace를 반드시 확인한다.

### 프론트엔드

- 개발 서버: `client`, Vite, 기본 포트 `5173`
- API 프록시: `client/vite.config.js`
- 기본 백엔드 대상: `http://54.116.176.242:8080`
- 기본 미디어 서버 대상: `http://54.116.176.242:4000`
- 개발 환경 명시 파일: `client/.env.development`
  - `VITE_API_BASE_URL=http://54.116.176.242:8080`
  - `VITE_MEDIA_SERVER_URL=http://54.116.176.242:4000`
- 로컬 테스트 시 브라우저 접속 예:
  - 같은 PC: `http://localhost:5173`
  - 같은 네트워크 기기: `http://{PC_LAN_IP}:5173`

주의:

- Network 탭에는 `http://localhost:5173/api/...`로 보여도 Vite proxy가 내부적으로 배포 백엔드로 넘길 수 있다.
- `.env.development` 또는 `vite.config.js`를 바꾼 뒤에는 `npm run dev`를 반드시 재시작한다.
- 로컬 Spring Boot 콘솔에 H2 로그가 찍히고 있다면, 프론트가 로컬 백엔드를 보고 있는지 의심한다.

### 백엔드

- Spring Boot API: `backend`, 기본 포트 `8080`
- 주요 외부 의존성:
  - MySQL
  - S3 또는 S3 호환 스토리지
  - AI 서버 `ai.server.base-url`
- 배포 확인:
  - Swagger: `http://54.116.176.242:8080/swagger-ui/index.html`
  - 백엔드 Docker 로그: `docker logs --tail=100 carpoolink-backend`
- 로컬 백엔드 로그에서 `jdbc:h2:mem:testdb`가 보이면 로컬 H2 DB로 실행 중인 것이다.
- 배포 백엔드와 로컬 H2는 데이터가 다르므로, 데모 검증 시 두 환경을 섞으면 안 된다.

배포 백엔드 필수 엔드포인트:

- `POST /api/sessions`
- `GET /api/sessions/{id}`
- `GET /api/sessions/me`
- `POST /api/sessions/{id}/resume`
- `POST /api/reservation/request`
- `GET /api/reservation/mentor?status=PENDING`
- `POST /api/reservation/{id}/response`
- `POST /api/sessions/{id}/questions/recommendations`
- `POST /api/sessions/{id}/questions/audio`
- `POST /api/sessions/{id}/questions/{questionId}/answers`
- `GET /api/sessions/{id}/answers/stt-status`
- `POST /api/sessions/{id}/report/generate`
- `GET /api/sessions/{id}/report`

### 미디어 서버

- Node.js + mediasoup: `media-server`, 기본 포트 `4000`
- 핵심 환경변수:
  - `PORT=4000`
  - `SPRING_BOOT_URL=http://localhost:8080`
  - `ANNOUNCED_IP`: 배포 서버 공인 IP 또는 로컬 LAN IP
  - `LOCAL_IP`: 로컬 네트워크 테스트 시 PC LAN IP
  - `FRONTEND_ORIGINS`: 추가 프론트 Origin
  - `RTC_MIN_PORT=10000`
  - `RTC_MAX_PORT=10100`
- 배포에서는 UDP/TCP `10000-10100` 포트가 열려 있어야 한다.
- HTTPS 프론트에서 접속하면 WebSocket/미디어 연결은 `wss://`/보안 컨텍스트 정책을 고려해야 한다.

### AI 서버

- FastAPI: `ai-server`, 기본 포트 `8000`
- Colab/ngrok 사용 시 URL은 매번 바뀔 수 있다.
- 현재 필요한 엔드포인트:
  - `GET /health`
  - `POST /api/stt`
  - `POST /api/generate-session-questions`
  - `POST /report`
  - `POST /api/fit-gap`
- 백엔드는 STT에서 AI 서버가 S3를 직접 바라보지 않는 방식으로 가야 한다.
  - 백엔드가 브라우저 오디오를 받고 S3에 저장한다.
  - 백엔드가 같은 오디오 파일을 multipart로 AI 서버 `/api/stt`에 보낸다.
  - AI 서버는 오디오 파일만 받아 Whisper로 STT를 수행한다.

## 3. 역할별 UX 흐름

## 3.0 신청/예약 플로우 디버깅

면접 신청이 안 되면 이 섹션만 먼저 본다. 면접방, 카메라, STT는 그 다음이다.

### 정상 신청 요청 순서

멘티가 멘토 신청 버튼을 누르면 Network 탭에 아래 순서가 보여야 한다.

```txt
POST /api/reservation/request
GET /api/reservation/mentor?status=PENDING       멘토 화면
POST /api/reservation/{id}/response              멘토 수락
```

정상 payload 예:

```json
// POST /api/reservation/request
{
  "mentor_id": 32,
  "availability_id": 62,
  "resume_content": "[지원 동기]\n...\n\n[멘토에게 전달할 내용]\n..."
}
```

```json
// POST /api/reservation/{id}/response
{
  "accepted": true
}
```

성공 기준:

- `POST /api/reservation/request` 응답 상태는 `PENDING`이어야 한다.
- 신청 직후 reservation의 `session_id`가 null이어도 정상이다.
- 멘토 수락 응답에 `session_id`가 있어야 한다.
- 수락 후 `GET /api/sessions/{session_id}`에서 멘토/멘티 참여자가 보여야 한다.
- 수락 후 `POST /api/sessions/{session_id}/questions/recommendations`가 자소서 기반으로 동작해야 한다.

### 현재 발생했던 대표 문제

문제 형태:

```txt
POST /api/sessions 500 Internal Server Error
POST /api/reservation/request 201
reservation.session_id = null
```

의미:

- 예전 프론트 흐름에서 발생하던 문제다.
- 최신 main 흐름에서는 신청 단계에서 세션을 만들지 않는다.
- 자소서는 reservation의 `resume_content`로 먼저 저장하고, 멘토 수락 시 세션과 resume으로 옮겨진다.
- 따라서 신청 직후 `session_id: null` 자체는 문제가 아니다.

현재 방어 기준:

- 신청 화면에서 `POST /api/sessions`를 호출하지 않는다.
- 멘토 수락 후에도 `session_id`가 null이면 실패로 본다.
- 멘토 수락 후 resume이 세션에 저장되지 않으면 추천 질문 생성이 깨질 수 있다.
- 사용자는 신청 또는 수락 실패 메시지를 받아야 한다.

### Network 탭 확인법

Chrome DevTools:

1. `Network` 탭
2. `Fetch/XHR` 필터
3. 신청 버튼 클릭
4. 아래 요청을 순서대로 클릭해 확인

확인 항목:

- `Headers`
  - Request URL
  - Request Method
  - Status Code
  - Authorization Bearer token 존재 여부
- `Payload`
  - `mentor_id`
  - `availability_id`
  - `session_id`
  - `job_category`
- `Response`
  - `code`
  - `message`

상태코드 해석:

- `400`: 요청 값 문제. payload, enum, 날짜, 상태값 확인
- `401`: 로그인 토큰 없음/만료
- `403`: 역할/권한 문제. 멘티가 멘토 API를 호출했거나 세션 참여자가 아님
- `404`: mentor/session/resume/availability id 없음
- `409`: 이미 예약된 availability
- `500`: 백엔드 내부 예외. 반드시 서버 로그 확인
- `502`: AI 서버 호출 실패

### 백엔드 로그 확인법

배포 서버:

```bash
docker logs carpoolink-backend --tail 200
docker logs -f carpoolink-backend
```

로컬 서버:

- Spring Boot 실행 터미널에서 `Unhandled exception` 검색
- 요청을 다시 보내고 바로 아래 stacktrace 확인

찾아야 할 문구:

```txt
Unhandled exception
Caused by:
DataIntegrityViolationException
SQLIntegrityConstraintViolationException
Data truncated for column
Unknown column
Column ... cannot be null
Cannot add or update a child row
```

의심 원인:

- 배포 DB 스키마와 Entity 불일치
- `interview_session.status` enum/컬럼 제약 불일치
- `scheduled_at` not null 제약
- `session_participant` FK 실패
- `mentor_id`는 존재하지만 role이 `MENTOR`가 아님
- 로그인 토큰 sub는 멘티인데 요청의 mentor_id가 잘못 해석됨
- 운영 DB에는 id가 있는데 로컬 H2에는 데이터가 없음

### 백엔드/프론트 환경 혼동 확인

프론트 요청 URL이 `localhost:5173/api/...`로 보여도 실제 백엔드는 proxy target일 수 있다.

확인 파일:

- `client/.env.development`
- `client/vite.config.js`
- `client/vercel.json`

데모 로컬 프론트가 배포 백엔드를 보려면:

```env
VITE_API_BASE_URL=http://54.116.176.242:8080
VITE_MEDIA_SERVER_URL=http://54.116.176.242:4000
```

확인 방법:

- 프론트 dev server 재시작
- 신청 시 로컬 Spring Boot 터미널에 요청 로그가 찍히지 않아야 한다.
- 배포 백엔드 로그에 요청이 찍혀야 한다.

## 3.1 멘토 UX

### 대시보드/모집

1. 멘토 로그인
2. 가능한 면접 시간 등록
3. 등록한 시간은 멘티의 멘토 탐색/신청 화면에 표시
4. 멘티가 신청하면 멘토 대시보드의 수락 대기 목록에 표시
5. 멘토가 수락하면 예약은 `CONFIRMED`, 세션은 면접 준비 가능 상태가 되어야 함

확인할 API:

- `POST /api/availability`
- `GET /api/reservation/mentor?status=PENDING`
- `POST /api/reservation/{id}/response`

### 면접 준비 화면

멘토에게 보여야 하는 것:

- 세션 정보
- 멘티 정보
- 멘티가 제출한 자소서/요청사항
- AI 추천 질문
- 카메라/마이크 미리보기
- 면접 입장 버튼

주의:

- 추천 질문은 참고용이다.
- 추천 질문을 선택하는 것이 실제 질문 저장과 동일하면 안 된다.
- 실제 질문 데이터는 멘토가 면접 중 직접 말한 오디오를 STT 변환해서 저장해야 한다.

### 면접 진행 화면

멘토에게 필요한 버튼:

- 질문 시작
- 질문 종료
- 면접 종료

멘토 동작:

1. 멘토가 질문 시작 버튼을 누른다.
2. 브라우저 `MediaRecorder`가 멘토 음성을 녹음한다.
3. 멘토가 직접 질문을 말한다.
4. 질문 종료 버튼을 누른다.
5. 질문 오디오가 백엔드로 업로드된다.
6. 백엔드는 질문 오디오를 저장하고 AI 서버 `/api/stt`로 STT를 요청한다.
7. STT 결과가 `InterviewQuestion.content` 또는 질문 transcript에 저장된다.
8. 이 질문이 다음 멘티 답변과 매칭될 기준 질문이 된다.

멘토 화면 UX:

- 멘토가 질문 녹음 중이면 멘티의 답변 시작 버튼은 비활성화되어야 한다.
- 멘티가 답변 녹음 중이면 멘토의 질문 시작 버튼은 비활성화되어야 한다.
- 현재 말하고 있는 사람의 비디오 카드 테두리에 얇은 강조 표시를 준다.
- STT 변환 중/대기/실패 상태는 면접 흐름을 방해하지 않도록 화면 전면에 노출하지 않는다.
- 필요하면 작은 상태 아이콘이나 관리자/디버그 영역에만 표시한다.

확인할 API:

- `POST /api/sessions/{id}/questions/audio`
- `GET /api/sessions/{id}/questions`

## 3.2 멘티 UX

### 신청 전

멘티에게 필요한 것:

- 멘토 탐색
- 멘토 상세/가능 시간 확인
- 자소서 등록
- 멘토에게 하고 싶은 말 또는 현재 상황 입력
- 면접 신청

확인할 API:

- `GET /api/users/mentors`
- `GET /api/availability/mentors/{mentorId}`
- `POST /api/reservation/request`

현재 데모 안정성을 위해 주의할 점:

- 신청 흐름에서는 `POST /api/reservation/request`만 성공하면 된다.
- 신청 payload에는 `mentor_id`, `availability_id`, `resume_content`가 포함되어야 한다.
- 예약 신청의 기준 상태는 `Reservation.status=PENDING`이다.
- 신청 직후 `session_id`는 null일 수 있다.
- 멘토 수락 시 `session_id`가 생성되어야 하며, reservation의 `resume_content`가 해당 세션의 resume으로 저장되어야 한다.

### 면접 준비 화면

멘티에게 보여야 하는 것:

- 확정된 면접 일정
- 멘토 정보
- 본인이 제출한 자소서/요청사항 요약
- 카메라/마이크 미리보기
- 권한 요청 상태
- 면접 입장 버튼

멘티에게 보이면 안 되는 것:

- AI 추천 질문
- 멘토가 참고할 내부 평가/질문 생성 근거
- 다른 멘티의 자소서/요청사항

주의:

- 브라우저 카메라 권한은 보안 정책상 `localhost` 또는 HTTPS에서만 안정적으로 동작한다.
- LAN IP로 접속하는 경우 브라우저/OS 권한, HTTPS 여부, Safari/Chrome 정책을 확인해야 한다.

### 면접 진행 화면

멘티에게 필요한 버튼:

- 답변 시작
- 답변 종료

멘티 동작:

1. 멘토 질문이 종료되면 멘티의 답변 시작 버튼이 활성화된다.
2. 멘티가 답변 시작 버튼을 누른다.
3. 브라우저 `MediaRecorder`가 멘티 음성을 녹음한다.
4. 멘티가 답변한다.
5. 답변 종료 버튼을 누른다.
6. 답변 오디오가 백엔드로 업로드된다.
7. 백엔드는 답변 오디오를 S3에 저장하고 AI 서버 `/api/stt`로 STT를 요청한다.
8. STT 결과가 `InterviewAnswer`에 저장된다.
9. 답변은 직전 질문과 매칭되어야 한다.

멘티 화면 UX:

- 멘토가 질문 녹음 중이면 답변 시작 버튼은 비활성화되어야 한다.
- 본인이 답변 녹음 중이면 다른 발화 시작 버튼은 비활성화되어야 한다.
- 현재 본인이 말하고 있으면 본인 비디오 카드 테두리에 강조 표시가 보여야 한다.
- STT 변환 중이라는 문구가 면접 화면 중심에 떠서 흐름을 끊으면 안 된다.

확인할 API:

- `POST /api/sessions/{id}/questions/{questionId}/answers`
- `GET /api/sessions/{id}/questions/{questionId}/answers`
- `GET /api/sessions/{id}/questions/{questionId}/answers/{answerId}/audio`

## 4. 면접 중 상태 모델

권장 상태:

- `WAITING`: 방 생성 후 대기
- `READY`: 준비 화면에서 장치 확인 완료
- `INTERVIEWING`: 면접 진행 중
- `RECORDING_QUESTION`: 멘토 질문 녹음 중
- `RECORDING_ANSWER`: 멘티 답변 녹음 중
- `ENDED`: 면접 종료
- `REPORTING`: 리포트 생성 중
- `REPORT_READY`: 리포트 확인 가능

현재 백엔드 세션 상태:

- `PENDING`
- `SCHEDULED`
- `IN_PROGRESS`
- `COMPLETED`

데모 구현에서는 UI 내부 상태와 백엔드 상태를 분리해서 볼 필요가 있다.

- 백엔드 `SCHEDULED`: 면접 준비 가능
- 백엔드 `IN_PROGRESS`: 질문/답변 오디오 업로드 가능
- 백엔드 `COMPLETED`: 리포트 생성 가능
- UI `RECORDING_QUESTION`, `RECORDING_ANSWER`: 브라우저 녹음 제어용 상태

## 4.1 동시 녹음 방지 규칙

면접 중에는 동시에 한 명만 리포트용 녹음을 할 수 있어야 한다.

권장 UI 상태:

```json
{
  "activeRecorderId": 20,
  "activeRecorderRole": "MENTOR",
  "recordingType": "QUESTION",
  "targetMenteeId": 31,
  "startedAt": "2026-05-30T15:30:00"
}
```

규칙:

- `activeRecorderId`가 있으면 다른 사람의 녹음 시작 버튼은 비활성화한다.
- 멘토가 `RECORDING_QUESTION`이면 멘티는 답변 시작을 누를 수 없다.
- 멘티가 `RECORDING_ANSWER`이면 멘토는 질문 시작을 누를 수 없다.
- 녹음 종료 또는 업로드 실패 시 lock을 반드시 해제한다.
- 브라우저 새로고침/이탈 시에도 lock이 남지 않도록 timeout 또는 cleanup이 필요하다.
- 여러 멘티가 있는 면접에서는 `targetMenteeId` 기준으로 답변 가능 멘티를 제한한다.

데모 최소 구현:

- 프론트 전역/방 상태에서 `activeRecorder`를 공유한다.
- 버튼 disable과 현재 발화자 테두리 강조를 먼저 구현한다.
- 서버 lock까지 구현하기 어렵다면 데모에서는 UI lock과 소켓 이벤트로 우선 보장한다.

## 5. 질문/답변 저장 구조

권장 발화 단위:

```json
{
  "roomId": "media room id",
  "sessionId": 51,
  "speakerId": 20,
  "speakerRole": "MENTOR",
  "targetMenteeId": 31,
  "turnType": "QUESTION",
  "startedAt": "2026-05-30T15:30:00",
  "endedAt": "2026-05-30T15:30:30",
  "audioUrl": "s3://...",
  "sttStatus": "DONE",
  "transcriptText": "프로젝트에서 가장 어려웠던 기술적 문제는 무엇이었나요?",
  "pairedQuestionTurnId": null
}
```

현재 코드 기준:

- 질문: `InterviewQuestion`
- 답변: `InterviewAnswer`
- 질문 오디오 업로드: `POST /api/sessions/{id}/questions/audio`
- 답변 오디오 업로드: `POST /api/sessions/{id}/questions/{questionId}/answers`
- 답변 다시 듣기: `GET /api/sessions/{id}/questions/{questionId}/answers/{answerId}/audio`

점검할 부분:

- 질문 오디오와 답변 오디오가 서로 다른 API로 저장되는지
- 멘토 질문 종료 후 생성된 questionId를 프론트가 보관하는지
- 멘티 답변 업로드 시 올바른 questionId를 사용하고 있는지
- 여러 멘티가 있는 경우 targetMenteeId 또는 mentee_id가 정확히 들어가는지
- STT 실패 시 `sttStatus=FAILED`로 저장하고 면접 흐름은 유지되는지
- 녹음 중인 발화자가 바뀌거나 중복 업로드될 때 잘못된 질문/답변 pair가 생기지 않는지
- 새로고침 이후에도 마지막 질문 id를 복구할 수 있는지

## 6. STT/Whisper 점검

### 기대 구조

1. 브라우저가 오디오 Blob 생성
2. 백엔드에 multipart 업로드
3. 백엔드가 오디오를 S3에 저장
4. 백엔드가 같은 오디오를 AI 서버 `/api/stt`에 multipart로 전달
5. AI 서버가 Whisper small 또는 medium으로 변환
6. 백엔드가 transcript, model, language, duration, quality status를 저장
7. 리포트 생성 시 저장된 질문/답변 텍스트 사용

### 확인할 것

- AI 서버 `/health`가 열리는지
- AI 서버 `/api/stt` Swagger에서 짧은 오디오 파일 업로드가 성공하는지
- 백엔드 `ai.server.base-url`이 현재 ngrok URL인지
- Colab/ngrok가 끊기면 STT와 추천 질문/리포트 생성이 실패할 수 있음
- STT 실패 시에도 앱 전체가 멈추지 않고 수동 입력 또는 fallback 안내가 나오는지
- Whisper small/medium 사용 시 IT 용어 오인식이 생길 수 있으므로 사후 보정 절차가 있는지
- CS/백엔드/프론트엔드/AI/DevOps 용어 사전을 만들 수 있는지
- STT 결과를 리포트 생성 전에 사람이 확인하거나, AI 서버에서 IT 용어 후처리를 할 수 있는지

### 데모 전 Smoke Test

1. 5초짜리 음성 파일 준비
2. AI 서버 Swagger `/api/stt`에서 업로드
3. `text`가 반환되는지 확인
4. 백엔드 질문 업로드 API로 같은 파일 테스트
5. 백엔드 답변 업로드 API로 같은 파일 테스트
6. DB에서 질문/답변 transcript가 저장됐는지 확인

### IT 용어 STT 품질 보정 절차

Whisper small/medium은 데모 환경에서 현실적이지만, IT 전문 용어를 잘못 변환할 수 있다.

예상 오인식:

- `Redis` → `레디스`, `레디스가`
- `Kubernetes` → `쿠버네티스`, `쿠버네티즈`
- `Docker` → `도커`
- `JPA` → `제이피에이`, `JPA`
- `JWT` → `제이더블유티`, `JWT`
- `CI/CD` → `씨아이씨디`
- `Spring` → `스프링`

권장 보정 단계:

1. STT 원문을 저장한다.
2. IT 용어 normalize 사전을 적용한 보정 transcript를 별도 필드 또는 동일 transcript에 반영한다.
3. 리포트 생성에는 보정 transcript를 우선 사용한다.
4. 리포트 화면에는 멘토가 transcript를 수동 수정할 수 있는 fallback을 둔다.
5. 원문과 보정본을 모두 남기면 STT 품질 개선에 활용할 수 있다.

데모 최소 구현:

- STT 결과가 어색해도 면접 진행 화면에는 크게 노출하지 않는다.
- 리포트 생성 전 또는 리포트 화면에서 수정 가능한 텍스트로 제공한다.
- 데모용으로 자주 쓰는 기술 용어 20~30개만 normalize해도 충분하다.

## 7. 리포트 생성 흐름

면접 종료 후 기대 흐름:

1. 멘토가 면접 종료를 누른다.
2. 백엔드 세션 상태가 `COMPLETED`가 된다.
3. 리포트 생성 화면으로 이동한다.
4. 백엔드가 질문/답변, 자소서, 채용공고를 모은다.
5. AI 서버 `/report`로 리포트 생성을 요청한다.
6. 필요 시 AI 서버 `/api/fit-gap`으로 Fit-Gap 분석을 요청한다.
7. 리포트를 DB에 저장한다.
8. 멘티는 1차 AI 리포트를 볼 수 있다.

확인할 API:

- `PATCH /api/sessions/{id}/status`
- `POST /api/sessions/{id}/report/generate`
- `GET /api/sessions/{id}/report`
- `GET /api/sessions/{id}/report/fit-gap`

리포트에 포함되어야 하는 것:

- 질문 텍스트
- 답변 텍스트
- 답변 오디오 다시 듣기 링크
- AI 평가 점수
- AI 평가 근거
- 좋은 점
- 개선점
- Fit-Gap 역량 분석
- 전체 요약/종합 피드백

중요:

- 리포트 화면은 더미 데이터가 아니라 실제 세션의 질문/답변/STT/AI 평가 결과를 보여줘야 한다.
- AI 서버가 실패했을 때만 fallback 리포트 또는 실패 안내를 사용한다.
- fallback을 쓰더라도 화면에는 “실제 저장된 질문/답변 기반”으로 구성되어야 한다.
- 데모에서 mock report를 보여주는 경우, 실제 플로우 검증이 불가능하므로 최종 데모 전에 제거하거나 명확히 분리한다.

## 8. 멘토 수정 및 DPO 데이터 축적

### 기대 구조

- AI 리포트 생성 시 질문별 AI 평가 초안을 저장한다.
- 멘토가 점수/근거/좋은 점/개선점을 수정한다.
- AI 초안은 `rejected` 후보로 보존한다.
- 멘토 수정본은 `chosen` 후보로 보존한다.
- 운영 데이터가 쌓이면 DPO 학습 데이터로 export한다.

현재 코드 기준:

- AI 초안 저장 테이블: `AnswerEvaluation`
- 멘토 수정 API: `PATCH /api/sessions/{sessionId}/answers/{answerId}/evaluation/mentor`
- DPO export API: `GET /api/dev/dpo-export`

멘토 수정 화면에서 확인할 것:

- AI 평가 초안이 화면에 보이는지
- 멘토가 `score`, `reasoning`, `strengths`, `improvements`를 수정할 수 있는지
- 저장 후 `AnswerEvaluation.mentor*` 필드만 바뀌는지
- `AnswerEvaluation.ai*` 필드는 덮어쓰지 않는지
- 최종 리포트 상태가 멘티에게 전달 가능한지

DPO JSONL 예:

```json
{
  "prompt": "면접 질문:\n...\n\n지원자 답변:\n...",
  "rejected": {
    "reasoning": "AI 초안 평가 근거",
    "overall_score": 6,
    "strengths": ["..."],
    "improvements": ["..."]
  },
  "chosen": {
    "reasoning": "멘토가 수정한 평가 근거",
    "overall_score": 8,
    "strengths": ["..."],
    "improvements": ["..."]
  },
  "metadata": {
    "answer_id": 123,
    "session_id": 51,
    "ai_model_name": "rule-based-fallback 또는 sft model",
    "prompt_version": "sft_eval_v1",
    "evaluation_source": "sft 또는 fallback",
    "same_as_ai": false
  }
}
```

## 9. 데모 전 단계별 테스트 시나리오

### A. 회원/예약

- [ ] 멘토 회원가입/로그인 성공
- [ ] 멘티 회원가입/로그인 성공
- [ ] 멘토가 가용 시간 등록
- [ ] 멘티가 멘토 탐색에서 멘토 확인
- [ ] 멘티가 자소서 등록
- [ ] 멘티가 가능한 시간을 선택해 신청
- [ ] Network에서 `POST /api/reservation/request`가 201인지 확인
- [ ] Payload에 `mentor_id`, `availability_id`, `resume_content`가 있는지 확인
- [ ] 신청 응답 상태가 `PENDING`인지 확인
- [ ] 신청 직후 `session_id`가 null이어도 정상으로 본다
- [ ] 멘토 대시보드에 수락 대기 표시
- [ ] Network에서 `GET /api/reservation/mentor?status=PENDING`가 200인지 확인
- [ ] 멘토가 수락
- [ ] Network에서 `POST /api/reservation/{id}/response`가 200인지 확인
- [ ] 수락 응답의 `session_id`가 null이 아닌지 확인
- [ ] 생성된 세션에 멘티 participant와 resume이 붙었는지 확인
- [ ] 멘티 대시보드에 확정 세션 표시

### B. 면접 준비

- [ ] 멘토 준비 화면 접속
- [ ] 멘티 준비 화면 접속
- [ ] 카메라 권한 요청 확인
- [ ] 마이크 권한 요청 확인
- [ ] 로컬 미리보기 표시
- [ ] 상대방 영상 표시
- [ ] 멘토 화면에 추천 질문 표시
- [ ] Network에서 `POST /api/sessions/{id}/questions/recommendations`가 200인지 확인
- [ ] 추천 질문 응답에 `personal_questions[].questions`가 있는지 확인
- [ ] 멘토 화면에 멘티 자소서/요청사항 표시
- [ ] 멘티 화면에는 추천 질문이 보이지 않음
- [ ] 멘티 화면에는 본인 자소서/요청사항 요약만 표시
- [ ] 추천 질문 실패 시 화면이 멈추지 않음

### C. 면접 진행

- [ ] 멘토 질문 시작 버튼 표시
- [ ] 멘토 질문 종료 버튼 표시
- [ ] 멘티 답변 시작 버튼 표시
- [ ] 멘티 답변 종료 버튼 표시
- [ ] 동시에 두 명이 녹음하지 못하도록 UI lock 처리
- [ ] 누군가 녹음 중이면 다른 사람의 녹음 시작 버튼 비활성화
- [ ] 현재 발화자 비디오 카드 테두리 강조
- [ ] STT 변환 중 문구가 면접 흐름을 방해하지 않음
- [ ] 질문 종료 후 질문 transcript 저장
- [ ] 답변 종료 후 답변 transcript 저장
- [ ] 답변 오디오 다시 듣기 URL 저장
- [ ] 여러 번 질문/답변을 반복해도 question-answer pair가 꼬이지 않음
- [ ] Whisper가 IT 용어를 틀리게 변환한 경우 보정 또는 수정 가능

### D. 리포트

- [ ] 면접 종료 버튼 클릭
- [ ] 세션 상태 `COMPLETED`
- [ ] 리포트 생성 화면 이동
- [ ] AI 리포트 생성 성공
- [ ] Fit-Gap 표시
- [ ] 질문/답변 pair 표시
- [ ] 리포트가 더미 데이터가 아니라 실제 세션 데이터 기반
- [ ] 답변 다시 듣기 재생
- [ ] STT 실패 답변은 실패 상태 또는 fallback 문구 표시

### E. 멘토 수정/DPO

- [ ] 멘토 리포트 검토 화면 진입
- [ ] 질문별 점수 수정
- [ ] 질문별 평가 근거 수정
- [ ] 좋은 점 수정
- [ ] 개선점 수정
- [ ] 저장 후 새로고침해도 수정본 유지
- [ ] AI 초안은 DB에서 보존
- [ ] `/api/dev/dpo-export`에서 chosen/rejected JSONL 확인

## 10. 배포 환경에서 자주 깨지는 지점

### API URL

- 프론트가 `/api/...`로 호출하면 Vite dev proxy가 백엔드로 넘긴다.
- 배포 프론트에서는 `VITE_API_BASE_URL` 또는 reverse proxy 설정이 필요하다.
- 브라우저 Network에는 `localhost:5173/api/...`로 보여도 실제 대상은 `vite.config.js`의 `target`일 수 있다.

### CORS

- 백엔드 `SecurityConfig`에 프론트 Origin이 들어가야 한다.
- 로컬 LAN IP로 접속할 경우 `http://{LAN_IP}:5173`이 허용되어야 한다.

### WebRTC

- 미디어 서버 `ANNOUNCED_IP`가 잘못되면 상대방 영상이 안 뜬다.
- 서버 방화벽에서 `4000`, `10000-10100` 포트가 열려야 한다.
- 같은 PC 두 브라우저 테스트와 다른 기기 테스트는 조건이 다르다.

### 카메라/마이크

- `localhost`는 브라우저가 보안 컨텍스트로 인정한다.
- LAN IP의 HTTP 접속은 브라우저/OS 정책에 따라 카메라 권한이 제한될 수 있다.
- Mac에서는 시스템 설정의 브라우저 카메라/마이크 권한도 확인해야 한다.

### AI 서버/ngrok

- Colab 런타임이 끊기면 STT, 추천 질문, 리포트 생성이 실패한다.
- ngrok URL이 바뀌면 백엔드 `AI_SERVER_BASE_URL`도 같이 바뀌어야 한다.
- 데모 직전 Swagger `/health`, `/api/stt` 확인이 필요하다.

### 더미 데이터와 실제 데이터 혼동

- 개발 중 mock 리포트, demo session, 임시 fallback이 실제 화면에 섞이면 데모 검증이 어렵다.
- 데모 모드는 별도 버튼이나 `/api/dev/**`로 분리한다.
- 실제 면접 플로우에서는 DB에 저장된 질문/답변/리포트만 보여줘야 한다.
- 리포트 화면에서 `mockAiReport`, 하드코딩된 질문/답변, 임시 점수가 남아 있는지 확인한다.

## 10.1 긴급 장애 판별표

### 신청 버튼을 눌렀는데 신청이 안 됨

먼저 볼 요청:

```txt
POST /api/reservation/request
```

가능한 결과:

| 결과 | 의미 | 다음 행동 |
|---|---|---|
| 201 | 신청 생성 성공 | 응답 `status=PENDING` 확인 |
| 400 | 요청 형식/값 문제 | Payload의 `mentor_id`, `availability_id`, `resume_content` 확인 |
| 401 | 토큰 문제 | 재로그인, Authorization 헤더 확인 |
| 403 | 권한 문제 | 로그인 role이 `MENTEE`인지 확인 |
| 404 | mentor/availability id 없음 | 멘토 목록/가용시간에서 받은 id인지 확인 |
| 409 | 이미 예약된 시간 | 다른 가용시간 선택 |
| 500 | 백엔드 내부 예외 | 백엔드 로그 stacktrace 확인 |

최신 main 흐름에서는 신청 화면에서 아래 요청이 먼저 나가면 안 된다.

```txt
POST /api/sessions
```

신청 직후 아래 상태는 정상이다.

```json
{
  "session_id": null,
  "status": "PENDING"
}
```

문제 상황:

- 멘토 수락 후에도 `session_id`가 null이면 세션 생성/연결 실패다.
- 멘토 수락 후 resume이 세션에 저장되지 않으면 추천 질문 생성이 실패할 수 있다.
- 신청 버튼에서 `POST /api/sessions`가 호출되면 프론트가 이전 코드로 실행 중일 수 있다.

### 자소서가 저장됐는지 모르겠음

정상 확인:

```txt
POST /api/reservation/request 201
POST /api/reservation/{id}/response 200
```

응답 예:

```json
{
  "session_id": 51,
  "status": "CONFIRMED"
}
```

확인 기준:

- 자소서 관리 화면에서는 localStorage에만 저장된 상태일 수 있다.
- 신청 시 localStorage의 자소서가 `resume_content`로 reservation에 전달되어야 한다.
- 실제 session resume 저장은 멘토 수락 시 이루어진다.
- 수락 후 추천 질문이 404이면 해당 세션에 resume이 붙었는지 백엔드 로그/DB로 확인한다.

### 멘토 수락 대기 목록이 비어 있음

먼저 볼 요청:

```txt
GET /api/reservation/mentor?status=PENDING
```

확인:

- Authorization token의 role이 `MENTOR`인지
- 멘티가 신청한 mentor id와 현재 로그인한 멘토 id가 같은지
- 예약 생성 응답의 `mentor_id`가 맞는지
- 백엔드 배포 Swagger에 `/api/reservation/mentor`가 있는지

### 추천 질문이 안 뜸

먼저 볼 요청:

```txt
POST /api/sessions/{id}/questions/recommendations
```

해석:

- 200: 추천 질문 생성 성공
- 403: 로그인 사용자가 세션 멘토가 아님
- 404: 세션 또는 자소서 없음
- 502: AI 서버/ngrok 문제
- 500: 백엔드 내부 예외

필수 선행 조건:

- 멘토가 reservation을 수락했고 응답의 `session_id`가 null이 아님
- 해당 session에 멘티 participant가 있음
- 해당 session + mentee member 조합으로 resume이 저장되어 있음
- AI 서버 `/api/generate-session-questions`가 열려 있음

### 리포트가 404임

요청:

```txt
GET /api/sessions/{id}/report 404
```

의미:

- 아직 리포트가 생성되지 않았을 수 있다.
- 면접 신청 실패와 직접 관련된 에러가 아닐 수 있다.

다음 확인:

```txt
GET /api/sessions/{id}/answers/stt-status
POST /api/sessions/{id}/report/generate
```

리포트 생성 선행 조건:

- 질문이 1개 이상 저장됨
- 답변이 1개 이상 저장됨
- 답변 STT가 완료되었거나 실패 fallback 처리 가능
- AI 서버 `/report`가 열려 있음

### STT가 안 됨

먼저 볼 요청:

```txt
POST /api/sessions/{id}/questions/audio
POST /api/sessions/{id}/questions/{questionId}/answers
```

해석:

- 201인데 `stt_status=FAILED`: 오디오는 저장됐고 AI STT 실패
- 500: S3 저장 또는 백엔드 내부 예외
- 502: AI 서버 `/api/stt` 연결 실패

확인:

- AI 서버 Swagger `/api/stt`에서 직접 오디오 업로드 테스트
- 백엔드 `ai.server.base-url`이 현재 ngrok URL인지 확인
- Colab이 살아 있는지 확인
- 브라우저가 만든 `audio/webm`을 AI 서버가 처리할 수 있는지 확인

### 영상/카메라가 안 나옴

확인 순서:

1. 브라우저 주소가 `localhost` 또는 HTTPS인지 확인
2. Mac 시스템 설정에서 Chrome/Safari 카메라/마이크 권한 확인
3. 프론트 준비 화면에서 getUserMedia 권한 요청이 뜨는지 확인
4. Network/Console에서 socket.io 연결 확인
5. media-server 로그 확인
6. `ANNOUNCED_IP`, `LOCAL_IP`, `RTC_MIN_PORT`, `RTC_MAX_PORT` 확인
7. 서버 방화벽에서 UDP/TCP `10000-10100` 열림 확인

## 10.2 오늘 데모를 위한 최소 우회 전략

아래는 정식 해결이 아니라 데모 중 멈춤을 줄이기 위한 임시 운영 기준이다.

- 신청이 막히면 `POST /api/reservation/request` 응답과 백엔드 로그를 먼저 확인한다.
- 신청 직후 `session_id: null`은 정상이나, 멘토 수락 후에도 null이면 데모에 쓰지 않는다.
- 추천 질문이 실패하면 멘토는 자소서 요약을 보고 직접 질문을 진행한다.
- STT가 실패하면 오디오는 저장하고, 리포트에는 “STT 실패, 수동 확인 필요” 상태를 표시한다.
- 리포트 생성이 실패하면 저장된 질문/답변 목록 화면까지는 이동 가능하게 한다.
- AI 서버/ngrok가 끊기면 STT/추천/리포트는 실패할 수 있지만 로그인/예약/면접방/오디오 저장은 유지되어야 한다.

## 11. 현재 우선순위

1. `POST /api/reservation/request` 201 및 `PENDING` 확인
2. 신청 payload의 `resume_content` 전달 확인
3. 멘토 대시보드 수락 대기 목록 확인
4. 멘토 수락 후 `session_id` 생성 확인
5. 수락 후 세션에 멘티 participant와 resume 저장 확인
6. 멘토 준비 화면에서 자소서 기반 추천 질문 생성 확인
7. 카메라/마이크 미리보기 안정화
8. 역할별 준비 화면 분리: 멘토는 추천 질문/멘티 자료, 멘티는 본인 자료만 표시
9. 면접 중 질문/답변 버튼과 오디오 저장 안정화
10. 동시 녹음 방지 lock과 현재 발화자 표시
11. Whisper STT 성공/실패 상태 저장
12. IT 용어 STT 보정 또는 수동 수정 fallback
13. 질문-답변 pair 정확성 보장
14. 실제 데이터 기반 리포트 생성과 Fit-Gap 표시
15. 답변 다시 듣기
16. 멘토 수정본 저장
17. DPO JSONL export 확인

## 12. 구현 시 주의할 점

- WebRTC 실시간 통화 로직과 리포트용 녹음 저장 로직은 섞지 않는다.
- 미디어 서버는 통화 연결 담당, 백엔드는 녹음 파일/DB/STT/리포트 담당으로 역할을 나눈다.
- 추천 질문은 실제 질문 저장 데이터가 아니다.
- 실제 질문은 멘토 음성 STT 결과로 저장한다.
- 답변 오디오는 반드시 저장해야 한다.
- 질문 오디오는 리포트 다시 듣기 대상은 아니지만, 질문 텍스트 생성을 위해 저장 또는 STT 처리되어야 한다.
- STT 실패가 면접 진행을 막으면 안 된다.
- AI 서버 실패가 전체 앱을 멈추면 안 된다.
- DPO를 위해 AI 초안과 멘토 수정본을 절대 덮어쓰지 않는다.

## 13. 데모 당일 최소 확인 순서

1. 백엔드 Swagger 접속
2. AI 서버 Swagger 접속
3. AI 서버 `/api/stt` 짧은 오디오 테스트
4. 프론트 접속
5. 멘토/멘티 로그인
6. 멘토 가용 시간 등록
7. 멘티 신청
8. 멘토 수락
9. 멘토/멘티 준비 화면 입장
10. 카메라/마이크 확인
11. 질문 녹음 1회
12. 답변 녹음 1회
13. 면접 종료
14. 리포트 생성
15. 답변 다시 듣기
16. 멘토 평가 수정
17. DPO export 확인

## 14. 면접 진행 UX 전체 디버깅 프롬프트

아래 프롬프트는 면접 진행 화면을 다시 점검하거나 다른 팀원에게 디버깅을 요청할 때 그대로 사용한다.

```txt
너는 시니어 풀스택 개발자이자 WebRTC/STT 기반 면접 서비스 디버깅 담당자다.

목표는 대규모 리팩토링이 아니라, 현재 캡스톤 데모에서 멘토-멘티 면접 진행 UX가 끊기지 않고 실제 데이터 기반 리포트까지 이어지게 만드는 것이다.

절대 지켜야 할 원칙:
- 면접 입장 자체는 멘토/멘티가 자유롭게 할 수 있어야 한다.
- 동기화가 필요한 지점은 면접 종료, 리포트 준비, 멘토링 세션 시작/종료다.
- 미디어 서버/WebRTC가 실패해도 질문/답변 오디오 저장과 리포트용 데이터 축적은 멈추면 안 된다.
- AI 서버/STT가 실패해도 오디오 저장은 성공해야 한다.
- 추천 질문과 실제 질문을 절대 섞지 않는다.
- 추천 질문은 멘토 참고용이고, 실제 질문은 멘토가 말한 오디오 STT 결과다.
- 멘토 질문 1개에는 멘티 답변 1개 이상이 정확히 매칭되어야 한다.
- 멘토가 질문을 완료한 뒤에는 해당 질문에 대한 답변이 저장되기 전까지 다음 질문 시작을 막아야 한다.
- 멘티는 멘토의 실제 질문이 저장되기 전까지 답변 시작을 누를 수 없어야 한다.
- 멘토만 면접 종료를 누를 수 있어야 한다.
- 멘토가 면접 종료를 누르면 멘티도 자동으로 리포트 생성/리포트 화면으로 이동해야 한다.
- 멘토가 리포트 이후 멘토링 세션을 시작하면 멘티도 자동으로 멘토링 세션으로 이동해야 한다.
- 멘토링 세션 종료도 멘토가 주도하고, 멘티는 자동으로 후속 화면으로 이동해야 한다.

먼저 코드를 수정하지 말고 다음 파일을 확인하라:
- client/src/pages/Interview/InterviewLobby.jsx
- client/src/pages/Interview/InterviewSession.jsx
- client/src/pages/Interview/MentoringSession.jsx
- client/src/pages/Mentee/MenteeDashboard.jsx
- client/src/pages/Mentor/MentorDashboard.jsx
- client/src/pages/Report/AIReport.jsx
- client/src/pages/Report/ReportGenerating.jsx
- client/src/api/sessions.js
- backend/src/main/java/com/backend/domain/interviewSession/**
- backend/src/main/java/com/backend/domain/interviewQuestion/**
- backend/src/main/java/com/backend/domain/interviewAnswer/**
- backend/src/main/java/com/backend/domain/analysisReport/**
- media-server/src/**

분석 결과는 아래 순서로 출력하라:
1. 현재 면접 진행 상태 흐름 요약
2. 멘토 화면에서 보여야 할 것과 실제 보이는 것
3. 멘티 화면에서 보여야 할 것과 실제 보이는 것
4. 질문 시작/완료 버튼의 기대 동작과 실제 코드 동작
5. 답변 시작/완료 버튼의 기대 동작과 실제 코드 동작
6. 추천 질문과 실제 질문이 분리되어 있는지
7. 질문-답변 pair가 깨질 수 있는 지점
8. 동시 녹음 lock이 깨질 수 있는 지점
9. 미디어 서버가 죽었을 때 살아 있어야 하는 HTTP fallback
10. STT 실패 시 살아 있어야 하는 fallback
11. 면접 종료 동기화가 백엔드 상태 기반으로 되는지
12. 리포트 생성 이후 멘토링 시작 동기화가 되는지
13. 멘토/멘티 타이머가 같은 기준 시각으로 계산되는지
14. 오늘 당장 고칠 최소 수정 파일
15. 수정하면 위험한 파일
16. 브라우저 Network/Console에서 확인할 요청과 응답

수정이 필요하면 가장 작은 변경부터 제안하고, 기존 정상 기능을 깨뜨릴 가능성이 있으면 먼저 설명하라.
```

## 15. 면접 진행 상태와 역할별 UX 기준

### 15.1 상태 기준

면접 진행 화면에서 다루는 상태는 크게 네 종류다.

| 구분 | 권장 상태 | 저장 위치 | 용도 |
|---|---|---|---|
| 세션 상태 | `SCHEDULED`, `IN_PROGRESS`, `COMPLETED` | 백엔드 `InterviewSession.status` | 입장 가능 여부, 면접 종료 동기화 |
| 질문 상태 | 질문 없음, 질문 녹음 중, 답변 대기 중, 답변 완료 | 프론트 + 질문/답변 DB | 질문-답변 turn 진행 |
| 녹음 lock | 없음, 멘토 질문 녹음, 멘티 답변 녹음 | media-server activeRecorder + 프론트 fallback | 동시 녹음 방지 |
| STT 상태 | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` | `InterviewQuestion`, `InterviewAnswer` | 리포트 생성 품질 확인 |

중요:

- `IN_PROGRESS`는 “누군가 면접방에 들어왔다”가 아니라 “면접이 진행 중/리포트 이후 멘토링 시작 신호”로도 재사용될 수 있다.
- 더 정확한 구조는 `INTERVIEW_IN_PROGRESS`, `INTERVIEW_COMPLETED`, `REPORT_READY`, `MENTORING_IN_PROGRESS`, `MENTORING_COMPLETED`로 분리하는 것이다.
- 데모 최소 수정에서는 새 DB 스키마 없이 기존 세션 상태 + 프론트 polling으로 동기화한다.

### 15.2 멘토 화면 기준

멘토 준비 화면:

- 카메라/마이크 미리보기
- 멘티 자소서/지원 정보
- AI 추천 질문 생성 버튼
- 생성된 추천 질문 목록
- 추천 질문 선택/수정/저장
- 추천 질문은 참고용임을 명확히 보여줌

멘토 면접 진행 화면:

- 화상 영역
- 실제 질문 기록 패널
- `질문 시작` 버튼
- 질문 녹음 중 음성 파동 표시
- `질문 완료` 버튼
- 현재 답변 대상 질문 표시
- AI 추천 질문 패널
- AI 추천 질문 보기/접기 토글
- 실제 질문 기록 목록
- 멘티 답변 대기 중이면 다음 질문 시작 비활성화
- 면접 종료 버튼 표시

멘토가 질문을 끝낸 직후:

- 방금 저장된 질문이 `activeQuestion`이 된다.
- 멘토 화면에는 “멘티 답변 대기 중” 안내가 떠야 한다.
- `질문 시작` 버튼은 비활성화되어야 한다.
- 멘티 답변이 저장되기 전까지 다음 질문을 만들 수 없어야 한다.

멘티 답변이 저장된 직후:

- 해당 질문 id가 answered 상태가 된다.
- 멘토의 `질문 시작` 버튼이 다시 활성화된다.
- 다음 질문을 진행할 수 있다.

### 15.3 멘티 화면 기준

멘티 준비 화면:

- 카메라/마이크 미리보기
- 본인이 제출한 자소서/사전 정보
- 추천 질문은 보이지 않아야 한다.
- 입장 자체는 멘토와 독립적으로 가능해야 한다.

멘티 면접 진행 화면:

- 화상 영역
- 현재 질문 표시
- 질문이 없으면 “멘토 질문 대기 중”
- 질문이 저장되면 `답변 시작` 버튼 활성화
- 답변 중 음성 녹음
- `답변 완료` 클릭 시 답변 오디오 업로드
- 답변 업로드가 성공하면 다음 질문 대기 상태로 돌아감
- 면접 종료 버튼은 보이지 않거나 비활성 안내만 보여야 한다.

멘티가 먼저 입장한 경우:

- `멘토 질문 대기 중` 상태가 정상이다.
- 답변 시작 버튼은 비활성화되어야 한다.
- 멘토가 질문을 저장하면 polling 또는 socket으로 현재 질문이 잡혀야 한다.

멘토가 먼저 입장한 경우:

- 멘티 대시보드에서 `IN_PROGRESS` 세션도 입장 가능 일정으로 보여야 한다.
- 멘티가 뒤늦게 들어와도 기존 active question 또는 DB의 미답변 질문을 받아야 한다.

## 16. 질문-답변 turn 진행 알고리즘

### 16.1 정상 1회 turn

```txt
1. 멘토가 질문 시작 클릭
2. 프론트 MediaRecorder 시작
3. media-server activeRecorder = QUESTION 시도
4. media-server 응답이 없으면 프론트는 로컬 녹음 fallback 시작
5. 멘토가 질문 완료 클릭
6. POST /api/sessions/{id}/questions/audio
7. 백엔드가 질문 오디오 저장
8. 백엔드가 AI 서버 /api/stt 호출
9. STT 성공 시 InterviewQuestion.content 갱신
10. STT 실패 시 질문 record는 남기고 stt_status=FAILED
11. 프론트 activeQuestion = 저장된 질문
12. 멘토 질문 버튼 잠금
13. 멘티 화면 polling/socket으로 activeQuestion 획득
14. 멘티 답변 시작 활성화
15. 멘티 답변 시작 클릭
16. 프론트 MediaRecorder 시작
17. 멘티 답변 완료 클릭
18. POST /api/sessions/{id}/questions/{questionId}/answers
19. 백엔드가 답변 오디오 저장
20. 백엔드가 AI 서버 /api/stt 호출
21. STT 성공 시 InterviewAnswer.sttText 저장
22. STT 실패 시 답변 record는 남기고 stt_status=FAILED
23. 프론트 answeredQuestionIds에 questionId 추가
24. 멘토 화면이 답변 저장을 감지
25. 멘토 질문 버튼 다시 활성화
```

### 16.2 멘토가 계속 질문하려는 경우

기대 동작:

- 방금 질문에 대한 답변이 저장되기 전까지 `질문 시작` 비활성화
- 안내 문구: `멘티 답변을 기다리는 중입니다. 답변 저장 후 다음 질문을 진행하세요.`

깨지는 원인:

- `activeQuestion`은 있는데 `questionButtonDisabled` 조건에 반영되지 않음
- 답변 저장 여부를 프론트가 감지하지 못함
- 답변 업로드 실패 후 lock이 풀리지 않음

확인 요청:

```txt
멘토 질문 완료 후:
- activeQuestion 값이 있는가?
- questionButtonDisabled가 true인가?
- getQuestionAnswers(sessionId, activeQuestion.id)가 주기적으로 호출되는가?
- 답변 저장 후 activeQuestion이 null로 바뀌는가?
```

### 16.3 멘티 답변 버튼이 안 열리는 경우

가능 원인:

- `activeQuestion`이 멘티 화면에 전달되지 않음
- media-server `activeQuestion` broadcast 실패
- DB polling이 실패
- 질문이 추천 질문과 실제 질문으로 잘못 분류됨
- `activeRecorder`가 `QUESTION` 상태로 stale하게 남아서 답변 버튼이 막힘
- 멘티가 해당 session participant가 아니어서 API 접근 실패

확인 순서:

```txt
1. Network: GET /api/sessions/{id}/questions 응답 확인
2. 응답 중 stt_status가 있는 질문이 있는지 확인
3. 멘티 프론트 activeQuestion 값 확인
4. 답변 버튼 disabled 조건 확인
5. activeRecorder 값 확인
6. POST /api/sessions/{id}/questions/{questionId}/answers 호출 여부 확인
```

## 17. 추천 질문과 실제 질문 분리 기준

추천 질문:

- 준비 화면에서 AI가 생성
- 멘토 참고용
- 면접 진행 중 우측 추천 질문 패널에 표시
- 리포트 질문-답변 pair의 질문으로 직접 쓰면 안 됨
- `stt_status`가 없는 질문이면 추천 질문으로 간주 가능

실제 질문:

- 멘토가 면접 중 직접 말함
- 질문 오디오가 저장됨
- STT 결과가 질문 텍스트가 됨
- `stt_status`가 `PENDING/PROCESSING/COMPLETED/FAILED` 중 하나
- 답변 대상 질문이 됨

혼동 방지 규칙:

- 추천 질문 state와 실제 질문 state를 분리한다.
- 추천 질문 목록에 실제 질문을 append하지 않는다.
- 실제 질문 기록 목록에 추천 질문을 표시하지 않는다.
- 준비 화면에서 추천 질문을 저장하지 않고 입장해도 진행 화면에는 캐시 또는 자동 저장으로 보여야 한다.

확인 요청:

```txt
멘토 진행 화면에서:
- AI 추천질문 패널에는 준비 화면에서 추천된 질문만 보이는가?
- 실제 질문 기록에는 멘토가 질문 완료한 항목만 보이는가?
- 질문 완료 후 AI 추천질문 목록이 늘어나지 않는가?
```

## 18. 타이머 동기화 기준

현재 주의할 문제:

- 멘토와 멘티가 서로 다른 시각에 컴포넌트를 mount하면 로컬 `elapsed=0` 기준이 달라진다.
- 그러면 같은 면접인데 멘토/멘티 화면의 record 시간이 다르게 보인다.

권장 기준:

- 타이머 시작 시각은 프론트 로컬 mount 시간이 아니라 백엔드 `InterviewSession.startedAt`이어야 한다.
- 멘토가 면접 시작 또는 준비 화면 입장 시 `PATCH /api/sessions/{id}/status { status: "in_progress" }`를 호출한다.
- 백엔드는 최초 `IN_PROGRESS` 전환 시 `startedAt`을 저장한다.
- 멘토/멘티 화면은 `GET /api/sessions/{id}`의 `started_at`을 기준으로 `elapsed = now - started_at`을 계산한다.
- `started_at`이 없으면 임시로 로컬 mount 시간을 쓰되, 3초 polling으로 `started_at`이 생기면 보정한다.

디버깅 요청:

```txt
InterviewSession.jsx의 타이머가 local mount 기준인지 started_at 기준인지 확인하라.
멘토와 멘티가 30초 차이로 입장해도 같은 elapsed가 보이도록 수정이 필요한지 판단하라.
수정이 필요하면:
1. getSession(id)로 started_at을 가져온다.
2. started_at이 있으면 elapsed를 Date.now() - started_at으로 계산한다.
3. started_at이 없으면 로컬 기준으로 임시 표시한다.
4. 세션 상태가 completed가 되면 타이머를 멈춘다.
```

## 19. 종료/리포트/멘토링 동기화 기준

### 19.1 면접 종료

요구 UX:

- 면접 입장은 자유롭게 한다.
- 면접 종료는 멘토만 누를 수 있다.
- 멘티에게는 종료 버튼이 아니라 “멘토가 종료하면 자동 이동” 안내를 보여준다.
- 멘토가 종료하면 백엔드 세션 상태가 `COMPLETED`가 된다.
- 멘티 면접 화면은 `GET /api/sessions/{id}` polling으로 `COMPLETED`를 감지한다.
- 감지 즉시 `/report/generating/{id}` 또는 실제 리포트 화면으로 이동한다.

확인 요청:

```txt
멘토 종료 클릭 후:
- PATCH /api/sessions/{id}/status {status:"completed"} 성공?
- 멘토는 /report/ai/{id}로 이동?
- 멘티는 3초 이내 /report/generating/{id}로 이동?
- 멘티에게 종료 버튼이 보이지 않는가?
```

### 19.2 리포트 생성

요구 UX:

- 리포트는 더미가 아니라 저장된 질문/답변 기반이어야 한다.
- 질문 1개 이상, 답변 1개 이상이어야 한다.
- 답변 오디오는 다시 듣기 가능해야 한다.
- STT가 실패하면 실패 상태를 표시하거나 수동 확인 fallback을 둔다.

확인 요청:

```txt
리포트 생성 전:
- GET /api/sessions/{id}/questions
- GET /api/sessions/{id}/questions/{questionId}/answers
- GET /api/sessions/{id}/answers/stt-status

리포트 생성:
- POST /api/sessions/{id}/report/generate
- GET /api/sessions/{id}/report
```

### 19.3 멘토링 시작

요구 UX:

- 리포트 생성 후 멘토가 멘토링 시작 버튼을 누른다.
- 멘티가 같은 리포트 화면에 있으면 자동으로 멘토링 세션으로 이동한다.
- 미디어 서버 socket이 아니라 백엔드 상태 polling으로 동기화한다.

권장 구현:

```txt
멘토:
1. /report/ai/{id}에서 멘토링 시작 클릭
2. PATCH /api/sessions/{id}/status {status:"in_progress"} 또는 별도 mentoring 상태 저장
3. /mentoring/mentor/{id} 이동

멘티:
1. /report/ai/{id}에서 GET /api/sessions/{id} polling
2. 멘토링 시작 상태 감지
3. /mentoring/mentee/{id} 자동 이동
```

더 정확한 장기 개선:

- 세션 상태를 면접과 멘토링이 공유하지 않게 분리한다.
- 예: `interviewStatus`, `reportStatus`, `mentoringStatus`
- 또는 `SessionPhase = INTERVIEW_READY / INTERVIEWING / REPORTING / REPORT_READY / MENTORING / FINISHED`

## 20. 모든 경우의 수 점검표

### 20.1 입장 순서

| 경우 | 기대 동작 | 확인 |
|---|---|---|
| 멘토 먼저 입장 | 멘토는 질문 가능, 멘티는 나중에 입장 가능 | 멘티 대시보드에 `IN_PROGRESS`도 입장 가능으로 보이는가 |
| 멘티 먼저 입장 | 멘티는 질문 대기 중, 답변 버튼 비활성 | `activeQuestion` 없음 |
| 둘 다 늦게 입장 | 기존 질문/답변 상태를 DB에서 복구 | GET questions/answers 확인 |
| 멘토 새로고침 | active question 또는 답변 대기 상태 복구 | DB polling 확인 |
| 멘티 새로고침 | 미답변 질문을 다시 잡음 | answeredQuestionIds/answers 확인 |

### 20.2 질문/답변 진행

| 경우 | 기대 동작 | 확인 |
|---|---|---|
| 멘토 질문 시작 | 녹음 시작, 파동 표시 | 버튼 `질문 완료`로 변경 |
| 멘토 질문 완료 | 질문 업로드, 답변 대기 | POST questions/audio |
| 질문 STT 실패 | 질문 record는 남음 | stt_status=FAILED |
| 멘티 답변 시작 | 답변 녹음 시작 | 버튼 `답변 완료` |
| 멘티 답변 완료 | 답변 업로드 | POST answers |
| 답변 STT 실패 | 답변 record와 audioUrl은 남음 | stt_status=FAILED |
| 답변 저장 후 | 멘토 다음 질문 가능 | getQuestionAnswers 감지 |

### 20.3 실패 상황

| 실패 | 유지되어야 하는 것 | fallback |
|---|---|---|
| media-server 연결 실패 | 질문/답변 오디오 저장 | HTTP upload + DB polling |
| recordingStart ack 없음 | 로컬 녹음 시작 | 1.5초 timeout |
| recordingStop ack 없음 | lock 해제 | 1초 timeout |
| AI 서버 STT 실패 | 오디오 저장 | stt_status=FAILED |
| 추천 질문 실패 | 면접 진행 | 멘토 직접 질문 |
| 리포트 생성 실패 | 저장된 질문/답변 조회 | 재시도/수동 확인 |
| 멘티 중간 입장 | 미답변 질문 표시 | DB polling |
| 멘토가 계속 질문 클릭 | 버튼 비활성 | 답변 저장 전 질문 금지 |

## 21. 브라우저/서버 로그 체크 포인트

### 멘토 질문 완료 후

Network:

```txt
POST /api/sessions/{id}/questions/audio
GET /api/sessions/{id}/questions
GET /api/sessions/{id}/questions/{questionId}/answers
```

응답에서 볼 것:

```json
{
  "id": 123,
  "content": "질문 음성 변환 중입니다. 또는 STT 텍스트",
  "stt_status": "COMPLETED 또는 FAILED"
}
```

### 멘티 답변 완료 후

Network:

```txt
POST /api/sessions/{id}/questions/{questionId}/answers
GET /api/sessions/{id}/questions/{questionId}/answers
```

응답에서 볼 것:

```json
{
  "id": 456,
  "question_id": 123,
  "stt_text": "...",
  "stt_status": "COMPLETED 또는 FAILED"
}
```

### 종료 후

Network:

```txt
PATCH /api/sessions/{id}/status {"status":"completed"}
GET /api/sessions/{id}
POST /api/sessions/{id}/report/generate
GET /api/sessions/{id}/report
```

### 서버 로그

백엔드:

- 질문 오디오 S3 업로드 성공/실패
- 답변 오디오 S3 업로드 성공/실패
- AI STT 호출 성공/실패
- 리포트 생성 성공/실패

AI 서버:

- `/api/stt` 요청 수신 여부
- Whisper 모델 로딩 여부
- 오디오 decoding 실패 여부
- `/report` 요청 수신 여부

media-server:

- `join`
- `recordingStart`
- `recordingStop`
- `activeRecorder`
- `activeQuestion`
- transport/producer/consumer 생성
