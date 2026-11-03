package com.example.livingdocs_backend.application.dto.drift;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu chuyển gợi ý viết lại từ AI thành bản nháp chính thức (Auto-Draft)")
public class ApplySuggestionRequestDto {

    @NotNull(message = "alertId không được để trống")
    @Schema(description = "ID của cảnh báo sai lệch (Drift Alert)", example = "1")
    private Long alertId;

    @Schema(description = "Nội dung tài liệu tùy chỉnh nếu người dùng muốn ghi đè gợi ý của AI. Nếu để trống, hệ thống tự động lấy updated_doc từ AI Engine.", example = "# Nội dung tài liệu Markdown...")
    private String customContent;

    @Schema(description = "Ghi chú tóm tắt thay đổi", example = "Cập nhật tham số theo gợi ý AI")
    private String changeSummary;
}
