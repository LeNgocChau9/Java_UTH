package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Kết quả khôi phục hàng loạt toàn bộ các tài liệu thuộc bộ sưu tập")
public class CollectionRollbackResponse {

    @Schema(description = "ID bộ sưu tập", example = "1")
    private Long collectionId;

    @Schema(description = "Tên bộ sưu tập", example = "Tài liệu API Core")
    private String collectionName;

    @Schema(description = "Tổng số tài liệu trong bộ sưu tập", example = "5")
    private int totalDocuments;

    @Schema(description = "Số lượng tài liệu đã được khôi phục thành công", example = "4")
    private int rolledBackCount;

    @Schema(description = "Số lượng tài liệu được bỏ qua (ví dụ chỉ mới có 1 phiên bản gốc)", example = "1")
    private int skippedCount;

    @Schema(description = "Thời điểm thực hiện hoàn tác hàng loạt")
    private Instant rolledBackAt;

    @Schema(description = "Thông báo kết quả tổng hợp")
    private String message;

    @Schema(description = "Danh sách chi tiết kết quả khôi phục từng tài liệu")
    private List<RollbackResponse> rolledBackDocuments;

    @Schema(description = "Danh sách ghi chú các tài liệu được bỏ qua")
    private List<String> skippedDocuments;
}
