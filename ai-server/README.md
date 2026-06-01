# SceneA AI Server

FastAPI server for report generation.

## Run

```bash
cd ai-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```
cd ai-server
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Backend default:

```properties
ai.server.base-url=http://localhost:8000
```

## STT

Answer audio STT uses faster-whisper. The legacy multipart endpoint is still
available through `POST /api/stt`, and backend-integrated async processing uses
`POST /api/stt/jobs`.

```bash
pip install -r requirements-model.txt
export USE_SFT=false
export WHISPER_MODEL_SIZE=medium
export WHISPER_DEVICE=cuda
export WHISPER_COMPUTE_TYPE=float16
export QUESTION_GENERATION_TIMEOUT_SEC=60
export QUESTION_GENERATION_MAX_RETRIES=1
export STT_WORKER_COUNT=1
```

`ffmpeg` and `ffprobe` must be installed on the AI server because uploaded
audio is normalized to 16 kHz mono WAV before transcription.

Runtime check:

```python
import os, torch

os.environ["USE_SFT"] = "false"
os.environ["WHISPER_MODEL_SIZE"] = "medium"
os.environ["WHISPER_DEVICE"] = "cuda"
os.environ["WHISPER_COMPUTE_TYPE"] = "float16"
os.environ["QUESTION_GENERATION_TIMEOUT_SEC"] = "60"
os.environ["QUESTION_GENERATION_MAX_RETRIES"] = "1"

print("cuda:", torch.cuda.is_available())
print("model:", os.environ["WHISPER_MODEL_SIZE"])
print("device:", os.environ["WHISPER_DEVICE"])
print("compute:", os.environ["WHISPER_COMPUTE_TYPE"])
```

Async STT job request:

```http
POST /api/stt/jobs
```

```json
{
  "answer_id": 123,
  "audio_key": "answers/session-1/question-3.webm",
  "callback_url": "http://localhost:8080/api/internal/stt/callback"
}
```

The AI server downloads the audio from S3, checks basic audio quality, runs
`faster-whisper-medium`, and posts the result to the callback URL:

```json
{
  "answer_id": 123,
  "status": "COMPLETED",
  "text": "답변 내용...",
  "model": "faster-whisper-medium",
  "language": "ko",
  "duration_sec": 83,
  "audio_quality_status": "OK",
  "audio_quality_message": null,
  "segments": [
    {
      "start_sec": 0.0,
      "end_sec": 4.2,
      "text": "답변 내용..."
    }
  ]
}
```

For S3 job processing, set the same bucket/credential environment values used by
the backend:

```bash
export AWS_S3_BUCKET=your-bucket
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=ap-northeast-2
```

## Endpoint

```http
POST /report
```

The response shape matches the backend `AiReportResponse` DTO:

- top summary: best/worst question
- fit-gap summary
- question reports
- replay metadata

The current generator is input-driven and deterministic. Replace
`app/services/report_generator.py` internals with SFT model inference later
while keeping the same request/response schema.

## Model Inference

The server is split into two report stages:

```text
AnswerEvaluator
  question + answer + context -> score, strengths, improvements, STAR

ReportComposer
  answer evaluations + metrics + job posting -> best/worst, fit-gap, recommendations
```

By default, model inference is disabled and the deterministic evaluator is used.
To enable SFT inference later:

```bash
export AI_MODEL_ENABLED=true
export AI_MODEL_REQUIRED=true
export AI_BASE_MODEL=Qwen/Qwen2.5-7B-Instruct
export AI_ADAPTER_PATH=/content/drive/MyDrive/AI/models/lora_adapters/qwen2_5_7b_sft_debiased
export AI_PROMPT_FORMAT=plain
export AI_LOAD_IN_4BIT=true
export AI_OFFLOAD_DIR=/content/model_offload
```

The model boundary lives in:

```text
app/model/inference.py
app/model/prompts.py
app/services/answer_evaluator.py
```

Install model dependencies only in a GPU runtime:

```bash
pip install -r requirements-model.txt
```

GPU 환경에서 SFT 모델이 실제로 하단 질문별 평가를 생성하는지 먼저 확인한다.
이 테스트는 모든 `question_reports`의 `evaluation_source`가 `sft`인지 검사한다.

