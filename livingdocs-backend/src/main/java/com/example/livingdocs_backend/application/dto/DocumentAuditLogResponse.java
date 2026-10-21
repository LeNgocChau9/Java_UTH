package com.example.livingdocs_backend.application.dto;

import com.example.livingdocs_backend.domain.model.AuditAction;
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
public class DocumentAuditLogResponse {

    @Schema(description = "ID bản ghi audit", example = "10")
    private Long logId;

    @Schema(description = "ID người thực hiện", example = "2")
    private Long actorId;

    @Schema(description = "Hành động thực hiện", example = "DOCUMENT_APPROVED")
    private AuditAction action;

    @Schema(description = "Loại tài nguyên", example = "DOCUMENT")
    private String resourceType;

    @Schema(description = "ID tài nguyên", example = "1")
    private String resourceId;

    @Schema(description = "Chi tiết hành động / nhận xét đánh giá", example = "Staff đã duyệt và chuyển Manager")
    private String detail;

    @Schema(description = "Địa chỉ IP", example = "127.0.0.1")
    private String ipAddress;

    @Schema(description = "Thời điểm ghi nhận")
    private Instant createdAt;
}
