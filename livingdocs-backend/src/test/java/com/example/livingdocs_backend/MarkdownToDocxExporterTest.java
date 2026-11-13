package com.example.livingdocs_backend;

import com.example.livingdocs_backend.infrastructure.export.MarkdownToDocxExporter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.*;

class MarkdownToDocxExporterTest {

    @Test
    @DisplayName("Xuất Markdown sang .docx: Tạo tệp ZIP OpenXML hợp lệ chứa document.xml")
    void testExportMarkdownToDocx_ProducesValidZip() throws Exception {
        String markdown = """
                # Tiêu đề Lớn
                ## 1. Giới thiệu
                Đoạn văn có chữ **in đậm** và `code snippet`.
                - Danh sách mục 1
                - Danh sách mục 2

                | Cột 1 | Cột 2 |
                | :--- | :--- |
                | Dữ liệu 1 | Dữ liệu 2 |

                ```java
                public class Main {
                    public static void main(String[] args) {}
                }
                ```
                """;

        byte[] docxBytes = MarkdownToDocxExporter.exportMarkdownToDocx(markdown, "Tài liệu Kiểm thử");

        assertNotNull(docxBytes);
        assertTrue(docxBytes.length > 0);

        boolean foundDocumentXml = false;
        boolean foundContentTypes = false;
        boolean foundRels = false;

        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(docxBytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("word/document.xml".equals(entry.getName())) {
                    foundDocumentXml = true;
                } else if ("[Content_Types].xml".equals(entry.getName())) {
                    foundContentTypes = true;
                } else if ("_rels/.rels".equals(entry.getName())) {
                    foundRels = true;
                }
            }
        }

        assertTrue(foundDocumentXml, "Phải chứa word/document.xml trong tệp .docx");
        assertTrue(foundContentTypes, "Phải chứa [Content_Types].xml");
        assertTrue(foundRels, "Phải chứa _rels/.rels");
    }

    @Test
    @DisplayName("Xuất Markdown rỗng: Vẫn sinh tệp .docx hợp lệ không gặp lỗi")
    void testExportEmptyMarkdown_NoError() {
        byte[] docxBytes = MarkdownToDocxExporter.exportMarkdownToDocx("", null);
        assertNotNull(docxBytes);
        assertTrue(docxBytes.length > 0);
    }
}
