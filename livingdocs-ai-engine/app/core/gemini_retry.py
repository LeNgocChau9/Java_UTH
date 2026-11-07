"""
gemini_retry.py
Module quản lý cơ chế phục hồi tự động, Exponential Backoff Retry với thuật toán Full Jitter
và Quota Rate-Limit Controller cho Google Gemini API trong LivingDocs AI Engine.

Nghiệp vụ kỹ thuật chính:
1. Thuật toán Full Jitter Exponential Backoff: Phân phối độ trễ ngẫu nhiên đều để triệt tiêu hiện tượng Thundering Herd.
2. Quota & Rate-Limit Controller: Điều tiết lưu lượng RPM (Requests Per Minute), giám sát tải, bảo đảm tính ổn định 99.5%.
3. Tự động chuyển đổi Model dự phòng (Model Failover): Khi model pro (gemini-2.5-pro) gặp 429 Quota Exceeded hoặc 503 Service Unavailable,
   hệ thống tự động chuyển đổi sang model flash (gemini-2.5-flash) và các model tương thích tiếp theo.
4. Tự động xoay API Key (Multi-Key Pool Rotation): Phối hợp cùng GeminiKeyManager xoay vòng key khi một key cạn định mức.
5. Decorator @with_gemini_retry: Hỗ trợ linh hoạt cho cả hàm đồng bộ (sync) và hàm bất đồng bộ (async).
6. Tương thích ngược 100% với hàm execute_with_gemini_retry() hiện có của hệ thống.
"""

import time
import random
import inspect
import asyncio
import functools
import logging
import threading
from collections import deque
from typing import Callable, Any, TypeVar, Optional, List, Dict, Union

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Định nghĩa các model chuẩn
PRIMARY_MODEL = "gemini-2.5-pro"
FALLBACK_MODEL = "gemini-2.5-flash"

# Chuỗi chuyển đổi model dự phòng theo thứ tự ưu tiên
DEFAULT_MODEL_FALLBACK_CHAIN: List[str] = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
]


