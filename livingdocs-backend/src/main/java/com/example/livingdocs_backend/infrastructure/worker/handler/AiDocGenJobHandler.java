package com.example.livingdocs_backend.infrastructure.worker.handler;

import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateResponseDto;
import com.example.livingdocs_backend.application.dto.job.AiDocGenJobPayload;
import com.example.livingdocs_backend.application.port.AiDocumentationServicePort;
import com.example.livingdocs_backend.application.port.JobHandler;
import com.example.livingdocs_backend.domain.model.Job;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Handler thực thi tác vụ AI sinh tài liệu nặng dưới nền (AI_DOC_GEN).
 * Chạy bất đồng bộ, không làm nghẽn luồng xử lý chính.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiDocGenJobHandler implements JobHandler {

    private final AiDocumentationServicePort aiDocumentationServicePort;
    private final ObjectMapper objectMapper;

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
        log.info("[JobHandler - AI_DOC_GEN] Sinh tài liệu cho repoId={}, docId={}, scope={}",
                payload.getRepositoryId(), payload.getDocumentId(), payload.getDocType());

        AiDocGenerateRequestDto request = AiDocGenerateRequestDto.builder()
                .repository_id(payload.getRepositoryId())
                .scope(payload.getDocType() != null ? payload.getDocType() : "REPOSITORY")
                .title(payload.getTitle())
                .note(payload.getPrompt())
                .build();

        AiDocGenerateResponseDto response = aiDocumentationServicePort.generateDocumentation(
                request,
                payload.getActorId(),
                payload.getActorRole() != null ? payload.getActorRole() : "AI_WORKER"
        );

        String resultJson = objectMapper.writeValueAsString(response);
        job.setResultJson(resultJson);
        log.info("[JobHandler - AI_DOC_GEN] Hoàn tất sinh tài liệu ngầm cho Job #{}", job.getJobId());
    }
}
