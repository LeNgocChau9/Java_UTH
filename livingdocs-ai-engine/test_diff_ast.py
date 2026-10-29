import pytest
from app.services.diff_ast_service import DiffAstService

BASE_JAVA = """
package com.example.service;

public class OrderService {

    public Order getOrderById(Long id) {
        return repository.findById(id);
    }

    public void processPayment(Long orderId, Double amount) {
        paymentGateway.charge(orderId, amount);
    }

    public void deprecatedMethod() {
        System.out.println("old");
    }

    public boolean validateUser(String username) {
        if (username == null || username.isEmpty()) {
            return false;
        }
        return true;
    }
}
"""

HEAD_JAVA = """
package com.example.service;

public class OrderService {

    // 1. PARAM_CHANGED: Thêm tham số boolean includeDetails
    public Order getOrderById(Long id, boolean includeDetails) {
        return repository.findByIdWithDetails(id, includeDetails);
    }

    // 2. RENAMED: processPayment đổi tên thành executePayment (cùng params & return)
    public void executePayment(Long orderId, Double amount) {
        paymentGateway.charge(orderId, amount);
    }

    // 3. deprecatedMethod() đã BỊ XÓA (DELETED)

    // 4. validateUser: BODY_CHANGED (thay đổi logic thân hàm)
    public boolean validateUser(String username) {
        if (username == null || username.trim().length() < 3) {
            log.warn("Invalid username");
            return false;
        }
        return checkDatabase(username);
    }

    // 5. ADDED: Hàm mới hoàn toàn
    public void cancelOrder(Long orderId, String reason) {
        repository.cancel(orderId, reason);
    }
}
"""

def test_ast_diff_detection():
    result = DiffAstService.compare_java_files(
        file_path="src/main/java/com/example/service/OrderService.java",
        base_code=BASE_JAVA,
        head_code=HEAD_JAVA
    )

    assert result["file_status"] == "MODIFIED"
    assert result["class_name"] == "OrderService"

    entities = result["affected_entities"]
    change_types = {e["method_name"]: e["change_type"] for e in entities}

    # Kiểm tra phát hiện thay đổi tham số
    assert "getOrderById" in change_types
    assert change_types["getOrderById"] in ("PARAM_CHANGED", "SIGNATURE_CHANGED")

    # Kiểm tra phát hiện đổi tên hàm
    assert "executePayment" in change_types
    assert change_types["executePayment"] == "RENAMED"

    # Kiểm tra phát hiện hàm bị xóa
    assert "deprecatedMethod" in change_types
    assert change_types["deprecatedMethod"] == "DELETED"

    # Kiểm tra phát hiện hàm mới
    assert "cancelOrder" in change_types
    assert change_types["cancelOrder"] == "ADDED"

    # Kiểm tra phát hiện sửa thân hàm
    assert "validateUser" in change_types
    assert change_types["validateUser"] == "BODY_CHANGED"

    print("ALL ASSERTIONS PASSED! Summary:", result["summary"])

if __name__ == "__main__":
    test_ast_diff_detection()
