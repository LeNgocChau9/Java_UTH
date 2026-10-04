package com.example.demo.service;

import com.example.demo.model.Order;
import java.math.BigDecimal;

/**
 * Service xử lý các nghiệp vụ thanh toán cho đơn hàng.
 */
public class PaymentService {

    /**
     * Thực hiện xử lý giao dịch thanh toán cho một đơn hàng cụ thể.
     * 
     * @param order Đối tượng đơn hàng cần thanh toán
     * @param paymentMethod Phương thức thanh toán (CREDIT_CARD, VIETQR, E_WALLET)
     * @return boolean Trả về true nếu giao dịch thành công, false nếu thất bại
     */
    public boolean processPayment(Order order, String paymentMethod) {
        if (order == null || order.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }
        // Giả lập logic kiểm tra và trừ tiền
        order.setStatus("PAID");
        return true;
    }

    /**
     * Hoàn tiền cho một đơn hàng đã thanh toán thành công.
     * 
     * @param orderId Mã định danh đơn hàng cần hoàn tiền
     * @param reason Lý do hoàn tiền từ khách hàng
     * @return boolean Trả về true nếu hoàn tiền thành công
     */
    public boolean refundPayment(String orderId, String reason) {
        if (orderId == null || orderId.trim().isEmpty()) {
            return false;
        }
        return true;
    }
}
