from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO


class SttServiceUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=2)
def _load_model(model_size: str):
    try:
        import whisper
    except ImportError as exc:
        raise SttServiceUnavailable(
            "openai-whisper is not installed. Install ai-server/requirements-model.txt."
        ) from exc

    download_root = os.environ.get("WHISPER_CACHE_DIR")
    return whisper.load_model(model_size, download_root=download_root)


class SttService:
    def __init__(self, model_size: str | None = None):
        self.model_size = model_size or os.environ.get("WHISPER_MODEL_SIZE", "base")

    def transcribe(self, filename: str | None, audio_file: BinaryIO) -> str:
        suffix = Path(filename or "answer.wav").suffix or ".wav"
        temp_path = None

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
                temp.write(audio_file.read())
                temp_path = Path(temp.name)

            model = _load_model(self.model_size)
            result = model.transcribe(str(temp_path))
            return (result.get("text") or "").strip()
        except SttServiceUnavailable:
            raise
        except Exception as exc:
            raise SttServiceUnavailable("STT transcription failed") from exc
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink(missing_ok=True)
