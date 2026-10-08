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
from app.services.java_ast_parser import parse_java_file

router = APIRouter(prefix="/v1", tags=["AI Engine Endpoints"])

@router.post(
    "/ast/extract",
    response_model=AstExtractResponse,
    summary="Trích xuất phần tử mã nguồn Java (AST)",
    description="Nhận vào mã nguồn file Java, trả về danh sách các Class, Method, Signature, Start/End Line."
)
async def extract_ast(request: AstExtractRequest):
    settings = get_settings()

    # Chế độ mock: trả về dữ liệu mẫu giả lập ngay lập tức
    if settings.mode.lower() == "mock":
        return MockAIService.extract_ast(request)

    # Chế độ real (S1-11): Dùng javalang parser thật
    parsed = parse_java_file(request.file_path, request.source_code)

    if parsed.get("parse_error"):
        raise HTTPException(
            status_code=422,
            detail=f"Loi phan tich AST Java: {parsed['parse_error']}"
        )

    entities = []

    # Thêm entity CLASS / INTERFACE / ENUM
    if parsed.get("class_name"):
        total_lines = len(request.source_code.splitlines())
        entities.append(CodeEntityItem(
            entity_type=parsed.get("class_type", "CLASS"),
            class_name=parsed["class_name"],
            method_name=None,
            signature=f"public {parsed.get('class_type', 'class').lower()} {parsed['class_name']}",
            return_type=None,
            parameters=None,
            start_line=1,
            end_line=total_lines,
            doc_status="UNDOCUMENTED"
        ))

    # Thêm các METHOD và CONSTRUCTOR bóc tách thật từ AST
    for m in parsed.get("methods", []):
        params_str = ", ".join([f"{p['type']} {p['name']}" for p in m.get("parameters", [])])
        entities.append(CodeEntityItem(
            entity_type=m["entity_type"],
            class_name=m["class_name"],
            method_name=m["method_name"],
            signature=m["signature"],
            return_type=m.get("return_type"),
            parameters=params_str if params_str else None,
            start_line=m["start_line"],
            end_line=m["end_line"],
            doc_status="UNDOCUMENTED"
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
    # TODO S3-08: Tích hợp Gemini LLM thật khi MODE=real
    return MockAIService.generate_doc(request)
