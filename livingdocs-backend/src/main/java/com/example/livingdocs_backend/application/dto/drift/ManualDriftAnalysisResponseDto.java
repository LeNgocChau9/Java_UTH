package com.example.livingdocs_backend.application.dto.drift;

import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO trả về kết quả phân tích sai lệch tài liệu thủ công kèm danh sách cảnh báo vừa phát hiện.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualDriftAnalysisResponseDto {

    private String mode;
    private Long repositoryId;
    private Integer prNumber;
    private Long documentId;
    private String targetLabel;
    private int totalDriftsDetected;
    private List<DocumentChangeAlertEntity> alerts;
    private Instant analyzedAt;
    private String message;
}

