package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.TemplateValidationResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class TemplateRuleValidator {

    private static final Pattern HEADING = Pattern.compile("^(#{1,6})\\s+(.+?)\\s*$");

    private final ObjectMapper objectMapper;

    public TemplateRuleValidator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public TemplateValidationResult validate(Long templateId, String markdown, String structureJson, String rulesJson) {
        List<Requirement> required = requiredHeadings(structureJson, rulesJson);
        List<FoundHeading> found = extractHeadings(markdown);
        List<String> missing = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        for (Requirement requirement : required) {
            boolean present = found.stream().anyMatch(heading -> requirement.matches(heading));
            if (!present) {
                missing.add(requirement.display());
                warnings.add("Thiếu đề mục bắt buộc: " + requirement.display());
            }
        }

        boolean valid = missing.isEmpty();
        return TemplateValidationResult.builder()
                .templateId(templateId)
                .valid(valid)
                .warning(!valid)
                .missingHeadings(missing)
                .warnings(warnings)
                .build();
    }

    private List<Requirement> requiredHeadings(String structureJson, String rulesJson) {
        JsonNode rules = parse(rulesJson);
        JsonNode structure = parse(structureJson);

        JsonNode explicitHeadings = rules == null ? null : rules.get("headings");
        if (explicitHeadings != null && explicitHeadings.isArray() && !explicitHeadings.isEmpty()) {
            List<Requirement> requirements = new ArrayList<>();
            for (JsonNode heading : explicitHeadings) {
                if (heading.isTextual() && !heading.asText().isBlank()) {
                    requirements.add(Requirement.fromHeadingSpec(heading.asText()));
                }
            }
            return requirements;
        }

        JsonNode requiredKeys = rules == null ? null : rules.get("required");
        if (requiredKeys != null && requiredKeys.isArray() && !requiredKeys.isEmpty()) {
            List<Requirement> requirements = new ArrayList<>();
            for (JsonNode keyNode : requiredKeys) {
                if (!keyNode.isTextual() || keyNode.asText().isBlank()) {
                    continue;
                }
                requirements.add(requirementForKey(structure, keyNode.asText().trim()));
            }
            return requirements;
        }

        List<Requirement> fromStructure = new ArrayList<>();
        JsonNode sections = structure == null ? null : structure.get("sections");
        if (sections != null && sections.isArray()) {
            for (JsonNode section : sections) {
                if (section.has("required") && !section.get("required").asBoolean(true)) {
                    continue;
                }
                fromStructure.add(requirementForSection(section));
            }
        }
        return fromStructure;
    }

    private Requirement requirementForKey(JsonNode structure, String key) {
        JsonNode sections = structure == null ? null : structure.get("sections");
        if (sections != null && sections.isArray()) {
            for (JsonNode section : sections) {
                if (key.equalsIgnoreCase(text(section, "key"))) {
                    return requirementForSection(section);
                }
            }
        }
        return new Requirement(null, List.of(normalize(key)), "## " + key);
    }

    private Requirement requirementForSection(JsonNode section) {
        String title = text(section, "title");
        String key = text(section, "key");
        String label = !title.isBlank() ? title : key;
        Integer level = section.has("level") && section.get("level").canConvertToInt()
                ? section.get("level").asInt()
                : null;
        List<String> aliases = new ArrayList<>();
        if (!label.isBlank()) {
            aliases.add(normalize(label));
        }
        if (!key.isBlank()) {
            aliases.add(normalize(key));
        }
        String marks = level == null ? "##" : "#".repeat(Math.max(1, Math.min(level, 6)));
        return new Requirement(level, aliases, marks + " " + (label.isBlank() ? "Mục" : label));
    }

    private List<FoundHeading> extractHeadings(String markdown) {
        List<FoundHeading> headings = new ArrayList<>();
        if (markdown == null || markdown.isBlank()) {
            return headings;
        }
        for (String line : markdown.split("\\R")) {
            Matcher matcher = HEADING.matcher(line.trim());
            if (matcher.matches()) {
                headings.add(new FoundHeading(matcher.group(1).length(), normalize(matcher.group(2))));
            }
        }
        return headings;
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            return null;
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText().trim() : "";
    }

    static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private record FoundHeading(int level, String text) {
    }

    private record Requirement(Integer level, List<String> aliases, String display) {
        boolean matches(FoundHeading heading) {
            if (level != null && heading.level() != level) {
                return false;
            }
            return aliases.stream().anyMatch(alias -> alias.equals(heading.text()));
        }

        static Requirement fromHeadingSpec(String spec) {
            String trimmed = spec.trim();
            Matcher matcher = HEADING.matcher(trimmed);
            if (matcher.matches()) {
                String text = matcher.group(2).trim();
                return new Requirement(matcher.group(1).length(), List.of(normalize(text)), trimmed);
            }
            return new Requirement(null, List.of(normalize(trimmed)), "## " + trimmed);
        }
    }
}
