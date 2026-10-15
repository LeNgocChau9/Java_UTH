package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Entity giả để điền vào mẫu tài liệu khi xem trước")
public class TemplatePreviewRequest {

    @NotBlank(message = "Tên class không được để trống")
    @Schema(example = "OrderService")
    private String className;

    @Schema(example = "com.example.shop.order")
    private String packageName;

    @Schema(example = "Tạo và hủy đơn hàng từ giỏ hàng của người dùng.")
    private String description;

    @Valid
    @Builder.Default
    @Schema(description = "Danh sách method mẫu")
    private List<MockMethod> methods = new ArrayList<>();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MockMethod {

        @NotBlank(message = "Tên method không được để trống")
        @Schema(example = "createOrder")
        private String name;

        @Schema(example = "Order")
        private String returnType;

        @Schema(example = "Tạo đơn mới từ danh sách mặt hàng.")
        private String description;

        @Valid
        @Builder.Default
        private List<MockParameter> parameters = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MockParameter {

        @NotBlank(message = "Tên tham số không được để trống")
        @Schema(example = "userId")
        private String name;

        @Schema(example = "Long")
        private String type;
    }
}
