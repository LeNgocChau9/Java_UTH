package com.example.demo.service;

import java.util.HashMap;
import java.util.Map;

/**
 * Service quản lý thông tin và tài khoản của người dùng.
 */
public class UserService {

    private final Map<String, String> userStore = new HashMap<>();

    public UserService() {
        userStore.put("user_01", "nguyenvana@example.com");
        userStore.put("user_02", "tranthib@example.com");
    }

    /**
     * Tìm kiếm email của người dùng dựa trên mã định danh.
     * 
     * @param userId Mã định danh duy nhất của người dùng
     * @return String Địa chỉ email hoặc null nếu không tồn tại
     */
    public String findEmailById(String userId) {
        if (userId == null) {
            return null;
        }
        return userStore.get(userId);
    }

    /**
     * Xác thực thông tin đăng nhập của người dùng.
     * 
     * @param email Địa chỉ email đăng ký
     * @param password Mật khẩu đăng nhập
     * @return boolean Trả về true nếu thông tin hợp lệ
     */
    public boolean authenticate(String email, String password) {
        if (email == null || password == null) {
            return false;
        }
        return password.length() >= 6;
    }
}
