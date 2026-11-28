package com.example.livingdocs_backend.infrastructure.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.security.Principal;
import java.util.Collection;
import java.util.Collections;
import java.util.stream.Stream;

@Getter
public class UserPrincipal implements Principal {
    private final Long userId;
    private final String email;
    private final Collection<String> roles;
    private final Long workspaceId;
    private final Long requestedEnterpriseId;

    public UserPrincipal(Long userId, String email, Collection<String> roles) {
        this(userId, email, roles, null, null);
    }

    public UserPrincipal(Long userId,
                         String email,
                         Collection<String> roles,
                         Long workspaceId,
                         Long requestedEnterpriseId) {
        this.userId = userId;
        this.email = email;
        this.roles = roles;
        this.workspaceId = workspaceId;
        this.requestedEnterpriseId = requestedEnterpriseId;
    }

    @Override
    public String getName() {
        return email;
    }

    public boolean isAdmin() {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        for (String role : roles) {
            if (role == null) {
                continue;
            }
            String normalized = role.trim().toUpperCase();
            if ("ADMIN".equals(normalized) || "ROLE_ADMIN".equals(normalized)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Effective tenant scope:
     * - ADMIN: null (global access) unless X-Enterprise-Id header was specified.
     * - Non-ADMIN: user's DB-backed workspaceId (null if unassigned).
     */
    public Long getEffectiveWorkspaceId() {
        return isAdmin() ? requestedEnterpriseId : workspaceId;
    }

    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (roles == null) {
            return Collections.emptyList();
        }
        return roles.stream()
                .flatMap(r -> {
                    String clean = r.startsWith("ROLE_") ? r.substring(5) : r;
                    return Stream.of(
                            new SimpleGrantedAuthority("ROLE_" + clean),
                            new SimpleGrantedAuthority(clean)
                    );
                })
                .distinct()
                .toList();
    }
}
