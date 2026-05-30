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

### 프론트엔드

- 개발 서버: `client`, Vite, 기본 포트 `5173`
- API 프록시: `client/vite.config.js`
- 기본 백엔드 대상: `http://54.116.176.242:8080`
- 기본 미디어 서버 대상: `http://54.116.176.242:4000`
- 로컬 테스트 시 브라우저 접속 예:
  - 같은 PC: `http://localhost:5173`
  - 같은 네트워크 기기: `http://{PC_LAN_IP}:5173`

### 백엔드

- Spring Boot API: `backend`, 기본 포트 `8080`
- 주요 외부 의존성:
  - MySQL
  - S3 또는 S3 호환 스토리지
  - AI 서버 `ai.server.base-url`
- 배포 확인:
  - Swagger: `http://54.116.176.242:8080/swagger-ui/index.html`
  - 백엔드 Docker 로그: `docker logs --tail=100 carpoolink-backend`

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

- 신청 흐름에서 `POST /api/sessions`가 실패해도 예약 신청 자체가 막히면 안 된다.
- 예약 신청의 기준 상태는 `Reservation.status=PENDING`이다.
- 멘토 수락 시 세션이 생성되거나 기존 세션이 확정되어야 한다.

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
- [ ] 멘토 대시보드에 수락 대기 표시
- [ ] 멘토가 수락
- [ ] 멘티 대시보드에 확정 세션 표시

### B. 면접 준비

- [ ] 멘토 준비 화면 접속
- [ ] 멘티 준비 화면 접속
- [ ] 카메라 권한 요청 확인
- [ ] 마이크 권한 요청 확인
- [ ] 로컬 미리보기 표시
- [ ] 상대방 영상 표시
- [ ] 멘토 화면에 추천 질문 표시
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

## 11. 현재 우선순위

1. 신청 흐름이 멈추지 않게 만들기
2. 멘토 수락 후 세션이 확정되어 준비 화면에 들어가게 만들기
3. 카메라/마이크 미리보기 안정화
4. 역할별 준비 화면 분리: 멘토는 추천 질문/멘티 자료, 멘티는 본인 자료만 표시
5. 면접 중 질문/답변 버튼과 오디오 저장 안정화
6. 동시 녹음 방지 lock과 현재 발화자 표시
7. Whisper STT 성공/실패 상태 저장
8. IT 용어 STT 보정 또는 수동 수정 fallback
9. 질문-답변 pair 정확성 보장
10. 실제 데이터 기반 리포트 생성과 Fit-Gap 표시
11. 답변 다시 듣기
12. 멘토 수정본 저장
13. DPO JSONL export 확인

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
