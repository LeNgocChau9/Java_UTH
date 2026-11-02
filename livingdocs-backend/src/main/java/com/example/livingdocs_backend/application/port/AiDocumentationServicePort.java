package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateResponseDto;

public interface AiDocumentationServicePort {
    /**
     * Điều phối sinh tài liệu AI theo 3 phạm vi (FILE, PACKAGE, REPOSITORY),
     * gọi FastAPI (/v1/docs/generate), lưu vào bảng documents, document_versions (trạng thái DRAFT)
     * và lưu liên kết vào bảng doc_code_links.
     */
    AiDocGenerateResponseDto generateDocumentation(AiDocGenerateRequestDto request, Long actorId, String actorRole);

    /**
     * Phiên bản mặc định khi không truyền thông tin người dùng.
     */
    default AiDocGenerateResponseDto generateDocumentation(AiDocGenerateRequestDto request) {
        return generateDocumentation(request, null, "AI");
    }
}
