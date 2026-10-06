package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Domain model đại diện cho một tác vụ ngầm trong hệ thống LivingDocs.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Job {
    private Long jobId;
    private String type;
    private String payloadJson;
    private JobStatus status;
    private Integer attempts;
    private Integer maxAttempts;
    private String lastError;
    private Instant lockedAt;
    private Instant createdAt;
    private Instant updatedAt;

    public boolean canRetry() {
        return this.attempts < this.maxAttempts;
    }

    public void markRunning() {
        this.status = JobStatus.RUNNING;
        this.attempts = (this.attempts == null ? 0 : this.attempts) + 1;
        this.lockedAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public void markDone() {
        this.status = JobStatus.DONE;
        this.lockedAt = null;
        this.lastError = null;
        this.updatedAt = Instant.now();
    }

    public void recordFailure(String errorMessage) {
        this.lastError = errorMessage;
        this.lockedAt = null;
        this.updatedAt = Instant.now();

        if (this.attempts >= this.maxAttempts) {
            this.status = JobStatus.DEAD; // Chuyển sang Dead Letter Queue
        } else {
            this.status = JobStatus.PENDING; // Cho phép lần quét tiếp theo retry
        }
    }
}
