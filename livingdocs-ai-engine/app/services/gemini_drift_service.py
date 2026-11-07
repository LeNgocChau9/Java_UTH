"""
gemini_drift_service.py
Module phân tích sai lệch tài liệu ngữ nghĩa (Semantic Drift Detection) — Task S4-09 (Tuần 5).

Sử dụng Google Gemini API (google-genai SDK mới nhất) và Multi-Key Pool (10 keys) để:
  1. Nhận đầu vào là Unified Code Diff và nội dung tài liệu kỹ thuật hiện tại.
  2. Tính toán điểm trôi dạt drift_score (từ 0.0 đến 1.0).
  3. Phân loại chuẩn 3 dạng sai lệch:
     - SIGNATURE: Thay đổi chữ ký hàm, danh sách tham số, kiểu trả về hoặc annotations.
     - SEMANTIC: Thay đổi logic xử lý nghiệp vụ, thuật toán, điều kiện kiểm tra bên trong thân hàm.
     - REFERENCE: Hàm, lớp, hằng số hoặc thành phần bị xóa bỏ hoặc đổi tên.
  4. Xác định 4 mức độ nghiêm trọng: LOW, MEDIUM, HIGH, CRITICAL.
  5. Cung cấp cơ chế phân tích dự phòng thông minh (Smart Diff Analysis) đảm bảo độ sẵn sàng 99.9%.
"""

import os
import json
import logging
import re
from typing import List, Optional, Tuple
from google import genai
from google.genai import types as genai_types
from app.core.config import get_settings
from app.core.gemini_key_manager import GeminiKeyManager
from app.schemas.ai_schemas import (
    DriftAnalyzeRequest,
    DriftAnalyzeResponse,
    DriftSuggestion,
)
from app.core.gemini_retry import (
    execute_with_gemini_retry,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
)

logger = logging.getLogger(__name__)

# Danh sách model Gemini ưu tiên theo thứ tự năng lực và độ ổn định (Pro -> Flash)
DRIFT_MODELS = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
]

# Ngưỡng phân loại mức độ theo drift_score
SEVERITY_THRESHOLDS = {
    "LOW":      (0.0,  0.25),
    "MEDIUM":   (0.25, 0.55),
    "HIGH":     (0.55, 0.80),
    "CRITICAL": (0.80, 1.01),
}

VALID_CLASSIFICATIONS = {"SIGNATURE", "SEMANTIC", "REFERENCE"}
VALID_SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def _get_severity_by_score(score: float) -> str:
    """Tính toán severity tương ứng với drift_score chuẩn kỹ thuật."""
    for label, (lo, hi) in SEVERITY_THRESHOLDS.items():
        if lo <= score < hi:
            return label
    return "CRITICAL"


def _normalize_classification(raw_class: Optional[str], explanation: str = "") -> str:
    """Chuẩn hóa loại sai lệch về đúng 1 trong 3 dạng chuẩn: SIGNATURE, SEMANTIC, REFERENCE."""
    if raw_class:
        cleaned = raw_class.strip().upper()
        if cleaned in VALID_CLASSIFICATIONS:
            return cleaned
        if "REF" in cleaned or "DEL" in cleaned or "NAME" in cleaned:
            return "REFERENCE"
        if "SIG" in cleaned or "PARAM" in cleaned or "TYPE" in cleaned:
            return "SIGNATURE"
        if "SEM" in cleaned or "LOGIC" in cleaned or "BODY" in cleaned:
            return "SEMANTIC"

    # Fallback suy luận từ nội dung giải thích
    text = (explanation or "").lower()
    if any(k in text for k in ("xóa", "đổi tên", "renamed", "removed", "deleted", "không còn tồn tại", "not found")):
        return "REFERENCE"
    if any(k in text for k in ("tham số", "chữ ký", "signature", "parameter", "kiểu trả về", "return type")):
        return "SIGNATURE"
    return "SEMANTIC"


def _parse_gemini_json(raw_text: str) -> dict:
    """Trích xuất JSON từ phản hồi Gemini, xử lý an toàn các khối markdown code fence."""
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[len("```json"):].strip()
    elif text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()

    # Tìm object JSON đầu tiên nếu có văn bản ngoài lề
    match = re.search(r"(\{.*\})", text, re.DOTALL)
    if match:
        text = match.group(1)

    return json.loads(text)


