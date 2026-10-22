package com.example.livingdocs_backend.application.dto;

import com.example.livingdocs_backend.domain.model.DocumentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentDetailResponse {

    @Schema(description = "ID tài liệu", example = "1")
    private Long docId;

    @Schema(description = "ID bộ sưu tập", example = "1")
    private Long collectionId;

    @Schema(description = "ID kho lưu trữ", example = "1")
    private Long repoId;

    @Schema(description = "Tiêu đề tài liệu", example = "Hướng dẫn Kiến trúc Hệ thống LivingDocs")
    private String title;

    @Schema(description = "Đường dẫn file đích", example = "docs/architecture.md")
    private String targetPath;

    @Schema(description = "Trạng thái phê duyệt", example = "DRAFT")
    private DocumentStatus status;

    @Schema(description = "Phiên bản hiện tại", example = "2")
    private Integer currentVersion;

    @Schema(description = "Phiên bản mới nhất")
    private DocumentVersionResponse latestVersion;

    @Schema(description = "Danh sách tất cả các phiên bản lịch sử (từ mới đến cũ)")
    private List<DocumentVersionResponse> versionHistory;

    @Schema(description = "Thời điểm tạo")
    private Instant createdAt;

    @Schema(description = "Thời điểm cập nhật mới nhất")
    private Instant updatedAt;

    @Schema(description = "Template đã dùng khi sinh tài liệu")
    private Long templateId;

    @Schema(description = "true khi Markdown thiếu đề mục bắt buộc")
    private Boolean structureWarning;

    @Schema(description = "Các đề mục bắt buộc còn thiếu")
    private List<String> missingHeadings;
}
