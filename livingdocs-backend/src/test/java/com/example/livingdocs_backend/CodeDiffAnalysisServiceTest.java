package com.example.livingdocs_backend;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Optional;

import com.example.livingdocs_backend.application.dto.ai.AstDiffResponseDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPrFileDto;
import com.example.livingdocs_backend.application.dto.github.GitHubPullRequestDto;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import com.example.livingdocs_backend.application.dto.ai.AstDiffRequestDto;
import com.example.livingdocs_backend.application.service.CodeDiffAnalysisService;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentChangeAlertEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocumentChangeAlertRepository;

class CodeDiffAnalysisServiceTest {

        @Mock
        private SpringDataDocumentChangeAlertRepository alertRepository;

        @Mock
        private CodeEntityRepositoryPort codeEntityRepository;

        @Mock
        private SpringDataRepositoryRepository repositoryRepository;

        @Mock
        private SpringDataGitHubConnectionRepository connectionRepository;

        @Mock
        private GitHubClientPort gitHubClient;

        @Mock
        private org.springframework.web.client.RestClient restClient;

        private CodeDiffAnalysisService codeDiffAnalysisService;

        @BeforeEach
        void setUp() {
                MockitoAnnotations.openMocks(this);
                lenient().when(restClient.post()).thenThrow(new RuntimeException("AI engine offline in test"));
                codeDiffAnalysisService = new CodeDiffAnalysisService(
                                alertRepository,
                                codeEntityRepository,
                                repositoryRepository,
                                connectionRepository,
                                gitHubClient,
                                restClient);
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
                                                                .build()))
                                .build();

                when(alertRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

                List<DocumentChangeAlertEntity> alerts = codeDiffAnalysisService.processPullRequestCodeDiff(repoId,
                                prId, requestDto);

                assertNotNull(alerts);
                assertFalse(alerts.isEmpty());
                assertEquals(1, alerts.size());
                assertEquals("REFERENCE", alerts.get(0).getClassification());
                assertEquals("CRITICAL", alerts.get(0).getSeverity());
                assertEquals("OPEN", alerts.get(0).getStatus());
                assertEquals("head456", alerts.get(0).getSourceCommit());

                verify(alertRepository, times(1)).saveAll(any());
        }

        @Test
        @DisplayName("Kéo Git Diff từ GitHub API: Lọc các file .java, .py, .ts và lấy nội dung Base/Head code")
        void testFetchPullRequestDiff() {
                Long repoId = 1L;
                int prNumber = 15;

                RepositoryEntity repo = RepositoryEntity.builder()
                                .repositoryId(repoId)
                                .repoFullName("owner/my-project")
                                .build();
                when(repositoryRepository.findById(repoId)).thenReturn(Optional.of(repo));

                GitHubPullRequestDto prDto = GitHubPullRequestDto.builder()
                                .number(prNumber)
                                .baseCommitSha("base_sha_111")
                                .headCommitSha("head_sha_222")
                                .build();
                when(gitHubClient.getPullRequest(any(), eq("owner"), eq("my-project"), eq(prNumber))).thenReturn(prDto);

                List<GitHubPrFileDto> files = List.of(
                                GitHubPrFileDto.builder().filename("src/Service.java").status("modified").build(),
                                GitHubPrFileDto.builder().filename("scripts/calc.py").status("added").build(),
                                GitHubPrFileDto.builder().filename("web/api.ts").status("modified").build(),
                                GitHubPrFileDto.builder().filename("README.md").status("modified").build() // Bỏ qua
                                                                                                           // file .md
                );
                when(gitHubClient.getPullRequestFiles(any(), eq("owner"), eq("my-project"), eq(prNumber)))
                                .thenReturn(files);

                when(gitHubClient.getFileContent(any(), eq("owner"), eq("my-project"), eq("src/Service.java"),
                                eq("base_sha_111")))
                                .thenReturn("public class Service { public void execute(int a) {} }");
                when(gitHubClient.getFileContent(any(), eq("owner"), eq("my-project"), eq("src/Service.java"),
                                eq("head_sha_222")))
                                .thenReturn("public class Service { public void execute(int a, String b) {} }");

                when(gitHubClient.getFileContent(any(), eq("owner"), eq("my-project"), eq("scripts/calc.py"),
                                eq("head_sha_222")))
                                .thenReturn("def calculate(x, y):\n    return x + y");

                when(gitHubClient.getFileContent(any(), eq("owner"), eq("my-project"), eq("web/api.ts"),
                                eq("base_sha_111")))
                                .thenReturn("function fetchData(url: string) {}");
                when(gitHubClient.getFileContent(any(), eq("owner"), eq("my-project"), eq("web/api.ts"),
                                eq("head_sha_222")))
                                .thenReturn("function fetchData(url: string, timeout: number) {}");

                AstDiffRequestDto result = codeDiffAnalysisService.fetchPullRequestDiff(repoId, prNumber);

                assertNotNull(result);
                assertEquals(repoId, result.repository_id());
                assertEquals(prNumber, result.pr_number());
                assertEquals("base_sha_111", result.base_commit_hash());
                assertEquals("head_sha_222", result.head_commit_hash());
                // README.md bị bỏ qua, chỉ có 3 file .java, .py, .ts
                assertEquals(3, result.files().size());
                assertEquals("src/Service.java", result.files().get(0).file_path());
                assertEquals("scripts/calc.py", result.files().get(1).file_path());
                assertEquals("web/api.ts", result.files().get(2).file_path());
        }

        @Test
        @DisplayName("Đối chiếu AST Fallback: Bóc tách chính xác các hàm bị xóa, thêm mới, đổi tham số trong .java, .py, .ts")
        void testFallbackAstDiffMultiLanguage() {
                AstDiffRequestDto requestDto = AstDiffRequestDto.builder()
                                .repository_id(1L)
                                .pr_number(1)
                                .files(List.of(
                                                AstDiffRequestDto.FileDiffItemDto.builder()
                                                                .file_path("UserService.java")
                                                                .base_code("public class UserService { public void deleteUser(Long id) {} public void oldMethod() {} }")
                                                                .head_code("public class UserService { public void deleteUser(Long id, boolean force) {} public void newMethod() {} }")
                                                                .build(),
                                                AstDiffRequestDto.FileDiffItemDto.builder()
                                                                .file_path("helper.py")
                                                                .base_code("def compute_hash(data):\n    pass\ndef old_py():\n    pass")
                                                                .head_code("def compute_hash(data, salt):\n    pass")
                                                                .build()))
                                .build();

                AstDiffResponseDto response = codeDiffAnalysisService.analyzeAstDiff(requestDto);

                assertNotNull(response);
                assertEquals(2, response.files().size());

                // Kiểm tra file Java
                var javaFile = response.files().get(0);
                assertTrue(javaFile.affected_entities().stream().anyMatch(e -> "deleteUser".equals(e.method_name())
                                && "PARAM_CHANGED".equals(e.change_type()) && "HIGH".equals(e.impact_level())));
                assertTrue(javaFile.affected_entities().stream().anyMatch(e -> "oldMethod".equals(e.method_name())
                                && "DELETED".equals(e.change_type()) && "CRITICAL".equals(e.impact_level())));
                assertTrue(javaFile.affected_entities().stream().anyMatch(e -> "newMethod".equals(e.method_name())
                                && "ADDED".equals(e.change_type()) && "LOW".equals(e.impact_level())));

                // Kiểm tra file Python
                var pyFile = response.files().get(1);
                assertTrue(pyFile.affected_entities().stream().anyMatch(e -> "old_py".equals(e.method_name())
                                && "DELETED".equals(e.change_type()) && "CRITICAL".equals(e.impact_level())));
                assertTrue(pyFile.affected_entities().stream().anyMatch(e -> "compute_hash".equals(e.method_name())
                                && "PARAM_CHANGED".equals(e.change_type())));
        }
}
