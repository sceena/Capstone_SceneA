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

## Smoke Test

```bash
curl -X POST http://localhost:8000/report \
  -H "Content-Type: application/json" \
  --data @examples/report_request.json
```
