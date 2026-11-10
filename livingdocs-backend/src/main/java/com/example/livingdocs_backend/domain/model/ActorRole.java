package com.example.livingdocs_backend.domain.model;

public enum ActorRole {
    AI,
    DEV,
    STAFF,
    MANAGER;

    public static ActorRole fromString(String value) {
        if (value == null || value.isBlank()) {
            return DEV;
        }
        String clean = value.trim().toUpperCase();
        if (clean.contains("AI")) {
            return AI;
        }
        for (ActorRole role : values()) {
            if (role.name().equalsIgnoreCase(clean)) {
                return role;
            }
        }
        return DEV;
    }
}
