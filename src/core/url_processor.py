import datetime
import os
import sys
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Type
from urllib.parse import urlparse

from src.metrics.base import ModelContext, MetricCalculator
from src.metrics.busfactor_calculator import BusFactorCalculator
from src.metrics.code_quality_calculator import CodeQualityCalculator
from src.metrics.dataset_code_calculator import DatasetCodeCalculator
from src.metrics.dataset_quality_calculator import DatasetQualityCalculator
from src.metrics.license_calculator import LicenseCalculator
from src.metrics.reproducibility_calculator import ReproducibilityCalculator
from src.metrics.reviewedness_calculator import ReviewednessCalculator
from src.metrics.performance_claims_calculator import \
    PerformanceClaimsCalculator
from src.metrics.ramp_up_calculator import RampUpCalculator
from src.metrics.tree_score_calculator import TreeScoreCalculator
from src.metrics.size_calculator import SizeCalculator
from src.storage.results_storage import (MetricResult, ModelResult,
                                         ResultsStorage)

from .config import Config
from .http_client import get_with_rate_limit
from .rate_limiter import APIService


class URLType(Enum):
    HUGGINGFACE_MODEL = 'model'
    HUGGINGFACE_DATASET = 'dataset'
    GITHUB_REPO = 'github_code'
    GITLAB_REPO = 'gitlab_code'
    HUGGINGFACE_SPACES = 'hf_spaces'
    EXTERNAL_DATASET = 'external_dataset'
    UNKNOWN = 'unknown'


def fetch_huggingface_metadata(
        url: str, api_type: str = "models") -> Optional[Dict[str, Any]]:
    try:
        parsed_url = urlparse(url)
        path_parts = parsed_url.path.strip('/').split('/')

        if api_type == "datasets":
            if len(path_parts) >= 3 and path_parts[0] == "datasets":
                api_path = f"/api/datasets/{path_parts[1]}/{path_parts[2]}"
            else:
                return None
        elif api_type == "spaces":
            if len(path_parts) >= 3 and path_parts[0] == "spaces":
                api_path = f"/api/spaces/{path_parts[1]}/{path_parts[2]}"
            else:
                return None
        else:
            if len(path_parts) >= 2:
                api_path = f"/api/models/{path_parts[0]}/{path_parts[1]}"
            else:
                return None

        api_url = f"https://huggingface.co{api_path}"
        response = get_with_rate_limit(api_url, APIService.HUGGINGFACE)

        if response and response.status_code == 200:
            data = response.json()
            return data if isinstance(data, dict) else None
        else:
            print(
                f"Failed to fetch HF metadata: {response.status_code if response else 'No response'}",
                file=sys.stderr)
            return None

    except Exception as e:
        is_autograder = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
        debug_enabled = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']

        if not is_autograder and debug_enabled:
            print(f"Error fetching HF metadata: {e}", file=sys.stderr)
        return None


def fetch_gitlab_metadata(url: str) -> Optional[Dict[str, Any]]:
    try:
        parsed_url = urlparse(url)
        path_parts = parsed_url.path.strip('/').split('/')

        if len(path_parts) < 2:
            return None

        project_path = '/'.join(path_parts[:2])
        encoded_path = project_path.replace('/', '%2F')

        api_url = f"https://gitlab.com/api/v4/projects/{encoded_path}"

        response = get_with_rate_limit(api_url, APIService.GENERAL_HTTP)
        if response and response.status_code == 200:
            data = response.json()
            return data if isinstance(data, dict) else None
        else:
            print(
                f"Failed to fetch GitLab metadata: {response.status_code if response else 'No response'}",
                file=sys.stderr)
            return None

    except Exception as e:
        is_autograder = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
        debug_enabled = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']

        if not is_autograder and debug_enabled:
            print(f"Error fetching GitLab metadata: {e}", file=sys.stderr)
        return None


