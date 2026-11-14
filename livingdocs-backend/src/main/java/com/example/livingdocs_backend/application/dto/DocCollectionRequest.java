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
public class DocCollectionRequest {

    @NotBlank(message = "Tên bộ sưu tập không được để trống")
    @Schema(description = "Tên bộ sưu tập", example = "Tài liệu Kiến trúc & Hướng dẫn Kỹ thuật")
    private String name;

    @Schema(description = "Mô tả bộ sưu tập", example = "Tập hợp các tài liệu kiến trúc, API Reference và hướng dẫn.")
    private String description;

    @Schema(description = "Phân hệ nghiệp vụ / Module dự án", example = "Core Auth & Security")
    private String moduleTag;

    @Schema(description = "ID người dùng phụ trách chính (Owner - Developer / Tech Lead)", example = "2")
    private Long ownerId;

    @Schema(description = "Họ tên người phụ trách chính", example = "Nguyễn Văn A")
    private String ownerName;

    @Schema(description = "Email người phụ trách chính", example = "dev@livingdocs.internal")
    private String ownerEmail;

    @Schema(description = "Vai trò của người phụ trách chính (DEVELOPER, TECH_LEAD, STAFF, MANAGER)", example = "TECH_LEAD")
    private String ownerRole;

    @Schema(description = "Danh sách ID tài liệu gán vào bộ sưu tập (tùy chọn)")
    private java.util.List<Long> documentIds;
}
