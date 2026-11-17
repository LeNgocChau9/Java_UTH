package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.sse.JobStreamService;
import com.example.livingdocs_backend.infrastructure.worker.JobWorker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class JobWorkerRetryAndDlqTest {

    private JobRepositoryPort jobRepositoryPort;
    private JobHandler mockHandler;
    private JobStreamService jobStreamService;
    private JobWorker jobWorker;

    @BeforeEach
    void setUp() {
        jobRepositoryPort = mock(JobRepositoryPort.class);
        mockHandler = mock(JobHandler.class);
        when(mockHandler.getJobType()).thenReturn("MOCK_JOB");

        jobStreamService = new JobStreamService();
        jobWorker = new JobWorker(jobRepositoryPort, List.of(mockHandler), jobStreamService);
    }

    @Test
    void jobFailsOnFirstAttemptAndSchedulesExponentialBackoff() throws Exception {
        Job job = Job.builder()
                .jobId(1L)
                .type("MOCK_JOB")
                .status(JobStatus.QUEUED)
                .attempts(0)
                .maxAttempts(3)
                .build();

        when(jobRepositoryPort.findReadyJobs(eq(JobStatus.QUEUED), any(Instant.class), anyInt()))
                .thenReturn(List.of(job));
        doThrow(new RuntimeException("Simulated AI connection timeout")).when(mockHandler).handle(any(Job.class));
        when(jobRepositoryPort.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        jobWorker.processPendingJobs();

        // Kiểm tra số lần save và trạng thái job
        ArgumentCaptor<Job> captor = ArgumentCaptor.forClass(Job.class);
        verify(jobRepositoryPort, atLeast(2)).save(captor.capture());
        Job finalJob = captor.getValue();

        assertEquals(1, finalJob.getAttempts());
        assertEquals(JobStatus.QUEUED, finalJob.getStatus()); // Chưa đạt maxAttempts, vẫn QUEUED để retry
        assertNotNull(finalJob.getNextRetryAt());
        assertTrue(finalJob.getNextRetryAt().isAfter(Instant.now().minusSeconds(1)));
        assertNotNull(finalJob.getLastError());
        assertTrue(finalJob.getLastError().contains("Simulated AI connection timeout"));
    }

    @Test
    void jobReachesMaxAttemptsAndTransitionsToDeadLetterQueue() throws Exception {
        Job job = Job.builder()
                .jobId(2L)
                .type("MOCK_JOB")
                .status(JobStatus.QUEUED)
                .attempts(2) // Lần chạy này sẽ là attempt thứ 3 (đạt max 3)
                .maxAttempts(3)
                .build();

        when(jobRepositoryPort.findReadyJobs(eq(JobStatus.QUEUED), any(Instant.class), anyInt()))
                .thenReturn(List.of(job));
        doThrow(new RuntimeException("AI API Quota Exceeded")).when(mockHandler).handle(any(Job.class));
        when(jobRepositoryPort.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        jobWorker.processPendingJobs();

        ArgumentCaptor<Job> captor = ArgumentCaptor.forClass(Job.class);
        verify(jobRepositoryPort, atLeast(2)).save(captor.capture());
        Job finalJob = captor.getValue();

        assertEquals(3, finalJob.getAttempts());
        assertEquals(JobStatus.FAILED, finalJob.getStatus()); // Đạt maxAttempts -> Chuyển vào DLQ
        assertNull(finalJob.getNextRetryAt()); // Không retry nữa
        assertNotNull(finalJob.getLastError());
        assertTrue(finalJob.getLastError().contains("AI API Quota Exceeded"));
    }

    @Test
    void calculatesExponentialBackoffDelays() {
        assertEquals(5, JobWorker.calculateExponentialBackoff(1));
        assertEquals(15, JobWorker.calculateExponentialBackoff(2));
        assertEquals(45, JobWorker.calculateExponentialBackoff(3));
    }

    @Test
    void retryableFailureEmitsNonTerminalRetryScheduledSseAndNotFailed() throws Exception {
        Job job = Job.builder()
                .jobId(101L)
                .type("MOCK_JOB")
                .status(JobStatus.QUEUED)
                .attempts(0)
                .maxAttempts(3)
                .build();

        when(jobRepositoryPort.findReadyJobs(eq(JobStatus.QUEUED), any(Instant.class), anyInt()))
                .thenReturn(List.of(job));
        doThrow(new RuntimeException("Transient network timeout")).when(mockHandler).handle(any(Job.class));
        when(jobRepositoryPort.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        jobWorker.processPendingJobs();

        JobStreamService.JobProgressEvent latest = jobStreamService.getLatestEvent(101L);
        assertNotNull(latest);
        assertEquals("RETRY_SCHEDULED", latest.state());
        assertNotEquals("FAILED", latest.state());
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) latest.payload();
        assertEquals(true, payload.get("willRetry"));
        assertEquals(false, payload.get("isTerminal"));
        assertEquals(1, payload.get("attempts"));
        assertEquals(3, payload.get("maxAttempts"));
    }

    @Test
    void finalFailureAtMaxAttemptsEmitsTerminalFailedSseEvent() throws Exception {
        Job job = Job.builder()
                .jobId(102L)
                .type("MOCK_JOB")
                .status(JobStatus.QUEUED)
                .attempts(2)
                .maxAttempts(3)
                .build();

        when(jobRepositoryPort.findReadyJobs(eq(JobStatus.QUEUED), any(Instant.class), anyInt()))
                .thenReturn(List.of(job));
        doThrow(new RuntimeException("Permanent AI outage")).when(mockHandler).handle(any(Job.class));
        when(jobRepositoryPort.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        jobWorker.processPendingJobs();

        JobStreamService.JobProgressEvent latest = jobStreamService.getLatestEvent(102L);
        assertNotNull(latest);
        assertEquals("FAILED", latest.state());
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) latest.payload();
        assertEquals(false, payload.get("willRetry"));
        assertEquals(true, payload.get("isTerminal"));
    }

    @Test
    void missingHandlerEmitsTerminalFailedSseEventAndMovesToDlq() {
        Job job = Job.builder()
                .jobId(103L)
                .type("UNKNOWN_TYPE")
                .status(JobStatus.QUEUED)
                .attempts(0)
                .maxAttempts(3)
                .build();

        when(jobRepositoryPort.findReadyJobs(eq(JobStatus.QUEUED), any(Instant.class), anyInt()))
                .thenReturn(List.of(job));
        when(jobRepositoryPort.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        jobWorker.processPendingJobs();

        ArgumentCaptor<Job> captor = ArgumentCaptor.forClass(Job.class);
        verify(jobRepositoryPort, atLeast(2)).save(captor.capture());
        Job saved = captor.getValue();
        assertEquals(JobStatus.FAILED, saved.getStatus());

        JobStreamService.JobProgressEvent latest = jobStreamService.getLatestEvent(103L);
        assertNotNull(latest);
        assertEquals("FAILED", latest.state());
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) latest.payload();
        assertEquals(true, payload.get("isTerminal"));
    }
}
