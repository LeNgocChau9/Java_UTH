package com.example.livingdocs_backend.application.dto.drift;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO kích hoạt phân tích sai lệch tài liệu thủ công theo Pull Request hoặc Tài liệu cụ thể.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualDriftAnalysisRequestDto {

    /**
     * Chế độ phân tích: "PULL_REQUEST" hoặc "DOCUMENT".
     */
    private String mode;

    /**
     * ID của kho lưu trữ (bắt buộc khi mode = PULL_REQUEST, tùy chọn khi mode = DOCUMENT).
     */
    private Long repositoryId;

    /**
     * Số hiệu Pull Request trên GitHub (bắt buộc khi mode = PULL_REQUEST).
     */
    private Integer prNumber;

    /**
     * ID của tài liệu cần phân tích đối chiếu (bắt buộc khi mode = DOCUMENT).
     */
    private Long documentId;
}

