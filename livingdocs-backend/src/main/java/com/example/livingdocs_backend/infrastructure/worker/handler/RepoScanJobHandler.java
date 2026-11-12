package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.ai.DocCoverageResponseDto;
import com.example.livingdocs_backend.application.dto.job.RepoScanJobPayload;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Handler quét toàn bộ cấu trúc mã nguồn của kho lưu trữ dưới nền (REPO_SCAN).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RepoScanJobHandler implements JobHandler {

    private final CodeIndexServicePort codeIndexService;
    private final ObjectMapper objectMapper;

    @Override
    public String getJobType() {
        return Job.TYPE_REPO_SCAN;
    }

    @Override
    public void handle(Job job) throws Exception {
        log.info("[JobHandler - REPO_SCAN] Bắt đầu quét kho mã nguồn cho Job #{}", job.getJobId());

        if (job.getPayloadJson() == null || job.getPayloadJson().isBlank()) {
            log.warn("[JobHandler - REPO_SCAN] Payload rỗng cho Job #{}, bỏ qua.", job.getJobId());
            return;
        }

        RepoScanJobPayload payload = objectMapper.readValue(job.getPayloadJson(), RepoScanJobPayload.class);
        log.info("[JobHandler - REPO_SCAN] Quét và tính toán độ bao phủ cho repositoryId={}", payload.getRepositoryId());

        DocCoverageResponseDto coverage = codeIndexService.calculateRepositoryCoverage(payload.getRepositoryId());
        job.setResultJson(objectMapper.writeValueAsString(coverage));

        log.info("[JobHandler - REPO_SCAN] Hoàn tất quét kho mã nguồn cho Job #{}", job.getJobId());
    }
}
