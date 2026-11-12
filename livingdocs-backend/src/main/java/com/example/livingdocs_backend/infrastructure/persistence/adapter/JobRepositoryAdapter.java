package com.example.livingdocs_backend.infrastructure.persistence.adapter;

import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.JobEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JobRepositoryAdapter implements JobRepositoryPort {

    private final SpringDataJobRepository springDataJobRepository;

    @Override
    public Job save(Job job) {
        JobEntity entity = toEntity(job);
        JobEntity saved = springDataJobRepository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<Job> findById(Long jobId) {
        return springDataJobRepository.findById(jobId).map(this::toDomain);
    }

    @Override
    public List<Job> findTopJobsByStatus(JobStatus status, int limit) {
        List<JobEntity> entities;
        if (status == JobStatus.QUEUED || status == JobStatus.PENDING) {
            entities = springDataJobRepository.findJobsByStatusesWithLimit(
                    List.of(JobStatus.QUEUED, JobStatus.PENDING), PageRequest.of(0, limit));
        } else {
            entities = springDataJobRepository.findJobsByStatusWithLimit(status, PageRequest.of(0, limit));
        }
        return entities.stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Job> findReadyJobs(JobStatus status, java.time.Instant now, int limit) {
        List<JobEntity> entities;
        if (status == JobStatus.QUEUED || status == JobStatus.PENDING) {
            entities = springDataJobRepository.findReadyJobsWithLimit(
                    List.of(JobStatus.QUEUED, JobStatus.PENDING), now, PageRequest.of(0, limit));
        } else {
            entities = springDataJobRepository.findReadyJobsWithLimit(
                    List.of(status), now, PageRequest.of(0, limit));
        }
        return entities.stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Job> findDeadLetterJobs(int limit) {
        List<JobEntity> entities = springDataJobRepository.findDeadLetterJobsWithLimit(
                List.of(JobStatus.FAILED, JobStatus.DEAD), PageRequest.of(0, limit));
        return entities.stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    private JobEntity toEntity(Job job) {
        return JobEntity.builder()
                .jobId(job.getJobId())
                .type(job.getType())
                .payloadJson(job.getPayloadJson())
                .resultJson(job.getResultJson())
                .status(job.getStatus())
                .attempts(job.getAttempts() != null ? job.getAttempts() : 0)
                .maxAttempts(job.getMaxAttempts() != null ? job.getMaxAttempts() : 3)
                .lastError(job.getLastError())
                .lockedAt(job.getLockedAt())
                .nextRetryAt(job.getNextRetryAt())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }

    private Job toDomain(JobEntity entity) {
        return Job.builder()
                .jobId(entity.getJobId())
                .type(entity.getType())
                .payloadJson(entity.getPayloadJson())
                .resultJson(entity.getResultJson())
                .status(entity.getStatus())
                .attempts(entity.getAttempts())
                .maxAttempts(entity.getMaxAttempts())
                .lastError(entity.getLastError())
                .lockedAt(entity.getLockedAt())
                .nextRetryAt(entity.getNextRetryAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
