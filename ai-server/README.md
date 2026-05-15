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
export AI_BASE_MODEL=Qwen/Qwen2.5-7B-Instruct
export AI_ADAPTER_PATH=/path/to/lora_adapter
```

The model boundary lives in:

```text
app/model/inference.py
app/model/prompts.py
app/services/answer_evaluator.py
```

## Smoke Test

```bash
curl -X POST http://localhost:8000/report \
  -H "Content-Type: application/json" \
  --data @examples/report_request.json
```
