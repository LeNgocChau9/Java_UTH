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
public class ReviewQueueItemResponse {

    @Schema(description = "ID tài liệu / Mục hàng đợi", example = "6")
    private Long id;

    @Schema(description = "ID tài liệu", example = "6")
    private Long docId;

    @Schema(description = "Tiêu đề tài liệu", example = "Hướng dẫn triển khai Clean Architecture")
    private String title;

    @Schema(description = "Đường dẫn file đích tương ứng trong mã nguồn", example = "docs/architecture.md")
    private String targetPath;

    @Schema(description = "Trạng thái hiện tại trong máy trạng thái", example = "UNDER_REVIEW_STAFF")
    private DocumentStatus status;

    @Schema(description = "Số phiên bản hiện tại", example = "1")
    private Integer currentVersion;

    @Schema(description = "Thời gian tạo tài liệu")
    private Instant createdAt;

    @Schema(description = "Thời gian cập nhật gần nhất")
    private Instant updatedAt;

    // --- Thông tin Kho lưu trữ (Repository) ---
    @Schema(description = "ID kho lưu trữ", example = "1")
    private Long repoId;

    @Schema(description = "Tên ngắn gọn của kho lưu trữ", example = "livingdocs-backend")
    private String repoName;

    @Schema(description = "Tên đầy đủ của kho lưu trữ (owner/repo)", example = "LeNgocChau9/livingdocs-backend")
    private String repoFullName;

    @Schema(description = "Nhánh mặc định của kho lưu trữ", example = "main")
    private String defaultBranch;

    @Schema(description = "Đối tượng thông tin kho lưu trữ chi tiết")
    private RepoInfo repo;

    // --- Thông tin Tác giả (Author) ---
    @Schema(description = "Tên tác giả người tạo tài liệu", example = "Pham Lead Developer")
    private String authorName;

    @Schema(description = "Email tác giả", example = "developer@livingdocs.internal")
    private String authorEmail;

    @Schema(description = "Vai trò tác giả (DEVELOPER, AI, STAFF, MANAGER)", example = "DEVELOPER")
    private String authorRole;

    @Schema(description = "Đối tượng thông tin tác giả chi tiết")
    private AuthorInfo author;

    // --- Nội dung & Phiên bản mới nhất ---
    @Schema(description = "Trích xuất nội dung phiên bản mới nhất cần duyệt")
    private String latestContent;

    @Schema(description = "Thông tin phiên bản mới nhất kèm mã băm SHA-256")
    private DocumentVersionResponse latestVersion;

    // --- Ghi chú / Nhận xét của đợt duyệt trước (dành cho Manager) ---
    @Schema(description = "Ghi chú của Staff ở cấp 1 (nếu có)")
    private String staffComment;

    @Schema(description = "Email hoặc danh tính của Staff đã duyệt cấp 1")
    private String staffReviewer;

    @Schema(description = "Thời điểm Staff hoàn tất duyệt cấp 1")
    private Instant staffReviewedAt;

    @Schema(description = "true khi tài liệu AI thiếu đề mục bắt buộc của template")
    private Boolean structureWarning;

    @Schema(description = "Đề mục bắt buộc còn thiếu, Staff cần xem trước khi duyệt")
    private java.util.List<String> missingHeadings;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RepoInfo {
        private Long repoId;
        private String repoName;
        private String repoFullName;
        private String defaultBranch;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AuthorInfo {
        private String name;
        private String email;
        private String role;
    }
}
