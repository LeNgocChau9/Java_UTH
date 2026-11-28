package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.application.port.PrMergeBlockingServicePort;
import com.example.livingdocs_backend.application.port.ReviewServicePort;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.exception.DocumentNotFoundException;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStateMachine;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.model.Review;
import com.example.livingdocs_backend.domain.model.User;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ReviewRepositoryPort;
import com.example.livingdocs_backend.domain.repository.UserRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalDelegationEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ManagerApprovalPolicyEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewCommentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataManagerApprovalDelegationRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataManagerApprovalPolicyRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataReviewCommentRepository;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
public class ReviewServiceImpl implements ReviewServicePort {

    private final DocumentRepositoryPort documentRepositoryPort;
    private final DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final AuditServicePort auditServicePort;
    private final TemplateStructureCheck templateStructureCheck;
    private final DocumentServicePort documentServicePort;
    private final SpringDataReviewCommentRepository reviewCommentRepository;
    private final PrMergeBlockingServicePort prMergeBlockingService;
    private final SpringDataAdminSettingRepository adminSettingRepository;
    private final DocTemplateRepository docTemplateRepository;
    private final ObjectMapper objectMapper;

    private ChangelogServicePort changelogServicePort;
    private SpringDataManagerApprovalPolicyRepository managerApprovalPolicyRepository;
    private SpringDataManagerApprovalDelegationRepository managerApprovalDelegationRepository;
    private UserRepositoryPort userRepositoryPort;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.example.livingdocs_backend.infrastructure.notification.ExternalIntegrationWebhookDispatcher webhookDispatcher;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private TenantAccessService tenantAccessService;

    @Autowired
    public ReviewServiceImpl(
            DocumentRepositoryPort documentRepositoryPort,
            DocumentVersionRepositoryPort documentVersionRepositoryPort,
            ReviewRepositoryPort reviewRepositoryPort,
            SpringDataRepositoryRepository repositoryRepository,
            AuditServicePort auditServicePort,
            TemplateStructureCheck templateStructureCheck,
            DocumentServicePort documentServicePort,
            SpringDataReviewCommentRepository reviewCommentRepository,
            PrMergeBlockingServicePort prMergeBlockingService,
            SpringDataAdminSettingRepository adminSettingRepository,
            DocTemplateRepository docTemplateRepository,
            ObjectMapper objectMapper,
            @Autowired(required = false) ChangelogServicePort changelogServicePort,
            @Autowired(required = false) SpringDataManagerApprovalPolicyRepository managerApprovalPolicyRepository,
            @Autowired(required = false) SpringDataManagerApprovalDelegationRepository managerApprovalDelegationRepository,
            @Autowired(required = false) UserRepositoryPort userRepositoryPort
    ) {
        this.documentRepositoryPort = documentRepositoryPort;
        this.documentVersionRepositoryPort = documentVersionRepositoryPort;
        this.reviewRepositoryPort = reviewRepositoryPort;
        this.repositoryRepository = repositoryRepository;
        this.auditServicePort = auditServicePort;
        this.templateStructureCheck = templateStructureCheck;
        this.documentServicePort = documentServicePort;
        this.reviewCommentRepository = reviewCommentRepository;
        this.prMergeBlockingService = prMergeBlockingService;
        this.adminSettingRepository = adminSettingRepository;
        this.docTemplateRepository = docTemplateRepository;
        this.objectMapper = objectMapper;
        this.changelogServicePort = changelogServicePort;
        this.managerApprovalPolicyRepository = managerApprovalPolicyRepository;
        this.managerApprovalDelegationRepository = managerApprovalDelegationRepository;
        this.userRepositoryPort = userRepositoryPort;
    }

    public ReviewServiceImpl(
            DocumentRepositoryPort documentRepositoryPort,
            DocumentVersionRepositoryPort documentVersionRepositoryPort,
            ReviewRepositoryPort reviewRepositoryPort,
            SpringDataRepositoryRepository repositoryRepository,
            AuditServicePort auditServicePort,
            TemplateStructureCheck templateStructureCheck,
            DocumentServicePort documentServicePort,
            SpringDataReviewCommentRepository reviewCommentRepository,
            PrMergeBlockingServicePort prMergeBlockingService,
            SpringDataAdminSettingRepository adminSettingRepository,
            DocTemplateRepository docTemplateRepository,
            ObjectMapper objectMapper
    ) {
        this(documentRepositoryPort, documentVersionRepositoryPort, reviewRepositoryPort,
                repositoryRepository, auditServicePort, templateStructureCheck, documentServicePort,
                reviewCommentRepository, prMergeBlockingService, adminSettingRepository,
                docTemplateRepository, objectMapper, null, null, null, null);
    }

    public void setChangelogServicePort(ChangelogServicePort changelogServicePort) {
        this.changelogServicePort = changelogServicePort;
    }

    public void setManagerApprovalPolicyRepository(SpringDataManagerApprovalPolicyRepository managerApprovalPolicyRepository) {
        this.managerApprovalPolicyRepository = managerApprovalPolicyRepository;
    }

    public void setManagerApprovalDelegationRepository(SpringDataManagerApprovalDelegationRepository managerApprovalDelegationRepository) {
        this.managerApprovalDelegationRepository = managerApprovalDelegationRepository;
    }

    public void setUserRepositoryPort(UserRepositoryPort userRepositoryPort) {
        this.userRepositoryPort = userRepositoryPort;
    }

    public void setTenantAccessService(TenantAccessService tenantAccessService) {
        this.tenantAccessService = tenantAccessService;
    }

    public static final String KEY_APPROVAL_POLICIES = "approval_policies";
    public static final String KEY_MANAGER_DELEGATIONS = "manager_delegations";

