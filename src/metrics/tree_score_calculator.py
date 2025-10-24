"""TreeScore metric calculator.

TreeScore approximates how well structured a repository or model card is by
inspecting available metadata.  The heuristic favours projects that expose
rich directory trees (siblings on Hugging Face) and common documentation files.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Iterable

from .base import MetricCalculator, ModelContext


class TreeScoreCalculator(MetricCalculator):
    """Heuristic scoring for repository/tree structure quality."""

    def __init__(self) -> None:
        super().__init__("TreeScore")

    def calculate_score(self, context: ModelContext) -> float:
        start_time = time.perf_counter()

        score = 0.3

        metadata: Dict[str, Any] = {}
        if isinstance(context.huggingface_metadata, dict):
            metadata = context.huggingface_metadata

        siblings = metadata.get("siblings") if isinstance(metadata, dict) else None
        if isinstance(siblings, Iterable):
            sibling_names = [self._get_sibling_name(s) for s in siblings]
            if sibling_names:
                score += min(len(sibling_names) / 20.0, 0.3)
                if any(name.lower().startswith("readme") for name in sibling_names if name):
                    score += 0.1
                if any(name.lower().endswith(('.py', '.ipynb')) for name in sibling_names if name):
                    score += 0.1

        model_info = context.model_info if isinstance(context.model_info, dict) else {}
        if isinstance(model_info, dict):
            if model_info.get("local_repo_path"):
                score += 0.05
            if model_info.get("files") and isinstance(model_info["files"], list):
                score += min(len(model_info["files"]) / 50.0, 0.1)

        if getattr(context, "code_url", None):
            score += 0.05

        score = max(0.0, min(1.0, score))

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        self._set_score(score, elapsed_ms)
        return score

    @staticmethod
    def _get_sibling_name(sibling: Any) -> str:
        if isinstance(sibling, dict):
            return str(sibling.get("rfilename") or sibling.get("filename") or "")
        return str(getattr(sibling, "rfilename", "") or "")

