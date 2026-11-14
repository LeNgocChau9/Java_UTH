package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.DriftAlertActionRequest;
import com.example.livingdocs_backend.application.dto.DriftAlertNotificationDto;
import com.example.livingdocs_backend.application.dto.DriftAlertResponse;
import com.example.livingdocs_backend.application.dto.DriftAlertSummaryResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DriftAlertService {

    static final Set<String> HANDLER_ROLES = Set.of("MANAGER", "TECH_LEAD", "ADMIN", "DEVELOPER", "STAFF");
    static final Set<String> SEVERITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final String OPEN = "OPEN";
    private static final String PENDING = "PENDING";

    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final SpringDataDocumentRepository documentRepository;
    private final AuditServicePort auditServicePort;

    @Transactional(readOnly = true)
    public List<DocumentChangeAlertEntity> findAll(Long repositoryId, String status) {
        if (repositoryId != null && status != null && !status.isBlank()) {
            return alertRepository.findByRepositoryIdAndStatus(repositoryId, status.toUpperCase());
        }
        if (repositoryId != null) {
            return alertRepository.findByRepositoryId(repositoryId);
        }
        if (status != null && !status.isBlank()) {
            return alertRepository.findByStatusIgnoreCase(status.trim());
        }
        return alertRepository.findAll();
    }

    @Transactional(readOnly = true)
    public DriftAlertSummaryResponse getNotificationSummary(Long repositoryId) {
        List<String> pendingStatuses = List.of(PENDING, OPEN);
        long count;
        List<DocumentChangeAlertEntity> alertEntities;

        if (repositoryId != null) {
            List<DocumentChangeAlertEntity> list = alertRepository.findByRepositoryId(repositoryId).stream()
                    .filter(a -> a.getStatus() != null && pendingStatuses.contains(a.getStatus().toUpperCase(Locale.ROOT)))
                    .sorted((a, b) -> {
                        Instant t1 = a.getCreatedAt() != null ? a.getCreatedAt() : Instant.EPOCH;
                        Instant t2 = b.getCreatedAt() != null ? b.getCreatedAt() : Instant.EPOCH;
                        return t2.compareTo(t1);
                    })
                    .toList();
            count = list.size();
            alertEntities = list.stream().limit(10).toList();
        } else {
            count = alertRepository.countByStatusInIgnoreCase(pendingStatuses);
            alertEntities = alertRepository.findTop10ByStatusInIgnoreCaseOrderByCreatedAtDesc(pendingStatuses);
        }

        List<DriftAlertNotificationDto> recent = alertEntities.stream().map(a -> {
            String docTitle = null;
            if (a.getDocumentId() != null && documentRepository != null) {
                docTitle = documentRepository.findById(a.getDocumentId())
                        .map(DocumentEntity::getTitle)
                        .orElse(null);
            }
            String commitShort = a.getSourceCommit() != null && a.getSourceCommit().length() > 7
                    ? a.getSourceCommit().substring(0, 7)
                    : a.getSourceCommit();
            String details = a.getDetails();
            if (details == null || details.isBlank()) {
                if (a.getSourcePrId() != null) {
                    details = "Phát hiện sai lệch tại Pull Request #" + a.getSourcePrId();
                } else if (commitShort != null) {
                    details = "Phát hiện sai lệch tại commit " + commitShort;
                } else {
                    details = "Phát hiện trôi dạt mã nguồn so với tài liệu hiện tại";
                }
            }

            String suggestionUrl = "/canh-bao-sai-lech?alertId=" + a.getAlertId();
            if (a.getDocumentId() != null) {
                suggestionUrl = "/canh-bao-sai-lech?alertId=" + a.getAlertId() + "&docId=" + a.getDocumentId();
            }

            return DriftAlertNotificationDto.builder()
                    .alertId(a.getAlertId())
                    .repositoryId(a.getRepositoryId())
                    .documentId(a.getDocumentId())
                    .documentTitle(docTitle)
                    .severity(a.getSeverity() != null ? a.getSeverity().toUpperCase(Locale.ROOT) : "MEDIUM")
                    .classification(a.getClassification() != null ? a.getClassification() : "SEMANTIC")
                    .status(a.getStatus() != null ? a.getStatus().toUpperCase(Locale.ROOT) : PENDING)
                    .sourceCommit(commitShort)
                    .sourcePrId(a.getSourcePrId())
                    .details(details)
                    .createdAt(a.getCreatedAt())
                    .suggestionUrl(suggestionUrl)
                    .build();
        }).toList();

        return DriftAlertSummaryResponse.builder()
                .pendingCount(count)
                .recentAlerts(recent)
                .build();
    }

    @Transactional
    public DriftAlertResponse handle(Long alertId, DriftAlertActionRequest request, UserPrincipal actor) {
        requireHandler(actor);
        DocumentChangeAlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo drift " + alertId));
        if (!OPEN.equalsIgnoreCase(alert.getStatus()) && !PENDING.equalsIgnoreCase(alert.getStatus())) {
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
