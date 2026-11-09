"""
ollama_doc_service.py
Module kết nối với mô hình AI cục bộ chạy qua Ollama (mặc định qwen2.5-coder:7b)
tận dụng card GPU rời NVIDIA GeForce RTX 4060 để sinh tài liệu kỹ thuật dài
hoàn toàn offline, không phụ thuộc vào Internet, không bị giới hạn Quota / HTTP 429.
"""

import json
import logging
from typing import List, Optional
import httpx

from app.core.config import get_settings
from app.schemas.ai_schemas import (
    DocGenerateRequest,
    DocGenerateResponse,
    GroundingEvidence,
    CodeEntityItem,
)
from app.services.gemini_doc_service import GeminiDocService

logger = logging.getLogger(__name__)


class OllamaDocService:
    """
    Dịch vụ sinh tài liệu kỹ thuật sử dụng mô hình AI cục bộ chạy qua Ollama.
    Tối ưu cho GPU RTX 4060 với context window lớn (16k-32k token).
    """

    @classmethod
    def is_available(cls) -> bool:
        """Kiểm tra nhanh xem dịch vụ Ollama cục bộ có đang chạy và phản hồi không."""
        settings = get_settings()
        url = f"{settings.ollama_base_url.rstrip('/')}/api/tags"
        try:
            with httpx.Client(timeout=1.5) as client:
                resp = client.get(url)
                return resp.status_code == 200
        except Exception:
            return False

    @classmethod
    def generate_documentation(cls, request: DocGenerateRequest) -> DocGenerateResponse:
        """
        Sinh tài liệu Markdown hoàn chỉnh từ AST bằng mô hình Ollama cục bộ (Qwen 2.5 Coder).
        Tái sử dụng cấu trúc prompt và Grounding Box từ GeminiDocService để đảm bảo tính nhất quán.
        """
        settings = get_settings()
        template_type = GeminiDocService._normalize_template_type(request.template_type)
        commit_hash = request.commit_hash or "verified-ast-grounding"

        target_name = request.class_name or (
            request.entities[0].class_name if request.entities and request.entities[0].class_name else "CodeComponent"
        )

        entities_summary = []
        grounding_evidences: List[GroundingEvidence] = []
        entities_list = request.entities or []

        for e in entities_list:
            entities_summary.append({
                "entity_type": e.entity_type,
                "name": e.method_name or e.class_name,
                "signature": e.signature,
                "return_type": e.return_type or "void",
                "parameters": e.parameters or "None",
                "lines": f"L{e.start_line} -> L{e.end_line}",
                "annotations": e.annotations or [],
                "javadoc": e.javadoc or "Chưa có",
            })

            grounding_evidences.append(
                GroundingEvidence(
                    file_path=request.file_path,
                    class_name=e.class_name,
                    method_name=e.method_name,
                    start_line=e.start_line,
                    end_line=e.end_line,
                    commit_hash=commit_hash,
                    signature=e.signature,
                    entity_type=e.entity_type,
                )
            )

        grounding_box_md = GeminiDocService._build_grounding_box_markdown(
            file_path=request.file_path,
            commit_hash=commit_hash,
            entities=entities_list,
        )

        prompt = GeminiDocService._build_prompt_for_template(
            template_type=template_type,
            target_name=target_name,
            file_path=request.file_path,
            commit_hash=commit_hash,
            entities_summary=entities_summary,
            source_code=request.source_code,
        )

        generate_url = f"{settings.ollama_base_url.rstrip('/')}/api/generate"
        payload = {
            "model": settings.ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "top_p": 0.9,
                "num_predict": 8192,
                "num_ctx": 32768,
            },
        }

        logger.info(
            f"[OllamaDocService] Đang gửi prompt tới Ollama ({settings.ollama_model}) tại {generate_url}..."
        )

        # ponytail: Timeout 180s cho model 3B trên GPU RTX 4060 đủ để sinh tài liệu dài 4000 token
        with httpx.Client(timeout=180.0) as client:
            resp = client.post(generate_url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        generated_raw = data.get("response", "")
        clean_markdown = generated_raw.strip()

        # Làm sạch thẻ bao bọc markdown nếu model có sinh thừa
        if clean_markdown.startswith("```markdown"):
            clean_markdown = clean_markdown[len("```markdown"):].strip()
        elif clean_markdown.startswith("```"):
            clean_markdown = clean_markdown[3:].strip()
        if clean_markdown.endswith("```"):
            clean_markdown = clean_markdown[:-3].strip()

        # Đính kèm Grounding Evidence Box nếu chưa có
        if "Khối Bằng chứng Xác thực Nguồn" not in clean_markdown and "Grounding Evidence Box" not in clean_markdown:
            clean_markdown = clean_markdown.rstrip() + "\n\n" + grounding_box_md.strip()

        return DocGenerateResponse(
            status="success",
            mode="ollama-local",
            template_type=template_type,
            file_path=request.file_path,
            generated_content=clean_markdown,
            confidence_score=0.98,
            grounding_evidence=grounding_evidences,
        )

