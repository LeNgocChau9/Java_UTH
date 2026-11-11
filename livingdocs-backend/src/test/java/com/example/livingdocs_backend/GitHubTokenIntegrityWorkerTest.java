package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.github.GitHubConnectionStatusResponse;
import com.example.livingdocs_backend.application.port.RepositoryServicePort;
import com.example.livingdocs_backend.infrastructure.worker.GitHubTokenIntegrityWorker;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GitHubTokenIntegrityWorkerTest {

    @Mock
    private RepositoryServicePort repositoryServicePort;

    @InjectMocks
    private GitHubTokenIntegrityWorker tokenIntegrityWorker;

    @Test
    @DisplayName("Worker quét định kỳ phát hiện token bị thu hồi (REVOKED) và không làm gián đoạn hệ thống")
    void shouldDetectRevokedTokenAndLogWarningWithoutCrashing() {
        ReflectionTestUtils.setField(tokenIntegrityWorker, "enabled", true);

        GitHubConnectionStatusResponse revokedConn = GitHubConnectionStatusResponse.builder()
                .connectionId(10L)
                .workspaceId(1L)
                .userId(2L)
                .githubUsername("developer-revoked")
                .status("REVOKED")
                .valid(false)
                .tokenExpiresAt(null)
                .lastCheckedAt(Instant.now())
                .warningMessage("CẢNH BÁO BẢO MẬT: Token đã bị thu hồi trên GitHub")
                .renewUrl("/api/auth/github?mode=link")
                .build();

        GitHubConnectionStatusResponse validConn = GitHubConnectionStatusResponse.builder()
                .connectionId(11L)
                .workspaceId(1L)
                .userId(3L)
                .githubUsername("developer-valid")
                .status("CONNECTED")
                .valid(true)
                .lastCheckedAt(Instant.now())
                .build();

        when(repositoryServicePort.verifyWorkspaceConnections(isNull(), isNull()))
                .thenReturn(List.of(revokedConn, validConn));

        assertDoesNotThrow(() -> tokenIntegrityWorker.scanAndVerifyGitHubTokens());

        verify(repositoryServicePort, times(1)).verifyWorkspaceConnections(isNull(), isNull());
    }

    @Test
    @DisplayName("Worker xử lý ngoại lệ an toàn khi GitHub API gặp sự cố mạng mà không ném lỗi ra ngoài")
    void shouldHandleExceptionGracefullyWhenVerificationFails() {
        ReflectionTestUtils.setField(tokenIntegrityWorker, "enabled", true);

        when(repositoryServicePort.verifyWorkspaceConnections(isNull(), isNull()))
                .thenThrow(new RuntimeException("GitHub API connection timeout"));

        assertDoesNotThrow(() -> tokenIntegrityWorker.scanAndVerifyGitHubTokens());

        verify(repositoryServicePort, times(1)).verifyWorkspaceConnections(isNull(), isNull());
    }
}