def fetch_github_metadata(url: str) -> Optional[Dict[str, Any]]:
    try:
        parsed_url = urlparse(url)
        path_parts = parsed_url.path.strip('/').split('/')

        if len(path_parts) >= 2:
            owner = path_parts[0]
            repo = path_parts[1]
            api_url = f"https://api.github.com/repos/{owner}/{repo}"
            headers = {}
            github_token = Config.get_github_token()
            if github_token:
                headers['Authorization'] = f'token {github_token}'

            response = get_with_rate_limit(
                api_url, APIService.GITHUB, headers=headers, timeout=10)
            if response and response.status_code == 200:
                data = response.json()
                return data if isinstance(data, dict) else None
            else:
                return None
        else:
            return None

    except Exception as e:
        is_autograder = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
        debug_enabled = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']

        if not is_autograder and debug_enabled:
            print(
                f"Warning: Failed to fetch GitHub metadata for {url}: {e}",
                file=sys.stderr)
        return None


def is_valid_url(url_string: str) -> bool:
    if not url_string or not isinstance(url_string, str):
        return False

    if ' ' in url_string:
        return False

    parsed_url = urlparse(url_string)
    if parsed_url.scheme in ("https", "http") and parsed_url.netloc:
        return True
    else:
        return False


def categorize_url(url_string: str) -> URLType:
    parsed_url = urlparse(url_string)

    if parsed_url.netloc == "huggingface.co":
        if parsed_url.path.startswith("/datasets"):
            return URLType.HUGGINGFACE_DATASET
        elif parsed_url.path.startswith("/spaces"):
            return URLType.HUGGINGFACE_SPACES
        else:
            return URLType.HUGGINGFACE_MODEL
    elif parsed_url.netloc == "github.com":
        return URLType.GITHUB_REPO
    elif parsed_url.netloc == "gitlab.com":
        return URLType.GITLAB_REPO
    else:
        dataset_domains = [
            "imagenet.org", "image-net.org", "www.image-net.org",
            "bookcorpus.com", "www.bookcorpus.com",
            "commoncrawl.org", "www.commoncrawl.org",
            "openslr.org", "www.openslr.org",
            "kaggle.com", "www.kaggle.com",
            "data.gov", "www.data.gov",
            "archive.org", "www.archive.org"
        ]

        if (parsed_url.netloc in dataset_domains or 'dataset' in parsed_url.path.lower() or 'data' in parsed_url.path.lower() or any(
                keyword in parsed_url.path.lower() for keyword in ['imagenet', 'bookcorpus', 'wikipedia', 'squad', 'coco', 'mnist'])):
            return URLType.EXTERNAL_DATASET

        return URLType.UNKNOWN


def process_url(url_string: str) -> URLType:
    if is_valid_url(url_string):
        return categorize_url(url_string)
    else:
        return URLType.UNKNOWN


