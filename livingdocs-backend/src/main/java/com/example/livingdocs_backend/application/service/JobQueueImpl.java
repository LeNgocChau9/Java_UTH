package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobQueueImpl implements JobQueue {

    private final JobRepositoryPort jobRepositoryPort;

    @Override
    public Job enqueue(String type, String payloadJson) {
        return enqueue(type, payloadJson, 3);
    }

    @Override
    public Job enqueue(String type, String payloadJson, int maxAttempts) {
        Job job = Job.builder()
                .type(type)
                .payloadJson(payloadJson != null ? payloadJson : "{}")
                .status(JobStatus.PENDING)
                .attempts(0)
                .maxAttempts(maxAttempts > 0 ? maxAttempts : 3)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        Job savedJob = jobRepositoryPort.save(job);
        log.info("[JobQueue] Enqueued new job #{} with type='{}', maxAttempts={}", 
                savedJob.getJobId(), savedJob.getType(), savedJob.getMaxAttempts());
        return savedJob;
    }
}
