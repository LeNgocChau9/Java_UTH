package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.ai.DocRewriteRequestDto;
import com.example.livingdocs_backend.application.dto.ai.DocRewriteResponseDto;
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
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentVersionRepository;
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
 * Service thực thi cơ chế tự động sinh bản nháp DRAFT khi phát hiện Drift (Task S4-10 - TV4).
 * Kết nối với AI Engine (/v1/docs/rewrite-suggestion), tạo DocumentVersion mới ở trạng thái DRAFT
 * và liên kết với cảnh báo drift để người dùng có thể duyệt ngay trong 1 click.
 */
@Slf4j
@Service
public class AutoDraftServiceImpl implements AutoDraftServicePort {

    private final SpringDataDocumentChangeAlertRepository alertRepository;
    private final SpringDataDocumentRepository documentRepository;
    private final SpringDataDocumentVersionRepository documentVersionRepository;
    private final AuditServicePort auditServicePort;
    private final ChangelogServicePort changelogServicePort;
    private final RestClient restClient;

    @Autowired
    public AutoDraftServiceImpl(
            SpringDataDocumentChangeAlertRepository alertRepository,
            SpringDataDocumentRepository documentRepository,
            SpringDataDocumentVersionRepository documentVersionRepository,
            AuditServicePort auditServicePort,
            ChangelogServicePort changelogServicePort,
            @Value("${ai.engine.url:http://localhost:8000}") String aiEngineUrl
    ) {
        this.alertRepository = alertRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
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
            AuditServicePort auditServicePort,
            ChangelogServicePort changelogServicePort,
            RestClient restClient
    ) {
        this.alertRepository = alertRepository;
        this.documentRepository = documentRepository;
        this.documentVersionRepository = documentVersionRepository;
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

        DocumentEntity document = documentRepository.findById(docId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu ID " + docId));

        // 1. Lấy phiên bản gần nhất của tài liệu
        Optional<DocumentVersionEntity> latestVerOpt = documentVersionRepository.findTopByDocIdOrderByVersionNumDesc(docId);
        String currentContent = latestVerOpt.map(DocumentVersionEntity::getContent).orElse("");
        String prevHash = latestVerOpt.map(DocumentVersionEntity::getHash).orElse(HashUtils.GENESIS_HASH);
        int nextVersionNum = latestVerOpt.map(v -> v.getVersionNum() + 1).orElse(1);

        String codeDiff = StringUtils.hasText(alert.getDetails()) ? alert.getDetails() : "No diff available";

        // 2. Gọi AI Engine (/v1/docs/rewrite-suggestion) để lấy gợi ý viết lại
        DocRewriteResponseDto aiResponse = callAiEngineRewrite(currentContent, codeDiff, document.getTitle(), alert.getSourceCommit());

        String newContent = aiResponse != null && StringUtils.hasText(aiResponse.getUpdated_doc())
                ? aiResponse.getUpdated_doc()
                : currentContent;

        String summary = aiResponse != null && StringUtils.hasText(aiResponse.getSummary_of_changes())
                ? aiResponse.getSummary_of_changes()
                : "AI tự động cập nhật bản nháp dựa trên cảnh báo drift #" + alertId;

        // 3. Tính mã băm SHA-256 bảo vệ chuỗi hash chain
        String hash = HashUtils.calculateVersionHash(prevHash, nextVersionNum, newContent, "AI", "AUTO_DRIFT_AI_REWRITE");

        // 4. Lưu bản ghi mới vào document_versions ở trạng thái nháp
        DocumentVersionEntity draftVersion = DocumentVersionEntity.builder()
                .docId(docId)
                .versionNum(nextVersionNum)
                .content(newContent)
                .actorRole("AI")
                .triggerType("AUTO_DRIFT_AI_REWRITE")
                .hash(hash)
                .prevHash(prevHash)
                .commitHash(alert.getSourceCommit())
                .createdAt(Instant.now())
                .build();

        DocumentVersionEntity savedVersion = documentVersionRepository.save(draftVersion);

        // 5. Cập nhật current_version và status của Document sang DRAFT
        document.setCurrentVersion(nextVersionNum);
        document.setStatus(DocumentStatus.DRAFT);
        documentRepository.save(document);

        // 6. Gán liên kết bản nháp này vào cảnh báo drift
        alert.setDraftVersionId(savedVersion.getVersionId());
        alertRepository.save(alert);

        // 7. Ghi nhận Changelog và Audit log
        Long actorId = actor != null ? actor.getUserId() : null;
        if (changelogServicePort != null) {
            changelogServicePort.logChange(docId, savedVersion.getVersionId(), actorId, "AI", summary);
        }

        if (auditServicePort != null && actorId != null) {
            auditServicePort.recordSecurityAction(
                    actorId,
                    AuditAction.DOCUMENT_CREATED,
                    "DOCUMENT_VERSION",
                    String.valueOf(savedVersion.getVersionId()),
                    "AI generated draft version " + nextVersionNum + " for alert #" + alertId
            );
        }

        log.info("[AutoDraft] Đã tạo thành công bản nháp v{} (versionId={}) cho cảnh báo drift #{}",
                nextVersionNum, savedVersion.getVersionId(), alertId);

        return AutoDraftOnDriftResponse.builder()
                .alertId(alertId)
                .documentId(docId)
                .versionId(savedVersion.getVersionId())
                .versionNum(nextVersionNum)
                .status("DRAFT")
                .actorRole("AI")
                .triggerType("AUTO_DRIFT_AI_REWRITE")
                .summaryOfChanges(summary)
                .message("Tự động sinh bản nháp DRAFT thành công từ gợi ý của AI!")
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

        // 1. Phê duyệt bản nháp: Chuyển tài liệu sang APPROVED / PUBLISHED
        document.setStatus(DocumentStatus.APPROVED);
        documentRepository.save(document);

        // 2. Đánh dấu cảnh báo drift là RESOLVED / ACCEPTED
        alert.setStatus("RESOLVED");
        alert.setResolvedAt(Instant.now());
        alertRepository.save(alert);

        // 3. Ghi audit log
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

