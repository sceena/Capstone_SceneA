흐름은 답변 오디오를 백엔드가 S3에 저장한 다음, AI 서버에 /api/stt/jobs로 answer_id랑 audio_key, callback_url 보내기

AI 서버가 S3에서 오디오 받아서 faster-whisper-medium으로 STT 돌리고, 끝나면 callback_url로 결과 보냄


1. InterviewAnswer에 sttStatus, sttModel, audioQualityStatus, audioQualityMessage, sttErrorMessage, durationSec 정도 추가
2. 답변 업로드 후 sttStatus=PENDING 저장
3. AI 서버 POST /api/stt/jobs 호출
4. /api/internal/stt/callback API 만들어서 결과 받기
5. callback 성공하면 sttText에 text 저장하고 sttStatus=COMPLETED로 변경
6. 실패하면 sttStatus=FAILED, sttErrorMessage 저장

## 1. 백엔드가 AI 서버에 호출할 API

답변 오디오를 S3에 저장한 뒤 호출한다.

```http
POST /api/stt/jobs
```

```json
{
  "answer_id": 123,
  "audio_key": "answers/answer-123.webm",
  "callback_url": "http://localhost:8080/api/internal/stt/callback"
}
```

응답:

```json
{
  "answer_id": 123,
  "status": "ACCEPTED",
  "message": "STT job accepted."
}
```

`ACCEPTED`는 STT 완료가 아니라 작업 등록 성공이다.

## 2. 백엔드가 만들어야 할 callback API

```http
POST /api/internal/stt/callback
```

성공 payload:

```json
{
  "answer_id": 123,
  "status": "COMPLETED",
  "text": "답변 텍스트",
  "model": "faster-whisper-medium",
  "language": "ko",
  "duration_sec": 83,
  "audio_quality_status": "OK",
  "audio_quality_message": null,
  "segments": [
    {
      "start_sec": 0.0,
      "end_sec": 4.2,
      "text": "답변 일부"
    }
  ]
}
```

실패 payload:

```json
{
  "answer_id": 123,
  "status": "FAILED",
  "error_message": "STT 실패 이유"
}
```

## 3. InterviewAnswer 추가 권장 필드

```text
sttStatus: PENDING | PROCESSING | COMPLETED | FAILED
sttModel
audioQualityStatus: OK | WARNING | FAILED
audioQualityMessage
sttErrorMessage
durationSec
```

`sttText`는 기존 필드 사용.

## 4. 백엔드 처리 순서

답변 업로드 시:

```text
1. 오디오 S3 저장
2. InterviewAnswer 저장 또는 갱신
3. sttStatus=PENDING 저장
4. AI 서버 POST /api/stt/jobs 호출
5. 프론트에 바로 응답
```

callback 성공 시:

```text
1. answer_id로 InterviewAnswer 조회
2. sttText = text 저장
3. sttStatus = COMPLETED 저장
4. sttModel, durationSec 저장
5. audioQualityStatus, audioQualityMessage 저장
```

callback 실패 시:

```text
1. answer_id로 InterviewAnswer 조회
2. sttStatus = FAILED 저장
3. sttErrorMessage 저장
```

## 5. 프론트/리포트 응답에 포함할 값

```json
{
  "stt_status": "COMPLETED",
  "stt_text": "답변 텍스트",
  "audio_quality_status": "OK",
  "audio_quality_message": null
}
```
