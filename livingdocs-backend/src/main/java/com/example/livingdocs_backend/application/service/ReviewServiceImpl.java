package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.application.port.PrMergeBlockingServicePort;
import com.example.livingdocs_backend.application.port.ReviewServicePort;
import com.example.livingdocs_backend.domain.exception.DocumentNotFoundException;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStateMachine;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.model.Review;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ReviewRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewCommentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataReviewCommentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
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

    public static final String KEY_APPROVAL_POLICIES = "approval_policies";
    public static final String KEY_MANAGER_DELEGATIONS = "manager_delegations";

    @Override
    @Transactional(readOnly = true)
    public List<ReviewQueueItemResponse> getStaffQueue() {
        List<Document> docs = documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_STAFF);
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
            int tiers = getApprovalTiersForDocType(docType);
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

        Review reviewRecord = Review.builder()
                .docId(savedDoc.getDocId())
                .versionId(latestVersion != null ? latestVersion.getVersionId() : null)
                .reviewer(reviewerIdentity)
                .generalComment(comment)
                .result((targetStatus == DocumentStatus.UNDER_REVIEW_MANAGER || targetStatus == DocumentStatus.PUBLISHED) ? "APPROVED" : "REJECTED")
                .createdAt(Instant.now())
                .build();
        Review savedReview = reviewRepositoryPort.save(reviewRecord);
        saveSectionComments(savedReview.getReviewId(), request);

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

        // Tự động mở khóa PR Checks trên GitHub nếu tài liệu xuất bản trực tiếp
        if (nextStatus == DocumentStatus.PUBLISHED) {
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
        List<Document> docs = documentRepositoryPort.findByStatus(DocumentStatus.UNDER_REVIEW_MANAGER);
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
        ManagerDelegationDto matchedDelegation = findActiveDelegation(actorEmail, actorId, request);
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

        // 4. Ghi nhận Audit Log nếu đã phê duyệt xuất bản
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
                String returnDetail = "Manager yêu cầu sửa đổi (trả lại Staff)." + (delegationMsg != null ? " [" + delegationMsg + "]" : "");
                auditServicePort.recordDocumentAction(actorId, savedDoc.getDocId(), AuditAction.DOCUMENT_RETURNED_STAFF, returnDetail);
            } else {
                String rejectDetail = "Manager đã từ chối tài liệu." + (delegationMsg != null ? " [" + delegationMsg + "]" : "");
                auditServicePort.recordDocumentAction(actorId, savedDoc.getDocId(), AuditAction.DOCUMENT_REJECTED, rejectDetail);
            }
        }

        // Tự động mở khóa PR Checks trên GitHub (chuyển sang màu xanh hợp lệ) khi tài liệu được phê duyệt
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
        String comment = extractComment(
                request != null ? request.getComment() : null,
                request != null ? request.getNote() : null,
                targetStatus == DocumentStatus.PUBLISHED
                        ? "Manager phê duyệt xuất bản tài liệu chính thức lên hệ thống."
                        : "Manager trả về yêu cầu chỉnh sửa lại nội dung."
        );
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
            return docOpt.get();
        }

        // Nếu không thấy, thử tìm xem ID có phải là Review ID
        Optional<Review> reviewOpt = reviewRepositoryPort.findById(id);
        if (reviewOpt.isPresent() && reviewOpt.get().getDocId() != null) {
            return documentRepositoryPort.findById(reviewOpt.get().getDocId())
                    .orElseThrow(() -> new DocumentNotFoundException(id));
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
                .approvalTiers(getApprovalTiersForDocType(docType))
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
        if (reviewCommentRepository == null || reviewId == null || request == null || request.getSectionComments() == null) {
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
                    .textSegment(segment)
                    .detailedComment(item.getDetailedComment().trim())
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
        List<Review> reviews = reviewRepositoryPort.findAll();
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

            String rawResult = r.getResult() != null ? r.getResult().toUpperCase() : "APPROVED";
            String action = "approved";
            if (rawResult.contains("REJECT") || rawResult.contains("DECLINE")) {
                action = "rejected";
            } else if (rawResult.contains("RETURN")) {
                action = "returned";
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
        if (adminSettingRepository == null) {
            return defaultApprovalPolicies();
        }
        Optional<AdminSettingEntity> stored = adminSettingRepository.findById(KEY_APPROVAL_POLICIES);
        if (stored == null || stored.isEmpty()) {
            return defaultApprovalPolicies();
        }
        return stored
                .map(entity -> {
                    try {
                        return objectMapper.readValue(entity.getSettingValue(), new TypeReference<List<ApprovalPolicyDto>>() {});
                    } catch (Exception e) {
                        log.warn("[ReviewServiceImpl] Lỗi đọc cấu hình approval_policies: {}", e.getMessage());
                        return defaultApprovalPolicies();
                    }
                })
                .orElseGet(this::defaultApprovalPolicies);
    }

    @Override
    @Transactional
    public List<ApprovalPolicyDto> updateApprovalPolicies(List<ApprovalPolicyDto> policies, Long actorId, String actorEmail) {
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
        try {
            String json = objectMapper.writeValueAsString(policies);
            AdminSettingEntity entity = adminSettingRepository.findById(KEY_APPROVAL_POLICIES)
                    .map(existing -> {
                        existing.setSettingValue(json);
                        existing.setUpdatedBy(actorId);
                        existing.setUpdatedAt(now);
                        return existing;
                    })
                    .orElseGet(() -> AdminSettingEntity.builder()
                            .settingKey(KEY_APPROVAL_POLICIES)
                            .settingValue(json)
                            .updatedBy(actorId)
                            .updatedAt(now)
                            .build());
            adminSettingRepository.save(entity);
            log.info("[ReviewServiceImpl] Đã cập nhật {} chính sách phê duyệt bởi {}", policies.size(), updater);
        } catch (Exception e) {
            log.error("[ReviewServiceImpl] Lỗi lưu cấu hình approval_policies: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể lưu cấu hình chính sách phê duyệt: " + e.getMessage(), e);
        }
        return policies;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ManagerDelegationDto> getManagerDelegations() {
        if (adminSettingRepository == null) {
            return new ArrayList<>();
        }
        return adminSettingRepository.findById(KEY_MANAGER_DELEGATIONS)
                .map(entity -> {
                    try {
                        return objectMapper.readValue(entity.getSettingValue(), new TypeReference<List<ManagerDelegationDto>>() {});
                    } catch (Exception e) {
                        log.warn("[ReviewServiceImpl] Lỗi đọc manager_delegations: {}", e.getMessage());
                        return new ArrayList<ManagerDelegationDto>();
                    }
                })
                .orElseGet(ArrayList::new);
    }

    @Override
    @Transactional
    public ManagerDelegationDto createManagerDelegation(ManagerDelegationDto delegation, Long actorId, String actorEmail) {
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
        if (delegation.getDelegatorId() == null && actorId != null) {
            delegation.setDelegatorId(actorId);
        }
        if (delegation.getDelegatorEmail() == null && actorEmail != null) {
            delegation.setDelegatorEmail(actorEmail);
        }
        if (delegation.getDelegatorName() == null || delegation.getDelegatorName().isBlank()) {
            delegation.setDelegatorName("Quản lý A");
        }
        if (delegation.getDelegateeName() == null || delegation.getDelegateeName().isBlank()) {
            delegation.setDelegateeName("Quản lý B");
        }
        if (delegation.getFromDate() != null && delegation.getToDate() != null
                && delegation.getFromDate().compareTo(delegation.getToDate()) > 0) {
            throw new IllegalArgumentException("Ngày kết thúc phải sau ngày bắt đầu.");
        }

        List<ManagerDelegationDto> current = getManagerDelegations();
        List<ManagerDelegationDto> updated = new ArrayList<>(current);
        updated.add(delegation);

        try {
            String json = objectMapper.writeValueAsString(updated);
            AdminSettingEntity entity = adminSettingRepository.findById(KEY_MANAGER_DELEGATIONS)
                    .map(existing -> {
                        existing.setSettingValue(json);
                        existing.setUpdatedBy(actorId);
                        existing.setUpdatedAt(now);
                        return existing;
                    })
                    .orElseGet(() -> AdminSettingEntity.builder()
                            .settingKey(KEY_MANAGER_DELEGATIONS)
                            .settingValue(json)
                            .updatedBy(actorId)
                            .updatedAt(now)
                            .build());
            adminSettingRepository.save(entity);
            log.info("[ReviewServiceImpl] Đã lưu ủy quyền mới: {} ủy quyền cho {}",
                    delegation.getDelegatorName(), delegation.getDelegateeName());
        } catch (Exception e) {
            log.error("[ReviewServiceImpl] Lỗi lưu manager_delegations: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể lưu ủy quyền phê duyệt: " + e.getMessage(), e);
        }
        return delegation;
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
            return "API";
        }
        if (path.contains("arch") || title.contains("kiến trúc") || title.contains("architecture")) {
            return "ARCHITECTURE";
        }
        if (path.contains("guide") || path.contains("manual") || title.contains("hướng dẫn")) {
            return "USER_GUIDE";
        }
        if (path.contains("release") || path.contains("changelog") || title.contains("phát hành")) {
            return "RELEASE_NOTE";
        }
        return "DEFAULT";
    }

    private int getApprovalTiersForDocType(String docType) {
        List<ApprovalPolicyDto> policies = getApprovalPolicies();
        for (ApprovalPolicyDto p : policies) {
            if (p.getDocType() != null && p.getDocType().equalsIgnoreCase(docType)) {
                return p.getTiers() != null && p.getTiers() == 1 ? 1 : 2;
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
            return true; // ponytail: fallback to active if date parsing is ambiguous
        }
    }

    private ManagerDelegationDto findActiveDelegation(String actorEmail, Long actorId, ManagerActionRequest request) {
        List<ManagerDelegationDto> delegations = getManagerDelegations();
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
        if (actorEmail != null && delegation.getDelegateeEmail() != null
                && actorEmail.trim().equalsIgnoreCase(delegation.getDelegateeEmail().trim())) {
            return true;
        }
        return actorId != null && delegation.getDelegateeId() != null && actorId.equals(delegation.getDelegateeId());
    }

    private List<ApprovalPolicyDto> defaultApprovalPolicies() {
        String nowStr = Instant.now().toString();
        List<ApprovalPolicyDto> list = new ArrayList<>();
        list.add(ApprovalPolicyDto.builder()
                .docType("API")
                .tiers(1)
                .description("Tài liệu kỹ thuật API - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("ARCHITECTURE")
                .tiers(2)
                .description("Tài liệu Kiến trúc hệ thống - Phê duyệt 2 cấp (Staff duyệt -> Manager ký duyệt)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("USER_GUIDE")
                .tiers(1)
                .description("Hướng dẫn sử dụng & Vận hành - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
                .updatedAt(nowStr)
                .updatedBy("SYSTEM")
                .build());
        list.add(ApprovalPolicyDto.builder()
                .docType("RELEASE_NOTE")
                .tiers(1)
                .description("Ghi chú phát hành phiên bản - Phê duyệt 1 cấp (Staff duyệt xuất bản trực tiếp)")
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
