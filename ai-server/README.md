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

Best/worst selection uses answer score plus speech metrics and STAR structure.
Fit-gap is still keyword based; the next quality step is replacing
`ReportComposer._build_fit_gap` with a model-based composer.

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

상단 요약은 질문별 평가 결과를 기반으로 best 문항과 worst 문항을 고른다.
선정 기준은 점수 단독이 아니라 `답변 점수 + 말하기 정량 지표 + STAR 구조`를
함께 본다. 점수는 답변 내용의 품질을 보고, 정량 지표는 말하기 속도와 침묵,
문장 간결성을 보고, STAR 구조는 상황, 행동, 결과가 드러나는지를 본다.

중단의 Fit-Gap은 관심 기업 또는 희망 회사의 채용공고를 기준으로 만든다.
현재는 채용공고 요약에서 주요 요구 키워드를 추출하고, 이력서 요약과 면접
답변 전체에서 해당 요구사항의 근거가 있는지 비교한다. 근거가 있으면
`충족한 요구사항`, 부족하면 `부족한 요구사항`으로 분류하고, 부족한 항목을
기준으로 추천 보완 방향을 생성한다.

현재 Fit-Gap은 키워드 기반이라 문맥 이해에는 한계가 있다. 예를 들어
공고의 "대용량 트래픽 처리"와 답변의 "Redis 캐싱으로 응답 시간 개선"처럼
의미상 연결되는 내용은 단순 키워드 방식으로 놓칠 수 있다. 따라서 실제
모델 연동이 안정되면 Fit-Gap은 별도 LLM composer로 확장한다. 이 composer는
채용공고, 이력서 요약, 질문별 평가 결과, 답변 전체를 입력으로 받아
충족 요구사항, 부족 요구사항, 추천 보완 방향을 문맥 기반으로 생성한다.

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
- STAR 구조 보완 판단
- best/worst 선정
- Fit-Gap 생성


상단: Best/Worst 문항 + 정량 요약

상단은 ReportComposer에서 질문별 평가 결과들을 모아서 만든다.
사용 정보는 질문별 score, metrics_summary, highlight_reason이야.

현재 best/worst 선정은 단순 점수만 보지 않고:

답변 점수 + 말하기 정량 지표 + STAR 구조
를 같이 본다.

score, strengths, improvements, reasoning은 모델을 켜면 SFT 모델 결과를 사용
모델을 끄면 fallback 규칙 기반 평가를 사용

말하기 속도, 침묵은 백엔드가 넘겨주는 값이 있으면 그 값을 쓰고 없으면 "미측정"
문장 간결성, STAR 구조는 백엔드 값이 있으면 쓰고 없으면 AI 서버의 간단한 규칙 기반 로직으로 판단한다.

SFT 모델 평가 결과 + 백엔드 정량 지표 + AI 서버 규칙 기반 STAR/간결성
을 조합

중단: 채용공고 Fit-Gap

중단은 아직 AI 모델 기반이 아니고 키워드 기반이야.

사용 정보는:
채용공고 요약
이력서 요약
전체 면접 답변
현재는 채용공고 요약에서 Java, Spring, JPA, Redis, AWS, 협업, 성능, 테스트 같은 미리 정의된 키워드를 찾고, 그 키워드가 이력서나 답변에 있는지 비교한다.

있으면:충족한 요구사항
없으면:부족한 요구사항
으로 분류하고, 부족한 키워드에 대해 추천 보완 방향을 만든다.

그래서 중단은 현재:

AI 모델 X
키워드 기반 O
형식은 리포트 구조에 맞게 생성
인 상태야. 품질을 높이려면 다음 단계에서 이 부분을 LLM composer로 바꾸는 게 맞아.

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
