package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Bản ghi lịch sử xem xét tài liệu từ Staff và Manager")
public class ReviewHistoryItemResponse {
    private Long id;
    private Long docId;
    private Long versionId;
    private String title;
    private String repo;
    private String reviewer;
    private String action; // "approved" | "rejected" | "returned"
    private String result; // "APPROVED" | "REJECTED" | "RETURNED"
    private String note;
    private Instant reviewedAt;
}

