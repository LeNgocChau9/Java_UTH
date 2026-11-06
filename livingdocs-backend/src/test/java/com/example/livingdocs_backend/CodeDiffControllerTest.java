package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.dto.drift.AffectedDocumentResultDto;
import com.example.livingdocs_backend.application.port.CodeDiffAnalysisServicePort;
import com.example.livingdocs_backend.application.port.DocDriftDetectionServicePort;
import com.example.livingdocs_backend.infrastructure.web.controller.CodeDiffController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CodeDiffControllerTest {

    @Mock
    private CodeDiffAnalysisServicePort codeDiffAnalysisService;

    @Mock
    private DocDriftDetectionServicePort docDriftDetectionService;

    private CodeDiffController controller;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        controller = new CodeDiffController(codeDiffAnalysisService, docDriftDetectionService);
    }

    @Test
    @DisplayName("GET /api/code-diff/repositories/{repoId}/pull-requests/{prNumber}/affected-documents: Trả về 200 OK kèm danh sách tài liệu bị ảnh hưởng")
    void testGetAffectedDocumentsForPr() {
        Long repoId = 1L;
        int prNumber = 12;

        AffectedDocumentResultDto mockDoc = AffectedDocumentResultDto.builder()
                .documentId(5L)
                .documentTitle("User Service Guide")
                .documentPath("docs/user.md")
                .relatedFilePath("src/UserService.java")
                .className("UserService")
                .methodName("deleteAccount")
                .changeType("DELETED")
                .severity("CRITICAL")
                .details("Hàm xóa tài khoản bị xóa")
                .build();

        when(docDriftDetectionService.findAffectedDocumentsForPullRequest(eq(repoId), eq(prNumber)))
                .thenReturn(List.of(mockDoc));

        ResponseEntity<List<AffectedDocumentResultDto>> response = controller.getAffectedDocumentsForPr(repoId,
                prNumber);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertEquals("CRITICAL", response.getBody().get(0).severity());
        assertEquals("User Service Guide", response.getBody().get(0).documentTitle());
    }

    @Test
    @DisplayName("POST /api/code-diff/repositories/{repoId}/affected-docs: Truy vấn tài liệu bị ảnh hưởng từ body gửi lên")
    void testGetAffectedDocumentsFromBody() {
        Long repoId = 1L;
        AstDiffRequestDto requestDto = AstDiffRequestDto.builder()
                .repository_id(repoId)
                .pr_number(5)
                .files(Collections.emptyList())
                .build();

        when(docDriftDetectionService.findAffectedDocuments(eq(repoId), eq(requestDto)))
                .thenReturn(Collections.emptyList());

        ResponseEntity<List<AffectedDocumentResultDto>> response = controller.getAffectedDocuments(repoId, requestDto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().isEmpty());
    }

    @Test
    @DisplayName("POST /api/code-diff/analyze: Đối chiếu AST trả về AstDiffResponseDto")
    void testAnalyzeDiff() {
        AstDiffRequestDto requestDto = AstDiffRequestDto.builder().build();
        AstDiffResponseDto mockResponse = AstDiffResponseDto.builder().status("success").build();

        when(codeDiffAnalysisService.analyzeAstDiff(requestDto)).thenReturn(mockResponse);

        ResponseEntity<AstDiffResponseDto> response = controller.analyzeDiff(requestDto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("success", response.getBody().status());
    }
}
