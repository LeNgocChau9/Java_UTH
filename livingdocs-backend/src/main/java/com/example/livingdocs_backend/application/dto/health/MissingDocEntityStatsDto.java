package com.example.livingdocs_backend.application.dto.health;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thống kê chi tiết các hàm và lớp chưa có tài liệu")
public class MissingDocEntityStatsDto {

    @Schema(description = "Tổng số phần tử (classes, methods, functions) còn thiếu tài liệu", example = "15")
    private long totalMissing;

    @Schema(description = "Số lượng class còn thiếu tài liệu", example = "3")
    private long missingClasses;

    @Schema(description = "Số lượng method / function còn thiếu tài liệu", example = "12")
    private long missingMethodsAndFunctions;

    @Schema(description = "Phân rã chi tiết theo từng loại phần tử", example = "{\"CLASS\": 3, \"METHOD\": 10, \"FUNCTION\": 2}")
    private Map<String, Long> missingByType;
}