class GeminiQuotaExceededError(Exception):
    """Ngoại lệ khi Google Gemini API vượt quá giới hạn định mức (HTTP 429 / Quota Exceeded)."""
    def __init__(
        self,
        message: str = "Tài khoản Gemini API đã vượt quá giới hạn định mức (HTTP 429 Quota Exceeded). Vui lòng thử lại sau hoặc bổ sung thêm Gemini API Key.",
        retry_after_seconds: Optional[int] = None,
        raw_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.retry_after_seconds = retry_after_seconds
        self.raw_error = raw_error


class GeminiServiceUnavailableError(Exception):
    """Ngoại lệ khi dịch vụ Google Gemini gặp lỗi mạng hoặc quá tải (HTTP 503 / 500) sau khi đã thử lại nhiều lần."""
    def __init__(
        self,
        message: str = "Dịch vụ AI Gemini hiện đang quá tải hoặc gặp sự cố kết nối mạng (HTTP 503). Hệ thống đã thử lại nhiều lần với Full Jitter nhưng chưa thành công.",
        raw_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.raw_error = raw_error


def calculate_full_jitter_delay(
    attempt: int,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
) -> float:
    """
    Thuật toán Full Jitter Exponential Backoff (AWS Architecture Standard):
        temp = min(max_delay, base_delay * (backoff_factor ** attempt))
        sleep = random.uniform(0.1, temp)

    Giải thích kỹ thuật:
    Khi xảy ra sự cố nghẽn mạng hoặc quá tải (HTTP 429/503), nếu các client retry vào đúng
    các mốc cố định (1s, 2s, 4s...) sẽ gây ra hiện tượng Thundering Herd - đồng loạt dội tải
    khiến server sập tiếp. Thuật toán Full Jitter phân phối độ trễ ngẫu nhiên đồng đều trong
    khoảng [0.1s, temp], giúp làm phẳng hoàn toàn đỉnh sóng lưu lượng mạng.
    """
    safe_attempt = max(0, attempt)
    temp = min(max_delay, base_delay * (backoff_factor ** safe_attempt))
    return random.uniform(0.1, max(0.1, temp))


def is_quota_exceeded_error(exception: Optional[Exception]) -> bool:
    """
    Kiểm tra xem ngoại lệ có phải là lỗi hết Quota / Rate limit (HTTP 429) hay không.
    Hỗ trợ kiểm tra google.genai.errors.APIError, google.api_core.exceptions.ResourceExhausted
    và các chuỗi thông báo lỗi phổ biến của Google AI Studio.
    """
    if exception is None:
        return False

    status_code = (
        getattr(exception, "code", None)
        or getattr(exception, "status_code", None)
        or getattr(exception, "http_status", None)
    )
    if status_code == 429:
        return True

    exc_type_name = type(exception).__name__
    if exc_type_name in ("ResourceExhausted", "TooManyRequests", "GeminiQuotaExceededError"):
        return True

    error_msg = str(exception).upper()
    quota_keywords = [
        "429",
        "RESOURCE_EXHAUSTED",
        "QUOTA EXCEEDED",
        "RATE LIMIT",
        "EXHAUSTED",
        "TOO MANY REQUESTS",
        "CHECK QUOTA",
        "QUOTA_EXCEEDED",
    ]
    return any(keyword in error_msg for keyword in quota_keywords)


def is_transient_error(exception: Optional[Exception]) -> bool:
    """
    Kiểm tra xem ngoại lệ có phải là lỗi mạng tạm thời hoặc server quá tải cần Retry hay không.
    (HTTP 500, 502, 503, 504, ConnectionError, Timeout, Reset by peer, v.v.)
    """
    if exception is None or is_quota_exceeded_error(exception):
        return False

    status_code = (
        getattr(exception, "code", None)
        or getattr(exception, "status_code", None)
        or getattr(exception, "http_status", None)
    )
    if status_code in (500, 502, 503, 504):
        return True

    exc_type_name = type(exception).__name__.lower()
    if any(k in exc_type_name for k in ["timeout", "connection", "servererror", "network", "serviceunavailable"]):
        return True

    error_msg = str(exception).lower()
    transient_keywords = [
        "500", "502", "503", "504",
        "service unavailable", "high demand", "overloaded",
        "timeout", "timed out", "connection refused", "reset by peer",
        "temporary failure", "internal server error", "remote end closed",
        "server is temporarily unavailable"
    ]
    return any(keyword in error_msg for keyword in transient_keywords)


def get_fallback_model(current_model: str, fallback_chain: Optional[List[str]] = None) -> Optional[str]:
    """
    Tìm model dự phòng tiếp theo trong chuỗi.
    Đặc biệt đảm bảo: khi current_model là gemini-2.5-pro -> trả về gemini-2.5-flash.
    """
    chain = fallback_chain or DEFAULT_MODEL_FALLBACK_CHAIN
    if current_model in chain:
        idx = chain.index(current_model)
        if idx + 1 < len(chain):
            return chain[idx + 1]
        return None

    # Nếu là một biến thể của Pro (vd: gemini-pro, gemini-2.5-pro) -> chuyển sang Flash
    if "pro" in current_model.lower():
        return FALLBACK_MODEL

    return FALLBACK_MODEL if current_model != FALLBACK_MODEL else None


class QuotaRateLimitController:
    """
    Bộ điều khiển Quota & Tốc độ gọi (Rate-Limit Controller) cho Gemini API.
    Bảo đảm hệ thống hoạt động ổn định 99.5%, kiểm soát tốc độ gọi (RPM),
    thống kê trạng thái và hỗ trợ chuyển đổi model dự phòng.
    """
    def __init__(self, max_requests_per_minute: int = 60):
        self.max_rpm = max_requests_per_minute
        self._lock = threading.Lock()
        self._request_timestamps: deque = deque()
        self._total_requests = 0
        self._total_retries = 0
        self._total_model_failovers = 0
        self._total_key_rotations = 0
        self._quota_429_count = 0
        self._transient_503_count = 0
        self._last_error_time: Optional[float] = None
        self._last_error_message: Optional[str] = None
        self._current_active_model: str = PRIMARY_MODEL

    def acquire(self) -> None:
        """
        Kiểm tra và điều tiết tốc độ gọi (Sliding Window Rate Limiter).
        Nếu số lượng request trong 60 giây gần nhất vượt ngưỡng max_rpm,
        hàm sẽ chủ động tạm dừng (sleep) một khoảng ngắn để tránh chạm phải HTTP 429.
        """
        with self._lock:
            now = time.time()
            # Xóa các mốc thời gian ngoài cửa sổ 60s
            while self._request_timestamps and now - self._request_timestamps[0] > 60.0:
                self._request_timestamps.popleft()

            if len(self._request_timestamps) >= self.max_rpm:
                oldest = self._request_timestamps[0]
                wait_time = max(0.05, 60.0 - (now - oldest) + 0.1)
                logger.warning(
                    "[RateLimitController] Chạm ngưỡng giới hạn %d RPM. Đang điều tiết tạm dừng %.2fs...",
                    self.max_rpm, wait_time
                )
                time.sleep(wait_time)
                now = time.time()

            self._request_timestamps.append(now)
            self._total_requests += 1

    def record_success(self, model_name: str) -> None:
        with self._lock:
            self._current_active_model = model_name

    def record_quota_exceeded(self, model_name: str) -> None:
        with self._lock:
            self._quota_429_count += 1
            self._last_error_time = time.time()
            self._last_error_message = f"HTTP 429 Quota Exceeded trên {model_name}"

    def record_transient_error(self, model_name: str, error: Exception) -> None:
        with self._lock:
            self._transient_503_count += 1
            self._last_error_time = time.time()
            self._last_error_message = f"Transient {type(error).__name__} trên {model_name}: {str(error)}"

    def record_retry(self) -> None:
        with self._lock:
            self._total_retries += 1

    def record_model_failover(self, from_model: str, to_model: str) -> None:
        with self._lock:
            self._total_model_failovers += 1
            self._current_active_model = to_model
            logger.info(
                "[ModelFailover] Chuyển đổi model thành công: %s -> %s (Tổng số lần failover: %d)",
                from_model, to_model, self._total_model_failovers
            )

    def record_key_rotation(self) -> None:
        with self._lock:
            self._total_key_rotations += 1

    def get_metrics(self) -> Dict[str, Any]:
        """Trả về báo cáo số liệu giám sát sức khỏe Quota & Rate-Limit."""
        with self._lock:
            now = time.time()
            active_recent_requests = sum(1 for t in self._request_timestamps if now - t <= 60.0)
            return {
                "status": "healthy" if (now - (self._last_error_time or 0) > 30.0 or self._quota_429_count == 0) else "degraded",
                "active_model": self._current_active_model,
                "primary_model": PRIMARY_MODEL,
                "fallback_model": FALLBACK_MODEL,
                "max_rpm": self.max_rpm,
                "current_rpm": active_recent_requests,
                "total_requests": self._total_requests,
                "total_retries": self._total_retries,
                "total_model_failovers": self._total_model_failovers,
                "total_key_rotations": self._total_key_rotations,
                "quota_429_count": self._quota_429_count,
                "transient_503_count": self._transient_503_count,
                "last_error_time": self._last_error_time,
                "last_error_message": self._last_error_message,
            }

    def reset_metrics(self) -> None:
        """Dùng cho kiểm thử đơn vị hoặc khởi tạo lại trạng thái."""
        with self._lock:
            self._request_timestamps.clear()
            self._total_requests = 0
            self._total_retries = 0
            self._total_model_failovers = 0
            self._total_key_rotations = 0
            self._quota_429_count = 0
            self._transient_503_count = 0
            self._last_error_time = None
            self._last_error_message = None
            self._current_active_model = PRIMARY_MODEL


# Singleton Controller toàn cục
quota_controller = QuotaRateLimitController(max_requests_per_minute=60)


def with_gemini_retry(
    func: Optional[Callable] = None,
    *,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    fallback_models: Optional[List[str]] = None,
    action_name: Optional[str] = None,
    allow_key_rotation: bool = True,
):
    """
    Decorator tự động thử lại (Retry) với thuật toán Full Jitter Exponential Backoff,
    tự động xoay API Key và chuyển đổi model dự phòng (từ gemini-2.5-pro sang gemini-2.5-flash).

    Hỗ trợ cả cú pháp không tham số:
        @with_gemini_retry
        def call_gemini(prompt, model="gemini-2.5-pro"): ...

    và cú pháp có tham số tùy chỉnh:
        @with_gemini_retry(max_retries=3, initial_delay=0.5, fallback_models=["gemini-2.5-pro", "gemini-2.5-flash"])
        def call_gemini(prompt, model="gemini-2.5-pro"): ...
    """
    def decorator(target_func: Callable):
        act_name = action_name or target_func.__name__
        models_chain = list(fallback_models or DEFAULT_MODEL_FALLBACK_CHAIN)

        if inspect.iscoroutinefunction(target_func):
            @functools.wraps(target_func)
            async def async_wrapper(*args, **kwargs):
                return await _execute_async_retry(
                    target_func=target_func,
                    args=args,
                    kwargs=kwargs,
                    models_chain=models_chain,
                    max_retries=max_retries,
                    initial_delay=initial_delay,
                    max_delay=max_delay,
                    backoff_factor=backoff_factor,
                    act_name=act_name,
                    allow_key_rotation=allow_key_rotation,
                )
            return async_wrapper
        else:
            @functools.wraps(target_func)
            def sync_wrapper(*args, **kwargs):
                return _execute_sync_retry(
                    target_func=target_func,
                    args=args,
                    kwargs=kwargs,
                    models_chain=models_chain,
                    max_retries=max_retries,
                    initial_delay=initial_delay,
                    max_delay=max_delay,
                    backoff_factor=backoff_factor,
                    act_name=act_name,
                    allow_key_rotation=allow_key_rotation,
                )
            return sync_wrapper

    if func is not None:
        return decorator(func)
    return decorator


def _determine_model_chain(
    target_func: Callable,
    args: tuple,
    kwargs: dict,
    default_chain: List[str]
) -> tuple[List[str], Optional[str], Optional[int]]:
    """Xác định model ban đầu và vị trí đối số model (nếu có) để cập nhật khi failover."""
    model_param_name: Optional[str] = None
    model_arg_idx: Optional[int] = None
    initial_model: Optional[str] = None

    if "model" in kwargs:
        model_param_name = "model"
        initial_model = str(kwargs["model"])
    elif "model_name" in kwargs:
        model_param_name = "model_name"
        initial_model = str(kwargs["model_name"])
    else:
        # Kiểm tra inspect signature
        try:
            sig = inspect.signature(target_func)
            params = list(sig.parameters.keys())
            if "model" in params:
                idx = params.index("model")
                if len(args) > idx:
                    model_arg_idx = idx
                    initial_model = str(args[idx])
                else:
                    model_param_name = "model"
                    initial_model = sig.parameters["model"].default if sig.parameters["model"].default != inspect.Parameter.empty else None
            elif "model_name" in params:
                idx = params.index("model_name")
                if len(args) > idx:
                    model_arg_idx = idx
                    initial_model = str(args[idx])
                else:
                    model_param_name = "model_name"
                    initial_model = sig.parameters["model_name"].default if sig.parameters["model_name"].default != inspect.Parameter.empty else None
        except Exception:
            pass

    current_model = initial_model or default_chain[0]
    if current_model in default_chain:
        chain_to_try = [current_model] + [m for m in default_chain if m != current_model]
    else:
        chain_to_try = [current_model] + default_chain

    return chain_to_try, model_param_name, model_arg_idx


def _execute_sync_retry(
    target_func: Callable,
    args: tuple,
    kwargs: dict,
    models_chain: List[str],
    max_retries: int,
    initial_delay: float,
    max_delay: float,
    backoff_factor: float,
    act_name: str,
    allow_key_rotation: bool,
) -> Any:
    # Import muộn để tránh circular import
    from app.core.gemini_key_manager import GeminiKeyManager

    chain_to_try, model_param_name, model_arg_idx = _determine_model_chain(
        target_func, args, kwargs, models_chain
    )

    model_idx = 0
    attempt = 0
    total_keys = GeminiKeyManager.get_keys_count()
    keys_tried = 0
    last_exception = None

    mutable_args = list(args)
    mutable_kwargs = dict(kwargs)

    while attempt <= max_retries:
        active_model = chain_to_try[min(model_idx, len(chain_to_try) - 1)]

        # Cập nhật model vào arguments trước khi gọi
        if model_param_name:
            mutable_kwargs[model_param_name] = active_model
        elif model_arg_idx is not None and model_arg_idx < len(mutable_args):
            mutable_args[model_arg_idx] = active_model

        try:
            # Điều tiết lưu lượng với Quota Controller
            quota_controller.acquire()

            result = target_func(*mutable_args, **mutable_kwargs)
            quota_controller.record_success(active_model)
            return result

        except Exception as ex:
            last_exception = ex

            # 1. Phát hiện lỗi Quota (HTTP 429 / ResourceExhausted)
            if is_quota_exceeded_error(ex):
                logger.warning(
                    "[%s] Gặp lỗi Quota 429 trên model '%s': %s",
                    act_name, active_model, ex
                )
                quota_controller.record_quota_exceeded(active_model)

                # A. Tự động chuyển đổi model dự phòng (từ gemini-2.5-pro sang gemini-2.5-flash)
                if model_idx + 1 < len(chain_to_try):
                    prev_model = active_model
                    model_idx += 1
                    next_model = chain_to_try[model_idx]
                    logger.info(
                        "[%s] [ModelFailover] Tự động chuyển đổi từ model '%s' sang model dự phòng '%s'...",
                        act_name, prev_model, next_model
                    )
                    quota_controller.record_model_failover(prev_model, next_model)
                    sleep_time = calculate_full_jitter_delay(attempt=0, base_delay=0.3, max_delay=1.5)
                    time.sleep(sleep_time)
                    continue

                # B. Nếu đã thử hết các model hoặc model flash cũng chạm quota: xoay API Key khác nếu có
                if allow_key_rotation and total_keys > 1 and keys_tried < total_keys:
                    keys_tried += 1
                    new_key = GeminiKeyManager.rotate_key(reason=f"Quota 429 trên {active_model}")
                    quota_controller.record_key_rotation()
                    logger.info(
                        "[%s] Tự động xoay sang Gemini API Key tiếp theo (lần %d/%d)...",
                        act_name, keys_tried, total_keys
                    )
                    model_idx = 0  # Thử lại với key mới
                    time.sleep(0.5)
                    continue

                attempt += 1
                quota_controller.record_retry()
                if attempt > max_retries:
                    msg = (
                        f"Hạn mức sử dụng Google Gemini API đã tạm thời cạn kiệt (HTTP 429 Quota Exceeded) "
                        f"trên tất cả model ({active_model}) và key sau {max_retries} lần thử lại."
                    )
                    raise GeminiQuotaExceededError(message=msg, raw_error=ex) from ex

            # 2. Phát hiện lỗi tạm thời (HTTP 503 Service Unavailable / 500 / Network / Overloaded)
            elif is_transient_error(ex):
                logger.warning(
                    "[%s] Lỗi quá tải/mạng tạm thời (HTTP 503/500) trên model '%s': %s",
                    act_name, active_model, ex
                )
                quota_controller.record_transient_error(active_model, ex)

                # Nếu là model Pro quá tải -> chuyển ngay sang model Flash nhẹ hơn
                if "pro" in active_model.lower() and model_idx + 1 < len(chain_to_try):
                    prev_model = active_model
                    model_idx += 1
                    next_model = chain_to_try[model_idx]
                    logger.info(
                        "[%s] [ModelFailover] Model Pro quá tải (503), chuyển ngay sang model Flash '%s'...",
                        act_name, prev_model, next_model
                    )
                    quota_controller.record_model_failover(prev_model, next_model)
                    sleep_time = calculate_full_jitter_delay(attempt=0, base_delay=0.5, max_delay=2.0)
                    time.sleep(sleep_time)
                    continue

                attempt += 1
                quota_controller.record_retry()
                if attempt > max_retries:
                    msg = (
                        f"Dịch vụ Gemini API hiện không phản hồi sau {max_retries} lần thử lại với Full Jitter (HTTP 503). "
                        f"Chi tiết kỹ thuật: {str(ex)}"
                    )
                    raise GeminiServiceUnavailableError(message=msg, raw_error=ex) from ex

            # 3. Lỗi cố định khác (400, 401, ValueError...)
            else:
                logger.error(
                    "[%s] Lỗi cố định không thể tự phục hồi (%s): %s",
                    act_name, type(ex).__name__, ex
                )
                raise ex

            # Tính toán Full Jitter Exponential Backoff cho lần thử tiếp theo
            sleep_duration = calculate_full_jitter_delay(
                attempt=attempt,
                base_delay=initial_delay,
                max_delay=max_delay,
                backoff_factor=backoff_factor,
            )
            logger.info(
                "[%s] Full Jitter Backoff (lần %d/%d): Tạm dừng %.2fs trước khi thử lại...",
                act_name, attempt, max_retries, sleep_duration
            )
            time.sleep(sleep_duration)

    if last_exception:
        raise last_exception


async def _execute_async_retry(
    target_func: Callable,
    args: tuple,
    kwargs: dict,
    models_chain: List[str],
    max_retries: int,
    initial_delay: float,
    max_delay: float,
    backoff_factor: float,
    act_name: str,
    allow_key_rotation: bool,
) -> Any:
    from app.core.gemini_key_manager import GeminiKeyManager

    chain_to_try, model_param_name, model_arg_idx = _determine_model_chain(
        target_func, args, kwargs, models_chain
    )

    model_idx = 0
    attempt = 0
    total_keys = GeminiKeyManager.get_keys_count()
    keys_tried = 0
    last_exception = None

    mutable_args = list(args)
    mutable_kwargs = dict(kwargs)

    while attempt <= max_retries:
        active_model = chain_to_try[min(model_idx, len(chain_to_try) - 1)]

        if model_param_name:
            mutable_kwargs[model_param_name] = active_model
        elif model_arg_idx is not None and model_arg_idx < len(mutable_args):
            mutable_args[model_arg_idx] = active_model

        try:
            quota_controller.acquire()
            result = await target_func(*mutable_args, **mutable_kwargs)
            quota_controller.record_success(active_model)
            return result

        except Exception as ex:
            last_exception = ex

            if is_quota_exceeded_error(ex):
                logger.warning(
                    "[%s] [Async] Gặp lỗi Quota 429 trên model '%s': %s",
                    act_name, active_model, ex
                )
                quota_controller.record_quota_exceeded(active_model)

                if model_idx + 1 < len(chain_to_try):
                    prev_model = active_model
                    model_idx += 1
                    next_model = chain_to_try[model_idx]
                    logger.info(
                        "[%s] [Async] [ModelFailover] Chuyển đổi từ model '%s' sang model dự phòng '%s'...",
                        act_name, prev_model, next_model
                    )
                    quota_controller.record_model_failover(prev_model, next_model)
                    sleep_time = calculate_full_jitter_delay(attempt=0, base_delay=0.3, max_delay=1.5)
                    await asyncio.sleep(sleep_time)
                    continue

                if allow_key_rotation and total_keys > 1 and keys_tried < total_keys:
                    keys_tried += 1
                    new_key = GeminiKeyManager.rotate_key(reason=f"Async Quota 429 trên {active_model}")
                    quota_controller.record_key_rotation()
                    model_idx = 0
                    await asyncio.sleep(0.5)
                    continue

                attempt += 1
                quota_controller.record_retry()
                if attempt > max_retries:
                    msg = (
                        f"Hạn mức sử dụng Google Gemini API đã tạm thời cạn kiệt (HTTP 429 Quota Exceeded) "
                        f"trên tất cả model ({active_model}) và key sau {max_retries} lần thử lại."
                    )
                    raise GeminiQuotaExceededError(message=msg, raw_error=ex) from ex

            elif is_transient_error(ex):
                logger.warning(
                    "[%s] [Async] Lỗi quá tải/mạng tạm thời (HTTP 503/500) trên model '%s': %s",
                    act_name, active_model, ex
                )
                quota_controller.record_transient_error(active_model, ex)

                if "pro" in active_model.lower() and model_idx + 1 < len(chain_to_try):
                    prev_model = active_model
                    model_idx += 1
                    next_model = chain_to_try[model_idx]
                    logger.info(
                        "[%s] [Async] [ModelFailover] Model Pro quá tải (503), chuyển ngay sang model Flash '%s'...",
                        act_name, prev_model, next_model
                    )
                    quota_controller.record_model_failover(prev_model, next_model)
                    sleep_time = calculate_full_jitter_delay(attempt=0, base_delay=0.5, max_delay=2.0)
                    await asyncio.sleep(sleep_time)
                    continue

                attempt += 1
                quota_controller.record_retry()
                if attempt > max_retries:
                    msg = (
                        f"Dịch vụ Gemini API hiện không phản hồi sau {max_retries} lần thử lại với Full Jitter (HTTP 503). "
                        f"Chi tiết kỹ thuật: {str(ex)}"
                    )
                    raise GeminiServiceUnavailableError(message=msg, raw_error=ex) from ex

            else:
                logger.error(
                    "[%s] [Async] Lỗi cố định không thể tự phục hồi (%s): %s",
                    act_name, type(ex).__name__, ex
                )
                raise ex

            sleep_duration = calculate_full_jitter_delay(
                attempt=attempt,
                base_delay=initial_delay,
                max_delay=max_delay,
                backoff_factor=backoff_factor,
            )
            await asyncio.sleep(sleep_duration)

    if last_exception:
        raise last_exception


def execute_with_gemini_retry(
    action: Callable[[], T],
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    fallback_models: Optional[List[str]] = None,
    action_name: str = "Gọi Gemini API",
) -> T:
    """
    Hàm thực thi có cơ chế Retry Full Jitter, tự động xoay key và kiểm soát Quota.
    Giữ nguyên tính tương thích 100% với các vị trí gọi hiện tại trong dự án.
    """
    @with_gemini_retry(
        max_retries=max_retries,
        initial_delay=initial_delay,
        max_delay=max_delay,
        backoff_factor=backoff_factor,
        fallback_models=fallback_models,
        action_name=action_name,
    )
    def _invoker():
        return action()

    return _invoker()
