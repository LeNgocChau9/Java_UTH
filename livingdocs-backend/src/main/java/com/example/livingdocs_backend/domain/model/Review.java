package com.example.livingdocs_backend.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Domain Model đại diện cho một lượt xem xét/phê duyệt tài liệu trong hệ thống LivingDocs.
 * Tương ứng bảng 'reviews' trong CSDL.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Review {

    private Long reviewId;
    private Long docId;
    private Long versionId;
    private String reviewer;
    private String generalComment;
    @Builder.Default
    private String result = "PENDING";
    private Instant createdAt;
}
