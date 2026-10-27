"""
gemini_drift_service.py
Module phân tích sai lệch tài liệu ngữ nghĩa (Semantic Drift Detection) — Task S4-09.

Sử dụng Google Gemini API (google-genai SDK mới) để:
  1. Nhận vào code diff và đoạn tài liệu hiện tại.
  2. Phân tích mức độ sai lệch ngữ nghĩa giữa tài liệu và code.
  3. Trả về drift_score (0.0→1.0), phân loại, mức độ nghiêm trọng và đề xuất sửa.
"""

import os
import json
import logging
from google import genai
from google.genai import types as genai_types
from app.core.config import get_settings
from app.schemas.ai_schemas import (
    DriftAnalyzeRequest,
    DriftAnalyzeResponse,
    DriftSuggestion,
)

logger = logging.getLogger(__name__)

# Danh sách model Gemini ưu tiên (có cơ chế fallback nếu model chính bị 503 high demand)
DRIFT_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-lite-latest",
]

# Ngưỡng phân loại mức độ theo drift_score
SEVERITY_THRESHOLDS = {
    "LOW":      (0.0,  0.25),
    "MEDIUM":   (0.25, 0.55),
    "HIGH":     (0.55, 0.80),
    "CRITICAL": (0.80, 1.01),
}

# Mapping nhóm phân loại drift theo kết quả phân tích
CLASSIFICATION_KEYWORDS = {
    "REFERENCE":  ["renamed", "removed", "deleted", "no longer exists", "moved", "not found", "xóa", "đổi tên"],
    "SIGNATURE":  ["parameter", "return type", "signature changed", "new argument", "removed argument", "tham số", "chữ ký"],
    "SEMANTIC":   ["behavior", "logic", "semantic", "meaning", "functionality", "algorithm", "ngữ nghĩa", "hành vi"],
}


def _get_severity(score: float) -> str:
    for label, (lo, hi) in SEVERITY_THRESHOLDS.items():
        if lo <= score < hi:
            return label
    return "CRITICAL"


def _infer_classification(explanation: str) -> str:
    text = explanation.lower()
    for cls, keywords in CLASSIFICATION_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            return cls
    return "SEMANTIC"


def _parse_gemini_json(raw_text: str) -> dict:
    """
    Trích xuất JSON từ phản hồi Gemini, bỏ qua markdown code fence nếu có.
    """
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    return json.loads(text)


