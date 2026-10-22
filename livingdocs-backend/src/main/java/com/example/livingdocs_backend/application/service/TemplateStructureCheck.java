package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.TemplateValidationResult;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocumentTemplateVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TemplateStructureCheck {

    private final DocTemplateRepository docTemplateRepository;
    private final DocumentTemplateVersionRepository versionRepository;
    private final TemplateRuleValidator templateRuleValidator;

    public TemplateValidationResult check(Long templateId, String markdown) {
        if (templateId == null) {
            return TemplateValidationResult.passed(null);
        }
        return docTemplateRepository.findById(templateId)
                .map(template -> templateRuleValidator.validate(
                        template.getId(),
                        markdown,
                        template.getStructureJson(),
                        latestRules(template)))
                .orElseGet(() -> TemplateValidationResult.builder()
                        .templateId(templateId)
                        .valid(false)
                        .warning(true)
                        .missingHeadings(List.of())
                        .warnings(List.of("Không tìm thấy template id=" + templateId + " để kiểm tra cấu trúc."))
                        .build());
    }

    private String latestRules(DocTemplate template) {
        return versionRepository.findFirstByTemplateIdOrderByVersionNumDesc(template.getId())
                .map(version -> version.getRulesJson() == null || version.getRulesJson().isBlank()
                        ? "{}"
                        : version.getRulesJson())
                .orElse("{}");
    }
}
