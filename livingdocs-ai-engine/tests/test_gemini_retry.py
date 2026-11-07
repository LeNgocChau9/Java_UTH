"""
test_gemini_retry.py
Bộ kiểm thử đơn vị (Unit Tests) cho module gemini_retry.py:
1. Thuật toán Full Jitter Exponential Backoff.
2. Phân loại lỗi Quota (HTTP 429) và lỗi tạm thời (HTTP 503/500).
3. Cơ chế Quota Rate-Limit Controller.
4. Tự động chuyển đổi Model dự phòng (gemini-2.5-pro -> gemini-2.5-flash).
5. Decorator @with_gemini_retry (đồng bộ & bất đồng bộ).
6. Hàm execute_with_gemini_retry().
"""

import asyncio
import unittest
from unittest.mock import MagicMock, patch

from app.core.gemini_retry import (
    calculate_full_jitter_delay,
    is_quota_exceeded_error,
    is_transient_error,
    get_fallback_model,
    QuotaRateLimitController,
    with_gemini_retry,
    execute_with_gemini_retry,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
    PRIMARY_MODEL,
    FALLBACK_MODEL,
    DEFAULT_MODEL_FALLBACK_CHAIN,
)


class MockAPIError(Exception):
    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class ResourceExhausted(Exception):
    pass


