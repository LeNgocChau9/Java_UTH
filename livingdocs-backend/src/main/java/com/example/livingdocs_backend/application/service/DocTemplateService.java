package com.example.livingdocs_backend.application.service;

import com.example.livingdocs_backend.application.dto.DocTemplateRequest;
import com.example.livingdocs_backend.application.dto.DocTemplateResponse;
import com.example.livingdocs_backend.infrastructure.persistence.entity.DocTemplate;
import com.example.livingdocs_backend.infrastructure.persistence.repository.DocTemplateRepository;
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

        DocTemplate template = DocTemplate.builder()
                .name(request.getName().trim())
                .type(type)
                .structureJson(request.getStructureJson())
                .isDefault(Boolean.TRUE.equals(request.getIsDefault()))
                .build();
        return DocTemplateResponse.from(docTemplateRepository.save(template));
    }

    @Transactional
    public DocTemplateResponse update(Long id, DocTemplateRequest request) {
        DocTemplate template = findOrThrow(id);
        String type = normalizeType(request.getType());
        if (docTemplateRepository.existsByTypeAndIdNot(type, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Loại mẫu đã tồn tại: " + type);
        }

        template.setName(request.getName().trim());
        template.setType(type);
        template.setStructureJson(request.getStructureJson());
        template.setIsDefault(Boolean.TRUE.equals(request.getIsDefault()));
        return DocTemplateResponse.from(docTemplateRepository.save(template));
    }

    @Transactional
    public void delete(Long id) {
        if (!docTemplateRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mẫu id=" + id);
        }
        docTemplateRepository.deleteById(id);
    }

    private DocTemplate findOrThrow(Long id) {
        return docTemplateRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mẫu id=" + id));
    }

    private String normalizeType(String type) {
        return type.trim().toUpperCase().replace(' ', '_');
    }
}
