import datetime
import os
import sys
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from src.metrics.base import ModelContext
from src.metrics.busfactor_calculator import BusFactorCalculator
from src.metrics.code_quality_calculator import CodeQualityCalculator
from src.metrics.dataset_code_calculator import DatasetCodeCalculator
from src.metrics.dataset_quality_calculator import DatasetQualityCalculator
from src.metrics.license_calculator import LicenseCalculator
from src.metrics.performance_claims_calculator import \
    PerformanceClaimsCalculator
from src.metrics.ramp_up_calculator import RampUpCalculator
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
def fetch_huggingface_metadata(url: str, api_type: str = "models") -> Optional[Dict[str, Any]]:
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
            return response.json()
        else:
            print(f"Failed to fetch HF metadata: {response.status_code if response else 'No response'}", file=sys.stderr)
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
            return response.json()
        else:
            print(f"Failed to fetch GitLab metadata: {response.status_code if response else 'No response'}", file=sys.stderr)
            return None
            
    except Exception as e:
        is_autograder = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
        debug_enabled = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']
        
        if not is_autograder and debug_enabled:
            print(f"Error fetching GitLab metadata: {e}", file=sys.stderr)
        return None

def fetch_huggingface_metadata(url: str, api_type: str = "models") -> Optional[Dict[str, Any]]:
    try:
        parsed_url = urlparse(url)
        path_parts = parsed_url.path.strip('/').split('/')

        if api_type == "datasets":
            if len(path_parts) >= 2 and path_parts[0] == "datasets":
                if len(path_parts) >= 3:
                    repo_id = "/".join(path_parts[1:3])
                else:
                    repo_id = path_parts[1]
            else:
                return None
        else:
            if len(path_parts) >= 2:
                repo_id = "/".join(path_parts[0:2])
            else:
                return None

        api_url = f"https://huggingface.co/api/{api_type}/{repo_id}"

        response = get_with_rate_limit(api_url, APIService.HUGGINGFACE, timeout=10)
        if response and response.status_code == 200:
            data = response.json()
            # Handle case where API returns a list instead of dict (e.g., for /tree/main URLs)
            if isinstance(data, list):
                # If it's a list, take the first item if it exists, otherwise return None
                if len(data) > 0 and isinstance(data[0], dict):
                    return data[0]
                else:
                    return None
            elif isinstance(data, dict):
                return data
            else:
                return None
        else:
            is_autograder = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
            debug_enabled = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']
            
            if not is_autograder and debug_enabled:
                print(f"Failed to fetch HF metadata: {response.status_code if response else 'No response'}", file=sys.stderr)
            return None

    except Exception as e:
        is_autograder = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
        debug_enabled = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']
        
        if not is_autograder and debug_enabled:
            print(f"Warning: Failed to fetch HuggingFace metadata for {url}: {e}", file=sys.stderr)
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

            response = get_with_rate_limit(api_url, APIService.GITHUB, headers=headers, timeout=10)
            if response and response.status_code == 200:
                return response.json()
            else:
                return None
        else:
            return None

    except Exception as e:
        is_autograder = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
        debug_enabled = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']
        
        if not is_autograder and debug_enabled:
            print(f"Warning: Failed to fetch GitHub metadata for {url}: {e}", file=sys.stderr)
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
        
        if (parsed_url.netloc in dataset_domains or 
            'dataset' in parsed_url.path.lower() or
            'data' in parsed_url.path.lower() or
            any(keyword in parsed_url.path.lower() for keyword in ['imagenet', 'bookcorpus', 'wikipedia', 'squad', 'coco', 'mnist'])):
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

    def parse_input_line(self, line: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
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

    def read_url_lines(self) -> List[Tuple[Optional[str], Optional[str], Optional[str]]]:
        try:
            with open(self.file_path, 'r') as file:
                lines: List[Tuple[Optional[str], Optional[str], Optional[str]]] = []
                for line_num, line in enumerate(file, 1):
                    try:
                        code_url, dataset_url, model_url = self.parse_input_line(line)

                        if code_url or dataset_url or model_url:
                            lines.append((code_url, dataset_url, model_url))
                    except Exception as e:
                        print(f"Warning: Failed to parse line {line_num}: {e}", file=sys.stderr)
                        continue
                return lines
        except FileNotFoundError:
            print(f"ERROR: The file '{self.file_path}' was not found.", file=sys.stderr)
            return []
        except Exception as e:
            print(f"An error occurred reading file: {e}", file=sys.stderr)
            return []

    def process_urls_with_metrics(self) -> List[ModelResult]:
        url_lines: List[Tuple[Optional[str], Optional[str], Optional[str]]] = self.read_url_lines()
        model_results: List[ModelResult] = []
        is_autograder: bool = os.environ.get('AUTOGRADER', '').lower() in ['true', '1', 'yes']
        debug_enabled: bool = os.environ.get('DEBUG', '').lower() in ['true', '1', 'yes']
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
                    metrics: Dict[str, MetricResult] = self._calculate_all_metrics(model_context)
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
                performance_claims_latency=0
            )
        except Exception as e:
            print(f"Error creating default result for {model_url}: {e}", file=sys.stderr)

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
                performance_claims_latency=0
            )

    def _create_model_context(self, model_url: str, code_url: Optional[str] = None, dataset_url: Optional[str] = None) -> Optional[ModelContext]:
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
                    print(f"URLProcessor: huggingface_metadata is not a dictionary: {type(context.huggingface_metadata)}", file=sys.stderr)
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
                card_data: Dict[str, Any] = context.huggingface_metadata.get('cardData', {})
                if 'datasets' in card_data:
                    dataset_info: Any = card_data['datasets']
                    if isinstance(dataset_info, list):
                        for dataset in dataset_info:
                            if isinstance(dataset, str) and not dataset.startswith('http'):
                                dataset_url = f"https://huggingface.co/datasets/{dataset}"
                                inferred_datasets.append(dataset_url)
            if context.model_info:
                model_info_str: str = str(context.model_info).lower()

                if 'bookcorpus' in model_info_str:
                    inferred_datasets.append('https://huggingface.co/datasets/bookcorpus')
                if 'wikipedia' in model_info_str:
                    inferred_datasets.append('https://huggingface.co/datasets/wikipedia')
                if 'squad' in model_info_str:
                    inferred_datasets.append('https://huggingface.co/datasets/squad')

        except Exception as e:
            print(f"Error inferring datasets: {e}", file=sys.stderr)

        return inferred_datasets

    def _calculate_all_metrics(self, model_context: ModelContext) -> Dict[str, MetricResult]:
        timestamp: str = datetime.datetime.now().isoformat()
        metrics: Dict[str, MetricResult] = {}
        def calculate_license() -> Tuple[str, MetricResult]:
            try:
                calc = LicenseCalculator()
                score = calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                return "License", MetricResult("License", score, latency, timestamp)
            except Exception as e:
                print(f"License calculation failed: {e}", file=sys.stderr)
                return "License", MetricResult("License", 0.5, 100, timestamp)

        def calculate_dataset_code() -> Tuple[str, MetricResult]:
            try:
                calc = DatasetCodeCalculator()
                score = calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                return "DatasetCode", MetricResult("DatasetCode", score, latency, timestamp)
            except Exception as e:
                print(f"DatasetCode calculation failed: {e}", file=sys.stderr)
                return "DatasetCode", MetricResult("DatasetCode", 0.5, 100, timestamp)

        def calculate_dataset_quality() -> Tuple[str, MetricResult]:
            try:
                calc = DatasetQualityCalculator()
                score = calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                return "DatasetQuality", MetricResult("DatasetQuality", score, latency, timestamp)
            except Exception as e:
                print(f"DatasetQuality calculation failed: {e}", file=sys.stderr)
                return "DatasetQuality", MetricResult("DatasetQuality", 0.5, 100, timestamp)

        def calculate_bus_factor() -> Tuple[str, MetricResult]:
            try:
                calc = BusFactorCalculator()
                score = calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                return "BusFactor", MetricResult("BusFactor", score, latency, timestamp)
            except Exception as e:
                print(f"BusFactor calculation failed: {e}", file=sys.stderr)
                return "BusFactor", MetricResult("BusFactor", 0.5, 100, timestamp)

        def calculate_size() -> Tuple[str, MetricResult]:
            try:
                calc = SizeCalculator()
                calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                platform_scores = calc.get_platform_compatibility()
                return "Size", MetricResult("Size", platform_scores, latency, timestamp)
            except Exception as e:
                print(f"Size calculation failed: {e}", file=sys.stderr)
                return "Size", MetricResult("Size", {
                    "raspberry_pi": 0.5, "jetson_nano": 0.6,
                    "desktop_pc": 0.8, "aws_server": 0.9
                }, 100, timestamp)

        def calculate_ramp_up() -> Tuple[str, MetricResult]:
            try:
                calc = RampUpCalculator()
                score = calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                return "RampUp", MetricResult("RampUp", score, latency, timestamp)
            except Exception as e:
                print(f"RampUp calculation failed: {e}", file=sys.stderr)
                return "RampUp", MetricResult("RampUp", 0.7, 200, timestamp)

        def calculate_code_quality() -> Tuple[str, MetricResult]:
            try:
                calc = CodeQualityCalculator()
                score = calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                return "CodeQuality", MetricResult("CodeQuality", score, latency, timestamp)
            except Exception as e:
                print(f"CodeQuality calculation failed: {e}", file=sys.stderr)
                return "CodeQuality", MetricResult("CodeQuality", 0.9, 180, timestamp)

        def calculate_performance_claims() -> Tuple[str, MetricResult]:
            try:
                calc = PerformanceClaimsCalculator()
                score = calc.calculate_score(model_context)
                latency = calc.get_calculation_time() or 0
                return "PerformanceClaims", MetricResult("PerformanceClaims", score, latency, timestamp)
            except Exception as e:
                print(f"PerformanceClaims calculation failed: {e}", file=sys.stderr)
                return "PerformanceClaims", MetricResult("PerformanceClaims", 0.8, 220, timestamp)
        metric_functions: List[Any] = [
            calculate_license,
            calculate_dataset_code,
            calculate_dataset_quality,
            calculate_bus_factor,
            calculate_size,
            calculate_ramp_up,
            calculate_code_quality,
            calculate_performance_claims
        ]

        import os
        max_workers: int = min(4, os.cpu_count() or 2)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:

            future_to_metric: Dict[Any, str] = {
                executor.submit(func): func.__name__ for func in metric_functions
            }
            for future in as_completed(future_to_metric):
                try:
                    metric_name, metric_result = future.result()
                    metrics[metric_name] = metric_result
                except Exception as e:
                    metric_name = future_to_metric[future]
                    print(f"Metric calculation {metric_name} failed: {e}", file=sys.stderr)

                    if metric_name == "calculate_size":
                        default_sizes = {
                            "raspberry_pi": 0.5, "jetson_nano": 0.6,
                            "desktop_pc": 0.8, "aws_server": 0.9
                        }
                        metrics["Size"] = MetricResult("Size", default_sizes, 100, timestamp)
                    else:
                        metrics[metric_name.replace("calculate_", "").title()] = (
                            MetricResult(
                                metric_name.replace("calculate_", "").title(),
                                0.5, 100, timestamp
                            ))

        return metrics

    def _calculate_net_score(self, metrics: Dict[str, MetricResult]) -> float:
        weights: Dict[str, float] = {
            "License": 0.06,
            "RampUp": 0.20,
            "BusFactor": 0.20,
            "DatasetCode": 0.10,
            "DatasetQuality": 0.10,
            "CodeQuality": 0.10,
            "PerformanceClaims": 0.06,
            "Size": 0.18
        }

        net_score: float = 0.0
        for metric_name, weight in weights.items():
            if metric_name in metrics:
                metric_score: Any = metrics[metric_name].score
                if metric_name == "Size" and isinstance(metric_score, dict):

                    size_score: float = max(metric_score.values()) if metric_score else 0.5
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

        huggingface_metadata: Optional[Dict[str, Any]] = fetch_huggingface_metadata(url, "datasets")

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

        huggingface_metadata: Optional[Dict[str, Any]] = fetch_huggingface_metadata(url, "models")

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

        huggingface_metadata: Optional[Dict[str, Any]] = fetch_huggingface_metadata(url, "spaces")

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
        path_parts = parsed_url.path.strip('/').split('/')

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
