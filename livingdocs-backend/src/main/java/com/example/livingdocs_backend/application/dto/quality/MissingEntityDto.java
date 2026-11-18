package com.example.livingdocs_backend.application.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Thực thể mã nguồn thật (Code Entity) tồn tại trong repository nhưng chưa được mô tả trong tài liệu.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thực thể code chưa được tài liệu hóa")
public class MissingEntityDto {

    @Schema(description = "ID của entity trong bảng code_entities", example = "102")
    private Long entityId;

    @Schema(description = "Tên lớp chứa thực thể", example = "UserService")
    private String className;

    @Schema(description = "Tên phương thức hoặc thuộc tính", example = "rollbackToVersion")
    private String methodName;

    @Schema(description = "Loại thực thể: METHOD, CLASS, CONTROLLER, SERVICE, ENDPOINT", example = "METHOD")
    private String entityType;

    @Schema(description = "Đường dẫn file nguồn", example = "src/main/java/com/example/service/UserService.java")
    private String filePath;

    @Schema(description = "Chữ ký đầy đủ", example = "public void rollbackToVersion(Long id)")
    private String signature;

    @Schema(description = "Gợi ý nội dung Markdown bổ sung", example = "### `rollbackToVersion(Long id)`\n- Khôi phục tài liệu về phiên bản cũ.")
    private String suggestedMarkdown;
}
