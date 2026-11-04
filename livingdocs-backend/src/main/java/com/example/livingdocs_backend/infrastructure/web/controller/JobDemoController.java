package com.example.livingdocs_backend.infrastructure.web.controller;

import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.worker.handler.FailingTestJobHandler;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "Background Jobs", description = "API quản trị và theo dõi hàng đợi tác vụ xử lý nền bất đồng bộ (Background Job Worker & DLQ)")
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobDemoController {

    private final JobQueue jobQueue;
    private final JobRepositoryPort jobRepositoryPort;

    @Operation(
            summary = "Theo dõi tiến trình tác vụ nền theo thời gian thực",
            description = "Cho phép frontend polling / theo dõi trạng thái tiến trình sinh tài liệu hoặc quét mã nguồn (QUEUED, PROCESSING, COMPLETED, FAILED/DEAD) và payload/kết quả thực thi."
    )
    @GetMapping("/{jobId}")
    public ResponseEntity<Job> getJobDetails(
            @Parameter(description = "Mã định danh tác vụ nền (jobId)", example = "1")
            @PathVariable Long jobId
    ) {
        return jobRepositoryPort.findById(jobId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(summary = "Đẩy một job lỗi giả lập để kiểm thử cơ chế Retry 3 lần và Dead Letter Queue (DLQ)")
    @PostMapping("/demo/enqueue-failing")
    public ResponseEntity<Job> enqueueFailingJob(
            @RequestParam(defaultValue = "3") int maxAttempts,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        String payloadStr = payload != null ? payload.toString() : "{\"testReason\": \"verify_retry_and_dlq\"}";
        Job job = jobQueue.enqueue(FailingTestJobHandler.JOB_TYPE, payloadStr, maxAttempts);
        return ResponseEntity.ok(job);
    }
}
