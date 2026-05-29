# STT Integration Contract

현재 STT 흐름은 AI 서버가 S3를 직접 바라보지 않는 방식이다.

```text
1. 멘티가 답변 오디오 업로드
2. 백엔드가 오디오를 S3/스토리지에 저장하고 InterviewAnswer를 PENDING으로 저장
3. DB 커밋 후 백엔드 비동기 작업 시작
4. 백엔드가 저장된 오디오를 읽어 AI 서버 POST /api/stt에 multipart로 전송
5. AI 서버는 받은 파일만 faster-whisper로 STT 변환
6. 백엔드가 응답을 받아 sttText, sttStatus, sttModel, durationSec, audioQualityStatus를 DB에 저장
```

## AI Server API

```http
POST /api/stt
Content-Type: multipart/form-data
```

Form field:

```text
audio: answer.webm | answer.wav | ...
```

Response:

```json
{
  "text": "답변 텍스트",
  "model": "faster-whisper-small",
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

## Responsibility Boundary

```text
Backend
- 오디오 저장 위치 관리
- S3/스토리지 접근 권한 보유
- 비동기 STT 작업 실행
- STT 결과 DB 저장

AI Server
- 전달받은 오디오 파일 변환
- 오디오 품질 점검
- Whisper STT 수행
- STT 결과 반환
```

AI 서버에는 S3 bucket, access key, callback URL을 설정하지 않는다.
