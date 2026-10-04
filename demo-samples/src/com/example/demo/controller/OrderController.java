package com.example.demo.controller;

import com.example.demo.model.Order;
import com.example.demo.service.NotificationService;
import com.example.demo.service.PaymentService;
import com.example.demo.service.UserService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Controller xử lý các REST API liên quan đến quản lý đơn hàng.
 */
public class OrderController {

    private final PaymentService paymentService;
    private final UserService userService;
    private final NotificationService notificationService;

    public OrderController(PaymentService paymentService, UserService userService, NotificationService notificationService) {
        this.paymentService = paymentService;
        this.userService = userService;
        this.notificationService = notificationService;
    }

    /**
     * Tiếp nhận yêu cầu tạo đơn hàng mới và thực hiện thanh toán tự động.
     * 
     * @param userId Mã người dùng đặt hàng
     * @param amount Tổng số tiền đơn hàng
     * @param paymentMethod Phương thức thanh toán (VIETQR, CREDIT_CARD)
     * @return Order Đối tượng đơn hàng sau khi tạo và xử lý thanh toán
     */
    public Order createOrder(String userId, BigDecimal amount, String paymentMethod) {
        Order newOrder = new Order(
            UUID.randomUUID().toString(),
            userId,
            amount,
            "PENDING",
            LocalDateTime.now()
        );

        boolean isPaid = paymentService.processPayment(newOrder, paymentMethod);
        if (isPaid) {
            String email = userService.findEmailById(userId);
            if (email != null) {
                notificationService.sendEmail(email, "Xác nhận đơn hàng", "Đơn hàng " + newOrder.getOrderId() + " đã thanh toán thành công.");
            }
        }
        return newOrder;
    }

    /**
     * Tra cứu thông tin chi tiết của một đơn hàng.
     * 
     * @param orderId Mã định danh đơn hàng cần tìm
     * @return Order Đối tượng đơn hàng hoặc null nếu không tìm thấy
     */
    public Order getOrderDetails(String orderId) {
        // Giả lập tìm kiếm và trả về thông tin đơn hàng
        return new Order(orderId, "user_01", new BigDecimal("500000"), "PAID", LocalDateTime.now());
    }

    /**
     * Hủy đơn hàng và kích hoạt hoàn tiền nếu đơn đã thanh toán.
     * 
     * @param orderId Mã đơn hàng cần hủy
     * @param reason Lý do hủy đơn
     * @return boolean Trả về true nếu hủy thành công
     */
    public boolean cancelOrder(String orderId, String reason) {
        return paymentService.refundPayment(orderId, reason);
    }
}
