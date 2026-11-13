package com.example.livingdocs_backend;

import com.example.livingdocs_backend.infrastructure.web.controller.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;

    @BeforeEach
    void setUp() {
        exceptionHandler = new GlobalExceptionHandler();
    }

    @Test
    void handleHttpRequestMethodNotSupportedException_returns405MethodNotAllowed() {
        HttpRequestMethodNotSupportedException ex = new HttpRequestMethodNotSupportedException(
                "GET", List.of(HttpMethod.POST.name(), HttpMethod.PUT.name())
        );

        ResponseEntity<Map<String, Object>> response = exceptionHandler.handleHttpRequestMethodNotSupportedException(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, response.getStatusCode());

        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(405, body.get("status"));
        assertEquals("Method Not Allowed", body.get("error"));
        assertEquals("METHOD_NOT_ALLOWED", body.get("errorCode"));
        assertTrue(body.get("message").toString().contains("GET"));
        assertNotNull(body.get("supportedMethods"));
        assertNotNull(body.get("timestamp"));
    }

    @Test
    void handleGenericException_returns500InternalServerError() {
        Exception ex = new RuntimeException("Unexpected error");

        ResponseEntity<Map<String, Object>> response = exceptionHandler.handleGenericException(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());

        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals(500, body.get("status"));
        assertEquals("INTERNAL_SERVER_ERROR", body.get("errorCode"));
    }
}
