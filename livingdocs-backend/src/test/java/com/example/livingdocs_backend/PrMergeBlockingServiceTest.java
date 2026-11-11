package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.drift.PrMergeBlockingPolicyDto;
import com.example.livingdocs_backend.application.dto.github.GitHubCheckRunResultDto;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.service.PrMergeBlockingServiceImpl;
import com.example.livingdocs_backend.domain.model.Document;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.repository.DocumentRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.AdminSettingEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.PullRequestEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataAdminSettingRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataPullRequestRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PrMergeBlockingServiceTest {

    @Mock
    private SpringDataAdminSettingRepository adminSettingRepository;
    @Mock
    private SpringDataDocumentChangeAlertRepository alertRepository;
    @Mock
    private SpringDataPullRequestRepository pullRequestRepository;
    @Mock
    private SpringDataRepositoryRepository repositoryRepository;
    @Mock
    private SpringDataGitHubConnectionRepository gitHubConnectionRepository;
    @Mock
    private DocumentRepositoryPort documentRepositoryPort;
    @Mock
    private GitHubClientPort gitHubClient;

    private ObjectMapper objectMapper;
    private PrMergeBlockingServiceImpl prMergeBlockingService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        prMergeBlockingService = new PrMergeBlockingServiceImpl(
                adminSettingRepository,
                alertRepository,
                pullRequestRepository,
                repositoryRepository,
                gitHubConnectionRepository,
                documentRepositoryPort,
                gitHubClient,
                objectMapper
        );
    }

    @Test
    @DisplayName("Lấy cấu hình mặc định khi chưa có trong CSDL")
    void testGetDefaultPolicy() {
        when(adminSettingRepository.findById(PrMergeBlockingServiceImpl.PR_BLOCKING_SETTING_KEY))
                .thenReturn(Optional.empty());

        PrMergeBlockingPolicyDto policy = prMergeBlockingService.getBlockingPolicy();
        assertNotNull(policy);
        assertTrue(policy.getEnabled());
        assertEquals("STRICT", policy.getBlockingMode());
        assertEquals("CRITICAL", policy.getMinSeverity());
    }

    @Test
    @DisplayName("Cập nhật cấu hình chính sách chặn PR thành công")
    void testUpdatePolicy() {
        when(adminSettingRepository.findById(PrMergeBlockingServiceImpl.PR_BLOCKING_SETTING_KEY))
                .thenReturn(Optional.empty());
        when(adminSettingRepository.save(any(AdminSettingEntity.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        PrMergeBlockingPolicyDto request = PrMergeBlockingPolicyDto.builder()
                .enabled(true)
                .blockingMode("WARN_ONLY")
                .minSeverity("HIGH")
                .checkName("LivingDocs Quality Gate")
                .autoUnlockOnApproval(true)
                .build();

        PrMergeBlockingPolicyDto saved = prMergeBlockingService.updateBlockingPolicy(request, 1L, "admin@livingdocs.com");
        assertEquals("WARN_ONLY", saved.getBlockingMode());
        assertEquals("HIGH", saved.getMinSeverity());
        assertEquals("admin@livingdocs.com", saved.getUpdatedBy());
        verify(adminSettingRepository, times(1)).save(any(AdminSettingEntity.class));
    }

    @Test
    @DisplayName("Phát hiện CRITICAL drift -> Gửi Check Run BÁO ĐỎ (failure) khi ở chế độ STRICT")
    void testEvaluateAndSendPrCheck_CriticalDrift_StrictBlock() {
        // Cấu hình STRICT
        when(adminSettingRepository.findById(anyString())).thenReturn(Optional.empty());

        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(1L)
                .repoFullName("LeNgocChau9/Java_UTH")
                .build();
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(repo));

        PullRequestEntity pr = PullRequestEntity.builder()
                .prId(10L)
                .repositoryId(1L)
                .prNumber(42)
                .headCommitHash("sha-abc-123")
                .build();
        when(pullRequestRepository.findByRepositoryIdAndPrNumber(1L, 42)).thenReturn(Optional.of(pr));

        // Có 1 alert CRITICAL đang OPEN
        DocumentChangeAlertEntity alert = DocumentChangeAlertEntity.builder()
                .alertId(100L)
                .sourcePrId(10L)
                .severity("CRITICAL")
                .status("OPEN")
                .build();
        when(alertRepository.findBySourcePrId(10L)).thenReturn(List.of(alert));

        GitHubCheckRunResultDto mockResult = GitHubCheckRunResultDto.builder()
                .conclusion("failure")
                .name("LivingDocs / Doc Drift Guard")
                .headSha("sha-abc-123")
                .build();
        when(gitHubClient.postCheckRun(any(), eq("LeNgocChau9"), eq("Java_UTH"), eq("sha-abc-123"),
                anyString(), eq("completed"), eq("failure"), anyString(), anyString(), anyString()))
                .thenReturn(mockResult);

        GitHubCheckRunResultDto result = prMergeBlockingService.evaluateAndSendPrCheck(1L, 42, "sha-abc-123");
        assertNotNull(result);
        assertEquals("failure", result.getConclusion());
        verify(gitHubClient, times(1)).postCheckRun(any(), any(), any(), any(), any(), eq("completed"), eq("failure"), any(), any(), any());
    }

    @Test
    @DisplayName("Tài liệu được duyệt APPROVED -> Tự động chuyển alert RESOLVED và gửi Check Run BÁO XANH (success)")
    void testNotifyDocumentApproved_AutoUnlocksPr() {
        // Cấu hình bật AutoUnlock
        when(adminSettingRepository.findById(anyString())).thenReturn(Optional.empty());

        Long docId = 55L;
        DocumentChangeAlertEntity alert = DocumentChangeAlertEntity.builder()
                .alertId(200L)
                .documentId(docId)
                .sourcePrId(15L)
                .severity("CRITICAL")
                .status("OPEN")
                .build();
        when(alertRepository.findAll()).thenReturn(List.of(alert));

        Document doc = Document.builder()
                .docId(docId)
                .status(DocumentStatus.APPROVED)
                .build();
        when(documentRepositoryPort.findById(docId)).thenReturn(Optional.of(doc));

        PullRequestEntity pr = PullRequestEntity.builder()
                .prId(15L)
                .repositoryId(2L)
                .prNumber(88)
                .headCommitHash("sha-xyz-789")
                .state("OPEN")
                .build();
        when(pullRequestRepository.findById(15L)).thenReturn(Optional.of(pr));
        when(pullRequestRepository.findByRepositoryIdAndPrNumber(2L, 88)).thenReturn(Optional.of(pr));

        RepositoryEntity repo = RepositoryEntity.builder()
                .repositoryId(2L)
                .repoFullName("LeNgocChau9/PaymentService")
                .build();
        when(repositoryRepository.findById(2L)).thenReturn(Optional.of(repo));

        // Sau khi alert chuyển RESOLVED thì không còn OPEN alert nào
        when(alertRepository.findBySourcePrId(15L)).thenReturn(Collections.emptyList());

        prMergeBlockingService.notifyDocumentApproved(docId);

        // Alert phải được chuyển sang RESOLVED
        assertEquals("RESOLVED", alert.getStatus());
        verify(alertRepository, times(1)).saveAll(anyList());

        // Kiểm tra postCheckRun được gọi với conclusion 'success' (màu xanh hợp lệ)
        verify(gitHubClient, times(1)).postCheckRun(
                any(), eq("LeNgocChau9"), eq("PaymentService"), eq("sha-xyz-789"),
                anyString(), eq("completed"), eq("success"), anyString(), anyString(), anyString()
        );
    }
}

