from app.schemas.ai_schemas import (
    AstExtractRequest,
    AstExtractResponse,
    CodeEntityItem,
    DocGenerateRequest,
    DocGenerateResponse,
    GroundingEvidence
)

class MockAIService:
    @staticmethod
    def extract_ast(request: AstExtractRequest) -> AstExtractResponse:
        # Giả lập bóc tách class và các methods từ source_code
        class_name = "UserService"
        if "class " in request.source_code:
            try:
                parts = request.source_code.split("class ")[1].split()
                if parts:
                    class_name = parts[0].strip().replace("{", "")
            except Exception:
                pass

        entities = [
            CodeEntityItem(
                entity_type="CLASS",
                class_name=class_name,
                method_name=None,
                signature=f"public class {class_name}",
                return_type=None,
                parameters=None,
                start_line=10,
                end_line=65,
                doc_status="UNDOCUMENTED"
            ),
            CodeEntityItem(
                entity_type="METHOD",
                class_name=class_name,
                method_name="registerUser",
                signature="public UserResponse registerUser(RegisterRequest request)",
                return_type="UserResponse",
                parameters="RegisterRequest request",
                start_line=15,
                end_line=28,
                doc_status="UNDOCUMENTED"
            ),
            CodeEntityItem(
                entity_type="METHOD",
                class_name=class_name,
                method_name="authenticate",
                signature="public AuthResponse authenticate(AuthRequest request)",
                return_type="AuthResponse",
                parameters="AuthRequest request",
                start_line=30,
                end_line=45,
                doc_status="UNDOCUMENTED"
            ),
            CodeEntityItem(
                entity_type="METHOD",
                class_name=class_name,
                method_name="findByEmail",
                signature="public Optional<User> findByEmail(String email)",
                return_type="Optional<User>",
                parameters="String email",
                start_line=47,
                end_line=58,
                doc_status="UNDOCUMENTED"
            )
        ]

        return AstExtractResponse(
            status="success",
            mode="mock",
            file_path=request.file_path,
            commit_hash=request.commit_hash or "mock-commit-hash-001",
            total_entities=len(entities),
            entities=entities
        )

    @staticmethod
    def generate_doc(request: DocGenerateRequest) -> DocGenerateResponse:
        target_name = request.class_name or "UserService"
        
        markdown_doc = f"""# Tài liệu Kỹ thuật: `{target_name}`

> **Tự động sinh bởi LivingDocs AI Engine (Mock Mode)**
> - Mẫu áp dụng: `{request.template_type}`
> - Đường dẫn mã nguồn: `{request.file_path}`

---

## 1. Tổng quan
Lớp `{target_name}` chịu trách nhiệm cung cấp các dịch vụ xử lý nghiệp vụ người dùng, xác thực tài khoản và kiểm tra quyền trong hệ thống LivingDocs.

## 2. Danh sách phương thức & API

### 2.1. `registerUser(RegisterRequest request)`
- **Mô tả:** Đăng ký tài khoản người dùng mới vào hệ thống.
- **Tham số:** 
  - `request` (`RegisterRequest`): Chứa thông tin email, mật khẩu và họ tên.
- **Giá trị trả về:** `UserResponse` - Thông tin tài khoản vừa được khởi tạo thành công.
- **Trường hợp lỗi:** Bắn ra `EmailAlreadyExistsException` nếu địa chỉ email đã tồn tại.

### 2.2. `authenticate(AuthRequest request)`
- **Mô tả:** Xác thực danh tính người dùng bằng email và mật khẩu.
- **Tham số:**
  - `request` (`AuthRequest`): Email và mật khẩu người dùng.
- **Giá trị trả về:** `AuthResponse` - Token JWT (Access Token & Refresh Token).

### 2.3. `findByEmail(String email)`
- **Mô tả:** Tìm kiếm thông tin người dùng theo email.
- **Tham số:** `email` (`String`): Địa chỉ email cần tra cứu.
- **Giá trị trả về:** `Optional<User>` - Thực thể người dùng nếu tìm thấy.

---

## 3. Bằng chứng xác thực (Grounding Evidence)
- **Source File:** `{request.file_path}`
- **Entities Covered:** `{target_name}`, `registerUser`, `authenticate`, `findByEmail`
- **Verification Hash:** `mock-verified-hash-commit`
"""

        grounding = [
            GroundingEvidence(
                file_path=request.file_path,
                class_name=target_name,
                method_name="registerUser",
                start_line=15,
                end_line=28,
                commit_hash="mock-verified-hash-commit"
            ),
            GroundingEvidence(
                file_path=request.file_path,
                class_name=target_name,
                method_name="authenticate",
                start_line=30,
                end_line=45,
                commit_hash="mock-verified-hash-commit"
            )
        ]

        return DocGenerateResponse(
            status="success",
            mode="mock",
            template_type=request.template_type,
            file_path=request.file_path,
            generated_content=markdown_doc,
            confidence_score=0.96,
            grounding_evidence=grounding
        )
