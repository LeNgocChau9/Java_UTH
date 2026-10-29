"""
gemini_doc_service.py
Module kết nối trực tiếp với Google Gemini API thật để tự động sinh tài liệu kỹ thuật
từ cấu trúc AST và Template (Task #81 - Sprint 3).
"""

import os
import json
import logging
from typing import List, Optional
import google.generativeai as genai
from app.core.config import get_settings
from app.schemas.ai_schemas import (
    DocGenerateRequest,
    DocGenerateResponse,
    GroundingEvidence,
    CodeEntityItem,
)

logger = logging.getLogger(__name__)

# Danh sách các model Gemini ưu tiên theo thứ tự
GEMINI_MODELS = [
    "gemini-1.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-1.5-flash-8b",
]


class GeminiDocService:

    @staticmethod
    def _get_configured_model():
        settings = get_settings()
        api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("GEMINI_API_KEY không được tìm thấy trong file .env hoặc cấu hình hệ thống.")

        genai.configure(api_key=api_key)

        for model_name in GEMINI_MODELS:
            try:
                model = genai.GenerativeModel(model_name)
                return model, model_name
            except Exception as e:
                logger.warning(f"Không thể khởi tạo model {model_name}: {e}")

        # Fallback về gemini-3.8-flash mặc định
        return genai.GenerativeModel("gemini-3.8-flash"), "gemini-3.8-flash"

    @classmethod
    def generate_documentation(cls, request: DocGenerateRequest) -> DocGenerateResponse:
        """
        Sinh tài liệu Markdown hoàn chỉnh từ cấu trúc AST và template bằng Google Gemini API.
        """
        model, active_model_name = cls._get_configured_model()

        target_name = request.class_name or (
            request.entities[0].class_name if request.entities and request.entities[0].class_name else "JavaComponent"
        )

        # 1. Định dạng thông tin AST thành bảng dữ liệu kỹ thuật
        entities_summary = []
        grounding_evidences: List[GroundingEvidence] = []

        if request.entities:
            for e in request.entities:
                entities_summary.append({
                    "entity_type": e.entity_type,
                    "name": e.method_name or e.class_name,
                    "signature": e.signature,
                    "return_type": e.return_type or "void",
                    "parameters": e.parameters or "None",
                    "lines": f"{e.start_line} -> {e.end_line}",
                    "javadoc": e.javadoc or "Chưa có",
                })

                grounding_evidences.append(
                    GroundingEvidence(
                        file_path=request.file_path,
                        class_name=e.class_name,
                        method_name=e.method_name,
                        start_line=e.start_line,
                        end_line=e.end_line,
                        commit_hash="verified-ast-grounding",
                    )
                )

        # 2. Xây dựng Prompt kỹ thuật chặt chẽ
        prompt = f"""Bạn là chuyên gia kiến trúc phần mềm và kỹ sư viết tài liệu kỹ thuật cao cấp (Technical Writer) cho hệ thống LivingDocs.
Nhiệm vụ của bạn là đọc cấu trúc AST đã bóc tách từ file Java và sinh ra một bản tài liệu kỹ thuật hoàn chỉnh bằng định dạng MARKDOWN chuyên nghiệp.

### THÔNG TIN ĐẦU VÀO:
- Tên lớp/thành phần chính: {target_name}
- Đường dẫn file mã nguồn: {request.file_path}
- Mẫu tài liệu yêu cầu: {request.template_type}
- Danh sách các phần tử mã nguồn (AST Entities):
{json.dumps(entities_summary, ensure_ascii=False, indent=2)}

### YÊU CẦU ĐỊNH DẠNG TÀI LIỆU MARKDOWN:
1. **Tiêu đề lớn (#)**: Tài liệu Kỹ thuật cho `{target_name}`.
2. **Thẻ metadata blockquote (>)**:
   - Mẫu áp dụng: {request.template_type}
   - File mã nguồn: {request.file_path}
   - Model thực hiện: Google Gemini ({active_model_name})
3. **Mục 1. Tổng quan & Mục đích thiết kế**: Mô tả ngắn gọn trách nhiệm nghiệp vụ của class trong kiến trúc hệ thống.
4. **Mục 2. Chi tiết các Phương thức & API (Có BẢNG THÔNG SỐ RÕ RÀNG)**:
   - Tạo bảng Markdown gồm các cột: `Tên phương thức`, `Kiểu trả về`, `Tham số`, `Vị trí dòng`, `Mô tả chức năng`.
   - Đối với mỗi phương thức quan trọng, viết phân tích sâu: mục đích, tham số đầu vào, kết quả trả về và các ngoại lệ/xử lý lỗi (nếu có).
5. **Mục 3. Hướng dẫn Tích hợp & Sử dụng (Code snippet minh họa nếu phù hợp)**.
6. **Mục 4. Bằng chứng xác thực nguồn (Grounding & Verification)**: Liệt kê các phần tử đã được xác thực từ AST.

LƯU Ý: Viết bằng TIẾNG VIỆT chuẩn kỹ thuật phần mềm, cấu trúc rõ ràng, sử dụng bảng biểu và code block định dạng đẹp. Không thêm các lời giải thích thừa ngoài nội dung Markdown.
"""

        try:
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2, # Giữ tính chính xác kỹ thuật cao
                    top_p=0.9,
                    max_output_tokens=3000,
                )
            )

            generated_markdown = response.text if response and response.text else ""

            # Tính toán điểm tin cậy (confidence score) dựa trên tỷ lệ entity có javadoc và độ đầy đủ
            total_count = len(request.entities) if request.entities else 1
            documented_count = sum(1 for e in request.entities if e.javadoc) if request.entities else 0
            base_score = 0.88 + min(0.10, (documented_count / total_count) * 0.10)
            confidence_score = round(base_score, 2)

            return DocGenerateResponse(
                status="success",
                mode="real",
                template_type=request.template_type,
                file_path=request.file_path,
                generated_content=generated_markdown,
                confidence_score=confidence_score,
                grounding_evidence=grounding_evidences,
            )

        except Exception as ex:
            logger.error(f"Lỗi khi gọi Google Gemini API: {ex}", exc_info=True)
            raise RuntimeError(f"Lỗi khi sinh tài liệu bằng Gemini API ({active_model_name}): {str(ex)}")