class GeminiDriftService:

    @classmethod
    def _is_valid_google_api_key(cls, key: str) -> bool:
        """Hỗ trợ cả khóa AIza truyền thống và định dạng AQ mới của Google AI Studio."""
        if not key:
            return False
        clean = key.strip()
        return (clean.startswith("AIza") or clean.startswith("AQ.")) and len(clean) >= 20

    @classmethod
    def _fallback_smart_diff_analysis(cls, request: DriftAnalyzeRequest) -> DriftAnalyzeResponse:
        """
        Thuật toán phân tích diff dự phòng khi không thể gọi Gemini API:
        Phân tích các dòng thay đổi (+/-) trong Unified Diff đối chiếu với nội dung tài liệu.
        """
        diff = request.code_diff or ""
        doc = request.current_doc or ""
        entity_name = request.entity_name or "Component"

        if not diff.strip():
            return DriftAnalyzeResponse(
                status="success",
                mode="smart-diff-fallback",
                entity_name=request.entity_name,
                entity_type=request.entity_type,
                drift_score=0.0,
                severity="LOW",
                classification="SEMANTIC",
                is_drifted=False,
                explanation="Không phát hiện thay đổi mã nguồn trong code diff.",
                affected_sections=[],
                suggestions=[],
                model_used="smart-diff-analyzer",
            )
        added_lines = [l for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++")]
        raw_added = added_lines
        raw_removed = [l for l in diff.splitlines() if l.startswith("-") and not l.startswith("---")]

        def _is_meaningful(line: str) -> bool:
            c = line[1:].strip()
            return bool(c) and not c.startswith(("//", "/*", "*", "#", "'''", '"""'))

        added_lines = [l for l in raw_added if _is_meaningful(l)]
        removed_lines = [l for l in raw_removed if _is_meaningful(l)]

        if not added_lines and not removed_lines:
            return DriftAnalyzeResponse(
                status="success",
                mode="smart-diff-fallback",
                entity_name=request.entity_name,
                entity_type=request.entity_type,
                drift_score=0.05,
                severity="LOW",
                classification="SEMANTIC",
                is_drifted=False,
                explanation=f"Thay đổi trong code diff của '{entity_name}' chỉ bao gồm chú thích hoặc định dạng dòng, không làm thay đổi ngữ nghĩa tài liệu.",
                affected_sections=[],
                suggestions=[],
                model_used="smart-diff-analyzer",
            )

        # 1. Kiểm tra xóa/đổi tên hàm hoặc class (REFERENCE)
        has_removal = any(re.search(r"\b(class|void|int|String|boolean|ResponseEntity)\b", l) for l in removed_lines)
        has_addition = any(re.search(r"\b(class|void|int|String|boolean|ResponseEntity)\b", l) for l in added_lines)

        if has_removal and not has_addition:
            classification = "REFERENCE"
            drift_score = 0.85
            severity = "CRITICAL"
            explanation = f"Thực thể hoặc phương thức liên quan đến '{entity_name}' có dấu hiệu bị xóa bỏ khỏi mã nguồn, khiến tài liệu tham chiếu không còn hợp lệ."
        elif has_removal and has_addition:
            classification = "SIGNATURE"
            drift_score = 0.65
            severity = "HIGH"
            explanation = f"Chữ ký hoặc danh sách tham số của '{entity_name}' đã được thay đổi trong mã nguồn mới."
        elif added_lines:
            classification = "SEMANTIC"
            drift_score = 0.45
            severity = "MEDIUM"
            explanation = f"Mã nguồn của '{entity_name}' có thêm các xử lý logic hoặc điều kiện mới chưa được cập nhật vào tài liệu."
        else:
            classification = "SEMANTIC"
            drift_score = 0.15
            severity = "LOW"
            explanation = f"Các thay đổi trong code diff không ảnh hưởng đáng kể đến tài liệu kỹ thuật của '{entity_name}'."

        is_drifted = drift_score >= 0.25
        # Trích xuất các heading từ tài liệu Markdown hiện tại nếu có
        doc_headings = [
            h.strip().lstrip("#").strip()
            for h in doc.splitlines()
            if h.strip().startswith("#")
        ]
        matched_sections = [h for h in doc_headings if entity_name.lower() in h.lower()]
        if not matched_sections and doc_headings:
            matched_sections = doc_headings[:2]
        affected_sections = matched_sections if is_drifted else []
        suggestions = []

        if is_drifted:
            suggestions.append(
                DriftSuggestion(
                    section=f"Đặc tả {entity_name}",
                    old_text=doc[:120] + "..." if len(doc) > 120 else doc,
                    suggested_text=f"Cập nhật tài liệu cho {entity_name} theo các thay đổi mới trong code diff ({len(added_lines)} dòng thêm, {len(removed_lines)} dòng xóa).",
                    reason=f"Phát hiện sai lệch dạng {classification} với mức độ {severity}."
                )
            )

        return DriftAnalyzeResponse(
            status="success",
            mode="smart-diff-fallback",
            entity_name=request.entity_name,
            entity_type=request.entity_type,
            drift_score=round(drift_score, 4),
            severity=severity,
            classification=classification,
            is_drifted=is_drifted,
            explanation=explanation,
            affected_sections=affected_sections,
            suggestions=suggestions,
            model_used="smart-diff-analyzer",
        )

    @classmethod
    def _build_prompt(cls, request: DriftAnalyzeRequest) -> str:
        """
        Xây dựng prompt kỹ thuật gửi Google Gemini API để phân tích trôi dạt ngữ nghĩa.
        Ép buộc trả về JSON với đúng 3 dạng sai lệch và 4 mức độ nghiêm trọng.
        """
        entity_info = ""
        if request.entity_name or request.entity_type:
            entity_info = (
                f"\n- Thực thể đang phân tích: {request.entity_type or 'MÔ-ĐUN'} `{request.entity_name or 'Chưa đặt tên'}`"
            )
        if request.file_path:
            entity_info += f"\n- Đường dẫn file nguồn: `{request.file_path}`"

        prompt = f"""Bạn là chuyên gia thẩm định và kiểm soát chất lượng tài liệu kỹ thuật phần mềm (Technical Documentation Quality Auditor).

## NHIỆM VỤ:
Phân tích xem đoạn TÀI LIỆU KỸ THUẬT HIỆN TẠI có còn chính xác, đầy đủ và nhất quán với CODE MỚI sau khi thay đổi (thể hiện qua Unified Code Diff) không.
{entity_info}

## UNIFIED CODE DIFF (Thay đổi mã nguồn mới nhất):
```diff
{request.code_diff}
```

## TÀI LIỆU KỸ THUẬT HIỆN TẠI (Đang lưu trong hệ thống):
```markdown
{request.current_doc}
```

## QUY TẮC ĐÁNH GIÁ KỸ THUẬT:
1. **Phân loại 3 dạng sai lệch (classification) - BẮT BUỘC chọn 1 trong 3:**
   - `SIGNATURE`: Thay đổi danh sách tham số, thứ tự đối số, kiểu dữ liệu trả về, chữ ký hàm hoặc annotations (@...).
   - `SEMANTIC`: Chữ ký hàm giữ nguyên nhưng logic xử lý bên trong, thuật toán, điều kiện kiểm tra, ngoại lệ ném ra hoặc hành vi nghiệp vụ đã thay đổi.
   - `REFERENCE`: Tên hàm, class, trường dữ liệu hoặc endpoint được nhắc tới trong tài liệu đã bị xóa bỏ hoàn toàn hoặc đổi tên trong code.

2. **Xác định 4 mức độ nghiêm trọng (severity) tương ứng với drift_score:**
   - `LOW` (drift_score < 0.25): Thay đổi không đáng kể (comment, format code, log) hoặc tài liệu vẫn hoàn toàn đúng.
   - `MEDIUM` (0.25 <= drift_score < 0.55): Thêm tham số tùy chọn hoặc bổ sung logic nhánh phụ mà tài liệu chưa nhắc đến.
   - `HIGH` (0.55 <= drift_score < 0.80): Thay đổi tham số bắt buộc, thay đổi kiểu trả về hoặc logic nghiệp vụ cốt lõi bị thay thế.
   - `CRITICAL` (drift_score >= 0.80): Phương thức/lớp bị xóa, đổi tên hoặc thay đổi phá vỡ tính tương thích (Breaking Change).

## ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm markdown fence, không có bất kỳ văn bản nào khác):
{{
  "drift_score": <số thực từ 0.0 đến 1.0>,
  "classification": "<SIGNATURE | SEMANTIC | REFERENCE>",
  "severity": "<LOW | MEDIUM | HIGH | CRITICAL>",
  "is_drifted": <true nếu drift_score >= 0.25, ngược lại false>,
  "explanation": "<Giải thích ngắn gọn bằng tiếng Việt từ 1-3 câu nêu rõ nguyên nhân sai lệch>",
  "affected_sections": ["<Tên mục 1 bị ảnh hưởng>", "<Tên mục 2 bị ảnh hưởng>"],
  "suggestions": [
    {{
      "section": "<Tên mục tài liệu cần cập nhật>",
      "old_text": "<Đoạn văn bản cũ trong tài liệu>",
      "suggested_text": "<Đoạn văn bản mới đề xuất thay thế>",
      "reason": "<Lý do kỹ thuật cần cập nhật>"
    }}
  ]
}}
"""
        return prompt

    @classmethod
    def analyze(cls, request: DriftAnalyzeRequest) -> DriftAnalyzeResponse:
        """
        Phân tích sai lệch tài liệu ngữ nghĩa bằng Google Gemini API.
        Tự động xoay API Key khi gặp hạn mức Quota (429) và fallback sang Smart Diff nếu mất kết nối.
        """
        if not request.code_diff or not request.code_diff.strip():
            return DriftAnalyzeResponse(
                status="success",
                mode="static-analysis",
                entity_name=request.entity_name,
                entity_type=request.entity_type,
                drift_score=0.0,
                severity="LOW",
                classification="SEMANTIC",
                is_drifted=False,
                explanation="Không phát hiện thay đổi mã nguồn trong code diff.",
                affected_sections=[],
                suggestions=[],
                model_used="static-analysis",
            )

        active_key = GeminiKeyManager.get_active_api_key()
        if not cls._is_valid_google_api_key(active_key):
            logger.info("[DriftAnalysis] Sử dụng bộ phân tích Smart Diff do API Key chưa hợp lệ.")
            return cls._fallback_smart_diff_analysis(request)

        prompt = cls._build_prompt(request)
        logger.info(
            "[DriftAnalysis] Bắt đầu phân tích drift — entity='%s', doc_len=%d, diff_len=%d",
            request.entity_name or "N/A",
            len(request.current_doc or ""),
            len(request.code_diff or ""),
        )

        def _call_gemini_drift():
            client = GeminiKeyManager.get_active_client()
            last_err = None

            for model_name in DRIFT_MODELS:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            temperature=0.1,  # Nhiệt độ thấp đảm bảo tính chính xác phân tích kỹ thuật
                            top_p=0.9,
                            max_output_tokens=2500,
                            response_mime_type="application/json",
                        ),
                    )
                    txt = resp.text or "{}"
                    return _parse_gemini_json(txt), model_name
                except Exception as ex:
                    last_err = ex
                    err_str = str(ex).lower()
                    if any(k in err_str for k in ("not found", "503", "unavailable", "overloaded", "404")):
                        logger.warning(f"Model {model_name} gặp sự cố ({ex}), chuyển sang model tiếp theo...")
                        continue
                    raise ex

            raise last_err or RuntimeError("Tất cả các model Gemini đều không khả dụng.")

        try:
            parsed, used_model = execute_with_gemini_retry(
                action=_call_gemini_drift,
                max_retries=3,
                initial_delay=1.0,
                backoff_factor=2.0,
                action_name="DriftAnalysis",
            )

            drift_score = float(parsed.get("drift_score", 0.0))
            drift_score = max(0.0, min(1.0, drift_score))

            explanation = parsed.get("explanation", "Phát hiện sai lệch giữa mã nguồn mới và tài liệu kỹ thuật.")
            
            raw_class = parsed.get("classification")
            classification = _normalize_classification(raw_class, explanation)

            # Đồng bộ severity chuẩn xác theo ngưỡng kỹ thuật của drift_score
            severity = _get_severity_by_score(drift_score)

            is_drifted = bool(parsed.get("is_drifted", drift_score >= 0.25))
            affected_secs = parsed.get("affected_sections", [])
            raw_suggs = parsed.get("suggestions", [])

            suggestions = [
                DriftSuggestion(
                    section=s.get("section", "Chung"),
                    old_text=s.get("old_text", ""),
                    suggested_text=s.get("suggested_text", ""),
                    reason=s.get("reason", ""),
                )
                for s in raw_suggs
                if isinstance(s, dict)
            ]

            logger.info(
                "[DriftAnalysis] Hoàn tất — model=%s, score=%.4f, severity=%s, classification=%s, is_drifted=%s",
                used_model, drift_score, severity, classification, is_drifted,
            )

            return DriftAnalyzeResponse(
                status="success",
                mode="real",
                entity_name=request.entity_name,
                entity_type=request.entity_type,
                drift_score=round(drift_score, 4),
                severity=severity,
                classification=classification,
                is_drifted=is_drifted,
                explanation=explanation,
                affected_sections=affected_secs,
                suggestions=suggestions,
                model_used=used_model,
            )

        except Exception as ex:
            logger.warning(f"[DriftAnalysis] Chuyển sang bộ phân tích Smart Diff dự phòng do lỗi Gemini: {ex}")
            return cls._fallback_smart_diff_analysis(request)
