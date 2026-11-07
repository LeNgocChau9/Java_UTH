package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.ChangelogResponse;
import com.example.livingdocs_backend.application.dto.PageResponse;
import com.example.livingdocs_backend.domain.model.Changelog;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

public interface ChangelogServicePort {

    Changelog logChange(Long documentId, Long versionId, Long actorId, String actorRole, String changeSummary);

    /**
     * Ghi lịch sử khôi phục: phiên bản mới mang nội dung cũ, không xóa bản ghi cũ.
     */
    Changelog recordRollback(Long documentId, Long newVersionId, Long actorId, String actorRole,
            int restoredFromVersion, int newVersion, String reason, String commitHash);

    List<ChangelogResponse> getChangelogsByDocument(Long documentId);

    List<ChangelogResponse> getChangelogs(Long documentId, String actorRole);

    PageResponse<ChangelogResponse> getFilteredChangelogs(
            String actorRole,
            Long repoId,
            Instant fromDate,
            Instant toDate,
            Pageable pageable);
}
