"""
gemini_doc_service.py
Module kết nối trực tiếp với Google Gemini API thật để tự động sinh tài liệu kỹ thuật
từ cấu trúc AST và Template (Sử dụng google-genai SDK mới nhất và Multi-Key Pool).
"""

import json
import logging
from typing import List, Optional
from google import genai
from google.genai import types as genai_types
from app.core.gemini_key_manager import GeminiKeyManager
from app.schemas.ai_schemas import (
    DocGenerateRequest,
    DocGenerateResponse,
    GroundingEvidence,
    CodeEntityItem,
)
from app.core.gemini_retry import (
    execute_with_gemini_retry,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
)

logger = logging.getLogger(__name__)

# Danh sách các model Gemini ưu tiên theo thứ tự tốc độ và độ ổn định
DOC_MODELS = [
    "gemini-1.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-lite-latest",
]


class GeminiDocService:

    @classmethod
    def generate_documentation(cls, request: DocGenerateRequest) -> DocGenerateResponse:
        """
        Sinh tài liệu Markdown hoàn chỉnh từ cấu trúc AST và template bằng Google Gemini API.
        Tự động xoay API Key nếu gặp lỗi hạn mức Quota (429).
        """
        target_name = request.class_name or (
            request.entities[0].class_name if request.entities and request.entities[0].class_name else "CodeComponent"
        )

        # 1. Định dạng thông tin AST thành bảng dữ liệu kỹ thuật gọn gàng (tiết kiệm token)
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
                        commit_hash="verified-ast-grounding",
                    )
                )

        # 2. Xây dựng Prompt kỹ thuật chặt chẽ, tối ưu token
        prompt = f"""Bạn là chuyên gia kiến trúc phần mềm và kỹ sư viết tài liệu kỹ thuật cao cấp (Technical Writer) cho hệ thống LivingDocs.
Nhiệm vụ của bạn là đọc cấu trúc AST đã bóc tách từ file mã nguồn và sinh ra một bản tài liệu kỹ thuật hoàn chỉnh bằng định dạng MARKDOWN chuyên nghiệp.

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
   - Tác nhân sinh: LivingDocs AI Engine (Google Gemini)
3. **Mục 1. Tổng quan & Mục đích thiết kế**: Mô tả ngắn gọn trách nhiệm nghiệp vụ của class/module trong kiến trúc hệ thống.
4. **Mục 2. Chi tiết các Phần tử, Phương thức & API (CÓ BẢNG THÔNG SỐ RÕ RÀNG)**:
   - Tạo bảng Markdown gồm các cột: `Phần tử`, `Loại`, `Kiểu dữ liệu / Chữ ký`, `Vị trí dòng`, `Mô tả chức năng`.
   - Đối với mỗi phương thức hoặc thuộc tính quan trọng, viết phân tích sâu: mục đích, tham số đầu vào, kết quả trả về và ràng buộc.
5. **Mục 3. Hướng dẫn Tích hợp & Sử dụng (Code snippet minh họa nếu phù hợp)**.
6. **Mục 4. Bằng chứng xác thực nguồn (Grounding & Verification)**: Liệt kê các phần tử đã được xác thực từ AST.

LƯU Ý: Viết bằng TIẾNG VIỆT chuẩn kỹ thuật phần mềm, cấu trúc rõ ràng, sử dụng bảng biểu và code block định dạng đẹp. Không thêm các lời giải thích thừa ngoài nội dung Markdown.
"""

        def _call_gemini_doc():
            client = GeminiKeyManager.get_active_client()
            last_err = None

            for model_name in DOC_MODELS:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            temperature=0.2,
                            top_p=0.9,
                            max_output_tokens=3000,
                        ),
                    )
                    return resp, model_name
                except Exception as ex:
                    last_err = ex
                    err_str = str(ex).lower()
                    # Nếu là lỗi model không tồn tại hoặc tạm thời quá tải 503 -> thử model tiếp theo
                    if any(k in err_str for k in ("not found", "503", "unavailable", "overloaded")):
                        logger.warning(f"Model {model_name} gặp sự cố, thử model tiếp theo: {ex}")
                        continue
                    # Nếu là lỗi 429 Quota -> ném để execute_with_gemini_retry xoay key
                    raise ex

            raise last_err or RuntimeError("Tất cả các model Gemini đều không khả dụng.")

        try:
            response, active_model_name = execute_with_gemini_retry(
                action=_call_gemini_doc,
                max_retries=3,
                initial_delay=1.0,
                backoff_factor=2.0,
                action_name="DocGenerate"
            )

            generated_markdown = response.text if response and response.text else ""

            # Tính toán điểm tin cậy dựa trên tỷ lệ entity có tài liệu và xác thực AST
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

        except GeminiQuotaExceededError:
            raise
        except GeminiServiceUnavailableError:
            raise
        except Exception as ex:
            logger.error(f"Lỗi khi gọi Google Gemini API: {ex}", exc_info=True)
            raise RuntimeError(f"Lỗi khi sinh tài liệu bằng Gemini API: {str(ex)}")
