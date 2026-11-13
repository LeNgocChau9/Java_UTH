package com.example.livingdocs_backend.infrastructure.export;

import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Bộ chuyển đổi tài liệu Markdown sang Microsoft Word (.docx).
 * Sử dụng thuần túy Java 17 built-in (ZipOutputStream + OpenXML Specification) - Zero External Dependencies.
 */
@Slf4j
public class MarkdownToDocxExporter {

    private static final String CONTENT_TYPES_XML =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
            "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\n" +
            "  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\n" +
            "  <Default Extension=\"xml\" ContentType=\"application/xml\"/>\n" +
            "  <Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>\n" +
            "</Types>";

    private static final String RELS_XML =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
            "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\n" +
            "  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>\n" +
            "</Relationships>";

    /**
     * Xuất chuỗi Markdown sang mảng byte của tệp Word (.docx).
     *
     * @param markdown Nội dung văn bản Markdown
     * @param title    Tiêu đề tài liệu
     * @return Mảng byte của tệp .docx chuẩn OpenXML
     */
    public static byte[] exportMarkdownToDocx(String markdown, String title) {
        if (markdown == null) {
            markdown = "";
        }

        String documentXml = buildDocumentXml(markdown, title);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
             ZipOutputStream zos = new ZipOutputStream(baos)) {

            // 1. [Content_Types].xml
            zos.putNextEntry(new ZipEntry("[Content_Types].xml"));
            zos.write(CONTENT_TYPES_XML.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 2. _rels/.rels
            zos.putNextEntry(new ZipEntry("_rels/.rels"));
            zos.write(RELS_XML.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            // 3. word/document.xml
            zos.putNextEntry(new ZipEntry("word/document.xml"));
            zos.write(documentXml.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();

            zos.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            log.error("Lỗi khi đóng gói tệp .docx: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể tạo tệp Word .docx: " + e.getMessage(), e);
        }
    }

    private static String buildDocumentXml(String markdown, String title) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n");
        sb.append("<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">\n");
        sb.append("  <w:body>\n");

        // Tiêu đề lớn đầu trang nếu có
        if (title != null && !title.isBlank()) {
            sb.append("    <w:p>\n");
            sb.append("      <w:pPr><w:jc w:val=\"center\"/></w:pPr>\n");
            sb.append("      <w:r><w:rPr><w:b/><w:sz w:val=\"40\"/><w:color w:val=\"0F172A\"/></w:rPr>");
            sb.append("<w:t xml:space=\"preserve\">").append(escapeXml(title)).append("</w:t></w:r>\n");
            sb.append("    </w:p>\n");
            sb.append("    <w:p><w:pPr><w:spacing w:after=\"240\"/></w:pPr></w:p>\n");
        }

        String[] lines = markdown.split("\r?\n");
        boolean inCodeBlock = false;
        List<String[]> tableRows = new ArrayList<>();

        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            String trimmed = line.trim();

            // Kiểm tra khối code (```)
            if (trimmed.startsWith("```")) {
                if (inCodeBlock) {
                    inCodeBlock = false;
                } else {
                    inCodeBlock = true;
                }
                continue;
            }

            if (inCodeBlock) {
                sb.append("    <w:p>\n");
                sb.append("      <w:pPr>\n");
                sb.append("        <w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F1F5F9\"/>\n");
                sb.append("        <w:spacing w:before=\"40\" w:after=\"40\"/>\n");
                sb.append("      </w:pPr>\n");
                sb.append("      <w:r>\n");
                sb.append("        <w:rPr><w:rFonts w:ascii=\"Consolas\" w:hAnsi=\"Consolas\"/><w:sz w:val=\"18\"/><w:color w:val=\"1E293B\"/></w:rPr>\n");
                sb.append("        <w:t xml:space=\"preserve\">").append(escapeXml(line)).append("</w:t>\n");
                sb.append("      </w:r>\n");
                sb.append("    </w:p>\n");
                continue;
            }

            // Kiểm tra Bảng biểu Markdown (| Col 1 | Col 2 |)
            if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
                if (trimmed.matches("^\\|[\\s\\-:]+\\|.*")) {
                    // Dòng ngăn cách header |---|---| -> bỏ qua
                    continue;
                }
                String[] cells = trimmed.substring(1, trimmed.length() - 1).split("\\|");
                for (int c = 0; c < cells.length; c++) {
                    cells[c] = cells[c].trim();
                }
                tableRows.add(cells);

                // Nếu dòng tiếp theo không phải là bảng -> kết xuất bảng
                boolean nextIsTable = (i + 1 < lines.length) && lines[i + 1].trim().startsWith("|");
                if (!nextIsTable) {
                    renderTable(sb, tableRows);
                    tableRows.clear();
                }
                continue;
            }

            // Dòng trống
            if (trimmed.isEmpty()) {
                sb.append("    <w:p><w:pPr><w:spacing w:after=\"120\"/></w:pPr></w:p>\n");
                continue;
            }

            // Headings (#, ##, ###, ####)
            if (trimmed.startsWith("#### ")) {
                renderHeading(sb, trimmed.substring(5), 24, "2563EB", true);
            } else if (trimmed.startsWith("### ")) {
                renderHeading(sb, trimmed.substring(4), 26, "1D4ED8", true);
            } else if (trimmed.startsWith("## ")) {
                renderHeading(sb, trimmed.substring(3), 30, "0F172A", true);
            } else if (trimmed.startsWith("# ")) {
                renderHeading(sb, trimmed.substring(2), 36, "0F172A", true);
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                // Danh sách gạch đầu dòng
                renderBullet(sb, trimmed.substring(2));
            } else if (trimmed.startsWith("> ")) {
                // Blockquote
                renderBlockquote(sb, trimmed.substring(2));
            } else {
                // Đoạn văn thông thường
                renderParagraph(sb, trimmed);
            }
        }

        sb.append("    <w:sectPr/>\n");
        sb.append("  </w:body>\n");
        sb.append("</w:document>");
        return sb.toString();
    }

