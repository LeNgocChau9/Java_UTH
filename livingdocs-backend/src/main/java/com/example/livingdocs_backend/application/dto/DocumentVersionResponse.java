package com.example.livingdocs_backend.application.dto;

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
public class DocumentVersionResponse {

    @Schema(description = "ID phiên bản", example = "1")
    private Long versionId;

    @Schema(description = "ID tài liệu", example = "1")
    private Long docId;

    @Schema(description = "Số thứ tự phiên bản", example = "1")
    private Integer versionNum;

    @Schema(description = "Nội dung văn bản")
    private String content;

    @Schema(description = "Vai trò tác nhân: AI, DEV, STAFF, MANAGER", example = "DEV")
    private String actorRole;

    @Schema(description = "Loại kích hoạt", example = "MANUAL_CREATE")
    private String triggerType;

    @Schema(description = "Mã băm SHA-256 của phiên bản này", example = "8f4e2...")
    private String hash;

    @Schema(description = "Mã băm của phiên bản trước đó (chuỗi băm liên kết)", example = "0000000000000000000000000000000000000000000000000000000000000000")
    private String prevHash;

    @Schema(description = "Thời điểm tạo phiên bản")
    private Instant createdAt;
}
