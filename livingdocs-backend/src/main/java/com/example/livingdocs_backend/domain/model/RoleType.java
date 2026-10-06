package com.example.livingdocs_backend.domain.model;

public enum RoleType {
    ROLE_DEVELOPER("DEVELOPER"),
    ROLE_STAFF("STAFF"),
    ROLE_MANAGER("MANAGER"),
    ROLE_TECH_LEAD("TECH_LEAD"),
    ROLE_ADMIN("ADMIN");

    private final String rawName;

    RoleType(String rawName) {
        this.rawName = rawName;
    }

    public String getRawName() {
        return rawName;
    }

    public static RoleType fromString(String roleName) {
        if (roleName == null) {
            return ROLE_DEVELOPER;
        }
        String clean = roleName.trim().toUpperCase();
        if (clean.startsWith("ROLE_")) {
            clean = clean.substring(5);
        }
        return switch (clean) {
            case "ADMIN" -> ROLE_ADMIN;
            case "TECH_LEAD" -> ROLE_TECH_LEAD;
            case "MANAGER" -> ROLE_MANAGER;
            case "STAFF" -> ROLE_STAFF;
            default -> ROLE_DEVELOPER;
        };
    }
}
