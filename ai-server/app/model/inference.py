from __future__ import annotations

from functools import cached_property
from typing import Any

from app.core.config import ModelSettings, get_model_settings
from app.model.json_utils import extract_json_object


class ModelUnavailable(RuntimeError):
    pass


class ModelInference:
    """Lazy SFT model adapter.

    Heavy ML dependencies are imported only when AI_MODEL_ENABLED=true. This
    keeps local backend/frontend integration usable without GPU packages.
    """

    def __init__(self, settings: ModelSettings | None = None) -> None:
        self.settings = settings or get_model_settings()

    def generate_json(self, prompt: str) -> dict[str, Any]:
        if not self.settings.enabled:
            raise ModelUnavailable("model inference is disabled")

        raw = self._generate_text(prompt)
        return extract_json_object(raw)

    @cached_property
    def _pipeline(self):
        try:
            import torch
            from peft import PeftModel
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise ModelUnavailable("transformers/peft/torch are not installed") from exc

        tokenizer = AutoTokenizer.from_pretrained(self.settings.base_model)
        model = AutoModelForCausalLM.from_pretrained(
            self.settings.base_model,
            torch_dtype="auto",
            device_map="auto",
        )

        if self.settings.adapter_path:
            model = PeftModel.from_pretrained(model, self.settings.adapter_path)

        return tokenizer, model

    def _generate_text(self, prompt: str) -> str:
        tokenizer, model = self._pipeline
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        generation_options = {
            "max_new_tokens": self.settings.max_new_tokens,
            "do_sample": self.settings.temperature > 0,
            "pad_token_id": tokenizer.eos_token_id,
        }
        if self.settings.temperature > 0:
            generation_options["temperature"] = self.settings.temperature

        output_ids = model.generate(**inputs, **generation_options)
        generated = output_ids[0][inputs["input_ids"].shape[-1] :]
        return tokenizer.decode(generated, skip_special_tokens=True).strip()
