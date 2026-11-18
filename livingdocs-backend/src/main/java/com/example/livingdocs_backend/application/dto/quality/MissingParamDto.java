package com.example.livingdocs_backend.application.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Tham số kỹ thuật của phương thức có trong mã nguồn nhưng chưa được đặc tả trong Markdown.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Tham số kỹ thuật chưa được tài liệu hóa")
public class MissingParamDto {

    @Schema(description = "Tên phương thức chứa tham số", example = "rollbackToVersion")
    private String methodName;

    @Schema(description = "Tên lớp", example = "DocumentService")
    private String className;

    @Schema(description = "Tên tham số bị thiếu", example = "actorRole")
    private String paramName;

    @Schema(description = "Kiểu dữ liệu tham số", example = "String")
    private String paramType;

    @Schema(description = "Gợi ý mô tả cho tham số", example = "Bổ sung dòng giải thích tham số `actorRole`: Vai trò của người thực hiện thao tác.")
    private String suggestion;
}
