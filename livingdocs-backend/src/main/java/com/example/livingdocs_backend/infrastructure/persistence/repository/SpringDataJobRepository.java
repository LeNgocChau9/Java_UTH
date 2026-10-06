package com.example.livingdocs_backend.infrastructure.persistence.repository;

import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.infrastructure.persistence.entity.JobEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpringDataJobRepository extends JpaRepository<JobEntity, Long> {

    @Query("SELECT j FROM JobEntity j WHERE j.status = :status ORDER BY j.createdAt ASC")
    List<JobEntity> findJobsByStatusWithLimit(@Param("status") JobStatus status, Pageable pageable);
}
