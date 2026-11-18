package com.example.livingdocs_backend;

import com.example.livingdocs_backend.infrastructure.export.DocsBundleWriter;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocsBundleWriterTest {

    @Test
    void zipKeepsTargetPathAndAddsContents() throws Exception {
        byte[] zip = DocsBundleWriter.write("Bộ API", List.of(
                new DocsBundleWriter.DocFile("Tổng quan", "PUBLISHED", "/docs/overview.md", "# Tổng quan"),
                new DocsBundleWriter.DocFile("Ngoài cây", "APPROVED", "../secret.md", "không được thoát thư mục")
        ), "# OpenAPI Markdown\n\n- `list`");

        Set<String> names = new java.util.HashSet<>();
        String readme = "";
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            var entry = in.getNextEntry();
            while (entry != null) {
                names.add(entry.getName());
                if ("README.md".equals(entry.getName())) {
                    readme = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                }
                entry = in.getNextEntry();
            }
        }

        assertTrue(names.contains("README.md"));
        assertTrue(names.contains("SUMMARY.md"));
        assertTrue(names.contains("openapi.md"));
        assertTrue(names.contains("docs/overview.md"));
        assertFalse(names.stream().anyMatch(name -> name.contains("..")));
        assertTrue(readme.contains("Tổng quan"));
        assertTrue(readme.contains("PUBLISHED"));
    }
}
