package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RollbackResponse {

    @Schema(description = "ID tài liệu", example = "1")
    private Long docId;

    @Schema(description = "Phiên bản mục tiêu được khôi phục về", example = "1")
    private Integer targetVersion;

    @Schema(description = "Phiên bản mới tạo ra sau khi khôi phục (nhằm bảo toàn chuỗi băm)", example = "4")
    private Integer newVersion;

    @Schema(description = "Thông báo kết quả", example = "Đã khôi phục thành công tài liệu về nội dung của phiên bản v1, tạo phiên bản mới v4 để bảo đảm toàn vẹn chuỗi băm lịch sử.")
    private String message;

    @Schema(description = "Thông tin chi tiết phiên bản mới tạo ra")
    private DocumentVersionResponse version;
}
