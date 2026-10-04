package com.example.demo.service;

/**
 * Service quản lý việc gửi thông báo đa kênh đến người dùng.
 */
public class NotificationService {

    /**
     * Gửi email xác nhận hoặc cảnh báo đến người dùng.
     * 
     * @param recipientEmail Địa chỉ email người nhận
     * @param subject Tiêu đề email
     * @param content Nội dung thông báo
     * @return boolean Trạng thái gửi thành công
     */
    public boolean sendEmail(String recipientEmail, String subject, String content) {
        if (recipientEmail == null || recipientEmail.trim().isEmpty()) {
            return false;
        }
        System.out.println("Gửi email tới " + recipientEmail + ": " + subject);
        return true;
    }

    /**
     * Gửi thông báo trực tiếp qua kênh Zalo Official Account.
     * 
     * @param zaloUserId Mã định danh người dùng trên hệ sinh thái Zalo
     * @param message Nội dung tin nhắn cần gửi
     * @return boolean Trả về true nếu tin nhắn đã vào hàng đợi gửi
     */
    public boolean sendZaloNotification(String zaloUserId, String message) {
        if (zaloUserId == null || message == null) {
            return false;
        }
        System.out.println("Gửi Zalo OA tới " + zaloUserId + ": " + message);
        return true;
    }
}
