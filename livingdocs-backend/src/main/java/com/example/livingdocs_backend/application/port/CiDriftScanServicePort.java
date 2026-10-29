package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.drift.CiDriftScanRequest;
import com.example.livingdocs_backend.application.dto.drift.CiDriftScanResponse;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.domain.model.DriftAlert;

import java.util.List;

public interface CiDriftScanServicePort {
    CiDriftScanResponse processCiDriftScan(CiDriftScanRequest request, CiToken ciToken);
    List<DriftAlert> getAlertsByRepo(Long repoId);
    List<DriftAlert> getAlertsByPr(Long repoId, Integer prNumber);
}
