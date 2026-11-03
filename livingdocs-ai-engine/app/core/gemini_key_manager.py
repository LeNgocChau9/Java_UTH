"""
gemini_key_manager.py
Module quản lý hồ chứa Gemini API Keys (Multi-Key Pool & Auto-Rotation).
Giải quyết triệt để vấn đề giới hạn Token / Quota (HTTP 429) của Google AI Studio:
1. Hỗ trợ nhiều API Keys cách nhau bởi dấu phẩy trong .env (vd: GEMINI_API_KEY=key1,key2,key3).
2. Xoay vòng (Round-Robin) tự động phân bổ tải giữa các key.
3. Tự động chuyển đổi dự phòng (Auto-Failover) sang key tiếp theo ngay lập tức khi một key gặp 429 Quota Exceeded.
"""

import os
import threading
import logging
from typing import List, Optional
from google import genai
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class GeminiKeyManager:
    _lock = threading.Lock()
    _current_index = 0
    _keys: List[str] = []
    _clients: dict = {}

    @classmethod
    def _load_keys(cls) -> List[str]:
        settings = get_settings()
        raw_keys = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "") or os.getenv("GEMINI_API_KEYS", "")
        
        # Tách danh sách key theo dấu phẩy, chấm phẩy hoặc xuống dòng
        keys = []
        for part in raw_keys.replace(";", ",").replace("\n", ",").split(","):
            cleaned = part.strip()
            if cleaned and cleaned not in keys:
                keys.append(cleaned)
        
        cls._keys = keys
        return keys

    @classmethod
    def get_keys_count(cls) -> int:
        if not cls._keys:
            cls._load_keys()
        return len(cls._keys)

    @classmethod
    def get_active_client(cls) -> genai.Client:
        """
        Lấy Google GenAI Client tương ứng với key hoạt động hiện tại.
        """
        with cls._lock:
            if not cls._keys:
                cls._load_keys()

            if not cls._keys:
                raise ValueError(
                    "Không tìm thấy GEMINI_API_KEY trong file .env hoặc cấu hình hệ thống. "
                    "Vui lòng thêm ít nhất một Gemini API Key."
                )

            key = cls._keys[cls._current_index % len(cls._keys)]
            if key not in cls._clients:
                cls._clients[key] = genai.Client(api_key=key)

            return cls._clients[key]

    @classmethod
    def get_active_api_key(cls) -> str:
        """Lấy chuỗi API Key đang kích hoạt (cho SDK cũ nếu cần)."""
        with cls._lock:
            if not cls._keys:
                cls._load_keys()
            if not cls._keys:
                return ""
            return cls._keys[cls._current_index % len(cls._keys)]

    @classmethod
    def rotate_key(cls, reason: str = "Quota 429") -> str:
        """
        Chuyển sang API Key tiếp theo trong hồ chứa key khi key hiện tại cạn hạn mức.
        """
        with cls._lock:
            if not cls._keys:
                cls._load_keys()

            total = len(cls._keys)
            if total <= 1:
                logger.warning(
                    "Hồ chứa chỉ có 1 API Key, không thể xoay vòng key khác. "
                    "Hãy cấu hình thêm key trong .env (GEMINI_API_KEY=key1,key2...)."
                )
                return cls._keys[0] if cls._keys else ""

            old_idx = cls._current_index % total
            cls._current_index = (cls._current_index + 1) % total
            new_idx = cls._current_index
            new_key = cls._keys[new_idx]

            logger.info(
                "Đã tự động xoay Gemini API Key (từ Key #%d -> Key #%d / Tổng số: %d keys). Lý do: %s",
                old_idx + 1, new_idx + 1, total, reason
            )
            return new_key

