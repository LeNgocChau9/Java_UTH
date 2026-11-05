package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO cho API POST /api/documents/{id}/regenerate-entity
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả cập nhật tài liệu cho thực thể cụ thể")
public class RegenerateEntityDocResponse {

    @Schema(description = "ID của tài liệu", example = "10")
    private Long documentId;

    @Schema(description = "Phiên bản mới vừa sinh ra", example = "2")
    private Integer versionNum;

    @Schema(description = "Mã băm SHA-256 bảo vệ chuỗi hash chain của phiên bản mới")
    private String versionHash;

    @Schema(description = "ID thực thể mã nguồn được cập nhật (nếu có)")
    private Long entityId;

    @Schema(description = "Chữ ký hàm/lớp đã cập nhật")
    private String signature;

    @Schema(description = "Tóm tắt thay đổi do AI sinh ra")
    private String summaryOfChanges;

    @Schema(description = "Đoạn tài liệu mới của thực thể")
    private String entityDocumentation;

    @Schema(description = "Toàn bộ nội dung tài liệu Markdown sau khi cập nhật tích hợp")
    private String fullUpdatedContent;

    @Schema(description = "Trạng thái thực thi", example = "SUCCESS")
    private String status;
}
