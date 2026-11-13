package com.example.livingdocs_backend.application.dto.health;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thông tin thực thể mã nguồn còn thiếu tài liệu (Coverage Gap)")
public class CoverageGapItemDto {

    @Schema(description = "ID thực thể trong code_entities", example = "42")
    private Long entityId;

    @Schema(description = "ID kho lưu trữ", example = "1")
    private Long repositoryId;

    @Schema(description = "Đường dẫn file mã nguồn", example = "src/main/java/com/example/UserService.java")
    private String filePath;

    @Schema(description = "Tên gói mã nguồn (package/directory)", example = "com.example.service")
    private String packageName;

    @Schema(description = "Loại thực thể (CLASS, METHOD, FUNCTION)", example = "METHOD")
    private String entityType;

    @Schema(description = "Tên lớp", example = "UserService")
    private String className;

    @Schema(description = "Tên phương thức / hàm", example = "createUser")
    private String methodName;

    @Schema(description = "Chữ ký hàm / phương thức", example = "public User createUser(CreateUserRequest request)")
    private String signature;

    @Schema(description = "Kiểu trả về", example = "User")
    private String returnType;

    @Schema(description = "Dòng bắt đầu", example = "45")
    private Integer startLine;

    @Schema(description = "Dòng kết thúc", example = "60")
    private Integer endLine;

    @Schema(description = "Trạng thái tài liệu", example = "UNDOCUMENTED")
    private String docStatus;
}
