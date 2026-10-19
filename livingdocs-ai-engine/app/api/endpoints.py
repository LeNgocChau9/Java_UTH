from fastapi import APIRouter, HTTPException
from app.core.config import get_settings
from app.schemas.ai_schemas import (
    AstExtractRequest,
    AstExtractResponse,
    CodeEntityItem,
    DocGenerateRequest,
    DocGenerateResponse
)
from app.services.mock_ai_service import MockAIService
from app.services.tree_sitter_ast_parser import parse_java_with_treesitter
from app.services.gemini_doc_service import GeminiDocService

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
        c_sig = f"{mods_str} {c_type.lower()} {c_name}"
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
            javadoc=class_javadoc
        ))

    # 2. Thêm các METHOD và CONSTRUCTOR bóc tách chi tiết
    for m in parsed.get("methods", []):
        params_list = m.get("parameters", [])
        params_str = ", ".join([f"{p['type']} {p['name']}" for p in params_list])
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
            javadoc=m_javadoc
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
    return GeminiDocService.generate_documentation(request)
