
from fastapi import APIRouter, HTTPException
from app.core.config import get_settings
from app.schemas.ai_schemas import (
    AstExtractRequest,
    AstExtractResponse,
    CodeEntityItem,
    DocGenerateRequest,
    DocGenerateResponse,
    AstDiffRequest,
    AstDiffResponse,
    FileDiffResult,
    DiffSummary,
    AffectedEntityItem,
    DriftAnalyzeRequest,
    DriftAnalyzeResponse,
    DocRewriteRequest,
    DocRewriteResponse,
    DocSectionDiffItem,
)
from app.services.mock_ai_service import MockAIService
from app.services.tree_sitter_ast_parser import parse_java_with_treesitter
from app.services.gemini_doc_service import GeminiDocService
from app.services.gemini_drift_service import GeminiDriftService
from app.services.gemini_rewrite_service import GeminiRewriteService
from app.services.diff_ast_service import DiffAstService
from app.core.gemini_retry import GeminiQuotaExceededError, GeminiServiceUnavailableError

router = APIRouter(prefix="/v1", tags=["AI Engine Endpoints"])

@router.post(
    "/ast/extract",
    response_model=AstExtractResponse,
    summary="Trích xuất phần tử mã nguồn Java (AST bằng Tree-sitter)",
    description="Nhận vào mã nguồn file Java, trả về JSON đầy đủ: Class name, Method name, Signature, Params, Return type, Javadoc, Start/End Line."
)
async def extract_ast(request: AstExtractRequest):
    settings = get_settings()

    # Chế độ mock: trả về dữ liệu mẫu giả lập
    if settings.mode.lower() == "mock":
        return MockAIService.extract_ast(request)

    # Chế độ real: Bóc tách bằng Tree-sitter Java chuẩn
    parsed = parse_java_with_treesitter(request.file_path, request.source_code)

    if parsed.get("parse_error"):
        raise HTTPException(
            status_code=422,
            detail=f"Lỗi phân tích cú pháp AST Java (Tree-sitter): {parsed['parse_error']}"
        )

    entities: list[CodeEntityItem] = []

    # 1. Thêm entity CLASS / INTERFACE / ENUM / RECORD
    if parsed.get("class_name"):
        c_type = parsed.get("class_type", "CLASS")
        c_name = parsed["class_name"]
        mods_str = " ".join(parsed.get("modifiers", [])) or "public"
        c_annotations = parsed.get("annotations", [])
        ann_prefix = f"{' '.join(c_annotations)} " if c_annotations else ""
        c_sig = f"{ann_prefix}{mods_str} {c_type.lower()} {c_name}"
        class_javadoc = parsed.get("javadoc")

        entities.append(CodeEntityItem(
            entity_type=c_type,
            class_name=c_name,
            method_name=None,
            signature=c_sig,
            return_type=None,
            parameters=None,
            start_line=parsed.get("start_line", 1),
            end_line=parsed.get("end_line", 1),
            doc_status="DOCUMENTED" if class_javadoc else "UNDOCUMENTED",
            javadoc=class_javadoc,
            annotations=c_annotations
        ))

    # 2. Thêm các METHOD và CONSTRUCTOR bóc tách chi tiết
    for m in parsed.get("methods", []):
        params_list = m.get("parameters", [])
        params_str_parts = []
        for p in params_list:
            p_ann = f"{' '.join(p['annotations'])} " if p.get("annotations") else ""
            params_str_parts.append(f"{p_ann}{p['type']} {p['name']}")
        params_str = ", ".join(params_str_parts)
        m_javadoc = m.get("javadoc")

        entities.append(CodeEntityItem(
            entity_type=m["entity_type"],
            class_name=m["class_name"],
            method_name=m["method_name"],
            signature=m["signature"],
            return_type=m.get("return_type"),
            parameters=params_str if params_str else None,
            start_line=m["start_line"],
            end_line=m["end_line"],
            doc_status="DOCUMENTED" if m_javadoc else "UNDOCUMENTED",
            javadoc=m_javadoc,
            annotations=m.get("annotations", [])
        ))

    return AstExtractResponse(
        status="success",
        mode="real",
        file_path=request.file_path,
        commit_hash=request.commit_hash or "unknown",
        total_entities=len(entities),
        entities=entities
    )


