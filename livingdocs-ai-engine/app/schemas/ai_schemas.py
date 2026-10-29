from typing import List, Optional
from pydantic import BaseModel, Field

class AstExtractRequest(BaseModel):
    repository_id: Optional[int] = Field(default=1, description="ID kho lưu trữ trong hệ thống")
    file_path: str = Field(..., description="Đường dẫn tương đối của file nguồn Java (vd: src/main/java/.../UserService.java)")
    source_code: str = Field(..., description="Nội dung mã nguồn Java cần phân tích AST")
    commit_hash: Optional[str] = Field(default="mock-commit-hash-001", description="Mã băm commit của mã nguồn")

class CodeEntityItem(BaseModel):
    entity_type: str = Field(..., description="Loại phần tử mã: CLASS, INTERFACE, ENUM, METHOD, CONSTRUCTOR")
    class_name: Optional[str] = Field(None, description="Tên lớp cha hoặc chính lớp này")
    method_name: Optional[str] = Field(None, description="Tên hàm/phương thức nếu là METHOD")
    signature: str = Field(..., description="Chữ ký đầy đủ của class/method")
    return_type: Optional[str] = Field(None, description="Kiểu dữ liệu trả về nếu là method")
    parameters: Optional[str] = Field(None, description="Danh sách tham số (vd: String email, String password)")
    start_line: int = Field(..., description="Dòng bắt đầu trong file mã nguồn")
    end_line: int = Field(..., description="Dòng kết thúc trong file mã nguồn")
    doc_status: str = Field(default="UNDOCUMENTED", description="Trạng thái tài liệu: DOCUMENTED, UNDOCUMENTED, DRIFTED")
    javadoc: Optional[str] = Field(default=None, description="Tài liệu Javadoc bóc tách từ mã nguồn nếu có")
    annotations: Optional[List[str]] = Field(default=[], description="Danh sách các annotation của class hoặc method (vd: @RestController, @GetMapping)")


class AstExtractResponse(BaseModel):
    status: str = Field(default="success")
    mode: str = Field(..., description="Chế độ xử lý: mock hoặc real")
    file_path: str
    commit_hash: str
    total_entities: int
    entities: List[CodeEntityItem]

class DocGenerateRequest(BaseModel):
    template_type: str = Field(default="API_REFERENCE", description="Loại mẫu tài liệu: API_REFERENCE, README, MODULE_GUIDE, ADR")
    file_path: str = Field(..., description="Đường dẫn file nguồn tương ứng")
    class_name: Optional[str] = Field(None, description="Tên lớp chính cần sinh tài liệu")
    entities: Optional[List[CodeEntityItem]] = Field(default=None, description="Danh sách các entity bóc tách từ AST")
    source_code: Optional[str] = Field(default=None, description="Mã nguồn tham chiếu nếu có")

class GroundingEvidence(BaseModel):
    file_path: str
    class_name: Optional[str] = None
    method_name: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    commit_hash: Optional[str] = None

class DocGenerateResponse(BaseModel):
    status: str = Field(default="success")
    mode: str = Field(..., description="Chế độ xử lý: mock hoặc real")
    template_type: str
    file_path: str
    generated_content: str = Field(..., description="Nội dung Markdown tài liệu được sinh")
    confidence_score: float = Field(..., description="Điểm tin cậy của tài liệu sinh bởi AI (0.0 đến 1.0)")
    grounding_evidence: List[GroundingEvidence] = Field(default=[], description="Bằng chứng xác thực liên kết mã nguồn")


# --- Schemas cho Pipeline đối chiếu Code phát hiện hàm thay đổi từ PR (Thành viên 2) ---

class FileDiffItem(BaseModel):
    file_path: str = Field(..., description="Đường dẫn tương đối của file Java (vd: src/main/java/.../UserService.java)")
    base_code: Optional[str] = Field(default="", description="Nội dung mã nguồn ở commit cũ (base)")
    head_code: Optional[str] = Field(default="", description="Nội dung mã nguồn ở commit mới (head)")

class AstDiffRequest(BaseModel):
    repository_id: Optional[int] = Field(default=1, description="ID kho lưu trữ trong hệ thống")
    pr_number: Optional[int] = Field(default=None, description="Số hiệu Pull Request nếu có")
    base_commit_hash: Optional[str] = Field(default="base-hash", description="Mã băm commit base")
    head_commit_hash: Optional[str] = Field(default="head-hash", description="Mã băm commit head")
    files: List[FileDiffItem] = Field(..., description="Danh sách các file cần đối chiếu AST")

