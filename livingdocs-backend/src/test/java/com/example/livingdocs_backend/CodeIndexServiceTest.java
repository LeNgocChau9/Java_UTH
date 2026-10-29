package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.ai.AstExtractResponseDto;
import com.example.livingdocs_backend.application.dto.ai.DocCoverageResponseDto;
import com.example.livingdocs_backend.application.service.CodeIndexService;
import com.example.livingdocs_backend.domain.model.CodeEntity;
import com.example.livingdocs_backend.domain.repository.CodeEntityRepositoryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CodeIndexServiceTest {

    @Mock
    private CodeEntityRepositoryPort codeEntityRepository;

    private CodeIndexService codeIndexService;

    @BeforeEach
    void setUp() {
        // Khởi tạo CodeIndexService với mock repository và base url giả lập
        codeIndexService = spy(new CodeIndexService(codeEntityRepository, "http://localhost:8000"));
    }

    @Test
    @DisplayName("Lập chỉ mục thành công khi nhận phản hồi hợp lệ từ AI Engine và lưu vào database")
    void shouldIndexFileAndSaveEntitiesSuccessfully() {
        // Arrange
        Long repoId = 100L;
        String filePath = "src/com/example/demo/controller/OrderController.java";
        String sourceCode = "public class OrderController { public void createOrder() {} }";
        String commitHash = "hash123";

        AstExtractResponseDto mockResponse = AstExtractResponseDto.builder()
                .status("success")
                .mode("real")
                .file_path(filePath)
                .commit_hash(commitHash)
                .total_entities(2)
                .entities(List.of(
                        AstExtractResponseDto.CodeEntityItemDto.builder()
                                .entity_type("CLASS")
                                .class_name("OrderController")
                                .signature("public class OrderController")
                                .start_line(1)
                                .end_line(20)
                                .doc_status("DOCUMENTED")
                                .javadoc("Controller quản lý đơn hàng")
                                .build(),
                        AstExtractResponseDto.CodeEntityItemDto.builder()
                                .entity_type("METHOD")
                                .class_name("OrderController")
                                .method_name("createOrder")
                                .signature("public void createOrder()")
                                .return_type("void")
                                .start_line(5)
                                .end_line(15)
                                .doc_status("UNDOCUMENTED")
                                .build()
                ))
                .build();

        doReturn(mockResponse).when(codeIndexService).extractAstRaw(eq(repoId), eq(filePath), eq(sourceCode), eq(commitHash));
        when(codeEntityRepository.saveAll(anyList())).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        List<CodeEntity> result = codeIndexService.indexFile(repoId, filePath, sourceCode, commitHash);

        // Assert
        assertThat(result).hasSize(2);
        verify(codeEntityRepository, times(1)).deleteByRepositoryIdAndFilePath(repoId, filePath);
        verify(codeEntityRepository, times(1)).saveAll(anyList());

        CodeEntity classEntity = result.get(0);
        assertThat(classEntity.getClassName()).isEqualTo("OrderController");
        assertThat(classEntity.getEntityType()).isEqualTo("CLASS");
        assertThat(classEntity.getDocStatus()).isEqualTo("DOCUMENTED");

        CodeEntity methodEntity = result.get(1);
        assertThat(methodEntity.getMethodName()).isEqualTo("createOrder");
        assertThat(methodEntity.getEntityType()).isEqualTo("METHOD");
        assertThat(methodEntity.getReturnType()).isEqualTo("void");
    }

    @Test
    @DisplayName("Trả về danh sách rỗng nếu AI Engine không bóc tách được entity nào")
    void shouldReturnEmptyListWhenAiEngineReturnsNoEntities() {
        // Arrange
        Long repoId = 100L;
        String filePath = "Empty.java";
        String sourceCode = "// comment only";

        AstExtractResponseDto emptyResponse = AstExtractResponseDto.builder()
                .status("success")
                .mode("real")
                .file_path(filePath)
                .commit_hash("hash")
                .total_entities(0)
                .entities(List.of())
                .build();

        doReturn(emptyResponse).when(codeIndexService).extractAstRaw(any(), any(), any(), any());

        // Act
        List<CodeEntity> result = codeIndexService.indexFile(repoId, filePath, sourceCode, "hash");

        // Assert
        assertThat(result).isEmpty();
        verify(codeEntityRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("Lấy danh sách entity theo Repository ID")
    void shouldGetEntitiesByRepository() {
        Long repoId = 1L;
        when(codeEntityRepository.findByRepositoryId(repoId))
                .thenReturn(List.of(CodeEntity.builder().repositoryId(repoId).className("Test").build()));

        List<CodeEntity> result = codeIndexService.getEntitiesByRepository(repoId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getClassName()).isEqualTo("Test");
    }

    @Test
    @DisplayName("Tính toán tỷ lệ bao phủ tài liệu (% Coverage) chính xác cho Repository")
    void shouldCalculateRepositoryCoverageAccurately() {
        Long repoId = 1L;
        List<CodeEntity> mockEntities = List.of(
                CodeEntity.builder().repositoryId(repoId).entityType("CLASS").docStatus("DOCUMENTED").build(),
                CodeEntity.builder().repositoryId(repoId).entityType("METHOD").docStatus("DOCUMENTED").build(),
                CodeEntity.builder().repositoryId(repoId).entityType("METHOD").docStatus("UNDOCUMENTED").build(),
                CodeEntity.builder().repositoryId(repoId).entityType("CONSTRUCTOR").docStatus("UNDOCUMENTED").build()
        );

        when(codeEntityRepository.findByRepositoryId(repoId)).thenReturn(mockEntities);

        DocCoverageResponseDto coverage = codeIndexService.calculateRepositoryCoverage(repoId);

        assertThat(coverage).isNotNull();
        assertThat(coverage.getRepositoryId()).isEqualTo(repoId);
        assertThat(coverage.getTotalEntities()).isEqualTo(4);
        assertThat(coverage.getDocumentedEntities()).isEqualTo(2);
        assertThat(coverage.getUndocumentedEntities()).isEqualTo(2);
        assertThat(coverage.getCoveragePercentage()).isEqualTo(50.0);
        assertThat(coverage.getByEntityType()).containsEntry("CLASS", 1).containsEntry("METHOD", 2).containsEntry("CONSTRUCTOR", 1);
        assertThat(coverage.getDocumentedByEntityType()).containsEntry("CLASS", 1).containsEntry("METHOD", 1);
    }

    @Test
    @DisplayName("Trả về 0% coverage khi repository không có thực thể mã nào")
    void shouldReturnZeroCoverageWhenRepositoryIsEmpty() {
        Long repoId = 2L;
        when(codeEntityRepository.findByRepositoryId(repoId)).thenReturn(Collections.emptyList());

        DocCoverageResponseDto coverage = codeIndexService.calculateRepositoryCoverage(repoId);

        assertThat(coverage).isNotNull();
        assertThat(coverage.getTotalEntities()).isEqualTo(0);
        assertThat(coverage.getDocumentedEntities()).isEqualTo(0);
        assertThat(coverage.getCoveragePercentage()).isEqualTo(0.0);
    }
}