@router.post(
    "/docs/generate",
    response_model=DocGenerateResponse,
    summary="Tự động sinh tài liệu kỹ thuật từ mã nguồn theo mẫu",
    description="Nhận vào thông tin file, mẫu tài liệu (API_REFERENCE, README...) và trả về nội dung Markdown kèm bằng chứng xác thực."
)
async def generate_doc(request: DocGenerateRequest):
    settings = get_settings()
    if settings.mode.lower() == "mock":
        return MockAIService.generate_doc(request)

    # MODE=real (Task #81): Gọi Google Gemini API thật
    try:
        return GeminiDocService.generate_documentation(request)
    except GeminiQuotaExceededError as qe:
        raise HTTPException(
            status_code=429,
            detail=qe.message
        )
    except GeminiServiceUnavailableError as se:
        raise HTTPException(
            status_code=503,
            detail=se.message
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi nội bộ khi sinh tài liệu: {str(ex)}"
        )


@router.post(
    "/ast/diff",
    response_model=AstDiffResponse,
    summary="Đối chiếu AST Java giữa Base và Head commit của Pull Request",
    description="Phát hiện chính xác các phương thức Java bị xóa, thêm mới, đổi tên hoặc thay đổi chữ ký/tham số/thân hàm."
)
async def diff_ast(request: AstDiffRequest):
    file_results: list[FileDiffResult] = []
    total_affected = 0

    for f in request.files:
        diff_res = DiffAstService.compare_java_files(
            file_path=f.file_path,
            base_code=f.base_code,
            head_code=f.head_code,
            base_commit_hash=request.base_commit_hash,
            head_commit_hash=request.head_commit_hash
        )

        affected_items = [
            AffectedEntityItem(
                entity_type=e["entity_type"],
                class_name=e.get("class_name"),
                method_name=e["method_name"],
                change_type=e["change_type"],
                impact_level=e.get("impact_level", "MEDIUM"),
                old_signature=e.get("old_signature"),
                new_signature=e.get("new_signature"),
                old_parameters=e.get("old_parameters"),
                new_parameters=e.get("new_parameters"),
                old_return_type=e.get("old_return_type"),
                new_return_type=e.get("new_return_type"),
                start_line=e.get("start_line"),
                end_line=e.get("end_line"),
                details=e.get("details")
            )
            for e in diff_res.get("affected_entities", [])
        ]

        summary_dict = diff_res.get("summary", {})
        summary_obj = DiffSummary(
            added=summary_dict.get("added", 0),
            deleted=summary_dict.get("deleted", 0),
            renamed=summary_dict.get("renamed", 0),
            modified=summary_dict.get("modified", 0)
        )

        file_results.append(FileDiffResult(
            file_path=f.file_path,
            file_status=diff_res["file_status"],
            class_name=diff_res.get("class_name"),
            total_affected=diff_res["total_affected"],
            summary=summary_obj,
            affected_entities=affected_items
        ))

        total_affected += diff_res["total_affected"]

    return AstDiffResponse(
        status="success",
        repository_id=request.repository_id,
        pr_number=request.pr_number,
        base_commit_hash=request.base_commit_hash or "base-hash",
        head_commit_hash=request.head_commit_hash or "head-hash",
        total_files_analyzed=len(file_results),
        total_affected_entities=total_affected,
        files=file_results
    )


