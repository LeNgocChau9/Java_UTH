package com.example.demo.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity đại diện cho thông tin đơn hàng trong hệ thống e-commerce.
 */
public class Order {
    private String orderId;
    private String userId;
    private BigDecimal totalAmount;
    private String status; // PENDING, PAID, CANCELLED
    private LocalDateTime createdAt;

    public Order() {
    }

    public Order(String orderId, String userId, BigDecimal totalAmount, String status, LocalDateTime createdAt) {
        this.orderId = orderId;
        this.userId = userId;
        this.totalAmount = totalAmount;
        this.status = status;
        this.createdAt = createdAt;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
