package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Lưu trữ lịch sử giao nhận GitHub Webhook (Delivery Logs) để hiển thị tại /kho-luu-tru.
 */
@Entity
@Table(name = "webhook_deliveries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebhookDeliveryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "workspace_id")
    private Long workspaceId;

    @Column(name = "delivery_id", length = 128)
    private String deliveryId;

    @Column(name = "event_type", nullable = false, length = 64)
    private String eventType;

    @Column(name = "repository_id")
    private Long repositoryId;

    @Column(name = "repo_full_name", length = 255)
    private String repoFullName;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "http_status", nullable = false)
    @Builder.Default
    private int httpStatus = 200;

    @Column(name = "latency_ms")
    private Long latencyMs;

    @Column(name = "payload_summary", columnDefinition = "TEXT")
    private String payloadSummary;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "delivered_at", nullable = false)
    @Builder.Default
    private Instant deliveredAt = Instant.now();
}
