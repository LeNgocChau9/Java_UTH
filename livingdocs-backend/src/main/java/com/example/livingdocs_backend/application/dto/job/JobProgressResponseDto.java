package com.example.livingdocs_backend.application.dto.job;

import com.example.livingdocs_backend.domain.model.JobStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "DTO phản hồi chi tiết tiến trình công việc ngầm (Background Job)")
public class JobProgressResponseDto {

    @Schema(description = "Mã định danh tác vụ nền (jobId)", example = "101")
    private Long jobId;

    @Schema(description = "Loại tác vụ (AI_DOC_GEN, REPO_SCAN, DRIFT_ANALYZE,...)", example = "AI_DOC_GEN")
    private String type;

    @Schema(description = "Trạng thái công việc (QUEUED, PROCESSING, COMPLETED, FAILED/DEAD)", example = "PROCESSING")
    private JobStatus status;

    @Schema(description = "Số lần đã thử thực thi", example = "2")
    private Integer attempts;

    @Schema(description = "Số lần thử tối đa trước khi vào Dead Letter Queue (DLQ)", example = "3")
    private Integer maxAttempts;

    @Schema(description = "Thông tin chi tiết lỗi gần nhất nếu có")
    private String lastError;

    @Schema(description = "Thời điểm cho phép thử lại tiếp theo (Exponential Backoff)")
    private Instant nextRetryAt;

    @Schema(description = "Thời điểm bắt đầu được worker khóa xử lý")
    private Instant lockedAt;

    @Schema(description = "Dữ liệu đầu vào của tác vụ (payload JSON)")
    private String payloadJson;

    @Schema(description = "Kết quả hoàn thành của tác vụ (result JSON)")
    private String resultJson;

    @Schema(description = "Thời điểm tạo tác vụ")
    private Instant createdAt;

    @Schema(description = "Thời điểm cập nhật mới nhất")
    private Instant updatedAt;

    @Schema(description = "Đánh giá công việc đã bị chuyển vào Dead Letter Queue (DLQ) hay chưa", example = "false")
    private boolean isDeadLetter;
}
