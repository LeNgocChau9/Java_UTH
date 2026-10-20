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
     * Xử lý phê duyệt hoặc từ chối tài liệu bởi Staff (Role Level 1).
     * - APPROVE: Chuyển sang UNDER_REVIEW_MANAGER
     * - REJECT: Chuyển sang REJECTED kèm lý do/nhận xét gửi lại cho tác giả.
     */
    DocumentResponse processStaffReview(Long docId, StaffReviewDecisionRequest request, Long actorId);
}
