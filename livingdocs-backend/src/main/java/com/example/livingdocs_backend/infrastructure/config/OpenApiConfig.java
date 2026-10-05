package com.example.livingdocs_backend.infrastructure.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

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
                    .url("https://springdoc.org")));
    }
}
