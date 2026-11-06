package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.RegenerateEntityDocRequest;
import com.example.livingdocs_backend.application.dto.RegenerateEntityDocResponse;
import com.example.livingdocs_backend.application.port.DocumentServicePort;
import com.example.livingdocs_backend.infrastructure.security.UserPrincipal;
import com.example.livingdocs_backend.infrastructure.web.controller.DocumentController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RegenerateEntityDocTest {

    private DocumentServicePort documentServicePort;
    private DocumentController documentController;

    @BeforeEach
    void setUp() {
        documentServicePort = mock(DocumentServicePort.class);
        documentController = new DocumentController(
                documentServicePort,
                null,
                null,
                null
        );
    }

    @Test
    @DisplayName("POST /api/documents/{id}/regenerate-entity cập nhật thành công tài liệu của một hàm cụ thể")
    void shouldRegenerateEntityDocumentationSuccessfully() {
        Long docId = 15L;
        RegenerateEntityDocRequest request = RegenerateEntityDocRequest.builder()
                .entityId(101L)
                .signature("public void processPayment(Long orderId, Double amount)")
                .updatedSourceCode("public void processPayment(Long orderId, Double amount, String currency)")
                .instruction("Thêm tham số currency mới")
                .build();

        RegenerateEntityDocResponse mockResponse = RegenerateEntityDocResponse.builder()
                .documentId(docId)
                .versionNum(3)
                .versionHash("hash-abc-123")
                .entityId(101L)
                .signature("public void processPayment(Long orderId, Double amount)")
                .summaryOfChanges("Cập nhật tham số currency cho phương thức processPayment")
                .entityDocumentation("Đoạn mô tả mới của hàm")
                .fullUpdatedContent("# Tài liệu API\n\n### Thực thể: processPayment\nĐoạn mô tả mới của hàm")
                .status("SUCCESS")
                .build();

        UserPrincipal userPrincipal = new UserPrincipal(
                1L,
                "dev@livingdocs.dev",
                Collections.singletonList("ROLE_DEV")
        );

        when(documentServicePort.regenerateEntityDoc(eq(docId), any(RegenerateEntityDocRequest.class), eq(1L), eq("DEV")))
                .thenReturn(mockResponse);

        ResponseEntity<RegenerateEntityDocResponse> response = documentController.regenerateEntityDocumentation(
                docId, request, userPrincipal);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(docId, response.getBody().getDocumentId());
        assertEquals(3, response.getBody().getVersionNum());
        assertEquals("SUCCESS", response.getBody().getStatus());
        assertEquals(101L, response.getBody().getEntityId());
    }
}
