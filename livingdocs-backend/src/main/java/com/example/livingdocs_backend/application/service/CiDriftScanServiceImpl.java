package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.drift.CiDriftScanRequest;
import com.example.livingdocs_backend.application.dto.drift.CiDriftScanResponse;
import com.example.livingdocs_backend.application.dto.drift.DriftScanItemDto;
import com.example.livingdocs_backend.application.port.CiDriftScanServicePort;
import com.example.livingdocs_backend.application.port.DriftAlertRepositoryPort;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.domain.model.DriftAlert;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CiDriftScanServiceImpl implements CiDriftScanServicePort {

    private final DriftAlertRepositoryPort driftAlertRepository;
    private final SpringDataDocCodeLinkRepository docCodeLinkRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SpringDataDocumentChangeAlertRepository documentChangeAlertRepository;

    public CiDriftScanServiceImpl(
            DriftAlertRepositoryPort driftAlertRepository,
            SpringDataDocCodeLinkRepository docCodeLinkRepository,
            SpringDataDocumentChangeAlertRepository documentChangeAlertRepository) {
        this.driftAlertRepository = driftAlertRepository;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.documentChangeAlertRepository = documentChangeAlertRepository;
    }

    public CiDriftScanServiceImpl(
            DriftAlertRepositoryPort driftAlertRepository,
            SpringDataDocCodeLinkRepository docCodeLinkRepository) {
        this.driftAlertRepository = driftAlertRepository;
        this.docCodeLinkRepository = docCodeLinkRepository;
        this.documentChangeAlertRepository = null;
    }

    @Override
    @Transactional
    public CiDriftScanResponse processCiDriftScan(CiDriftScanRequest request, CiToken ciToken) {
        log.info("[CI Drift Scan] Tiếp nhận kết quả quét từ GitHub Action. repoId={}, prNumber={}, tokenPrefix={}",
                request.getRepoId(), request.getPrNumber(), ciToken != null ? ciToken.getTokenPrefix() : "N/A");

        List<DriftScanItemDto> items = request.getAlerts();
        if (items == null || items.isEmpty()) {
            return CiDriftScanResponse.builder()
                    .status("SUCCESS")
                    .message("Không phát hiện cảnh báo trôi dạt nào từ CI scan.")
                    .repoId(request.getRepoId())
                    .prNumber(request.getPrNumber())
                    .totalAlertsRecorded(0)
                    .receivedAt(Instant.now())
                    .alertIds(Collections.emptyList())
                    .build();
        }

        Instant now = Instant.now();
        List<DriftAlert> alertsToSave = new ArrayList<>();
        List<DocumentChangeAlertEntity> unifiedAlertsToSave = new ArrayList<>();

        for (DriftScanItemDto item : items) {
            Long docId = item.getDocumentId();

            // Nếu CI chưa gắn sẵn documentId, thử tra cứu tự động qua bảng doc_code_links
            if (docId == null) {
                List<DocCodeLinkEntity> links = docCodeLinkRepository.findMatchingLinks(
                        item.getFilePath(), null, item.getMethodName());
                if (!links.isEmpty()) {
                    docId = links.get(0).getDocumentId();
                }
            }

            String severity = item.getSeverity() != null && !item.getSeverity().isBlank() ? item.getSeverity().toUpperCase() : "MEDIUM";

            DriftAlert alert = DriftAlert.builder()
                    .repoId(request.getRepoId())
                    .prNumber(request.getPrNumber())
                    .filePath(item.getFilePath())
                    .severity(severity)
                    .diffSnippet(item.getDiffSnippet())
                    .status("OPEN")
                    .documentId(docId)
                    .methodName(item.getMethodName())
                    .changeType(item.getChangeType())
                    .createdAt(now)
                    .build();

            alertsToSave.add(alert);

            // Đồng bộ sang bảng document_change_alerts để hợp nhất toàn bộ luồng cảnh báo trên Webhook/UI
            DocumentChangeAlertEntity unifiedAlert = DocumentChangeAlertEntity.builder()
                    .repositoryId(request.getRepoId())
                    .documentId(docId)
                    .sourcePrId(request.getPrNumber() != null ? request.getPrNumber().longValue() : null)
                    .classification(item.getChangeType() != null && !item.getChangeType().isBlank() ? item.getChangeType().toUpperCase() : "SIGNATURE")
                    .severity(severity)
                    .status("OPEN")
                    .details((item.getMethodName() != null ? "Phương thức: " + item.getMethodName() + "\n" : "")
                            + (item.getFilePath() != null ? "File: " + item.getFilePath() + "\n" : "")
                            + (item.getDiffSnippet() != null ? item.getDiffSnippet() : ""))
                    .createdAt(now)
                    .build();
            unifiedAlertsToSave.add(unifiedAlert);
        }

        List<DriftAlert> saved = driftAlertRepository.saveAll(alertsToSave);
        if (!unifiedAlertsToSave.isEmpty() && documentChangeAlertRepository != null) {
            documentChangeAlertRepository.saveAll(unifiedAlertsToSave);
        }
        List<Long> savedIds = saved.stream().map(DriftAlert::getAlertId).toList();

        log.info("[CI Drift Scan] Đã lưu thành công {} cảnh báo vào bảng drift_alerts và đồng bộ sang document_change_alerts", savedIds.size());

        return CiDriftScanResponse.builder()
                .status("SUCCESS")
                .message("Đã tiếp nhận và lưu thành công " + savedIds.size() + " cảnh báo trôi dạt vào bảng drift_alerts")
                .repoId(request.getRepoId())
                .prNumber(request.getPrNumber())
                .totalAlertsRecorded(savedIds.size())
                .receivedAt(now)
                .alertIds(savedIds)
                .build();
    }

    @Override
    public List<DriftAlert> getAlertsByRepo(Long repoId) {
        return driftAlertRepository.findByRepoId(repoId);
    }

    @Override
    public List<DriftAlert> getAlertsByPr(Long repoId, Integer prNumber) {
        return driftAlertRepository.findByRepoIdAndPrNumber(repoId, prNumber);
    }
}
