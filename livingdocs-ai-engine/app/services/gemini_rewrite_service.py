"""
gemini_rewrite_service.py
Module AI Gợi ý đoạn văn bản sửa đổi tài liệu theo Code mới (Task S4-10 - TV4).

Nhiệm vụ cốt lõi:
1. Nhận vào toàn bộ tài liệu Markdown hiện tại + code diff mới nhất từ PR/commit.
2. Sử dụng Google Gemini API phân tích chuẩn xác các mục bị ảnh hưởng bởi code diff.
3. Tự động viết lại phần mô tả kỹ thuật của CÁC MỤC BỊ ẢNH HƯỞNG, bảo đảm:
   - Chuẩn văn phong kỹ thuật phần mềm (Technical Writing).
   - Đúng tham số, kiểu trả về, logic và ngoại lệ mới.
   - GIỮ NGUYÊN HOÀN TOÀN cấu trúc, định dạng và nội dung của các mục không bị ảnh hưởng.
4. Trả về:
   - updated_doc: Nội dung Markdown hoàn chỉnh đã được cập nhật chuẩn xác.
   - summary_of_changes: Tóm tắt điểm thay đổi.
   - section_diffs: Chi tiết đối chiếu từng mục (MODIFIED vs UNCHANGED).
"""

import os
import json
import logging
from typing import List, Dict, Any
from google import genai
from google.genai import types as genai_types
from app.core.config import get_settings
from app.schemas.ai_schemas import (
    DocRewriteRequest,
    DocRewriteResponse,
    DocSectionDiffItem,
)
from app.core.gemini_retry import (
    execute_with_gemini_retry,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
    is_quota_exceeded_error,
)

logger = logging.getLogger(__name__)

# Danh sách model Gemini có cơ chế fallback tự động
REWRITE_MODELS = [
    "gemini-1.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-lite-latest",
]


