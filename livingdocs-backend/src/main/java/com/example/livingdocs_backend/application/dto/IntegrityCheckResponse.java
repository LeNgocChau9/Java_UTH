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

    @Schema(description = "Chi tiết kiểm định từng mắt xích phiên bản trong chuỗi băm")
    private List<VersionIntegrityDetail> chainDetails;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VersionIntegrityDetail {
        @Schema(description = "Số thứ tự phiên bản", example = "1")
        private Integer versionNum;

        @Schema(description = "Mã băm lưu trữ trong CSDL", example = "a1b2c3...")
        private String storedHash;

        @Schema(description = "Mã băm tính toán lại từ nội dung thực tế", example = "a1b2c3...")
        private String computedHash;

        @Schema(description = "Mã băm của phiên bản trước được lưu", example = "00000000...")
        private String prevHash;

        @Schema(description = "Mã băm mong đợi của phiên bản trước", example = "00000000...")
        private String expectedPrevHash;

        @Schema(description = "Nội dung phiên bản có khớp với hash hay không", example = "true")
        private boolean contentValid;

        @Schema(description = "Liên kết chuỗi băm với phiên bản trước có khớp hay không", example = "true")
        private boolean chainValid;

        @Schema(description = "Trạng thái chi tiết (VALID, CONTENT_TAMPERED, CHAIN_BROKEN, INVALID)", example = "VALID")
        private String status;
    }
}
