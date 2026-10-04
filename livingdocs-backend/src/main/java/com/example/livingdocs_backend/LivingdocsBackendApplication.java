package com.example.livingdocs_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
public class LivingdocsBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(LivingdocsBackendApplication.class, args);
	}

}
