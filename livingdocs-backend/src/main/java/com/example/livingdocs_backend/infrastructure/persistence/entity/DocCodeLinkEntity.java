package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Entity ánh xạ bảng doc_code_links: Liên kết giữa tài liệu (Document) và thực thể mã nguồn (file, class, method).
 */
@Entity
@Table(name = "doc_code_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocCodeLinkEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "link_id")
    private Long linkId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    @Column(name = "class_name", length = 255)
    private String className;

    @Column(name = "method_name", length = 255)
    private String methodName;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
