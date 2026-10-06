package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.worker.JobWorker;
import com.example.livingdocs_backend.infrastructure.worker.handler.FailingTestJobHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class JobWorkerTest {

    private JobRepositoryPort jobRepositoryPort;
    private FailingTestJobHandler failingTestJobHandler;
    private JobWorker jobWorker;

    @BeforeEach
    void setUp() {
        jobRepositoryPort = mock(JobRepositoryPort.class);
        failingTestJobHandler = new FailingTestJobHandler();
        List<JobHandler> handlers = Collections.singletonList(failingTestJobHandler);
        jobWorker = new JobWorker(jobRepositoryPort, handlers);
    }

    @Test
    @DisplayName("Job gặp lỗi sẽ retry và chuyển sang trạng thái DEAD sau 3 lần thất bại")
    void shouldRetry3TimesAndMoveToDeadLetterQueueWhenJobFails() {
        // Khởi tạo một Job giả lập
        Job job = Job.builder()
                .jobId(100L)
                .type(FailingTestJobHandler.JOB_TYPE)
                .payloadJson("{\"test\": true}")
                .status(JobStatus.PENDING)
                .attempts(0)
                .maxAttempts(3)
                .createdAt(Instant.now())
                .build();

        when(jobRepositoryPort.findTopJobsByStatus(eq(JobStatus.PENDING), anyInt()))
                .thenReturn(Collections.singletonList(job));
        when(jobRepositoryPort.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // --- Lần 1: Worker quét và xử lý ---
        jobWorker.processPendingJobs();
        assertEquals(1, job.getAttempts(), "Lần 1: Số lần thử phải là 1");
        assertEquals(JobStatus.PENDING, job.getStatus(), "Lần 1: Trạng thái vẫn là PENDING để retry tiếp");
        assertNotNull(job.getLastError(), "Lần 1: Phải có thông tin lỗi ghi vào last_error");
        assertTrue(job.getLastError().contains("Simulated connection timeout"), "Nội dung lỗi khớp với exception giả lập");

        // --- Lần 2: Worker quét tiếp ---
        jobWorker.processPendingJobs();
        assertEquals(2, job.getAttempts(), "Lần 2: Số lần thử phải là 2");
        assertEquals(JobStatus.PENDING, job.getStatus(), "Lần 2: Trạng thái vẫn là PENDING");
        assertNotNull(job.getLastError());

        // --- Lần 3: Quét lần cuối cùng (đạt max_attempts = 3) ---
        jobWorker.processPendingJobs();
        assertEquals(3, job.getAttempts(), "Lần 3: Số lần thử đạt max = 3");
        assertEquals(JobStatus.DEAD, job.getStatus(), "Lần 3: Job phải tự động chuyển sang DEAD (Dead Letter Queue)");
        assertNotNull(job.getLastError(), "Lần 3: Phải lưu vết chi tiết lỗi vào last_error");
        assertTrue(job.getLastError().contains("attempt #3"), "Lỗi ghi rõ thất bại ở attempt #3");
    }
}