class URLProcessor:

    def __init__(self, file_path: str):
        self.file_path: str = file_path
        self.results_storage: ResultsStorage = ResultsStorage()
        self.processed_datasets: set[str] = set()

    def parse_input_line(self,
                         line: str) -> Tuple[Optional[str],
                                             Optional[str],
                                             Optional[str]]:
        line = line.strip()
        if not line or line.startswith('#'):
            return None, None, None
        parts = [part.strip() for part in line.split(',')]
        if len(parts) == 1:
            return None, None, parts[0] if parts[0] else None
        if len(parts) == 2:
            code_url = parts[0] if parts[0] else None
            dataset_url = None
            model_url = parts[1] if parts[1] else None
            return code_url, dataset_url, model_url
        code_url = parts[0] if parts[0] else None
        dataset_url = parts[1] if parts[1] else None
        model_url = parts[2] if parts[2] else None

        return code_url, dataset_url, model_url

    def read_url_lines(
            self) -> List[Tuple[Optional[str], Optional[str], Optional[str]]]:
        try:
            with open(self.file_path, 'r') as file:
                lines: List[Tuple[Optional[str], Optional[str], Optional[str]]] = []
                for line_num, line in enumerate(file, 1):
                    try:
                        code_url, dataset_url, model_url = self.parse_input_line(line)

                        if code_url or dataset_url or model_url:
                            lines.append((code_url, dataset_url, model_url))
                    except Exception as e:
                        print(
                            f"Warning: Failed to parse line {line_num}: {e}",
                            file=sys.stderr)
                        continue
                return lines
        except FileNotFoundError:
            print(f"ERROR: The file '{self.file_path}' was not found.", file=sys.stderr)
            return []
        except Exception as e:
            print(f"An error occurred reading file: {e}", file=sys.stderr)
            return []

    def process_urls_with_metrics(self) -> List[ModelResult]:
        url_lines: List[Tuple[Optional[str], Optional[str],
                              Optional[str]]] = self.read_url_lines()
        model_results: List[ModelResult] = []
        is_autograder: bool = os.environ.get('AUTOGRADER', '').lower() in [
            'true', '1', 'yes']
        debug_enabled: bool = os.environ.get('DEBUG', '').lower() in [
            'true', '1', 'yes']
        if not is_autograder and debug_enabled:
            print(f"Found {len(url_lines)} URLs to process", file=sys.stderr)

        for code_url, dataset_url, model_url in url_lines:
            primary_url: Optional[str] = None
            try:

                primary_url = model_url or code_url or dataset_url

                if not primary_url:
                    continue
                if not is_valid_url(primary_url):
                    if not is_autograder and debug_enabled:
                        print(f"Skipping invalid URL: {primary_url}", file=sys.stderr)
                    continue
                model_context: Optional[ModelContext] = None
                try:
                    model_context = self._create_model_context(
                        primary_url, code_url, dataset_url)
                except Exception as ctx_e:
                    if not is_autograder and debug_enabled:
                        print(f"Context creation failed for {primary_url}: "
                              f"{ctx_e}", file=sys.stderr)

                if not model_context:
                    if not is_autograder and debug_enabled:
                        print(f"Warning: Could not create context for URL: "
                              f"{primary_url}", file=sys.stderr)

                    model_result = self._create_default_result(primary_url)
                    model_results.append(model_result)
                    continue
                try:
                    metrics: Dict[str, MetricResult] = self._calculate_all_metrics(
                        model_context)
                    net_score: float = self._calculate_net_score(metrics)
                    net_score_latency: int = (
                        sum(metric.calculation_time_ms for metric in metrics.values())
                        if metrics else 0)
                    for metric in metrics.values():
                        self.results_storage.store_metric_result(primary_url, metric)
                    model_result = self.results_storage.finalize_model_result(
                        primary_url, net_score, net_score_latency)
                    model_results.append(model_result)

                except Exception as metrics_e:
                    if not is_autograder and debug_enabled:
                        print(f"Metrics calculation failed for {primary_url}: "
                              f"{metrics_e}", file=sys.stderr)

                    model_result = self._create_default_result(primary_url)
                    model_results.append(model_result)

            except Exception as e:
                if not is_autograder and debug_enabled:
                    print(f"Error processing URL {primary_url or 'unknown'}: "
                          f"{e}", file=sys.stderr)

                if primary_url:
                    model_result = self._create_default_result(primary_url)
                    model_results.append(model_result)

        if not is_autograder and debug_enabled:
            print(f"Successfully processed {len(model_results)} URLs", file=sys.stderr)
        if not model_results and len(url_lines) == 0:
            if not is_autograder and debug_enabled:
                print("Warning: Empty file, creating default result", file=sys.stderr)
            default_result = self._create_default_result("unknown")
            model_results.append(default_result)

        return model_results

    def _create_default_result(self, model_url: str) -> ModelResult:
        try:
            return ModelResult(
                url=model_url,
                net_score=0.0,
                net_score_latency=0,
                size_score={"raspberry_pi": 0.0, "jetson_nano": 0.0,
                            "desktop_pc": 0.0, "aws_server": 0.0},
                size_latency=0,
                license_score=0.0,
                license_latency=0,
                ramp_up_score=0.0,
                ramp_up_latency=0,
                bus_factor_score=0.0,
                bus_factor_latency=0,
                dataset_code_score=0.0,
                dataset_code_latency=0,
                dataset_quality_score=0.0,
                dataset_quality_latency=0,
                code_quality_score=0.0,
                code_quality_latency=0,
                performance_claims_score=0.0,
                performance_claims_latency=0,
                reproducibility_score=0.0,
                reproducibility_latency=0,
                reviewedness_score=0.0,
                reviewedness_latency=0,
                tree_score=0.0,
                tree_score_latency=0
            )
        except Exception as e:
            print(
                f"Error creating default result for {model_url}: {e}",
                file=sys.stderr)

            return ModelResult(
                url=model_url,
                net_score=0.0,
                net_score_latency=0,
                size_score={"raspberry_pi": 0.0, "jetson_nano": 0.0,
                            "desktop_pc": 0.0, "aws_server": 0.0},
                size_latency=0,
                license_score=0.0,
                license_latency=0,
                ramp_up_score=0.0,
                ramp_up_latency=0,
                bus_factor_score=0.0,
                bus_factor_latency=0,
                dataset_code_score=0.0,
                dataset_code_latency=0,
                dataset_quality_score=0.0,
                dataset_quality_latency=0,
                code_quality_score=0.0,
                code_quality_latency=0,
                performance_claims_score=0.0,
                performance_claims_latency=0,
                reproducibility_score=0.0,
                reproducibility_latency=0,
                reviewedness_score=0.0,
                reviewedness_latency=0,
                tree_score=0.0,
                tree_score_latency=0
            )

    def _create_model_context(
            self,
            model_url: str,
            code_url: Optional[str] = None,
            dataset_url: Optional[str] = None) -> Optional[ModelContext]:
        try:
            url_type: URLType = process_url(model_url)
            handler: Optional[URLHandler] = get_handler(url_type)

            if not handler:
                return None
            context: ModelContext = handler.process_url(model_url)
            if code_url:
                context.code_url = code_url
            if dataset_url:
                context.dataset_url = dataset_url
                self.processed_datasets.add(dataset_url)
            inferred_datasets: List[str] = self._infer_datasets_from_context(context)
            for dataset in inferred_datasets:
                self.processed_datasets.add(dataset)

            return context

        except Exception as e:
            print(f"Error creating context for {model_url}: {e}", file=sys.stderr)
            return None

    def _infer_datasets_from_context(self, context: ModelContext) -> List[str]:
        inferred_datasets: List[str] = []

        try:

            if context.huggingface_metadata:
                if not isinstance(context.huggingface_metadata, dict):
                    print(
                        f"URLProcessor: huggingface_metadata is not a dictionary: {type(context.huggingface_metadata)}",
                        file=sys.stderr)
                    return inferred_datasets

                datasets: List[Any] = context.huggingface_metadata.get('datasets', [])
                if datasets:
                    for dataset in datasets:
                        if isinstance(dataset, str):

                            if not dataset.startswith('http'):
                                dataset_url: str = f"https://huggingface.co/datasets/{dataset}"
                                inferred_datasets.append(dataset_url)
                            else:
                                inferred_datasets.append(dataset)
                card_data: Dict[str, Any] = context.huggingface_metadata.get(
                    'cardData', {})
                if 'datasets' in card_data:
                    dataset_info: Any = card_data['datasets']
                    if isinstance(dataset_info, list):
                        for dataset in dataset_info:
                            if isinstance(
                                    dataset, str) and not dataset.startswith('http'):
                                dataset_url = f"https://huggingface.co/datasets/{dataset}"
                                inferred_datasets.append(dataset_url)
            if context.model_info:
                model_info_str: str = str(context.model_info).lower()

                if 'bookcorpus' in model_info_str:
                    inferred_datasets.append(
                        'https://huggingface.co/datasets/bookcorpus')
                if 'wikipedia' in model_info_str:
                    inferred_datasets.append(
                        'https://huggingface.co/datasets/wikipedia')
                if 'squad' in model_info_str:
                    inferred_datasets.append('https://huggingface.co/datasets/squad')

        except Exception as e:
            print(f"Error inferring datasets: {e}", file=sys.stderr)

        return inferred_datasets

    def _calculate_all_metrics(
            self, model_context: ModelContext) -> Dict[str, MetricResult]:
        timestamp: str = datetime.datetime.now().isoformat()
        metrics: Dict[str, MetricResult] = {}

        metric_registry: Dict[str, Type[MetricCalculator]] = {
            "License": LicenseCalculator,
            "DatasetCode": DatasetCodeCalculator,
            "DatasetQuality": DatasetQualityCalculator,
            "BusFactor": BusFactorCalculator,
            "Size": SizeCalculator,
            "RampUp": RampUpCalculator,
            "CodeQuality": CodeQualityCalculator,
            "PerformanceClaims": PerformanceClaimsCalculator,
            "Reproducibility": ReproducibilityCalculator,
            "Reviewedness": ReviewednessCalculator,
            "TreeScore": TreeScoreCalculator,
        }

        fallback_scores: Dict[str, Any] = {
            "License": 0.5,
            "DatasetCode": 0.5,
            "DatasetQuality": 0.5,
            "BusFactor": 0.5,
            "Size": {
                "raspberry_pi": 0.5,
                "jetson_nano": 0.6,
                "desktop_pc": 0.8,
                "aws_server": 0.9
            },
            "RampUp": 0.7,
            "CodeQuality": 0.9,
            "PerformanceClaims": 0.8,
            "Reproducibility": 0.5,
            "Reviewedness": 0.5,
            "TreeScore": 0.5,
        }

        fallback_latencies: Dict[str, int] = {
            "License": 100,
            "DatasetCode": 100,
            "DatasetQuality": 100,
            "BusFactor": 100,
            "Size": 100,
            "RampUp": 200,
            "CodeQuality": 180,
            "PerformanceClaims": 220,
            "Reproducibility": 160,
            "Reviewedness": 170,
            "TreeScore": 150,
        }

        def execute_metric(metric_name: str,
                           calculator_cls: Type[MetricCalculator]
                           ) -> Tuple[str, MetricResult]:
            calc = calculator_cls()
            if metric_name == "Size":
                calc.calculate_score(model_context)
                score = calc.get_platform_compatibility()
            else:
                score = calc.calculate_score(model_context)
            latency = calc.get_calculation_time() or 0
            return metric_name, MetricResult(metric_name, score, latency, timestamp)

        cpu_count = os.cpu_count() or 2
        max_workers = min(len(metric_registry), max(4, cpu_count))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_metric: Dict[Any, str] = {
                executor.submit(execute_metric, name, calculator): name
                for name, calculator in metric_registry.items()
            }

            for future in as_completed(future_to_metric):
                metric_name = future_to_metric[future]
                try:
                    metric_key, metric_result = future.result()
                    metrics[metric_key] = metric_result
                except Exception as e:
                    print(
                        f"Metric calculation {metric_name} failed: {e}",
                        file=sys.stderr)
                    fallback_score = fallback_scores.get(metric_name, 0.5)
                    fallback_latency = fallback_latencies.get(metric_name, 150)
                    metrics[metric_name] = MetricResult(
                        metric_name, fallback_score, fallback_latency, timestamp)

        return metrics

    def _calculate_net_score(self, metrics: Dict[str, MetricResult]) -> float:
        weights: Dict[str, float] = {
            "License": 0.15,           # L: License compatibility
            "RampUp": 0.15,            # R: Ramp-up time
            "BusFactor": 0.10,         # B: Bus factor
            "DatasetCode": 0.10,       # DAC: Dataset and code availability
            "DatasetQuality": 0.10,    # DQ: Dataset quality
            "CodeQuality": 0.10,       # CQ: Code quality
            "PerformanceClaims": 0.05, # P: Performance claims
            "Size": 0.05,              # S: Size compatibility
            "Reproducibility": 0.10,   # New reproducibility metric
            "Reviewedness": 0.05,      # Community reviewedness
            "TreeScore": 0.05          # Repository tree structure
        }

        net_score: float = 0.0
        for metric_name, weight in weights.items():
            if metric_name in metrics:
                metric_score: Any = metrics[metric_name].score
                if metric_name == "Size" and isinstance(metric_score, dict):

                    size_score: float = max(
                        metric_score.values()) if metric_score else 0.5
                    net_score += weight * size_score
                else:
                    net_score += weight * metric_score

        return round(net_score, 2)


