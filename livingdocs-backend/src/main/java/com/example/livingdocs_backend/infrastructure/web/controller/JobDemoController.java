package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.job.JobProgressResponseDto;
import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.worker.handler.FailingTestJobHandler;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Background Jobs", description = "API quản trị và theo dõi hàng đợi tác vụ xử lý nền bất đồng bộ (Background Job Worker & DLQ)")
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobDemoController {

    private final JobQueue jobQueue;
    private final JobRepositoryPort jobRepositoryPort;

    @Operation(
            summary = "Tra cứu danh sách các tác vụ nền theo trạng thái",
            description = "Cho phép tra cứu các tác vụ nền gần đây hoặc theo trạng thái (QUEUED, PROCESSING, COMPLETED, FAILED, DEAD)."
    )
    @GetMapping
    public ResponseEntity<List<JobProgressResponseDto>> listJobs(
            @RequestParam(required = false) JobStatus status,
            @RequestParam(defaultValue = "50") int limit
    ) {
        List<Job> jobs = (status != null)
                ? jobRepositoryPort.findTopJobsByStatus(status, Math.min(limit, 100))
                : jobRepositoryPort.findDeadLetterJobs(Math.min(limit, 100));
        return ResponseEntity.ok(jobs.stream().map(this::toProgressDto).toList());
    }

    @Operation(
            summary = "Theo dõi tiến trình tác vụ nền theo thời gian thực",
            description = "Cho phép frontend polling / theo dõi trạng thái tiến trình sinh tài liệu hoặc quét mã nguồn (QUEUED, PROCESSING, COMPLETED, FAILED/DEAD), thông tin exponential backoff và payload/kết quả thực thi."
    )
    @GetMapping("/{jobId}")
    public ResponseEntity<JobProgressResponseDto> getJobDetails(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        return jobRepositoryPort.findById(jobId)
                .map(this::toProgressDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(
            summary = "Tra cứu danh sách các tác vụ trong Hàng đợi lỗi (Dead Letter Queue - DLQ)",
            description = "Liệt kê các tác vụ đã thử lại tối đa số lần cho phép (3 lần) và thất bại, kèm nguyên nhân chi tiết để quản trị viên theo dõi và xử lý."
    )
    @GetMapping("/dlq")
    public ResponseEntity<List<JobProgressResponseDto>> getDeadLetterJobs(
            @Parameter(description = "Số lượng job tối đa cần lấy", example = "50")
            @RequestParam(defaultValue = "50") int limit
    ) {
        List<Job> dlqJobs = jobRepositoryPort.findDeadLetterJobs(Math.min(limit, 100));
        List<JobProgressResponseDto> dtos = dlqJobs.stream()
                .map(this::toProgressDto)
                .toList();
        return ResponseEntity.ok(dtos);
    }

    @Operation(
            summary = "Thử lại thủ công một tác vụ trong Dead Letter Queue",
            description = "Cho phép Quản trị viên kích hoạt lại một job đã vào DLQ (chuyển trạng thái về QUEUED, đặt lại attempts = 0 và xóa nextRetryAt)."
    )
    @PostMapping("/dlq/{jobId}/retry")
    public ResponseEntity<JobProgressResponseDto> retryDeadLetterJob(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        return jobRepositoryPort.findById(jobId)
                .map(job -> {
                    job.setStatus(JobStatus.QUEUED);
                    job.setAttempts(0);
                    job.setNextRetryAt(null);
                    job.setLockedAt(null);
                    Job saved = jobRepositoryPort.save(job);
                    return ResponseEntity.ok(toProgressDto(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Kiểm tra thông tin job trong DLQ trước khi retry")
    @GetMapping("/dlq/{jobId}/retry")
    public ResponseEntity<JobProgressResponseDto> getJobDlqRetryInfo(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        return jobRepositoryPort.findById(jobId)
                .map(this::toProgressDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Đẩy một job lỗi giả lập để kiểm thử cơ chế Retry 3 lần và Dead Letter Queue (DLQ)")
    @PostMapping("/demo/enqueue-failing")
    public ResponseEntity<JobProgressResponseDto> enqueueFailingJob(
            @RequestParam(defaultValue = "3") int maxAttempts,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        String payloadStr = payload != null ? payload.toString() : "{\"testReason\": \"verify_retry_and_dlq\"}";
        Job job = jobQueue.enqueue(FailingTestJobHandler.JOB_TYPE, payloadStr, maxAttempts);
        return ResponseEntity.ok(toProgressDto(job));
    }

    private JobProgressResponseDto toProgressDto(Job job) {
        boolean isDead = (job.getStatus() == JobStatus.FAILED || job.getStatus() == JobStatus.DEAD);
        return JobProgressResponseDto.builder()
                .jobId(job.getJobId())
                .type(job.getType())
                .status(job.getStatus())
                .attempts(job.getAttempts())
                .maxAttempts(job.getMaxAttempts())
                .lastError(job.getLastError())
                .nextRetryAt(job.getNextRetryAt())
                .lockedAt(job.getLockedAt())
                .payloadJson(job.getPayloadJson())
                .resultJson(job.getResultJson())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .isDeadLetter(isDead)
                .build();
    }
}
