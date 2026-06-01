from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO

os.environ.setdefault("USE_SFT", "false")
os.environ.setdefault("WHISPER_MODEL_SIZE", "medium")
os.environ.setdefault("WHISPER_DEVICE", "cuda")
os.environ.setdefault("WHISPER_COMPUTE_TYPE", "float16")
os.environ.setdefault("QUESTION_GENERATION_TIMEOUT_SEC", "60")
os.environ.setdefault("QUESTION_GENERATION_MAX_RETRIES", "1")


def _print_whisper_runtime_config() -> None:
    try:
        import torch
        cuda_available = torch.cuda.is_available()
    except Exception:
        cuda_available = False

    print("cuda:", cuda_available)
    print("model:", os.environ["WHISPER_MODEL_SIZE"])
    print("device:", os.environ["WHISPER_DEVICE"])
    print("compute:", os.environ["WHISPER_COMPUTE_TYPE"])


_print_whisper_runtime_config()


TECH_INTERVIEW_INITIAL_PROMPT = """
이 음성은 한국어 개발자 기술 면접 대화입니다. 면접관이 질문하고 지원자가 답변합니다.
한국어 문장 안에 영어 기술 용어, 약어, 프레임워크명, 데이터베이스명, 클라우드 서비스명, 회사명, 직무명이 자주 섞여 나옵니다.
기술 용어는 가능한 한 표준 표기로 인식합니다.

자주 등장하는 기술 용어:
Spring, Spring Boot, Spring MVC, Spring Security, Spring Batch, JPA, Hibernate, QueryDSL, MyBatis, JDBC,
Java, Kotlin, Python, JavaScript, TypeScript, Node.js, React, Vue, Next.js, Express, NestJS,
REST API, GraphQL, WebSocket, gRPC, JSON, JWT, OAuth, OAuth2, SSO, CORS,
MySQL, PostgreSQL, MariaDB, MongoDB, Redis, Elasticsearch, OpenSearch, DynamoDB, Oracle, MSSQL,
RDBMS, NoSQL, SQL, DDL, DML, ERD, ORM, ACID, 트랜잭션, 인덱스, 정규화, 반정규화, 조인, 락, 데드락,
쿼리 튜닝, 실행 계획, 커넥션 풀, N+1 문제, 캐시, 캐싱, 세션, 쿠키,
AWS, EC2, S3, RDS, Lambda, ECS, EKS, CloudFront, Route 53, IAM, VPC, IDC,
Docker, Kubernetes, Jenkins, GitHub Actions, CI/CD, Nginx, Apache, Linux,
MSA, 모놀리식, 마이크로서비스, 이벤트 드리븐, Kafka, RabbitMQ, 메시지 큐,
TDD, DDD, 클린 아키텍처, 헥사고날 아키텍처, MVC, MVVM,
Git, GitHub, GitLab, Jira, Notion, Slack,
성능 개선, 장애 대응, 모니터링, 로깅, 알림, 배포, 롤백, 테스트 코드, 단위 테스트, 통합 테스트,
백엔드, 프론트엔드, 풀스택, 데이터 엔지니어, DevOps, 인프라, 서버 개발, DB 개발, 플랫폼 개발.

DB 개발 및 운영 면접에서 자주 등장하는 표현:
MSSQL, MySQL, MongoDB, ERD 설계, 예약, 결제, 쿠폰, 무인화 서비스, 빌링, 회원 DB,
쿼리 성능 개선, 쿼리 튜닝, AWS, IDC DB 서버 운영, 데이터베이스 신규 개발, 운영 유지보수.

자주 나오는 답변 표현:
제가 맡았던 역할은, 문제를 해결하기 위해, 성능을 개선했습니다, 병목을 분석했습니다, 쿼리를 튜닝했습니다,
트랜잭션 범위를 조정했습니다, 인덱스를 추가했습니다, 장애 원인을 분석했습니다, 로그를 확인했습니다,
협업 과정에서, 코드 리뷰를 통해, 테스트 코드를 작성했습니다, 배포 자동화를 구축했습니다.
""".strip()


def _build_initial_prompt() -> str:
    extra_terms = os.environ.get("WHISPER_INITIAL_PROMPT_EXTRA", "").strip()
    if not extra_terms:
        return TECH_INTERVIEW_INITIAL_PROMPT
    return f"{TECH_INTERVIEW_INITIAL_PROMPT}\n\n추가 채용공고/면접 키워드:\n{extra_terms}"


class SttServiceUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class SttSegmentResult:
    start_sec: float
    end_sec: float
    text: str


@dataclass(frozen=True)
class SttResult:
    text: str
    model: str
    language: str | None
    duration_sec: int | None
    audio_quality_status: str
    audio_quality_message: str | None
    segments: list[SttSegmentResult]


@lru_cache(maxsize=2)
def _load_model(model_size: str, device: str, compute_type: str):
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise SttServiceUnavailable(
            "faster-whisper is not installed. Install ai-server/requirements-model.txt."
        ) from exc

    download_root = os.environ.get("WHISPER_CACHE_DIR")
    return WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
        download_root=download_root,
    )


class SttService:
    def __init__(self, model_size: str | None = None):
        self.model_size = model_size or os.environ.get("WHISPER_MODEL_SIZE", "medium")
        self.device = os.environ.get("WHISPER_DEVICE", "cuda")
        self.compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "float16")

    def transcribe(self, filename: str | None, audio_file: BinaryIO) -> SttResult:
        suffix = Path(filename or "answer.wav").suffix or ".wav"
        temp_path = None

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
                temp.write(audio_file.read())
                temp_path = Path(temp.name)

            return self.transcribe_path(temp_path)
        except SttServiceUnavailable:
            raise
        except Exception as exc:
            raise SttServiceUnavailable("STT transcription failed") from exc
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink(missing_ok=True)

    def transcribe_path(self, audio_path: Path) -> SttResult:
        with tempfile.TemporaryDirectory() as temp_dir:
            wav_path = Path(temp_dir) / "normalized.wav"
            self._convert_to_wav(audio_path, wav_path)

            quality_status, quality_message, measured_duration = self._inspect_audio(wav_path)
            if quality_status == "FAILED":
                raise SttServiceUnavailable(quality_message or "Audio quality check failed")

            model = _load_model(self.model_size, self.device, self.compute_type)
            segments, info = model.transcribe(
                str(wav_path),
                language="ko",
                task="transcribe",
                initial_prompt=_build_initial_prompt(),
                beam_size=5,
                temperature=0,
                vad_filter=True,
                condition_on_previous_text=False,
            )

            segment_results: list[SttSegmentResult] = []
            text_parts: list[str] = []
            for segment in segments:
                text = segment.text.strip()
                if not text:
                    continue
                text_parts.append(text)
                segment_results.append(
                    SttSegmentResult(
                        start_sec=round(float(segment.start), 2),
                        end_sec=round(float(segment.end), 2),
                        text=text,
                    )
                )

            duration = getattr(info, "duration", None) or measured_duration
            duration_sec = int(round(duration)) if duration is not None else None

            return SttResult(
                text=" ".join(text_parts).strip(),
                model=f"faster-whisper-{self.model_size}",
                language=getattr(info, "language", None),
                duration_sec=duration_sec,
                audio_quality_status=quality_status,
                audio_quality_message=quality_message,
                segments=segment_results,
            )

    def process_s3_job(
        self,
        answer_id: int | None,
        question_id: int | None,
        audio_key: str,
        callback_url: str,
        bucket: str | None = None,
    ) -> None:
        id_payload = {"answer_id": answer_id} if answer_id is not None else {"question_id": question_id}
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                local_path = self._download_s3_audio(audio_key, Path(temp_dir), bucket)
                result = self.transcribe_path(local_path)
            self._send_callback(
                callback_url,
                {
                    **id_payload,
                    "status": "COMPLETED",
                    "text": result.text,
                    "model": result.model,
                    "language": result.language,
                    "duration_sec": result.duration_sec,
                    "audio_quality_status": result.audio_quality_status,
                    "audio_quality_message": result.audio_quality_message,
                    "segments": [segment.__dict__ for segment in result.segments],
                },
            )
        except Exception as exc:
            self._send_callback(
                callback_url,
                {
                    **id_payload,
                    "status": "FAILED",
                    "error_message": str(exc),
                },
            )

    def _convert_to_wav(self, audio_path: Path, wav_path: Path) -> None:
        self._run_command(
            [
                "ffmpeg",
                "-nostdin",
                "-y",
                "-i",
                str(audio_path),
                "-ac",
                "1",
                "-ar",
                "16000",
                str(wav_path),
            ],
            "ffmpeg audio normalization failed",
        )

    def _inspect_audio(self, wav_path: Path) -> tuple[str, str | None, float | None]:
        duration = self._probe_duration(wav_path)
        if duration is not None and duration < 1.0:
            return "FAILED", "Audio is too short to transcribe.", duration

        mean_volume, max_volume = self._probe_volume(wav_path)
        warnings: list[str] = []

        if duration is not None and duration > 300:
            warnings.append("Audio is longer than the recommended 5 minute answer limit.")
        if mean_volume is not None and mean_volume < -45:
            warnings.append("Voice volume is low, so some words may be inaccurate.")
        if max_volume is not None and max_volume > -1:
            warnings.append("Audio may be clipped because the input volume is too high.")

        if warnings:
            return "WARNING", " ".join(warnings), duration
        return "OK", None, duration

    def _probe_duration(self, wav_path: Path) -> float | None:
        try:
            completed = self._run_command(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(wav_path),
                ],
                "ffprobe duration check failed",
            )
            return float(completed.stdout.strip())
        except Exception:
            return None

    def _probe_volume(self, wav_path: Path) -> tuple[float | None, float | None]:
        try:
            completed = self._run_command(
                [
                    "ffmpeg",
                    "-nostdin",
                    "-i",
                    str(wav_path),
                    "-af",
                    "volumedetect",
                    "-f",
                    "null",
                    "-",
                ],
                "ffmpeg volume check failed",
            )
        except Exception:
            return None, None

        output = completed.stderr
        mean_match = re.search(r"mean_volume:\s*(-?\d+(?:\.\d+)?) dB", output)
        max_match = re.search(r"max_volume:\s*(-?\d+(?:\.\d+)?) dB", output)
        mean_volume = float(mean_match.group(1)) if mean_match else None
        max_volume = float(max_match.group(1)) if max_match else None
        return mean_volume, max_volume

    def _download_s3_audio(self, audio_key: str, temp_dir: Path, bucket: str | None) -> Path:
        try:
            import boto3
        except ImportError as exc:
            raise SttServiceUnavailable(
                "boto3 is not installed. Install ai-server/requirements-model.txt."
            ) from exc

        bucket_name, key = self._resolve_s3_location(audio_key, bucket)
        suffix = Path(key).suffix or ".audio"
        local_path = temp_dir / f"answer{suffix}"

        client_kwargs = {}
        endpoint_url = os.environ.get("AWS_S3_ENDPOINT_URL") or os.environ.get("S3_ENDPOINT_URL")
        region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
        access_key = os.environ.get("AWS_ACCESS_KEY_ID") or os.environ.get("AWS_ACCESS_KEY")
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY") or os.environ.get("AWS_SECRET_KEY")

        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url
        if region:
            client_kwargs["region_name"] = region
        if access_key and secret_key:
            client_kwargs["aws_access_key_id"] = access_key
            client_kwargs["aws_secret_access_key"] = secret_key

        s3_client = boto3.client("s3", **client_kwargs)
        s3_client.download_file(bucket_name, key, str(local_path))
        return local_path

    def _resolve_s3_location(self, audio_key: str, bucket: str | None) -> tuple[str, str]:
        if audio_key.startswith("s3://"):
            without_scheme = audio_key.removeprefix("s3://")
            bucket_name, _, key = without_scheme.partition("/")
            if not bucket_name or not key:
                raise SttServiceUnavailable("Invalid s3 audio_key.")
            return bucket_name, key

        bucket_name = bucket or os.environ.get("AWS_S3_BUCKET") or os.environ.get("S3_BUCKET")
        if not bucket_name:
            raise SttServiceUnavailable("S3 bucket is not configured for STT job processing.")
        return bucket_name, audio_key

    def _send_callback(self, callback_url: str, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            callback_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                if response.status >= 400:
                    raise SttServiceUnavailable(f"Callback failed with status {response.status}")
        except urllib.error.URLError as exc:
            raise SttServiceUnavailable(f"Callback request failed: {exc}") from exc

    def _run_command(self, command: list[str], message: str) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError as exc:
            raise SttServiceUnavailable("ffmpeg and ffprobe must be installed on the AI server.") from exc
        except subprocess.CalledProcessError as exc:
            detail = exc.stderr.strip() or exc.stdout.strip()
            raise SttServiceUnavailable(f"{message}: {detail}") from exc
