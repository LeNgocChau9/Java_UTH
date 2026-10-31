"""
test_gemini_retry.py
Unit test kiểm thử toàn diện cơ chế Tự động Retry với Exponential Backoff
và bắt lỗi Quota (HTTP 429) cho Google Gemini API (Task Tuần 4 - TV4).
"""

import time
import pytest
from unittest.mock import MagicMock, patch
from google.genai.errors import APIError
from app.core.gemini_retry import (
    execute_with_gemini_retry,
    is_quota_exceeded_error,
    is_transient_error,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
)
from app.schemas.ai_schemas import DocRewriteRequest, DriftAnalyzeRequest
from app.services.gemini_rewrite_service import GeminiRewriteService
from app.services.gemini_drift_service import GeminiDriftService


def test_is_quota_exceeded_detection():
    """Kiểm tra nhận diện chính xác các biến thể của lỗi Quota / 429."""
    # 1. APIError với code=429
    err_429 = APIError(429, {"error": {"message": "RESOURCE_EXHAUSTED: quota exceeded"}})
    assert is_quota_exceeded_error(err_429) is True

    # 2. Chuỗi thông báo có chứa RESOURCE_EXHAUSTED
    err_text = RuntimeError("Google API: Resource has been exhausted (e.g. check quota).")
    assert is_quota_exceeded_error(err_text) is True

    # 3. Lỗi mạng thông thường không phải lỗi quota
    err_net = ConnectionResetError("Connection reset by peer")
    assert is_quota_exceeded_error(err_net) is False


def test_is_transient_error_detection():
    """Kiểm tra nhận diện các lỗi mạng/server tạm thời cần retry."""
    err_503 = APIError(503, {"error": {"message": "Service Unavailable - High Demand"}})
    assert is_transient_error(err_503) is True

    err_500 = APIError(500, {"error": {"message": "Internal Server Error"}})
    assert is_transient_error(err_500) is True

    err_timeout = TimeoutError("Request timed out")
    assert is_transient_error(err_timeout) is True

    # Lỗi 429 không được coi là lỗi transient retry lặp lại
    err_429 = APIError(429, {"error": {"message": "Rate limit exceeded"}})
    assert is_transient_error(err_429) is False


def test_retry_success_after_transient_failures():
    """
    Kịch bản: Hàm gọi Gemini bị lỗi 2 lần đầu (503 / High demand),
    lần thứ 3 thành công.
    Kỳ vọng: Hàm retry 2 lần và trả về kết quả thành công mà không sập tiến trình.
    """
    mock_action = MagicMock()
    mock_action.side_effect = [
        APIError(503, {"error": {"message": "Model overloaded"}}),
        ConnectionResetError("Connection dropped"),
        {"status": "success", "result": "Bản tài liệu cập nhật thành công"}
    ]

    start_time = time.time()
    result = execute_with_gemini_retry(
        action=mock_action,
        max_retries=3,
        initial_delay=0.05,  # Chạy test nhanh với delay nhỏ
        backoff_factor=2.0,
        action_name="TestRetrySuccess"
    )
    elapsed = time.time() - start_time

    assert result["status"] == "success"
    assert mock_action.call_count == 3
    # 0.05s (lần 1) + 0.1s (lần 2) = tối thiểu ~0.15s
    assert elapsed >= 0.12


def test_retry_exhausted_raises_service_unavailable():
    """
    Kịch bản: Lỗi mạng/503 liên tục cả 4 lần (1 lần gốc + 3 lần retry).
    Kỳ vọng: Bắt lỗi, không để sập tiến trình, ném GeminiServiceUnavailableError bằng tiếng Việt.
    """
    mock_action = MagicMock()
    mock_action.side_effect = [
        APIError(503, {"error": {"message": "Service Unavailable"}}),
        APIError(503, {"error": {"message": "Service Unavailable"}}),
        APIError(503, {"error": {"message": "Service Unavailable"}}),
        APIError(503, {"error": {"message": "Service Unavailable"}}),
    ]

    with pytest.raises(GeminiServiceUnavailableError) as exc_info:
        execute_with_gemini_retry(
            action=mock_action,
            max_retries=3,
            initial_delay=0.01,
            backoff_factor=2.0,
            action_name="TestExhausted"
        )

    assert mock_action.call_count == 4
    assert "Dịch vụ Gemini API hiện không phản hồi sau 3 lần thử lại" in exc_info.value.message


def test_quota_429_fails_fast_without_useless_retries():
    """
    Kịch bản: Gặp lỗi Quota 429 (Resource Exhausted).
    Kỳ vọng: Bắt lỗi ngay (Fail-fast), không retry vô nghĩa, trả thông điệp tiếng Việt thân thiện.
    """
    mock_action = MagicMock()
    mock_action.side_effect = APIError(
        429, {"error": {"message": "RESOURCE_EXHAUSTED: quota exceeded"}}
    )

    with pytest.raises(GeminiQuotaExceededError) as exc_info:
        execute_with_gemini_retry(
            action=mock_action,
            max_retries=3,
            initial_delay=0.05,
            backoff_factor=2.0,
            action_name="TestQuotaFastFail"
        )

    # Chỉ gọi 1 lần duy nhất, không lặp lại 3 lần retry
    assert mock_action.call_count == 1
    assert "Hạn mức sử dụng Google Gemini API đã tạm thời cạn kiệt (HTTP 429 Quota Exceeded)" in exc_info.value.message


def test_gemini_rewrite_service_handles_quota_gracefully():
    """
    Kiểm tra dịch vụ GeminiRewriteService bắt gọn lỗi 429 và ném GeminiQuotaExceededError.
    """
    req = DocRewriteRequest(
        current_doc="# Tài liệu thanh toán cũ",
        code_diff="@@ -1,2 +1,2 @@\n-processPayment(orderId)\n+processPayment(orderId, currency)",
        entity_name="PaymentService"
    )

    with patch("app.services.gemini_rewrite_service.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        # Giả lập model quăng lỗi 429
        mock_client.models.generate_content.side_effect = APIError(
            429, {"error": {"message": "Quota exceeded for default project"}}
        )

        with pytest.raises(GeminiQuotaExceededError) as exc_info:
            GeminiRewriteService.rewrite_document(req)

        assert "HTTP 429 Quota Exceeded" in exc_info.value.message


def test_gemini_drift_service_handles_quota_gracefully():
    """
    Kiểm tra dịch vụ GeminiDriftService bắt gọn lỗi 429 và ném GeminiQuotaExceededError.
    """
    req = DriftAnalyzeRequest(
        current_doc="# Tài liệu Order",
        code_diff="@@ -1,1 +1,2 @@\n+String discountCode",
        entity_name="OrderService"
    )

    with patch("app.services.gemini_drift_service.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.models.generate_content.side_effect = APIError(
            429, {"error": {"message": "Resource has been exhausted (quota)"}}
        )

        with pytest.raises(GeminiQuotaExceededError) as exc_info:
            GeminiDriftService.analyze(req)

        assert "HTTP 429 Quota Exceeded" in exc_info.value.message

