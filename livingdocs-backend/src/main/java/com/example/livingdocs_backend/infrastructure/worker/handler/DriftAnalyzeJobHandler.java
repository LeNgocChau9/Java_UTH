package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.drift.ManualDriftAnalysisRequestDto;
import com.example.livingdocs_backend.application.dto.drift.ManualDriftAnalysisResponseDto;
import com.example.livingdocs_backend.application.dto.drift.PrDriftAnalysisResultDto;
import com.example.livingdocs_backend.application.dto.job.DriftAnalyzeJobPayload;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.infrastructure.sse.JobStreamService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Map;

/**
 * Handler thực thi tác vụ quét sai lệch tài liệu hàng loạt dưới nền (DRIFT_ANALYZE).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DriftAnalyzeJobHandler implements JobHandler {

    private final DocDriftDetectionServicePort docDriftDetectionService;
    private final ObjectMapper objectMapper;
    private final JobStreamService jobStreamService;

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
        log.info("[JobHandler - DRIFT_ANALYZE] Phân tích sai lệch cho mode={}, repoId={}, PR={}, docId={}",
                payload.getMode(), payload.getRepositoryId(), payload.getPrNumber(), payload.getDocumentId());

        jobStreamService.publishProgress(
                job.getJobId(),
                "FETCHING_REPO",
                20,
                "Đang tải Git Diff và dữ liệu mã nguồn đối chiếu...",
                Map.of("repositoryId", payload.getRepositoryId() != null ? payload.getRepositoryId() : 0L)
        );

        jobStreamService.publishProgress(
                job.getJobId(),
                "EXTRACTING_AST",
                45,
                "Đang phân tích thay đổi AST giữa code và tài liệu...",
                null
        );

        jobStreamService.publishProgress(
                job.getJobId(),
                "RAG_CONTEXT",
                70,
                "Đang truy vấn liên kết doc_code_links bị ảnh hưởng...",
                null
        );

        jobStreamService.publishProgress(
                job.getJobId(),
                "LLM_GENERATING",
                85,
                "Đang đánh giá mức độ sai lệch ngữ nghĩa (Drift Analysis)...",
                null
        );

        Object resultObj;
        if (StringUtils.hasText(payload.getMode()) || payload.getDocumentId() != null) {
            String resolvedMode = StringUtils.hasText(payload.getMode())
                    ? payload.getMode()
                    : (payload.getDocumentId() != null ? "DOCUMENT" : "PULL_REQUEST");
            ManualDriftAnalysisRequestDto req = ManualDriftAnalysisRequestDto.builder()
                    .mode(resolvedMode)
                    .repositoryId(payload.getRepositoryId())
                    .prNumber(payload.getPrNumber())
                    .documentId(payload.getDocumentId())
                    .build();
            ManualDriftAnalysisResponseDto manualResult = docDriftDetectionService.triggerManualDriftAnalysis(req);
            resultObj = manualResult;
            job.setResultJson(objectMapper.writeValueAsString(manualResult));
        } else if (payload.getPrNumber() != null && payload.getPrNumber() > 0) {
            PrDriftAnalysisResultDto result = docDriftDetectionService.detectDriftAndCommentOnPr(
                    payload.getRepositoryId(), payload.getPrNumber());
            resultObj = result;
            if (result != null) {
                job.setResultJson(objectMapper.writeValueAsString(result));
            } else {
                job.setResultJson("{\"status\":\"COMPLETED_NO_DRIFT\"}");
                resultObj = Map.of("status", "COMPLETED_NO_DRIFT");
            }
        } else {
            resultObj = Map.of("status", "COMPLETED_NO_DRIFT");
            job.setResultJson("{\"status\":\"COMPLETED_NO_DRIFT\"}");
        }

        jobStreamService.publishProgress(
                job.getJobId(),
                "COMPLETED",
                100,
                "Hoàn tất phân tích sai lệch tài liệu.",
                resultObj
        );

        log.info("[JobHandler - DRIFT_ANALYZE] Hoàn tất quét sai lệch ngầm cho Job #{}", job.getJobId());
    }
}
