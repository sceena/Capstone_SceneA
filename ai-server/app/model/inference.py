from __future__ import annotations

import logging
from threading import Lock
from typing import Any

from app.core.config import ModelSettings, get_model_settings
from app.model.json_utils import extract_json_object
from app.model.prompts import ModelPrompt

logger = logging.getLogger(__name__)


class ModelUnavailable(RuntimeError):
    pass


class ModelInference:
    """Lazy SFT model adapter.

    Heavy ML dependencies are imported only when AI_MODEL_ENABLED=true. This
    keeps local backend/frontend integration usable without GPU packages.
    """

    def __init__(self, settings: ModelSettings | None = None) -> None:
        self.settings = settings or get_model_settings()
        self._pipeline_cache = None
        self._pipeline_lock = Lock()

    def generate_json(self, prompt: ModelPrompt | str) -> dict[str, Any]:
        if not self.settings.enabled:
            raise ModelUnavailable("model inference is disabled")

        raw = self._generate_text(prompt)
        return extract_json_object(raw)

    @property
    def _pipeline(self):
        if self._pipeline_cache is None:
            with self._pipeline_lock:
                if self._pipeline_cache is None:
                    self._pipeline_cache = self._load_pipeline()
        return self._pipeline_cache

    def _load_pipeline(self):
        try:
            import torch
            from peft import PeftModel
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise ModelUnavailable("transformers/peft/torch are not installed") from exc

        logger.info("loading base model: %s", self.settings.base_model)
        tokenizer = AutoTokenizer.from_pretrained(self.settings.base_model)
        model = AutoModelForCausalLM.from_pretrained(
            self.settings.base_model,
            torch_dtype="auto",
            device_map="auto",
        )

        if self.settings.adapter_path:
            logger.info("loading LoRA adapter: %s", self.settings.adapter_path)
            model = PeftModel.from_pretrained(model, self.settings.adapter_path)

        model.eval()
        return tokenizer, model

    def _generate_text(self, prompt: ModelPrompt | str) -> str:
        import torch

        tokenizer, model = self._pipeline
        prompt_text = self._format_prompt(tokenizer, prompt)
        inputs = tokenizer(prompt_text, return_tensors="pt")
        inputs = self._move_inputs_to_model_device(inputs, model)

        generation_options = {
            "max_new_tokens": self.settings.max_new_tokens,
            "do_sample": self.settings.temperature > 0,
            "pad_token_id": tokenizer.eos_token_id,
        }
        if self.settings.temperature > 0:
            generation_options["temperature"] = self.settings.temperature

        with torch.inference_mode():
            output_ids = model.generate(**inputs, **generation_options)

        generated = output_ids[0][inputs["input_ids"].shape[-1] :]
        return tokenizer.decode(generated, skip_special_tokens=True).strip()

    def _format_prompt(self, tokenizer, prompt: ModelPrompt | str) -> str:
        if isinstance(prompt, str):
            return prompt

        if self.settings.prompt_format == "chat":
            if not getattr(tokenizer, "chat_template", None):
                raise ModelUnavailable("tokenizer does not provide a chat template")
            return tokenizer.apply_chat_template(
                prompt.messages,
                tokenize=False,
                add_generation_prompt=True,
            )

        return prompt.plain_text

    def _move_inputs_to_model_device(self, inputs, model):
        device = getattr(model, "device", None)
        if device is None:
            return inputs
        return inputs.to(device)
