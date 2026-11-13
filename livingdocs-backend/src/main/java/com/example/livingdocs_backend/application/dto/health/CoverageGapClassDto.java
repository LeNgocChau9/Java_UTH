package com.example.livingdocs_backend.application.dto.health;

import io.swagger.v3.oas.annotations.media.Schema;
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
@Schema(description = "Nhóm các thực thể thiếu tài liệu theo Lớp (Class)")
public class CoverageGapClassDto {

    @Schema(description = "Tên lớp", example = "UserService")
    private String className;

    @Schema(description = "Đường dẫn file chứa lớp", example = "src/main/java/com/example/UserService.java")
    private String filePath;

    @Schema(description = "Loại thực thể của lớp (CLASS, INTERFACE, ENUM)", example = "CLASS")
    private String entityType;

    @Schema(description = "ID thực thể của lớp nếu chính lớp đó chưa có tài liệu", example = "40")
    private Long classEntityId;

    @Schema(description = "Bản thân lớp đã có tài liệu chưa", example = "false")
    private boolean classDocumented;

    @Builder.Default
    @Schema(description = "Danh sách các hàm / phương thức còn thiếu tài liệu trong lớp này")
    private List<CoverageGapItemDto> methods = new ArrayList<>();

    @Schema(description = "Tổng số thực thể thiếu trong lớp này", example = "3")
    private int totalMissing;
}
