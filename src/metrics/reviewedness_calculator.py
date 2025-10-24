"""Reviewedness metric calculator.

The reviewedness score is a heuristic indicator of how much community feedback
or vetting a model has received.  It leverages lightweight signals such as
likes/downloads on Hugging Face and repository statistics when present.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from .base import MetricCalculator, ModelContext


class ReviewednessCalculator(MetricCalculator):
    """Provide an approximate measure of community review and feedback."""

    def __init__(self) -> None:
        super().__init__("Reviewedness")

    def calculate_score(self, context: ModelContext) -> float:
        start_time = time.perf_counter()

        score = 0.2

        metadata: Dict[str, Any] = {}
        if isinstance(context.huggingface_metadata, dict):
            metadata = context.huggingface_metadata

        likes = 0
        downloads = 0
        if isinstance(metadata, dict):
            likes = int(metadata.get("likes", 0) or 0)
            downloads = int(metadata.get("downloads", 0) or 0)

        score += min(likes / 2500.0, 0.4)
        score += min(downloads / 4_000_000.0, 0.2)

        if isinstance(metadata.get("cardData"), dict) and metadata["cardData"].get("annotations"):
            score += 0.1

        model_info = context.model_info if isinstance(context.model_info, dict) else {}
        stars = int(model_info.get("stars", 0) or 0) if isinstance(model_info, dict) else 0
        score += min(stars / 6000.0, 0.2)

        if isinstance(model_info, dict) and model_info.get("github_metadata"):
            gh_meta = model_info["github_metadata"]
            if isinstance(gh_meta, dict):
                open_issues = int(gh_meta.get("open_issues_count", 0) or 0)
                if open_issues <= 5:
                    score += 0.05

        score = max(0.0, min(1.0, score))

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        self._set_score(score, elapsed_ms)
        return score

