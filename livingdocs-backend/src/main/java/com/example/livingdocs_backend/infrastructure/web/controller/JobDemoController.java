package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.dto.job.JobProgressResponseDto;
import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.sse.JobStreamService;
import com.example.livingdocs_backend.infrastructure.worker.handler.FailingTestJobHandler;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Tag(name = "Background Jobs", description = "API quản trị và theo dõi hàng đợi tác vụ xử lý nền bất đồng bộ (Background Job Worker & DLQ)")
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobDemoController {

    private final JobQueue jobQueue;
    private final JobRepositoryPort jobRepositoryPort;
    private final JobStreamService jobStreamService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.security.TenantAccessService tenantAccessService;

    @Operation(
            summary = "Tra cứu danh sách các tác vụ nền theo trạng thái",
            description = "Cho phép tra cứu các tác vụ nền gần đây hoặc theo trạng thái (QUEUED, PROCESSING, COMPLETED, FAILED, DEAD)."
    )
    @GetMapping
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    public ResponseEntity<List<JobProgressResponseDto>> listJobs(
            @RequestParam(required = false) JobStatus status,
            @RequestParam(defaultValue = "50") int limit
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        List<Job> jobs;
        if (tenantAccessService != null) {
            var scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return ResponseEntity.ok(java.util.Collections.emptyList());
            }
            if (scope.hasTenantFilter()) {
                jobs = (status != null)
                        ? jobRepositoryPort.findTopJobsByWorkspaceAndStatus(scope.workspaceId(), status, safeLimit)
                        : jobRepositoryPort.findRecentJobsByWorkspace(scope.workspaceId(), safeLimit);
                return ResponseEntity.ok(jobs.stream().map(this::toProgressDto).toList());
            }
        }
        jobs = (status != null)
                ? jobRepositoryPort.findTopJobsByStatus(status, safeLimit)
                : jobRepositoryPort.findRecentJobs(safeLimit);
        return ResponseEntity.ok(jobs.stream().map(this::toProgressDto).toList());
    }

    @Operation(
            summary = "Mở kết nối SSE theo dõi tiến trình tác vụ nền theo thời gian thực",
            description = "Phát trực tiếp các trạng thái thực tế của job: FETCHING_REPO -> EXTRACTING_AST -> RAG_CONTEXT -> LLM_GENERATING -> COMPLETED / FAILED."
    )
    @GetMapping(value = "/{jobId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    public ResponseEntity<SseEmitter> streamJobProgress(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        if (tenantAccessService != null) {
            tenantAccessService.requireJobAccess(jobId);
        }
        Optional<Job> jobOpt = jobRepositoryPort.findById(jobId);
        if (jobOpt.isEmpty() && jobStreamService.getLatestEvent(jobId) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        SseEmitter emitter = jobStreamService.registerEmitter(jobId, jobOpt.orElse(null));
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .body(emitter);
    }

    @Operation(
            summary = "Theo dõi tiến trình tác vụ nền theo thời gian thực",
            description = "Cho phép frontend polling / theo dõi trạng thái tiến trình sinh tài liệu hoặc quét mã nguồn (QUEUED, PROCESSING, COMPLETED, FAILED/DEAD), thông tin exponential backoff và payload/kết quả thực thi."
    )
    @GetMapping("/{jobId}")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    public ResponseEntity<JobProgressResponseDto> getJobDetails(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        if (tenantAccessService != null) {
            tenantAccessService.requireJobAccess(jobId);
        }
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
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    public ResponseEntity<List<JobProgressResponseDto>> getDeadLetterJobs(
            @Parameter(description = "Số lượng job tối đa cần lấy", example = "50")
            @RequestParam(defaultValue = "50") int limit
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 100));
        List<Job> dlqJobs;
        if (tenantAccessService != null) {
            var scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return ResponseEntity.ok(java.util.Collections.emptyList());
            }
            if (scope.hasTenantFilter()) {
                dlqJobs = jobRepositoryPort.findDeadLetterJobsByWorkspace(scope.workspaceId(), safeLimit);
                return ResponseEntity.ok(dlqJobs.stream().map(this::toProgressDto).toList());
            }
        }
        dlqJobs = jobRepositoryPort.findDeadLetterJobs(safeLimit);
        List<JobProgressResponseDto> dtos = dlqJobs.stream()
                .map(this::toProgressDto)
                .toList();
        return ResponseEntity.ok(dtos);
    }

    @Operation(
            summary = "Thử lại thủ công một tác vụ trong Dead Letter Queue",
            description = "Cho phép Quản trị viên kích hoạt lại một job đã vào DLQ (chỉ cho phép với trạng thái FAILED hoặc DEAD; chuyển về QUEUED, đặt lại attempts = 0, xóa nextRetryAt và lastError)."
    )
    @PostMapping("/dlq/{jobId}/retry")
    @PreAuthorize("hasAnyRole('ADMIN','TECH_LEAD','DEVELOPER')")
    public ResponseEntity<?> retryDeadLetterJob(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        if (tenantAccessService != null) {
            tenantAccessService.requireJobAccess(jobId);
        }
        Optional<Job> jobOpt = jobRepositoryPort.findById(jobId);
        if (jobOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Job job = jobOpt.get();
        if (job.getStatus() != JobStatus.FAILED && job.getStatus() != JobStatus.DEAD) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "message", "Chỉ có thể thử lại tác vụ ở trạng thái FAILED hoặc DEAD (trạng thái hiện tại: " + job.getStatus() + ").",
                    "jobId", jobId,
                    "status", job.getStatus() != null ? job.getStatus().name() : "UNKNOWN"
            ));
        }

        job.setStatus(JobStatus.QUEUED);
        job.setAttempts(0);
        job.setNextRetryAt(null);
        job.setLastError(null);
        job.setLockedAt(null);
        job.setUpdatedAt(Instant.now());
        jobStreamService.clearJobState(jobId);
        Job saved = jobRepositoryPort.save(job);
        return ResponseEntity.ok(toProgressDto(saved));
    }

    @Operation(
            summary = "Thử lại thủ công một tác vụ theo jobId",
            description = "Alias của /api/jobs/dlq/{jobId}/retry để kích hoạt lại job thất bại."
    )
    @PostMapping("/{jobId}/retry")
    @PreAuthorize("hasAnyRole('ADMIN','TECH_LEAD','DEVELOPER')")
    public ResponseEntity<?> retryJob(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        return retryDeadLetterJob(jobId);
    }

    @Operation(summary = "Kiểm tra thông tin job trong DLQ trước khi retry")
    @GetMapping("/dlq/{jobId}/retry")
    @PreAuthorize("hasAnyRole('DEVELOPER','STAFF','MANAGER','TECH_LEAD','ADMIN')")
    public ResponseEntity<JobProgressResponseDto> getJobDlqRetryInfo(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        if (tenantAccessService != null) {
            tenantAccessService.requireJobAccess(jobId);
        }
        return jobRepositoryPort.findById(jobId)
                .map(this::toProgressDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Đẩy một job lỗi giả lập để kiểm thử cơ chế Retry 3 lần và Dead Letter Queue (DLQ)")
    @PostMapping("/demo/enqueue-failing")
    @PreAuthorize("hasAnyRole('ADMIN','TECH_LEAD','DEVELOPER')")
    public ResponseEntity<JobProgressResponseDto> enqueueFailingJob(
            @RequestParam(defaultValue = "3") int maxAttempts,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        if (tenantAccessService != null) {
            tenantAccessService.resolveWriteWorkspaceId(null);
        }
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
