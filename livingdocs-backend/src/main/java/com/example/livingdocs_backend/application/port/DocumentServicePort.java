package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.*;

import java.util.List;

public interface DocumentServicePort {

    /**
     * Tạo tài liệu mới và tự động tạo phiên bản v1 kèm chuỗi băm (Genesis Hash).
     */
    DocumentResponse createDocument(CreateDocumentRequest request, Long actorId, String actorRole);

    /**
     * Cập nhật tài liệu: cập nhật thông tin và tự động tạo phiên bản mới v(N+1)
     * liên kết băm prev_hash từ phiên bản v(N).
     */
    DocumentResponse updateDocument(Long docId, UpdateDocumentRequest request, Long actorId, String actorRole);

    /**
     * Xem chi tiết tài liệu kèm nội dung mới nhất và lịch sử các phiên bản.
     */
    DocumentDetailResponse getDocumentById(Long docId);

    /**
     * Lấy danh sách tài liệu (hỗ trợ lọc theo repoId hoặc collectionId).
     */
    List<DocumentResponse> listDocuments(Long repoId, Long collectionId);

    /**
     * Tìm kiếm toàn văn và lọc đa tiêu chí trên cơ sở tri thức (tài liệu).
     */
    List<DocumentResponse> searchDocuments(Long repoId, Long collectionId, String keyword, String status, Long templateId);

    /**
     * Xóa tài liệu và toàn bộ các phiên bản lịch sử.
     */
    void deleteDocument(Long docId, Long actorId);

    /**
     * Lấy danh sách toàn bộ các phiên bản của tài liệu.
     */
    List<DocumentVersionResponse> getDocumentVersions(Long docId);

    /**
     * Lấy chi tiết một phiên bản cụ thể theo số versionNum.
     */
    DocumentVersionResponse getDocumentVersion(Long docId, Integer versionNum);

    /**
     * Gửi tài liệu để review: Chuyển trạng thái từ DRAFT sang UNDER_REVIEW_STAFF
     * theo đúng quy tắc kiểm soát của DocumentStateMachine.
     */
    DocumentResponse submitForReview(Long docId, Long actorId);

    /**
     * Kiểm tra tính toàn vẹn chuỗi băm (Hash Chain Integrity Verification)
     * để chứng minh lịch sử phiên bản chưa từng bị chỉnh sửa trái phép trong CSDL.
     */
    IntegrityCheckResponse verifyIntegrity(Long docId);

    /**
     * Khôi phục (Rollback) tài liệu về một phiên bản chỉ định.
     * Tạo ra một phiên bản mới kế tiếp với nội dung của phiên bản mục tiêu,
     * liên kết nối tiếp chuỗi băm (hash chain) để đảm bảo lịch sử bất biến và toàn vẹn.
     */
    RollbackResponse rollbackToVersion(Long docId, Integer targetVersion, String reason, Long actorId, String actorRole);

    /**
     * Khôi phục (Rollback) tài liệu về một bản ghi phiên bản theo versionId trong bảng lịch sử thay đổi.
     */
    default RollbackResponse rollbackByVersionId(Long docId, Long versionId, String reason, Long actorId, String actorRole) {
        throw new UnsupportedOperationException("Chưa hỗ trợ rollbackByVersionId");
    }

    /**
     * Khôi phục hàng loạt (Bulk Rollback) toàn bộ các tài liệu thuộc cùng một bộ sưu tập về phiên bản an toàn trước đó.
     */
    default com.example.livingdocs_backend.application.dto.CollectionRollbackResponse rollbackCollection(
            Long collectionId,
            com.example.livingdocs_backend.application.dto.CollectionRollbackRequest request,
            Long actorId,
            String actorRole) {
        throw new UnsupportedOperationException("Chưa hỗ trợ rollbackCollection");
    }

