package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDocumentRequest {

    @Schema(description = "Tiêu đề tài liệu mới (nếu muốn thay đổi)", example = "Hướng dẫn Kiến trúc Hệ thống LivingDocs v2")
    private String title;

    @Schema(description = "Đường dẫn file đích mới", example = "docs/architecture-v2.md")
    private String targetPath;

    @Schema(description = "ID bộ sưu tập mới", example = "1")
    private Long collectionId;

    @NotBlank(message = "Nội dung cập nhật không được để trống")
    @Schema(description = "Nội dung văn bản mới, hệ thống sẽ tự động tạo phiên bản mới kèm chuỗi băm nối tiếp", example = "# Kiến trúc LivingDocs (Cập nhật)\nBổ sung phân hệ AI Engine...")
    private String content;

    @Schema(description = "Vai trò người thực hiện: AI, DEV, STAFF, MANAGER", example = "DEV")
    private String actorRole;

    @Schema(description = "Loại kích hoạt sửa đổi", example = "MANUAL_UPDATE")
    private String triggerType;
}
