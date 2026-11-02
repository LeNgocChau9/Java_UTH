package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.CreateDocumentRequest;
import com.example.livingdocs_backend.application.dto.DocumentResponse;
import com.example.livingdocs_backend.application.dto.DocumentVersionResponse;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateRequestDto;
import com.example.livingdocs_backend.application.dto.ai.AiDocGenerateResponseDto;
import com.example.livingdocs_backend.application.port.CodeIndexServicePort;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.application.port.GitHubClientPort;
import com.example.livingdocs_backend.application.service.AiDocumentationService;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.model.DocumentStatus;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocCodeLinkEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.RepositoryEntity;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataDocCodeLinkRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataGitHubConnectionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataRepositoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiDocumentationServiceTest {

    @Mock
    private RestClient restClient;

    @Mock
    private DocumentServicePort documentServicePort;

    @Mock
    private CodeEntityRepositoryPort codeEntityRepository;

    @Mock
    private CodeIndexServicePort codeIndexService;

    @Mock
    private SpringDataDocCodeLinkRepository docCodeLinkRepository;

    @Mock
    private SpringDataRepositoryRepository repositoryRepository;

    @Mock
    private SpringDataGitHubConnectionRepository gitHubConnectionRepository;

    @Mock
    private DocTemplateRepository docTemplateRepository;

    @Mock
    private GitHubClientPort gitHubClient;

    private AiDocumentationService aiDocumentationService;

    private RepositoryEntity sampleRepo;

    @BeforeEach
    void setUp() {
        aiDocumentationService = new AiDocumentationService(
                restClient,
                documentServicePort,
                codeEntityRepository,
                codeIndexService,
                docCodeLinkRepository,
                repositoryRepository,
                gitHubConnectionRepository,
                docTemplateRepository,
                gitHubClient
        );

        sampleRepo = RepositoryEntity.builder()
                .repositoryId(1L)
                .workspaceId(1L)
                .repoName("Java_UTH")
                .repoFullName("LeNgocChau9/Java_UTH")
                .defaultBranch("main")
                .build();
    }

    @Test
    @DisplayName("Phạm vi FILE: Lấy mã nguồn/AST 1 file, lưu vào documents & document_versions (DRAFT) và doc_code_links")
    void generateDocumentation_fileScope_createsDraftAndLinks() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(sampleRepo));

        String filePath = "src/main/java/com/example/OrderService.java";
        List<CodeEntity> fileEntities = List.of(
                CodeEntity.builder()
                        .entityId(10L)
                        .repositoryId(1L)
                        .filePath(filePath)
                        .entityType("CLASS")
                        .className("OrderService")
                        .signature("public class OrderService")
                        .startLine(1)
                        .endLine(50)
                        .commitHash("abc1234")
                        .docStatus("DOCUMENTED")
                        .build(),
                CodeEntity.builder()
                        .entityId(11L)
                        .repositoryId(1L)
                        .filePath(filePath)
                        .entityType("METHOD")
                        .className("OrderService")
                        .methodName("createOrder")
                        .signature("public Order createOrder(Long userId)")
                        .returnType("Order")
                        .parameters("Long userId")
                        .startLine(12)
                        .endLine(30)
                        .commitHash("abc1234")
                        .docStatus("DOCUMENTED")
                        .build()
        );
        when(codeEntityRepository.findByRepositoryIdAndFilePath(1L, filePath)).thenReturn(fileEntities);

        DocumentResponse createdDoc = DocumentResponse.builder()
                .docId(100L)
                .repoId(1L)
                .title("Tài liệu File - OrderService (API_REFERENCE)")
                .targetPath("docs/files/" + filePath + ".md")
                .status(DocumentStatus.DRAFT)
                .currentVersion(1)
                .latestVersion(DocumentVersionResponse.builder().versionId(200L).versionNum(1).hash("sha256-v1").build())
                .build();

        when(documentServicePort.createDocument(any(CreateDocumentRequest.class), any(), any()))
                .thenReturn(createdDoc);
        when(docCodeLinkRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        AiDocGenerateRequestDto req = AiDocGenerateRequestDto.builder()
                .repository_id(1L)
                .scope("FILE")
                .file_path(filePath)
                .template_type("API_REFERENCE")
                .build();

        AiDocGenerateResponseDto res = aiDocumentationService.generateDocumentation(req, 5L, "DEV");

        assertNotNull(res);
        assertEquals(100L, res.docId());
        assertEquals("FILE", res.scope());
        assertEquals("DRAFT", res.documentStatus());
        assertEquals(2, res.linkedEntitiesCount());
        assertNotNull(res.generated_content());
        assertTrue(res.generated_content().contains("OrderService"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<DocCodeLinkEntity>> linksCaptor = ArgumentCaptor.forClass(List.class);
        verify(docCodeLinkRepository).saveAll(linksCaptor.capture());
        assertEquals(2, linksCaptor.getValue().size());
        assertEquals(100L, linksCaptor.getValue().get(0).getDocumentId());
    }

    @Test
    @DisplayName("Phạm vi PACKAGE: Quét toàn bộ file trong package, tổng hợp tài liệu mô-đun DRAFT và lưu doc_code_links")
    void generateDocumentation_packageScope_scansPackageFilesAndSavesLinks() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(sampleRepo));

        List<CodeEntity> repoEntities = List.of(
                CodeEntity.builder()
                        .entityId(21L)
                        .repositoryId(1L)
                        .filePath("src/main/java/com/example/payment/PaymentService.java")
                        .entityType("METHOD")
                        .className("PaymentService")
                        .methodName("charge")
                        .startLine(10)
                        .endLine(25)
                        .commitHash("def5678")
                        .build(),
                CodeEntity.builder()
                        .entityId(22L)
                        .repositoryId(1L)
                        .filePath("src/main/java/com/example/payment/RefundService.java")
                        .entityType("METHOD")
                        .className("RefundService")
                        .methodName("refund")
                        .startLine(8)
                        .endLine(20)
                        .commitHash("def5678")
                        .build()
        );
        when(codeEntityRepository.findByRepositoryId(1L)).thenReturn(repoEntities);

        DocumentResponse createdDoc = DocumentResponse.builder()
                .docId(101L)
                .repoId(1L)
                .title("Tài liệu Mô-đun (Package) - com.example.payment")
                .targetPath("docs/modules/src/main/java/com/example/payment/MODULE.md")
                .status(DocumentStatus.DRAFT)
                .currentVersion(1)
                .build();

        when(documentServicePort.createDocument(any(CreateDocumentRequest.class), any(), any()))
                .thenReturn(createdDoc);
        when(docCodeLinkRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        AiDocGenerateRequestDto req = AiDocGenerateRequestDto.builder()
                .repository_id(1L)
                .scope("PACKAGE")
                .target_path("src/main/java/com/example/payment")
                .template_type("MODULE_GUIDE")
                .build();

        AiDocGenerateResponseDto res = aiDocumentationService.generateDocumentation(req, 5L, "DEV");

        assertNotNull(res);
        assertEquals(101L, res.docId());
        assertEquals("PACKAGE", res.scope());
        assertEquals("DRAFT", res.documentStatus());
        assertEquals(2, res.linkedEntitiesCount());
        assertTrue(res.generated_content().contains("PaymentService"));
        assertTrue(res.generated_content().contains("RefundService"));
    }

    @Test
    @DisplayName("Phạm vi REPOSITORY: Sinh tài liệu README / Kiến trúc toàn hệ thống DRAFT và lưu doc_code_links")
    void generateDocumentation_repositoryScope_createsRepoArchitectureDraft() {
        when(repositoryRepository.findById(1L)).thenReturn(Optional.of(sampleRepo));

        List<CodeEntity> repoEntities = List.of(
                CodeEntity.builder()
                        .entityId(31L)
                        .repositoryId(1L)
                        .filePath("src/main/java/com/example/Application.java")
                        .entityType("CLASS")
                        .className("Application")
                        .methodName("main")
                        .startLine(1)
                        .endLine(15)
                        .commitHash("999aaaa")
                        .build()
        );
        when(codeEntityRepository.findByRepositoryId(1L)).thenReturn(repoEntities);

        DocumentResponse createdDoc = DocumentResponse.builder()
                .docId(102L)
                .repoId(1L)
                .title("README & Tổng quan Kiến trúc - Java_UTH")
                .targetPath("README.md")
                .status(DocumentStatus.DRAFT)
                .currentVersion(1)
                .build();

        when(documentServicePort.createDocument(any(CreateDocumentRequest.class), any(), any()))
                .thenReturn(createdDoc);
        when(docCodeLinkRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        AiDocGenerateRequestDto req = AiDocGenerateRequestDto.builder()
                .repository_id(1L)
                .scope("REPOSITORY")
                .template_type("README")
                .build();

        AiDocGenerateResponseDto res = aiDocumentationService.generateDocumentation(req, 5L, "DEV");

        assertNotNull(res);
        assertEquals(102L, res.docId());
        assertEquals("REPOSITORY", res.scope());
        assertEquals("DRAFT", res.documentStatus());
        assertEquals("README.md", res.targetPath());
        assertEquals(1, res.linkedEntitiesCount());
        assertTrue(res.generated_content().contains("Java_UTH"));
    }
}

