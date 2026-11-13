package com.example.livingdocs_backend.application.dto;

public record ExportDocxRequest(
        String title,
        String markdown
) {}
