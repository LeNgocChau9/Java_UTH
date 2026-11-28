package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.policy.DocumentChangePolicyDto;
import com.example.livingdocs_backend.application.dto.policy.DocumentUpdatePolicyDto;
import com.example.livingdocs_backend.application.dto.policy.PolicyEvaluationRequestDto;
import com.example.livingdocs_backend.application.dto.policy.PolicyEvaluationResponseDto;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangePolicyEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentUpdatePolicyEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangePolicyRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentUpdatePolicyRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentPolicyService {

    private final SpringDataDocumentChangePolicyRepository changePolicyRepository;
    private final SpringDataDocumentUpdatePolicyRepository updatePolicyRepository;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    @Autowired(required = false)
    private SpringDataRepositoryRepository repositoryRepository;

    @PostConstruct
    public void initDefaultPolicies() {
        try {
            if (updatePolicyRepository.count() == 0) {
                log.info("[PolicyEngine] Khởi tạo dữ liệu mẫu cho bảng document_update_policies...");
                List<DocumentUpdatePolicyEntity> defaults = List.of(
                        DocumentUpdatePolicyEntity.builder()
                                .workspaceId(1L)
                                .documentType("API_SPEC")
                                .triggerCommit(true)
                                .triggerPullRequest(true)
                                .triggerMerge(true)
                                .action("AUTO_UPDATE")
                                .updatedAt(Instant.now())
                                .build(),
                        DocumentUpdatePolicyEntity.builder()
                                .workspaceId(1L)
                                .documentType("TECHNICAL_DOC")
                                .triggerCommit(true)
                                .triggerPullRequest(true)
                                .triggerMerge(true)
                                .action("REVIEW")
                                .updatedAt(Instant.now())
                                .build(),
                        DocumentUpdatePolicyEntity.builder()
                                .workspaceId(1L)
                                .documentType("ARCHITECTURE")
                                .triggerCommit(false)
                                .triggerPullRequest(true)
                                .triggerMerge(true)
                                .action("REVIEW")
                                .updatedAt(Instant.now())
                                .build(),
                        DocumentUpdatePolicyEntity.builder()
                                .workspaceId(1L)
                                .documentType("USER_GUIDE")
                                .triggerCommit(false)
                                .triggerPullRequest(false)
                                .triggerMerge(true)
                                .action("REVIEW")
                                .updatedAt(Instant.now())
                                .build()
                );
                updatePolicyRepository.saveAll(defaults);
            }

            if (changePolicyRepository.count() == 0) {
                log.info("[PolicyEngine] Khởi tạo dữ liệu mẫu cho bảng document_change_policies...");
                List<DocumentChangePolicyEntity> defaults = List.of(
                        DocumentChangePolicyEntity.builder()
                                .workspaceId(1L)
                                .modulePattern("src/controllers/**")
                                .documentType("API_SPEC")
                                .threshold(1)
                                .autoUpdateEnabled(true)
                                .updatedAt(Instant.now())
                                .build(),
                        DocumentChangePolicyEntity.builder()
                                .workspaceId(1L)
                                .modulePattern("src/services/**")
                                .documentType("TECHNICAL_DOC")
                                .threshold(1)
                                .autoUpdateEnabled(true)
                                .updatedAt(Instant.now())
                                .build(),
                        DocumentChangePolicyEntity.builder()
                                .workspaceId(1L)
                                .modulePattern("*")
                                .documentType("ARCHITECTURE")
                                .threshold(3)
                                .autoUpdateEnabled(false)
                                .updatedAt(Instant.now())
                                .build()
                );
                changePolicyRepository.saveAll(defaults);
            }
        } catch (Exception ex) {
            log.warn("[PolicyEngine] Bỏ qua khởi tạo chính sách mặc định do cấu hình DB: {}", ex.getMessage());
        }
    }

    // ==================== QUẢN LÝ DOCUMENT UPDATE POLICIES ====================

    @Transactional(readOnly = true)
    public List<DocumentUpdatePolicyDto> getAllUpdatePolicies() {
        if (tenantAccessService != null) {
            var scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return Collections.emptyList();
            }
            if (scope.hasTenantFilter()) {
                List<DocumentUpdatePolicyEntity> wsPolicies = updatePolicyRepository.findByWorkspaceId(scope.workspaceId());
                if (wsPolicies.isEmpty()) {
                    // Fallback về chính sách mặc định workspace 1 khi doanh nghiệp mới chưa tùy chỉnh
                    wsPolicies = updatePolicyRepository.findByWorkspaceId(1L);
                }
                return wsPolicies.stream().map(this::toUpdatePolicyDto).toList();
            }
        }
        return updatePolicyRepository.findAll().stream()
                .map(this::toUpdatePolicyDto)
                .toList();
    }

    @Transactional
    public DocumentUpdatePolicyDto saveUpdatePolicy(DocumentUpdatePolicyDto dto, Long userId) {
        if (!StringUtils.hasText(dto.getDocumentType())) {
            throw new IllegalArgumentException("documentType không được để trống");
        }

        Long wsId = tenantAccessService != null
                ? tenantAccessService.resolveWriteWorkspaceId(null)
                : 1L;

        String docType = dto.getDocumentType().trim().toUpperCase();
        DocumentUpdatePolicyEntity entity = updatePolicyRepository.findByWorkspaceIdAndDocumentType(wsId, docType)
                .orElse(DocumentUpdatePolicyEntity.builder()
                        .workspaceId(wsId)
                        .documentType(docType)
                        .build());

        entity.setWorkspaceId(wsId);
        if (dto.getTriggerCommit() != null) entity.setTriggerCommit(dto.getTriggerCommit());
        if (dto.getTriggerPullRequest() != null) entity.setTriggerPullRequest(dto.getTriggerPullRequest());
        if (dto.getTriggerMerge() != null) entity.setTriggerMerge(dto.getTriggerMerge());
        if (StringUtils.hasText(dto.getAction())) {
            String act = dto.getAction().trim().toUpperCase();
            entity.setAction("AUTO_UPDATE".equals(act) ? "AUTO_UPDATE" : "REVIEW");
        }
        entity.setUpdatedBy(userId);
        entity.setUpdatedAt(Instant.now());

        DocumentUpdatePolicyEntity saved = updatePolicyRepository.save(entity);
        return toUpdatePolicyDto(saved);
    }

    // ==================== QUẢN LÝ DOCUMENT CHANGE POLICIES ====================

    @Transactional(readOnly = true)
    public List<DocumentChangePolicyDto> getChangePolicies(Long repositoryId, Long workspaceId) {
        if (tenantAccessService != null && tenantAccessService.currentScope().unassigned()) {
            return Collections.emptyList();
        }
        List<DocumentChangePolicyEntity> list;
        if (repositoryId != null) {
            if (tenantAccessService != null) {
                tenantAccessService.requireRepositoryAccess(repositoryId);
            }
            list = changePolicyRepository.findByRepositoryId(repositoryId);
        } else {
            Long effectiveWs = tenantAccessService != null
                    ? tenantAccessService.resolveReadWorkspaceId(workspaceId)
                    : workspaceId;
            if (effectiveWs != null) {
                list = changePolicyRepository.findByWorkspaceId(effectiveWs);
            } else {
                list = changePolicyRepository.findAll();
            }
        }
        return list.stream().map(this::toChangePolicyDto).toList();
    }

    @Transactional
    public DocumentChangePolicyDto saveChangePolicy(DocumentChangePolicyDto dto, Long userId) {
        if (dto.getRepositoryId() != null && tenantAccessService != null) {
            tenantAccessService.requireRepositoryAccess(dto.getRepositoryId());
        }
        Long targetWsId = tenantAccessService != null
                ? tenantAccessService.resolveWriteWorkspaceId(dto.getWorkspaceId())
                : (dto.getWorkspaceId() != null ? dto.getWorkspaceId() : 1L);

        DocumentChangePolicyEntity entity;
        if (dto.getPolicyId() != null) {
            entity = changePolicyRepository.findById(dto.getPolicyId())
                    .orElse(new DocumentChangePolicyEntity());
            if (entity.getPolicyId() != null && tenantAccessService != null) {
                tenantAccessService.requireWorkspaceAccess(entity.getWorkspaceId());
            }
        } else {
            entity = new DocumentChangePolicyEntity();
        }

        entity.setWorkspaceId(targetWsId);
        entity.setRepositoryId(dto.getRepositoryId());
        entity.setModulePattern(StringUtils.hasText(dto.getModulePattern()) ? dto.getModulePattern().trim() : "*");
        entity.setDocumentType(StringUtils.hasText(dto.getDocumentType()) ? dto.getDocumentType().trim().toUpperCase() : "TECHNICAL_DOC");
        entity.setThreshold(dto.getThreshold() != null && dto.getThreshold() > 0 ? dto.getThreshold() : 1);
        entity.setAutoUpdateEnabled(dto.getAutoUpdateEnabled() != null ? dto.getAutoUpdateEnabled() : false);
        entity.setUpdatedBy(userId);
        entity.setUpdatedAt(Instant.now());

        DocumentChangePolicyEntity saved = changePolicyRepository.save(entity);
        return toChangePolicyDto(saved);
    }

    @Transactional
    public void deleteChangePolicy(Long policyId) {
        Optional<DocumentChangePolicyEntity> existing = changePolicyRepository.findById(policyId);
        if (existing.isPresent() && tenantAccessService != null) {
            tenantAccessService.requireWorkspaceAccess(existing.get().getWorkspaceId());
        }
        changePolicyRepository.deleteById(policyId);
    }

    // ==================== ENGINE ĐÁNH GIÁ CHÍNH SÁCH THỰC TẾ ====================

    @Transactional(readOnly = true)
    public PolicyEvaluationResponseDto evaluatePolicy(PolicyEvaluationRequestDto req) {
        if (req.getRepositoryId() != null && tenantAccessService != null) {
            tenantAccessService.requireRepositoryAccess(req.getRepositoryId());
        }
        String docType = StringUtils.hasText(req.getDocumentType()) ? req.getDocumentType().trim().toUpperCase() : "TECHNICAL_DOC";
        String eventType = StringUtils.hasText(req.getEventType()) ? req.getEventType().trim().toLowerCase() : "pull_request";
        int changeCount = req.getChangedFilesCount() != null ? req.getChangedFilesCount() : 1;

        Long effectiveWs = resolveEvaluationWorkspaceId(req.getRepositoryId());

        // 1. Kiểm tra quy tắc kích hoạt sự kiện (DocumentUpdatePolicy theo workspace, fallback 1L)
        Optional<DocumentUpdatePolicyEntity> updatePolicyOpt = effectiveWs != null
                ? updatePolicyRepository.findByWorkspaceIdAndDocumentType(effectiveWs, docType)
                : Optional.empty();
        if (updatePolicyOpt.isEmpty()) {
            updatePolicyOpt = updatePolicyRepository.findByWorkspaceIdAndDocumentType(1L, docType);
        }
        DocumentUpdatePolicyEntity updatePolicy = updatePolicyOpt.orElse(null);

        boolean eventAllowed = true;
        String eventDisallowedReason = null;

        if (updatePolicy != null) {
            if (("commit".equals(eventType) || "push".equals(eventType)) && !Boolean.TRUE.equals(updatePolicy.getTriggerCommit())) {
                eventAllowed = false;
                eventDisallowedReason = "Chính sách " + docType + " tắt kích hoạt khi có Commit";
            } else if ("pull_request".equals(eventType) && !Boolean.TRUE.equals(updatePolicy.getTriggerPullRequest())) {
                eventAllowed = false;
                eventDisallowedReason = "Chính sách " + docType + " tắt kích hoạt khi mở Pull Request";
            } else if (("merge".equals(eventType) || "pull_request_merged".equals(eventType)) && !Boolean.TRUE.equals(updatePolicy.getTriggerMerge())) {
                eventAllowed = false;
                eventDisallowedReason = "Chính sách " + docType + " tắt kích hoạt khi Merge PR";
            }
        }

        if (!eventAllowed) {
            return PolicyEvaluationResponseDto.builder()
                    .effectiveAction("SKIP")
                    .reason(eventDisallowedReason)
                    .autoUpdateEnabled(false)
                    .threshold(1)
                    .changedFilesCount(changeCount)
                    .appliedUpdatePolicy(updatePolicy != null ? toUpdatePolicyDto(updatePolicy) : null)
                    .build();
        }

        // 2. Tra cứu quy tắc module và ngưỡng thay đổi (DocumentChangePolicy trong cùng workspace)
        List<DocumentChangePolicyEntity> changePolicies;
        if (tenantAccessService != null && tenantAccessService.currentScope().unassigned()) {
            changePolicies = Collections.emptyList();
        } else if (req.getRepositoryId() != null) {
            changePolicies = changePolicyRepository.findByRepositoryId(req.getRepositoryId());
            if (changePolicies.isEmpty() && effectiveWs != null) {
                changePolicies = changePolicyRepository.findByWorkspaceId(effectiveWs);
            }
        } else if (effectiveWs != null) {
            changePolicies = changePolicyRepository.findByWorkspaceId(effectiveWs);
        } else {
            changePolicies = changePolicyRepository.findAll();
        }

        DocumentChangePolicyEntity matchingChangePolicy = changePolicies.stream()
                .filter(p -> p.getDocumentType() == null || p.getDocumentType().equalsIgnoreCase(docType))
                .findFirst()
                .orElse(null);

        String desiredAction = updatePolicy != null && StringUtils.hasText(updatePolicy.getAction())
                ? updatePolicy.getAction().toUpperCase()
                : "REVIEW";

        int threshold = matchingChangePolicy != null && matchingChangePolicy.getThreshold() != null
                ? matchingChangePolicy.getThreshold() : 1;
        boolean autoUpdateEnabled = matchingChangePolicy != null && Boolean.TRUE.equals(matchingChangePolicy.getAutoUpdateEnabled());

        String effectiveAction;
        String reason;

        if ("AUTO_UPDATE".equals(desiredAction)) {
            if (!autoUpdateEnabled) {
                effectiveAction = "REVIEW";
                reason = "Update Policy yêu cầu AUTO_UPDATE nhưng Change Policy cho " + docType + " chưa bật auto_update_enabled -> Chuyển sang REVIEW.";
            } else if (changeCount < threshold) {
                effectiveAction = "REVIEW";
                reason = "Số lượng thay đổi (" + changeCount + ") nhỏ hơn ngưỡng threshold (" + threshold + ") -> Chuyển sang REVIEW.";
            } else {
                effectiveAction = "AUTO_UPDATE";
                reason = "Đạt điều kiện cập nhật tự động: Loại " + docType + ", sự kiện " + eventType + ", số file thay đổi " + changeCount + " >= threshold " + threshold + ".";
            }
        } else {
            effectiveAction = "REVIEW";
            reason = "Chính sách quy định chế độ REVIEW (cảnh báo chờ nhân viên/quản lý phê duyệt).";
        }

        return PolicyEvaluationResponseDto.builder()
                .effectiveAction(effectiveAction)
                .reason(reason)
                .autoUpdateEnabled(autoUpdateEnabled)
                .threshold(threshold)
                .changedFilesCount(changeCount)
                .matchingPattern(matchingChangePolicy != null ? matchingChangePolicy.getModulePattern() : "*")
                .appliedUpdatePolicy(updatePolicy != null ? toUpdatePolicyDto(updatePolicy) : null)
                .appliedChangePolicy(matchingChangePolicy != null ? toChangePolicyDto(matchingChangePolicy) : null)
                .build();
    }

    private Long resolveEvaluationWorkspaceId(Long repositoryId) {
        if (repositoryId != null && repositoryRepository != null) {
            Optional<RepositoryEntity> repo = repositoryRepository.findById(repositoryId);
            if (repo.isPresent() && repo.get().getWorkspaceId() != null) {
                return repo.get().getWorkspaceId();
            }
        }
        if (tenantAccessService != null) {
            var scope = tenantAccessService.currentScope();
            if (scope.hasTenantFilter()) {
                return scope.workspaceId();
            }
        }
        return null;
    }

    private DocumentUpdatePolicyDto toUpdatePolicyDto(DocumentUpdatePolicyEntity e) {
        return DocumentUpdatePolicyDto.builder()
                .policyId(e.getPolicyId())
                .documentType(e.getDocumentType())
                .triggerCommit(e.getTriggerCommit())
                .triggerPullRequest(e.getTriggerPullRequest())
                .triggerMerge(e.getTriggerMerge())
                .action(e.getAction())
                .updatedBy(e.getUpdatedBy())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private DocumentChangePolicyDto toChangePolicyDto(DocumentChangePolicyEntity e) {
        return DocumentChangePolicyDto.builder()
                .policyId(e.getPolicyId())
                .workspaceId(e.getWorkspaceId())
                .repositoryId(e.getRepositoryId())
                .modulePattern(e.getModulePattern())
                .documentType(e.getDocumentType())
                .threshold(e.getThreshold())
                .autoUpdateEnabled(e.getAutoUpdateEnabled())
                .updatedBy(e.getUpdatedBy())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
