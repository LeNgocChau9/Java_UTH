package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateResponseDto;
import com.example.livingdocs_backend.application.dto.job.AiDocGenJobPayload;
import com.example.livingdocs_backend.application.port.AiDocumentationServicePort;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.Job;
import com.example.livingdocs_backend.infrastructure.sse.JobStreamService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Handler thực thi tác vụ AI sinh tài liệu nặng dưới nền (AI_DOC_GEN).
 * Chạy bất đồng bộ, phát tiến trình SSE thời gian thực qua JobStreamService.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiDocGenJobHandler implements JobHandler {

    private final AiDocumentationServicePort aiDocumentationServicePort;
    private final ObjectMapper objectMapper;
    private final JobStreamService jobStreamService;

    @Autowired(required = false)
    private CodeIndexServicePort codeIndexServicePort;

    @Autowired(required = false)
    private AuditServicePort auditServicePort;

    @Override
    public String getJobType() {
        return Job.TYPE_AI_DOC_GEN;
    }

    @Override
    public void handle(Job job) throws Exception {
        log.info("[JobHandler - AI_DOC_GEN] Bắt đầu xử lý Job #{}", job.getJobId());

        if (job.getPayloadJson() == null || job.getPayloadJson().isBlank()) {
            log.warn("[JobHandler - AI_DOC_GEN] Payload rỗng cho Job #{}, bỏ qua.", job.getJobId());
            return;
        }

        AiDocGenJobPayload payload = objectMapper.readValue(job.getPayloadJson(), AiDocGenJobPayload.class);
        AiDocGenerateRequestDto request = payload.getFullRequest();
        if (request == null) {
            request = AiDocGenerateRequestDto.builder()
                    .repository_id(payload.getRepositoryId())
                    .scope(payload.getDocType() != null ? payload.getDocType() : "REPOSITORY")
                    .title(payload.getTitle())
                    .note(payload.getPrompt())
                    .build();
        }

        Long repoId = request.repository_id() != null ? request.repository_id() : payload.getRepositoryId();
        String scope = request.scope() != null ? request.scope() : (payload.getDocType() != null ? payload.getDocType() : "REPOSITORY");

        jobStreamService.publishProgress(
                job.getJobId(),
                "FETCHING_REPO",
                20,
                "Đang tải cấu trúc mã nguồn từ kho lưu trữ...",
                Map.of("repositoryId", repoId != null ? repoId : 0L, "scope", scope)
        );

        int existingEntitiesCount = 0;
        if (codeIndexServicePort != null && repoId != null) {
            existingEntitiesCount = codeIndexServicePort.getEntitiesByRepository(repoId).size();
        }

        jobStreamService.publishProgress(
                job.getJobId(),
                "EXTRACTING_AST",
                45,
                "Đang bóc tách cây cú pháp AST và ánh xạ thực thể mã nguồn...",
                Map.of("entitiesCount", existingEntitiesCount, "targetPath", request.target_path() != null ? request.target_path() : "")
        );

        jobStreamService.publishProgress(
                job.getJobId(),
                "RAG_CONTEXT",
                70,
                "Đang tổng hợp ngữ cảnh RAG, grounding evidence và mẫu tài liệu...",
                Map.of("templateType", request.template_type() != null ? request.template_type() : "API_REFERENCE")
        );

        jobStreamService.publishProgress(
                job.getJobId(),
                "LLM_GENERATING",
                85,
                "AI Engine đang biên soạn tài liệu kỹ thuật...",
                Map.of("provider", request.provider() != null ? request.provider() : "auto")
        );

        AiDocGenerateResponseDto response = aiDocumentationServicePort.generateDocumentation(
                request,
                payload.getActorId(),
                payload.getActorRole() != null ? payload.getActorRole() : "AI_WORKER"
        );

        String resultJson = objectMapper.writeValueAsString(response);
        job.setResultJson(resultJson);

        if (auditServicePort != null) {
            String docId = response != null && response.docId() != null ? response.docId().toString() : null;
            auditServicePort.recordSecurityAction(
                    payload.getActorId(),
                    AuditAction.AI_DOCUMENT_GENERATED,
                    "DOCUMENT",
                    docId,
                    "Sinh tài liệu AI bất đồng bộ (Job #" + job.getJobId() + "). Phạm vi: " + scope
            );
        }

        jobStreamService.publishProgress(
                job.getJobId(),
                "COMPLETED",
                100,
                "Đã hoàn tất sinh tài liệu AI và lưu nháp thành công.",
                response
        );
        log.info("[JobHandler - AI_DOC_GEN] Hoàn tất sinh tài liệu ngầm cho Job #{}", job.getJobId());
    }
}
