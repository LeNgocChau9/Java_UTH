package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.port.JobQueue;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.domain.model.JobStatus;
import com.example.livingdocs_backend.domain.repository.JobRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobQueueImpl implements JobQueue {

    private final JobRepositoryPort jobRepositoryPort;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    @Autowired(required = false)
    private SpringDataRepositoryRepository repositoryRepository;

    @Autowired(required = false)
    private ObjectMapper objectMapper;

    @Override
    public Job enqueue(String type, String payloadJson) {
        return enqueue(type, payloadJson, 3);
    }

    @Override
    public Job enqueue(String type, String payloadJson, int maxAttempts) {
        String safePayload = payloadJson != null ? payloadJson : "{}";
        Long workspaceId = resolveWorkspaceIdForJob(safePayload);

        Job job = Job.builder()
                .workspaceId(workspaceId)
                .type(type)
                .payloadJson(safePayload)
                .status(JobStatus.QUEUED)
                .attempts(0)
                .maxAttempts(maxAttempts > 0 ? maxAttempts : 3)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        Job savedJob = jobRepositoryPort.save(job);
        log.info("[JobQueue] Enqueued new job #{} (workspaceId={}) with type='{}', status='{}', maxAttempts={}",
                savedJob.getJobId(), savedJob.getWorkspaceId(), savedJob.getType(), savedJob.getStatus(), savedJob.getMaxAttempts());
        return savedJob;
    }

    private Long resolveWorkspaceIdForJob(String payloadJson) {
        // 1. Ưu tiên đọc repositoryId từ payload nếu có (chính xác cho cả webhook lẫn user request)
        Long repoWorkspaceId = resolveWorkspaceFromPayloadRepo(payloadJson);

        if (tenantAccessService != null) {
            var scope = tenantAccessService.currentScope();
            if (!scope.systemBypass()) {
                if (scope.hasTenantFilter()) {
                    return scope.workspaceId();
                }
                if (scope.admin()) {
                    return repoWorkspaceId != null
                            ? repoWorkspaceId
                            : tenantAccessService.resolveWriteWorkspaceId(null);
                }
                // Unassigned non-ADMIN sẽ bị chặn với 403 NO_ENTERPRISE_ASSIGNED
                return tenantAccessService.resolveWriteWorkspaceId(repoWorkspaceId);
            }
        }
        return repoWorkspaceId != null ? repoWorkspaceId : TenantAccessService.DEFAULT_WORKSPACE_ID;
    }

    private Long resolveWorkspaceFromPayloadRepo(String payloadJson) {
        if (repositoryRepository == null || payloadJson == null || payloadJson.isBlank()) {
            return null;
        }
        try {
            ObjectMapper mapper = objectMapper != null ? objectMapper : new ObjectMapper();
            JsonNode root = mapper.readTree(payloadJson);
            Long repoId = extractLongField(root, "repositoryId");
            if (repoId == null) {
                repoId = extractLongField(root, "repository_id");
            }
            if (repoId == null) {
                repoId = extractLongField(root, "repoId");
            }
            if (repoId != null) {
                return repositoryRepository.findById(repoId)
                        .map(RepositoryEntity::getWorkspaceId)
                        .orElse(null);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private Long extractLongField(JsonNode root, String fieldName) {
        if (root != null && root.hasNonNull(fieldName)) {
            long val = root.path(fieldName).asLong(0L);
            return val > 0 ? val : null;
        }
        return null;
    }
}