```bash
cd ai-server
pip install -r requirements-model.txt

export AI_MODEL_ENABLED=true
export AI_MODEL_REQUIRED=true
export AI_BASE_MODEL=Qwen/Qwen2.5-7B-Instruct
export AI_ADAPTER_PATH=/content/drive/MyDrive/AI/models/lora_adapters/qwen2_5_7b_sft_debiased
export AI_PROMPT_FORMAT=plain
export AI_LOAD_IN_4BIT=true
export AI_OFFLOAD_DIR=/content/model_offload

python scripts/smoke_model_report.py
```

성공하면 질문별로 `score`, `reasoning`, `strengths`, `improvements`,
`evaluation_source=sft`가 출력된다. 실패하면 fallback으로 숨기지 않고
즉시 에러가 나야 한다.

The current SFT adapter was trained to output exactly:

```json
{
  "reasoning": "점수 판단 이유",
  "overall_score": 7,
  "strengths": ["장점 1", "장점 2"],
  "improvements": ["개선점 1", "개선점 2"]
}
```

Do not ask this SFT adapter to emit `star_structure`. STAR, fit-gap, and
speech-metric interpretation are handled outside the answer-scoring model.

Use `AI_PROMPT_FORMAT=plain` when matching the current training prompt exactly.
Use `AI_PROMPT_FORMAT=chat` only if the training/evaluation script used the
tokenizer chat template for Qwen.

When `AI_MODEL_REQUIRED=true`, model loading, JSON parsing, or schema validation
errors are not silently replaced by the fallback evaluator. Use this for
GPU/server validation before connecting the real model to the backend.

Frontend origins are configured with:

