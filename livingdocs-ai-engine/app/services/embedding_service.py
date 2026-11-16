"""
embedding_service.py
Dịch vụ tạo vector embedding 768 chiều chuẩn hóa L2 cho LivingDocs AI Engine.
Ưu tiên Google Gemini (text-embedding-004), tự động failover sang Ollama Local (nomic-embed-text).
"""

import math
import logging
from typing import List, Optional
import httpx
from google import genai
from fastapi import HTTPException

from app.core.config import get_settings
from app.core.gemini_key_manager import GeminiKeyManager
from app.schemas.ai_schemas import EmbeddingRequest, EmbeddingResponse
from app.services.gemini_doc_service import GeminiDocService

logger = logging.getLogger(__name__)

TARGET_DIMENSION = 768


def l2_normalize(vector: List[float], target_dim: int = TARGET_DIMENSION) -> List[float]:
    """
    Chuẩn hóa vector theo độ đo khoảng cách L2 và đảm bảo đúng số chiều target_dim.
    Tổng bình phương các phần tử sau khi chuẩn hóa sẽ xấp xỉ 1.0.
    """
    if not vector:
        return [0.0] * target_dim

    # Cắt gọn hoặc bổ sung 0.0 nếu khác kích thước
    if len(vector) > target_dim:
        vec = vector[:target_dim]
    elif len(vector) < target_dim:
        vec = vector + [0.0] * (target_dim - len(vector))
    else:
        vec = list(vector)

    norm = math.sqrt(sum(float(x) * float(x) for x in vec))
    if norm > 1e-12:
        return [float(x / norm) for x in vec]
    return vec


class EmbeddingService:

    @classmethod
    def create_embedding(cls, request: EmbeddingRequest) -> EmbeddingResponse:
        """
        Tạo vector embedding 768 chiều chuẩn hóa L2:
        - provider='gemini' hoặc 'cloud_only': Chỉ gọi Gemini text-embedding-004.
        - provider='ollama' hoặc 'local_only': Chỉ gọi Ollama nomic-embed-text.
        - provider='auto' (mặc định): Thử Gemini trước; nếu không có key hoặc lỗi, failover sang Ollama.
        """
        text = (request.text or "").strip()
        if not text:
            # Vector 0 nếu text rỗng
            return EmbeddingResponse(
                embedding=[0.0] * TARGET_DIMENSION,
                dimension=TARGET_DIMENSION,
                provider="none",
                model="empty",
            )

        provider = (request.provider or request.routing_mode or "auto").lower()

        # 1. Chỉ định Ollama Local
        if provider in ("ollama", "local_only"):
            return cls._embed_ollama(request, text)

        # 2. Chỉ định Gemini Cloud
        if provider in ("gemini", "cloud_only"):
            return cls._embed_gemini(request, text)

        # 3. Chế độ 'auto': Thử Gemini -> Failover Ollama
        gemini_key = request.api_key or GeminiKeyManager.get_active_api_key()
        if GeminiDocService._is_valid_google_api_key(gemini_key):
            try:
                return cls._embed_gemini(request, text)
            except Exception as ex:
                logger.warning(
                    "[EmbeddingService] Gọi Gemini text-embedding-004 thất bại (%s). Chuyển sang Ollama Local failover...",
                    ex,
                )

        # Failover sang Ollama
        try:
            return cls._embed_ollama(request, text)
        except Exception as oex:
            logger.error("[EmbeddingService] Cả Gemini và Ollama đều không thể tạo embedding: %s", oex)
            raise HTTPException(
                status_code=503,
                detail=f"Dịch vụ Embedding không khả dụng trên cả Gemini và Ollama: {oex}",
            )

    @classmethod
    def _embed_gemini(cls, request: EmbeddingRequest, text: str) -> EmbeddingResponse:
        """Tạo embedding bằng Gemini text-embedding-004."""
        api_key = request.api_key or GeminiKeyManager.get_active_api_key()
        if request.api_key and GeminiDocService._is_valid_google_api_key(request.api_key):
            client = genai.Client(api_key=request.api_key.strip().strip("'\""))
        else:
            client = GeminiKeyManager.get_active_client()

        model_name = "text-embedding-004"
        logger.info("[EmbeddingService] Đang gọi Gemini text-embedding-004...")

        resp = client.models.embed_content(
            model=model_name,
            contents=text,
        )

        if not resp.embeddings or not resp.embeddings[0].values:
            raise RuntimeError("Gemini embed_content không trả về giá trị embedding.")

        raw_vec = resp.embeddings[0].values
        norm_vec = l2_normalize(raw_vec, TARGET_DIMENSION)

        return EmbeddingResponse(
            embedding=norm_vec,
            dimension=TARGET_DIMENSION,
            provider="gemini",
            model=model_name,
        )

    @classmethod
    def _embed_ollama(cls, request: EmbeddingRequest, text: str) -> EmbeddingResponse:
        """Tạo embedding bằng Ollama nomic-embed-text (thử /api/embed rồi fallback /api/embeddings)."""
        settings = get_settings()
        base_url = (request.local_ai_url or settings.ollama_base_url or "http://127.0.0.1:11434").rstrip("/")
        model_name = request.local_model or "nomic-embed-text"

        logger.info("[EmbeddingService] Đang gọi Ollama (%s) tại %s...", model_name, base_url)

        # 1. Thử endpoint hiện đại /api/embed
        embed_url = f"{base_url}/api/embed"
        raw_vec = None
        last_error = None

        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post(embed_url, json={"model": model_name, "input": text})
                if res.status_code == 200:
                    data = res.json()
                    embeddings_list = data.get("embeddings", [])
                    if embeddings_list and len(embeddings_list) > 0:
                        raw_vec = embeddings_list[0]
                else:
                    last_error = f"Status {res.status_code}: {res.text}"
        except Exception as ex:
            last_error = str(ex)

        # 2. Nếu /api/embed không thành công, thử endpoint truyền thống /api/embeddings
        if raw_vec is None:
            legacy_url = f"{base_url}/api/embeddings"
            try:
                with httpx.Client(timeout=60.0) as client:
                    res = client.post(legacy_url, json={"model": model_name, "prompt": text})
                    if res.status_code == 200:
                        data = res.json()
                        raw_vec = data.get("embedding", [])
                    else:
                        last_error = f"Status {res.status_code}: {res.text}"
            except Exception as ex:
                last_error = str(ex)

        if not raw_vec:
            raise RuntimeError(f"Ollama embedding thất bại ({last_error})")

        norm_vec = l2_normalize(raw_vec, TARGET_DIMENSION)

        return EmbeddingResponse(
            embedding=norm_vec,
            dimension=TARGET_DIMENSION,
            provider="ollama",
            model=model_name,
        )
