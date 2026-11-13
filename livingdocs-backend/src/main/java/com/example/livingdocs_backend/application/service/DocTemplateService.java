package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.CrossCheckSuggestionDto;
import com.example.livingdocs_backend.application.dto.DocTemplateRequest;
import com.example.livingdocs_backend.application.dto.DocTemplateResponse;
import com.example.livingdocs_backend.application.dto.DocumentCrossCheckRequest;
import com.example.livingdocs_backend.application.dto.DocumentCrossCheckResponse;
import com.example.livingdocs_backend.application.dto.MissingCodeEntityDto;
import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest;
import com.example.livingdocs_backend.application.dto.TemplatePreviewResponse;
import com.example.livingdocs_backend.application.dto.TemplateValidationResult;
import com.example.livingdocs_backend.application.dto.TemplateVersionRequest;
import com.example.livingdocs_backend.application.dto.TemplateVersionResponse;
import com.example.livingdocs_backend.infrastructure.persistence.entity.CodeEntityJpaEntity;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentTemplateVersion;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocumentTemplateVersionRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.SpringDataCodeEntityRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
public class DocTemplateService {

    private final DocTemplateRepository docTemplateRepository;
    private final DocumentTemplateVersionRepository versionRepository;
    private final TemplateMarkdownRenderer templateMarkdownRenderer;
    private final TemplateStructureCheck templateStructureCheck;
    private final SpringDataCodeEntityRepository codeEntityRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<DocTemplateResponse> list() {
        return docTemplateRepository.findAll().stream()
                .map(DocTemplateResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public DocTemplateResponse getById(Long id) {
        return DocTemplateResponse.from(findOrThrow(id));
    }

    @Transactional
    public DocTemplateResponse create(DocTemplateRequest request) {
        String type = normalizeType(request.getType());
        if (docTemplateRepository.existsByType(type)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Loại mẫu đã tồn tại: " + type);
        }

        String structureJson = requireJson(request.getStructureJson());
        DocTemplate template = DocTemplate.builder()
                .name(request.getName().trim())
                .type(type)
                .structureJson(structureJson)
                .isDefault(Boolean.TRUE.equals(request.getIsDefault()))
                .build();
        DocTemplate saved = docTemplateRepository.save(template);
        appendVersion(saved.getId(), structureJson, "{}", null);
        return DocTemplateResponse.from(saved);
    }

    @Transactional
    public DocTemplateResponse update(Long id, DocTemplateRequest request) {
        DocTemplate template = findOrThrow(id);
        String type = normalizeType(request.getType());
        if (docTemplateRepository.existsByTypeAndIdNot(type, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Loại mẫu đã tồn tại: " + type);
        }

        String structureJson = requireJson(request.getStructureJson());
        boolean structureChanged = !structureJson.equals(template.getStructureJson());
        template.setName(request.getName().trim());
        template.setType(type);
        template.setStructureJson(structureJson);
        template.setIsDefault(Boolean.TRUE.equals(request.getIsDefault()));
        DocTemplate saved = docTemplateRepository.save(template);
        if (structureChanged) {
            String rules = versionRepository.findFirstByTemplateIdOrderByVersionNumDesc(saved.getId())
                    .map(DocumentTemplateVersion::getRulesJson)
                    .filter(value -> value != null && !value.isBlank())
                    .orElse("{}");
            appendVersion(saved.getId(), structureJson, rules, null);
        }
        return DocTemplateResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<TemplateVersionResponse> listVersions(Long templateId) {
        findOrThrow(templateId);
        return versionRepository.findByTemplateIdOrderByVersionNumDesc(templateId).stream()
                .map(TemplateVersionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public TemplateVersionResponse getVersion(Long templateId, Long versionId) {
        findOrThrow(templateId);
        return TemplateVersionResponse.from(findVersionOrThrow(templateId, versionId));
    }

    @Transactional
    public TemplateVersionResponse createVersion(Long templateId, TemplateVersionRequest request) {
        DocTemplate template = findOrThrow(templateId);
        String structureJson = requireJson(request.getStructureJson());
        DocumentTemplateVersion saved = appendVersion(
                templateId, structureJson, rulesOrEmpty(request.getRulesJson()), request.getCreatedBy());
        template.setStructureJson(structureJson);
        docTemplateRepository.save(template);
        return TemplateVersionResponse.from(saved);
    }

    @Transactional
    public TemplateVersionResponse updateVersion(Long templateId, Long versionId, TemplateVersionRequest request) {
        findOrThrow(templateId);
        DocumentTemplateVersion version = findVersionOrThrow(templateId, versionId);
        String structureJson = requireJson(request.getStructureJson());
        version.setStructureJson(structureJson);
        version.setRulesJson(rulesOrEmpty(request.getRulesJson()));
        if (request.getCreatedBy() != null) {
            version.setCreatedBy(request.getCreatedBy());
        }
        DocumentTemplateVersion saved = versionRepository.save(version);

        versionRepository.findFirstByTemplateIdOrderByVersionNumDesc(templateId)
                .filter(latest -> latest.getVersionId().equals(saved.getVersionId()))
                .ifPresent(latest -> {
                    DocTemplate template = findOrThrow(templateId);
                    template.setStructureJson(structureJson);
                    docTemplateRepository.save(template);
                });
        return TemplateVersionResponse.from(saved);
    }

    @Transactional
    public void deleteVersion(Long templateId, Long versionId) {
        findOrThrow(templateId);
        DocumentTemplateVersion version = findVersionOrThrow(templateId, versionId);
        versionRepository.delete(version);
    }

    @Transactional(readOnly = true)
    public TemplateValidationResult validate(Long id, String markdown) {
        findOrThrow(id);
        return templateStructureCheck.check(id, markdown);
    }

    @Transactional(readOnly = true)
    public TemplatePreviewResponse preview(Long id, TemplatePreviewRequest request) {
        DocTemplate template = findOrThrow(id);
        try {
            String markdown = templateMarkdownRenderer.render(template.getName(), template.getStructureJson(), request);
            return TemplatePreviewResponse.builder()
                    .templateId(template.getId())
                    .templateName(template.getName())
                    .templateType(template.getType())
                    .markdown(markdown)
                    .build();
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage());
        }
    }

    @Transactional
    public void delete(Long id) {
        if (!docTemplateRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mẫu id=" + id);
        }
        versionRepository.deleteByTemplateId(id);
        docTemplateRepository.deleteById(id);
    }

    private DocTemplate findOrThrow(Long id) {
        return docTemplateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mẫu id=" + id));
    }

    private DocumentTemplateVersion appendVersion(Long templateId, String structureJson, String rulesJson, Long createdBy) {
        int nextNumber = versionRepository.findFirstByTemplateIdOrderByVersionNumDesc(templateId)
                .map(version -> version.getVersionNum() + 1)
                .orElse(1);
        DocumentTemplateVersion version = DocumentTemplateVersion.builder()
                .templateId(templateId)
                .versionNum(nextNumber)
                .structureJson(structureJson)
                .rulesJson(rulesJson)
                .createdBy(createdBy)
                .build();
        return versionRepository.save(version);
    }

    private String rulesOrEmpty(String rulesJson) {
        if (rulesJson == null || rulesJson.isBlank()) {
            return "{}";
        }
        return requireJson(rulesJson);
    }

    private DocumentTemplateVersion findVersionOrThrow(Long templateId, Long versionId) {
        return versionRepository.findByVersionIdAndTemplateId(versionId, templateId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy phiên bản id=" + versionId + " của mẫu id=" + templateId));
    }

    private String requireJson(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cấu trúc JSON không được để trống");
        }
        try {
            objectMapper.readTree(raw);
        } catch (JsonProcessingException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "structureJson không phải JSON hợp lệ");
        }
        return raw;
    }

    @Transactional(readOnly = true)
    public DocumentCrossCheckResponse crossCheck(DocumentCrossCheckRequest request) {
        String markdown = request.getMarkdown() != null ? request.getMarkdown() : "";
        Long repoId = request.getRepositoryId();

        // 1. Đối chiếu Template (Direction 1)
        Long templateId = request.getTemplateId();
        DocTemplate template = null;
        if (templateId != null) {
            template = docTemplateRepository.findById(templateId).orElse(null);
        }
        if (template == null) {
            template = docTemplateRepository.findAll().stream()
                    .filter(t -> Boolean.TRUE.equals(t.getIsDefault()))
                    .findFirst()
                    .orElseGet(() -> docTemplateRepository.findAll().stream().findFirst().orElse(null));
        }

        List<String> missingHeadings = new ArrayList<>();
        List<String> templateWarnings = new ArrayList<>();
        boolean templateValid = true;
        String templateName = template != null ? template.getName() : "Không xác định";

        if (template != null) {
            TemplateValidationResult valResult = templateStructureCheck.check(template.getId(), markdown);
            templateValid = valResult.isValid();
            if (valResult.getMissingHeadings() != null) {
                missingHeadings.addAll(valResult.getMissingHeadings());
            }
            if (valResult.getWarnings() != null) {
                templateWarnings.addAll(valResult.getWarnings());
            }
        }

        // 2. Đối chiếu Code Entities (Direction 2: Controller, Service, Entity)
        List<CodeEntityJpaEntity> repoEntities = codeEntityRepository != null && repoId != null
                ? codeEntityRepository.findByRepositoryId(repoId)
                : Collections.emptyList();

        List<MissingCodeEntityDto> missingEntities = new ArrayList<>();
        int totalEntities = 0;
        int documentedEntities = 0;

        String markdownLower = markdown.toLowerCase(Locale.ROOT);

        // Gom nhóm theo class để đối chiếu tổng quan
        Map<String, List<CodeEntityJpaEntity>> byClass = new LinkedHashMap<>();
        for (CodeEntityJpaEntity entity : repoEntities) {
            String className = entity.getClassName();
            if (className == null || className.isBlank()) {
                className = extractClassNameFromFilePath(entity.getFilePath());
            }
            if (className != null && !className.isBlank()) {
                byClass.computeIfAbsent(className, k -> new ArrayList<>()).add(entity);
            }
        }

        totalEntities = byClass.size();

        for (Map.Entry<String, List<CodeEntityJpaEntity>> entry : byClass.entrySet()) {
            String className = entry.getKey();
            List<CodeEntityJpaEntity> entities = entry.getValue();
            CodeEntityJpaEntity primary = entities.get(0);

            String inferredType = inferEntityType(primary, className);
            // So khớp ranh giới từ (word boundary) để tránh so khớp substring nhầm (ví dụ "Doc" trong "Documentation")
            java.util.regex.Pattern classPattern = java.util.regex.Pattern.compile("(?i)\\b" + java.util.regex.Pattern.quote(className) + "\\b");
            boolean isDocumented = classPattern.matcher(markdown).find();
            if (!isDocumented && primary.getFilePath() != null && !primary.getFilePath().isBlank()) {
                isDocumented = markdown.contains(primary.getFilePath());
            }
            if (!isDocumented) {
                for (CodeEntityJpaEntity m : entities) {
                    if (m.getMethodName() != null && !m.getMethodName().isBlank() && m.getMethodName().length() > 2) {
                        java.util.regex.Pattern methodPattern = java.util.regex.Pattern.compile("(?i)\\b" + java.util.regex.Pattern.quote(m.getMethodName()) + "\\b");
                        if (methodPattern.matcher(markdown).find()) {
                            isDocumented = true;
                            break;
                        }
                    }
                }
            }

            if (isDocumented) {
                documentedEntities++;
            } else {
                StringBuilder mdBuilder = new StringBuilder();
                mdBuilder.append("\n### ").append(inferredType).append(": `").append(className).append("`\n");
                mdBuilder.append("- **Tệp nguồn**: `").append(primary.getFilePath()).append("`\n");
                mdBuilder.append("- **Mô tả chức năng**: Quản lý và xử lý nghiệp vụ cho `").append(className).append("`.\n");

                List<CodeEntityJpaEntity> methods = entities.stream()
                        .filter(e -> "METHOD".equalsIgnoreCase(e.getEntityType()) && e.getMethodName() != null)
                        .limit(5)
                        .toList();

                if (!methods.isEmpty()) {
                    mdBuilder.append("- **Các phương thức / API tiêu biểu**:\n");
                    for (CodeEntityJpaEntity m : methods) {
                        String sig = m.getSignature() != null ? m.getSignature() : m.getMethodName() + "()";
                        mdBuilder.append("  - `").append(sig).append("`\n");
                    }
                }
                mdBuilder.append("\n");

                missingEntities.add(MissingCodeEntityDto.builder()
                        .entityId(primary.getEntityId())
                        .className(className)
                        .entityType(inferredType)
                        .filePath(primary.getFilePath())
                        .signature(primary.getSignature())
                        .suggestion("Chưa có phần đặc tả tài liệu cho " + inferredType + " `" + className + "`")
                        .suggestedMarkdown(mdBuilder.toString())
                        .build());
            }
        }

        double coveragePercentage = totalEntities > 0
                ? Math.round(((double) documentedEntities / totalEntities) * 1000.0) / 10.0
                : 100.0;

        // 3. Tạo danh sách gợi ý AI / Đề xuất tổng hợp
        List<CrossCheckSuggestionDto> suggestions = new ArrayList<>();

        // Gợi ý cho các đề mục Template bị thiếu
        for (String heading : missingHeadings) {
            String cleanTitle = heading.replaceAll("^#+\\s*", "");
            String suggestedContent = "\n" + heading + "\n\nNội dung chi tiết cho mục " + cleanTitle + "...\n";
            suggestions.add(CrossCheckSuggestionDto.builder()
                    .type("TEMPLATE_HEADING")
                    .title("Bổ sung đề mục Template: " + heading)
                    .description("Mẫu tài liệu '" + templateName + "' yêu cầu phải có mục này.")
                    .suggestedMarkdown(suggestedContent)
                    .build());
        }

        // Gợi ý cho các Code Entities bị thiếu (tối đa 15 thực thể)
        for (MissingCodeEntityDto missingCode : missingEntities.stream().limit(15).toList()) {
            suggestions.add(CrossCheckSuggestionDto.builder()
                    .type("CODE_ENTITY")
                    .title("Bổ sung đặc tả " + missingCode.getEntityType() + " " + missingCode.getClassName())
                    .description(missingCode.getSuggestion())
                    .suggestedMarkdown(missingCode.getSuggestedMarkdown())
                    .build());
        }

        return DocumentCrossCheckResponse.builder()
                .templateId(template != null ? template.getId() : null)
                .templateName(templateName)
                .templateValid(templateValid)
                .missingTemplateHeadings(missingHeadings)
                .templateWarnings(templateWarnings)
                .repositoryId(repoId)
                .totalCodeEntities(totalEntities)
                .documentedCodeEntities(documentedEntities)
                .missingCodeEntitiesCount(missingEntities.size())
                .coveragePercentage(coveragePercentage)
                .missingCodeEntities(missingEntities)
                .suggestions(suggestions)
                .build();
    }

    private String inferEntityType(CodeEntityJpaEntity entity, String className) {
        String name = className != null ? className.toLowerCase(Locale.ROOT) : "";
        String path = entity.getFilePath() != null ? entity.getFilePath().toLowerCase(Locale.ROOT) : "";
        if (name.endsWith("controller") || path.contains("controller")) return "Controller";
        if (name.endsWith("service") || name.endsWith("serviceimpl") || path.contains("service")) return "Service";
        if (name.endsWith("entity") || path.contains("entity") || path.contains("model")) return "Entity";
        if (name.endsWith("repository") || path.contains("repository")) return "Repository";
        if (entity.getEntityType() != null) return entity.getEntityType();
        return "Class";
    }

    private String extractClassNameFromFilePath(String filePath) {
        if (filePath == null) return null;
        String clean = filePath.replace('\\', '/');
        int slash = clean.lastIndexOf('/');
        String filename = slash >= 0 ? clean.substring(slash + 1) : clean;
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    private String normalizeType(String type) {
        return type.trim().toUpperCase().replace(' ', '_');
    }
}
