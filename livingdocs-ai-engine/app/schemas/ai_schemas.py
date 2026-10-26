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

