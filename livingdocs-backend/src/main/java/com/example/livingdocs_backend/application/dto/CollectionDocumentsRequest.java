package com.example.livingdocs_backend.application.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CollectionDocumentsRequest {

    @Schema(description = "Danh sách ID các tài liệu cần gán vào bộ sưu tập")
    private List<Long> documentIds;

    @Schema(description = "Nếu true, đồng bộ danh sách tài liệu của bộ sưu tập khớp chính xác với documentIds (gỡ các tài liệu không còn nằm trong danh sách)")
    private Boolean replaceAll;
}
