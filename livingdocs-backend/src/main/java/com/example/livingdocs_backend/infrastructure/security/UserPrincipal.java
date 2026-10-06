package com.example.livingdocs_backend.infrastructure.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.security.Principal;

@Getter
@AllArgsConstructor
public class UserPrincipal implements Principal {
    private final Long userId;
    private final String email;
    private final java.util.Collection<String> roles;

    @Override
    public String getName() {
        return email;
    }

    public java.util.Collection<? extends org.springframework.security.core.GrantedAuthority> getAuthorities() {
        if (roles == null) {
            return java.util.Collections.emptyList();
        }
        return roles.stream()
                .map(r -> r.startsWith("ROLE_") ? r : "ROLE_" + r)
                .map(org.springframework.security.core.authority.SimpleGrantedAuthority::new)
                .toList();
    }
}
