package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.DocTemplateRequest;
import com.example.livingdocs_backend.application.dto.DocTemplateResponse;
import com.example.livingdocs_backend.application.dto.TemplatePreviewRequest;
import com.example.livingdocs_backend.application.dto.TemplatePreviewResponse;
import com.example.livingdocs_backend.application.dto.TemplateVersionRequest;
import com.example.livingdocs_backend.application.dto.TemplateVersionResponse;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocumentTemplateVersion;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocumentTemplateVersionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DocTemplateService {

    private final DocTemplateRepository docTemplateRepository;
    private final DocumentTemplateVersionRepository versionRepository;
    private final TemplateMarkdownRenderer templateMarkdownRenderer;
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

    private String normalizeType(String type) {
        return type.trim().toUpperCase().replace(' ', '_');
    }
}
