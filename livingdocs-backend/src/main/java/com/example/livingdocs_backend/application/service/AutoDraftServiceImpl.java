package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.DocRewriteRequestDto;
import com.example.livingdocs_backend.application.dto.ai.DocRewriteResponseDto;
import com.example.livingdocs_backend.application.dto.drift.ApplySuggestionRequestDto;
import com.example.livingdocs_backend.application.dto.drift.AutoDraftOnDriftResponse;
import com.example.livingdocs_backend.application.port.AuditServicePort;
import com.example.livingdocs_backend.application.port.AutoDraftServicePort;
import com.example.livingdocs_backend.application.port.ChangelogServicePort;
import com.example.livingdocs_backend.domain.model.AuditAction;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.util.HashUtils;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentVersionEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.ReviewEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentVersionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataReviewRepository;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;

/**
 * Service thực thi cơ chế tự động tạo bản nháp (Auto-Draft) khi phát hiện Trôi dạt (Drift Alert).
 * - Khi nhận tín hiệu sai lệch (Drift Alert) từ PR hoặc commit, dịch vụ tự động gọi AI Engine lấy gợi ý viết lại (/v1/docs/rewrite-suggestion).
 * - Tạo một phiên bản tài liệu mới với trạng thái PENDING_REVIEW (hoặc DRAFT), ghi rõ tác nhân tạo là AI_AGENT.
 * - Gửi thông báo đến hàng đợi xem xét của nhân viên (bảng reviews với trạng thái PENDING cho Staff review queue).
 * - Đầu ra: API POST /api/auto-draft/apply-suggestion chuyển đề xuất AI thành bản nháp chính thức.
 */
@Slf4j
@Service
public class AutoDraftServiceImpl implements AutoDraftServicePort {

    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final SpringDataDocumentRepository documentRepository;
    private final SpringDataDocumentVersionRepository documentVersionRepository;
    private final SpringDataReviewRepository reviewRepository;
    private final AuditServicePort auditServicePort;
    private final ChangelogServicePort changelogServicePort;
    private final RestClient restClient;

    @Autowired
    public AutoDraftServiceImpl(
            SpringDataDocumentChangeAlertRepository alertRepository,
            SpringDataDocumentRepository documentRepository,
            SpringDataDocumentVersionRepository documentVersionRepository,
            SpringDataReviewRepository reviewRepository,
            AuditServicePort auditServicePort,
            ChangelogServicePort changelogServicePort,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl
    ) {
        this.alertRepository = alertRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.reviewRepository = reviewRepository;
        this.auditServicePort = auditServicePort;
        this.changelogServicePort = changelogServicePort;
        this.restClient = RestClient.builder()
                .baseUrl(aiEngineUrl)
                .build();
    }

    public AutoDraftServiceImpl(
            SpringDataDocumentChangeAlertRepository alertRepository,
            SpringDataDocumentRepository documentRepository,
            SpringDataDocumentVersionRepository documentVersionRepository,
            SpringDataReviewRepository reviewRepository,
            AuditServicePort auditServicePort,
            ChangelogServicePort changelogServicePort,
            RestClient restClient
    ) {
        this.alertRepository = alertRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.reviewRepository = reviewRepository;
        this.auditServicePort = auditServicePort;
        this.changelogServicePort = changelogServicePort;
        this.restClient = restClient;
    }

    @Override
    @Transactional
    public AutoDraftOnDriftResponse generateDraftFromAlert(Long alertId, UserPrincipal actor) {
        DocumentChangeAlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo drift " + alertId));

        Long docId = alert.getDocumentId();
        if (docId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cảnh báo drift chưa được liên kết với tài liệu nào (document_id is null)");
        }

        String codeDiff = StringUtils.hasText(alert.getDetails()) ? alert.getDetails() : "No diff available";
        String summaryReason = "dựa trên cảnh báo drift #" + alertId;

        AutoDraftOnDriftResponse response = generateAutoDraftForDocument(
                docId, codeDiff, alert.getSourceCommit(), summaryReason, actor
        );

        // Gán liên kết bản nháp này vào cảnh báo drift
        alert.setDraftVersionId(response.getVersionId());
        alertRepository.save(alert);

        response.setAlertId(alertId);
        return response;
    }

