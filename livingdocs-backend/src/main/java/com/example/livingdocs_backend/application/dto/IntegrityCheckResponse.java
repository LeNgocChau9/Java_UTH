package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IntegrityCheckResponse {

    @Schema(description = "ID tài liệu kiểm tra", example = "1")
    private Long docId;

    @Schema(description = "Tổng số phiên bản đã kiểm tra", example = "3")
    private int totalVersions;

    @Schema(description = "Trạng thái toàn vẹn (true nếu chuỗi băm hợp lệ, false nếu bị sửa đổi/giả mạo)", example = "true")
    private boolean valid;

    @Schema(description = "Thông điệp kết quả", example = "Chuỗi băm toàn vẹn: Tất cả các phiên bản khớp mã băm SHA-256 và chuỗi liên kết.")
    private String message;

    @Schema(description = "Danh sách chi tiết lỗi nếu phát hiện giả mạo")
    private List<String> issues;
}
