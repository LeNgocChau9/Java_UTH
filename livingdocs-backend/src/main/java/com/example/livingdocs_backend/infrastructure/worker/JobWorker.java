package com.example.livingdocs_backend.infrastructure.worker;

import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import lombok.extern.slf4j.Slf4j;
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

    public JobWorker(JobRepositoryPort jobRepositoryPort, List<JobHandler> handlers) {
        this.jobRepositoryPort = jobRepositoryPort;
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
            job.recordFailure(errorMsg, 0);
            jobRepositoryPort.save(job);
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
            int attempts = job.getAttempts();
            int maxAttempts = job.getMaxAttempts();

            // Thời gian chờ tăng dần theo cấp số nhân: lần 1: 5s, lần 2: 15s, lần 3: 45s (hoặc maxAttempts)
            long backoffSeconds = calculateExponentialBackoff(attempts);

            log.warn("[JobWorker] Job #{} failed on attempt {}/{}. Reason: {}. Next retry in {}s", 
                    job.getJobId(), attempts, maxAttempts, ex.getMessage(), backoffSeconds);

            job.recordFailure(errorDetails, backoffSeconds);
            Job savedJob = jobRepositoryPort.save(job);

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
