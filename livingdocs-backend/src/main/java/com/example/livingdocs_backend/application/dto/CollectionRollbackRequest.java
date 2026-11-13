package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu khôi phục hàng loạt toàn bộ các tài liệu thuộc cùng một bộ sưu tập về phiên bản an toàn trước đó")
public class CollectionRollbackRequest {

    @Schema(description = "Số bước hoàn tác lùi về phiên bản trước đó (mặc định 1 bước lùi về phiên bản liền kề trước đó)", example = "1")
    private Integer stepsBack;

    @Schema(description = "Số phiên bản mục tiêu áp dụng chung cho các tài liệu trong bộ sưu tập (tùy chọn)", example = "1")
    private Integer targetVersion;

    @Schema(description = "Mốc thời gian an toàn: tự động chọn phiên bản mới nhất được tạo trước mốc thời gian này (phục hồi trước đợt cập nhật lỗi)", example = "2026-11-12T10:00:00Z")
    private Instant beforeTimestamp;

    @Schema(description = "Ánh xạ tùy chỉnh docId -> targetVersion cho từng tài liệu cụ thể trong bộ sưu tập (tùy chọn)")
    private Map<Long, Integer> documentTargetVersions;

    @Schema(description = "Lý do khôi phục hàng loạt bộ sưu tập", example = "Hoàn tác sau đợt cập nhật AI tự động bị lỗi định dạng")
    private String reason;

    @Schema(description = "Vai trò người thực hiện rollback: DEV, STAFF, MANAGER, ADMIN", example = "MANAGER")
    private String actorRole;
}
