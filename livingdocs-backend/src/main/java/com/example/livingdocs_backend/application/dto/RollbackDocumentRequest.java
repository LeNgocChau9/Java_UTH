package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RollbackDocumentRequest {

    @NotNull(message = "Số thứ tự phiên bản mục tiêu (targetVersion) không được để trống")
    @Schema(description = "Số thứ tự phiên bản muốn khôi phục về (ví dụ: 1)", example = "1")
    private Integer targetVersion;

    @Schema(description = "Lý do khôi phục phiên bản", example = "Phát hiện lỗi sai ở phiên bản hiện tại, khôi phục về phiên bản ổn định trước đó.")
    private String reason;

    @Schema(description = "Vai trò người thực hiện rollback: DEV, STAFF, MANAGER", example = "MANAGER")
    private String actorRole;
}
