package com.example.livingdocs_backend.infrastructure.export;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Đóng gói tài liệu Markdown đã duyệt thành file ZIP, giữ đường dẫn targetPath
 * và kèm mục lục README.md / SUMMARY.md.
 */
public final class DocsBundleWriter {

    public record DocFile(String title, String status, String targetPath, String markdown) {
    }

    private DocsBundleWriter() {
    }

    public static byte[] write(String bundleTitle, List<DocFile> documents, String openApiMarkdown) {
        List<DocFile> docs = documents == null ? List.of() : documents;
        String title = bundleTitle == null || bundleTitle.isBlank() ? "LivingDocs" : bundleTitle.trim();
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            Set<String> used = new LinkedHashSet<>();
            used.add("README.md");
            used.add("SUMMARY.md");
            List<Placed> placed = new ArrayList<>();
            for (DocFile doc : docs) {
                String path = entryPath(doc.targetPath(), doc.title(), used);
                placed.add(new Placed(doc, path));
            }
            try (ZipOutputStream zip = new ZipOutputStream(buffer, StandardCharsets.UTF_8)) {
                put(zip, "README.md", readme(title, placed));
                put(zip, "SUMMARY.md", summary(title, placed));
                if (openApiMarkdown != null && !openApiMarkdown.isBlank()) {
                    put(zip, "openapi.md", openApiMarkdown);
                }
                for (Placed item : placed) {
                    String body = item.doc.markdown() == null ? "" : item.doc.markdown();
                    put(zip, item.path, body);
                }
            }
            return buffer.toByteArray();
        } catch (Exception ex) {
            throw new IllegalStateException("Không tạo được gói ZIP tài liệu.", ex);
        }
    }

    private static void put(ZipOutputStream zip, String path, String content) throws Exception {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    static String entryPath(String targetPath, String title, Set<String> used) {
        String raw = targetPath == null ? "" : targetPath.trim().replace('\\', '/');
        while (raw.startsWith("/")) {
            raw = raw.substring(1);
        }
        if (raw.contains("..") || raw.contains(":")) {
            raw = "";
        }
        if (raw.isBlank()) {
            raw = "docs/" + slug(title) + ".md";
        }
        if (!raw.toLowerCase(Locale.ROOT).endsWith(".md")) {
            raw = raw + ".md";
        }
        String candidate = raw;
        int suffix = 2;
        while (!used.add(candidate)) {
            int dot = raw.lastIndexOf('.');
            candidate = raw.substring(0, dot) + "-" + suffix + raw.substring(dot);
            suffix++;
        }
        return candidate;
    }

    private static String readme(String title, List<Placed> placed) {
        StringBuilder md = new StringBuilder();
        md.append("# ").append(title).append("\n\n");
        md.append("Gói tài liệu đã duyệt (APPROVED / PUBLISHED). Cấu trúc thư mục giữ nguyên đường dẫn đích.\n\n");
        md.append("| Tài liệu | Trạng thái | Đường dẫn |\n");
        md.append("| --- | --- | --- |\n");
        if (placed.isEmpty()) {
            md.append("| _Không có tài liệu đã duyệt_ | | |\n");
        }
        for (Placed item : placed) {
            md.append("| ")
                    .append(cell(item.doc.title()))
                    .append(" | ")
                    .append(cell(item.doc.status()))
                    .append(" | `")
                    .append(item.path)
                    .append("` |\n");
        }
        return md.toString();
    }

    private static String summary(String title, List<Placed> placed) {
        StringBuilder md = new StringBuilder();
        md.append("# Summary\n\n");
        md.append("* [").append(title.replace("]", "")).append("](README.md)\n");
        for (Placed item : placed) {
            String label = item.doc.title() == null || item.doc.title().isBlank() ? item.path : item.doc.title();
            md.append("  * [").append(label.replace("]", "")).append("](").append(item.path).append(")\n");
        }
        return md.toString();
    }

    private static String cell(String value) {
        if (value == null || value.isBlank()) {
            return "—";
        }
        return value.replace("|", "\\|").replace("\n", " ");
    }

    private static String slug(String title) {
        String base = title == null ? "" : title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        base = base.replaceAll("^-|-$", "");
        return base.isBlank() ? "tai-lieu" : base;
    }

    private record Placed(DocFile doc, String path) {
    }
}
