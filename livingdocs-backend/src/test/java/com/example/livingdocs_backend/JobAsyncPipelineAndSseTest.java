package com.example.livingdocs_backend;

import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.security.JwtTokenProvider;
import com.example.livingdocs_backend.infrastructure.sse.JobStreamService;
import com.example.livingdocs_backend.infrastructure.worker.JobWorker;
import com.example.livingdocs_backend.infrastructure.worker.handler.FailingTestJobHandler;
import com.example.livingdocs_backend.infrastructure.worker.handler.RepoScanJobHandler;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:5433/livingdocs",
        "spring.datasource.username=LivingDocs",
        "spring.datasource.password=chau123456",
        "spring.datasource.driver-class-name=org.postgresql.Driver"
})
class JobAsyncPipelineAndSseTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private JobRepositoryPort jobRepositoryPort;

    @Autowired
    private JobStreamService jobStreamService;

    @Autowired
    private RepoScanJobHandler repoScanJobHandler;

    @Autowired
    private JobWorker jobWorker;

    private String devBearerToken;

    @BeforeEach
    void setUp() {
        devBearerToken = "Bearer " + jwtTokenProvider.generateToken(
                1L,
                "dev-test@livingdocs.io",
                List.of("DEVELOPER", "ADMIN")
        );
    }

    @Test
    void heavyEndpointsEnqueueAsyncJobsAndListAllRecentJobs() throws Exception {
        // 1. Async AI_DOC_GEN
        String aiPayload = """
                {
                  "repository_id": 1,
                  "scope": "FILE",
                  "target_path": "src/main/java/TestService.java",
                  "file_path": "src/main/java/TestService.java",
                  "template_type": "API_REFERENCE",
                  "save_document": false
                }
                """;
        MvcResult aiRes = mockMvc.perform(post("/api/documents/generate-ai?async=true")
                        .header("Authorization", devBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(aiPayload))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").isNumber())
                .andExpect(jsonPath("$.type").value(Job.TYPE_AI_DOC_GEN))
                .andExpect(jsonPath("$.status").value("QUEUED"))
                .andReturn();

        JsonNode aiJson = objectMapper.readTree(aiRes.getResponse().getContentAsString());
        long aiJobId = aiJson.get("jobId").asLong();

        // 2. Async REPO_SCAN
        MvcResult scanRes = mockMvc.perform(post("/api/v1/code-entities/repository/1/scan?async=true")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").isNumber())
                .andExpect(jsonPath("$.type").value(Job.TYPE_REPO_SCAN))
                .andExpect(jsonPath("$.status").value("QUEUED"))
                .andReturn();

        long scanJobId = objectMapper.readTree(scanRes.getResponse().getContentAsString()).get("jobId").asLong();

        // 3. Async DRIFT_ANALYZE
        String driftPayload = """
                {
                  "mode": "PULL_REQUEST",
                  "repositoryId": 1,
                  "prNumber": 99
                }
                """;
        MvcResult driftRes = mockMvc.perform(post("/api/drift-alerts/manual-analyze?async=true")
                        .header("Authorization", devBearerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(driftPayload))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.jobId").isNumber())
                .andExpect(jsonPath("$.type").value(Job.TYPE_DRIFT_ANALYZE))
                .andExpect(jsonPath("$.status").value("QUEUED"))
                .andReturn();

        long driftJobId = objectMapper.readTree(driftRes.getResponse().getContentAsString()).get("jobId").asLong();

        // 4. GET /api/jobs (without status filter) must return recent QUEUED jobs too, not only DLQ
        MvcResult listRes = mockMvc.perform(get("/api/jobs?limit=50")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isOk())
                .andReturn();

        String listBody = listRes.getResponse().getContentAsString();
        assertTrue(listBody.contains("\"jobId\":" + aiJobId));
        assertTrue(listBody.contains("\"jobId\":" + scanJobId));
        assertTrue(listBody.contains("\"jobId\":" + driftJobId));
    }

    @Test
    void repoScanHandlerPublishesSseLifecycleAndStreamEndpointEmitsCompleted() throws Exception {
        MvcResult scanRes = mockMvc.perform(post("/api/v1/code-entities/repository/1/scan?async=true")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isAccepted())
                .andReturn();

        long jobId = objectMapper.readTree(scanRes.getResponse().getContentAsString()).get("jobId").asLong();
        Job job = jobRepositoryPort.findById(jobId).orElseThrow();

        // Simulate worker executing handler
        job.markRunning();
        repoScanJobHandler.handle(job);
        job.markDone();
        jobRepositoryPort.save(job);

        JobStreamService.JobProgressEvent latest = jobStreamService.getLatestEvent(jobId);
        assertNotNull(latest);
        assertEquals("COMPLETED", latest.state());
        assertEquals(100, latest.progress());

        // Stream endpoint replays terminal state cleanly
        MvcResult sseRes = mockMvc.perform(get("/api/jobs/" + jobId + "/stream")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                .andReturn();

        String sseBody = sseRes.getResponse().getContentAsString();
        assertTrue(sseBody.contains("\"state\":\"COMPLETED\""), "SSE output should contain COMPLETED state: " + sseBody);
    }

    @Test
    void failingJobMovesToDlqEmitsFailedSseAndCanBeRetried() throws Exception {
        MvcResult failEnqueue = mockMvc.perform(post("/api/jobs/demo/enqueue-failing?maxAttempts=1")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value(FailingTestJobHandler.JOB_TYPE))
                .andReturn();

        long jobId = objectMapper.readTree(failEnqueue.getResponse().getContentAsString()).get("jobId").asLong();

        // Trigger worker processing synchronously in current transaction
        jobWorker.processPendingJobs();

        Job failedJob = jobRepositoryPort.findById(jobId).orElseThrow();
        assertEquals(JobStatus.FAILED, failedJob.getStatus());
        assertNotNull(failedJob.getLastError());
        assertTrue(failedJob.getLastError().contains("Simulated connection timeout"));

        JobStreamService.JobProgressEvent latest = jobStreamService.getLatestEvent(jobId);
        assertNotNull(latest);
        assertEquals("FAILED", latest.state());

        // Verify appears in /api/jobs/dlq
        mockMvc.perform(get("/api/jobs/dlq?limit=50")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("\"jobId\":" + jobId)));

        // Retry via alias /api/jobs/{jobId}/retry
        mockMvc.perform(post("/api/jobs/" + jobId + "/retry")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jobId").value(jobId))
                .andExpect(jsonPath("$.status").value("QUEUED"))
                .andExpect(jsonPath("$.attempts").value(0))
                .andExpect(jsonPath("$.nextRetryAt").doesNotExist())
                .andExpect(jsonPath("$.lastError").doesNotExist());

        assertNull(jobStreamService.getLatestEvent(jobId));
    }

    @Test
    void streamEndpointReturns404ForUnknownJobAndRetryRejectsNonFailedJobsWithConflict() throws Exception {
        // 1. Unknown jobId stream must return 404 Not Found
        mockMvc.perform(get("/api/jobs/9999999/stream")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isNotFound());

        // 2. Retry on QUEUED job must return 409 Conflict
        MvcResult scanRes = mockMvc.perform(post("/api/v1/code-entities/repository/1/scan?async=true")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isAccepted())
                .andReturn();
        long jobId = objectMapper.readTree(scanRes.getResponse().getContentAsString()).get("jobId").asLong();

        mockMvc.perform(post("/api/jobs/" + jobId + "/retry")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isConflict());

        // 3. Retry on COMPLETED job must return 409 Conflict and preserve COMPLETED status
        Job job = jobRepositoryPort.findById(jobId).orElseThrow();
        job.markRunning();
        job.markDone("{\"coverage\":100}");
        jobRepositoryPort.save(job);

        mockMvc.perform(post("/api/jobs/dlq/" + jobId + "/retry")
                        .header("Authorization", devBearerToken))
                .andExpect(status().isConflict());

        Job unchanged = jobRepositoryPort.findById(jobId).orElseThrow();
        assertEquals(JobStatus.COMPLETED, unchanged.getStatus());
    }

    @Test
    void jobStreamServiceLruCacheBoundedTo1000AndConcurrentPublishNeverRegressesCompleted() throws Exception {
        JobStreamService isolatedStream = new JobStreamService();

        // Verify LRU bounded eviction at 1000 entries (does not wipe all entries)
        for (long i = 1; i <= 1050; i++) {
            isolatedStream.publishProgress(i, "COMPLETED", 100, "Done #" + i, null);
        }
        assertNull(isolatedStream.getLatestEvent(1L));
        assertNull(isolatedStream.getLatestEvent(50L));
        assertNotNull(isolatedStream.getLatestEvent(51L));
        assertNotNull(isolatedStream.getLatestEvent(1050L));

        // Verify concurrent register/publish never throws and never regresses COMPLETED
        ExecutorService pool = Executors.newFixedThreadPool(8);
        try {
            for (int iter = 0; iter < 50; iter++) {
                long targetJobId = 50000L + iter;
                CountDownLatch startLatch = new CountDownLatch(1);
                List<Future<?>> futures = new ArrayList<>();

                futures.add(pool.submit(() -> {
                    startLatch.await();
                    isolatedStream.registerEmitter(targetJobId, Job.builder().jobId(targetJobId).status(JobStatus.QUEUED).build());
                    return null;
                }));
                futures.add(pool.submit(() -> {
                    startLatch.await();
                    isolatedStream.publishProgress(targetJobId, "FETCHING_REPO", 20, "Fetching", null);
                    return null;
                }));
                futures.add(pool.submit(() -> {
                    startLatch.await();
                    isolatedStream.publishProgress(targetJobId, "COMPLETED", 100, "Done", null);
                    return null;
                }));

                startLatch.countDown();
                for (Future<?> f : futures) {
                    f.get(5, TimeUnit.SECONDS);
                }
                JobStreamService.JobProgressEvent latest = isolatedStream.getLatestEvent(targetJobId);
                assertNotNull(latest);
                assertEquals("COMPLETED", latest.state());
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
