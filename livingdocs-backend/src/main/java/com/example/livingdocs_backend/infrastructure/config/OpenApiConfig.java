package com.example.livingdocs_backend.infrastructure.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "BearerAuth";

    @Bean
    public OpenAPI livingDocsOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("LivingDocs API")
                .description("Hệ thống đồng bộ tài liệu kiến trúc tự động LivingDocs - Spring Boot 3 Clean Architecture")
                .version("v1.0.0")
                .contact(new Contact()
                    .name("LivingDocs Team")
                    .email("support@livingdocs.internal"))
                .license(new License()
                    .name("Apache 2.0")
                    .url("https://springdoc.org")))
            .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
            .components(new Components()
                .addSecuritySchemes(SECURITY_SCHEME_NAME, new SecurityScheme()
                    .name(SECURITY_SCHEME_NAME)
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("Nhập Bearer Token JWT để xác thực các API yêu cầu đăng nhập")));
    }
}
