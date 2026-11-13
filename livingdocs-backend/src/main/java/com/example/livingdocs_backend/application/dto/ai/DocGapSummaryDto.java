package com.example.livingdocs_backend.application.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO chứa báo cáo tổng hợp và danh sách chi tiết các khoảng trống tài liệu sau
 * khi lọc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocGapSummaryDto {

    private Long repositoryId;
    private String repoFullName;
    private int totalEntities;
    private int totalGaps; // Tổng số phần tử chưa có tài liệu
    private int documentedEntities; // Số phần tử đã có tài liệu
    private double coveragePercentage; // % độ bao phủ tài liệu hiện tại
    private int totalClasses; // Số class chưa có tài liệu
    private int totalInterfaces; // Số interface chưa có tài liệu
    private int totalMethods; // Số method chưa có tài liệu
    private List<String> packages; // Danh sách các package/gói có khoảng trống (dùng làm dropdown filter)
    private List<DocumentationGapDto> items; // Danh sách chi tiết các khoảng trống
}
