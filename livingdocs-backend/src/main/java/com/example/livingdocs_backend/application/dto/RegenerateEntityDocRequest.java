package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO cho API POST /api/documents/{id}/regenerate-entity
 * Tạo lại hoặc cập nhật riêng tài liệu của một hàm/lớp cụ thể khi hàm đó có sửa đổi nhỏ.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu tạo lại hoặc cập nhật tài liệu cho một thực thể mã nguồn (hàm/lớp)")
public class RegenerateEntityDocRequest {

    @Schema(description = "ID của thực thể trong bảng code_entities (ưu tiên nếu có)", example = "42")
    private Long entityId;

    @Schema(description = "Chữ ký hàm/lớp (signature) cần cập nhật nếu không có entityId", example = "public void processPayment(Long orderId, Double amount)")
    private String signature;

    @Schema(description = "Tùy chọn: Mã nguồn mới của hàm/lớp (nếu frontend/lập trình viên muốn gửi trực tiếp)", example = "public void processPayment(Long orderId, Double amount, String currency) { ... }")
    private String updatedSourceCode;

    @Schema(description = "Tùy chọn: Ghi chú hoặc hướng dẫn bổ sung cho AI khi viết lại tài liệu hàm này", example = "Bổ sung mô tả về tham số currency mới")
    private String instruction;
}
