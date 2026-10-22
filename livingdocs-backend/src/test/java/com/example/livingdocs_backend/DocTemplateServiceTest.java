package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.DocTemplateRequest;
import com.example.livingdocs_backend.application.dto.DocTemplateResponse;
import com.example.livingdocs_backend.application.dto.TemplateVersionRequest;
import com.example.livingdocs_backend.application.dto.TemplateVersionResponse;
import com.example.livingdocs_backend.application.service.DocTemplateService;
import com.example.livingdocs_backend.application.service.TemplateMarkdownRenderer;
import com.example.livingdocs_backend.application.service.TemplateStructureCheck;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentTemplateVersion;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocumentTemplateVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("CRUD doc_templates và document_template_versions")
class DocTemplateServiceTest {

    private static final String STRUCTURE = "{\"sections\":[{\"key\":\"overview\",\"title\":\"Tổng quan\"}]}";
    private static final String STRUCTURE_V2 = "{\"sections\":[{\"key\":\"overview\",\"title\":\"Đã sửa\"}]}";

    @Mock
    private DocTemplateRepository docTemplateRepository;

    @Mock
    private DocumentTemplateVersionRepository versionRepository;

    @Mock
    private TemplateMarkdownRenderer templateMarkdownRenderer;

    @Mock
    private TemplateStructureCheck templateStructureCheck;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private DocTemplateService docTemplateService;

    @BeforeEach
    void assignIdsOnSave() {
        org.mockito.Mockito.lenient().when(docTemplateRepository.save(any())).thenAnswer(invocation -> {
            DocTemplate template = invocation.getArgument(0);
            if (template.getId() == null) {
                template.setId(1L);
            }
            return template;
        });
        org.mockito.Mockito.lenient().when(versionRepository.save(any())).thenAnswer(invocation -> {
            DocumentTemplateVersion version = invocation.getArgument(0);
            if (version.getVersionId() == null) {
                version.setVersionId(10L);
            }
            return version;
        });
    }

    @Test
    @DisplayName("GET danh sách trả về mọi mẫu")
    void listReturnsTemplates() {
        when(docTemplateRepository.findAll()).thenReturn(List.of(sampleTemplate()));

        List<DocTemplateResponse> result = docTemplateService.list();

        assertEquals(1, result.size());
        assertEquals("API Reference", result.get(0).getName());
        assertEquals("API_REFERENCE", result.get(0).getType());
    }

    @Test
    @DisplayName("POST tạo mẫu và lưu phiên bản số 1")
    void createStoresTemplateAndFirstVersion() {
        when(docTemplateRepository.existsByType("API_REFERENCE")).thenReturn(false);
        when(versionRepository.findFirstByTemplateIdOrderByVersionNumDesc(1L)).thenReturn(Optional.empty());

        DocTemplateResponse created = docTemplateService.create(request("API Reference", "api reference", STRUCTURE));

        assertEquals(1L, created.getId());
        assertEquals("API_REFERENCE", created.getType());
        ArgumentCaptor<DocumentTemplateVersion> captor = ArgumentCaptor.forClass(DocumentTemplateVersion.class);
        verify(versionRepository).save(captor.capture());
        assertEquals(1, captor.getValue().getVersionNum());
        assertEquals(1L, captor.getValue().getTemplateId());
        assertEquals("{}", captor.getValue().getRulesJson());
    }

    @Test
    @DisplayName("POST từ chối type trùng")
    void createRejectsDuplicateType() {
        when(docTemplateRepository.existsByType("API_REFERENCE")).thenReturn(true);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> docTemplateService.create(request("API", "API_REFERENCE", STRUCTURE)));