class TestGeminiRetry(unittest.TestCase):

    def test_full_jitter_delay_bounds(self):
        """Kiểm tra thời gian chờ của Full Jitter luôn nằm trong cận [0.1, cap]."""
        base = 1.0
        cap = 30.0
        factor = 2.0

        for attempt in range(5):
            expected_max = min(cap, base * (factor ** attempt))
            for _ in range(50):
                delay = calculate_full_jitter_delay(attempt, base_delay=base, max_delay=cap, backoff_factor=factor)
                self.assertGreaterEqual(delay, 0.1)
                self.assertLessEqual(delay, expected_max + 1e-6)

    def test_full_jitter_randomness(self):
        """Kiểm tra Full Jitter tạo ra các độ trễ phân tán ngẫu nhiên (chống Thundering Herd)."""
        delays = [calculate_full_jitter_delay(attempt=3, base_delay=1.0, max_delay=20.0) for _ in range(20)]
        # Xác suất để 20 giá trị float ngẫu nhiên trùng khớp hoàn toàn là xấp xỉ 0
        self.assertGreater(len(set(delays)), 10)

    def test_is_quota_exceeded_error(self):
        """Kiểm tra nhận diện chính xác các lỗi HTTP 429 và Quota Exceeded."""
        self.assertTrue(is_quota_exceeded_error(MockAPIError(429, "Resource exhausted: quota exceeded")))
        self.assertTrue(is_quota_exceeded_error(ResourceExhausted("Rate limit reached")))
        self.assertTrue(is_quota_exceeded_error(Exception("429 Too Many Requests")))
        self.assertTrue(is_quota_exceeded_error(Exception("check quota at Google Cloud Console")))
        self.assertTrue(is_quota_exceeded_error(GeminiQuotaExceededError()))

        # Không phải lỗi quota
        self.assertFalse(is_quota_exceeded_error(None))
        self.assertFalse(is_quota_exceeded_error(MockAPIError(503, "Service unavailable")))
        self.assertFalse(is_quota_exceeded_error(ValueError("Invalid argument")))

    def test_is_transient_error(self):
        """Kiểm tra nhận diện chính xác lỗi mạng tạm thời HTTP 500, 502, 503, 504."""
        self.assertTrue(is_transient_error(MockAPIError(503, "Service Unavailable: high demand")))
        self.assertTrue(is_transient_error(MockAPIError(500, "Internal Server Error")))
        self.assertTrue(is_transient_error(Exception("Connection reset by peer")))
        self.assertTrue(is_transient_error(Exception("Timeout connecting to server")))
        self.assertTrue(is_transient_error(Exception("503 server is temporarily overloaded")))

        # Lỗi 429 không được tính là transient thông thường (vì cần xử lý quota riêng)
        self.assertFalse(is_transient_error(MockAPIError(429, "Quota exceeded")))
        # Lỗi 400 Bad Request không phải lỗi tạm thời
        self.assertFalse(is_transient_error(MockAPIError(400, "Invalid parameter")))

    def test_get_fallback_model(self):
        """Kiểm tra tự động chọn model dự phòng từ gemini-2.5-pro sang gemini-2.5-flash."""
        self.assertEqual(get_fallback_model("gemini-2.5-pro"), "gemini-2.5-flash")
        self.assertEqual(get_fallback_model("gemini-2.5-flash"), "gemini-2.0-flash")
        self.assertEqual(get_fallback_model("custom-pro-model"), "gemini-2.5-flash")

    def test_quota_controller_metrics(self):
        """Kiểm tra QuotaRateLimitController ghi nhận và báo cáo số liệu chính xác."""
        controller = QuotaRateLimitController(max_requests_per_minute=30)
        controller.reset_metrics()

        controller.acquire()
        controller.record_success("gemini-2.5-pro")
        controller.record_model_failover("gemini-2.5-pro", "gemini-2.5-flash")
        controller.record_quota_exceeded("gemini-2.5-pro")
        controller.record_transient_error("gemini-2.5-flash", MockAPIError(503, "Overloaded"))
        controller.record_retry()
        controller.record_key_rotation()

        metrics = controller.get_metrics()
        self.assertEqual(metrics["total_requests"], 1)
        self.assertEqual(metrics["total_model_failovers"], 1)
        self.assertEqual(metrics["quota_429_count"], 1)
        self.assertEqual(metrics["transient_503_count"], 1)
        self.assertEqual(metrics["total_retries"], 1)
        self.assertEqual(metrics["total_key_rotations"], 1)
        self.assertEqual(metrics["active_model"], "gemini-2.5-flash")

    def test_with_gemini_retry_sync_success_first_try(self):
        """Kiểm tra decorator thực thi thành công ngay lần đầu nếu không có lỗi."""
        @with_gemini_retry
        def mock_generate(text: str) -> str:
            return f"Generated: {text}"

        res = mock_generate("LivingDocs")
        self.assertEqual(res, "Generated: LivingDocs")

    def test_with_gemini_retry_transient_error_recovery(self):
        """Kiểm tra tự động thử lại thành công khi gặp lỗi 503 tạm thời."""
        calls = []

        @with_gemini_retry(max_retries=3, initial_delay=0.01)
        def flaky_api():
            calls.append(1)
            if len(calls) < 2:
                raise MockAPIError(503, "Service temporarily overloaded")
            return "SUCCESS"

        res = flaky_api()
        self.assertEqual(res, "SUCCESS")
        self.assertEqual(len(calls), 2)

    def test_with_gemini_retry_model_failover(self):
        """Kiểm tra chuyển đổi tự động từ gemini-2.5-pro sang gemini-2.5-flash khi gặp Quota 429."""
        models_attempted = []

        @with_gemini_retry(
            max_retries=3,
            initial_delay=0.01,
            fallback_models=["gemini-2.5-pro", "gemini-2.5-flash"],
            allow_key_rotation=False
        )
        def call_llm(model: str = "gemini-2.5-pro") -> str:
            models_attempted.append(model)
            if model == "gemini-2.5-pro":
                raise MockAPIError(429, "Quota exceeded on Pro tier")
            return f"Success with {model}"

        res = call_llm(model="gemini-2.5-pro")
        self.assertIn("Success with gemini-2.5-flash", res)
        self.assertEqual(models_attempted, ["gemini-2.5-pro", "gemini-2.5-flash"])

    def test_with_gemini_retry_exhausted_raises_typed_error(self):
        """Kiểm tra khi hết số lần retry thì ném ngoại lệ rõ ràng, không crash unhandled."""
        @with_gemini_retry(max_retries=2, initial_delay=0.01, allow_key_rotation=False)
        def dead_api():
            raise MockAPIError(503, "Permanent outage")

        with self.assertRaises(GeminiServiceUnavailableError):
            dead_api()

    def test_with_gemini_retry_non_retryable_error(self):
        """Kiểm tra lỗi cố định (ví dụ ValueError) ném lỗi ngay mà không retry lặp vô ích."""
        calls = []

        @with_gemini_retry(max_retries=3)
        def bad_input_api():
            calls.append(1)
            raise ValueError("Invalid prompt format")

        with self.assertRaises(ValueError):
            bad_input_api()

        self.assertEqual(len(calls), 1)

    def test_execute_with_gemini_retry_backward_compatibility(self):
        """Kiểm tra hàm execute_with_gemini_retry tương thích ngược hoàn hảo với code hiện hữu."""
        counter = 0

        def action():
            nonlocal counter
            counter += 1
            if counter == 1:
                raise MockAPIError(503, "Temporary network glitch")
            return {"status": "ok", "retries": counter}

        result = execute_with_gemini_retry(
            action=action,
            max_retries=3,
            initial_delay=0.01,
            action_name="TestCompat"
        )
        self.assertEqual(result["status"], "ok")
        self.assertEqual(counter, 2)

    def test_quota_metrics_endpoint_function(self):
        """Kiểm tra hàm get_quota_metrics trả về đúng cấu trúc của Rate-Limit Controller."""
        from app.api.endpoints import get_quota_metrics
        res = get_quota_metrics()
        self.assertIn("status", res)
        self.assertIn("active_model", res)
        self.assertIn("fallback_model", res)
        self.assertEqual(res["primary_model"], "gemini-2.5-pro")
        self.assertEqual(res["fallback_model"], "gemini-2.5-flash")
        self.assertIn("max_rpm", res)


if __name__ == "__main__":
    unittest.main()