def _parse_gemini_json(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    return json.loads(text)


class GeminiRewriteService:

    @staticmethod
    def _build_client() -> genai.Client:
        settings = get_settings()
        api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY không tìm thấy trong .env. "
                "Vui lòng kiểm tra file livingdocs-ai-engine/.env"
            )
        return genai.Client(api_key=api_key)

    @staticmethod
    def _build_prompt(request: DocRewriteRequest) -> str:
        additional_instruction = ""
        if request.instruction:
            additional_instruction = f"\n### CHỈ DẪN BỔ SUNG CỦA LẬP TRÌNH VIÊN:\n{request.instruction}\n"

        target_file = request.file_path or "Unknown Java File"
        target_entity = request.entity_name or "Component"

        prompt = f"""Bạn là Kỹ sư viết tài liệu kỹ thuật cao cấp (Principal Technical Writer) kiêm Kiến trúc sư phần mềm trong hệ thống LivingDocs.

## BỐI CẢNH & YÊU CẦU:
Mã nguồn vừa có sự thay đổi (thể hiện qua Code Diff dưới đây).
Nhiệm vụ của bạn là CẬP NHẬT TÀI LIỆU HIỆN TẠI để đồng bộ 100% với Code mới.

QUY TẮC BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
1. **CHỈ SỬA CÁC MỤC BỊ ẢNH HƯỞNG**: Chỉ viết lại hoặc bổ sung những mục/phương thức/chữ ký mà code diff thực sự thay đổi (thay đổi tham số, kiểu trả về, logic hành vi, thêm mới, xóa bỏ).
2. **GIỮ NGUYÊN CÁC MỤC KHÔNG ĐỔI**: Tất cả các phần khác của tài liệu (tiêu đề chung, tổng quan, các hàm/mục không đổi) PHẢI ĐƯỢC GIỮ NGUYÊN NGUYÊN VĂN, không được tự ý xóa, tóm tắt hoặc viết lại.
3. **CHUẨN VĂN PHONG KỸ THUẬT**: Dùng tiếng Việt chuyên ngành phần mềm chuẩn xác, rõ ràng, ngắn gọn, có cấu trúc bảng biểu Markdown hoặc danh sách tham số chi tiết.
4. **TÍNH TOÀN VẸN MARKDOWN**: Bản tài liệu cập nhật (updated_doc) phải là tài liệu Markdown HOÀN CHỈNH, có thể lưu đè hoặc tạo phiên bản mới ngay lập tức.
{additional_instruction}

## THÔNG TIN ĐẦU VÀO:
- File mã nguồn: `{target_file}`
- Thực thể chính: `{target_entity}`
- Commit Hash: `{request.commit_hash}`

### 1. CODE DIFF MỚI NHẤT:
```diff
{request.code_diff}
```

### 2. TÀI LIỆU MARKDOWN HIỆN TẠI:
```markdown
{request.current_doc}
```

## ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Trả về DUY NHẤT một JSON object hợp lệ (không kèm markdown code fence ngoài JSON, không lời dẫn thừa):
{{
  "summary_of_changes": "<Tóm tắt 1-2 câu tiếng Việt về những điểm cụ thể vừa được cập nhật trong tài liệu>",
  "section_diffs": [
    {{
      "section_title": "<Tên mục/phương thức, ví dụ: '2.1. processPayment'>",
      "status": "MODIFIED",
      "old_content": "<Đoạn nội dung cũ của mục này>",
      "new_content": "<Đoạn nội dung mới được viết lại theo code mới>",
      "change_reason": "<Lý do kỹ thuật: tham số mới, đổi kiểu trả về, logic mới...>"
    }}
  ],
  "updated_doc": "<TOÀN BỘ NỘI DUNG MARKDOWN ĐẦY ĐỦ CỦA TÀI LIỆU SAU KHI GHÉP CÁC PHẦN ĐÃ SỬA VỚI CÁC PHẦN GIỮ NGUYÊN>"
}}
"""
        return prompt

    @classmethod
    def rewrite_document(cls, request: DocRewriteRequest) -> DocRewriteResponse:
        """
        Thực thi phân tích và viết lại tài liệu bằng Google Gemini API.
        """
        client = cls._build_client()
        prompt = cls._build_prompt(request)

        logger.info(
            "[DocRewrite] Bắt đầu AI viết lại tài liệu — entity='%s', file='%s', doc_len=%d, diff_len=%d",
            request.entity_name or "N/A",
            request.file_path or "N/A",
            len(request.current_doc),
            len(request.code_diff)
        )

        last_error = None
        parsed = None
        used_model = None

        for model_name in REWRITE_MODELS:
            try:
                def _call_gemini_rewrite():
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            temperature=0.15,  # Giữ tính chính xác và bám sát ngữ cảnh cao
                            top_p=0.9,
                            max_output_tokens=4000,
                            response_mime_type="application/json",
                        ),
                    )
                    txt = resp.text or "{}"
                    return _parse_gemini_json(txt)

                parsed = execute_with_gemini_retry(
                    action=_call_gemini_rewrite,
                    max_retries=3,
                    initial_delay=1.0,
                    backoff_factor=2.0,
                    action_name=f"DocRewrite ({model_name})",
                )
                used_model = model_name
                break

            except GeminiQuotaExceededError:
                # Quota cạn kiệt thì re-raise ngay để trả thông báo 429 tiếng Việt chuẩn xác
                raise
            except Exception as ex:
                logger.warning("[DocRewrite] Thử model %s thất bại: %s. Thử model tiếp theo...", model_name, ex)
                last_error = ex

        if parsed is None:
            raise GeminiServiceUnavailableError(
                message=f"Tất cả các model Gemini đều không khả dụng sau khi đã thử lại: {last_error}",
                raw_error=last_error
            )

        updated_doc = parsed.get("updated_doc", "").strip()
        if not updated_doc:
            # Dự phòng: Nếu Gemini chỉ trả các section con mà quên ghép doc
            updated_doc = request.current_doc

        summary_of_changes = parsed.get("summary_of_changes", "Tài liệu đã được cập nhật dựa trên thay đổi code mới nhất.")
        raw_diffs = parsed.get("section_diffs", [])

        section_diffs: List[DocSectionDiffItem] = []
        modified_count = 0
        unchanged_count = 0

        for item in raw_diffs:
            if isinstance(item, dict):
                status = item.get("status", "MODIFIED").upper()
                if status == "MODIFIED":
                    modified_count += 1
                else:
                    unchanged_count += 1

                section_diffs.append(
                    DocSectionDiffItem(
                        section_title=item.get("section_title", "General"),
                        status=status,
                        old_content=item.get("old_content", ""),
                        new_content=item.get("new_content", ""),
                        change_reason=item.get("change_reason")
                    )
                )

        if modified_count == 0 and len(section_diffs) > 0:
            modified_count = len(section_diffs)

        logger.info(
            "[DocRewrite] Hoàn tất viết lại tài liệu — model=%s, modified_sections=%d, orig_len=%d -> new_len=%d",
            used_model, modified_count, len(request.current_doc), len(updated_doc)
        )

        return DocRewriteResponse(
            status="success",
            mode="real",
            original_doc_length=len(request.current_doc),
            rewritten_doc_length=len(updated_doc),
            updated_doc=updated_doc,
            summary_of_changes=summary_of_changes,
            modified_sections_count=modified_count,
            unchanged_sections_count=unchanged_count,
            section_diffs=section_diffs,
            model_used=used_model,
        )