        assertEquals(409, ex.getStatusCode().value());
        verify(docTemplateRepository, never()).save(any());
    }

    @Test
    @DisplayName("POST từ chối JSON hỏng")
    void createRejectsInvalidJson() {
        when(docTemplateRepository.existsByType("API_REFERENCE")).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> docTemplateService.create(request("API", "API_REFERENCE", "{not-json")));

        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("GET id không có thì 404")
    void getMissingTemplate() {
        when(docTemplateRepository.findById(99L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> docTemplateService.getById(99L));

        assertEquals(404, ex.getStatusCode().value());
    }

    @Test
    @DisplayName("PUT đổi structure thì thêm phiên bản 2")
    void updateChangedStructureAppendsVersion() {
        when(docTemplateRepository.findById(1L)).thenReturn(Optional.of(sampleTemplate()));
        when(docTemplateRepository.existsByTypeAndIdNot("API_REFERENCE", 1L)).thenReturn(false);
        when(versionRepository.findFirstByTemplateIdOrderByVersionNumDesc(1L))
                .thenReturn(Optional.of(version(10L, 1, STRUCTURE)));

        docTemplateService.update(1L, request("API Reference", "API_REFERENCE", STRUCTURE_V2));

        ArgumentCaptor<DocumentTemplateVersion> captor = ArgumentCaptor.forClass(DocumentTemplateVersion.class);
        verify(versionRepository).save(captor.capture());
        assertEquals(2, captor.getValue().getVersionNum());
        assertEquals(STRUCTURE_V2, captor.getValue().getStructureJson());
    }

    @Test
    @DisplayName("PUT không đổi structure thì không tạo phiên bản")
    void updateSameStructureDoesNotAppendVersion() {
        when(docTemplateRepository.findById(1L)).thenReturn(Optional.of(sampleTemplate()));
        when(docTemplateRepository.existsByTypeAndIdNot("API_REFERENCE", 1L)).thenReturn(false);

        docTemplateService.update(1L, request("Tên mới", "API_REFERENCE", STRUCTURE));

        verify(versionRepository, never()).save(any());
    }

    @Test
    @DisplayName("POST phiên bản tăng số và cập nhật structure hiện tại của mẫu")
    void createVersionUpdatesCurrentStructure() {
        DocTemplate template = sampleTemplate();
        when(docTemplateRepository.findById(1L)).thenReturn(Optional.of(template));
        when(versionRepository.findFirstByTemplateIdOrderByVersionNumDesc(1L))
                .thenReturn(Optional.of(version(10L, 1, STRUCTURE)));

        TemplateVersionResponse created = docTemplateService.createVersion(1L, TemplateVersionRequest.builder()
                .structureJson(STRUCTURE_V2)
                .rulesJson("{\"required\":[\"overview\"]}")
                .createdBy(3L)
                .build());

        assertEquals(2, created.getVersionNum());
        assertEquals("{\"required\":[\"overview\"]}", created.getRulesJson());
        assertEquals(3L, created.getCreatedBy());
        assertEquals(STRUCTURE_V2, template.getStructureJson());
    }

    @Test
    @DisplayName("DELETE mẫu xóa luôn phiên bản")
    void deleteTemplateDeletesVersions() {
        when(docTemplateRepository.existsById(1L)).thenReturn(true);

        docTemplateService.delete(1L);

        verify(versionRepository).deleteByTemplateId(1L);
        verify(docTemplateRepository).deleteById(1L);
    }

    @Test
    @DisplayName("GET phiên bản của mẫu khác thì 404")
    void getVersionOfAnotherTemplate() {
        when(docTemplateRepository.findById(1L)).thenReturn(Optional.of(sampleTemplate()));
        when(versionRepository.findByVersionIdAndTemplateId(8L, 1L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> docTemplateService.getVersion(1L, 8L));

        assertEquals(404, ex.getStatusCode().value());
    }

    private DocTemplateRequest request(String name, String type, String structure) {
        return DocTemplateRequest.builder()
                .name(name)
                .type(type)
                .structureJson(structure)
                .isDefault(true)
                .build();
    }

    private DocTemplate sampleTemplate() {
        return DocTemplate.builder()
                .id(1L)
                .name("API Reference")
                .type("API_REFERENCE")
                .structureJson(STRUCTURE)
                .isDefault(true)
                .build();
    }

    private DocumentTemplateVersion version(Long id, int number, String structure) {
        return DocumentTemplateVersion.builder()
                .versionId(id)
                .templateId(1L)
                .versionNum(number)
                .structureJson(structure)
                .rulesJson("{}")
                .build();
    }
}
