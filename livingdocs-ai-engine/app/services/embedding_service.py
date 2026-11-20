"""
embedding_service.py
Dịch vụ tạo vector embedding 768 chiều chuẩn hóa L2 cho LivingDocs AI Engine.
Ưu tiên Google Gemini (text-embedding-004), tự động failover sang Ollama Local (nomic-embed-text).
"""

import hashlib
import math
import re
import logging
from typing import List, Optional
import httpx
from google import genai

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

        # 1. Chỉ định Ollama / Local Server
        if provider in ("ollama", "local_only"):
            try:
                return cls._embed_ollama(request, text)
            except Exception as oex:
                logger.warning(
                    "[EmbeddingService] Local server không hỗ trợ embedding (%s). Dùng fallback local hash 768d.",
                    oex,
                )
                return cls._embed_local_hash(text)

        # 2. Chỉ định Gemini Cloud
        if provider in ("gemini", "cloud_only"):
            try:
                return cls._embed_gemini(request, text)
            except Exception as gex:
                logger.warning(
                    "[EmbeddingService] Gemini embedding thất bại (%s). Dùng fallback local hash 768d.",
                    gex,
                )
                return cls._embed_local_hash(text)

        # 3. Chế độ 'auto': Thử Gemini -> Failover Ollama -> Fallback local hash 768d
        gemini_key = request.api_key or GeminiKeyManager.get_active_api_key()
        if GeminiDocService._is_valid_google_api_key(gemini_key):
            try:
                return cls._embed_gemini(request, text)
            except Exception as ex:
                logger.warning(
                    "[EmbeddingService] Gọi Gemini embedding thất bại (%s). Chuyển sang Ollama Local failover...",
                    ex,
                )

        # Failover sang Ollama / Local Server
        try:
            return cls._embed_ollama(request, text)
        except Exception as oex:
            logger.warning(
                "[EmbeddingService] Cả Gemini và Local server đều không hỗ trợ embedding (%s). Dùng fallback local hash 768d.",
                oex,
            )
            return cls._embed_local_hash(text)

    @classmethod
    def _embed_local_hash(cls, text: str) -> EmbeddingResponse:
        """
        Fallback offline 768 chiều chuẩn hóa L2 dùng feature hashing (từ + char 3-gram)
        khi local LLM server (ví dụ llama-server) chạy ở chế độ chat không bật --embeddings.
        """
        # ponytail: stdlib feature-hashing fallback avoids crashing RAG when local chat server lacks --embeddings;
        # upgrade by running llama-server with --embeddings or Ollama nomic-embed-text.
        vec = [0.0] * TARGET_DIMENSION
        tokens = re.findall(r"\w+", text.lower())
        features: List[str] = list(tokens)
        for tok in tokens:
            if len(tok) >= 3:
                for i in range(len(tok) - 2):
                    features.append(tok[i : i + 3])

        for feat in features:
            digest = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
            val = int.from_bytes(digest, "little")
            idx = val % TARGET_DIMENSION
            sign = 1.0 if ((val >> 16) & 1) == 0 else -1.0
            vec[idx] += sign

        norm_vec = l2_normalize(vec, TARGET_DIMENSION)
        return EmbeddingResponse(
            embedding=norm_vec,
            dimension=TARGET_DIMENSION,
            provider="local_hash",
            model="hashed-ngram-768",
        )

    @classmethod
    def _embed_gemini(cls, request: EmbeddingRequest, text: str) -> EmbeddingResponse:
        """Tạo embedding bằng Google Gemini (thử gemini-embedding-001 rồi text-embedding-004)."""
        api_key = request.api_key or GeminiKeyManager.get_active_api_key()
        if request.api_key and GeminiDocService._is_valid_google_api_key(request.api_key):
            client = genai.Client(api_key=request.api_key.strip().strip("'\""))
        else:
            client = GeminiKeyManager.get_active_client()

        last_err: Optional[Exception] = None
        for model_name in ("gemini-embedding-001", "text-embedding-004"):
            try:
                logger.info("[EmbeddingService] Đang gọi Gemini %s...", model_name)
                resp = client.models.embed_content(
                    model=model_name,
                    contents=text,
                )
                if resp.embeddings and resp.embeddings[0].values:
                    raw_vec = resp.embeddings[0].values
                    norm_vec = l2_normalize(raw_vec, TARGET_DIMENSION)
                    return EmbeddingResponse(
                        embedding=norm_vec,
                        dimension=TARGET_DIMENSION,
                        provider="gemini",
                        model=model_name,
                    )
            except Exception as ex:
                last_err = ex

        raise RuntimeError(f"Gemini embed_content thất bại: {last_err}")

    @classmethod
    def _embed_ollama(cls, request: EmbeddingRequest, text: str) -> EmbeddingResponse:
        """Tạo embedding bằng Ollama hoặc OpenAI-compatible local server (/api/embed, /v1/embeddings, /api/embeddings)."""
        settings = get_settings()
        default_ollama = (settings.ollama_base_url or "http://127.0.0.1:11434").rstrip("/")
        primary_url = (request.local_ai_url or default_ollama).rstrip("/")
        model_name = request.local_model or "nomic-embed-text"

        # Nếu local_ai_url đang trỏ sang llama-server không bật --embeddings, tự thử tiếp Ollama mặc định (nomic-embed-text)
        candidates = [(primary_url, model_name)]
        if primary_url != default_ollama:
            candidates.append((default_ollama, "nomic-embed-text"))

        raw_vec = None
        used_model = model_name
        last_error = None

        with httpx.Client(timeout=8.0) as client:
            for base_url, cand_model in candidates:
                logger.info("[EmbeddingService] Đang gọi Local Embedding (%s) tại %s...", cand_model, base_url)
                endpoints = (
                    (f"{base_url}/api/embed", {"model": cand_model, "input": text}, "ollama_embed"),
                    (f"{base_url}/v1/embeddings", {"model": cand_model, "input": text}, "openai"),
                    (f"{base_url}/api/embeddings", {"model": cand_model, "prompt": text}, "ollama_legacy"),
                )
                for url, payload, mode in endpoints:
                    try:
                        res = client.post(url, json=payload)
                        if res.status_code == 200:
                            data = res.json()
                            if mode == "ollama_embed":
                                embs = data.get("embeddings", [])
                                if embs:
                                    raw_vec = embs[0]
                            elif mode == "openai":
                                items = data.get("data", [])
                                if items and isinstance(items[0], dict) and items[0].get("embedding"):
                                    raw_vec = items[0]["embedding"]
                            else:
                                raw_vec = data.get("embedding", [])
                            if raw_vec:
                                used_model = cand_model
                                break
                        else:
                            last_error = f"Status {res.status_code}: {res.text}"
                            if "does not support embeddings" in res.text.lower():
                                break
                    except Exception as ex:
                        last_error = str(ex)
                        if isinstance(ex, (httpx.ConnectError, httpx.ConnectTimeout)):
                            break
                if raw_vec:
                    break

        if not raw_vec:
            raise RuntimeError(f"Ollama embedding thất bại ({last_error})")

        norm_vec = l2_normalize(raw_vec, TARGET_DIMENSION)

        return EmbeddingResponse(
            embedding=norm_vec,
            dimension=TARGET_DIMENSION,
            provider="ollama",
            model=used_model,
        )
