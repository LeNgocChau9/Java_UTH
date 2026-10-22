package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.DocTemplateResponse;
import com.example.livingdocs_backend.application.dto.TemplateValidationResult;
import com.example.livingdocs_backend.application.dto.TemplateVersionResponse;
import com.example.livingdocs_backend.application.service.DocTemplateService;
import com.example.livingdocs_backend.infrastructure.web.controller.DocTemplateController;
import com.example.livingdocs_backend.infrastructure.web.controller.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@DisplayName("HTTP /api/templates")
class DocTemplateControllerTest {

    @Mock
    private DocTemplateService docTemplateService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DocTemplateController(docTemplateService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/templates trả danh sách cho frontend")
    void listTemplates() throws Exception {
        when(docTemplateService.list()).thenReturn(List.of(DocTemplateResponse.builder()
                .id(1L)
                .name("API Reference")
                .type("API_REFERENCE")
                .structureJson("{\"sections\":[]}")
                .isDefault(true)
                .build()));

        mockMvc.perform(get("/api/templates"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("API Reference"))
                .andExpect(jsonPath("$[0].type").value("API_REFERENCE"));
    }

    @Test
    @DisplayName("POST /api/templates trả 201")
    void createTemplate() throws Exception {
        when(docTemplateService.create(any())).thenReturn(DocTemplateResponse.builder()
                .id(2L)
                .name("ADR")
                .type("ADR")
                .build());

        mockMvc.perform(post("/api/templates")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"ADR","type":"ADR","structureJson":"{\\"sections\\":[]}","isDefault":false}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.type").value("ADR"));
    }

    @Test
    @DisplayName("GET mẫu không có trả 404")
    void missingTemplate() throws Exception {
        when(docTemplateService.getById(9L))
                .thenThrow(new ResponseStatusException(NOT_FOUND, "Không tìm thấy mẫu id=9"));

        mockMvc.perform(get("/api/templates/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Không tìm thấy mẫu id=9"));
    }

    @Test
    @DisplayName("POST /api/templates/{id}/versions trả 201")
    void createVersion() throws Exception {
        when(docTemplateService.createVersion(eq(1L), any())).thenReturn(TemplateVersionResponse.builder()
                .versionId(4L)
                .templateId(1L)
                .versionNum(2)
                .rulesJson("{\"required\":[\"overview\"]}")
                .createdBy(3L)
                .build());

        mockMvc.perform(post("/api/templates/1/versions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"structureJson":"{\\"sections\\":[]}","rulesJson":"{\\"required\\":[\\"overview\\"]}","createdBy":3}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.versionNum").value(2))
                .andExpect(jsonPath("$.versionId").value(4))
                .andExpect(jsonPath("$.templateId").value(1));
    }

    @Test
    @DisplayName("PUT và DELETE phiên bản")
    void updateAndDeleteVersion() throws Exception {
        when(docTemplateService.updateVersion(eq(1L), eq(4L), any())).thenReturn(TemplateVersionResponse.builder()
                .versionId(4L)
                .templateId(1L)
                .versionNum(2)
                .build());

        mockMvc.perform(put("/api/templates/1/versions/4")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"structureJson\":\"{\\\"sections\\\":[]}\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionId").value(4));

        mockMvc.perform(delete("/api/templates/1/versions/4"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("POST /api/templates/{id}/validate trả cờ cảnh báo")
    void validateMarkdown() throws Exception {
        when(docTemplateService.validate(eq(1L), any())).thenReturn(TemplateValidationResult.builder()
                .templateId(1L)
                .valid(false)
                .warning(true)
                .missingHeadings(java.util.List.of("## Endpoints"))
                .warnings(java.util.List.of("Thiếu đề mục bắt buộc: ## Endpoints"))
                .build());

        mockMvc.perform(post("/api/templates/1/validate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"markdown\":\"# Overview\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.warning").value(true))
                .andExpect(jsonPath("$.missingHeadings[0]").value("## Endpoints"));
    }

    @Test
    @DisplayName("POST thiếu tên trả 400")
    void createRejectsBlankName() throws Exception {
        mockMvc.perform(post("/api/templates")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  \",\"type\":\"ADR\",\"structureJson\":\"{}\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.name").exists());
    }
}
