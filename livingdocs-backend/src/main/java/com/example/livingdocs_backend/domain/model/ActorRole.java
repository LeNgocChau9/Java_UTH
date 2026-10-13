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
        for (ActorRole role : values()) {
            if (role.name().equalsIgnoreCase(value.trim())) {
                return role;
            }
        }
        return DEV;
    }
}