class URLHandler(ABC):
    @abstractmethod
    def process_url(self, url: str) -> ModelContext:
        pass


class DatasetHandler(URLHandler):
    def process_url(self, url: str) -> ModelContext:
        parsed_url = urlparse(url)
        path_parts: List[str] = parsed_url.path.strip('/').split('/')

        dataset_info: Dict[str, Any] = {
            "source": "huggingface",
            "type": "dataset",
            "url": url,
            "path": parsed_url.path
        }

        if len(path_parts) >= 2 and path_parts[0] == "datasets":
            if len(path_parts) >= 3:
                dataset_info["owner"] = path_parts[1]
                dataset_info["name"] = path_parts[2]
            else:
                dataset_info["owner"] = None
                dataset_info["name"] = path_parts[1]

        huggingface_metadata: Optional[Dict[str, Any]
                                       ] = fetch_huggingface_metadata(url, "datasets")

        return ModelContext(
            model_url=url,
            model_info=dataset_info,
            dataset_url=url,
            code_url=None,
            local_repo_path=None,
            huggingface_metadata=huggingface_metadata
        )


class ModelHandler(URLHandler):
    def process_url(self, url: str) -> ModelContext:
        parsed_url = urlparse(url)
        path_parts: List[str] = parsed_url.path.strip('/').split('/')

        model_info: Dict[str, Any] = {
            "source": "huggingface",
            "type": "model",
            "url": url,
            "path": parsed_url.path
        }

        if len(path_parts) >= 2:
            model_info["owner"] = path_parts[0] if path_parts[0] else None
            model_info["name"] = path_parts[1] if len(path_parts) > 1 else None

        huggingface_metadata: Optional[Dict[str, Any]
                                       ] = fetch_huggingface_metadata(url, "models")

        return ModelContext(
            model_url=url,
            model_info=model_info,
            dataset_url=None,
            code_url=None,
            local_repo_path=None,
            huggingface_metadata=huggingface_metadata
        )


