package com.example.livingdocs_backend.application.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO kết quả phân tích sai lệch ngữ nghĩa (Semantic Drift) từ AI Engine (/v1/drift/analyze).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiDriftAnalyzeResponseDto {
    private String status;
    private String mode;
    private String entity_name;
    private String entity_type;
    private Double drift_score;
    private String severity;
    private String classification;
    private Boolean is_drifted;
    private String explanation;
    private List<String> affected_sections;
    private List<DriftSuggestionDto> suggestions;
    private String model_used;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DriftSuggestionDto {
        private String section;
        private String old_text;
        private String suggested_text;
        private String reason;
    }
}

