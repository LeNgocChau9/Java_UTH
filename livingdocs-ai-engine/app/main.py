from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.endpoints import router as api_router

settings = get_settings()

app = FastAPI(
    title="LivingDocs AI Engine API",
    description="Dịch vụ AI phân tích mã nguồn (AST Extraction), phát hiện sai lệch tài liệu (Drift Detection) và tự động sinh tài liệu hỗ trợ bởi LLM.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cấu hình CORS để Spring Boot Backend và Next.js Frontend gọi API thoải mái
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoint kiểm tra sức khỏe dịch vụ
@app.get("/health", tags=["Health Check"], summary="Kiểm tra trạng thái dịch vụ")
async def health_check():
    return {
        "status": "UP",
        "service": "livingdocs-ai-engine",
        "mode": settings.mode,
        "version": "1.0.0"
    }

# Đăng ký các router nghiệp vụ
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
