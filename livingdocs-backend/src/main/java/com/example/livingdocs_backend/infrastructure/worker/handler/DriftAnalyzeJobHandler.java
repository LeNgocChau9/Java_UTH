package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.drift.PrDriftAnalysisResultDto;
import com.example.livingdocs_backend.application.dto.job.DriftAnalyzeJobPayload;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Handler thực thi tác vụ quét sai lệch tài liệu hàng loạt dưới nền (DRIFT_ANALYZE).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DriftAnalyzeJobHandler implements JobHandler {

    private final DocDriftDetectionServicePort docDriftDetectionService;
    private final ObjectMapper objectMapper;

    @Override
    public String getJobType() {
        return Job.TYPE_DRIFT_ANALYZE;
    }

    @Override
    public void handle(Job job) throws Exception {
        log.info("[JobHandler - DRIFT_ANALYZE] Bắt đầu quét sai lệch cho Job #{}", job.getJobId());

        if (job.getPayloadJson() == null || job.getPayloadJson().isBlank()) {
            log.warn("[JobHandler - DRIFT_ANALYZE] Payload rỗng cho Job #{}, bỏ qua.", job.getJobId());
            return;
        }

        DriftAnalyzeJobPayload payload = objectMapper.readValue(job.getPayloadJson(), DriftAnalyzeJobPayload.class);
        log.info("[JobHandler - DRIFT_ANALYZE] Phân tích sai lệch cho repoId={}, PR={}",
                payload.getRepositoryId(), payload.getPrNumber());

        PrDriftAnalysisResultDto result = null;
        if (payload.getPrNumber() != null && payload.getPrNumber() > 0) {
            result = docDriftDetectionService.detectDriftAndCommentOnPr(payload.getRepositoryId(), payload.getPrNumber());
        }

        if (result != null) {
            job.setResultJson(objectMapper.writeValueAsString(result));
        } else {
            job.setResultJson("{\"status\":\"COMPLETED_NO_DRIFT\"}");
        }

        log.info("[JobHandler - DRIFT_ANALYZE] Hoàn tất quét sai lệch ngầm cho Job #{}", job.getJobId());
    }
}