    private static void renderHeading(StringBuilder sb, String text, int sz, String color, boolean bold) {
        sb.append("    <w:p>\n");
        sb.append("      <w:pPr><w:spacing w:before=\"200\" w:after=\"80\"/></w:pPr>\n");
        sb.append("      <w:r><w:rPr>");
        if (bold) sb.append("<w:b/>");
        sb.append("<w:sz w:val=\"").append(sz).append("\"/>");
        sb.append("<w:color w:val=\"").append(color).append("\"/>");
        sb.append("</w:rPr><w:t xml:space=\"preserve\">").append(escapeXml(text)).append("</w:t></w:r>\n");
        sb.append("    </w:p>\n");
    }

    private static void renderBullet(StringBuilder sb, String text) {
        sb.append("    <w:p>\n");
        sb.append("      <w:pPr><w:ind w:left=\"400\"/><w:spacing w:after=\"60\"/></w:pPr>\n");
        sb.append("      <w:r><w:rPr><w:color w:val=\"2563EB\"/></w:rPr><w:t>• </w:t></w:r>\n");
        renderFormattedRuns(sb, text);
        sb.append("    </w:p>\n");
    }

    private static void renderBlockquote(StringBuilder sb, String text) {
        sb.append("    <w:p>\n");
        sb.append("      <w:pPr>\n");
        sb.append("        <w:ind w:left=\"500\"/>\n");
        sb.append("        <w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F8FAFC\"/>\n");
        sb.append("        <w:spacing w:before=\"60\" w:after=\"60\"/>\n");
        sb.append("      </w:pPr>\n");
        renderFormattedRuns(sb, text);
        sb.append("    </w:p>\n");
    }

    private static void renderParagraph(StringBuilder sb, String text) {
        sb.append("    <w:p>\n");
        sb.append("      <w:pPr><w:spacing w:after=\"100\"/></w:pPr>\n");
        renderFormattedRuns(sb, text);
        sb.append("    </w:p>\n");
    }

    private static void renderFormattedRuns(StringBuilder sb, String text) {
        // Tách chuỗi theo dấu ** (đậm) hoặc ` (code)
        // Đơn giản hóa chuyển đổi các span
        String[] parts = text.split("(?=\\*\\*)|(?<=\\*\\*)|(?=`)|(?<=`)");
        boolean isBold = false;
        boolean isCode = false;

        for (String part : parts) {
            if ("**".equals(part)) {
                isBold = !isBold;
                continue;
            }
            if ("`".equals(part)) {
                isCode = !isCode;
                continue;
            }
            if (part.isEmpty()) continue;

            sb.append("<w:r><w:rPr>");
            if (isBold) sb.append("<w:b/>");
            if (isCode) {
                sb.append("<w:rFonts w:ascii=\"Consolas\" w:hAnsi=\"Consolas\"/><w:sz w:val=\"19\"/>");
                sb.append("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F1F5F9\"/>");
                sb.append("<w:color w:val=\"0369A1\"/>");
            } else {
                sb.append("<w:sz w:val=\"22\"/><w:color w:val=\"334155\"/>");
            }
            sb.append("</w:rPr><w:t xml:space=\"preserve\">").append(escapeXml(part)).append("</w:t></w:r>");
        }
    }

    private static void renderTable(StringBuilder sb, List<String[]> rows) {
        if (rows.isEmpty()) return;

        sb.append("    <w:tbl>\n");
        sb.append("      <w:tblPr>\n");
        sb.append("        <w:tblBorders>\n");
        sb.append("          <w:top w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CBD5E1\"/>\n");
        sb.append("          <w:bottom w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"CBD5E1\"/>\n");
        sb.append("          <w:insideH w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"E2E8F0\"/>\n");
        sb.append("          <w:insideV w:val=\"none\"/>\n");
        sb.append("        </w:tblBorders>\n");
        sb.append("      </w:tblPr>\n");

        for (int r = 0; r < rows.size(); r++) {
            String[] row = rows.get(r);
            boolean isHeader = (r == 0);
            sb.append("      <w:tr>\n");
            for (String cell : row) {
                sb.append("        <w:tc>\n");
                sb.append("          <w:tcPr>\n");
                if (isHeader) {
                    sb.append("            <w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"F8FAFC\"/>\n");
                }
                sb.append("          </w:tcPr>\n");
                sb.append("          <w:p>\n");
                sb.append("            <w:pPr><w:spacing w:after=\"40\" w:before=\"40\"/></w:pPr>\n");
                sb.append("            <w:r><w:rPr>");
                if (isHeader) {
                    sb.append("<w:b/><w:color w:val=\"0F172A\"/>");
                } else {
                    sb.append("<w:color w:val=\"334155\"/>");
                }
                sb.append("<w:sz w:val=\"20\"/></w:rPr><w:t xml:space=\"preserve\">")
                  .append(escapeXml(cell)).append("</w:t></w:r>\n");
                sb.append("          </w:p>\n");
                sb.append("        </w:tc>\n");
            }
            sb.append("      </w:tr>\n");
        }

        sb.append("    </w:tbl>\n");
        sb.append("    <w:p><w:pPr><w:spacing w:after=\"120\"/></w:pPr></w:p>\n");
    }

    private static String escapeXml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