class AffectedEntityItem(BaseModel):
    entity_type: str = Field(..., description="METHOD hoặc CONSTRUCTOR")
    class_name: Optional[str] = Field(None, description="Tên class chứa hàm")
    method_name: str = Field(..., description="Tên hàm")
    change_type: str = Field(..., description="DELETED, ADDED, RENAMED, PARAM_CHANGED, RETURN_TYPE_CHANGED, SIGNATURE_CHANGED, BODY_CHANGED")
    impact_level: str = Field(default="MEDIUM", description="Mức độ nghiêm trọng: LOW, MEDIUM, HIGH, CRITICAL")
    old_signature: Optional[str] = None
    new_signature: Optional[str] = None
    old_parameters: Optional[str] = None
    new_parameters: Optional[str] = None
    old_return_type: Optional[str] = None
    new_return_type: Optional[str] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    details: Optional[str] = None

class DiffSummary(BaseModel):
    added: int = 0
    deleted: int = 0
    renamed: int = 0
    modified: int = 0

class FileDiffResult(BaseModel):
    file_path: str
    file_status: str = Field(..., description="MODIFIED, ADDED, DELETED, UNCHANGED")
    class_name: Optional[str] = None
    total_affected: int = 0
    summary: DiffSummary
    affected_entities: List[AffectedEntityItem] = []

class AstDiffResponse(BaseModel):
    status: str = Field(default="success")
    repository_id: Optional[int] = None
    pr_number: Optional[int] = None
    base_commit_hash: str
    head_commit_hash: str
    total_files_analyzed: int
    total_affected_entities: int
    files: List[FileDiffResult]


# ---------------------------------------------------------------------------
# Schemas cho Endpoint /v1/drift/analyze — Phân tích sai lệch ngữ nghĩa (S4-09)
# ---------------------------------------------------------------------------

class DriftAnalyzeRequest(BaseModel):
    """Dữ liệu đầu vào gửi Gemini phân tích sai lệch tài liệu."""
    code_diff: str = Field(
        ...,
        description="Code diff (unified diff format) thể hiện thay đổi mã nguồn từ Pull Request/Commit."
    )
    current_doc: str = Field(
        ...,
        description="Nội dung tài liệu hiện tại (Markdown hoặc plain text) đang được lưu trong hệ thống."
    )
    entity_name: Optional[str] = Field(
        default=None,
        description="Tên thực thể mã đang được tài liệu hóa (vd: OrderService, processPayment)."
    )
    entity_type: Optional[str] = Field(
        default=None,
        description="Loại thực thể: CLASS, METHOD, CONSTRUCTOR, ENDPOINT, MODULE."
    )
    file_path: Optional[str] = Field(
        default=None,
        description="Đường dẫn file nguồn Java/Python tương ứng."
    )
    document_id: Optional[int] = Field(
        default=None,
        description="ID tài liệu trong hệ thống LivingDocs."
    )
    repository_id: Optional[int] = Field(
        default=None,
        description="ID kho lưu trữ trong hệ thống."
    )
    pr_number: Optional[int] = Field(
        default=None,
        description="Số Pull Request kích hoạt phân tích."
    )
    commit_hash: Optional[str] = Field(
        default=None,
        description="Mã băm commit head của Pull Request."
    )


class DriftSuggestion(BaseModel):
    """Một đề xuất sửa đổi cụ thể cho một phần của tài liệu."""
    section: str = Field(..., description="Tên mục hoặc heading trong tài liệu cần cập nhật.")
    old_text: str = Field(..., description="Đoạn văn bản cũ cần thay thế.")
    suggested_text: str = Field(..., description="Đoạn văn bản mới AI đề xuất thay thế.")
    reason: str = Field(..., description="Lý do kỹ thuật cần cập nhật đoạn này.")


