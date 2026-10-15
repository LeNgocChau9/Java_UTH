package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest;
import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest.MockMethod;
import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest.MockParameter;
import com.example.livingdocs_backend.application.service.TemplateMarkdownRenderer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TemplateMarkdownRendererTest {

    private final TemplateMarkdownRenderer renderer = new TemplateMarkdownRenderer(new ObjectMapper());

    @Test
    void fillsApiReferenceSectionsWithMockEntity() {
        String structure = """
                {"sections":[
                  {"key":"overview","title":"Tổng quan"},
                  {"key":"endpoints","title":"Danh sách endpoint"},
                  {"key":"examples","title":"Ví dụ"}
                ]}
                """;

        String markdown = renderer.render("API Reference", structure, sample());

        assertTrue(markdown.contains("# API Reference"));
        assertTrue(markdown.contains("## Tổng quan"));
        assertTrue(markdown.contains("com.example.shop.order.OrderService"));
        assertTrue(markdown.contains("createOrder"));
        assertTrue(markdown.contains("userId: Long"));
        assertTrue(markdown.contains("```java"));
    }

    @Test
    void replacesPlaceholdersInCustomMarkdown() {
        String structure = """
                {"markdown":"# {{className}}\\n\\n{{description}}\\n\\n{{methods}}"}
                """;

        String markdown = renderer.render("README", structure, sample());

        assertTrue(markdown.contains("# OrderService"));
        assertTrue(markdown.contains("Tạo và hủy đơn hàng."));
        assertTrue(markdown.contains("`createOrder(userId: Long): Order`"));
    }

    @Test
    void rejectsTemplateWithoutSections() {
        assertThrows(IllegalArgumentException.class,
                () -> renderer.render("Trống", "{}", sample()));
    }

    private TemplatePreviewRequest sample() {
        return TemplatePreviewRequest.builder()
                .className("OrderService")
                .packageName("com.example.shop.order")
                .description("Tạo và hủy đơn hàng.")
                .methods(List.of(MockMethod.builder()
                        .name("createOrder")
                        .returnType("Order")
                        .description("Tạo đơn mới.")
                        .parameters(List.of(MockParameter.builder().name("userId").type("Long").build()))
                        .build()))
                .build();
    }
}
