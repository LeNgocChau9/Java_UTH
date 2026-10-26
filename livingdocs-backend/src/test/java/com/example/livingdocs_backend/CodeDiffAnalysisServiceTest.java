package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.service.CodeDiffAnalysisService;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CodeDiffAnalysisServiceTest {

    @Mock
    private SpringDataDocumentChangeAlertRepository alertRepository;

    @Mock
    private CodeEntityRepositoryPort codeEntityRepository;

    private CodeDiffAnalysisService codeDiffAnalysisService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        // Khởi tạo service ở chế độ fallback
        codeDiffAnalysisService = new CodeDiffAnalysisService(alertRepository, codeEntityRepository, "http://localhost:8000");
    }

    @Test
    @DisplayName("Kiểm thử đối chiếu code PR và tạo DocumentChangeAlert thành công")
    void testProcessPullRequestCodeDiff() {
        Long repoId = 1L;
        Long prId = 101L;

        AstDiffRequestDto requestDto = AstDiffRequestDto.builder()
                .repository_id(repoId)
                .pr_number(12)
                .base_commit_hash("base123")
                .head_commit_hash("head456")
                .files(List.of(
                        AstDiffRequestDto.FileDiffItemDto.builder()
                                .file_path("src/main/java/com/example/UserService.java")
                                .base_code("public class UserService { public void oldMethod() {} }")
                                .head_code("") // file bị xóa
                                .build()
                ))
                .build();

        when(alertRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        List<DocumentChangeAlertEntity> alerts = codeDiffAnalysisService.processPullRequestCodeDiff(repoId, prId, requestDto);

        assertNotNull(alerts);
        assertFalse(alerts.isEmpty());
        assertEquals(1, alerts.size());
        assertEquals("REFERENCE", alerts.get(0).getClassification());
        assertEquals("CRITICAL", alerts.get(0).getSeverity());
        assertEquals("OPEN", alerts.get(0).getStatus());
        assertEquals("head456", alerts.get(0).getSourceCommit());

        verify(alertRepository, times(1)).saveAll(any());
    }
}
