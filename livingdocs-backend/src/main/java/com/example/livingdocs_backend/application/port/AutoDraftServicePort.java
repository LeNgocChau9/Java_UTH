package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.drift.ApplySuggestionRequestDto;
import com.example.livingdocs_backend.application.dto.drift.AutoDraftOnDriftResponse;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;

public interface AutoDraftServicePort {
    /**
     * Tự động gọi AI Engine (/v1/docs/rewrite-suggestion) viết lại tài liệu theo code diff của cảnh báo drift,
     * tạo bản ghi mới trong document_versions ở trạng thái PENDING_REVIEW (hoặc DRAFT),
     * ghi rõ tác nhân tạo là AI_AGENT,
     * gửi thông báo / tạo mục rà soát trong hàng đợi của nhân viên (Staff review queue),
     * và liên kết versionId này vào alert tương ứng.
     */
    AutoDraftOnDriftResponse generateDraftFromAlert(Long alertId, UserPrincipal actor);

    /**
     * Tự động sinh bản nháp mới cho tài liệu khi phát hiện mã nguồn thay đổi qua commit/PR,
     * gọi AI Engine (/v1/docs/rewrite-suggestion),
     * lưu phiên bản mới vào document_versions với actorRole là AI_AGENT và triggerType là AUTO_DRIFT_AI_REWRITE,
     * cập nhật trạng thái tài liệu sang UNDER_REVIEW_STAFF và đưa vào hàng đợi xem xét của Nhân viên.
     */
    AutoDraftOnDriftResponse generateAutoDraftForDocument(
            Long docId,
            String codeDiff,
            String commitHash,
            String summaryReason,
            UserPrincipal actor
    );

    /**
     * Chuyển đề xuất/gợi ý AI thành bản nháp chính thức (POST /api/auto-draft/apply-suggestion).
     */
    AutoDraftOnDriftResponse applySuggestion(ApplySuggestionRequestDto request, UserPrincipal actor);

    /**
     * Chấp nhận bản nháp DRAFT do AI sinh và đánh dấu cảnh báo drift là RESOLVED / ACCEPTED chỉ trong 1 click.
     */
    AutoDraftOnDriftResponse acceptDraft(Long alertId, UserPrincipal actor);
}
