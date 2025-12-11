import json
import os
from typing import Any, Dict, Iterable, List, Optional

# Reuse the Phase 2 core pipeline without changing its public CLI.
# These helpers provide a direct, programmatic way to compute ratings
# for one or many URLs and return Python dicts shaped like the API schema.


def _ensure_pythonpath() -> None:
    """Best-effort: ensure project root is on PYTHONPATH when imported programmatically.

    In web/server contexts the working directory may differ. This makes it
    easier to `import src.*` without relying on the shell wrapper.
    """
    try:
        import sys
        from pathlib import Path

        here = Path(__file__).resolve()
        project_root = here.parent.parent  # repo root containing `src`
        root_str = str(project_root)
        if root_str not in sys.path:
            sys.path.insert(0, root_str)
    except Exception:
        # Non-fatal; imports below will raise if still unresolved.
        pass


_ensure_pythonpath()

from src.core.url_processor import URLProcessor  # type: ignore  # noqa: E402


def _rate_one_entry(
    processor: URLProcessor,
    *,
    primary_url: Optional[str] = None,
    code_url: Optional[str] = None,
    dataset_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Compute a rating for a single entry and return a dict in API schema shape.

    Prefers `primary_url` (typically a model URL). Optionally accepts `code_url`
    and `dataset_url` to enrich context if available.
    """
    import sys
    
    url = primary_url or code_url or dataset_url
    print(f"[DEBUG] _rate_one_entry called with URL: {url}", file=sys.stderr)
    
    if not url:
        print("[DEBUG] No URL provided, returning default zero scores", file=sys.stderr)
        # Shape a minimal stub aligned with downstream expectations.
        return {
            "name": "unknown",
            "category": "MODEL",
            "net_score": 0.0,
            "net_score_latency": 0,
            "ramp_up_time": 0.0,
            "ramp_up_time_latency": 0,
            "bus_factor": 0.0,
            "bus_factor_latency": 0,
            "performance_claims": 0.0,
            "performance_claims_latency": 0,
            "license": 0.0,
            "license_latency": 0,
            "size_score": {
                "raspberry_pi": 0.0,
                "jetson_nano": 0.0,
                "desktop_pc": 0.0,
                "aws_server": 0.0,
            },
            "size_score_latency": 0,
            "dataset_and_code_score": 0.0,
            "dataset_and_code_score_latency": 0,
            "dataset_quality": 0.0,
            "dataset_quality_latency": 0,
            "code_quality": 0.0,
            "code_quality_latency": 0,
            "reproducibility": 0.0,
            "reproducibility_latency": 0,
            "reviewedness": 0.0,
            "reviewedness_latency": 0,
            "tree_score": 0.0,
            "tree_score_latency": 0,
        }

    try:
        # Build context (leveraging existing internals)
        print(f"[DEBUG] Creating model context for URL: {url}", file=sys.stderr)
        context = processor._create_model_context(url, code_url, dataset_url)  # type: ignore[attr-defined]
        print(f"[DEBUG] Context created successfully", file=sys.stderr)
    except Exception as ctx_err:
        print(f"[DEBUG] Context creation failed: {ctx_err}", file=sys.stderr)
        context = None

    # If context creation fails, fall back to the default result shape used by URLProcessor
    if not context:
        print("[DEBUG] Context is None, using default result", file=sys.stderr)
        try:
            default_res = processor._create_default_result(url)  # type: ignore[attr-defined]
            return json.loads(default_res.to_ndjson_line())
        except Exception:
            # Last-resort stub in schema shape
            return {
                "name": "unknown",
                "category": "MODEL",
                "net_score": 0.0,
                "net_score_latency": 0,
                "ramp_up_time": 0.0,
                "ramp_up_time_latency": 0,
                "bus_factor": 0.0,
                "bus_factor_latency": 0,
                "performance_claims": 0.0,
                "performance_claims_latency": 0,
                "license": 0.0,
                "license_latency": 0,
                "size_score": {
                    "raspberry_pi": 0.0,
                    "jetson_nano": 0.0,
                    "desktop_pc": 0.0,
                    "aws_server": 0.0,
                },
                "size_score_latency": 0,
                "dataset_and_code_score": 0.0,
                "dataset_and_code_score_latency": 0,
                "dataset_quality": 0.0,
                "dataset_quality_latency": 0,
                "code_quality": 0.0,
                "code_quality_latency": 0,
                "reproducibility": 0.0,
                "reproducibility_latency": 0,
                "reviewedness": 0.0,
                "reviewedness_latency": 0,
                "tree_score": 0.0,
                "tree_score_latency": 0,
            }

    try:
        # Calculate all metrics and compute net score
        print(f"[DEBUG] Calculating metrics for context", file=sys.stderr)
        metrics = processor._calculate_all_metrics(context)  # type: ignore[attr-defined]
        print(f"[DEBUG] Metrics calculated. Count: {len(metrics) if metrics else 0}", file=sys.stderr)
        
        net_score = processor._calculate_net_score(metrics)  # type: ignore[attr-defined]
        print(f"[DEBUG] Net score calculated: {net_score}", file=sys.stderr)
        
        net_score_latency = sum(m.calculation_time_ms for m in metrics.values()) if metrics else 0

        # Store in shared ResultsStorage and finalize to a ModelResult
        for metric in metrics.values():
            processor.results_storage.store_metric_result(url, metric)
        model_result = processor.results_storage.finalize_model_result(url, net_score, net_score_latency)
        
        print(f"[DEBUG] Model result finalized. net_score in result: {net_score}", file=sys.stderr)

        # Convert to dict shaped like the OpenAPI schema by reusing the NDJSON serializer
        result_dict = json.loads(model_result.to_ndjson_line())
        print(f"[DEBUG] Returning result with net_score: {result_dict.get('net_score')}", file=sys.stderr)
        return result_dict

    except Exception as calc_err:
        print(f"[DEBUG] Exception during metric calculation: {calc_err}", file=sys.stderr)
        # Mirror the processor's defaulting behavior on any failure path
        try:
            print(f"[DEBUG] Attempting to create default result", file=sys.stderr)
            default_res = processor._create_default_result(url)  # type: ignore[attr-defined]
            return json.loads(default_res.to_ndjson_line())
        except Exception as default_err:
            print(f"[DEBUG] Default result creation also failed: {default_err}", file=sys.stderr)
            return {
                "name": "unknown",
                "category": "MODEL",
                "net_score": 0.0,
                "net_score_latency": 0,
                "ramp_up_time": 0.0,
                "ramp_up_time_latency": 0,
                "bus_factor": 0.0,
                "bus_factor_latency": 0,
                "performance_claims": 0.0,
                "performance_claims_latency": 0,
                "license": 0.0,
                "license_latency": 0,
                "size_score": {
                    "raspberry_pi": 0.0,
                    "jetson_nano": 0.0,
                    "desktop_pc": 0.0,
                    "aws_server": 0.0,
                },
                "size_score_latency": 0,
                "dataset_and_code_score": 0.0,
                "dataset_and_code_score_latency": 0,
                "dataset_quality": 0.0,
                "dataset_quality_latency": 0,
                "code_quality": 0.0,
                "code_quality_latency": 0,
                "reproducibility": 0.0,
                "reproducibility_latency": 0,
                "reviewedness": 0.0,
                "reviewedness_latency": 0,
                "tree_score": 0.0,
                "tree_score_latency": 0,
            }


def rate_url(url: str) -> Dict[str, Any]:
    """Rate a single URL and return a schema-shaped JSON object (as dict)."""
    processor = URLProcessor("__web__")
    return _rate_one_entry(processor, primary_url=url)


def rate_urls(urls: Iterable[str]) -> List[Dict[str, Any]]:
    """Rate multiple URLs and return a list of schema-shaped JSON objects (as dicts).

    Most callers will pass only one URL; this supports batch processing without
    requiring the file-based CLI when integrating with web servers.
    """
    processor = URLProcessor("__web__")
    results: List[Dict[str, Any]] = []
    for url in urls:
        results.append(_rate_one_entry(processor, primary_url=(url or "").strip()))
    return results


__all__ = [
    "rate_url",
    "rate_urls",
]

