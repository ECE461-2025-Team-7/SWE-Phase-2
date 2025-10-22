"""Reproducibility metric calculator.

This calculator provides a lightweight heuristic for estimating how easily a
model can be reproduced based on the available context.  It considers whether
code and datasets are provided as well as a few common Hugging Face metadata
fields that typically document training and evaluation procedures.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from .base import MetricCalculator, ModelContext


class ReproducibilityCalculator(MetricCalculator):
    """Estimate how reproducible a model is from the supplied context."""

    def __init__(self) -> None:
        super().__init__("Reproducibility")

    def calculate_score(self, context: ModelContext) -> float:
        start_time = time.perf_counter()

        score = 0.4

        if getattr(context, "code_url", None):
            score += 0.2

        if getattr(context, "dataset_url", None):
            score += 0.2

        metadata: Dict[str, Any] = {}
        if isinstance(context.huggingface_metadata, dict):
            metadata = context.huggingface_metadata

        card_data = metadata.get("cardData") if isinstance(metadata, dict) else None
        if isinstance(card_data, dict):
            if card_data.get("training") or card_data.get("evaluation"):
                score += 0.1
            if card_data.get("datasets") or card_data.get("library_name"):
                score += 0.05

        model_index = metadata.get("model_index") if isinstance(metadata, dict) else None
        if model_index:
            score += 0.05

        score = max(0.0, min(1.0, score))

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        self._set_score(score, elapsed_ms)
        return score

