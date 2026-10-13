package com.example.livingdocs_backend;

import com.example.livingdocs_backend.domain.model.RoleType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class RoleTypeTest {

    @Test
    void parsesSupportedRolesWithOrWithoutPrefix() {
        assertEquals(RoleType.ROLE_ADMIN, RoleType.fromString("ADMIN"));
        assertEquals(RoleType.ROLE_TECH_LEAD, RoleType.fromString("ROLE_TECH_LEAD"));
    }

    @Test
    void rejectsUnsupportedOrBlankRoles() {
        assertThrows(IllegalArgumentException.class, () -> RoleType.fromString("OWNER"));
        assertThrows(IllegalArgumentException.class, () -> RoleType.fromString(" "));
        assertThrows(IllegalArgumentException.class, () -> RoleType.fromString(null));
    }
}
