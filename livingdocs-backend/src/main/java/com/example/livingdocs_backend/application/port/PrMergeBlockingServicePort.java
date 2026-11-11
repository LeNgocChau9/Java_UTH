package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.drift.PrMergeBlockingPolicyDto;
import com.example.livingdocs_backend.application.dto.github.GitHubCheckRunResultDto;

/**
 * Port xử lý nghiệp vụ Chặn Hợp nhất Pull Request khi tài liệu bị sai lệch nghiêm trọng (Issue #208).
 */
public interface PrMergeBlockingServicePort {

    /**
     * Lấy cấu hình chính sách chặn gộp PR từ CSDL.
     */
    PrMergeBlockingPolicyDto getBlockingPolicy();

    /**
     * Cập nhật cấu hình chính sách chặn gộp PR bởi Quản lý (Manager/Admin).
     */
    PrMergeBlockingPolicyDto updateBlockingPolicy(PrMergeBlockingPolicyDto dto, Long actorId, String actorUsername);

    /**
     * Đánh giá sai lệch và gửi trạng thái Checks API / Commit Statuses lên GitHub PR (Báo Đỏ nếu sai lệch nghiêm trọng).
     *
     * @param repositoryId ID của repository
     * @param prNumber Số hiệu PR
     * @param headSha Commit SHA ở đỉnh nhánh PR
     * @return Kết quả Check Run hoặc null
     */
    GitHubCheckRunResultDto evaluateAndSendPrCheck(Long repositoryId, int prNumber, String headSha);

    /**
     * Kiểm tra và tự động mở khóa (Gửi trạng thái Xanh - Success) lên GitHub PR
     * khi tài liệu liên quan đã được phê duyệt (APPROVED/PUBLISHED) hoặc cảnh báo đã được giải quyết (RESOLVED).
     *
     * @param documentId ID của tài liệu vừa được phê duyệt
     */
    void notifyDocumentApproved(Long documentId);
}

