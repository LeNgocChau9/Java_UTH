package com.example.livingdocs_backend.application.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO ủy quyền phê duyệt giữa các Manager.
 * Cho phép Quản lý A ủy quyền quyền duyệt tài liệu cho Quản lý B trong một khoảng thời gian (fromDate -> toDate).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManagerDelegationDto {

    @Schema(description = "Mã định danh bản ghi ủy quyền", example = "del-1")
    private String id;

    @Schema(description = "ID của Quản lý ủy quyền (Manager A)", example = "1")
    private Long delegatorId;

    @Schema(description = "Email của Quản lý ủy quyền", example = "managerA@livingdocs.internal")
    private String delegatorEmail;

    @Schema(description = "Họ tên của Quản lý ủy quyền", example = "Quản lý A")
    private String delegatorName;

    @Schema(description = "ID của Quản lý nhận ủy quyền (Manager B)", example = "2")
    private Long delegateeId;

    @Schema(description = "Email của Quản lý nhận ủy quyền", example = "managerB@livingdocs.internal")
    private String delegateeEmail;

    @Schema(description = "Họ tên của Quản lý nhận ủy quyền", example = "Quản lý B")
    private String delegateeName;

    @JsonProperty("fromDate")
    @JsonAlias({"from_date", "startDate"})
    @Schema(description = "Ngày bắt đầu ủy quyền (YYYY-MM-DD hoặc ISO-8601)", example = "2026-11-01")
    private String fromDate;

    @JsonProperty("toDate")
    @JsonAlias({"to_date", "endDate"})
    @Schema(description = "Ngày kết thúc ủy quyền (YYYY-MM-DD hoặc ISO-8601)", example = "2026-11-30")
    private String toDate;

    @Schema(description = "Lý do ủy quyền", example = "Nghỉ phép công tác nước ngoài")
    private String reason;

    @Schema(description = "Trạng thái kích hoạt của ủy quyền", example = "true")
    @Builder.Default
    private Boolean active = true;

    @Schema(description = "Thời điểm tạo bản ghi ủy quyền (ISO-8601)", example = "2026-11-13T10:30:00Z")
    private String createdAt;
}
