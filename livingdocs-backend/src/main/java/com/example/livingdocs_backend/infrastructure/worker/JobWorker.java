package com.example.livingdocs_backend.infrastructure.worker;

import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.sse.JobStreamService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Worker quét và thực thi các tác vụ bất đồng bộ từ bảng jobs theo chu kỳ 3 giây.
 * Hỗ trợ các tác vụ AI mất nhiều thời gian dưới nền (AI_DOC_GEN, REPO_SCAN, DRIFT_ANALYZE,...).
 * Hỗ trợ cơ chế tự động thử lại (Retry) tối đa 3 lần và chuyển sang FAILED/DEAD (Dead Letter Queue - DLQ).
 */
@Slf4j
@Component
public class JobWorker {

    private final JobRepositoryPort jobRepositoryPort;
    private final Map<String, JobHandler> handlerMap = new HashMap<>();
    private final JobStreamService jobStreamService;

    public JobWorker(JobRepositoryPort jobRepositoryPort, List<JobHandler> handlers) {
        this(jobRepositoryPort, handlers, null);
    }

    @Autowired
    public JobWorker(
            JobRepositoryPort jobRepositoryPort,
            List<JobHandler> handlers,
            @Autowired(required = false) JobStreamService jobStreamService
    ) {
        this.jobRepositoryPort = jobRepositoryPort;
        this.jobStreamService = jobStreamService;
        if (handlers != null) {
            for (JobHandler handler : handlers) {
                this.handlerMap.put(handler.getJobType(), handler);
                log.info("[JobWorker] Registered handler for job type: '{}'", handler.getJobType());
            }
        }
    }

    @Scheduled(fixedDelay = 3000)
    public void processPendingJobs() {
        // Quét các job đang ở trạng thái chờ (QUEUED hoặc PENDING) mà đã đến hạn thử lại (nextRetryAt <= now)
        java.time.Instant now = java.time.Instant.now();
        List<Job> pendingJobs = jobRepositoryPort.findReadyJobs(JobStatus.QUEUED, now, 5);
        if (pendingJobs.isEmpty()) {
            return;
        }

        for (Job job : pendingJobs) {
            processSingleJob(job);
        }
    }

    private void processSingleJob(Job job) {
        log.info("[JobWorker] Picking up job #{} [Type: {}, Attempt: {}/{}]", 
                job.getJobId(), job.getType(), (job.getAttempts() + 1), job.getMaxAttempts());

        // 1. Chuyển sang trạng thái PROCESSING (RUNNING)
        job.markRunning();
        jobRepositoryPort.save(job);

        JobHandler handler = handlerMap.get(job.getType());
        if (handler == null) {
            String errorMsg = String.format("No JobHandler registered for job type: '%s'", job.getType());
            log.error("[JobWorker] {}", errorMsg);
            int attempts = job.getAttempts() != null ? job.getAttempts() : 1;
            int maxAttempts = job.getMaxAttempts() != null ? job.getMaxAttempts() : 3;
            job.setStatus(JobStatus.FAILED);
            job.setLastError(errorMsg);
            job.setLockedAt(null);
            job.setNextRetryAt(null);
            job.setUpdatedAt(java.time.Instant.now());
            jobRepositoryPort.save(job);
            if (jobStreamService != null) {
                jobStreamService.publishProgress(job.getJobId(), "FAILED", 0, errorMsg,
                        Map.of(
                                "attempts", attempts,
                                "maxAttempts", maxAttempts,
                                "willRetry", false,
                                "isTerminal", true,
                                "lastError", errorMsg
                        ));
            }
            return;
        }

        try {
            // 2. Thực thi nghiệp vụ của Job dưới nền
            handler.handle(job);

            // 3. Đánh dấu COMPLETED nếu thành công
            job.markDone();
            jobRepositoryPort.save(job);
            log.info("[JobWorker] Successfully completed job #{} [Type: {}]", job.getJobId(), job.getType());

        } catch (Exception ex) {
            // 4. Bắt lỗi và kích hoạt cơ chế Retry với Exponential Backoff / Dead Letter Queue (DLQ)
            String errorDetails = extractStackTrace(ex);
            int attempts = job.getAttempts() != null ? job.getAttempts() : 1;
            int maxAttempts = job.getMaxAttempts() != null ? job.getMaxAttempts() : 3;

            // Thời gian chờ tăng dần theo cấp số nhân: lần 1: 5s, lần 2: 15s, lần 3: 45s (hoặc maxAttempts)
            long backoffSeconds = calculateExponentialBackoff(attempts);
            boolean willRetry = attempts < maxAttempts;

            log.warn("[JobWorker] Job #{} failed on attempt {}/{}. Reason: {}. willRetry={}",
                    job.getJobId(), attempts, maxAttempts, ex.getMessage(), willRetry);

            job.recordFailure(errorDetails, backoffSeconds);
            Job savedJob = jobRepositoryPort.save(job);

            if (jobStreamService != null) {
                String rawMsg = ex.getMessage() != null ? ex.getMessage() : "Tác vụ nền thất bại";
                if (willRetry && savedJob.getStatus() == JobStatus.QUEUED) {
                    String retryMsg = String.format(
                            "Lần thử %d/%d gặp lỗi (%s). Đang lên lịch thử lại sau %ds...",
                            attempts, maxAttempts, rawMsg, backoffSeconds
                    );
                    jobStreamService.publishProgress(
                            job.getJobId(),
                            "RETRY_SCHEDULED",
                            0,
                            retryMsg,
                            Map.of(
                                    "attempts", attempts,
                                    "maxAttempts", maxAttempts,
                                    "willRetry", true,
                                    "isTerminal", false,
                                    "backoffSeconds", backoffSeconds,
                                    "nextRetryAt", savedJob.getNextRetryAt() != null ? savedJob.getNextRetryAt().toString() : "",
                                    "lastError", errorDetails
                            )
                    );
                } else {
                    jobStreamService.publishProgress(
                            job.getJobId(),
                            "FAILED",
                            0,
                            rawMsg,
                            Map.of(
                                    "attempts", attempts,
                                    "maxAttempts", maxAttempts,
                                    "willRetry", false,
                                    "isTerminal", true,
                                    "backoffSeconds", 0L,
                                    "lastError", errorDetails
                            )
                    );
                }
            }

            if (savedJob.getStatus() == JobStatus.FAILED || savedJob.getStatus() == JobStatus.DEAD) {
                log.error("[JobWorker - DEAD LETTER QUEUE] Job #{} reached max attempts ({}) and is now moved to DLQ (FAILED/DEAD)! Last error: {}",
                        job.getJobId(), maxAttempts, ex.getMessage());
            } else {
                log.info("[JobWorker] Job #{} scheduled for retry at {} (Exponential backoff: {}s).",
                        job.getJobId(), savedJob.getNextRetryAt(), backoffSeconds);
            }
        }
    }

    /**
     * Tính toán thời gian chờ tăng dần theo cấp số nhân (Exponential Backoff):
     * Lần 1: 5s
     * Lần 2: 15s
     * Lần 3: 45s
     */
    public static long calculateExponentialBackoff(int attempt) {
        if (attempt <= 1) {
            return 5;
        } else if (attempt == 2) {
            return 15;
        } else {
            return 45;
        }
    }

    private String extractStackTrace(Throwable throwable) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        throwable.printStackTrace(pw);
        String full = sw.toString();
        // Giới hạn 2000 ký tự lưu trữ trong DB
        return full.length() > 2000 ? full.substring(0, 2000) : full;
    }
}
