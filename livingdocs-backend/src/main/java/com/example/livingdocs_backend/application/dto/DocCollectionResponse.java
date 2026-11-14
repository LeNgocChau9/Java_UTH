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
public class DocCollectionResponse {

    @Schema(description = "ID bộ sưu tập", example = "1")
    private Long id;

    @Schema(description = "Tên bộ sưu tập", example = "Tài liệu Kiến trúc & Hướng dẫn Kỹ thuật")
    private String name;

    @Schema(description = "Mô tả bộ sưu tập", example = "Tập hợp các tài liệu kiến trúc, API Reference và hướng dẫn.")
    private String description;

    @Schema(description = "Phân hệ nghiệp vụ / Module dự án", example = "Core Auth & Security")
    private String moduleTag;

    @Schema(description = "ID người phụ trách chính (Owner)", example = "2")
    private Long ownerId;

    @Schema(description = "Họ tên người phụ trách chính", example = "Nguyễn Văn A")
    private String ownerName;

    @Schema(description = "Email người phụ trách chính", example = "dev@livingdocs.internal")
    private String ownerEmail;

    @Schema(description = "Vai trò của người phụ trách chính", example = "TECH_LEAD")
    private String ownerRole;

    @Schema(description = "Số lượng tài liệu trong bộ sưu tập", example = "3")
    private Long documentCount;

    @Schema(description = "Danh sách ID các tài liệu thuộc bộ sưu tập")
    private java.util.List<Long> documentIds;

    @Schema(description = "Thời điểm tạo")
    private Instant createdAt;

    @Schema(description = "Thời điểm cập nhật")
    private Instant updatedAt;
}
