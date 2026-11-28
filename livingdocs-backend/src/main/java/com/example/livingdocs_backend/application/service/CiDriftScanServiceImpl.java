package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.drift.CiDriftScanRequest;
import com.example.livingdocs_backend.application.dto.drift.CiDriftScanResponse;
import com.example.livingdocs_backend.application.dto.drift.DriftScanItemDto;
import com.example.livingdocs_backend.application.port.CiDriftScanServicePort;
import com.example.livingdocs_backend.application.port.DriftAlertRepositoryPort;
import com.example.livingdocs_backend.domain.exception.AuthenticationException;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.domain.model.DriftAlert;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.example.livingdocs_backend.infrastructure.security.TenantAccessService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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

    @Autowired(required = false)
    private SpringDataDocumentChangeAlertRepository documentChangeAlertRepository;

    @Autowired(required = false)
    private SpringDataRepositoryRepository repositoryRepository;

    @Autowired(required = false)
    private TenantAccessService tenantAccessService;

    @Override
    @Transactional
    public CiDriftScanResponse processCiDriftScan(CiDriftScanRequest request, CiToken ciToken) {
        log.info("[CI Drift Scan] Tiếp nhận kết quả quét từ GitHub Action. repoId={}, prNumber={}, tokenPrefix={}",
                request.getRepoId(), request.getPrNumber(), ciToken != null ? ciToken.getTokenPrefix() : "N/A");

        // Kiểm tra cách ly multi-tenant: CI Token phải thuộc cùng doanh nghiệp với Repository mục tiêu
        if (ciToken != null && ciToken.getWorkspaceId() != null && request.getRepoId() != null && repositoryRepository != null) {
            RepositoryEntity targetRepo = repositoryRepository.findById(request.getRepoId()).orElse(null);
            if (targetRepo != null && targetRepo.getWorkspaceId() != null
                    && !ciToken.getWorkspaceId().equals(targetRepo.getWorkspaceId())) {
                throw AuthenticationException.forbidden(
                        TenantAccessService.ERR_TENANT_DENIED,
                        "CI Token không có quyền ghi nhận dữ liệu cho kho mã nguồn thuộc doanh nghiệp khác."
                );
            }
        }

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

            // Nếu CI chưa gắn sẵn documentId, tra cứu tự động trong phạm vi repository (tránh cross-tenant)
            if (docId == null && request.getRepoId() != null) {
                List<DocCodeLinkEntity> links = docCodeLinkRepository.findMatchingLinksByRepositoryId(
                        request.getRepoId(), item.getFilePath(), null, item.getMethodName());
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
        if (tenantAccessService != null) {
            tenantAccessService.requireRepositoryAccess(repoId);
        }
        return driftAlertRepository.findByRepoId(repoId);
    }

    @Override
    public List<DriftAlert> getAlertsByPr(Long repoId, Integer prNumber) {
        if (tenantAccessService != null) {
            tenantAccessService.requireRepositoryAccess(repoId);
        }
        return driftAlertRepository.findByRepoIdAndPrNumber(repoId, prNumber);
    }
}
