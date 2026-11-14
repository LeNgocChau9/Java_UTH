package com.example.livingdocs_backend.infrastructure.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Entity ánh xạ bảng user_notification_preferences trong CSDL PostgreSQL.
 * Quản lý tùy chọn nhận thông báo của từng người dùng:
 * - Nhận thông báo qua email (emailEnabled)
 * - Khi có tài liệu mới cần duyệt (reviewEnabled)
 * - Khi phát hiện cảnh báo sai lệch mã nguồn (driftAlertEnabled / documentEnabled)
 * - Khi mã khóa truy cập GitHub gặp sự cố cần cấp quyền lại (githubEnabled)
 */
@Entity
@Table(name = "user_notification_preferences")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserNotificationPreferenceEntity {

    @Id
    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "email_enabled", nullable = false)
    @Builder.Default
    private boolean emailEnabled = true;

    @Column(name = "github_enabled", nullable = false)
    @Builder.Default
    private boolean githubEnabled = true;

    @Column(name = "review_enabled", nullable = false)
    @Builder.Default
    private boolean reviewEnabled = true;

    @Column(name = "document_enabled", nullable = false)
    @Builder.Default
    private boolean documentEnabled = true;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
