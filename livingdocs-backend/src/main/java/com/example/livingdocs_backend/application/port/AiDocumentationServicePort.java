package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateResponseDto;

public interface AiDocumentationServicePort {
    /**
     * Gửi yêu cầu sang AI Engine (/v1/docs/generate) để Gemini sinh tài liệu Markdown chuẩn.
     */
    AiDocGenerateResponseDto generateDocumentation(AiDocGenerateRequestDto request);
}

