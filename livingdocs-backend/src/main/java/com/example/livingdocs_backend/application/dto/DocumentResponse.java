package com.example.livingdocs_backend.application.dto;

import com.example.livingdocs_backend.domain.model.DocumentStatus;
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
public class DocumentResponse {

    @Schema(description = "ID tài liệu", example = "1")
    private Long docId;

    @Schema(description = "ID bộ sưu tập", example = "1")
    private Long collectionId;

    @Schema(description = "ID kho lưu trữ GitHub", example = "1")
    private Long repoId;

    @Schema(description = "Tiêu đề tài liệu", example = "Hướng dẫn Kiến trúc Hệ thống LivingDocs")
    private String title;

    @Schema(description = "Đường dẫn file đích", example = "docs/architecture.md")
    private String targetPath;

    @Schema(description = "Trạng thái phê duyệt tài liệu", example = "DRAFT")
    private DocumentStatus status;

    @Schema(description = "Số phiên bản hiện tại", example = "1")
    private Integer currentVersion;

    @Schema(description = "Thông tin phiên bản mới nhất kèm chuỗi băm")
    private DocumentVersionResponse latestVersion;

    @Schema(description = "Thời điểm tạo")
    private Instant createdAt;

    @Schema(description = "Thời điểm cập nhật mới nhất")
    private Instant updatedAt;
}
