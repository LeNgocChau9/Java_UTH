package com.example.livingdocs_backend.application.dto.drift;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Cấu hình chính sách Chặn Hợp nhất Pull Request khi tài liệu bị sai lệch nghiêm trọng (Task tuần 6 - Issue #208).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Chính sách kiểm soát và chặn gộp Pull Request khi có sai lệch tài liệu nghiêm trọng")
public class PrMergeBlockingPolicyDto {

    @Schema(description = "Bật/Tắt cơ chế kiểm tra tính toàn vẹn tài liệu trên GitHub Checks/Statuses", example = "true")
    @Builder.Default
    private Boolean enabled = true;

    @Schema(description = "Chế độ chặn: STRICT (Chặn cứng - đánh dấu Failure) hoặc WARN_ONLY (Chỉ cảnh báo nhắc nhở)", example = "STRICT")
    @Builder.Default
    private String blockingMode = "STRICT";

    @Schema(description = "Mức độ sai lệch tối thiểu kích hoạt chặn: CRITICAL hoặc HIGH", example = "CRITICAL")
    @Builder.Default
    private String minSeverity = "CRITICAL";

    @Schema(description = "Tên ngữ cảnh hiển thị trên GitHub Checks / Status", example = "LivingDocs / Doc Drift Guard")
    @Builder.Default
    private String checkName = "LivingDocs / Doc Drift Guard";

    @Schema(description = "Tự động gửi Check Run màu xanh (Success) khi tất cả tài liệu bị ảnh hưởng đã được phê duyệt", example = "true")
    @Builder.Default
    private Boolean autoUnlockOnApproval = true;

    @Schema(description = "Thời điểm cập nhật cấu hình gần nhất")
    private Instant updatedAt;

    @Schema(description = "Người cập nhật cấu hình gần nhất")
    private String updatedBy;
}

