package com.example.livingdocs_backend.domain.repository;

import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;

import java.util.List;
import java.util.Optional;

/**
 * Output Port: Cổng giao tiếp lưu trữ và truy vấn tác vụ ngầm.
 */
public interface JobRepositoryPort {
    Job save(Job job);
    Optional<Job> findById(Long jobId);
    List<Job> findTopJobsByStatus(JobStatus status, int limit);
}
