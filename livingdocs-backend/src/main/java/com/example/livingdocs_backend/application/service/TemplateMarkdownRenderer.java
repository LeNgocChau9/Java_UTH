package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest;
import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest.MockMethod;
import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest.MockParameter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class TemplateMarkdownRenderer {

    private final ObjectMapper objectMapper;

    public TemplateMarkdownRenderer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String render(String templateName, String structureJson, TemplatePreviewRequest entity) {
        JsonNode root = parse(structureJson);
        if (root.hasNonNull("markdown")) {
            return applyPlaceholders(root.get("markdown").asText(), entity);
        }
        if (root.hasNonNull("body")) {
            return applyPlaceholders(root.get("body").asText(), entity);
        }

        JsonNode sections = root.get("sections");
        if (sections == null || !sections.isArray() || sections.isEmpty()) {
            throw new IllegalArgumentException("Template không có sections hoặc markdown để xem trước");
        }

        StringBuilder markdown = new StringBuilder();
        markdown.append("# ").append(blankTo(templateName, "Tài liệu")).append("\n\n");
        markdown.append("Lớp `").append(qualifiedName(entity)).append("`");
        if (hasText(entity.getDescription())) {
            markdown.append(" — ").append(entity.getDescription().trim());
        }
        markdown.append(".\n");

        for (JsonNode section : sections) {
            String title = text(section, "title");
            if (!hasText(title)) {
                title = text(section, "key");
            }
            markdown.append("\n## ").append(blankTo(title, "Mục")).append("\n\n");

            String custom = text(section, "content");
            if (!hasText(custom)) {
                custom = text(section, "template");
            }
            if (hasText(custom)) {
                markdown.append(applyPlaceholders(custom, entity).trim()).append("\n");
            } else {
                markdown.append(fillSection(text(section, "key"), entity).trim()).append("\n");
            }
        }
        return markdown.toString().trim() + "\n";
    }

    private JsonNode parse(String structureJson) {
        if (!hasText(structureJson)) {
            throw new IllegalArgumentException("structureJson của template đang trống");
        }
        try {
            return objectMapper.readTree(structureJson);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("structureJson không phải JSON hợp lệ");
        }
    }

    private String fillSection(String key, TemplatePreviewRequest entity) {
        String normalized = key == null ? "" : key.trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "overview", "purpose", "summary", "context" -> overview(entity);
            case "authentication" -> authentication(entity);
            case "endpoints", "public_api", "structure" -> methodsTable(entity);
            case "parameters" -> parameters(entity);
            case "responses" -> responses(entity);
            case "examples", "usage", "quick_start", "first_task", "scripts" -> examples(entity);
            case "errors", "troubleshooting" -> errors(entity);
            case "installation", "local_setup", "prerequisites", "configuration" -> setup(entity);
            case "status" -> "Đề xuất. Bản xem trước cho lớp `" + entity.getClassName().trim() + "`.";
            case "decision" -> decision(entity);
            case "alternatives" -> "Dữ liệu mẫu chưa ghi phương án khác. Giữ nguyên cách viết tài liệu theo từng method của `"
                    + entity.getClassName().trim() + "`.";
            case "consequences" -> "Tài liệu sẽ bám theo " + methodCount(entity)
                    + " method công khai của `" + entity.getClassName().trim() + "`.";
            case "conventions", "contributing" -> "Mỗi method của `" + entity.getClassName().trim()
                    + "` cần một mục mô tả, kiểu trả về và danh sách tham số.";
            case "help" -> "Khi kẹt ở lớp `" + qualifiedName(entity) + "`, hỏi người phụ trách module này.";
            default -> overview(entity);
        };
    }

    private String overview(TemplatePreviewRequest entity) {
        StringBuilder text = new StringBuilder();
        text.append("`").append(qualifiedName(entity)).append("`");
        if (hasText(entity.getDescription())) {
            text.append(" dùng để ").append(lowerFirst(entity.getDescription().trim()));
        }
        text.append(".\n\nCác method được đưa vào bản xem trước:\n\n");
        text.append(methodBullets(entity));
        return text.toString();
    }

    private String authentication(TemplatePreviewRequest entity) {
        boolean mentionsAuth = methodsOf(entity).stream()
                .anyMatch(method -> method.getName() != null
                        && method.getName().toLowerCase(Locale.ROOT).contains("auth"));
        if (mentionsAuth) {
            return "Lớp `" + entity.getClassName().trim() + "` có method liên quan đến xác thực. Gọi method đó trước khi dùng các method còn lại.";
        }
        return "Bản mẫu của `" + entity.getClassName().trim()
                + "` không khai báo xác thực. Giao diện preview giả định người gọi đã có phiên làm việc hợp lệ.";
    }

    private String methodsTable(TemplatePreviewRequest entity) {
        List<MockMethod> methods = methodsOf(entity);
        if (methods.isEmpty()) {
            return "_Không có method trong dữ liệu mẫu._";
        }
        StringBuilder table = new StringBuilder();
        table.append("| Method | Kiểu trả về | Tham số |\n");
        table.append("| --- | --- | --- |\n");
        for (MockMethod method : methods) {
            table.append("| `").append(cell(method.getName())).append("` | `")
                    .append(cell(blankTo(method.getReturnType(), "void"))).append("` | ")
                    .append(cell(parameterList(method))).append(" |\n");
        }
        return table.toString();
    }

    private String parameters(TemplatePreviewRequest entity) {
        StringBuilder table = new StringBuilder();
        table.append("| Method | Tham số | Kiểu |\n");
        table.append("| --- | --- | --- |\n");
        boolean any = false;
        for (MockMethod method : methodsOf(entity)) {
            for (MockParameter parameter : parametersOf(method)) {
                any = true;
                table.append("| `").append(cell(method.getName())).append("` | `")
                        .append(cell(parameter.getName())).append("` | `")
                        .append(cell(blankTo(parameter.getType(), "Object"))).append("` |\n");
            }
        }
        if (!any) {
            return "_Không có tham số trong dữ liệu mẫu._";
        }
        return table.toString();
    }

    private String responses(TemplatePreviewRequest entity) {
        List<MockMethod> methods = methodsOf(entity);
        if (methods.isEmpty()) {
            return "_Không có method để mô tả giá trị trả về._";
        }
        StringBuilder text = new StringBuilder();
        for (MockMethod method : methods) {
            text.append("- `").append(method.getName().trim()).append("` trả về `")
                    .append(blankTo(method.getReturnType(), "void")).append("`");
            if (hasText(method.getDescription())) {
                text.append(": ").append(method.getDescription().trim());
            }
            text.append(".\n");
        }
        return text.toString();
    }

    private String examples(TemplatePreviewRequest entity) {
        List<MockMethod> methods = methodsOf(entity);
        if (methods.isEmpty()) {
            return "_Chưa có method để tạo ví dụ gọi._";
        }
        String receiver = lowerFirst(entity.getClassName().trim());
        StringBuilder text = new StringBuilder();
        text.append("```java\n");
        if (hasText(entity.getPackageName())) {
            text.append("import ").append(entity.getPackageName().trim()).append(".")
                    .append(entity.getClassName().trim()).append(";\n\n");
        }
        for (MockMethod method : methods) {
            String args = parametersOf(method).stream()
                    .map(parameter -> parameter.getName().trim())
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("");
            String call = receiver + "." + method.getName().trim() + "(" + args + ")";
            if (hasText(method.getReturnType()) && !"void".equalsIgnoreCase(method.getReturnType().trim())) {
                text.append(method.getReturnType().trim()).append(" result = ").append(call).append(";\n");
            } else {
                text.append(call).append(";\n");
            }
        }
        text.append("```\n");
        return text.toString();
    }

    private String errors(TemplatePreviewRequest entity) {
        return "Khi gọi `" + entity.getClassName().trim()
                + "`, dữ liệu mẫu không khai báo exception. Giao diện preview hiển thị lỗi chung: tham số thiếu hoặc class không tồn tại.";
    }

    private String setup(TemplatePreviewRequest entity) {
        return "Khởi tạo `" + qualifiedName(entity) + "` trong module đang viết tài liệu, rồi gọi "
                + methodCount(entity) + " method mẫu bên dưới khi cần kiểm tra bản xem trước.";
    }

    private String decision(TemplatePreviewRequest entity) {
        if (hasText(entity.getDescription())) {
            return "Chọn lớp `" + entity.getClassName().trim() + "` vì " + lowerFirst(entity.getDescription().trim()) + ".";
        }
        return "Chọn lớp `" + entity.getClassName().trim() + "` làm nguồn sinh tài liệu xem trước.";
    }

    String applyPlaceholders(String template, TemplatePreviewRequest entity) {
        return template
                .replace("{{className}}", safe(entity.getClassName()))
                .replace("{{packageName}}", safe(entity.getPackageName()))
                .replace("{{description}}", safe(entity.getDescription()))
                .replace("{{fqcn}}", qualifiedName(entity))
                .replace("{{methods}}", methodBullets(entity).trim())
                .replace("{{methodsTable}}", methodsTable(entity).trim())
                .replace("{{parameters}}", parameters(entity).trim());
    }

    private String methodBullets(TemplatePreviewRequest entity) {
        List<MockMethod> methods = methodsOf(entity);
        if (methods.isEmpty()) {
            return "_Không có method trong dữ liệu mẫu._\n";
        }
        StringBuilder bullets = new StringBuilder();
        for (MockMethod method : methods) {
            bullets.append("- `").append(signature(method)).append("`");
            if (hasText(method.getDescription())) {
                bullets.append(" — ").append(method.getDescription().trim());
            }
            bullets.append("\n");
        }
        return bullets.toString();
    }

    private String signature(MockMethod method) {
        String signature = method.getName().trim() + "(" + parameterList(method) + ")";
        if (hasText(method.getReturnType())) {
            signature = signature + ": " + method.getReturnType().trim();
        }
        return signature;
    }

    private String parameterList(MockMethod method) {
        return parametersOf(method).stream()
                .map(parameter -> parameter.getName().trim() + ": " + blankTo(parameter.getType(), "Object"))
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }

    private List<MockMethod> methodsOf(TemplatePreviewRequest entity) {
        if (entity.getMethods() == null) {
            return List.of();
        }
        return entity.getMethods();
    }

    private List<MockParameter> parametersOf(MockMethod method) {
        if (method.getParameters() == null) {
            return List.of();
        }
        List<MockParameter> parameters = new ArrayList<>();
        for (MockParameter parameter : method.getParameters()) {
            if (parameter != null && hasText(parameter.getName())) {
                parameters.add(parameter);
            }
        }
        return parameters;
    }

    private int methodCount(TemplatePreviewRequest entity) {
        return methodsOf(entity).size();
    }

    private String qualifiedName(TemplatePreviewRequest entity) {
        if (hasText(entity.getPackageName())) {
            return entity.getPackageName().trim() + "." + entity.getClassName().trim();
        }
        return entity.getClassName().trim();
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return "";
        }
        return value.asText("");
    }

    private String cell(String value) {
        return safe(value).replace("|", "\\|").replace("\n", " ");
    }

    private String lowerFirst(String value) {
        if (!hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        return Character.toLowerCase(trimmed.charAt(0)) + trimmed.substring(1);
    }

    private String blankTo(String value, String fallback) {
        return hasText(value) ? value.trim() : fallback;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
