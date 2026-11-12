package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Domain model đại diện cho một tác vụ ngầm trong hệ thống LivingDocs.
 * Hỗ trợ các tác vụ AI mất nhiều thời gian dưới nền (AI_DOC_GEN, REPO_SCAN, DRIFT_ANALYZE).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Job {
    public static final String TYPE_AI_DOC_GEN = "AI_DOC_GEN";
    public static final String TYPE_REPO_SCAN = "REPO_SCAN";
    public static final String TYPE_DRIFT_ANALYZE = "DRIFT_ANALYZE";

    private Long jobId;
    private String type;
    private String payloadJson;
    private String resultJson;
    private JobStatus status;
    private Integer attempts;
    private Integer maxAttempts;
    private String lastError;
    private Instant lockedAt;
    private Instant nextRetryAt;
    private Instant createdAt;
    private Instant updatedAt;

    public boolean canRetry() {
        return this.attempts < this.maxAttempts;
    }

    public void markRunning() {
        this.status = JobStatus.PROCESSING;
        this.attempts = (this.attempts == null ? 0 : this.attempts) + 1;
        this.lockedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void markDone() {
        this.status = JobStatus.COMPLETED;
        this.lockedAt = null;
        this.nextRetryAt = null;
        this.lastError = null;
        this.updatedAt = Instant.now();
    }

    public void markDone(String resultJson) {
        this.resultJson = resultJson;
        markDone();
    }

    public void recordFailure(String errorMessage) {
        recordFailure(errorMessage, 0);
    }

    public void recordFailure(String errorMessage, long backoffSeconds) {
        this.lastError = errorMessage;
        this.lockedAt = null;
        this.updatedAt = Instant.now();

        if (this.attempts >= this.maxAttempts) {
            this.status = JobStatus.FAILED; // Chuyển sang Dead Letter Queue (DLQ)
            this.nextRetryAt = null;
        } else {
            this.status = JobStatus.QUEUED; // Cho phép lần quét tiếp theo retry
            if (backoffSeconds > 0) {
                this.nextRetryAt = Instant.now().plusSeconds(backoffSeconds);
            } else {
                this.nextRetryAt = null;
            }
        }
    }
}
