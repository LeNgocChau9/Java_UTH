package com.example.livingdocs_backend.application.dto.quality;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Đặc tả một ký hiệu ảo giác (Phantom Symbol) do AI sinh ra nhưng không tồn tại trong mã nguồn thật.
 * (Anti-Hallucination Gate - Task Tuần 7)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Ký hiệu ma / Ảo giác AI phát hiện trong tài liệu")
public class PhantomSymbolDto {

    @Schema(description = "Tên ký hiệu ảo giác (tên hàm, class, API endpoint giả)", example = "calculateSecretDiscount")
    private String symbol;

    @Schema(description = "Loại ký hiệu: METHOD, CLASS, API_PATH, FIELD, PARAM", example = "METHOD")
    private String symbolType;

    @Schema(description = "Số dòng phát hiện trong văn bản Markdown", example = "45")
    private Integer lineNumber;

    @Schema(description = "Đoạn văn bản ngữ cảnh chứa ký hiệu này", example = "Sử dụng hàm `calculateSecretDiscount(user)` để tính chiết khấu")
    private String contextSnippet;

    @Schema(description = "Mức độ nghiêm trọng: CRITICAL, HIGH, MEDIUM", example = "CRITICAL")
    private String severity;

    @Schema(description = "Lý do cảnh báo", example = "Ký hiệu 'calculateSecretDiscount' không tồn tại trong bất kỳ lớp hoặc hàm nào của mã nguồn thật.")
    private String reason;

    @Schema(description = "Gợi ý sửa đổi dựa trên thực thể thật tương đồng", example = "Có thể bạn muốn nhắc đến phương thức thật 'calculateDiscount'?")
    private String suggestion;
}
