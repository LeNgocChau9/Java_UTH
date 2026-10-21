package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.ReviewServicePort;
import com.example.livingdocs_backend.domain.exception.DocumentNotFoundException;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStateMachine;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.model.Review;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.repository.ReviewRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewServicePort {

    private final DocumentRepositoryPort documentRepositoryPort;
    private final DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private final ReviewRepositoryPort reviewRepositoryPort;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final AuditServicePort auditServicePort;

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

        // 1. Chuẩn hóa quyết định của Staff (APPROVE -> UNDER_REVIEW_MANAGER, REJECT -> REJECTED)
        String rawAction = extractAction(request != null ? request.getAction() : null, request != null ? request.getDecision() : null);
        String actionNormalized = rawAction.trim().toUpperCase();

        DocumentStatus targetStatus;
        if (actionNormalized.contains("REJECT") || actionNormalized.contains("TU_CHOI") || actionNormalized.contains("DECLINE")) {
            targetStatus = DocumentStatus.REJECTED;
        } else {
            targetStatus = DocumentStatus.UNDER_REVIEW_MANAGER;
        }

        // 2. Kiểm tra thẩm quyền nghiêm ngặt theo State Machine (Chỉ STAFF hoặc MANAGER mới có quyền duyệt cấp 1)
        String effectiveRole = (request != null && request.getActorRole() != null && !request.getActorRole().isBlank())
                ? request.getActorRole().trim().toUpperCase()
                : (actorRole != null ? actorRole.trim().toUpperCase() : "STAFF");

        DocumentStatus nextStatus = DocumentStateMachine.transition(currentStatus, targetStatus, effectiveRole);

        // 3. Cập nhật trạng thái Document
        document.setStatus(nextStatus);
        document.setUpdatedAt(Instant.now());
        Document savedDoc = documentRepositoryPort.save(document);

        // 4. Chuẩn hóa ghi chú và lưu bản ghi vào bảng reviews
        String comment = extractComment(
                request != null ? request.getComment() : null,
                request != null ? request.getNote() : null,
                targetStatus == DocumentStatus.UNDER_REVIEW_MANAGER
                        ? "Staff đã đối chiếu mã nguồn và phê duyệt chuyển sang Manager."
                        : "Staff yêu cầu chỉnh sửa lại tài liệu."
        );

        DocumentVersion latestVersion = documentVersionRepositoryPort.findLatestByDocId(savedDoc.getDocId()).orElse(null);
        String reviewerIdentity = (actorEmail != null && !actorEmail.isBlank())
                ? actorEmail
                : ("STAFF".equalsIgnoreCase(effectiveRole) ? "staff@livingdocs.internal" : effectiveRole);

        Review reviewRecord = Review.builder()
                .docId(savedDoc.getDocId())
                .versionId(latestVersion != null ? latestVersion.getVersionId() : null)
                .reviewer(reviewerIdentity)
                .generalComment(comment)
                .result(targetStatus == DocumentStatus.UNDER_REVIEW_MANAGER ? "APPROVED" : "REJECTED")
                .createdAt(Instant.now())
                .build();
        Review savedReview = reviewRepositoryPort.save(reviewRecord);

        log.info("Xử lý Staff Action: Actor {} (vai trò: {}) đã xử lý tài liệu ID: {} -> Trạng thái mới: {}, Review ID: {}",
                actorId, effectiveRole, savedDoc.getDocId(), nextStatus, savedReview.getReviewId());

        String message = (nextStatus == DocumentStatus.UNDER_REVIEW_MANAGER)
                ? String.format("Staff đã duyệt tài liệu \"%s\" thành công và chuyển sang Manager (UNDER_REVIEW_MANAGER).", savedDoc.getTitle())
                : String.format("Staff đã từ chối tài liệu \"%s\" và chuyển sang trạng thái REJECTED.", savedDoc.getTitle());

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

        // 1. Chuẩn hóa quyết định của Manager (APPROVE / PUBLISH -> PUBLISHED, REJECT / RETURN -> REJECTED)
        String rawAction = extractAction(request != null ? request.getAction() : null, request != null ? request.getDecision() : null);
        String actionNormalized = rawAction.trim().toUpperCase();

        DocumentStatus targetStatus;
        if (actionNormalized.contains("REJECT") || actionNormalized.contains("RETURN")
                || actionNormalized.contains("TRA_VE") || actionNormalized.contains("TU_CHOI")) {
            targetStatus = DocumentStatus.REJECTED;
        } else {
            targetStatus = DocumentStatus.PUBLISHED; // Phê duyệt xuất bản
        }

        // 2. Kiểm tra thẩm quyền nghiêm ngặt theo State Machine (Chỉ MANAGER hoặc ADMIN mới có quyền duyệt cấp 2)
        String effectiveRole = (request != null && request.getActorRole() != null && !request.getActorRole().isBlank())
                ? request.getActorRole().trim().toUpperCase()
                : (actorRole != null ? actorRole.trim().toUpperCase() : "MANAGER");

        DocumentStatus nextStatus = DocumentStateMachine.transition(currentStatus, targetStatus, effectiveRole);

        // 3. Cập nhật trạng thái Document
        document.setStatus(nextStatus);
        document.setUpdatedAt(Instant.now());
        Document savedDoc = documentRepositoryPort.save(document);

        // 4. Ghi nhận Audit Log nếu đã phê duyệt xuất bản
        if (nextStatus == DocumentStatus.PUBLISHED && auditServicePort != null) {
            auditServicePort.recordDocumentApproval(actorId, savedDoc.getDocId());
        }

        // 5. Chuẩn hóa ghi chú và lưu bản ghi vào bảng reviews
        String comment = extractComment(
                request != null ? request.getComment() : null,
                request != null ? request.getNote() : null,
                targetStatus == DocumentStatus.PUBLISHED
                        ? "Manager phê duyệt xuất bản tài liệu chính thức lên hệ thống."
                        : "Manager trả về yêu cầu chỉnh sửa lại nội dung."
        );

        DocumentVersion latestVersion = documentVersionRepositoryPort.findLatestByDocId(savedDoc.getDocId()).orElse(null);
        String reviewerIdentity = (actorEmail != null && !actorEmail.isBlank())
                ? actorEmail
                : ("MANAGER".equalsIgnoreCase(effectiveRole) ? "manager@livingdocs.internal" : effectiveRole);

        Review reviewRecord = Review.builder()
                .docId(savedDoc.getDocId())
                .versionId(latestVersion != null ? latestVersion.getVersionId() : null)
                .reviewer(reviewerIdentity)
                .generalComment(comment)
                .result(targetStatus == DocumentStatus.PUBLISHED ? "PUBLISHED" : "REJECTED")
                .createdAt(Instant.now())
                .build();
        Review savedReview = reviewRepositoryPort.save(reviewRecord);

        log.info("Xử lý Manager Action: Manager {} (vai trò: {}) đã phê duyệt tài liệu ID: {} -> Trạng thái mới: {}, Review ID: {}",
                actorId, effectiveRole, savedDoc.getDocId(), nextStatus, savedReview.getReviewId());

        String message = (nextStatus == DocumentStatus.PUBLISHED)
                ? String.format("Manager đã phê duyệt và chính thức xuất bản tài liệu \"%s\" (PUBLISHED).", savedDoc.getTitle())
                : String.format("Manager đã trả về tài liệu \"%s\" (REJECTED) kèm nhận xét chỉnh sửa.", savedDoc.getTitle());

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
}