class DriftAnalyzeResponse(BaseModel):
    """Kết quả phân tích sai lệch tài liệu ngữ nghĩa từ Gemini."""
    status: str = Field(default="success")
    mode: str = Field(default="real", description="Chế độ: real (Gemini API) hoặc mock.")
    entity_name: Optional[str] = Field(None, description="Tên thực thể được phân tích.")
    entity_type: Optional[str] = Field(None, description="Loại thực thể được phân tích.")
    drift_score: float = Field(
        ...,
        ge=0.0, le=1.0,
        description="Điểm sai lệch ngữ nghĩa từ 0.0 (nhất quán) đến 1.0 (hoàn toàn lỗi thời)."
    )
    severity: str = Field(
        ...,
        description="Mức độ: LOW (<0.25), MEDIUM (0.25-0.55), HIGH (0.55-0.80), CRITICAL (>0.80)."
    )
    classification: str = Field(
        ...,
        description="Phân loại: REFERENCE, SIGNATURE hoặc SEMANTIC."
    )
    is_drifted: bool = Field(
        ...,
        description="True nếu tài liệu bị coi là lỗi thời (drift_score >= 0.25)."
    )
    explanation: str = Field(
        ...,
        description="Giải thích từ AI về nguyên nhân sai lệch."
    )
    affected_sections: List[str] = Field(
        default=[],
        description="Danh sách các mục trong tài liệu bị ảnh hưởng."
    )
    suggestions: List[DriftSuggestion] = Field(
        default=[],
        description="Danh sách đề xuất sửa đổi cụ thể cho từng phần tài liệu bị ảnh hưởng."
    )
    model_used: str = Field(
        default="gemini-3.8-flash",
        description="Tên model Gemini đã sử dụng."
    )


# ---------------------------------------------------------------------------
# Schemas cho Endpoint /v1/docs/rewrite-suggestion — AI Gợi ý viết lại tài liệu (S4-10)
# ---------------------------------------------------------------------------

class DocSectionDiffItem(BaseModel):
    """Chi tiết thay đổi ở từng section được AI viết lại."""
    section_title: str = Field(..., description="Tiêu đề mục hoặc heading (vd: 2.1. processPayment)")
    status: str = Field(..., description="MODIFIED (đã sửa đổi) hoặc UNCHANGED (giữ nguyên)")
    old_content: str = Field(..., description="Nội dung cũ của section này")
    new_content: str = Field(..., description="Nội dung mới do AI viết lại hoặc giữ nguyên")
    change_reason: Optional[str] = Field(default=None, description="Lý do kỹ thuật viết lại section này")


class DocRewriteRequest(BaseModel):
    """Yêu cầu AI viết lại tài liệu dựa trên code diff mới."""
    current_doc: str = Field(
        ...,
        description="Toàn bộ nội dung tài liệu Markdown hiện tại cần cập nhật"
    )
    code_diff: str = Field(
        ...,
        description="Unified code diff hoặc danh sách thay đổi mã nguồn mới nhất"
    )
    file_path: Optional[str] = Field(
        default=None,
        description="Đường dẫn file mã nguồn tương ứng (vd: src/main/java/.../OrderService.java)"
    )
    entity_name: Optional[str] = Field(
        default=None,
        description="Tên thực thể mã nguồn chính (vd: OrderService)"
    )
    commit_hash: Optional[str] = Field(
        default="head-commit",
        description="Mã băm commit của phiên bản code mới"
    )
    instruction: Optional[str] = Field(
        default=None,
        description="Yêu cầu bổ sung cho AI (vd: nhấn mạnh ngoại lệ, giữ phong cách ngắn gọn...)"
    )


class DocRewriteResponse(BaseModel):
    """Kết quả tài liệu đã được AI viết lại thông minh."""
    status: str = Field(default="success")
    mode: str = Field(default="real", description="Chế độ xử lý: real hoặc mock")
    original_doc_length: int = Field(..., description="Số ký tự của tài liệu ban đầu")
    rewritten_doc_length: int = Field(..., description="Số ký tự của tài liệu sau khi viết lại")
    updated_doc: str = Field(
        ...,
        description="Toàn bộ nội dung tài liệu Markdown đã cập nhật, giữ nguyên các phần không bị ảnh hưởng"
    )
    summary_of_changes: str = Field(
        ...,
        description="Tóm tắt ngắn gọn các điểm đã cập nhật trong tài liệu (1-3 câu)"
    )
    modified_sections_count: int = Field(
        ...,
        description="Số lượng mục/section đã được cập nhật nội dung mới"
    )
    unchanged_sections_count: int = Field(
        ...,
        description="Số lượng mục/section được giữ nguyên hoàn toàn"
    )
    section_diffs: List[DocSectionDiffItem] = Field(
        default=[],
        description="Chi tiết đối chiếu từng section cũ và mới"
    )
    model_used: str = Field(
        default="gemini-3.5-flash-lite",
        description="Model Gemini đã thực hiện viết lại"
    )
