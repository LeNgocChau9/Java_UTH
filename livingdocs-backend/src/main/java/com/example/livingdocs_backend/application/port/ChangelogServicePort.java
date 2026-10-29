package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ChangelogResponse;
import com.example.livingdocs_backend.application.dto.PageResponse;
import com.example.livingdocs_backend.domain.model.Changelog;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

public interface ChangelogServicePort {

    Changelog logChange(Long documentId, Long versionId, Long actorId, String actorRole, String changeSummary);

    List<ChangelogResponse> getChangelogsByDocument(Long documentId);

    List<ChangelogResponse> getChangelogs(Long documentId, String actorRole);

    PageResponse<ChangelogResponse> getFilteredChangelogs(
            String actorRole,
            Long repoId,
            Instant fromDate,
            Instant toDate,
            Pageable pageable);
}