class GeminiDriftService:

    @staticmethod
    def _build_client() -> genai.Client:
        settings = get_settings()
        api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY không tìm thấy trong .env. "
                "Kiểm tra lại file livingdocs-ai-engine/.env"
            )
        return genai.Client(api_key=api_key)

    @staticmethod
    def _build_prompt(request: DriftAnalyzeRequest) -> str:
        """
        Xây dựng prompt kỹ thuật gửi Gemini phân tích sai lệch ngữ nghĩa.
        Yêu cầu trả về JSON thuần túy theo đúng schema.
        """
        entity_info = ""
        if request.entity_name or request.entity_type:
            entity_info = (
                f"\n- Thực thể đang phân tích: "
                f"{request.entity_type or 'UNKNOWN'} `{request.entity_name or 'unknown'}`"
            )

        prompt = f"""Bạn là chuyên gia phân tích chất lượng tài liệu kỹ thuật phần mềm (Technical Documentation Auditor).

## Nhiệm vụ
Phân tích xem đoạn TÀI LIỆU HIỆN TẠI có còn chính xác, đầy đủ và nhất quán với CODE MỚI sau khi thay đổi không.
{entity_info}

## CODE DIFF (thay đổi mã nguồn mới nhất từ Pull Request)
```diff
{request.code_diff}
```

## TÀI LIỆU HIỆN TẠI (đang được lưu trong hệ thống)
```
{request.current_doc}
```

## YÊU CẦU PHÂN TÍCH CHI TIẾT
Hãy đánh giá 4 tiêu chí sau:
1. **Tham chiếu (Reference)**: Tài liệu có đề cập tên class/method/biến nào bị xóa, đổi tên không?
2. **Chữ ký (Signature)**: Tài liệu mô tả sai tham số, kiểu trả về, hay chữ ký hàm không?
3. **Ngữ nghĩa (Semantic)**: Logic, hành vi, thuật toán trong tài liệu có còn đúng với code mới không?
4. **Độ đầy đủ (Completeness)**: Code mới có thêm tính năng/tham số mới mà tài liệu chưa đề cập không?

## ĐỊNH DẠNG ĐẦU RA BẮT BUỘC
Trả về DUY NHẤT một JSON object hợp lệ (không thêm bất kỳ text nào khác, không markdown):
{{
  "drift_score": <số thực 0.0 đến 1.0 — 0.0 = hoàn toàn nhất quán, 1.0 = hoàn toàn lỗi thời>,
  "explanation": "<Giải thích ngắn gọn bằng tiếng Việt về lý do sai lệch (1-3 câu)>",
  "is_drifted": <true nếu drift_score >= 0.25, ngược lại false>,
  "affected_sections": ["<danh sách tên mục tài liệu bị ảnh hưởng>"],
  "suggestions": [
    {{
      "section": "<tên mục cần sửa>",
      "old_text": "<đoạn văn bản cũ trong tài liệu>",
      "suggested_text": "<đoạn văn bản mới đề xuất thay thế>",
      "reason": "<lý do cần sửa>"
    }}
  ]
}}

LƯU Ý QUAN TRỌNG:
- drift_score phải phản ánh mức độ sai lệch thực tế dựa trên phân tích kỹ thuật (0.0 đến 1.0).
- Nếu code diff không ảnh hưởng đến nội dung tài liệu, trả về drift_score thấp (< 0.2).
- Mỗi suggestion phải cụ thể, có thể áp dụng trực tiếp.
"""
        return prompt

    @classmethod
    def analyze(cls, request: DriftAnalyzeRequest) -> DriftAnalyzeResponse:
        """
        Phân tích sai lệch tài liệu ngữ nghĩa bằng Gemini API có cơ chế fallback model.
        """
        client = cls._build_client()
        prompt = cls._build_prompt(request)

        logger.info(
            "[DriftAnalysis] Bắt đầu phân tích drift — entity='%s', doc_length=%d, diff_length=%d",
            request.entity_name or "N/A",
            len(request.current_doc),
            len(request.code_diff),
        )

        last_error = None
        parsed = None
        used_model = None

        for model_name in DRIFT_MODELS:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(
                        temperature=0.1,      # Cần chính xác kỹ thuật cao
                        top_p=0.9,
                        max_output_tokens=2000,
                        response_mime_type="application/json",
                    ),
                )

                raw_text = response.text or "{}"
                parsed = _parse_gemini_json(raw_text)
                used_model = model_name
                break
            except Exception as ex:
                logger.warning("[DriftAnalysis] Thử model %s thất bại: %s. Đang thử model kế tiếp...", model_name, ex)
                last_error = ex

        if parsed is None:
            raise RuntimeError(f"Tất cả các model Gemini đều không khả dụng: {last_error}")

        # Trích xuất các trường từ JSON phản hồi
        drift_score = float(parsed.get("drift_score", 0.0))
        drift_score = max(0.0, min(1.0, drift_score))

        explanation   = parsed.get("explanation", "Không có giải thích từ AI.")
        is_drifted    = bool(parsed.get("is_drifted", drift_score >= 0.25))
        affected_secs = parsed.get("affected_sections", [])
        raw_suggs     = parsed.get("suggestions", [])

        suggestions = [
            DriftSuggestion(
                section=s.get("section", ""),
                old_text=s.get("old_text", ""),
                suggested_text=s.get("suggested_text", ""),
                reason=s.get("reason", ""),
            )
            for s in raw_suggs
            if isinstance(s, dict)
        ]

        severity       = _get_severity(drift_score)
        classification = _infer_classification(explanation)

        logger.info(
            "[DriftAnalysis] Hoàn tất — model=%s, score=%.3f, severity=%s, classification=%s, is_drifted=%s",
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
