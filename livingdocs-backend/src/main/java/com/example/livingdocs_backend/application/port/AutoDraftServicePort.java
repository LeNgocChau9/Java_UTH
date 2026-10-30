package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.drift.AutoDraftOnDriftResponse;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;

public interface AutoDraftServicePort {
    /**
     * Tự động gọi AI Engine viết lại tài liệu theo code diff của cảnh báo drift,
     * tạo bản ghi mới trong document_versions ở trạng thái DRAFT,
     * và liên kết versionId này vào alert tương ứng.
     */
    AutoDraftOnDriftResponse generateDraftFromAlert(Long alertId, UserPrincipal actor);

    /**
     * Chấp nhận bản nháp DRAFT do AI sinh và đánh dấu cảnh báo drift là RESOLVED / ACCEPTED chỉ trong 1 click.
     */
    AutoDraftOnDriftResponse acceptDraft(Long alertId, UserPrincipal actor);
}