    /**
     * Xử lý phê duyệt hoặc từ chối tài liệu bởi Staff (Duyệt cấp 1).
     * Chỉ người có vai trò STAFF hoặc MANAGER mới có quyền thực hiện.
     * - APPROVE: Chuyển sang UNDER_REVIEW_MANAGER
     * - REJECT: Chuyển sang REJECTED kèm lý do/nhận xét gửi lại cho tác giả.
     */
    DocumentResponse processStaffReview(Long docId, StaffReviewDecisionRequest request, Long actorId);
    DocumentResponse processStaffReview(Long docId, StaffReviewDecisionRequest request, Long actorId, String actorRole);

    /**
     * Xử lý phê duyệt hoặc từ chối tài liệu bởi Manager (Duyệt cấp 2).
     * Chỉ người có vai trò MANAGER mới có quyền thực hiện.
     * - APPROVE / PUBLISH: Chuyển sang PUBLISHED và kích hoạt đẩy commit lên GitHub
     * - RETURN_STAFF: Trả lại cho Staff xem xét lại (UNDER_REVIEW_STAFF)
     * - REJECT: Chuyển sang REJECTED kèm lý do/nhận xét gửi lại cho tác giả.
     */
    DocumentResponse processManagerReview(Long docId, ManagerReviewDecisionRequest request, Long actorId);
    DocumentResponse processManagerReview(Long docId, ManagerReviewDecisionRequest request, Long actorId, String actorRole);

    /**
     * Lấy nhật ký lịch sử thay đổi (Audit trail) của tài liệu bao gồm các sự kiện tạo, gửi duyệt, nhận xét của Staff và quyết định của Manager.
     */
    List<DocumentAuditLogResponse> getDocumentAuditLogs(Long docId);

    /**
     * Lấy danh sách changelogs của tài liệu.
     */
    List<ChangelogResponse> getDocumentChangelogs(Long docId);

    /**
     * Xuất bản tài liệu lên GitHub bằng GitHub Contents API.
     */
    PublishToGitHubResponse publishToGitHub(Long docId, PublishToGitHubRequest request, Long actorId);

    /**
     * Đẩy nội dung Markdown hiện tại lên branch mặc định bằng GitHub Contents API.
     * Ném IllegalArgumentException nếu không tạo được commit.
     */
    String commitMarkdownToDefaultBranch(Long docId);

    /**
     * Đẩy file .md lên branch mặc định. Thông điệp commit ghi người phê duyệt và mã phiên bản.
     * Ưu tiên token GitHub của người duyệt (cần scope repo) rồi mới tới token của repository.
     */
    String commitMarkdownToDefaultBranch(Long docId, Long actorId, String approverLabel);

    /**
     * Cập nhật lại / tạo lại tài liệu của một hàm hoặc lớp cụ thể (Regenerate Entity Doc).
     * Trích xuất mã nguồn hàm/lớp, gọi AI Engine (/v1/docs/rewrite-suggestion) viết lại mô tả của hàm đó
     * và cập nhật trực tiếp vào tài liệu tổng thể mà không cần sinh lại toàn bộ file.
     */
    RegenerateEntityDocResponse regenerateEntityDoc(Long docId, RegenerateEntityDocRequest request, Long actorId, String actorRole);

    /**
     * Nạp tài liệu từ file Microsoft Word (.docx), chuẩn hóa thành Markdown,
     * tự động tạo phiên bản v1 và liên kết với các thực thể code trong repo.
     */
    DocumentResponse importDocxDocument(org.springframework.web.multipart.MultipartFile file, Long repoId, String title, String targetPath, Long actorId, String actorRole);

    /**
     * Nạp tài liệu từ các nguồn doanh nghiệp bên ngoài (Google Docs, Confluence, Jira, Markdown),
     * tự động tạo phiên bản v1 và liên kết với các thực thể code trong repo.
     */
    DocumentResponse importExternalDocument(com.example.livingdocs_backend.application.dto.ImportExternalDocRequest request, Long actorId, String actorRole);
}