```bash
export AI_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Best/worst selection uses speech metrics plus answer-structure analysis.
Fit-gap can use the Gemini-based composer and falls back to the existing
keyword-based path when needed.

## Report Generation Plan

보고서는 두 단계로 생성한다. 1단계는 질문별 답변 평가이고, 2단계는
전체 리포트 구성이다. 질문별 평가는 학습된 SFT 모델이 담당하고,
전체 리포트는 질문별 평가 결과와 정량 지표, 채용공고 정보를 조합해
생성한다.

질문별 평가는 `question + answer`를 입력으로 사용한다. SFT 모델은
학습된 출력 스키마에 맞춰 `reasoning`, `overall_score`, `strengths`,
`improvements`만 생성한다. `STAR 구조`, 말하기 속도, 침묵, 문장 간결성은
SFT 모델에게 직접 요구하지 않고 서버 내부의 별도 판단 로직이나 백엔드에서
전달된 정량 지표를 사용한다. 이렇게 분리하는 이유는 현재 SFT 모델이
STAR/Fit-Gap까지 학습하지 않았기 때문이다.

상단 요약은 질문/답변 오디오 분석 결과를 기반으로 best 문항과 worst 문항을
고른다. 질문 오디오는 STT만 수행하고, 답변 오디오는 STT와 함께 CPM,
3초 이상 침묵 횟수, 문장 간결성을 계산한다. LLM은 best/worst를 직접 고르지
않고 질문 유형과 답변 구조 요소가 있는지만 판단한다. 최종 선정은 서버의
`selection_score`와 동점 처리 기준으로 계산한다.

메인 `/report` 생성 흐름에서는 백엔드가 전달한 STT 텍스트와 metrics를 사용한다.
`ReportComposer`가 `TopSummaryComposer`를 호출해 질문 유형별 답변 구조를 분석하고,
질문별 평가 점수와 정량 지표를 함께 반영해 `top_summary`를 만든다.
오디오 파일을 직접 읽는 `audio_dashboard.py` 파이프라인은 별도 검증용으로 남아 있다.

질문 유형이 경험형이면 STAR 구조를 사용한다. 즉 Situation, Task, Action,
Result가 답변에 드러나는지 확인한다. 다만 모든 질문에 STAR를 강제하지는
않고, 의견형 질문은 주장/근거/예시, 상황형 질문은 상황 이해/행동 계획/근거처럼
질문 유형에 맞는 구조 요소를 본다.

중단의 Fit-Gap은 관심 기업 또는 희망 회사의 채용공고를 기준으로 만든다.
현재는 Gemini 기반 LLM composer가 `job_description`, `resume_summary`,
`interview_session`을
입력으로 받아 `fit_analysis`, `gap_analysis`, `improvement_suggestions`,
`overall_summary`를 JSON으로 생성한다. 별도 테스트 엔드포인트는
`POST /api/fit-gap`이다.
여기서 `resume_summary`는 별도 LLM 요약 결과라고 가정하지 않고, 백엔드의
`resume.content`에서 넘어온 지원자 제출 문서 텍스트 일부로 다룬다.

Fit-Gap LLM composer를 사용하려면 `GEMINI_API_KEY`를 환경 변수로 설정해야 한다.
실제 API 키는 커밋하지 않는다. LLM 호출이나 JSON 파싱이 실패하는 경우에는
기존 키워드 기반 Fit-Gap 경로를 fallback으로 사용할 수 있다.

하단의 질문별 상세 카드는 1단계 평가 결과를 그대로 보여준다. 각 카드에는
질문, 답변, 점수, 장점, 개선점, 다시듣기 정보를 포함한다. 다시듣기는
백엔드에서 전달한 오디오 URL과 답변 시작/종료 시간을 사용한다.

최종 목표는 질문별 평가는 SFT 모델로 안정화하고, 전체 리포트 문장화와
Fit-Gap은 별도 composer로 분리하는 것이다. 한 모델에 모든 출력을 강제로
맡기기보다, 학습된 역할과 프롬프트 기반 역할을 나누는 방식이 출력 안정성과
확장성에 더 적합하다.

백엔드/음성 분석
- duration_sec
- speaking_speed
- silence
- audio_url
- answer_start
- answer_end

AI 서버
- SFT로 질문별 답변 점수/장점/개선점 생성
- sentence_clarity 보완 판단
- 질문 유형별 답변 구조 보완 판단(STAR 포함)
- best/worst 선정
- Fit-Gap 생성


상단: Best/Worst 문항 + 정량 요약

상단은 ReportComposer에서 질문별 평가 결과들을 모아서 만든다.
사용 정보는 질문별 score, metrics_summary, highlight_reason이야.

현재 best/worst 선정은 단순 점수만 보지 않고:

말하기 정량 지표 + 질문 유형별 답변 구조
를 같이 본다.

score, strengths, improvements, reasoning은 모델을 켜면 SFT 모델 결과를 사용
모델을 끄면 fallback 규칙 기반 평가를 사용

질문 오디오는 STT만 수행하고, 답변 오디오는 STT와 함께 CPM, 3초 이상 침묵 횟수,
문장 간결성을 계산한다. LLM은 질문 유형과 답변 구조 요소가 있는지만 판단한다.
경험형 질문은 STAR(Situation, Task, Action, Result)를 기준으로 보고, 의견형이나
상황형 질문은 각각의 질문 유형에 맞는 구조 요소를 사용한다.

정량 지표 + LLM 구조 판단 + 서버의 `selection_score`
를 조합한다. `selection_score`는 best/worst 선정을 위한 내부 값이라 사용자 화면에 그대로 보여줄 필요는 없다.
메인 `/report` 응답에서는 `report.ai_report.top_summary`로 내려가며, LLM 구조 판단이 실패하면 기존 점수 기반 선정으로 fallback한다.

중단: 채용공고 Fit-Gap

중단은 Gemini 기반 LLM composer로 Fit-Gap을 생성한다.

사용 정보는:
채용공고
지원자 제출 문서
전체 면접 답변
LLM composer는 채용공고의 요구사항을 지원자 제출 문서와 전체 면접 답변에서 확인되는 근거와 비교해서 fit_analysis, gap_analysis, improvement_suggestions, overall_summary를 만든다.
지원자 제출 문서는 이력서, 자기소개서, 포트폴리오 요약 또는 그 일부일 수 있다.

별도 테스트 엔드포인트는 `POST /api/fit-gap`이다.
실제 API 키는 커밋하지 말고 `GEMINI_API_KEY` 환경 변수로만 설정한다.

그래서 중단은 현재:

Gemini LLM composer O
JSON 파싱 후 백엔드가 바로 사용할 수 있는 구조로 반환
실패 시 기존 키워드 기반 Fit-Gap fallback 가능

하단: 질문별 상세 카드

하단은 질문별 평가 결과를 그대로 보여주는 부분이야.

사용 정보는:

질문
답변
점수
장점
개선점
다시듣기 정보
여기서 점수, 장점, 개선점은 모델을 켜면 SFT 모델이 생성한다.
모델을 끄면 AI 서버의 fallback 규칙 기반 평가가 만든다.

다시듣기는 AI가 만드는 게 아니라 백엔드에서 넘어온:

audio_url
answer_start
answer_end
를 그대로 사용한다.


## Smoke Test

```bash
curl -X POST http://localhost:8000/report \
  -H "Content-Type: application/json" \
  --data @examples/report_request.json
```
