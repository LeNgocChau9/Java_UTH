package com.example.livingdocs_backend.application.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * DTO phản hồi chỉ số bao phủ tài liệu (% Coverage) của mã nguồn.
 * Thuộc phạm vi module của TV4 (AST & Code Entities & Coverage).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocCoverageResponseDto {
    private Long repositoryId;
    private String filePath; // null nếu tính cho toàn bộ repository
    private int totalEntities;
    private int documentedEntities;
    private int undocumentedEntities;
    private double coveragePercentage; // Ví dụ: 75.5 (%)
    private Map<String, Integer> byEntityType; // CLASS: 2, METHOD: 8...
    private Map<String, Integer> documentedByEntityType; // CLASS: 2, METHOD: 5...
}

