import json
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse


@dataclass
class MetricResult:
    metric_name: str
    score: Any
    calculation_time_ms: int
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ModelResult:
    url: str
    net_score: float
    net_score_latency: int
    size_score: Dict[str, float]
    size_latency: int
    license_score: float
    license_latency: int
    ramp_up_score: float
    ramp_up_latency: int
    bus_factor_score: float
    bus_factor_latency: int
    dataset_code_score: float
    dataset_code_latency: int
    dataset_quality_score: float
    dataset_quality_latency: int
    code_quality_score: float
    code_quality_latency: int
    performance_claims_score: float
    performance_claims_latency: int
    reproducibility_score: float
    reproducibility_latency: int
    reviewedness_score: float
    reviewedness_latency: int
    tree_score: float
    tree_score_latency: int

    def _extract_model_name(self) -> str:
        try:
            parsed_url = urlparse(self.url)
            path_parts = parsed_url.path.strip('/').split('/')

            if 'huggingface.co' in parsed_url.netloc:
                if len(path_parts) >= 2:
                    return path_parts[1]
                else:
                    return path_parts[0] if path_parts else "unknown"
            elif 'github.com' in parsed_url.netloc:
                if len(path_parts) >= 2:
                    return path_parts[1]
                else:
                    return "unknown"
            else:
                return "unknown"
        except Exception:
            return "unknown"

    def _format_decimal(self, value: float) -> float:
        """Format decimal to 2 decimal places as numeric value"""
        return round(value, 2)

    def to_ndjson_line(self) -> str:
        model_name = self._extract_model_name()

        net_score_val = self._format_decimal(self.net_score)
        ramp_up_val = self._format_decimal(self.ramp_up_score)
        bus_factor_val = self._format_decimal(self.bus_factor_score)
        performance_claims_val = self._format_decimal(self.performance_claims_score)
        license_val = self._format_decimal(self.license_score)
        dataset_code_val = self._format_decimal(self.dataset_code_score)
        dataset_quality_val = self._format_decimal(self.dataset_quality_score)
        code_quality_val = self._format_decimal(self.code_quality_score)
        reproducibility_val = self._format_decimal(self.reproducibility_score)
        reviewedness_val = self._format_decimal(self.reviewedness_score)
        tree_score_val = self._format_decimal(self.tree_score)

        size_score_dict = {}
        if isinstance(self.size_score, dict):
            size_score_dict = {
                "raspberry_pi": self._format_decimal(
                    self.size_score.get(
                        "raspberry_pi", 0.0)), "jetson_nano": self._format_decimal(
                    self.size_score.get(
                        "jetson_nano", 0.0)), "desktop_pc": self._format_decimal(
                    self.size_score.get(
                        "desktop_pc", 0.0)), "aws_server": self._format_decimal(
                    self.size_score.get(
                        "aws_server", 0.0))}
        else:
            size_score_dict = {
                "raspberry_pi": 0.0,
                "jetson_nano": 0.0,
                "desktop_pc": 0.0,
                "aws_server": 0.0
            }

        class DecimalEncoder(json.JSONEncoder):
            def encode(self, obj: Any) -> str:
                if isinstance(obj, float):
                    return f'{obj:.2f}'
                elif isinstance(obj, dict):
                    return '{' + ','.join(f'"{k}":{self.encode(v)}' for k,
                                          v in obj.items()) + '}'
                elif isinstance(obj, list):
                    return '[' + ','.join(self.encode(v) for v in obj) + ']'
                return super().encode(obj)

        result_dict = {
            "name": model_name,
            "category": "MODEL",
            "net_score": net_score_val,
            "net_score_latency": self.net_score_latency,
            "ramp_up_time": ramp_up_val,
            "ramp_up_time_latency": self.ramp_up_latency,
            "bus_factor": bus_factor_val,
            "bus_factor_latency": self.bus_factor_latency,
            "performance_claims": performance_claims_val,
            "performance_claims_latency": self.performance_claims_latency,
            "license": license_val,
            "license_latency": self.license_latency,
            "size_score": size_score_dict,
            "size_score_latency": self.size_latency,
            "dataset_and_code_score": dataset_code_val,
            "dataset_and_code_score_latency": self.dataset_code_latency,
            "dataset_quality": dataset_quality_val,
            "dataset_quality_latency": self.dataset_quality_latency,
            "code_quality": code_quality_val,
            "code_quality_latency": self.code_quality_latency,
            "reproducibility": reproducibility_val,
            "reproducibility_latency": self.reproducibility_latency,
            "reviewedness": reviewedness_val,
            "reviewedness_latency": self.reviewedness_latency,
            "tree_score": tree_score_val,
            "tree_score_latency": self.tree_score_latency
        }
        return json.dumps(result_dict, separators=(',', ':'), cls=DecimalEncoder)


