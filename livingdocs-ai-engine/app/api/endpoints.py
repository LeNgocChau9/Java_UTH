from fastapi import APIRouter
from app.core.config import get_settings
from app.schemas.ai_schemas import (
    AstExtractRequest,
    AstExtractResponse,
    DocGenerateRequest,
    DocGenerateResponse
)
from app.services.mock_ai_service import MockAIService

router = APIRouter(prefix="/v1", tags=["AI Engine Endpoints"])

@router.post(
    "/ast/extract",
    response_model=AstExtractResponse,
    summary="Trích xuất phần tử mã nguồn Java (AST)",
    description="Nhận vào mã nguồn file Java, trả về danh sách các Class, Method, Signature, Start/End Line."
)
async def extract_ast(request: AstExtractRequest):
    settings = get_settings()
    # Ở chế độ mock hoặc chưa kích hoạt real mode, dùng MockAIService
    if settings.mode.lower() == "mock":
        return MockAIService.extract_ast(request)
    # TODO S2-11: Tích hợp AST extractor thật (Tree-sitter/javalang)
    return MockAIService.extract_ast(request)

@router.post(
    "/docs/generate",
    response_model=DocGenerateResponse,
    summary="Tự động sinh tài liệu kỹ thuật từ mã nguồn theo mẫu",
    description="Nhận vào thông tin file, mẫu tài liệu (API_REFERENCE, README...) và trả về nội dung Markdown kèm bằng chứng xác thực."
)
async def generate_doc(request: DocGenerateRequest):
    settings = get_settings()
    # Ở chế độ mock, trả về Markdown có sẵn kèm grounding evidence
    if settings.mode.lower() == "mock":
        return MockAIService.generate_doc(request)
    # TODO S3-08: Tích hợp Gemini LLM thật khi MODE=real
    return MockAIService.generate_doc(request)