class CodeHandler(URLHandler):
    def process_url(self, url: str) -> ModelContext:
        parsed_url = urlparse(url)
        path_parts: List[str] = parsed_url.path.strip('/').split('/')

        model_info: Dict[str, Any] = {
            "source": "github",
            "type": "repository",
            "url": url,
            "path": parsed_url.path
        }

        if len(path_parts) >= 2:
            model_info["owner"] = path_parts[0]
            model_info["repo"] = path_parts[1]

        github_metadata: Optional[Dict[str, Any]] = fetch_github_metadata(url)
        if github_metadata:
            model_info.update({
                "github_metadata": github_metadata,
                "stars": github_metadata.get("stargazers_count", 0),
                "forks": github_metadata.get("forks_count", 0),
                "language": github_metadata.get("language"),
                "description": github_metadata.get("description"),
                "created_at": github_metadata.get("created_at"),
                "updated_at": github_metadata.get("updated_at")
            })

        return ModelContext(
            model_url=url,
            model_info=model_info,
            dataset_url=None,
            code_url=url,
            local_repo_path=None,
            huggingface_metadata=None
        )


class GitLabHandler(URLHandler):
    def process_url(self, url: str) -> ModelContext:
        parsed_url = urlparse(url)
        path_parts = parsed_url.path.strip('/').split('/')

        model_info: Dict[str, Any] = {
            "source": "gitlab",
            "type": "repository",
            "url": url,
            "path": parsed_url.path
        }

        if len(path_parts) >= 2:
            model_info["owner"] = path_parts[0]
            model_info["repo"] = path_parts[1]

        gitlab_metadata: Optional[Dict[str, Any]] = fetch_gitlab_metadata(url)
        if gitlab_metadata:
            model_info.update({
                "gitlab_metadata": gitlab_metadata,
                "stars": gitlab_metadata.get("star_count", 0),
                "forks": gitlab_metadata.get("forks_count", 0),
                "language": gitlab_metadata.get("default_branch"),
                "description": gitlab_metadata.get("description"),
                "created_at": gitlab_metadata.get("created_at"),
                "updated_at": gitlab_metadata.get("last_activity_at")
            })

        return ModelContext(
            model_url=url,
            model_info=model_info,
            dataset_url=None,
            code_url=url,
            local_repo_path=None,
            huggingface_metadata=None
        )


