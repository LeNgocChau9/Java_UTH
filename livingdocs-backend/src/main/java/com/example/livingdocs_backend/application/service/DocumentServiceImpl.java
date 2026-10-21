package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.*;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.domain.exception.DocumentNotFoundException;
import com.example.livingdocs_backend.domain.exception.DocumentVersionNotFoundException;
import com.example.livingdocs_backend.domain.model.ActorRole;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.model.DocumentStateMachine;
import com.example.livingdocs_backend.domain.model.DocumentVersion;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.domain.repository.DocumentVersionRepositoryPort;
import com.example.livingdocs_backend.domain.util.HashUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.infrastructure.persistence.entity.GitHubConnectionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentServiceImpl implements DocumentServicePort {

    private final DocumentRepositoryPort documentRepositoryPort;
    private final DocumentVersionRepositoryPort documentVersionRepositoryPort;
    private final AuditServicePort auditServicePort;
    private final SpringDataRepositoryRepository repositoryRepository;
    private final SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    private final GitHubClientPort gitHubClient;

    @Override
    @Transactional
    public DocumentResponse createDocument(CreateDocumentRequest request, Long actorId, String actorRole) {
        ActorRole role = resolveActorRole(request.getActorRole(), actorRole);
        String triggerType = (request.getTriggerType() != null && !request.getTriggerType().isBlank())
                ? request.getTriggerType() : "MANUAL_CREATE";

        // 1. Tạo bản ghi Document khởi tạo (version 1, trạng thái DRAFT)
        Document newDoc = Document.builder()
                .repoId(request.getRepoId())
                .collectionId(request.getCollectionId())
                .title(request.getTitle())
                .targetPath(request.getTargetPath())
                .status(DocumentStatus.DRAFT)
                .currentVersion(1)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        Document savedDoc = documentRepositoryPort.save(newDoc);

        // 2. Tính toán mã băm (Genesis Hash) cho phiên bản 1
        String prevHash = HashUtils.GENESIS_HASH;
        String hash = HashUtils.calculateVersionHash(
                prevHash,
                1,
                request.getContent(),
                role.name(),
                triggerType
        );

        // 3. Tự động tạo bản ghi document_versions v1
        DocumentVersion version1 = DocumentVersion.builder()
                .docId(savedDoc.getDocId())
                .versionNum(1)
                .content(request.getContent())
                .actorRole(role)
                .triggerType(triggerType)
                .prevHash(prevHash)
                .hash(hash)
                .createdAt(Instant.now())
                .build();
        DocumentVersion savedVersion1 = documentVersionRepositoryPort.save(version1);

        log.info("Đã tạo mới tài liệu ID: {} kèm phiên bản v1 (Hash: {})", savedDoc.getDocId(), hash);

        return toDocumentResponse(savedDoc, savedVersion1);
    }

    @Override
    @Transactional
    public DocumentResponse updateDocument(Long docId, UpdateDocumentRequest request, Long actorId, String actorRole) {
        Document document = documentRepositoryPort.findById(docId)
                .orElseThrow(() -> new DocumentNotFoundException(docId));

        ActorRole role = resolveActorRole(request.getActorRole(), actorRole);
        String triggerType = (request.getTriggerType() != null && !request.getTriggerType().isBlank())
                ? request.getTriggerType() : "MANUAL_UPDATE";

        // Lấy phiên bản mới nhất hiện tại để kế thừa chuỗi băm prev_hash
        String prevHash = documentVersionRepositoryPort.findLatestByDocId(docId)
                .map(DocumentVersion::getHash)
                .orElse(HashUtils.GENESIS_HASH);

        int nextVersionNum = document.getCurrentVersion() != null ? document.getCurrentVersion() + 1 : 2;

        // Tính toán hash cho phiên bản mới
        String newHash = HashUtils.calculateVersionHash(
                prevHash,
                nextVersionNum,
                request.getContent(),
                role.name(),
                triggerType
        );

        // Tự động tạo bản ghi document_versions mới
        DocumentVersion nextVersion = DocumentVersion.builder()
                .docId(docId)
                .versionNum(nextVersionNum)
                .content(request.getContent())
                .actorRole(role)
                .triggerType(triggerType)
                .prevHash(prevHash)
                .hash(newHash)
                .createdAt(Instant.now())
                .build();
        DocumentVersion savedVersion = documentVersionRepositoryPort.save(nextVersion);

        // Cập nhật thông tin Document cha
        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            document.setTitle(request.getTitle());
        }
        if (request.getTargetPath() != null) {
            document.setTargetPath(request.getTargetPath());
        }
        if (request.getCollectionId() != null) {
            document.setCollectionId(request.getCollectionId());
        }
        document.setCurrentVersion(nextVersionNum);
        document.setUpdatedAt(Instant.now());
        Document updatedDoc = documentRepositoryPort.save(document);

        log.info("Đã cập nhật tài liệu ID: {} lên phiên bản v{} (Hash: {}, PrevHash: {})",
                docId, nextVersionNum, newHash, prevHash);

        return toDocumentResponse(updatedDoc, savedVersion);
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentDetailResponse getDocumentById(Long docId) {
        Document document = documentRepositoryPort.findById(docId)
                .orElseThrow(() -> new DocumentNotFoundException(docId));

        DocumentVersion latestVersion = documentVersionRepositoryPort.findLatestByDocId(docId).orElse(null);
        List<DocumentVersionResponse> history = documentVersionRepositoryPort
                .findAllByDocIdOrderByVersionNumDesc(docId)
                .stream()
                .map(this::toVersionResponse)
                .collect(Collectors.toList());

        return DocumentDetailResponse.builder()
                .docId(document.getDocId())
                .collectionId(document.getCollectionId())
                .repoId(document.getRepoId())
                .title(document.getTitle())
                .targetPath(document.getTargetPath())
                .status(document.getStatus())
                .currentVersion(document.getCurrentVersion())
                .latestVersion(latestVersion != null ? toVersionResponse(latestVersion) : null)
                .versionHistory(history)
                .createdAt(document.getCreatedAt())
                .updatedAt(document.getUpdatedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponse> listDocuments(Long repoId, Long collectionId) {
        List<Document> docs;
        if (repoId != null && collectionId != null) {
            docs = documentRepositoryPort.findByRepoIdAndCollectionId(repoId, collectionId);
        } else if (repoId != null) {
            docs = documentRepositoryPort.findByRepoId(repoId);
        } else if (collectionId != null) {
            docs = documentRepositoryPort.findByCollectionId(collectionId);
        } else {
            docs = documentRepositoryPort.findAll();
        }

        return docs.stream().map(doc -> {
            DocumentVersion latest = documentVersionRepositoryPort.findLatestByDocId(doc.getDocId()).orElse(null);
            return toDocumentResponse(doc, latest);
        }).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deleteDocument(Long docId, Long actorId) {
        if (!documentRepositoryPort.existsById(docId)) {
            throw new DocumentNotFoundException(docId);
        }

        // Xóa các phiên bản liên kết
        documentVersionRepositoryPort.deleteAllByDocId(docId);
        // Xóa tài liệu
        documentRepositoryPort.deleteById(docId);

        // Ghi nhận Audit Log
        if (auditServicePort != null) {
            auditServicePort.recordDocumentDeletion(actorId, docId);
        }

        log.info("Đã xóa tài liệu ID: {} bởi actor: {}", docId, actorId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentVersionResponse> getDocumentVersions(Long docId) {
        if (!documentRepositoryPort.existsById(docId)) {
            throw new DocumentNotFoundException(docId);
        }
        return documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumDesc(docId)
                .stream()
                .map(this::toVersionResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public DocumentVersionResponse getDocumentVersion(Long docId, Integer versionNum) {
        if (!documentRepositoryPort.existsById(docId)) {
            throw new DocumentNotFoundException(docId);
        }
        DocumentVersion version = documentVersionRepositoryPort.findByDocIdAndVersionNum(docId, versionNum)
                .orElseThrow(() -> new DocumentVersionNotFoundException(docId, versionNum));

        return toVersionResponse(version);
    }

    @Override
    @Transactional
    public DocumentResponse submitForReview(Long docId, Long actorId) {
        Document document = documentRepositoryPort.findById(docId)
                .orElseThrow(() -> new DocumentNotFoundException(docId));

        DocumentStatus currentStatus = document.getStatus() != null ? document.getStatus() : DocumentStatus.DRAFT;
        DocumentStatus nextStatus = DocumentStateMachine.transition(currentStatus, DocumentStatus.UNDER_REVIEW_STAFF);

        document.setStatus(nextStatus);
        document.setUpdatedAt(Instant.now());
        Document saved = documentRepositoryPort.save(document);

        DocumentVersion latest = documentVersionRepositoryPort.findLatestByDocId(docId).orElse(null);
        log.info("Tài liệu ID: {} đã được chuyển trạng thái sang {} bởi actor: {}", docId, nextStatus, actorId);

        if (auditServicePort != null) {
            auditServicePort.recordDocumentAction(actorId, docId, AuditAction.DOCUMENT_SUBMITTED,
                    "Tác giả đã gửi tài liệu sang trạng thái UNDER_REVIEW_STAFF để Staff xem xét");
        }

        return toDocumentResponse(saved, latest);
    }

    @Override
    @Transactional
    public DocumentResponse processStaffReview(Long docId, StaffReviewDecisionRequest request, Long actorId) {
        return processStaffReview(docId, request, actorId, "STAFF");
    }

    @Override
    @Transactional
    public DocumentResponse processStaffReview(Long docId, StaffReviewDecisionRequest request, Long actorId, String actorRole) {
        Document document = documentRepositoryPort.findById(docId)
                .orElseThrow(() -> new DocumentNotFoundException(docId));

        DocumentStatus currentStatus = document.getStatus() != null ? document.getStatus() : DocumentStatus.UNDER_REVIEW_STAFF;
        String decisionStr = request != null && request.getDecision() != null ? request.getDecision().trim().toUpperCase() : "APPROVE";

        DocumentStatus targetStatus = "REJECT".equals(decisionStr) || "REJECTED".equals(decisionStr)
                ? DocumentStatus.REJECTED
                : DocumentStatus.UNDER_REVIEW_MANAGER;

        // Chuyển đổi trạng thái kèm kiểm tra nghiêm ngặt quyền hạn (Chỉ STAFF hoặc MANAGER mới được duyệt cấp 1)
        DocumentStatus nextStatus = DocumentStateMachine.transition(currentStatus, targetStatus, actorRole != null ? actorRole : "STAFF");

        document.setStatus(nextStatus);
        document.setUpdatedAt(Instant.now());
        Document saved = documentRepositoryPort.save(document);

        DocumentVersion latest = documentVersionRepositoryPort.findLatestByDocId(docId).orElse(null);
        String comment = request != null && request.getComment() != null ? request.getComment().trim() : "";
        log.info("Duyệt cấp 1: Actor {} (vai trò: {}) đã xem xét tài liệu ID: {} -> Quyết định: {}, Trạng thái mới: {}, Ghi chú: {}",
                actorId, actorRole, docId, decisionStr, nextStatus, comment);

        if (auditServicePort != null) {
            AuditAction action = (nextStatus == DocumentStatus.REJECTED) ? AuditAction.DOCUMENT_REJECTED : AuditAction.DOCUMENT_STAFF_REVIEWED;
            String detailMsg = (nextStatus == DocumentStatus.REJECTED)
                    ? "Staff đã từ chối tài liệu. Lý do: " + (comment.isEmpty() ? "Không có lý do chi tiết" : comment)
                    : "Staff đã phê duyệt tài liệu và chuyển Manager duyệt cấp 2. Nhận xét: " + (comment.isEmpty() ? "Tài liệu đạt chuẩn chất lượng." : comment);
            auditServicePort.recordDocumentAction(actorId, docId, action, detailMsg);
        }

        return toDocumentResponse(saved, latest);
    }

    @Override
    @Transactional
    public DocumentResponse processManagerReview(Long docId, ManagerReviewDecisionRequest request, Long actorId) {
        return processManagerReview(docId, request, actorId, "MANAGER");
    }

    @Override
    @Transactional
    public DocumentResponse processManagerReview(Long docId, ManagerReviewDecisionRequest request, Long actorId, String actorRole) {
        Document document = documentRepositoryPort.findById(docId)
                .orElseThrow(() -> new DocumentNotFoundException(docId));

        DocumentStatus currentStatus = document.getStatus() != null ? document.getStatus() : DocumentStatus.UNDER_REVIEW_MANAGER;
        String decisionStr = request != null && request.getDecision() != null ? request.getDecision().trim().toUpperCase() : "APPROVE";
        String comment = request != null && request.getComment() != null ? request.getComment().trim() : "";

        DocumentStatus targetStatus;
        if ("RETURN_STAFF".equals(decisionStr) || "RETURN".equals(decisionStr)) {
            targetStatus = DocumentStatus.UNDER_REVIEW_STAFF;
        } else if ("REJECT".equals(decisionStr) || "REJECTED".equals(decisionStr)) {
            targetStatus = DocumentStatus.REJECTED;
        } else {
            targetStatus = DocumentStatus.PUBLISHED;
        }

        // Chuyển đổi trạng thái kèm kiểm tra nghiêm ngặt quyền hạn (Chỉ MANAGER mới được duyệt cấp 2)
        DocumentStatus nextStatus = DocumentStateMachine.transition(currentStatus, targetStatus, actorRole != null ? actorRole : "MANAGER");

        document.setStatus(nextStatus);
        document.setUpdatedAt(Instant.now());
        Document saved = documentRepositoryPort.save(document);

        DocumentVersion latest = documentVersionRepositoryPort.findLatestByDocId(docId).orElse(null);
        log.info("Duyệt cấp 2: Manager {} (vai trò: {}) đã quyết định tài liệu ID: {} -> Quyết định: {}, Trạng thái mới: {}, Ghi chú: {}",
                actorId, actorRole, docId, decisionStr, nextStatus, comment);

        // Kích hoạt xuất bản và đẩy commit lên GitHub khi chuyển sang PUBLISHED
        String gitCommitSha = null;
        if (nextStatus == DocumentStatus.PUBLISHED && latest != null) {
            gitCommitSha = pushCommitToGitHub(saved, latest);
        }

        // Ghi nhận Audit Trail
        if (auditServicePort != null) {
            AuditAction action;
            String detailMsg;
            if (nextStatus == DocumentStatus.PUBLISHED) {
                action = AuditAction.DOCUMENT_PUBLISHED;
                detailMsg = "Manager đã phê duyệt xuất bản (PUBLISHED)."
                        + (gitCommitSha != null ? " Commit SHA: " + gitCommitSha + "." : "")
                        + (!comment.isEmpty() ? " Ghi chú: " + comment : "");
                auditServicePort.recordDocumentApproval(actorId, docId);
            } else if (nextStatus == DocumentStatus.UNDER_REVIEW_STAFF) {
                action = AuditAction.DOCUMENT_RETURNED_STAFF;
                detailMsg = "Manager yêu cầu xem xét lại (Trả lại Staff). Lý do: "
                        + (!comment.isEmpty() ? comment : "Cần rà soát và hiệu chỉnh lại.");
            } else {
                action = AuditAction.DOCUMENT_REJECTED;
                detailMsg = "Manager đã từ chối tài liệu. Lý do: "
                        + (!comment.isEmpty() ? comment : "Tài liệu không đạt chuẩn xuất bản.");
            }
            auditServicePort.recordDocumentAction(actorId, docId, action, detailMsg);
        }

        return toDocumentResponse(saved, latest);
    }

    @Override
    @Transactional(readOnly = true)
    public IntegrityCheckResponse verifyIntegrity(Long docId) {
        if (!documentRepositoryPort.existsById(docId)) {
            throw new DocumentNotFoundException(docId);
        }

        List<DocumentVersion> versions = documentVersionRepositoryPort.findAllByDocIdOrderByVersionNumAsc(docId);
        if (versions.isEmpty()) {
            return IntegrityCheckResponse.builder()
                    .docId(docId)
                    .totalVersions(0)
                    .valid(true)
                    .message("Tài liệu chưa có phiên bản nào để kiểm tra.")
                    .issues(List.of())
                    .build();
        }

        List<String> issues = new ArrayList<>();
        String expectedPrevHash = HashUtils.GENESIS_HASH;

        for (int i = 0; i < versions.size(); i++) {
            DocumentVersion v = versions.get(i);
            int expectedVersionNum = i + 1;

            // Kiểm tra số thứ tự phiên bản
            if (v.getVersionNum() != expectedVersionNum) {
                issues.add("Phiên bản thứ " + (i + 1) + " có version_num là " + v.getVersionNum() + " (mong đợi: " + expectedVersionNum + ")");
            }

            // Kiểm tra liên kết chuỗi băm prev_hash
            if (!expectedPrevHash.equalsIgnoreCase(v.getPrevHash())) {
                issues.add("Phiên bản v" + v.getVersionNum() + " bị đứt gãy chuỗi băm: prev_hash (" + v.getPrevHash() + ") không khớp hash phiên bản trước (" + expectedPrevHash + ")");
            }

            // Tính toán lại mã băm thực tế từ nội dung xem có bị tamper trực tiếp trong DB không
            String roleName = v.getActorRole() != null ? v.getActorRole().name() : "DEV";
            String computedHash = HashUtils.calculateVersionHash(
                    v.getPrevHash(),
                    v.getVersionNum(),
                    v.getContent(),
                    roleName,
                    v.getTriggerType()
            );

            if (!computedHash.equalsIgnoreCase(v.getHash())) {
                issues.add("Phiên bản v" + v.getVersionNum() + " có nội dung bị chỉnh sửa trái phép! Mã băm lưu trữ: " + v.getHash() + ", mã băm tính lại: " + computedHash);
            }

            // Cập nhật expectedPrevHash cho vòng lặp kế tiếp
            expectedPrevHash = v.getHash();
        }

        boolean isValid = issues.isEmpty();
        String message = isValid
                ? "Chuỗi băm toàn vẹn: Toàn bộ " + versions.size() + " phiên bản khớp tuyệt đối mã băm SHA-256 và không có dấu hiệu can thiệp trái phép."
                : "Phát hiện bất thường: Chuỗi băm bị đứt gãy hoặc nội dung đã bị can thiệp ngoài luồng (" + issues.size() + " lỗi)!";

        return IntegrityCheckResponse.builder()
                .docId(docId)
                .totalVersions(versions.size())
                .valid(isValid)
                .message(message)
                .issues(issues)
                .build();
    }

    @Override
    @Transactional
    public RollbackResponse rollbackToVersion(Long docId, Integer targetVersion, String reason, Long actorId, String actorRole) {
        if (targetVersion == null || targetVersion < 1) {
            throw new IllegalArgumentException("Phiên bản mục tiêu để khôi phục không hợp lệ: " + targetVersion);
        }

        Document document = documentRepositoryPort.findById(docId)
                .orElseThrow(() -> new DocumentNotFoundException(docId));

        // 1. Tìm phiên bản mục tiêu cần khôi phục
        DocumentVersion targetVersionEntity = documentVersionRepositoryPort.findByDocIdAndVersionNum(docId, targetVersion)
                .orElseThrow(() -> new DocumentVersionNotFoundException(docId, targetVersion));

        // 2. Lấy hash của phiên bản mới nhất hiện tại để kế thừa prev_hash
        String prevHash = documentVersionRepositoryPort.findLatestByDocId(docId)
                .map(DocumentVersion::getHash)
                .orElse(HashUtils.GENESIS_HASH);

        int nextVersionNum = document.getCurrentVersion() != null ? document.getCurrentVersion() + 1 : targetVersion + 1;

        ActorRole role = resolveActorRole(actorRole, null);
        String triggerType = "ROLLBACK_TO_V" + targetVersion;

        // 3. Tính toán mã băm mới cho phiên bản rollback
        String newHash = HashUtils.calculateVersionHash(
                prevHash,
                nextVersionNum,
                targetVersionEntity.getContent(),
                role.name(),
                triggerType
        );

        // 4. Lưu bản ghi DocumentVersion mới (Bảo toàn tính bất biến - không xóa lịch sử)
        DocumentVersion newVersion = DocumentVersion.builder()
                .docId(docId)
                .versionNum(nextVersionNum)
                .content(targetVersionEntity.getContent())
                .actorRole(role)
                .triggerType(triggerType)
                .prevHash(prevHash)
                .hash(newHash)
                .createdAt(Instant.now())
                .build();
        DocumentVersion savedVersion = documentVersionRepositoryPort.save(newVersion);

        // 5. Cập nhật current_version của Document
        document.setCurrentVersion(nextVersionNum);
        document.setUpdatedAt(Instant.now());
        documentRepositoryPort.save(document);

        log.info("Đã khôi phục tài liệu ID: {} về phiên bản v{} -> Tạo phiên bản mới v{} (Hash: {}, PrevHash: {}) bởi actor: {}",
                docId, targetVersion, nextVersionNum, newHash, prevHash, actorId);

        String msgReason = (reason != null && !reason.isBlank()) ? " (Lý do: " + reason + ")" : "";
        String message = "Đã khôi phục thành công tài liệu về nội dung của phiên bản v" + targetVersion
                + ", tạo phiên bản mới v" + nextVersionNum + " để bảo đảm toàn vẹn chuỗi băm lịch sử" + msgReason + ".";

        return RollbackResponse.builder()
                .docId(docId)
                .targetVersion(targetVersion)
                .newVersion(nextVersionNum)
                .message(message)
                .version(toVersionResponse(savedVersion))
                .build();
    }

    private ActorRole resolveActorRole(String requestRole, String tokenRole) {
        if (requestRole != null && !requestRole.isBlank()) {
            return ActorRole.fromString(requestRole);
        }
        if (tokenRole != null && !tokenRole.isBlank()) {
            return ActorRole.fromString(tokenRole);
        }
        return ActorRole.DEV;
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

    private DocumentVersionResponse toVersionResponse(DocumentVersion v) {
        return DocumentVersionResponse.builder()
                .versionId(v.getVersionId())
                .docId(v.getDocId())
                .versionNum(v.getVersionNum())
                .content(v.getContent())
                .actorRole(v.getActorRole() != null ? v.getActorRole().name() : "DEV")
                .triggerType(v.getTriggerType())
                .hash(v.getHash())
                .prevHash(v.getPrevHash())
                .createdAt(v.getCreatedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentAuditLogResponse> getDocumentAuditLogs(Long docId) {
        if (!documentRepositoryPort.existsById(docId)) {
            throw new DocumentNotFoundException(docId);
        }
        if (auditServicePort == null) {
            return List.of();
        }
        return auditServicePort.getAuditLogsForResource("DOCUMENT", docId.toString())
                .stream()
                .map(log -> DocumentAuditLogResponse.builder()
                        .logId(log.getLogId())
                        .actorId(log.getActorId())
                        .action(log.getAction())
                        .resourceType(log.getResourceType())
                        .resourceId(log.getResourceId())
                        .detail(log.getDetail())
                        .ipAddress(log.getIpAddress())
                        .createdAt(log.getCreatedAt())
                        .build())
                .toList();
    }

    /**
     * Kích hoạt xuất bản: Đẩy commit tài liệu Markdown lên GitHub repository.
     */
    private String pushCommitToGitHub(Document doc, DocumentVersion version) {
        if (doc == null || doc.getRepoId() == null || gitHubClient == null) {
            return null;
        }

        try {
            var repoOpt = repositoryRepository.findById(doc.getRepoId());
            if (repoOpt.isEmpty()) {
                log.warn("Không tìm thấy repository ID: {} để đẩy commit tài liệu docId: {}", doc.getRepoId(), doc.getDocId());
                return null;
            }

            RepositoryEntity repo = repoOpt.get();
            String token = resolveGitHubToken(repo);
            if (!StringUtils.hasText(token)) {
                log.warn("Không có GitHub Token hợp lệ cho repository: {}. Bỏ qua đẩy commit lên GitHub.", repo.getRepoFullName());
                return null;
            }

            String[] ownerAndRepo = parseOwnerAndRepo(repo.getRepoFullName());
            String owner = ownerAndRepo[0];
            String repoName = ownerAndRepo[1];

            String filePath = StringUtils.hasText(doc.getTargetPath()) ? doc.getTargetPath() : "docs/" + doc.getTitle().replaceAll("[^a-zA-Z0-9-_]", "_") + ".md";
            String branch = StringUtils.hasText(repo.getDefaultBranch()) ? repo.getDefaultBranch() : "main";
            String commitMessage = "docs(publish): " + doc.getTitle() + " (v" + version.getVersionNum() + ")";

            log.info("Bắt đầu đẩy commit xuất bản tài liệu [{}] lên GitHub repository {}/{} branch {}",
                    doc.getTitle(), owner, repoName, branch);

            String commitSha = gitHubClient.createOrUpdateFile(
                    token, owner, repoName, filePath, version.getContent(), commitMessage, branch
            );

            log.info("Đã xuất bản thành công tài liệu [{}] lên GitHub, Commit SHA: {}", doc.getTitle(), commitSha);
            return commitSha;
        } catch (Exception ex) {
            log.error("Lỗi khi đẩy commit lên GitHub cho tài liệu docId {}: {}", doc.getDocId(), ex.getMessage(), ex);
            return null;
        }
    }

    private String resolveGitHubToken(RepositoryEntity repo) {
        if (repo.getConnectionId() != null) {
            var conn = gitHubConnectionRepository.findById(repo.getConnectionId());
            if (conn.isPresent() && StringUtils.hasText(conn.get().getAccessTokenEncrypted())
                    && !"DUMMY_TOKEN".equals(conn.get().getAccessTokenEncrypted())) {
                return conn.get().getAccessTokenEncrypted();
            }
        }
        var wsConn = gitHubConnectionRepository.findFirstByWorkspaceIdOrderByCreatedAtDesc(repo.getWorkspaceId());
        if (wsConn.isPresent() && StringUtils.hasText(wsConn.get().getAccessTokenEncrypted())
                && !"DUMMY_TOKEN".equals(wsConn.get().getAccessTokenEncrypted())) {
            return wsConn.get().getAccessTokenEncrypted();
        }
        return null;
    }

    private String[] parseOwnerAndRepo(String repoFullName) {
        String[] parts = repoFullName.split("/", 2);
        if (parts.length < 2) {
            return new String[]{repoFullName, repoFullName};
        }
        return new String[]{parts[0].trim(), parts[1].trim()};
    }
}