    @Override
    @Transactional(readOnly = true)
    public List<ReviewQueueItemResponse> getStaffQueue() {
        List<Document> docs;
        if (tenantAccessService != null) {
            TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return List.of();
            }
            Long workspaceId = tenantAccessService.resolveReadWorkspaceId(null);
            docs = workspaceId != null
                    ? documentRepositoryPort.findByStatusAndWorkspaceId(DocumentStatus.UNDER_REVIEW_STAFF, workspaceId)
                    : documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_STAFF);
        } else {
            docs = documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_STAFF);
        }
        List<ReviewQueueItemResponse> queue = new ArrayList<>();

        for (Document doc : docs) {
            queue.add(buildQueueItem(doc, null));
        }

        log.info("Lấy hàng đợi Staff: Tìm thấy {} tài liệu chờ rà soát.", queue.size());
        return queue;
    }

    @Override
    @Transactional
    public ReviewActionResponse handleStaffAction(Long id, StaffActionRequest request, Long actorId, String actorRole, String actorEmail) {
        Document document = resolveDocument(id);

        DocumentStatus currentStatus = document.getStatus() != null ? document.getStatus() : DocumentStatus.UNDER_REVIEW_STAFF;

        // 1. Chuẩn hóa quyết định của Staff (APPROVE -> xét chính sách 1 cấp hay 2 cấp, REJECT -> REJECTED)
        String rawAction = extractAction(request != null ? request.getAction() : null, request != null ? request.getDecision() : null);
        String actionNormalized = rawAction.trim().toUpperCase();

        DocumentStatus targetStatus;
        boolean isOneTier = false;
        if (actionNormalized.contains("REJECT") || actionNormalized.contains("TU_CHOI") || actionNormalized.contains("DECLINE")) {
            targetStatus = DocumentStatus.REJECTED;
        } else {
            String docType = resolveDocType(document);
            int tiers = getApprovalTiersForDocType(document, docType);
            if (tiers == 1) {
                targetStatus = DocumentStatus.PUBLISHED;
                isOneTier = true;
            } else {
                targetStatus = DocumentStatus.UNDER_REVIEW_MANAGER;
            }
        }

        // Vai trò từ JWT thắng role gửi trong body.
        String effectiveRole = (actorRole != null && !actorRole.isBlank())
                ? actorRole.trim().toUpperCase()
                : (request != null && request.getActorRole() != null && !request.getActorRole().isBlank()
                        ? request.getActorRole().trim().toUpperCase()
                        : "STAFF");

        DocumentStatus nextStatus = DocumentStateMachine.transition(currentStatus, targetStatus, effectiveRole);

        // 3. Cập nhật trạng thái Document
        document.setStatus(nextStatus);
        document.setUpdatedAt(Instant.now());
        Document savedDoc = documentRepositoryPort.save(document);

        // 4. Chuẩn hóa ghi chú và lưu bản ghi vào bảng reviews
        String defaultStaffComment = (targetStatus == DocumentStatus.PUBLISHED)
                ? "Staff đã đối chiếu mã nguồn và phê duyệt xuất bản trực tiếp theo chính sách 1 cấp."
                : (targetStatus == DocumentStatus.UNDER_REVIEW_MANAGER
                        ? "Staff đã đối chiếu mã nguồn và phê duyệt chuyển sang Manager."
                        : "Staff yêu cầu chỉnh sửa lại tài liệu.");
        String comment = extractComment(
                request != null ? request.getComment() : null,
                request != null ? request.getNote() : null,
                defaultStaffComment
        );
        String sectionBlock = formatSectionComments(request);
        if (!sectionBlock.isEmpty()) {
            comment = comment + "\n" + sectionBlock;
        }

        DocumentVersion latestVersion = documentVersionRepositoryPort.findLatestByDocId(savedDoc.getDocId()).orElse(null);
        String reviewerIdentity = (actorEmail != null && !actorEmail.isBlank())
                ? actorEmail
                : ("STAFF".equalsIgnoreCase(effectiveRole) ? "staff@livingdocs.internal" : effectiveRole);

        String staffResult = (targetStatus == DocumentStatus.UNDER_REVIEW_MANAGER || targetStatus == DocumentStatus.PUBLISHED)
                ? "APPROVED" : "REJECTED";
        Optional<Review> pendingOpt = reviewRepositoryPort.findFirstByDocIdAndResultOrderByCreatedAtDesc(savedDoc.getDocId(), "PENDING");
        Review reviewRecord;
        if (pendingOpt != null && pendingOpt.isPresent()) {
            reviewRecord = pendingOpt.get();
            reviewRecord.setVersionId(latestVersion != null ? latestVersion.getVersionId() : reviewRecord.getVersionId());
            reviewRecord.setReviewer(reviewerIdentity);
            reviewRecord.setGeneralComment(comment);
            reviewRecord.setResult(staffResult);
            reviewRecord.setCreatedAt(Instant.now());
        } else {
            reviewRecord = Review.builder()
                    .docId(savedDoc.getDocId())
                    .versionId(latestVersion != null ? latestVersion.getVersionId() : null)
                    .reviewer(reviewerIdentity)
                    .generalComment(comment)
                    .result(staffResult)
                    .createdAt(Instant.now())
                    .build();
        }
        Review savedReview = reviewRepositoryPort.save(reviewRecord);
        saveSectionComments(savedReview.getReviewId(), savedDoc.getDocId(), request, effectiveRole, reviewerIdentity);

        // 5. Ghi nhận Audit Log
        if (auditServicePort != null) {
            AuditAction action = (nextStatus == DocumentStatus.REJECTED) ? AuditAction.DOCUMENT_REJECTED
                    : (nextStatus == DocumentStatus.PUBLISHED ? AuditAction.DOCUMENT_PUBLISHED : AuditAction.DOCUMENT_STAFF_REVIEWED);
            String detailMsg = (nextStatus == DocumentStatus.REJECTED)
                    ? "Staff đã từ chối tài liệu. Lý do: " + (comment.isEmpty() ? "Không có lý do chi tiết" : comment)
                    : (nextStatus == DocumentStatus.PUBLISHED
                            ? "Staff đã phê duyệt xuất bản trực tiếp theo chính sách 1 cấp (PUBLISHED). Nhận xét: " + (comment.isEmpty() ? "Đạt chuẩn." : comment)
                            : "Staff đã phê duyệt tài liệu và chuyển Manager duyệt cấp 2. Nhận xét: " + (comment.isEmpty() ? "Tài liệu đạt chuẩn chất lượng." : comment));
            if (nextStatus == DocumentStatus.PUBLISHED) {
                auditServicePort.recordDocumentApproval(actorId, savedDoc.getDocId());
            }
            auditServicePort.recordDocumentAction(actorId, savedDoc.getDocId(), action, detailMsg);
        }

        // 5.1 Ghi nhận Changelog
        if (changelogServicePort != null) {
            String summary = (nextStatus == DocumentStatus.REJECTED)
                    ? "Staff đã từ chối tài liệu. Lý do: " + (comment.isEmpty() ? "Không có lý do chi tiết" : comment)
                    : (nextStatus == DocumentStatus.PUBLISHED
                            ? "Staff đã phê duyệt xuất bản trực tiếp theo chính sách 1 cấp (PUBLISHED). " + (comment.isEmpty() ? "" : "Ghi chú: " + comment)
                            : "Staff đã phê duyệt tài liệu cấp 1 (chuyển sang Manager). " + (comment.isEmpty() ? "" : "Ghi chú: " + comment));
            changelogServicePort.logChange(
                    savedDoc.getDocId(),
                    latestVersion != null ? latestVersion.getVersionId() : null,
                    actorId,
                    effectiveRole,
                    summary.trim()
            );
        }

        // Tự động mở khóa PR Checks trên GitHub nếu tài liệu xuất bản trực tiếp
        if (nextStatus == DocumentStatus.PUBLISHED) {
            if (webhookDispatcher != null) {
                webhookDispatcher.dispatchDocumentPublished(savedDoc.getDocId(), savedDoc.getTitle(), actorId, null);
            }
            try {
                if (prMergeBlockingService != null) {
                    prMergeBlockingService.notifyDocumentApproved(savedDoc.getDocId());
                }
            } catch (Exception ex) {
                log.warn("[ReviewServiceImpl] Lỗi mở khóa Checks API cho PR sau khi xuất bản tài liệu #{}: {}",
                        savedDoc.getDocId(), ex.getMessage());
            }
        }

        log.info("Xử lý Staff Action: Actor {} (vai trò: {}) đã xử lý tài liệu ID: {} -> Trạng thái mới: {}, Review ID: {}",
                actorId, effectiveRole, savedDoc.getDocId(), nextStatus, savedReview.getReviewId());

        String message = (nextStatus == DocumentStatus.PUBLISHED)
                ? String.format("Staff đã duyệt tài liệu \"%s\" thành công và xuất bản trực tiếp theo chính sách phê duyệt 1 cấp (PUBLISHED).", savedDoc.getTitle())
                : (nextStatus == DocumentStatus.UNDER_REVIEW_MANAGER
                        ? String.format("Staff đã duyệt tài liệu \"%s\" thành công và chuyển sang Manager (UNDER_REVIEW_MANAGER).", savedDoc.getTitle())
                        : String.format("Staff đã từ chối tài liệu \"%s\" và chuyển sang trạng thái REJECTED.", savedDoc.getTitle()));

        return ReviewActionResponse.builder()
                .id(savedDoc.getDocId())
                .docId(savedDoc.getDocId())
                .reviewId(savedReview.getReviewId())
                .title(savedDoc.getTitle())
                .status(savedDoc.getStatus())
                .currentVersion(savedDoc.getCurrentVersion())
                .action(actionNormalized)
                .reviewer(reviewerIdentity)
                .comment(comment)
                .message(message)
                .document(toDocumentResponse(savedDoc, latestVersion))
                .timestamp(Instant.now())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewQueueItemResponse> getManagerQueue() {
        List<Document> docs;
        if (tenantAccessService != null) {
            TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return List.of();
            }
            Long workspaceId = tenantAccessService.resolveReadWorkspaceId(null);
            docs = workspaceId != null
                    ? documentRepositoryPort.findByStatusAndWorkspaceId(DocumentStatus.UNDER_REVIEW_MANAGER, workspaceId)
                    : documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_MANAGER);
        } else {
            docs = documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_MANAGER);
        }
        List<ReviewQueueItemResponse> queue = new ArrayList<>();

        for (Document doc : docs) {
            Optional<Review> latestStaffReview = reviewRepositoryPort.findLatestByDocId(doc.getDocId());
            queue.add(buildQueueItem(doc, latestStaffReview.orElse(null)));
        }

        log.info("Lấy hàng đợi Manager: Tìm thấy {} tài liệu chờ phê duyệt cuối cùng.", queue.size());
        return queue;
    }

    @Override
    @Transactional
    public ReviewActionResponse handleManagerAction(Long id, ManagerActionRequest request, Long actorId, String actorRole, String actorEmail) {
        Document document = resolveDocument(id);

        DocumentStatus currentStatus = document.getStatus() != null ? document.getStatus() : DocumentStatus.UNDER_REVIEW_MANAGER;

        // 1. PUBLISH/APPROVE -> PUBLISHED. RETURN_STAFF/REQUEST_CHANGES -> yêu cầu sửa.
        // REJECT/RETURN giữ REJECTED (tương thích hành động RETURN đã có).
        String rawAction = extractAction(request != null ? request.getAction() : null, request != null ? request.getDecision() : null);
        String actionNormalized = rawAction.trim().toUpperCase();
        DocumentStatus targetStatus = resolveManagerTarget(actionNormalized);

        // Vai trò từ JWT (tham số actorRole) thắng role gửi trong body.
        String effectiveRole = (actorRole != null && !actorRole.isBlank())
                ? actorRole.trim().toUpperCase()
                : (request != null && request.getActorRole() != null && !request.getActorRole().isBlank()
                        ? request.getActorRole().trim().toUpperCase()
                        : "MANAGER");

        DocumentStatus nextStatus = DocumentStateMachine.transition(currentStatus, targetStatus, effectiveRole);

        // Kiểm tra xem có ủy quyền phê duyệt (Manager Delegation) đang hiệu lực không
        ManagerDelegationDto matchedDelegation = findActiveDelegation(document, actorEmail, actorId, request);
        String delegationMsg = null;
        if (matchedDelegation != null) {
            String delegatorLabel = (matchedDelegation.getDelegatorName() != null && !matchedDelegation.getDelegatorName().isBlank())
                    ? matchedDelegation.getDelegatorName() : "Quản lý A";
            String delegateeLabel = (matchedDelegation.getDelegateeName() != null && !matchedDelegation.getDelegateeName().isBlank())
                    ? matchedDelegation.getDelegateeName() : (actorEmail != null ? actorEmail : "Quản lý B");
            delegationMsg = String.format("%s phê duyệt thay cho %s theo ủy quyền", delegateeLabel, delegatorLabel);
            log.info("[Manager Delegation Active] {}", delegationMsg);
        }

        // 3. Cập nhật trạng thái Document
        document.setStatus(nextStatus);
        document.setUpdatedAt(Instant.now());
        Document savedDoc = documentRepositoryPort.save(document);

        boolean commitRequested = request != null && Boolean.TRUE.equals(request.getCommitToGithub());
        String commitSha = null;
        if (nextStatus == DocumentStatus.PUBLISHED && commitRequested) {
            if (documentServicePort == null) {
                throw new IllegalArgumentException("Không đẩy được file .md lên GitHub.");
            }
            String approver = (actorEmail != null && !actorEmail.isBlank()) ? actorEmail : effectiveRole;
            commitSha = documentServicePort.commitMarkdownToDefaultBranch(savedDoc.getDocId(), actorId, approver);
        }

        // 4. Trích xuất ghi chú/lý do trước khi ghi Audit Log & Changelog
        String rawComment = extractComment(
                request != null ? request.getComment() : null,
                request != null ? request.getNote() : null,
                targetStatus == DocumentStatus.PUBLISHED
                        ? "Manager phê duyệt xuất bản tài liệu chính thức lên hệ thống."
                        : "Manager trả về yêu cầu chỉnh sửa lại nội dung."
        );
        String reasonSuffix = !rawComment.isBlank() ? rawComment : "Cần rà soát và hiệu chỉnh lại.";

        // Ghi nhận Audit Log
        if (auditServicePort != null) {
            if (nextStatus == DocumentStatus.PUBLISHED) {
                String publishedDetail = "Manager phê duyệt xuất bản tài liệu chính thức lên hệ thống (PUBLISHED)."
                        + (commitSha != null ? " Commit SHA: " + commitSha + "." : " Không đẩy file lên GitHub.");
                if (delegationMsg != null) {
                    publishedDetail = publishedDetail + " [" + delegationMsg + "]";
                }
                auditServicePort.recordDocumentApproval(actorId, savedDoc.getDocId());
                auditServicePort.recordDocumentAction(actorId, savedDoc.getDocId(), AuditAction.DOCUMENT_PUBLISHED,
                        publishedDetail);

                if (delegationMsg != null) {
                    auditServicePort.recordDocumentAction(actorId, savedDoc.getDocId(), AuditAction.DOCUMENT_APPROVED, delegationMsg);
                }
            } else if (nextStatus == DocumentStatus.UNDER_REVIEW_STAFF) {
                String returnDetail = "Manager yêu cầu sửa đổi (trả lại Staff). Lý do: " + reasonSuffix
                        + (delegationMsg != null ? " [" + delegationMsg + "]" : "");
                auditServicePort.recordDocumentAction(actorId, savedDoc.getDocId(), AuditAction.DOCUMENT_RETURNED_STAFF, returnDetail);
            } else {
                String rejectDetail = "Manager đã từ chối tài liệu. Lý do: "
                        + (!rawComment.isBlank() ? rawComment : "Tài liệu không đạt chuẩn xuất bản.")
                        + (delegationMsg != null ? " [" + delegationMsg + "]" : "");
                auditServicePort.recordDocumentAction(actorId, savedDoc.getDocId(), AuditAction.DOCUMENT_REJECTED, rejectDetail);
            }
        }

        // 4.1 Ghi nhận Changelog
        if (changelogServicePort != null) {
            String managerSummary = (nextStatus == DocumentStatus.PUBLISHED)
                    ? "Manager phê duyệt xuất bản tài liệu chính thức lên hệ thống (PUBLISHED)."
                    : (nextStatus == DocumentStatus.UNDER_REVIEW_STAFF
                            ? "Manager yêu cầu sửa đổi (trả lại Staff). Lý do: " + reasonSuffix
                            : "Manager đã từ chối tài liệu. Lý do: " + (!rawComment.isBlank() ? rawComment : "Không đạt chuẩn xuất bản."));
            if (delegationMsg != null && !delegationMsg.isBlank()) {
                managerSummary = managerSummary + " [" + delegationMsg + "]";
            }
            DocumentVersion latestVer = documentVersionRepositoryPort.findLatestByDocId(savedDoc.getDocId()).orElse(null);
            changelogServicePort.logChange(
                    savedDoc.getDocId(),
                    latestVer != null ? latestVer.getVersionId() : null,
                    actorId,
                    effectiveRole,
                    managerSummary.trim()
            );
        }

        // Tự động mở khóa PR Checks trên GitHub (chuyển sang màu xanh hợp lệ) khi tài liệu được phê duyệt
        if (nextStatus == DocumentStatus.PUBLISHED && webhookDispatcher != null) {
            webhookDispatcher.dispatchDocumentPublished(savedDoc.getDocId(), savedDoc.getTitle(), actorId, commitSha);
        }
        if (nextStatus == DocumentStatus.PUBLISHED || nextStatus == DocumentStatus.APPROVED) {
            try {
                if (prMergeBlockingService != null) {
                    prMergeBlockingService.notifyDocumentApproved(savedDoc.getDocId());
                }
            } catch (Exception ex) {
                log.warn("[ReviewServiceImpl] Lỗi mở khóa Checks API cho PR sau khi phê duyệt tài liệu #{}: {}",
                        savedDoc.getDocId(), ex.getMessage());
            }
        }

        // 5. Chuẩn hóa ghi chú và lưu bản ghi vào bảng reviews
        String comment = rawComment;
        if (delegationMsg != null) {
            comment = comment + "\n[" + delegationMsg + "]";
        }

        DocumentVersion latestVersion = documentVersionRepositoryPort.findLatestByDocId(savedDoc.getDocId()).orElse(null);
        String reviewerIdentity = (actorEmail != null && !actorEmail.isBlank())
                ? actorEmail
                : ("MANAGER".equalsIgnoreCase(effectiveRole) ? "manager@livingdocs.internal" : effectiveRole);

        Review reviewRecord = Review.builder()
                .docId(savedDoc.getDocId())
                .versionId(latestVersion != null ? latestVersion.getVersionId() : null)
                .reviewer(reviewerIdentity)
                .generalComment(comment)
                .result(reviewResult(targetStatus))
                .createdAt(Instant.now())
                .build();
        Review savedReview = reviewRepositoryPort.save(reviewRecord);

        log.info("Xử lý Manager Action: Manager {} (vai trò: {}) đã phê duyệt tài liệu ID: {} -> Trạng thái mới: {}, Review ID: {}",
                actorId, effectiveRole, savedDoc.getDocId(), nextStatus, savedReview.getReviewId());

        String message = managerResultMessage(nextStatus, savedDoc.getTitle(), commitSha);
        if (delegationMsg != null) {
            message = message + " (" + delegationMsg + ")";
        }

        return ReviewActionResponse.builder()
                .id(savedDoc.getDocId())
                .docId(savedDoc.getDocId())
                .reviewId(savedReview.getReviewId())
                .title(savedDoc.getTitle())
                .status(savedDoc.getStatus())
                .currentVersion(savedDoc.getCurrentVersion())
                .action(actionNormalized)
                .reviewer(reviewerIdentity)
                .comment(comment)
                .message(message)
                .document(toDocumentResponse(savedDoc, latestVersion))
                .timestamp(Instant.now())
                .commitSha(commitSha)
                .build();
    }

    private DocumentStatus resolveManagerTarget(String actionNormalized) {
        if (actionNormalized.contains("REQUEST_CHANGE") || actionNormalized.contains("RETURN_STAFF")) {
            return DocumentStatus.UNDER_REVIEW_STAFF;
        }
        if (actionNormalized.contains("REJECT") || actionNormalized.contains("RETURN")
                || actionNormalized.contains("TRA_VE") || actionNormalized.contains("TU_CHOI")) {
            return DocumentStatus.REJECTED;
        }
        return DocumentStatus.PUBLISHED;
    }

    private String reviewResult(DocumentStatus targetStatus) {
        if (targetStatus == DocumentStatus.PUBLISHED) {
            return "PUBLISHED";
        }
        if (targetStatus == DocumentStatus.UNDER_REVIEW_STAFF) {
            return "CHANGES_REQUESTED";
        }
        return "REJECTED";
    }

    private String managerResultMessage(DocumentStatus nextStatus, String title, String commitSha) {
        if (nextStatus == DocumentStatus.PUBLISHED) {
            if (commitSha != null) {
                return String.format(
                        "Manager đã phê duyệt xuất bản tài liệu \"%s\" (PUBLISHED) và đẩy file .md lên GitHub. Commit: %s.",
                        title, commitSha);
            }
            return String.format(
                    "Manager đã phê duyệt xuất bản tài liệu \"%s\" (PUBLISHED). Không đẩy file lên GitHub.",
                    title);
        }
        if (nextStatus == DocumentStatus.UNDER_REVIEW_STAFF) {
            return String.format("Manager yêu cầu sửa đổi tài liệu \"%s\" và trả về Staff.", title);
        }
        return String.format("Manager đã từ chối tài liệu \"%s\" (REJECTED).", title);
    }

    private Document resolveDocument(Long id) {
        if (id == null) {
            throw new DocumentNotFoundException(0L);
        }
        // Thử tìm theo Document ID
        Optional<Document> docOpt = documentRepositoryPort.findById(id);
        if (docOpt.isPresent()) {
            Document doc = docOpt.get();
            if (tenantAccessService != null) {
                tenantAccessService.requireDocumentAccess(doc.getDocId());
            }
            return doc;
        }

        // Nếu không thấy, thử tìm xem ID có phải là Review ID
        Optional<Review> reviewOpt = reviewRepositoryPort.findById(id);
        if (reviewOpt.isPresent() && reviewOpt.get().getDocId() != null) {
            Document doc = documentRepositoryPort.findById(reviewOpt.get().getDocId())
                    .orElseThrow(() -> new DocumentNotFoundException(id));
            if (tenantAccessService != null) {
                tenantAccessService.requireDocumentAccess(doc.getDocId());
            }
            return doc;
        }

        throw new DocumentNotFoundException(id);
    }

    private ReviewQueueItemResponse buildQueueItem(Document doc, Review staffReview) {
        // Thông tin Kho lưu trữ (Repository)
        ReviewQueueItemResponse.RepoInfo repoInfo = null;
        String repoName = null;
        String repoFullName = null;
        String defaultBranch = "main";

        if (doc.getRepoId() != null) {
            Optional<RepositoryEntity> repoOpt = repositoryRepository.findById(doc.getRepoId());
            if (repoOpt.isPresent()) {
                RepositoryEntity r = repoOpt.get();
                repoName = r.getRepoName();
                repoFullName = r.getRepoFullName();
                defaultBranch = r.getDefaultBranch();
                repoInfo = ReviewQueueItemResponse.RepoInfo.builder()
                        .repoId(r.getRepositoryId())
                        .repoName(repoName)
                        .repoFullName(repoFullName)
                        .defaultBranch(defaultBranch)
                        .build();
            }
        }

        // Thông tin Phiên bản và Tác giả
        List<DocumentVersion> versions = documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(doc.getDocId());
        DocumentVersion firstVersion = versions.isEmpty() ? null : versions.get(0);
        DocumentVersion latestVersion = versions.isEmpty() ? null : versions.get(versions.size() - 1);

        ReviewQueueItemResponse.AuthorInfo authorInfo = resolveAuthor(firstVersion);
        DocumentVersionResponse latestVersionDto = latestVersion != null ? toVersionResponse(latestVersion) : null;
        String latestContent = latestVersion != null ? latestVersion.getContent() : "";
        TemplateValidationResult structure = templateStructureCheck == null
                ? TemplateValidationResult.passed(doc.getTemplateId())
                : templateStructureCheck.check(doc.getTemplateId(), latestContent);
        String docType = resolveDocType(doc);

        return ReviewQueueItemResponse.builder()
                .id(doc.getDocId())
                .docId(doc.getDocId())
                .title(doc.getTitle())
                .targetPath(doc.getTargetPath())
                .status(doc.getStatus())
                .currentVersion(doc.getCurrentVersion())
                .createdAt(doc.getCreatedAt())
                .updatedAt(doc.getUpdatedAt())
                .repoId(doc.getRepoId())
                .repoName(repoName)
                .repoFullName(repoFullName)
                .defaultBranch(defaultBranch)
                .repo(repoInfo)
                .authorName(authorInfo.getName())
                .authorEmail(authorInfo.getEmail())
                .authorRole(authorInfo.getRole())
                .author(authorInfo)
                .latestContent(latestContent)
                .latestVersion(latestVersionDto)
                .staffComment(staffReview != null ? staffReview.getGeneralComment() : null)
                .staffReviewer(staffReview != null ? staffReview.getReviewer() : null)
                .staffReviewedAt(staffReview != null ? staffReview.getCreatedAt() : null)
                .structureWarning(structure.isWarning())
                .missingHeadings(structure.getMissingHeadings())
                .aiGenerated(isAiGenerated(latestVersion))
                .docType(docType)
                .approvalTiers(getApprovalTiersForDocType(doc, docType))
                .build();
    }

    private ReviewQueueItemResponse.AuthorInfo resolveAuthor(DocumentVersion firstVersion) {
        if (firstVersion == null) {
            return ReviewQueueItemResponse.AuthorInfo.builder()
                    .name("Pham Lead Developer")
                    .email("developer@livingdocs.internal")
                    .role("DEVELOPER")
                    .build();
        }

        ActorRole role = firstVersion.getActorRole();
        if (role == null) {
            return ReviewQueueItemResponse.AuthorInfo.builder()
                    .name("Pham Lead Developer")
                    .email("developer@livingdocs.internal")
                    .role("DEVELOPER")
                    .build();
        }

        return switch (role) {
            case AI -> ReviewQueueItemResponse.AuthorInfo.builder()
                    .name("LivingDocs AI Assistant")
                    .email("ai@livingdocs.internal")
                    .role("AI")
                    .build();
            case STAFF -> ReviewQueueItemResponse.AuthorInfo.builder()
                    .name("Le Staff Reviewer")
                    .email("staff@livingdocs.internal")
                    .role("STAFF")
                    .build();
            case MANAGER -> ReviewQueueItemResponse.AuthorInfo.builder()
                    .name("Tran Project Manager")
                    .email("manager@livingdocs.internal")
                    .role("MANAGER")
                    .build();
            default -> ReviewQueueItemResponse.AuthorInfo.builder()
                    .name("Pham Lead Developer")
                    .email("developer@livingdocs.internal")
                    .role("DEVELOPER")
                    .build();
        };
    }

    private boolean isAiGenerated(DocumentVersion version) {
        if (version == null) {
            return false;
        }
        if (version.getActorRole() == ActorRole.AI) {
            return true;
        }
        String trigger = version.getTriggerType() == null ? "" : version.getTriggerType().toUpperCase();
        return trigger.contains("AI") || trigger.contains("DRIFT") || trigger.contains("AUTO");
    }

    private String formatSectionComments(StaffActionRequest request) {
        if (request == null || request.getSectionComments() == null) {
            return "";
        }
        StringBuilder block = new StringBuilder();
        for (StaffActionRequest.SectionComment item : request.getSectionComments()) {
            if (item == null || item.getDetailedComment() == null || item.getDetailedComment().isBlank()) {
                continue;
            }
            String heading = item.getTextSegment() == null || item.getTextSegment().isBlank()
                    ? "Mục"
                    : item.getTextSegment().trim();
            if (block.length() > 0) {
                block.append('\n');
            }
            block.append("- [").append(heading).append("] ").append(item.getDetailedComment().trim());
        }
        return block.toString();
    }

    private void saveSectionComments(Long reviewId, StaffActionRequest request) {
        saveSectionComments(reviewId, null, request, "STAFF", "staff@livingdocs.internal");
    }

    private void saveSectionComments(Long reviewId, Long docId, StaffActionRequest request, String authorRole, String authorEmail) {
        if (reviewCommentRepository == null || request == null || request.getSectionComments() == null) {
            return;
        }
        for (StaffActionRequest.SectionComment item : request.getSectionComments()) {
            if (item == null || item.getDetailedComment() == null || item.getDetailedComment().isBlank()) {
                continue;
            }
            String segment = item.getTextSegment() == null ? "" : item.getTextSegment().trim();
            if (segment.length() > 255) {
                segment = segment.substring(0, 255);
            }
            reviewCommentRepository.save(ReviewCommentEntity.builder()
                    .reviewId(reviewId)
                    .docId(docId)
                    .textSegment(segment)
                    .detailedComment(item.getDetailedComment().trim())
                    .status("OPEN")
                    .authorRole(authorRole != null ? authorRole : "STAFF")
                    .authorEmail(authorEmail)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build());
        }
    }

    private String extractAction(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback;
        }
        return "APPROVE";
    }

    private String extractComment(String primary, String fallback, String defaultVal) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        if (fallback != null && !fallback.isBlank()) {
            return fallback;
        }
        return defaultVal;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewHistoryItemResponse> getReviewHistory() {
        List<Review> reviews;
        if (tenantAccessService != null) {
            TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return List.of();
            }
            Long workspaceId = tenantAccessService.resolveReadWorkspaceId(null);
            reviews = workspaceId != null
                    ? reviewRepositoryPort.findByWorkspaceId(workspaceId)
                    : reviewRepositoryPort.findAll();
        } else {
            reviews = reviewRepositoryPort.findAll();
        }
        List<ReviewHistoryItemResponse> list = new ArrayList<>();

        for (Review r : reviews) {
            String title = "Tài liệu #" + r.getDocId();
            String repoName = "—";

            if (r.getDocId() != null) {
                var docOpt = documentRepositoryPort.findById(r.getDocId());
                if (docOpt.isPresent()) {
                    var doc = docOpt.get();
                    if (doc.getTitle() != null && !doc.getTitle().isBlank()) {
                        title = doc.getTitle();
                    }
                    if (doc.getRepoId() != null) {
                        var repoOpt = repositoryRepository.findById(doc.getRepoId());
                        if (repoOpt.isPresent() && repoOpt.get().getRepoFullName() != null) {
                            repoName = repoOpt.get().getRepoFullName();
                        } else if (repoOpt.isPresent() && repoOpt.get().getRepoName() != null) {
                            repoName = repoOpt.get().getRepoName();
                        }
                    }
                }
            }

            String rawResult = r.getResult() != null ? r.getResult().toUpperCase() : "PENDING";
            String action = "approved";
            if (rawResult.contains("REJECT") || rawResult.contains("DECLINE")) {
                action = "rejected";
            } else if (rawResult.contains("RETURN") || rawResult.contains("CHANGE")) {
                action = "returned";
            } else if (rawResult.contains("PENDING")) {
                action = "pending";
            }

            list.add(ReviewHistoryItemResponse.builder()
                    .id(r.getReviewId())
                    .docId(r.getDocId())
                    .versionId(r.getVersionId())
                    .title(title)
                    .repo(repoName)
                    .reviewer(r.getReviewer() != null ? r.getReviewer() : "staff")
                    .action(action)
                    .result(rawResult)
                    .note(r.getGeneralComment() != null ? r.getGeneralComment() : "")
                    .reviewedAt(r.getCreatedAt())
                    .build());
        }

        return list;
    }

    private DocumentVersionResponse toVersionResponse(DocumentVersion v) {
        return DocumentVersionResponse.builder()
                .versionId(v.getVersionId())
                .docId(v.getDocId())
                .versionNum(v.getVersionNum())
                .content(v.getContent())
                .actorRole(v.getActorRole() != null ? v.getActorRole().name() : null)
                .triggerType(v.getTriggerType())
                .hash(v.getHash())
                .prevHash(v.getPrevHash())
                .createdAt(v.getCreatedAt())
                .commitHash(v.getCommitHash())
                .commitUrl(v.getCommitUrl())
                .build();
    }

    private DocumentResponse toDocumentResponse(Document doc, DocumentVersion version) {
        return DocumentResponse.builder()
                .docId(doc.getDocId())
                .collectionId(doc.getCollectionId())
                .repoId(doc.getRepoId())
                .title(doc.getTitle())
                .targetPath(doc.getTargetPath())
                .status(doc.getStatus())
                .currentVersion(doc.getCurrentVersion())
                .latestVersion(version != null ? toVersionResponse(version) : null)
                .createdAt(doc.getCreatedAt())
                .updatedAt(doc.getUpdatedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ApprovalPolicyDto> getApprovalPolicies() {
        if (tenantAccessService != null) {
            TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return List.of();
            }
            Long workspaceId = tenantAccessService.resolveReadWorkspaceId(null);
            return getApprovalPoliciesForWorkspace(workspaceId != null ? workspaceId : TenantAccessService.DEFAULT_WORKSPACE_ID);
        }
        return getApprovalPoliciesForWorkspace(TenantAccessService.DEFAULT_WORKSPACE_ID);
    }

    private List<ApprovalPolicyDto> getApprovalPoliciesForWorkspace(Long workspaceId) {
        Long effectiveWorkspaceId = workspaceId != null ? workspaceId : TenantAccessService.DEFAULT_WORKSPACE_ID;
        if (managerApprovalPolicyRepository != null) {
            try {
                List<ManagerApprovalPolicyEntity> entities = managerApprovalPolicyRepository.findByWorkspaceId(effectiveWorkspaceId);
                if (entities != null && !entities.isEmpty()) {
                    List<ApprovalPolicyDto> list = new ArrayList<>();
                    for (ManagerApprovalPolicyEntity e : entities) {
                        list.add(ApprovalPolicyDto.builder()
                                .docType(e.getDocumentType())
                                .tiers(e.getTiers() != null ? e.getTiers() : (Boolean.TRUE.equals(e.getApprovalRequired()) ? 2 : 1))
                                .description(e.getDescription())
                                .updatedAt(e.getUpdatedAt() != null ? e.getUpdatedAt().toString() : Instant.now().toString())
                                .updatedBy(e.getUpdatedByEmail() != null ? e.getUpdatedByEmail() : (e.getUpdatedBy() != null ? String.valueOf(e.getUpdatedBy()) : "SYSTEM"))
                                .build());
                    }
                    return list;
                }
            } catch (Exception ex) {
                log.debug("[ReviewServiceImpl] Lỗi đọc từ managerApprovalPolicyRepository cho workspace {}: {}", effectiveWorkspaceId, ex.getMessage());
            }
        }
        return defaultApprovalPolicies();
    }

    @Override
    @Transactional
    public List<ApprovalPolicyDto> updateApprovalPolicies(List<ApprovalPolicyDto> policies, Long actorId, String actorEmail) {
        Long workspaceId = tenantAccessService != null
                ? tenantAccessService.resolveWriteWorkspaceId(null)
                : TenantAccessService.DEFAULT_WORKSPACE_ID;
        if (policies == null || policies.isEmpty()) {
            policies = defaultApprovalPolicies();
        }
        Instant now = Instant.now();
        String updater = actorEmail != null && !actorEmail.isBlank() ? actorEmail : (actorId != null ? String.valueOf(actorId) : "ADMIN");
        for (ApprovalPolicyDto p : policies) {
            p.setUpdatedAt(now.toString());
            p.setUpdatedBy(updater);
            if (p.getTiers() == null || (p.getTiers() != 1 && p.getTiers() != 2)) {
                p.setTiers(2);
            }
        }

        // Lưu trực tiếp vào bảng quan hệ manager_approval_policies theo từng workspace (không dual-write global admin_settings)
        if (managerApprovalPolicyRepository != null) {
            for (ApprovalPolicyDto p : policies) {
                String dt = normalizeDocType(p.getDocType());
                int tiers = p.getTiers() != null && p.getTiers() == 1 ? 1 : 2;
                ManagerApprovalPolicyEntity entity = managerApprovalPolicyRepository
                        .findByWorkspaceIdAndDocumentType(workspaceId, dt)
                        .orElseGet(() -> ManagerApprovalPolicyEntity.builder()
                                .workspaceId(workspaceId)
                                .documentType(dt)
                                .build());
                entity.setTiers(tiers);
                entity.setApprovalRequired(tiers > 1);
                entity.setDescription(p.getDescription());
                entity.setUpdatedBy(actorId);
                entity.setUpdatedByEmail(updater);
                entity.setUpdatedAt(now);
                managerApprovalPolicyRepository.save(entity);
            }
            log.info("[ReviewServiceImpl] Đã cập nhật {} chính sách phê duyệt cho workspace {} bởi {}", policies.size(), workspaceId, updater);
        }
        return policies;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManagerDelegationDto> getManagerDelegations() {
        if (tenantAccessService != null) {
            TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return List.of();
            }
            Long workspaceId = tenantAccessService.resolveReadWorkspaceId(null);
            return getManagerDelegationsForWorkspace(workspaceId);
        }
        return getManagerDelegationsForWorkspace(TenantAccessService.DEFAULT_WORKSPACE_ID);
    }

    private List<ManagerDelegationDto> getManagerDelegationsForWorkspace(Long workspaceId) {
        if (managerApprovalDelegationRepository == null) {
            return new ArrayList<>();
        }
        try {
            List<ManagerApprovalDelegationEntity> entities = workspaceId != null
                    ? managerApprovalDelegationRepository.findByWorkspaceId(workspaceId)
                    : managerApprovalDelegationRepository.findAll();
            List<ManagerDelegationDto> list = new ArrayList<>();
            if (entities != null) {
                for (ManagerApprovalDelegationEntity e : entities) {
                    list.add(ManagerDelegationDto.builder()
                            .id(String.valueOf(e.getDelegationId()))
                            .delegatorId(e.getDelegatorId() != null && e.getDelegatorId() > 0 ? e.getDelegatorId() : null)
                            .delegatorEmail(e.getDelegatorEmail())
                            .delegatorName(e.getDelegatorName())
                            .delegateeId(e.getDelegateId() != null && e.getDelegateId() > 0 ? e.getDelegateId() : null)
                            .delegateeEmail(e.getDelegateeEmail())
                            .delegateeName(e.getDelegateeName())
                            .fromDate(e.getStartsAt() != null ? e.getStartsAt().toString() : null)
                            .toDate(e.getEndsAt() != null ? e.getEndsAt().toString() : null)
                            .reason(e.getReason())
                            .active(e.getActive() != null ? e.getActive() : true)
                            .createdAt(e.getCreatedAt() != null ? e.getCreatedAt().toString() : null)
                            .build());
                }
            }
            return list;
        } catch (Exception ex) {
            log.debug("[ReviewServiceImpl] Lỗi đọc managerApprovalDelegationRepository cho workspace {}: {}", workspaceId, ex.getMessage());
            return new ArrayList<>();
        }
    }

    @Override
    @Transactional
    public ManagerDelegationDto createManagerDelegation(ManagerDelegationDto delegation, Long actorId, String actorEmail) {
        Long workspaceId = tenantAccessService != null
                ? tenantAccessService.resolveWriteWorkspaceId(null)
                : TenantAccessService.DEFAULT_WORKSPACE_ID;
        if (delegation == null) {
            throw new IllegalArgumentException("Thông tin ủy quyền không được rỗng.");
        }
        Instant now = Instant.now();
        if (delegation.getId() == null || delegation.getId().isBlank()) {
            delegation.setId("del-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (delegation.getCreatedAt() == null) {
            delegation.setCreatedAt(now.toString());
        }
        if (delegation.getActive() == null) {
            delegation.setActive(true);
        }
        if ((delegation.getDelegatorEmail() == null || delegation.getDelegatorEmail().isBlank())
                && actorEmail != null && !actorEmail.isBlank()) {
            delegation.setDelegatorEmail(actorEmail.trim());
        }

        // Resolve delegatorId & delegateeId via UserRepositoryPort when null (never default delegateId to 1L)
        if (userRepositoryPort != null) {
            if (delegation.getDelegatorEmail() != null && !delegation.getDelegatorEmail().isBlank()) {
                Optional<User> delegatorOpt = userRepositoryPort.findByEmail(delegation.getDelegatorEmail().trim());
                if (delegatorOpt != null && delegatorOpt.isPresent()) {
                    User u = delegatorOpt.get();
                    if (delegation.getDelegatorId() == null) {
                        delegation.setDelegatorId(u.getUserId());
                    }
                    if ((delegation.getDelegatorName() == null || delegation.getDelegatorName().isBlank())
                            && u.getFullName() != null && !u.getFullName().isBlank()) {
                        delegation.setDelegatorName(u.getFullName());
                    }
                }
            }
            if (delegation.getDelegateeEmail() != null && !delegation.getDelegateeEmail().isBlank()) {
                Optional<User> delegateeOpt = userRepositoryPort.findByEmail(delegation.getDelegateeEmail().trim());
                if (delegateeOpt != null && delegateeOpt.isPresent()) {
                    User u = delegateeOpt.get();
                    if (tenantAccessService != null
                            && tenantAccessService.currentScope().hasTenantFilter()
                            && !Objects.equals(u.getWorkspaceId(), workspaceId)) {
                        throw AuthenticationException.forbidden(
                                TenantAccessService.ERR_TENANT_DENIED,
                                TenantAccessService.MSG_TENANT_DENIED);
                    }
                    if (delegation.getDelegateeId() == null) {
                        delegation.setDelegateeId(u.getUserId());
                    }
                    if ((delegation.getDelegateeName() == null || delegation.getDelegateeName().isBlank())
                            && u.getFullName() != null && !u.getFullName().isBlank()) {
                        delegation.setDelegateeName(u.getFullName());
                    }
                }
            }
        }
        if (delegation.getDelegatorId() == null && actorId != null) {
            delegation.setDelegatorId(actorId);
        }
        if (delegation.getDelegatorName() == null || delegation.getDelegatorName().isBlank()) {
            delegation.setDelegatorName(delegation.getDelegatorEmail() != null && !delegation.getDelegatorEmail().isBlank()
                    ? delegation.getDelegatorEmail() : "Quản lý ủy quyền");
        }
        if (delegation.getDelegateeName() == null || delegation.getDelegateeName().isBlank()) {
            delegation.setDelegateeName(delegation.getDelegateeEmail() != null && !delegation.getDelegateeEmail().isBlank()
                    ? delegation.getDelegateeEmail() : "Quản lý nhận ủy quyền");
        }

        // Normalize blank fromDate / toDate (open-ended toDate allowed)
        if (delegation.getFromDate() != null && delegation.getFromDate().isBlank()) {
            delegation.setFromDate(null);
        }
        if (delegation.getToDate() != null && delegation.getToDate().isBlank()) {
            delegation.setToDate(null);
        }
        if (delegation.getFromDate() != null && delegation.getToDate() != null) {
            String fromClean = delegation.getFromDate().trim();
            String toClean = delegation.getToDate().trim();
            if (fromClean.length() >= 10 && toClean.length() >= 10) {
                try {
                    LocalDate fromLd = LocalDate.parse(fromClean.substring(0, 10));
                    LocalDate toLd = LocalDate.parse(toClean.substring(0, 10));
                    if (fromLd.isAfter(toLd)) {
                        throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu.");
                    }
                } catch (IllegalArgumentException ex) {
                    throw ex;
                } catch (Exception ex) {
                    if (fromClean.compareTo(toClean) > 0) {
                        throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu.");
                    }
                }
            } else if (fromClean.compareTo(toClean) > 0) {
                throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu.");
            }
        }

        // Lưu trực tiếp vào bảng quan hệ manager_approval_delegations theo workspace (không dual-write global admin_settings)
        if (managerApprovalDelegationRepository != null) {
            Instant start = parseDate(delegation.getFromDate(), true);
            Instant end = parseDate(delegation.getToDate(), false);
            ManagerApprovalDelegationEntity entity = ManagerApprovalDelegationEntity.builder()
                    .workspaceId(workspaceId)
                    .delegatorId(delegation.getDelegatorId())
                    .delegateId(delegation.getDelegateeId())
                    .delegatorName(delegation.getDelegatorName())
                    .delegatorEmail(delegation.getDelegatorEmail())
                    .delegateeName(delegation.getDelegateeName())
                    .delegateeEmail(delegation.getDelegateeEmail())
                    .active(delegation.getActive())
                    .startsAt(start)
                    .endsAt(end)
                    .reason(delegation.getReason())
                    .createdAt(now)
                    .build();
            ManagerApprovalDelegationEntity saved = managerApprovalDelegationRepository.save(entity);
            if (saved != null && saved.getDelegationId() != null) {
                delegation.setId(String.valueOf(saved.getDelegationId()));
            }
            log.info("[ReviewServiceImpl] Đã lưu ủy quyền mới cho workspace {}: {} ủy quyền cho {}",
                    workspaceId, delegation.getDelegatorName(), delegation.getDelegateeName());
        }
        return delegation;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ReviewCommentDto> getDocumentComments(Long docId, String status) {
        if (tenantAccessService != null && docId != null) {
            tenantAccessService.requireDocumentAccess(docId);
        }
        if (reviewCommentRepository == null || docId == null) {
            return new ArrayList<>();
        }
        List<ReviewCommentEntity> entities;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            entities = reviewCommentRepository.findByDocIdAndStatusOrderByCreatedAtAsc(docId, status.trim().toUpperCase());
        } else {
            entities = reviewCommentRepository.findByDocIdOrderByCreatedAtAsc(docId);
        }
        List<ReviewCommentDto> dtoList = new ArrayList<>();
        for (ReviewCommentEntity e : entities) {
            dtoList.add(toReviewCommentDto(e));
        }
        return dtoList;
    }

    @Override
    @Transactional
    public ReviewCommentDto addDocumentComment(Long docId, CreateReviewCommentRequest request, Long actorId, String actorRole, String actorEmail) {
        if (docId == null) {
            throw new IllegalArgumentException("Document ID không được để trống");
        }
        if (tenantAccessService != null) {
            tenantAccessService.requireDocumentAccess(docId);
        }
        if (request == null || request.getDetailedComment() == null || request.getDetailedComment().isBlank()) {
            throw new IllegalArgumentException("Nội dung nhận xét không được để trống");
        }
        String email = (actorEmail != null && !actorEmail.isBlank())
                ? actorEmail.trim()
                : (request.getAuthorEmail() != null && !request.getAuthorEmail().isBlank()
                        ? request.getAuthorEmail().trim()
                        : "staff@livingdocs.internal");
        String role = (actorRole != null && !actorRole.isBlank())
                ? actorRole.trim().toUpperCase()
                : (request.getAuthorRole() != null && !request.getAuthorRole().isBlank()
                        ? request.getAuthorRole().trim().toUpperCase()
                        : "STAFF");

        String segment = request.getTextSegment() != null ? request.getTextSegment().trim() : "";
        if (segment.length() > 255) {
            segment = segment.substring(0, 255);
        }

        ReviewCommentEntity entity = ReviewCommentEntity.builder()
                .docId(docId)
                .reviewId(request.getReviewId())
                .textSegment(segment)
                .detailedComment(request.getDetailedComment().trim())
                .status("OPEN")
                .authorEmail(email)
                .authorRole(role)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        ReviewCommentEntity saved = reviewCommentRepository.save(entity);
        log.info("[ReviewServiceImpl] Đã thêm comment #{} cho doc #{}, author: {}", saved.getCommentId(), docId, email);
        return toReviewCommentDto(saved);
    }

    @Override
    @Transactional
    public ReviewCommentDto updateCommentStatus(Long docId, Long commentId, UpdateReviewCommentRequest request, Long actorId, String actorRole, String actorEmail) {
        if (docId == null) {
            throw new IllegalArgumentException("Document ID không được để trống");
        }
        if (tenantAccessService != null) {
            tenantAccessService.requireDocumentAccess(docId);
        }
        if (commentId == null) {
            throw new IllegalArgumentException("Comment ID không được để trống");
        }
        ReviewCommentEntity entity = reviewCommentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy comment ID: " + commentId));
        if (entity.getDocId() == null || !entity.getDocId().equals(docId)) {
            throw new IllegalArgumentException("Nhận xét #" + commentId + " không thuộc tài liệu #" + docId);
        }
        if (request != null) {
            if (request.getStatus() != null && !request.getStatus().isBlank()) {
                String normalizedStatus = request.getStatus().trim().toUpperCase();
                if (!"OPEN".equals(normalizedStatus) && !"RESOLVED".equals(normalizedStatus)) {
                    throw new IllegalArgumentException("Trạng thái nhận xét không hợp lệ (chỉ chấp nhận OPEN hoặc RESOLVED)");
                }
                entity.setStatus(normalizedStatus);
            }
            if (request.getDetailedComment() != null && !request.getDetailedComment().isBlank()) {
                entity.setDetailedComment(request.getDetailedComment().trim());
            }
        }
        entity.setUpdatedAt(Instant.now());
        ReviewCommentEntity saved = reviewCommentRepository.save(entity);
        log.info("[ReviewServiceImpl] Đã cập nhật comment #{} (doc #{}) -> status: {}", commentId, docId, saved.getStatus());
        return toReviewCommentDto(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceManagerResponse> getWorkspaceManagers() {
        List<WorkspaceManagerResponse> result = new ArrayList<>();
        if (userRepositoryPort == null) {
            return result;
        }
        List<User> users;
        if (tenantAccessService != null) {
            TenantAccessService.TenantScope scope = tenantAccessService.currentScope();
            if (scope.unassigned()) {
                return result;
            }
            Long workspaceId = tenantAccessService.resolveReadWorkspaceId(null);
            users = workspaceId != null
                    ? userRepositoryPort.findByWorkspaceId(workspaceId)
                    : userRepositoryPort.findAll();
        } else {
            users = userRepositoryPort.findAll();
        }
        for (User u : users) {
            if (u.getStatus() != null && !"ACTIVE".equalsIgnoreCase(u.getStatus())) {
                continue;
            }
            Set<com.example.livingdocs_backend.domain.model.RoleType> roles = u.getRoles();
            if (roles != null) {
                Set<String> roleNames = new java.util.HashSet<>();
                boolean isEligible = false;
                for (com.example.livingdocs_backend.domain.model.RoleType r : roles) {
                    String name = r != null ? r.getRawName() : "";
                    roleNames.add(name);
                    if ("MANAGER".equalsIgnoreCase(name) || "ADMIN".equalsIgnoreCase(name) || "TECH_LEAD".equalsIgnoreCase(name)) {
                        isEligible = true;
                    }
                }
                if (isEligible) {
                    result.add(WorkspaceManagerResponse.builder()
                            .userId(u.getUserId())
                            .fullName(u.getFullName() != null ? u.getFullName() : u.getEmail())
                            .email(u.getEmail())
                            .roles(roleNames)
                            .build());
                }
            }
        }
        return result;
    }

    private ReviewCommentDto toReviewCommentDto(ReviewCommentEntity e) {
        return ReviewCommentDto.builder()
                .commentId(e.getCommentId())
                .reviewId(e.getReviewId())
                .docId(e.getDocId())
                .textSegment(e.getTextSegment())
                .detailedComment(e.getDetailedComment())
                .status(e.getStatus() != null ? e.getStatus() : "OPEN")
                .authorEmail(e.getAuthorEmail())
                .authorRole(e.getAuthorRole())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private Instant parseDate(String dateStr, boolean isStart) {
        if (dateStr == null || dateStr.isBlank()) {
            return isStart ? Instant.now() : null;
        }
        try {
            if (dateStr.length() >= 10) {
                LocalDate ld = LocalDate.parse(dateStr.substring(0, 10));
                return ld.atStartOfDay().toInstant(ZoneOffset.UTC);
            }
            return Instant.parse(dateStr);
        } catch (Exception e) {
            return isStart ? Instant.now() : null;
        }
    }

    private String resolveDocType(Document doc) {
        if (doc.getTemplateId() != null && docTemplateRepository != null) {
            Optional<DocTemplate> opt = docTemplateRepository.findById(doc.getTemplateId());
            if (opt.isPresent() && opt.get().getType() != null && !opt.get().getType().isBlank()) {
                return opt.get().getType().trim().toUpperCase();
            }
        }
        String path = (doc.getTargetPath() != null ? doc.getTargetPath() : "").toLowerCase();
        String title = (doc.getTitle() != null ? doc.getTitle() : "").toLowerCase();
        if (path.contains("api") || title.contains("api")) {
            return "API_REFERENCE";
        }
        if (path.contains("readme") || title.contains("readme")) {
            return "PROJECT_README";
        }
        if (path.contains("arch") || title.contains("kiến trúc") || title.contains("architecture") || path.contains("adr")) {
            return "ARCHITECTURE_ADR";
        }
        if (path.contains("guide") || path.contains("manual") || title.contains("hướng dẫn")) {
            return "MODULE_GUIDE";
        }
        if (path.contains("release") || path.contains("changelog") || title.contains("phát hành")) {
            return "MODULE_GUIDE";
        }
        if (path.contains("project") || title.contains("dự án")) {
            return "PROJECT_DOCUMENTATION";
        }
        return "DEFAULT";
    }

    private String normalizeDocType(String docType) {
        if (docType == null) return "DEFAULT";
        String dt = docType.trim().toUpperCase();
        if ("API".equals(dt)) return "API_REFERENCE";
        if ("ARCHITECTURE".equals(dt)) return "ARCHITECTURE_ADR";
        if ("USER_GUIDE".equals(dt) || "RELEASE_NOTE".equals(dt)) return "MODULE_GUIDE";
        return dt;
    }

    private Long resolveWorkspaceIdForDocument(Document doc) {
        if (doc != null && doc.getRepoId() != null && repositoryRepository != null) {
            Optional<RepositoryEntity> repoOpt = repositoryRepository.findById(doc.getRepoId());
            if (repoOpt != null && repoOpt.isPresent() && repoOpt.get().getWorkspaceId() != null) {
                return repoOpt.get().getWorkspaceId();
            }
        }
        if (tenantAccessService != null) {
            Long wsId = tenantAccessService.resolveReadWorkspaceId(null);
            if (wsId != null) {
                return wsId;
            }
        }
        return TenantAccessService.DEFAULT_WORKSPACE_ID;
    }

    private int getApprovalTiersForDocType(Document doc, String docType) {
        String normalized = normalizeDocType(docType);
        Long workspaceId = resolveWorkspaceIdForDocument(doc);
        List<ApprovalPolicyDto> policies = getApprovalPoliciesForWorkspace(workspaceId);
        for (ApprovalPolicyDto p : policies) {
            if (p.getDocType() != null) {
                String pNorm = normalizeDocType(p.getDocType());
                if (pNorm.equalsIgnoreCase(normalized) || p.getDocType().equalsIgnoreCase(docType)) {
                    return p.getTiers() != null && p.getTiers() == 1 ? 1 : 2;
                }
            }
        }
        for (ApprovalPolicyDto p : policies) {
            if ("DEFAULT".equalsIgnoreCase(p.getDocType())) {
                return p.getTiers() != null && p.getTiers() == 1 ? 1 : 2;
            }
        }
        return 2; // Default is 2 tiers
    }

    private boolean isWithinDateRange(String fromDateStr, String toDateStr, Instant now) {
        try {
            LocalDate today = LocalDate.ofInstant(now, java.time.ZoneOffset.UTC);
            if (fromDateStr != null && !fromDateStr.isBlank()) {
                String clean = fromDateStr.trim();
                LocalDate from = clean.length() >= 10 ? LocalDate.parse(clean.substring(0, 10)) : LocalDate.parse(clean);
                if (today.isBefore(from)) {
                    return false;
                }
            }
            if (toDateStr != null && !toDateStr.isBlank()) {
                String clean = toDateStr.trim();
                LocalDate to = clean.length() >= 10 ? LocalDate.parse(clean.substring(0, 10)) : LocalDate.parse(clean);
                if (today.isAfter(to)) {
                    return false;
                }
            }
            return true;
        } catch (Exception e) {
            log.warn("[Manager Delegation] Lỗi kiểm tra khoảng ngày [{}, {}]: {}", fromDateStr, toDateStr, e.getMessage());
            return false; // fail-closed when date format is invalid
        }
    }

    private ManagerDelegationDto findActiveDelegation(Document doc, String actorEmail, Long actorId, ManagerActionRequest request) {
        Long workspaceId = resolveWorkspaceIdForDocument(doc);
        List<ManagerDelegationDto> delegations = getManagerDelegationsForWorkspace(workspaceId);
        if (delegations == null || delegations.isEmpty()) {
            return null;
        }
        Instant now = Instant.now();
        for (ManagerDelegationDto d : delegations) {
            if (d.getActive() != null && !d.getActive()) {
                continue;
            }
            if (!isWithinDateRange(d.getFromDate(), d.getToDate(), now)) {
                continue;
            }
            if (isDelegatee(d, actorEmail, actorId)) {
                return d;
            }
        }
        return null;
    }

    private boolean isDelegatee(ManagerDelegationDto delegation, String actorEmail, Long actorId) {
        String delegateeEmail = delegation.getDelegateeEmail();
        boolean hasActorEmail = actorEmail != null && !actorEmail.isBlank();
        boolean hasDelegateeEmail = delegateeEmail != null && !delegateeEmail.isBlank();
        if (hasActorEmail && hasDelegateeEmail) {
            return actorEmail.trim().equalsIgnoreCase(delegateeEmail.trim());
        }
        return actorId != null && delegation.getDelegateeId() != null
                && delegation.getDelegateeId() > 0 && actorId.equals(delegation.getDelegateeId());
    }

    private List<ApprovalPolicyDto> defaultApprovalPolicies() {
        String nowStr = Instant.now().toString();
        List<ApprovalPolicyDto> list = new ArrayList<>();
        list.add(ApprovalPolicyDto.builder()
                .docType("API_REFERENCE")
                .tiers(1)
                .description("Tài liệu kỹ thuật API - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("PROJECT_README")
                .tiers(1)
                .description("Tài liệu README dự án - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("MODULE_GUIDE")
                .tiers(1)
                .description("Hướng dẫn module & sử dụng - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("ARCHITECTURE_ADR")
                .tiers(2)
                .description("Tài liệu Kiến trúc hệ thống (ADR) - Phê duyệt 2 cấp (Staff duyệt -> Manager ký duyệt)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("PROJECT_DOCUMENTATION")
                .tiers(2)
                .description("Tài liệu Dự án Tiêu chuẩn (10 Phần) - Phê duyệt 2 cấp (Staff duyệt -> Manager ký duyệt)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("DEFAULT")
                .tiers(2)
                .description("Chính sách mặc định cho các tài liệu khác - Phê duyệt 2 cấp")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        return list;
    }
}
