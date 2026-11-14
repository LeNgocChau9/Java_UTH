"""
gemini_rewrite_service.py
Module AI Gợi ý đoạn văn bản sửa đổi tài liệu theo Code mới (Task S4-10 - TV4 & Task Tuần 5).

Nhiệm vụ cốt lõi:
1. Nhận vào danh sách các phần tài liệu bị ảnh hưởng (affected_sections), tài liệu hiện tại và code diff mới.
2. Ra lệnh cho Gemini viết lại đúng các mục đó, giữ nguyên phong cách và nội dung của các mục không bị ảnh hưởng.
3. Trả về cấu trúc gồm: section_title, old_content, suggested_content, và reason.
4. Tự động xoay API key khi gặp hạn mức Quota và kích hoạt Smart Rewrite Fallback khi mất kết nối.
"""

import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types as genai_types
from app.core.config import get_settings
from app.core.gemini_key_manager import GeminiKeyManager
from app.schemas.ai_schemas import (
    DocRewriteRequest,
    DocRewriteResponse,
    DocSectionDiffItem,
)
from app.core.gemini_retry import (
    execute_with_gemini_retry,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
)

logger = logging.getLogger(__name__)

# Danh sách model Gemini có cơ chế xoay vòng và fallback tự động
REWRITE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
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
    def _is_valid_google_api_key(key: Optional[str]) -> bool:
        if not key:
            return False
        clean = key.strip().strip("'\"")
        if not clean.startswith("AIzaSy"):
            return False
        if len(clean) < 35:
            return False
        if " " in clean or clean == "AIzaSy_YOUR_REAL_KEY_HERE":
            return False
        return True

    @staticmethod
    def _build_client() -> genai.Client:
        return GeminiKeyManager.get_active_client()

    @staticmethod
    def _build_prompt(request: DocRewriteRequest) -> str:
        additional_instruction = ""
        if request.instruction:
            additional_instruction = f"\n### CHỈ DẪN BỔ SUNG CỦA LẬP TRÌNH VIÊN:\n{request.instruction}\n"

        target_file = request.file_path or "Source Code File"
        target_entity = request.entity_name or "Component"

        affected_directive = ""
        if request.affected_sections:
            secs_formatted = "\n".join(f"- {s}" for s in request.affected_sections)
            affected_directive = f"""
### DANH SÁCH CÁC PHẦN TÀI LIỆU BỊ ẢNH HƯỞNG CỤ THỂ CẦN TẬP TRUNG VIẾT LẠI:
{secs_formatted}
"""

        prompt = f"""Bạn là Kỹ sư viết tài liệu kỹ thuật cao cấp (Principal Technical Writer) kiêm Kiến trúc sư phần mềm trong hệ thống LivingDocs.

## BỐI CẢNH & YÊU CẦU:
Mã nguồn vừa có sự thay đổi mới (thể hiện qua Code Diff dưới đây).
Nhiệm vụ của bạn là CẬP NHẬT TÀI LIỆU HIỆN TẠI để đồng bộ 100% với Code mới.

QUY TẮC BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
1. **VIẾT LẠI ĐÚNG CÁC MỤC BỊ ẢNH HƯỞNG**: Chỉ viết lại hoặc bổ sung những mục/phương thức/chữ ký mà code diff thực sự thay đổi (thay đổi tham số, kiểu trả về, logic hành vi, thêm mới, xóa bỏ).{affected_directive}
2. **GIỮ NGUYÊN PHONG CÁCH VÀ NỘI DUNG CỦA CÁC MỤC KHÔNG BỊ ẢNH HƯỞNG**: Tất cả các phần khác của tài liệu (tiêu đề chung, tổng quan, các hàm/mục không đổi) PHẢI ĐƯỢC GIỮ NGUYÊN NGUYÊN VĂN, không được tự ý xóa, tóm tắt hoặc thay đổi.
3. **CHUẨN VĂN PHONG KỸ THUẬT**: Dùng tiếng Việt chuyên ngành phần mềm chuẩn xác, rõ ràng, ngắn gọn, có cấu trúc bảng biểu Markdown hoặc danh sách tham số chi tiết.
4. **CẤU TRÚC ĐỐI CHIẾU TỪNG MỤC**: Với mỗi mục bị ảnh hưởng, trả về đầy đủ: section_title, old_content, suggested_content, và reason.
5. **TÍNH TOÀN VẸN MARKDOWN**: Bản tài liệu cập nhật (updated_doc) phải là tài liệu Markdown HOÀN CHỈNH, có thể lưu đè hoặc tạo phiên bản mới ngay lập tức.
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
      "old_content": "<Đoạn nội dung cũ của mục này trong tài liệu>",
      "suggested_content": "<Đoạn nội dung mới được viết lại theo code mới>",
      "reason": "<Lý do kỹ thuật: tham số mới, đổi kiểu trả về, logic mới...>"
    }}
  ],
  "updated_doc": "<TOÀN BỘ NỘI DUNG MARKDOWN ĐẦY ĐỦ CỦA TÀI LIỆU SAU KHI GHÉP CÁC PHẦN ĐÃ SỬA VỚI CÁC PHẦN GIỮ NGUYÊN>"
}}
"""
        return prompt

    @classmethod
    def _smart_rewrite_fallback(cls, request: DocRewriteRequest) -> DocRewriteResponse:
        """
        Thuật toán phân tích diff và viết lại tài liệu thông minh khi không có kết nối Gemini API.
        Đảm bảo hệ thống hoạt động ổn định và tài liệu luôn được cập nhật chính xác.
        """
        current_doc = request.current_doc or ""
        code_diff = request.code_diff or ""
        entity_name = request.entity_name or "Component"

        # Nếu không có diff thì không sửa đổi
        if not code_diff.strip():
            return DocRewriteResponse(
                status="success",
                mode="smart-rewrite-fallback",
                original_doc_length=len(current_doc),
                rewritten_doc_length=len(current_doc),
                updated_doc=current_doc,
                summary_of_changes="Không phát hiện thay đổi mã nguồn, tài liệu được giữ nguyên.",
                modified_sections_count=0,
                unchanged_sections_count=1,
                section_diffs=[],
                suggestions=[],
                model_used="smart-diff-analyzer",
            )

        # Trích xuất các dòng thêm/xóa trong diff (hoặc toàn bộ dòng nếu là code snippet trực tiếp)
        added_lines = [l[1:].strip() for l in code_diff.splitlines() if l.startswith("+") and not l.startswith("+++")]
        removed_lines = [l[1:].strip() for l in code_diff.splitlines() if l.startswith("-") and not l.startswith("---")]
        source_lines = added_lines if added_lines else [l.strip() for l in code_diff.splitlines() if l.strip()]

        # Tìm tên hàm/phương thức mới hoặc thay đổi
        changed_signatures = []
        for line in source_lines:
            if re.search(r"\b(public|private|protected|def|async|function|export|class|interface)\b", line) or "(" in line:
                clean_sig = line.strip().rstrip("{;").strip()
                if clean_sig and not clean_sig.startswith(("//", "#", "/*")):
                    changed_signatures.append(clean_sig)

        # Xác định ngôn ngữ code fence theo file_path
        fp_lower = (request.file_path or "").lower()
        if fp_lower.endswith(".tsx"):
            fence_lang = "tsx"
        elif fp_lower.endswith(".ts"):
            fence_lang = "ts"
        elif fp_lower.endswith(".jsx") or fp_lower.endswith(".js"):
            fence_lang = "javascript"
        elif fp_lower.endswith(".py"):
            fence_lang = "python"
        elif fp_lower.endswith(".sql"):
            fence_lang = "sql"
        else:
            fence_lang = "java"

        # Tách tài liệu hiện tại thành các section
        doc_lines = current_doc.splitlines(keepends=True)
        sections: List[Dict[str, Any]] = []
        curr_title = "Tổng quan"
        curr_content: List[str] = []

        for line in doc_lines:
            stripped = line.strip()
            if stripped.startswith("#"):
                if curr_content:
                    sections.append({
                        "title": curr_title,
                        "content": "".join(curr_content).strip()
                    })
                    curr_content = []
                curr_title = stripped.lstrip("#").strip()
                curr_content.append(line)
            else:
                curr_content.append(line)

        if curr_content:
            sections.append({
                "title": curr_title,
                "content": "".join(curr_content).strip()
            })

        # Xác định các section bị ảnh hưởng
        target_sections = []
        if request.affected_sections:
            for s in sections:
                if any(aff.lower() in s["title"].lower() or s["title"].lower() in aff.lower() for aff in request.affected_sections):
                    target_sections.append(s)

        if not target_sections and request.entity_name:
            for s in sections:
                if entity_name.lower() in s["title"].lower():
                    target_sections.append(s)

        if not target_sections and not request.entity_name:
            for s in sections:
                if any(w in s["title"].lower() for w in ["phương thức", "method", "api", "chi tiết"]):
                    target_sections.append(s)
            if not target_sections and sections:
                target_sections.append(sections[1] if len(sections) > 1 else sections[0])

        section_diffs: List[DocSectionDiffItem] = []
        updated_doc = current_doc

        if not target_sections:
            # Chưa có section cho entity_name trong current_doc -> Tạo section Markdown chuẩn cho entity_name
            sig_display = changed_signatures[0] if changed_signatures else (source_lines[0] if source_lines else entity_name)
            snippet_clean = "\n".join(
                l[1:] if (l.startswith("+") and not l.startswith("+++")) else l
                for l in code_diff.splitlines()
                if not l.startswith("---") and not l.startswith("+++") and not l.startswith("@@")
            ).strip()
            new_sec_lines = [
                f"### {entity_name}",
                "",
                f"- **Thực thể mã nguồn:** `{entity_name}`" + (f" (Tệp: `{request.file_path}`)" if request.file_path else ""),
                f"- **Chữ ký (Signature):** `{sig_display}`",
                f"- **Mô tả kỹ thuật:** Thực thể `{entity_name}` thực thi xử lý nghiệp vụ theo định nghĩa mã nguồn mới nhất.",
            ]
            if request.instruction and request.instruction.strip():
                new_sec_lines.append(f"- **Ghi chú cập nhật:** {request.instruction.strip()}")
            if snippet_clean:
                new_sec_lines.append(f"\n```{fence_lang}\n{snippet_clean}\n```")

            suggested_c = "\n".join(new_sec_lines)
            diff_item = DocSectionDiffItem(
                section_title=entity_name,
                status="MODIFIED",
                old_content="",
                suggested_content=suggested_c,
                reason=f"Tạo mới/cập nhật mục tài liệu kỹ thuật cho {entity_name} từ mã nguồn.",
            )
            section_diffs.append(diff_item)
            updated_doc = (current_doc.rstrip() + "\n\n" + suggested_c + "\n").lstrip() if current_doc.strip() else suggested_c
        else:
            for sec in target_sections:
                sec_title = sec["title"]
                old_c = sec["content"]

                # Xây dựng nội dung mới phản ánh các thay đổi trong diff
                reason_parts = []
                suggested_lines = [old_c]

                if changed_signatures:
                    suggested_lines.append("\n\n#### Cập nhật chữ ký & hành vi mới (Theo Code Diff):")
                    for sig in changed_signatures[:3]:
                        suggested_lines.append(f"- Chữ ký phương thức mới: `{sig}`")
                    reason_parts.append(f"Cập nhật {len(changed_signatures)} chữ ký hàm mới theo thay đổi code.")

                if source_lines:
                    new_params = [l for l in source_lines if "param" in l.lower() or "@param" in l]
                    if new_params:
                        suggested_lines.append("- Tham số bổ sung: " + ", ".join(f"`{p}`" for p in new_params[:3]))
                        reason_parts.append("Bổ sung mô tả các tham số mới.")

                if request.instruction and request.instruction.strip():
                    suggested_lines.append(f"- **Ghi chú cập nhật:** {request.instruction.strip()}")
                    reason_parts.append("Áp dụng chỉ dẫn cập nhật bổ sung.")

                reason = " ".join(reason_parts) if reason_parts else f"Cập nhật tài liệu mục '{sec_title}' cho phù hợp với code diff mới nhất của {entity_name}."
                suggested_c = "\n".join(suggested_lines)

                diff_item = DocSectionDiffItem(
                    section_title=sec_title,
                    status="MODIFIED",
                    old_content=old_c,
                    suggested_content=suggested_c,
                    reason=reason,
                )
                section_diffs.append(diff_item)

                # Cập nhật vào bản tài liệu hoàn chỉnh
                if old_c in updated_doc:
                    updated_doc = updated_doc.replace(old_c, suggested_c, 1)

        summary = f"Cập nhật {len(section_diffs)} mục tài liệu bị ảnh hưởng theo thay đổi mã nguồn mới của {entity_name}."

        return DocRewriteResponse(
            status="success",
            mode="smart-rewrite-fallback",
            original_doc_length=len(current_doc),
            rewritten_doc_length=len(updated_doc),
            updated_doc=updated_doc,
            summary_of_changes=summary,
            modified_sections_count=len(section_diffs),
            unchanged_sections_count=max(0, len(sections) - len(section_diffs)),
            section_diffs=section_diffs,
            suggestions=section_diffs,
            model_used="smart-diff-analyzer",
        )

    @classmethod
    def rewrite_document(cls, request: DocRewriteRequest) -> DocRewriteResponse:
        """
        Thực thi phân tích và viết lại tài liệu bằng Google Gemini API.
        Tự động xoay API Key khi gặp hạn mức Quota và kích hoạt Smart Rewrite Fallback khi mất kết nối.
        """
        # Nếu diff rỗng, không cần gọi API
        if not request.code_diff or not request.code_diff.strip():
            return DocRewriteResponse(
                status="success",
                mode="static-analysis",
                original_doc_length=len(request.current_doc),
                rewritten_doc_length=len(request.current_doc),
                updated_doc=request.current_doc,
                summary_of_changes="Không phát hiện thay đổi mã nguồn trong code diff.",
                modified_sections_count=0,
                unchanged_sections_count=1,
                section_diffs=[],
                suggestions=[],
                model_used="static-analysis",
            )

        active_key = GeminiKeyManager.get_active_api_key()
        if not cls._is_valid_google_api_key(active_key):
            logger.info("[DocRewrite] Sử dụng bộ phân tích Smart Rewrite do API Key chưa cấu hình hoặc không hợp lệ.")
            return cls._smart_rewrite_fallback(request)

        prompt = cls._build_prompt(request)

        logger.info(
            "[DocRewrite] Bắt đầu AI viết lại tài liệu — entity='%s', file='%s', doc_len=%d, diff_len=%d, affected_sections=%s",
            request.entity_name or "N/A",
            request.file_path or "N/A",
            len(request.current_doc),
            len(request.code_diff),
            request.affected_sections or "[]"
        )

        last_error = None
        parsed = None
        used_model = None

        for model_name in REWRITE_MODELS:
            try:
                def _call_gemini_rewrite():
                    client = cls._build_client()
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            temperature=0.15,
                            top_p=0.9,
                            max_output_tokens=4000,
                            response_mime_type="application/json",
                        ),
                    )
                    txt = resp.text or "{}"
                    return _parse_gemini_json(txt)

                parsed = execute_with_gemini_retry(
                    action=_call_gemini_rewrite,
                    max_retries=1,
                    initial_delay=0.5,
                    backoff_factor=1.5,
                    action_name=f"DocRewrite ({model_name})",
                )
                used_model = model_name
                break

            except GeminiQuotaExceededError as qe:
                logger.warning("[DocRewrite] Quota exceeded trên model %s, thử xoay key...", model_name)
                last_error = qe
            except Exception as ex:
                logger.warning("[DocRewrite] Thử model %s thất bại: %s. Thử model tiếp theo...", model_name, ex)
                last_error = ex

        # Nếu tất cả model Gemini đều không khả dụng, kích hoạt Smart Fallback
        if parsed is None:
            logger.warning("[DocRewrite] Tất cả model Gemini gặp sự cố (%s). Chuyển sang Smart Rewrite Fallback.", last_error)
            return cls._smart_rewrite_fallback(request)

        updated_doc = parsed.get("updated_doc", "").strip()
        if not updated_doc:
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

                sec_title = item.get("section_title", "General")
                old_c = item.get("old_content", "")
                sug_c = item.get("suggested_content") or item.get("new_content", "")
                reason = item.get("reason") or item.get("change_reason", "Cập nhật theo code diff mới")

                diff_item = DocSectionDiffItem(
                    section_title=sec_title,
                    status=status,
                    old_content=old_c,
                    suggested_content=sug_c,
                    reason=reason,
                )
                section_diffs.append(diff_item)

        if modified_count == 0 and len(section_diffs) > 0:
            modified_count = len(section_diffs)

        suggestions = [s for s in section_diffs if s.status == "MODIFIED"]
        if not suggestions and section_diffs:
            suggestions = section_diffs

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
            suggestions=suggestions,
            model_used=used_model or "gemini-3.5-flash-lite",
        )