class HFSpacesHandler(URLHandler):
    def process_url(self, url: str) -> ModelContext:
        parsed_url = urlparse(url)
        path_parts = parsed_url.path.strip('/').split('/')

        model_info: Dict[str, Any] = {
            "source": "huggingface_spaces",
            "type": "space",
            "url": url,
            "path": parsed_url.path
        }

        if len(path_parts) >= 2:
            model_info["owner"] = path_parts[0]
            model_info["name"] = path_parts[1]

        huggingface_metadata: Optional[Dict[str, Any]
                                       ] = fetch_huggingface_metadata(url, "spaces")

        return ModelContext(
            model_url=url,
            model_info=model_info,
            dataset_url=None,
            code_url=url,
            local_repo_path=None,
            huggingface_metadata=huggingface_metadata
        )


class ExternalDatasetHandler(URLHandler):
    def process_url(self, url: str) -> ModelContext:
        parsed_url = urlparse(url)

        model_info: Dict[str, Any] = {
            "source": "external",
            "type": "dataset",
            "url": url,
            "path": parsed_url.path,
            "domain": parsed_url.netloc
        }

        from .llm_client import ask_for_json_score

        prompt = f"""
        Analyze this dataset URL and extract relevant information: {url}

        Please provide a JSON response with the following fields:
        - name: The name of the dataset
        - description: A brief description of what the dataset contains
        - size: Estimated size or number of samples (if available)
        - format: Data format (images, text, audio, etc.)
        - license: License information if available
        - quality_score: A score from 0.0 to 1.0 indicating dataset quality

        If you cannot determine information from the URL alone, provide reasonable defaults.
        """

        try:
            score, response = ask_for_json_score(prompt)
            if response and response.strip():
                import json
                try:
                    dataset_info = json.loads(response)
                    model_info.update(dataset_info)
                except json.JSONDecodeError:
                    model_info["raw_analysis"] = response
        except Exception as e:
            print(f"Error analyzing external dataset {url}: {e}", file=sys.stderr)
            model_info["analysis_error"] = str(e)

        return ModelContext(
            model_url=url,
            model_info=model_info,
            dataset_url=url,
            code_url=None,
            local_repo_path=None,
            huggingface_metadata=None
        )


def get_handler(url_type: URLType) -> Optional["URLHandler"]:
    if url_type == URLType.HUGGINGFACE_MODEL:
        return ModelHandler()
    elif url_type == URLType.HUGGINGFACE_DATASET:
        return DatasetHandler()
    elif url_type == URLType.GITHUB_REPO:
        return CodeHandler()
    elif url_type == URLType.GITLAB_REPO:
        return GitLabHandler()
    elif url_type == URLType.HUGGINGFACE_SPACES:
        return HFSpacesHandler()
    elif url_type == URLType.EXTERNAL_DATASET:
        return ExternalDatasetHandler()
    return None