@router.post(
    "/drift/analyze",
    response_model=DriftAnalyzeResponse,
    summary="[S4-09] Phân tích sai lệch ngữ nghĩa tài liệu so với code diff",
    description=(
        "Nhận vào code diff (unified diff format) và đoạn tài liệu hiện tại. "
        "Gửi prompt phân tích ngữ nghĩa sang Google Gemini API. "
        "Trả về drift_score (0.0→1.0), phân loại sai lệch (REFERENCE/SIGNATURE/SEMANTIC), "
        "mức độ nghiêm trọng (LOW/MEDIUM/HIGH/CRITICAL) và danh sách đề xuất sửa đổi cụ thể."
    )
)
async def analyze_drift(request: DriftAnalyzeRequest):
    """
    Endpoint phân tích sai lệch ngữ nghĩa tài liệu — Task S4-09.
    """
    settings = get_settings()

    # Chế độ mock: trả về dữ liệu giả lập để test frontend không cần Gemini
    if settings.mode.lower() == "mock":
        return DriftAnalyzeResponse(
            status="success",
            mode="mock",
            entity_name=request.entity_name,
            entity_type=request.entity_type,
            drift_score=0.72,
            severity="HIGH",
            classification="SIGNATURE",
            is_drifted=True,
            explanation=(
                "[MOCK] Phương thức 'processPayment' đã thay đổi tham số từ (Long orderId, Double amount) "
                "sang (Long orderId, Double amount, String currency). Tài liệu hiện tại chưa đề cập "
                "tham số 'currency' mới và cũng chưa mô tả hành vi xử lý đa tiền tệ."
            ),
            affected_sections=["2. Chi tiết Phương thức", "2.1. processPayment"],
            suggestions=[
                {
                    "section": "2.1. processPayment",
                    "old_text": "- **Tham số:** `Long orderId`, `Double amount`",
                    "suggested_text": (
                        "- **Tham số:** `Long orderId`, `Double amount`, `String currency`\n"
                        "  - `currency`: Mã tiền tệ theo chuẩn ISO 4217 (vd: VND, USD, EUR)"
                    ),
                    "reason": "Tham số 'currency' đã được thêm vào signature của phương thức processPayment."
                }
            ],
            model_used="mock"
        )

    # Chế độ real: Gọi Gemini API thật
    try:
        return GeminiDriftService.analyze(request)
    except GeminiQuotaExceededError as qe:
        raise HTTPException(
            status_code=429,
            detail=qe.message
        )
    except GeminiServiceUnavailableError as se:
        raise HTTPException(
            status_code=503,
            detail=se.message
        )
    except RuntimeError as ex:
        raise HTTPException(
            status_code=503,
            detail=str(ex)
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi nội bộ khi phân tích drift: {str(ex)}"
        )


@router.post(
    "/docs/rewrite-suggestion",
    response_model=DocRewriteResponse,
    summary="[S4-10] AI Gợi ý đoạn văn bản sửa đổi theo Code mới",
    description=(
        "Tích hợp logic yêu cầu Google Gemini tự động viết lại phần mô tả tài liệu dựa trên code vừa thay đổi. "
        "Bảo đảm văn phong kỹ thuật chuẩn, chỉ sửa các mục bị ảnh hưởng, giữ nguyên các phần còn lại."
    )
)
async def rewrite_document_suggestion(request: DocRewriteRequest):
    """
    Endpoint AI Gợi ý đoạn văn bản sửa đổi theo Code mới — Task S4-10 (TV4).

    Luồng hoạt động:
    1. Nhận DocRewriteRequest (tài liệu hiện tại + code diff mới + ngữ cảnh).
    2. Gọi GeminiRewriteService.rewrite_document().
    3. Gemini phân tích mục bị tác động, viết lại chính xác nội dung kỹ thuật.
    4. Giữ nguyên 100% các mục không bị ảnh hưởng.
    5. Trả về updated_doc hoàn chỉnh cùng danh sách section_diffs để so sánh.
    """
    settings = get_settings()

    # Chế độ mock: hỗ trợ test frontend hoặc chạy offline
    if settings.mode.lower() == "mock":
        sample_updated = request.current_doc.replace(
            "public void processPayment(Long orderId, Double amount)",
            "public void processPayment(Long orderId, Double amount, String currency)"
        )
        return DocRewriteResponse(
            status="success",
            mode="mock",
            original_doc_length=len(request.current_doc),
            rewritten_doc_length=len(sample_updated),
            updated_doc=sample_updated,
            summary_of_changes="[MOCK] Cập nhật tham số String currency cho phương thức processPayment theo thay đổi mới nhất.",
            modified_sections_count=1,
            unchanged_sections_count=3,
            section_diffs=[
                DocSectionDiffItem(
                    section_title="2.1. processPayment",
                    status="MODIFIED",
                    old_content="- **Tham số:** Long orderId, Double amount",
                    new_content="- **Tham số:** Long orderId, Double amount, String currency",
                    change_reason="Thêm tham số currency mới vào phương thức xử lý thanh toán"
                )
            ],
            model_used="mock"
        )

    # Chế độ real: Gọi Gemini API thật
    try:
        return GeminiRewriteService.rewrite_document(request)
    except GeminiQuotaExceededError as qe:
        raise HTTPException(
            status_code=429,
            detail=qe.message
        )
    except GeminiServiceUnavailableError as se:
        raise HTTPException(
            status_code=503,
            detail=se.message
        )
    except RuntimeError as ex:
        raise HTTPException(
            status_code=503,
            detail=str(ex)
        )
    except Exception as ex:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi nội bộ khi AI viết lại tài liệu: {str(ex)}"
        )
