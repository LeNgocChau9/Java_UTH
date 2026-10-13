package com.example.livingdocs_backend.application.port;

import com.example.livingdocs_backend.application.dto.AdminUserResponse;

import java.util.List;

/** Use-case Quản trị người dùng dành cho vai trò ADMIN. */
public interface AdminUserServicePort {
    List<AdminUserResponse> listUsers();
    AdminUserResponse changeRole(Long userId, String role);
    AdminUserResponse changeStatus(Long userId, boolean active);
}
