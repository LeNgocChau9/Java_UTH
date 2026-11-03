package com.example.livingdocs_backend.application.dto.drift;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả tự động tạo bản nháp (Auto-Draft) hoặc chuyển gợi ý AI thành bản nháp")
public class AutoDraftOnDriftResponse {

    @Schema(description = "ID của cảnh báo drift", example = "50")
    private Long alertId;

    @Schema(description = "ID của tài liệu", example = "10")
    private Long documentId;

    @Schema(description = "ID của bản ghi document_versions mới tạo", example = "101")
    private Long versionId;

    @Schema(description = "Số phiên bản mới", example = "2")
    private Integer versionNum;

    @Schema(description = "Trạng thái của tài liệu / phiên bản", example = "PENDING_REVIEW")
    private String status;

    @Schema(description = "Vai trò tác nhân tạo", example = "AI_AGENT")
    private String actorRole;

    @Schema(description = "Loại trigger", example = "AUTO_DRIFT_AI_REWRITE")
    private String triggerType;

    @Schema(description = "Tóm tắt các sửa đổi do AI đề xuất")
    private String summaryOfChanges;

    @Schema(description = "Thông báo kết quả thực thi")
    private String message;

    @Schema(description = "Thời gian tạo bản nháp")
    private Instant createdAt;

    @Schema(description = "Toàn bộ nội dung tài liệu bản nháp mới sinh")
    private String updatedDoc;

    @Schema(description = "ID của mục trong hàng đợi rà soát của Staff", example = "15")
    private Long reviewId;

    @Schema(description = "Trạng thái hàng đợi rà soát", example = "PENDING")
    private String reviewStatus;
}
