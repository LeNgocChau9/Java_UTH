"""
gemini_retry.py
Module cung cấp cơ chế tự động thử lại (Retry với Exponential Backoff),
bắt lỗi Quota (HTTP 429) và tự động xoay API Key (Multi-Key Rotation Pool).
"""

import time
import logging
from typing import Callable, Any, TypeVar, Optional

logger = logging.getLogger(__name__)

T = TypeVar("T")


class GeminiQuotaExceededError(Exception):
    """Ngoại lệ khi Google Gemini API vượt quá giới hạn lượt dùng (HTTP 429 / Quota Exceeded)."""
    def __init__(
        self,
        message: str = "Tài khoản Gemini API đã vượt quá giới hạn định mức (Quota Exceeded / Rate Limit). Vui lòng thử lại sau hoặc nâng cấp gói API.",
        retry_after_seconds: Optional[int] = None,
        raw_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.retry_after_seconds = retry_after_seconds
        self.raw_error = raw_error


class GeminiServiceUnavailableError(Exception):
    """Ngoại lệ khi dịch vụ Google Gemini gặp lỗi mạng hoặc quá tải sau khi đã thử lại nhiều lần."""
    def __init__(
        self,
        message: str = "Dịch vụ AI Gemini hiện đang quá tải hoặc gặp sự cố kết nối mạng. Hệ thống đã thử lại 3 lần nhưng không thành công.",
        raw_error: Optional[Exception] = None
    ):
        super().__init__(message)
        self.message = message
        self.raw_error = raw_error


def is_quota_exceeded_error(exception: Exception) -> bool:
    """
    Kiểm tra xem ngoại lệ có phải là lỗi hết Quota / Rate limit (HTTP 429) hay không.
    Hỗ trợ kiểm tra cả google.genai.errors.APIError, google.api_core.exceptions.ResourceExhausted
    và các chuỗi thông điệp lỗi phổ biến.
    """
    if exception is None:
        return False

    status_code = getattr(exception, "code", None) or getattr(exception, "status_code", None)
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
    ]
    return any(keyword in error_msg for keyword in quota_keywords)


def is_transient_error(exception: Exception) -> bool:
    """
    Kiểm tra xem ngoại lệ có phải là lỗi mạng tạm thời hoặc server quá tải cần Retry hay không.
    (HTTP 500, 502, 503, 504, ConnectionError, Timeout, v.v.)
    """
    if is_quota_exceeded_error(exception):
        return False

    status_code = getattr(exception, "code", None) or getattr(exception, "status_code", None)
    if status_code in (500, 502, 503, 504):
        return True

    exc_type_name = type(exception).__name__.lower()
    if any(k in exc_type_name for k in ["timeout", "connection", "servererror", "network"]):
        return True

    error_msg = str(exception).lower()
    transient_keywords = [
        "500", "502", "503", "504",
        "unavailable", "high demand", "overloaded",
        "timeout", "connection refused", "reset by peer",
        "temporary failure", "internal server error"
    ]
    return any(keyword in error_msg for keyword in transient_keywords)


def execute_with_gemini_retry(
    action: Callable[[], T],
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    action_name: str = "Gọi Gemini API",
) -> T:
    """
    Thực thi hàm gọi Gemini API có cơ chế Retry với Exponential Backoff,
    tự động xoay API Key khi gặp lỗi Quota (HTTP 429).
    """
    # Import muộn để tránh circular import
    from app.core.gemini_key_manager import GeminiKeyManager

    total_keys = GeminiKeyManager.get_keys_count()
    keys_tried = 0
    delay = initial_delay

    for attempt in range(1, max_retries + 2):
        try:
            return action()

        except Exception as ex:
            # 1. Phát hiện lỗi Quota 429: Thử xoay sang API Key khác nếu có nhiều key
            if is_quota_exceeded_error(ex):
                logger.error(
                    "[%s] Phát hiện lỗi Quota / Hạn mức Gemini API (HTTP 429): %s",
                    action_name, ex
                )
                if total_keys > 1 and keys_tried < total_keys:
                    keys_tried += 1
                    new_key = GeminiKeyManager.rotate_key(reason=f"Quota 429 trên lượt gọi {attempt}")
                    logger.info(
                        "[%s] Tự động chuyển đổi sang Gemini API Key dự phòng (lần %d/%d)...",
                        action_name, keys_tried, total_keys
                    )
                    time.sleep(0.5)
                    continue

                vietnamese_msg = (
                    "Hạn mức sử dụng Google Gemini API đã tạm thời cạn kiệt (HTTP 429 Quota Exceeded). "
                    "Vui lòng đợi vài phút để hạn mức được làm mới hoặc bổ sung thêm Gemini API Key vào file .env."
                )
                raise GeminiQuotaExceededError(message=vietnamese_msg, raw_error=ex) from ex

            # 2. Nếu không phải lỗi tạm thời -> ném lỗi ngay
            if not is_transient_error(ex):
                logger.warning(
                    "[%s] Lỗi cố định không thể tự phục hồi (%s): %s. Bỏ qua retry để báo lỗi ngay.",
                    action_name, type(ex).__name__, ex
                )
                raise ex

            # 3. Quá số lần retry tối đa
            if attempt > max_retries:
                logger.error(
                    "[%s] Đã thử lại tối đa %d lần thất bại: %s",
                    action_name, max_retries, ex
                )
                vietnamese_msg = (
                    f"Dịch vụ Gemini API hiện không phản hồi sau {max_retries} lần thử lại liên tiếp. "
                    f"Chi tiết lỗi kỹ thuật: {str(ex)}"
                )
                raise GeminiServiceUnavailableError(message=vietnamese_msg, raw_error=ex) from ex

            # 4. Chờ với exponential backoff
            logger.warning(
                "[%s] Lỗi mạng/quá tải tạm thời (lần %d/%d): %s. Đang chờ %.1fs trước khi thử lại...",
                action_name, attempt, max_retries, ex, delay
            )
            time.sleep(delay)
            delay *= backoff_factor
