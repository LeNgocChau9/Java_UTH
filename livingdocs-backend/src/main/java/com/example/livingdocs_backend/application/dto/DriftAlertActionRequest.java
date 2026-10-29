package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DriftAlertActionRequest {

    @NotBlank(message = "action không được để trống")
    @Schema(description = "IGNORE hoặc DISMISS, RESOLVE, ACCEPT, CHANGE_SEVERITY", example = "RESOLVE")
    private String action;

    @Schema(description = "Bắt buộc khi action là CHANGE_SEVERITY. LOW, MEDIUM, HIGH hoặc CRITICAL.", example = "HIGH")
    private String severity;

    @Size(max = 500, message = "comment tối đa 500 ký tự")
    @Schema(description = "Ghi chú đưa vào audit log", example = "Đã cập nhật tài liệu theo commit mới")
    private String comment;
}
