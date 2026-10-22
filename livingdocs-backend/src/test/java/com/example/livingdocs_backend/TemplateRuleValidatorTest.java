package com.example.livingdocs_backend;

import com.example.livingdocs_backend.application.dto.TemplateValidationResult;
import com.example.livingdocs_backend.application.service.TemplateRuleValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Kiểm tra đề mục Markdown theo template")
class TemplateRuleValidatorTest {

    private static final String STRUCTURE = """
            {"sections":[
              {"key":"overview","title":"Overview","required":true},
              {"key":"endpoints","title":"Endpoints","required":true},
              {"key":"parameters","title":"Parameters","required":true},
              {"key":"examples","title":"Examples","required":false}
            ]}
            """;

    private TemplateRuleValidator validator;

    @BeforeEach
    void setUp() {
        validator = new TemplateRuleValidator(new ObjectMapper());
    }

    @Test
    @DisplayName("Đủ đề mục bắt buộc thì không gắn cờ")
    void completeMarkdownHasNoWarning() {
        String markdown = """
                # Overview

                ## Endpoints

                ## Parameters
                """;

        TemplateValidationResult result = validator.validate(1L, markdown, STRUCTURE, "{}");

        assertTrue(result.isValid());
        assertFalse(result.isWarning());
        assertTrue(result.getMissingHeadings().isEmpty());
    }

    @Test
    @DisplayName("Thiếu Endpoints và Parameters thì cảnh báo Staff")
    void missingRequiredHeadingsAreFlagged() {
        String markdown = """
                # Overview

                Nội dung chung, chưa có endpoint.
                """;

        TemplateValidationResult result = validator.validate(1L, markdown, STRUCTURE, "{}");

        assertFalse(result.isValid());
        assertTrue(result.isWarning());
        assertEquals(java.util.List.of("## Endpoints", "## Parameters"), result.getMissingHeadings());
        assertTrue(result.getWarnings().get(0).contains("Thiếu đề mục bắt buộc"));
    }

    @Test
    @DisplayName("Mục required=false không bị bắt")
    void optionalSectionIsNotRequired() {
        String markdown = """
                ## Overview
                ## Endpoints
                ## Parameters
                """;

        TemplateValidationResult result = validator.validate(1L, markdown, STRUCTURE, "{}");

        assertTrue(result.isValid());
    }

    @Test
    @DisplayName("rules_json.headings yêu cầu đúng cấp đề mục")
    void explicitHeadingLevelIsRequired() {
        String rules = """
                {"headings":["# Overview","## Endpoints","## Parameters"]}
                """;
        String markdown = """
                ## Overview
                ## Endpoints
                ## Parameters
                """;

        TemplateValidationResult result = validator.validate(1L, markdown, STRUCTURE, rules);

        assertTrue(result.isWarning());
        assertEquals(java.util.List.of("# Overview"), result.getMissingHeadings());
    }
}
