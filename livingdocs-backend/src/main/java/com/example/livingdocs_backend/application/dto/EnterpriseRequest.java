package com.example.livingdocs_backend.application.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnterpriseRequest {
    @NotBlank(message = "Tên doanh nghiệp không được để trống")
    @Size(max = 150, message = "Tên doanh nghiệp tối đa 150 ký tự")
    private String name;
}
