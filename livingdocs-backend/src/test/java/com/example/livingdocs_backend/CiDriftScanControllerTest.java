package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.drift.CiDriftScanRequest;
import com.example.livingdocs_backend.application.dto.drift.CiDriftScanResponse;
import com.example.livingdocs_backend.application.dto.drift.DriftScanItemDto;
import com.example.livingdocs_backend.application.port.CiDriftScanServicePort;
import com.example.livingdocs_backend.application.port.CiTokenServicePort;
import com.example.livingdocs_backend.domain.model.CiToken;
import com.example.livingdocs_backend.domain.model.DriftAlert;
import com.example.livingdocs_backend.infrastructure.web.controller.CiDriftScanController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CiDriftScanControllerTest {

    @Mock
    private CiDriftScanServicePort ciDriftScanService;

    @Mock
    private CiTokenServicePort ciTokenService;

    private CiDriftScanController controller;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        controller = new CiDriftScanController(ciDriftScanService, ciTokenService);
    }

    @Test
    @DisplayName("401 khi không cung cấp CI Token")
    void testMissingToken() {
        CiDriftScanRequest req = CiDriftScanRequest.builder().repoId(1L).build();
        ResponseEntity<?> resp = controller.receiveDriftScan(null, null, req);

        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
        assertTrue(resp.getBody().toString().contains("401"));
    }

    @Test
    @DisplayName("401 khi token sai, hết hạn hoặc bị thu hồi")
    void testInvalidOrRevokedToken() {
        when(ciTokenService.validateAndTouchToken("ld_ci_invalid")).thenReturn(Optional.empty());

        CiDriftScanRequest req = CiDriftScanRequest.builder().repoId(1L).build();
        ResponseEntity<?> resp = controller.receiveDriftScan("ld_ci_invalid", null, req);

        assertEquals(HttpStatus.UNAUTHORIZED, resp.getStatusCode());
    }

    @Test
    @DisplayName("403 khi token bị giới hạn cho repo khác")
    void testForbiddenDifferentRepo() {
        CiToken token = CiToken.builder()
                .tokenId(10L)
                .tokenPrefix("ld_ci_abc123")
                .repositoryId(99L) // Token gán cho repo 99
                .build();
        when(ciTokenService.validateAndTouchToken("ld_ci_valid")).thenReturn(Optional.of(token));

        CiDriftScanRequest req = CiDriftScanRequest.builder().repoId(1L).build(); // Request gửi cho repo 1
        ResponseEntity<?> resp = controller.receiveDriftScan("ld_ci_valid", null, req);

        assertEquals(HttpStatus.FORBIDDEN, resp.getStatusCode());
    }

    @Test
    @DisplayName("200 Tiếp nhận và lưu thành công kết quả quét drift từ CI")
    void testSuccessDriftScan() {
        CiToken token = CiToken.builder()
                .tokenId(10L)
                .tokenPrefix("ld_ci_abc123")
                .repositoryId(1L)
                .build();
        when(ciTokenService.validateAndTouchToken("ld_ci_valid")).thenReturn(Optional.of(token));

        DriftScanItemDto item = DriftScanItemDto.builder()
                .filePath("src/main/java/PaymentService.java")
                .methodName("processPayment")
                .changeType("PARAM_CHANGED")
                .severity("HIGH")
                .diffSnippet("- void processPayment(Long id)\n+ void processPayment(Long id, String curr)")
                .build();

        CiDriftScanRequest req = CiDriftScanRequest.builder()
                .repoId(1L)
                .prNumber(105)
                .commitHash("c105hash")
                .branch("feature/pay")
                .alerts(List.of(item))
                .build();

        CiDriftScanResponse mockResp = CiDriftScanResponse.builder()
                .status("SUCCESS")
                .repoId(1L)
                .prNumber(105)
                .totalAlertsRecorded(1)
                .receivedAt(Instant.now())
                .alertIds(List.of(1001L))
                .build();

        when(ciDriftScanService.processCiDriftScan(eq(req), eq(token))).thenReturn(mockResp);

        ResponseEntity<?> resp = controller.receiveDriftScan(null, "Bearer ld_ci_valid", req);

        assertEquals(HttpStatus.OK, resp.getStatusCode());
        CiDriftScanResponse body = (CiDriftScanResponse) resp.getBody();
        assertNotNull(body);
        assertEquals(1, body.getTotalAlertsRecorded());
        assertEquals("SUCCESS", body.getStatus());
    }
}