class ResultsStorage:
    def __init__(self) -> None:
        self._model_results: Dict[str, Dict[str, MetricResult]] = {}
        self._completed_models: List[ModelResult] = []

    def store_metric_result(self, model_url: str, metric_result: MetricResult) -> None:
        if model_url not in self._model_results:
            self._model_results[model_url] = {}

        self._model_results[model_url][metric_result.metric_name] = metric_result

    def get_metric_result(
            self,
            model_url: str,
            metric_name: str) -> Optional[MetricResult]:
        return self._model_results.get(model_url, {}).get(metric_name)

    def get_all_metrics_for_model(self, model_url: str) -> Dict[str, MetricResult]:
        return self._model_results.get(model_url, {})

    def is_model_complete(self, model_url: str) -> bool:
        required_metrics = {
            "Size", "License", "RampUp", "BusFactor",
            "DatasetCode", "DatasetQuality", "CodeQuality",
            "PerformanceClaims", "Reproducibility", "Reviewedness", "TreeScore"
        }

        model_metrics = set(self._model_results.get(model_url, {}).keys())
        return required_metrics.issubset(model_metrics)

    def finalize_model_result(
            self,
            model_url: str,
            net_score: float,
            net_score_latency: int) -> ModelResult:
        if not self.is_model_complete(model_url):
            raise ValueError(
                f"Model {model_url} does not have all required metrics calculated")

        metrics = self._model_results[model_url]

        size_metric = metrics["Size"]
        if isinstance(size_metric.score, dict):
            size_score = size_metric.score
        else:

            size_score = {
                "raspberry_pi": size_metric.score * 0.2,
                "jetson_nano": size_metric.score * 0.4,
                "desktop_pc": size_metric.score * 0.8,
                "aws_server": size_metric.score
            }

        model_result = ModelResult(
            url=model_url,
            net_score=net_score,
            net_score_latency=net_score_latency,
            size_score=size_score,
            size_latency=metrics["Size"].calculation_time_ms,
            license_score=metrics["License"].score,
            license_latency=metrics["License"].calculation_time_ms,
            ramp_up_score=metrics["RampUp"].score,
            ramp_up_latency=metrics["RampUp"].calculation_time_ms,
            bus_factor_score=metrics["BusFactor"].score,
            bus_factor_latency=metrics["BusFactor"].calculation_time_ms,
            dataset_code_score=metrics["DatasetCode"].score,
            dataset_code_latency=metrics["DatasetCode"].calculation_time_ms,
            dataset_quality_score=metrics["DatasetQuality"].score,
            dataset_quality_latency=metrics["DatasetQuality"].calculation_time_ms,
            code_quality_score=metrics["CodeQuality"].score,
            code_quality_latency=metrics["CodeQuality"].calculation_time_ms,
            performance_claims_score=metrics["PerformanceClaims"].score,
            performance_claims_latency=metrics["PerformanceClaims"].calculation_time_ms,
            reproducibility_score=metrics["Reproducibility"].score,
            reproducibility_latency=metrics["Reproducibility"].calculation_time_ms,
            reviewedness_score=metrics["Reviewedness"].score,
            reviewedness_latency=metrics["Reviewedness"].calculation_time_ms,
            tree_score=metrics["TreeScore"].score,
            tree_score_latency=metrics["TreeScore"].calculation_time_ms
        )

        self._completed_models.append(model_result)
        return model_result

    def get_completed_models(self) -> List[ModelResult]:
        return self._completed_models.copy()

    def clear(self) -> None:
        self._model_results.clear()
        self._completed_models.clear()