    @Override
    @Transactional
    public AutoDraftOnDriftResponse generateAutoDraftForDocument(
            Long docId,
            String codeDiff,
            String commitHash,
            String summaryReason,
            UserPrincipal actor
    ) {
        DocumentEntity document = documentRepository.findById(docId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu ID " + docId));

        // 1. Lấy phiên bản gần nhất của tài liệu
        Optional<DocumentVersionEntity> latestVerOpt = documentVersionRepository.findTopByDocIdOrderByVersionNumDesc(docId);
        String currentContent = latestVerOpt.map(DocumentVersionEntity::getContent).orElse("");
        String prevHash = latestVerOpt.map(DocumentVersionEntity::getHash).orElse(HashUtils.GENESIS_HASH);
        int nextVersionNum = latestVerOpt.map(v -> v.getVersionNum() + 1).orElse(1);

        String effectiveDiff = StringUtils.hasText(codeDiff) ? codeDiff : "No diff available";

        // 2. Gọi AI Engine (/v1/docs/rewrite-suggestion) để lấy gợi ý viết lại
        DocRewriteResponseDto aiResponse = callAiEngineRewrite(currentContent, effectiveDiff, document.getTitle(), commitHash);

        String newContent = aiResponse != null && StringUtils.hasText(aiResponse.getUpdated_doc())
                ? aiResponse.getUpdated_doc()
                : currentContent;

        String summary = aiResponse != null && StringUtils.hasText(aiResponse.getSummary_of_changes())
                ? aiResponse.getSummary_of_changes()
                : "AI_AGENT tự động cập nhật bản nháp PENDING_REVIEW " + (summaryReason != null ? summaryReason : "");

        // 3. Tính mã băm SHA-256 bảo vệ chuỗi hash chain với actorRole là AI_AGENT
        String hash = HashUtils.calculateVersionHash(prevHash, nextVersionNum, newContent, "AI_AGENT", "AUTO_DRIFT_AI_REWRITE");

        // 4. Lưu bản ghi mới vào document_versions, ghi rõ tác nhân tạo là AI_AGENT
        DocumentVersionEntity draftVersion = DocumentVersionEntity.builder()
                .docId(docId)
                .versionNum(nextVersionNum)
                .content(newContent)
                .actorRole("AI_AGENT")
                .triggerType("AUTO_DRIFT_AI_REWRITE")
                .hash(hash)
                .prevHash(prevHash)
                .commitHash(commitHash)
                .createdAt(Instant.now())
                .build();

        DocumentVersionEntity savedVersion = documentVersionRepository.save(draftVersion);

        // 5. Cập nhật current_version và status của Document sang UNDER_REVIEW_STAFF (hiển thị trong hàng đợi xem xét Staff)
        document.setCurrentVersion(nextVersionNum);
        document.setStatus(DocumentStatus.UNDER_REVIEW_STAFF);
        documentRepository.save(document);

        // 6. Gửi thông báo đến hàng đợi xem xét của nhân viên (tạo mục trong bảng reviews với trạng thái PENDING)
        ReviewEntity reviewItem = ReviewEntity.builder()
                .docId(docId)
                .versionId(savedVersion.getVersionId())
                .reviewer("AI_AGENT")
                .generalComment("Bản nháp tự động sinh do phát hiện thay đổi mã nguồn (Commit " + commitHash + "): " + summary)
                .result("PENDING")
                .createdAt(Instant.now())
                .build();
        ReviewEntity savedReview = reviewRepository.save(reviewItem);

        // 7. Ghi nhận Changelog và Audit log
        Long actorId = actor != null ? actor.getUserId() : null;
        if (changelogServicePort != null) {
            changelogServicePort.logChange(docId, savedVersion.getVersionId(), actorId, "AI_AGENT", summary);
        }

        if (auditServicePort != null && actorId != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.DOCUMENT_CREATED,
                    "DOCUMENT_VERSION",
                    String.valueOf(savedVersion.getVersionId()),
                    "AI_AGENT generated auto-draft version " + nextVersionNum + " (PENDING_REVIEW) for doc #" + docId
            );
        }

        log.info("[AutoDraft] Đã tạo thành công bản nháp v{} (versionId={}) cho doc #{}, đã đẩy vào hàng đợi xem xét của nhân viên (reviewId={})",
                nextVersionNum, savedVersion.getVersionId(), docId, savedReview.getReviewId());

        return AutoDraftOnDriftResponse.builder()
                .documentId(docId)
                .versionId(savedVersion.getVersionId())
                .versionNum(nextVersionNum)
                .status("PENDING_REVIEW")
                .actorRole("AI_AGENT")
                .triggerType("AUTO_DRIFT_AI_REWRITE")
                .summaryOfChanges(summary)
                .updatedDoc(newContent)
                .reviewId(savedReview.getReviewId())
                .reviewStatus("PENDING")
                .message("Tự động sinh bản nháp (Auto-Draft) thành công từ gợi ý AI và đã đưa vào hàng đợi xem xét của nhân viên!")
                .createdAt(savedVersion.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public AutoDraftOnDriftResponse applySuggestion(ApplySuggestionRequestDto request, UserPrincipal actor) {
        if (request == null || request.getAlertId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "alertId không được để trống");
        }

        Long alertId = request.getAlertId();
        DocumentChangeAlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo drift " + alertId));

        Long docId = alert.getDocumentId();
        if (docId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cảnh báo drift chưa được liên kết với tài liệu nào");
        }

        DocumentEntity document = documentRepository.findById(docId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu ID " + docId));

        Optional<DocumentVersionEntity> latestVerOpt = documentVersionRepository.findTopByDocIdOrderByVersionNumDesc(docId);
        String currentContent = latestVerOpt.map(DocumentVersionEntity::getContent).orElse("");
        String prevHash = latestVerOpt.map(DocumentVersionEntity::getHash).orElse(HashUtils.GENESIS_HASH);
        int nextVersionNum = latestVerOpt.map(v -> v.getVersionNum() + 1).orElse(1);

        String newContent;
        String summary;

        if (StringUtils.hasText(request.getCustomContent())) {
            newContent = request.getCustomContent();
            summary = StringUtils.hasText(request.getChangeSummary())
                    ? request.getChangeSummary()
                    : "Áp dụng đề xuất AI có tinh chỉnh thủ công cho cảnh báo drift #" + alertId;
        } else {
            String codeDiff = StringUtils.hasText(alert.getDetails()) ? alert.getDetails() : "No diff available";
            DocRewriteResponseDto aiResponse = callAiEngineRewrite(currentContent, codeDiff, document.getTitle(), alert.getSourceCommit());
            newContent = aiResponse != null && StringUtils.hasText(aiResponse.getUpdated_doc())
                    ? aiResponse.getUpdated_doc()
                    : currentContent;
            summary = StringUtils.hasText(request.getChangeSummary())
                    ? request.getChangeSummary()
                    : (aiResponse != null && StringUtils.hasText(aiResponse.getSummary_of_changes())
                            ? aiResponse.getSummary_of_changes()
                            : "Áp dụng gợi ý viết lại từ AI thành bản nháp chính thức cho cảnh báo drift #" + alertId);
        }

        // Tạo DocumentVersion mới với actorRole là AI_AGENT
        String hash = HashUtils.calculateVersionHash(prevHash, nextVersionNum, newContent, "AI_AGENT", "APPLY_AI_SUGGESTION");

        DocumentVersionEntity draftVersion = DocumentVersionEntity.builder()
                .docId(docId)
                .versionNum(nextVersionNum)
                .content(newContent)
                .actorRole("AI_AGENT")
                .triggerType("APPLY_AI_SUGGESTION")
                .hash(hash)
                .prevHash(prevHash)
                .commitHash(alert.getSourceCommit())
                .createdAt(Instant.now())
                .build();

        DocumentVersionEntity savedVersion = documentVersionRepository.save(draftVersion);

        // Cập nhật tài liệu
        document.setCurrentVersion(nextVersionNum);
        document.setStatus(DocumentStatus.UNDER_REVIEW_STAFF);
        documentRepository.save(document);

        // Đẩy vào hàng đợi xem xét của nhân viên
        ReviewEntity reviewItem = ReviewEntity.builder()
                .docId(docId)
                .versionId(savedVersion.getVersionId())
                .reviewer("AI_AGENT")
                .generalComment("Đề xuất cập nhật tài liệu đã được chuyển thành bản nháp chính thức (Drift Alert #" + alertId + "): " + summary)
                .result("PENDING")
                .createdAt(Instant.now())
                .build();
        ReviewEntity savedReview = reviewRepository.save(reviewItem);

        // Cập nhật liên kết bản nháp vào alert
        alert.setDraftVersionId(savedVersion.getVersionId());
        alertRepository.save(alert);

        Long actorId = actor != null ? actor.getUserId() : null;
        if (changelogServicePort != null) {
            changelogServicePort.logChange(docId, savedVersion.getVersionId(), actorId, "AI_AGENT", summary);
        }

        if (auditServicePort != null && actorId != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.DOCUMENT_CREATED,
                    "DOCUMENT_VERSION",
                    String.valueOf(savedVersion.getVersionId()),
                    "Converted AI suggestion into official draft version " + nextVersionNum + " for alert #" + alertId
            );
        }

        log.info("[AutoDraft] Đã chuyển gợi ý AI thành bản nháp chính thức v{} (versionId={}) cho cảnh báo drift #{}",
                nextVersionNum, savedVersion.getVersionId(), alertId);

        return AutoDraftOnDriftResponse.builder()
                .alertId(alertId)
                .documentId(docId)
                .versionId(savedVersion.getVersionId())
                .versionNum(nextVersionNum)
                .status("PENDING_REVIEW")
                .actorRole("AI_AGENT")
                .triggerType("APPLY_AI_SUGGESTION")
                .summaryOfChanges(summary)
                .updatedDoc(newContent)
                .reviewId(savedReview.getReviewId())
                .reviewStatus("PENDING")
                .message("Đã chuyển đề xuất AI thành bản nháp chính thức thành công và gửi đến hàng đợi xem xét của nhân viên!")
                .createdAt(savedVersion.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public AutoDraftOnDriftResponse acceptDraft(Long alertId, UserPrincipal actor) {
        DocumentChangeAlertEntity alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy cảnh báo drift " + alertId));

        if (alert.getDraftVersionId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cảnh báo này chưa có bản nháp nào được sinh bởi AI");
        }

        DocumentVersionEntity draftVersion = documentVersionRepository.findById(alert.getDraftVersionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bản nháp ID " + alert.getDraftVersionId()));

        Long docId = alert.getDocumentId();
        DocumentEntity document = documentRepository.findById(docId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu ID " + docId));

        // 1. Phê duyệt bản nháp: Chuyển tài liệu sang APPROVED
        document.setStatus(DocumentStatus.APPROVED);
        documentRepository.save(document);

        // 2. Đánh dấu cảnh báo drift là RESOLVED / ACCEPTED
        alert.setStatus("RESOLVED");
        alert.setResolvedAt(Instant.now());
        alertRepository.save(alert);

        // 3. Cập nhật mục trong hàng đợi rà soát thành APPROVED nếu có
        Optional<ReviewEntity> latestReviewOpt = reviewRepository.findFirstByDocIdOrderByCreatedAtDesc(docId);
        if (latestReviewOpt.isPresent()) {
            ReviewEntity r = latestReviewOpt.get();
            r.setResult("APPROVED");
            r.setGeneralComment("Đã được người dùng duyệt trực tiếp trong 1 click từ giao diện Cảnh báo Trôi dạt.");
            reviewRepository.save(r);
        }

        // 4. Ghi audit log
        Long actorId = actor != null ? actor.getUserId() : null;
        if (auditServicePort != null && actorId != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.DRIFT_ALERT_RESOLVED,
                    "DRIFT_ALERT",
                    String.valueOf(alertId),
                    "User accepted AI draft version #" + draftVersion.getVersionNum() + " in 1 click"
            );
        }

        log.info("[AutoDraft] Người dùng đã chấp nhận bản nháp versionId={} cho alert #{}",
                draftVersion.getVersionId(), alertId);

        return AutoDraftOnDriftResponse.builder()
                .alertId(alertId)
                .documentId(docId)
                .versionId(draftVersion.getVersionId())
                .versionNum(draftVersion.getVersionNum())
                .status("APPROVED")
                .actorRole(actor != null ? "USER" : "SYSTEM")
                .triggerType("ONE_CLICK_ACCEPT")
                .summaryOfChanges("Đã duyệt bản nháp do AI đề xuất trong 1 click")
                .message("Đã chấp nhận bản nháp và giải quyết cảnh báo drift thành công!")
                .createdAt(Instant.now())
                .build();
    }

    private DocRewriteResponseDto callAiEngineRewrite(String currentDoc, String codeDiff, String title, String commitHash) {
        DocRewriteRequestDto requestDto = DocRewriteRequestDto.builder()
                .current_doc(StringUtils.hasText(currentDoc) ? currentDoc : "# " + title)
                .code_diff(codeDiff)
                .entity_name(title)
                .commit_hash(commitHash != null ? commitHash : "head-commit")
                .instruction("Tự động sửa đổi phần tài liệu bị ảnh hưởng bởi code diff trên, giữ nguyên các phần khác.")
                .build();

        try {
            return restClient.post()
                    .uri("/v1/docs/rewrite-suggestion")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestDto)
                    .retrieve()
                    .body(DocRewriteResponseDto.class);
        } catch (Exception ex) {
            log.warn("[AutoDraft] Không thể gọi AI Engine (/v1/docs/rewrite-suggestion): {}. Sử dụng nội dung cập nhật dự phòng.", ex.getMessage());
            return DocRewriteResponseDto.builder()
                    .updated_doc(currentDoc + "\n\n<!-- [AI Draft Update on Drift] -->\n" + codeDiff)
                    .summary_of_changes("[Fallback] Cập nhật bản nháp tài liệu theo code diff.")
                    .build();
        }
    }
}
