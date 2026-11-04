package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO đại diện cho một liên kết bằng chứng xác thực Grounding giữa tài liệu và mã nguồn.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroundingEvidenceItem {

    @Schema(description = "ID liên kết", example = "1")
    private Long linkId;

    @Schema(description = "ID tài liệu", example = "10")
    private Long documentId;

    @Schema(description = "ID phần tử mã nguồn (nếu có)", example = "42")
    private Long entityId;

    @Schema(description = "Đường dẫn file nguồn", example = "src/main/java/com/example/MyService.java")
    private String filePath;

    @Schema(description = "Tên lớp/Class", example = "MyService")
    private String className;

    @Schema(description = "Tên phương thức/hàm", example = "processOrder")
    private String methodName;

    @Schema(description = "Chữ ký hàm (signature)", example = "public OrderResult processOrder(OrderRequest req)")
    private String signature;

    @Schema(description = "Dòng bắt đầu", example = "45")
    private Integer startLine;

    @Schema(description = "Dòng kết thúc", example = "88")
    private Integer endLine;

    @Schema(description = "Mã băm commit của mã nguồn", example = "a1b2c3d4e5f6")
    private String commitHash;

    @Schema(description = "Thời điểm liên kết được tạo")
    private Instant createdAt;
}

