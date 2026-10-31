"""
gemini_retry.py
Module cung cấp cơ chế tự động thử lại (Retry với Exponential Backoff) và bắt lỗi Quota (HTTP 429)
dành riêng cho việc gọi Google Gemini API (Task Tuần 4 - TV4).

Yêu cầu nghiệp vụ:
1. Tự động thử lại (Retry tối đa 3 lần với exponential backoff: ví dụ 1s, 2s, 4s) khi gặp lỗi mạng,
   server quá tải (HTTP 500, 502, 503, 504), timeout hoặc lỗi kết nối.
2. Bắt lỗi hết Quota (HTTP 429 - RESOURCE_EXHAUSTED):
   - Không retry vô nghĩa khi quota đã hết hoặc thông báo retry-after quá dài.
   - Bắt trọn lỗi và trả về thông báo lỗi rõ ràng bằng Tiếng Việt thân thiện.
   - Tuyệt đối không để sập tiến trình FastAPI / Python runtime.
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

    # 1. Kiểm tra status code nếu có thuộc tính code / status_code
    status_code = getattr(exception, "code", None) or getattr(exception, "status_code", None)
    if status_code == 429:
        return True

    # 2. Kiểm tra tên class ngoại lệ
    exc_type_name = type(exception).__name__
    if exc_type_name in ("ResourceExhausted", "TooManyRequests", "GeminiQuotaExceededError"):
        return True

    # 3. Phân tích nội dung chuỗi lỗi
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
    Thực thi hàm gọi Gemini API có cơ chế Retry với Exponential Backoff và bắt lỗi Quota.

    Tham số:
    - action: Callable thực hiện gọi Gemini API và trả về kết quả.
    - max_retries: Số lần thử lại tối đa khi gặp lỗi tạm thời (mặc định: 3 lần).
    - initial_delay: Thời gian chờ ban đầu tính bằng giây (mặc định: 1.0s).
    - backoff_factor: Hệ số nhân thời gian chờ theo lũy thừa (mặc định: 2.0 -> 1s, 2s, 4s).
    - action_name: Tên tác vụ để ghi log tường minh.
    """
    delay = initial_delay

    for attempt in range(1, max_retries + 2):
        try:
            return action()

        except Exception as ex:
            # 1. Bắt lỗi Quota 429 ngay lập tức, không retry lặp lại vô nghĩa
            if is_quota_exceeded_error(ex):
                logger.error(
                    "[%s] Phát hiện lỗi Quota / Hạn mức Gemini API (HTTP 429): %s",
                    action_name, ex
                )
                vietnamese_msg = (
                    "Hạn mức sử dụng Google Gemini API đã tạm thời cạn kiệt (HTTP 429 Quota Exceeded). "
                    "Vui lòng đợi vài phút để hạn mức được làm mới hoặc kiểm tra lại gói Gemini API Key."
                )
                raise GeminiQuotaExceededError(message=vietnamese_msg, raw_error=ex) from ex

            # 2. Nếu không phải lỗi tạm thời (ví dụ: 400 Bad Request, 404 Model Not Found, 403 Forbidden)
            # thì không retry vô nghĩa mà ném lỗi ngay để fallback model hoặc thông báo lập tức
            if not is_transient_error(ex):
                logger.warning(
                    "[%s] Lỗi cố định không thể tự phục hồi (%s): %s. Bỏ qua retry để xử lý fallback/báo lỗi ngay.",
                    action_name, type(ex).__name__, ex
                )
                raise ex

            # 3. Nếu là lần thử cuối cùng thì không còn lượt retry
            if attempt > max_retries:
                logger.error(
                    "[%s] Đã thử lại tối đa %d lần thất bại: %s",
                    action_name, max_retries, ex
                )
                vietnamese_msg = (
                    f"Dịch vụ Gemini API hiện không phản hồi sau {max_retries} lần thử lại liên tiếp "
                    f"với exponential backoff. Chi tiết lỗi kỹ thuật: {str(ex)}"
                )
                raise GeminiServiceUnavailableError(message=vietnamese_msg, raw_error=ex) from ex

            # 4. Thực hiện chờ với exponential backoff cho lỗi tạm thời
            logger.warning(
                "[%s] Lỗi mạng/quá tải tạm thời (lần %d/%d): %s. Đang chờ %.1fs trước khi thử lại...",
                action_name, attempt, max_retries, ex, delay
            )
            time.sleep(delay)
            delay *= backoff_factor

