package com.example.livingdocs_backend.application.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocRewriteRequestDto {
    private String current_doc;
    private String code_diff;
    private String file_path;
    private String entity_name;
    private String commit_hash;
    private String instruction;
}

