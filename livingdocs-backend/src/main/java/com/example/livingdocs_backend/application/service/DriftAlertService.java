package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.DriftAlertActionRequest;
import com.example.livingdocs_backend.application.dto.DriftAlertResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DriftAlertService {

    static final Set<String> HANDLER_ROLES = Set.of("MANAGER", "TECH_LEAD", "ADMIN");
    static final Set<String> SEVERITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final String OPEN = "OPEN";

    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final AuditServicePort auditServicePort;

    @Transactional
    public DriftAlertResponse handle(Long alertId, DriftAlertActionRequest request, UserPrincipal actor) {
        requireHandler(actor);
        DocumentChangeAlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo drift " + alertId));
        if (!OPEN.equalsIgnoreCase(alert.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cảnh báo đang ở trạng thái " + alert.getStatus() + " và không thể xử lý thêm");
        }

        String action = normalize(request.getAction());
        String previousSeverity = alert.getSeverity();
        AuditAction auditAction = switch (action) {
            case "IGNORE", "DISMISS" -> close(alert, "IGNORED", AuditAction.DRIFT_ALERT_IGNORED);
            case "RESOLVE" -> close(alert, "RESOLVED", AuditAction.DRIFT_ALERT_RESOLVED);
            case "ACCEPT" -> close(alert, "ACCEPTED", AuditAction.DRIFT_ALERT_ACCEPTED);
            case "CHANGE_SEVERITY" -> changeSeverity(alert, request.getSeverity());
            default -> throw new IllegalArgumentException(
                    "action không hợp lệ. Dùng IGNORE, RESOLVE, ACCEPT hoặc CHANGE_SEVERITY");
        };

        DocumentChangeAlertEntity saved = alertRepository.save(alert);
        auditServicePort.recordSecurityAction(
                actor.getUserId(),
                auditAction,
                "DRIFT_ALERT",
                String.valueOf(saved.getAlertId()),
                detail(saved, previousSeverity, request.getComment())
        );
        return toResponse(saved);
    }

    private static AuditAction close(DocumentChangeAlertEntity alert, String status, AuditAction auditAction) {
        alert.setStatus(status);
        alert.setResolvedAt(Instant.now());
        return auditAction;
    }

    private static AuditAction changeSeverity(DocumentChangeAlertEntity alert, String severity) {
        String next = normalize(severity);
        if (!SEVERITIES.contains(next)) {
            throw new IllegalArgumentException("severity phải là LOW, MEDIUM, HIGH hoặc CRITICAL");
        }
        if (next.equalsIgnoreCase(alert.getSeverity())) {
            throw new IllegalArgumentException("Mức độ nghiêm trọng không thay đổi");
        }
        alert.setSeverity(next);
        return AuditAction.DRIFT_ALERT_SEVERITY_CHANGED;
    }

    private static void requireHandler(UserPrincipal actor) {
        if (actor == null || actor.getUserId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Yêu cầu đăng nhập để xử lý cảnh báo drift");
        }
        boolean allowed = actor.getRoles() != null && actor.getRoles().stream()
                .map(DriftAlertService::roleName)
                .anyMatch(HANDLER_ROLES::contains);
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ Manager, Tech Lead hoặc Admin được đóng cảnh báo hoặc đổi mức độ nghiêm trọng");
        }
    }

    private static String detail(DocumentChangeAlertEntity alert, String previousSeverity, String comment) {
        StringBuilder detail = new StringBuilder();
        detail.append("documentId=").append(alert.getDocumentId());
        detail.append("; status=").append(alert.getStatus());
        detail.append("; severity=").append(alert.getSeverity());
        if (previousSeverity != null && !previousSeverity.equalsIgnoreCase(alert.getSeverity())) {
            detail.append("; previousSeverity=").append(previousSeverity);
        }
        if (comment != null && !comment.isBlank()) {
            detail.append("; comment=").append(comment.trim());
        }
        return detail.toString();
    }

    private static String roleName(String value) {
        String clean = normalize(value);
        return clean.startsWith("ROLE_") ? clean.substring(5) : clean;
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static DriftAlertResponse toResponse(DocumentChangeAlertEntity alert) {
        return DriftAlertResponse.builder()
                .alertId(alert.getAlertId())
                .documentId(alert.getDocumentId())
                .repositoryId(alert.getRepositoryId())
                .classification(alert.getClassification())
                .severity(alert.getSeverity())
                .status(alert.getStatus())
                .resolvedAt(alert.getResolvedAt())
                .build();
    }
}
