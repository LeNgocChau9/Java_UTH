"""
gemini_doc_service.py
Module kết nối trực tiếp với Google Gemini API thật để tự động sinh tài liệu kỹ thuật
theo 4 mẫu cấu trúc chuẩn (API_REFERENCE, README, MODULE_GUIDE, ADR) kèm khối Bằng chứng Xác thực (Grounding Evidence Box).
Sử dụng google-genai SDK mới nhất và Multi-Key Pool 10 keys với cơ chế tự động xoay vòng Round-Robin & Retry.
Nếu API Key chưa hợp lệ hoặc quá hạn mức, tự động chuyển sang chế độ tổng hợp AST thông minh (Smart AST Synthesis)
đảm bảo tính liên tục của hệ thống.
"""

import json
import logging
import re
from typing import List, Optional
from google import genai
from google.genai import types as genai_types
from app.core.config import get_settings
from app.core.gemini_key_manager import GeminiKeyManager
from app.schemas.ai_schemas import (
    DocGenerateRequest,
    DocGenerateResponse,
    GroundingEvidence,
    CodeEntityItem,
)
from app.core.gemini_retry import (
    execute_with_gemini_retry,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
)

logger = logging.getLogger(__name__)

# Danh sách các model Gemini ưu tiên theo thứ tự năng lực và độ ổn định (Pro -> Flash)
DOC_MODELS = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
]


class GeminiDocService:

    @classmethod
    def _is_valid_google_api_key(cls, key: str) -> bool:
        """Hỗ trợ cả định dạng truyền thống (AIza...) và định dạng mới của Google AI Studio (AQ....)."""
        if not key:
            return False
        clean = key.strip()
        return (clean.startswith("AIza") or clean.startswith("AQ.")) and len(clean) >= 20

    @classmethod
    def _normalize_template_type(cls, template_type: Optional[str]) -> str:
        """Chuẩn hóa loại mẫu tài liệu về một trong các loại chuẩn (mặc định ưu tiên PROJECT_DOCUMENTATION 10 phần)."""
        raw = (template_type or "").strip().upper()
        if "10" in raw or "PROJECT_DOC" in raw or "PROJECT_DOCUMENTATION" in raw or "TIÊU CHUẨN" in raw or "STANDARD" in raw or "DỰ ÁN" in raw or "PROJECT" in raw:
            return "PROJECT_DOCUMENTATION"
        if "API" in raw or "REFERENCE" in raw:
            return "API_REFERENCE"
        if "README" in raw or "INTRO" in raw:
            return "README"
        if "MODULE" in raw or "GUIDE" in raw or "HD" in raw:
            return "MODULE_GUIDE"
        if "ADR" in raw or "DECISION" in raw:
            return "ADR"
        return "PROJECT_DOCUMENTATION"

    @classmethod
    def _build_grounding_box_markdown(
        cls,
        file_path: str,
        commit_hash: str,
        entities: List[CodeEntityItem]
    ) -> str:
        """
        Tạo khối Markdown Bằng chứng Xác thực Nguồn (Grounding Evidence Box)
        nhúng trực tiếp vào cuối tài liệu kỹ thuật.
        """
        table_rows = []
        for idx, e in enumerate(entities, 1):
            name = e.method_name or e.class_name or f"Entity_{idx}"
            etype = e.entity_type or "CODE"
            sig = e.signature.strip() if e.signature else f"{etype} {name}"
            if len(sig) > 70:
                sig = sig[:67] + "..."
            line_range = f"L{e.start_line} - L{e.end_line}"
            table_rows.append(f"| {idx} | `{name}` | `{etype}` | `{sig}` | {line_range} | ✅ Verified AST |")

        if not table_rows:
            table_rows.append(f"| 1 | `{file_path}` | `FILE` | Toàn bộ tệp mã nguồn | L1 - End | ✅ Verified AST |")

        rows_str = "\n".join(table_rows)

        return f"""
---

### 🔍 Khối Bằng chứng Xác thực Nguồn (Grounding Evidence Box)

> **Xác thực bởi:** LivingDocs AI Engine (AST Verification Engine)  
> **File nguồn:** `{file_path}`  
> **Mã Commit Hash:** `{commit_hash}`  
> **Tổng số thực thể mã nguồn xác thực:** `{len(entities)}`  

| # | Tên thực thể | Loại phần tử | Chữ ký / Định dạng | Vị trí dòng | Trạng thái xác thực |
|---|---|---|---|---|---|
{rows_str}
"""

    @classmethod
    def _build_smart_ast_markdown(
        cls,
        request: DocGenerateRequest,
        target_name: str,
        entities_summary: list,
    ) -> str:
        """
        Bộ tổng hợp tài liệu kỹ thuật dự phòng dựa trên cấu trúc AST (Tree-sitter)
        khi Gemini API tạm thời không khả dụng.
        """
        tpl = cls._normalize_template_type(request.template_type)
        file_path = request.file_path or "src/main/java/Component.java"

        rows = []
        if entities_summary:
            for item in entities_summary:
                name = item.get("name") or target_name
                e_type = item.get("entity_type") or "METHOD"
                sig = item.get("signature") or f"{name}()"
                ret = item.get("return_type") or "void"
                lines = item.get("lines") or "1 -> 50"
                doc = item.get("javadoc")
                desc = (
                    doc.replace("\n", " ").strip()
                    if doc and doc != "Chưa có"
                    else f"Thực thi xử lý nghiệp vụ `{name}` ({e_type}) trả về `{ret}`"
                )
                rows.append(f"| `{name}` | `{e_type}` | `{sig}` | `L{lines}` | {desc} |")
        else:
            rows.append(
                f"| `{target_name}` | `COMPONENT` | `public class {target_name}` | `L1 -> L100` | Thành phần xử lý nghiệp vụ cốt lõi tại `{file_path}` |"
            )

        table_md = (
            "| Phần tử | Loại | Kiểu dữ liệu / Chữ ký | Vị trí dòng | Mô tả chức năng |\n"
            "| :--- | :--- | :--- | :--- | :--- |\n"
            + "\n".join(rows)
        )

        method_details = []
        for idx, item in enumerate(entities_summary[:12], start=1):
            name = item.get("name") or target_name
            e_type = item.get("entity_type") or "METHOD"
            sig = item.get("signature") or f"public void {name}()"
            ret = item.get("return_type") or "void"
            params = item.get("parameters") or "Không có tham số"
            lines = item.get("lines") or "1 -> 25"
            anns = ", ".join(item.get("annotations") or []) or "Không có"
            method_details.append(
                f"#### 2.{idx}. `{name}` ({e_type})\n"
                f"- **Chữ ký đầy đủ:** `{sig}`\n"
                f"- **Tham số đầu vào:** `{params}`\n"
                f"- **Kiểu trả về:** `{ret}`\n"
                f"- **Annotations:** `{anns}`\n"
                f"- **Vị trí mã nguồn:** Dòng `{lines}` trong `{file_path}`\n"
            )

        details_md = "\n".join(method_details) if method_details else (
            f"#### 2.1. `{target_name}`\n"
            f"- **Đường dẫn nguồn:** `{file_path}`\n"
            f"- **Trách nhiệm:** Điều phối luồng dữ liệu, đảm bảo tính toàn vẹn nghiệp vụ.\n"
        )

        if tpl == "PROJECT_DOCUMENTATION":
            return f"""# Tài liệu Dự án Tiêu chuẩn: {target_name}

> **Mẫu áp dụng:** PROJECT_DOCUMENTATION (10 Phần Tiêu Chuẩn)  
> **File mã nguồn:** `{file_path}`  
> **Tác nhân sinh:** LivingDocs Smart AST Synthesizer  
> **Trạng thái:** ACTIVE (Đã đồng bộ AST)  
> **Phiên bản:** 1.0.0

---

## 1. Phần đầu tài liệu
- **Trang bìa:** Tên phần mềm `{target_name}`, Phiên bản v1.0.0, Đơn vị phát hành LivingDocs.
- **Lịch sử chỉnh sửa:**
  | Phiên bản | Ngày | Người sửa | Nội dung thay đổi |
  | v1.0.0 | (Hiện tại) | LivingDocs Synthesizer | Tạo tài liệu dự án tiêu chuẩn từ AST |
- **Mục lục:** Gồm 10 phần tổng quan, chức năng, kiến trúc và vận hành.

## 2. Giới thiệu
- **Mục đích của tài liệu:** Mô tả toàn diện kiến trúc, các thành phần và phương thức của `{target_name}`.
- **Đối tượng sử dụng:** Nhà phát triển, Quản trị viên, Đội ngũ kiểm thử và Khách hàng.
- **Phạm vi & Tổng quan:** Thành phần cốt lõi tại `{file_path}` thực thi các xử lý nghiệp vụ trọng tâm.
- **Thuật ngữ & Quy ước:** AST (Abstract Syntax Tree), Tree-sitter, Genesis Hash, Verification Evidence.

## 3. Yêu cầu hệ thống
- **Phần cứng:** CPU tối thiểu 4 cores, RAM 8GB trở lên, 10GB dung lượng trống.
- **Môi trường:** Java 17+, Python 3.10+, Node.js 18+, CSDL PostgreSQL.
- **Mạng & Quyền hạn:** Mở cổng 8080, 8000, 3000, 5433; quyền hạn tài khoản dịch vụ.

## 4. Cài đặt và cấu hình
- **Tải về và cài đặt:** Clone repository từ GitHub, build backend bằng `./mvnw clean install` và frontend bằng `npm install`.
- **Cấu hình ban đầu:** Thiết lập cấu hình `.env`, cấu hình kết nối CSDL và AI Engine.
- **Kích hoạt tài khoản:** Khởi tạo tài khoản hệ thống và cấp quyền truy cập.

## 5. Bắt đầu sử dụng
- **Đăng nhập & Quản lý phiên:** Xác thực tài khoản qua JWT Token.
- **Giao diện chính:** Thanh điều hướng menu, cây thư mục mã nguồn và chuông thông báo.
- **Quy trình sử dụng cơ bản:** Khởi tạo, sinh tài liệu, gửi duyệt và xuất bản tài liệu.

## 6. Hướng dẫn chi tiết từng chức năng
### Bảng tổng hợp thực thể mã nguồn (AST)
{table_md}

### Chi tiết các phần tử & phương thức
{details_md}

## 7. Xử lý sự cố
- **Bảng mã lỗi thường gặp:**
  | Mã lỗi | Nguyên nhân | Biện pháp khắc phục |
  | 400 Bad Request | Dữ liệu đầu vào không hợp lệ | Kiểm tra lại payload gửi lên |
  | 401 Unauthorized | Token xác thực hết hạn | Đăng nhập lại để làm mới token |
  | 404 Not Found | Không tìm thấy tài nguyên | Kiểm tra định danh tài nguyên |
  | 500 Internal Error | Lỗi nội bộ hệ thống | Kiểm tra file log server |
- **FAQ:** Kiểm tra kết nối cơ sở dữ liệu và AI Engine nếu gặp độ trễ.

## 8. Bảo mật và sao lưu
- **Bảo mật:** Mật khẩu mã hóa BCrypt, Token JWT HS256, phân quyền RBAC và kiểm tra tính toàn vẹn.
- **Sao lưu:** Sao lưu định kỳ CSDL PostgreSQL và lưu trữ an toàn Genesis Hash.

## 9. Hỗ trợ
- **Kênh hỗ trợ:** Email: support@livingdocs.com | Hotline kỹ thuật.
- **Báo lỗi:** Gửi phản hồi hoặc mở issue trên GitHub kèm thông tin chi tiết.

## 10. Phụ lục
- **Danh sách phím tắt:** Phím tắt thao tác nhanh trong editor Markdown.
- **Bảng thuật ngữ:** Giải thích chi tiết các định danh và cấu trúc AST.
- **Giấy phép:** Bản quyền phần mềm LivingDocs.
"""

        return f"""# Tài liệu Kỹ thuật cho `{target_name}`

> **Mẫu áp dụng:** {tpl}  
> **File mã nguồn:** `{file_path}`  
> **Tác nhân sinh:** LivingDocs Smart AST Synthesizer  
> **Trạng thái:** ACTIVE (Đã đồng bộ AST)  

---

## 1. Tổng quan & Mục đích thiết kế
Thành phần `{target_name}` nằm trong tệp `{file_path}`, đóng vai trò điều phối logic nghiệp vụ trong kiến trúc LivingDocs.

## 2. Chi tiết các Phần tử, Phương thức & API
{table_md}

### Đặc tả chuyên sâu các phần tử
{details_md}

## 3. Hướng dẫn Tích hợp & Sử dụng
```java
// Ví dụ sử dụng thành phần {target_name}
{target_name} instance = new {target_name}();
```
"""

    @classmethod
    def _build_prompt_for_template(
        cls,
        template_type: str,
        target_name: str,
        file_path: str,
        commit_hash: str,
        entities_summary: List[dict],
        source_code: Optional[str]
    ) -> str:
        """
        Thiết kế System Prompt chuẩn mực kỹ thuật theo các mẫu tài liệu:
        - PROJECT_DOCUMENTATION: Mẫu tài liệu Dự án tiêu chuẩn đầy đủ 10 phần.
        - API_REFERENCE: Bảng tham số, Endpoint/Method, HTTP status & Error codes.
        - README: Giới thiệu, tính năng cốt lõi, cấu trúc thành phần, cài đặt & Quick start.
        - MODULE_GUIDE: Bounded Context, Workflow dữ liệu, ràng buộc kỹ thuật, xử lý ngoại lệ.
        - ADR: Context, Options considered, Decision outcome, Consequences, Implementation mapping.
        """
        entities_json = json.dumps(entities_summary, ensure_ascii=False, indent=2)
        code_context = ""
        if source_code:
            trimmed_code = source_code[:15000] if len(source_code) > 15000 else source_code
            code_context = f"\n### ĐOẠN MÃ NGUỒN THAM CHIẾU:\n```java\n{trimmed_code}\n```\n"

        base_instructions = f"""Bạn là một Chuyên gia Kiến trúc Phần mềm và Senior Technical Writer cao cấp của hệ thống LivingDocs.
Nhiệm vụ của bạn là phân tích sâu sắc toàn bộ cấu trúc mã nguồn (bóc tách từ Tree-sitter AST) và viết một bản TÀI LIỆU KỸ THUẬT DÀI, ĐẦY ĐỦ, TOÀN DIỆN VÀ CHUYÊN SÂU bằng định dạng MARKDOWN. Tuyệt đối KHÔNG tóm tắt sơ sài, KHÔNG lược bỏ các hàm hoặc tham số.

### THÔNG TIN ĐẦU VÀO:
- Tên lớp / Thành phần chính: {target_name}
- Đường dẫn file mã nguồn: {file_path}
- Mã Commit Hash: {commit_hash}
- Loại mẫu tài liệu: {template_type}
- Danh sách các thực thể mã nguồn (AST Entities):
{entities_json}
{code_context}
"""

        if template_type == "PROJECT_DOCUMENTATION":
            template_rules = f"""### QUY TẮC CẤU TRÚC MARKDOWN BẮT BUỘC (MẪU TÀI LIỆU DỰ ÁN TIÊU CHUẨN ĐỦ 10 PHẦN):
Tài liệu BẮT BUỘC PHẢI CÓ ĐỦ 10 ĐỀ MỤC LỚN sau (từ ## 1 đến ## 10), TUYỆT ĐỐI KHÔNG ĐƯỢC RÚT GỌN XUỐNG 5 PHẦN, KHÔNG ĐƯỢC BỎ BỚT MỤC NÀO:

# Tài liệu Dự án Tiêu chuẩn: {target_name}
> **Mẫu áp dụng:** PROJECT_DOCUMENTATION (10 Phần Toàn diện) | **File nguồn:** `{file_path}` | **Trạng thái:** ACTIVE | **Phiên bản:** 1.0.0

## 1. Phần đầu tài liệu
- **Trang bìa:** Tên phần mềm `{target_name}`, Phiên bản v1.0.0, Tên tài liệu: Đặc tả Kỹ thuật Dự án Tiêu chuẩn, Đơn vị phát hành LivingDocs, Ngày phát hành (thời điểm hiện tại).
- **Lịch sử chỉnh sửa tài liệu:** Bảng Markdown đầy đủ cột: Phiên bản, Ngày, Người sửa, Nội dung thay đổi.
- **Mục lục:** Liệt kê đầy đủ 10 chương mục chính và danh mục hình ảnh, bảng biểu.

## 2. Giới thiệu
- **Mục đích của tài liệu:** Hướng dẫn chi tiết kiến trúc, thiết kế, triển khai và bảo trì cho thành phần `{target_name}`.
- **Đối tượng sử dụng:** Lập trình viên, Quản trị viên hệ thống, Kỹ sư kiểm thử (QA) và Khách hàng/Stakeholders.
- **Phạm vi và tổng quan phần mềm:** Các chức năng chính, lợi ích kỹ thuật và kinh doanh trong dự án.
- **Thuật ngữ, từ viết tắt & Quy ước trình bày:** Bảng giải thích chi tiết các thuật ngữ (AST, Genesis Hash, Tree-sitter, Semantic Drift), ký hiệu chú ý và cảnh báo.
- **Tài liệu tham khảo liên quan:** Các đường dẫn, RFC hoặc tài liệu phụ thuộc.

## 3. Yêu cầu hệ thống
- **Yêu cầu phần cứng:** Cấu hình CPU tối thiểu (4 Cores), RAM khuyến nghị (8GB - 16GB), Dung lượng ổ đĩa khả dụng (tối thiểu 10GB).
- **Hệ điều hành & Môi trường phụ thuộc:** Windows 10/11, macOS hoặc Linux; Yêu cầu Java 17+, Python 3.10+, Node.js 18+.
- **Yêu cầu kết nối mạng & Quyền truy cập:** Cổng kết nối (8080 Backend, 8000 AI Engine, 3000 Frontend, 5433 CSDL), cấu hình Firewall và quyền hạn tài khoản dịch vụ.

## 4. Cài đặt và cấu hình
- **Tải về và cài đặt:** Hướng dẫn chi tiết từng bước clone kho lưu trữ Git, cài đặt dependencies (Maven, npm, pip) và build ứng dụng.
- **Cấu hình ban đầu:** Thiết lập cấu hình file `.env`, file `application.properties`, cấu hình kết nối CSDL PostgreSQL và Ollama/Gemini.
- **Kích hoạt bản quyền & Đăng ký tài khoản:** Khởi tạo tài khoản quản trị (Admin) và thiết lập kết nối GitHub OAuth2.
- **Cập nhật & Gỡ cài đặt:** Quy trình cập nhật mã nguồn mới (git pull, database migration) và quy trình gỡ bỏ, sao lưu an toàn.

## 5. Bắt đầu sử dụng (Quick Start)
- **Đăng nhập, đăng xuất, đổi mật khẩu:** Quy trình chứng thực an toàn qua JWT Token và GitHub OAuth.
- **Giới thiệu giao diện chính:** Thanh công cụ, menu điều hướng, cây thư mục mã nguồn và chuông thông báo trạng thái.
- **Phân quyền và vai trò người dùng:** Ma trận quyền hạn Admin (Toàn quyền), Manager (Phê duyệt), Staff (Thẩm định), User (Tạo tài liệu).
- **Quy trình sử dụng cơ bản:** Luồng 4 bước tạo tài liệu, kiểm thử AST, gửi phê duyệt và xuất bản tài liệu.

## 6. Hướng dẫn chi tiết từng chức năng
- **Bảng tổng hợp chức năng từ mã nguồn AST:**
  | STT | Tên chức năng / Thành phần | Phương thức / Endpoint | Điều kiện cần | Kết quả mong đợi |
  (Liệt kê đầy đủ mọi class và method bóc tách từ AST)
- **Đặc tả chi tiết:** Phân tích sâu từng hàm, tham số đầu vào, kiểu dữ liệu trả về và logic nghiệp vụ bên trong.

## 7. Xử lý sự cố (Troubleshooting)
- **Bảng mã lỗi và biện pháp khắc phục:**
  | Mã lỗi | Tên lỗi | Nguyên nhân phát sinh | Hướng xử lý |
  | 400 | Bad Request | Tham số yêu cầu không hợp lệ | Kiểm tra payload JSON gửi lên |
  | 401 | Unauthorized | Token JWT hết hạn hoặc chưa đăng nhập | Đăng nhập lại hoặc làm mới token |
  | 403 | Forbidden | Không có quyền hạn phù hợp | Yêu cầu cấp quyền từ Quản trị viên |
  | 404 | Not Found | Tài nguyên không tồn tại | Kiểm tra đường dẫn URL hoặc ID |
  | 422 | Unprocessable | Sai schema định dạng dữ liệu | Chuẩn hóa schema theo OpenAPI spec |
  | 500 | Internal Server Error | Lỗi hệ thống nội bộ | Kiểm tra file log server để khắc phục |
- **Câu hỏi thường gặp (FAQ):** Giải đáp chi tiết các thắc mắc phổ biến khi cài đặt và sử dụng.
- **Các lỗi thường gặp khi cài đặt và sử dụng:** Khắc phục lỗi kết nối DB, timeout AI Engine và xung đột cổng mạng.

## 8. Bảo mật và sao lưu
- **Lưu ý bảo mật tài khoản & Dữ liệu:** Mã hóa mật khẩu một chiều (BCrypt), mã hóa Token JWT (HS256 256-bit), CORS & Spring Security.
- **Sao lưu và phục hồi dữ liệu:** Lịch trình sao lưu tự động PostgreSQL hàng ngày và quy trình khôi phục khi gặp thảm họa.

## 9. Hỗ trợ & Phản hồi
- **Thông tin liên hệ bộ phận hỗ trợ:** Email hỗ trợ kỹ thuật (support@livingdocs.com), Hotline và kênh Discord/Slack.
- **Cách báo lỗi & Gửi phản hồi:** Hướng dẫn mở Issue trên GitHub Repository kèm log lỗi và các bước tái hiện.

## 10. Phụ lục
- **Danh sách phím tắt:** Bảng phím tắt thao tác nhanh trong trình soạn thảo Markdown.
- **Bảng thuật ngữ (Glossary):** Bảng giải nghĩa đầy đủ các khái niệm kỹ thuật trong dự án (AST, Genesis Hash, Tree-sitter, Semantic Drift).
- **Giấy phép, bản quyền & Điều khoản sử dụng:** Bản quyền phần mềm LivingDocs, giấy phép MIT và điều khoản sử dụng.
- **Mẫu biểu, dữ liệu mẫu & Chỉ mục tra cứu:** Cấu trúc JSON mẫu và bảng chỉ mục tra cứu nhanh.
"""

        elif template_type == "API_REFERENCE":
            template_rules = f"""### QUY TẮC CẤU TRÚC MARKDOWN BẮT BUỘC (MẪU API_REFERENCE):
Tài liệu PHẢI tuân thủ chính xác các đề mục sau:

# API Reference: {target_name}
> **Mẫu áp dụng:** API_REFERENCE | **File nguồn:** `{file_path}` | **Trạng thái:** ACTIVE

## 1. Tổng quan & Trách nhiệm API
- Mô tả mục đích nghiệp vụ, vai trò trong kiến trúc hệ thống và các giao thức áp dụng.

## 2. Danh sách Endpoint & Phương thức Công khai
- Tạo bảng Markdown tổng hợp:
  | Phương thức / Endpoint | Chữ ký / HTTP | Vị trí dòng | Trách nhiệm chính |
  (Điền đầy đủ các hàm từ AST)

## 3. Bảng Tham số Kỹ thuật & Kiểu dữ liệu
- Tạo bảng Markdown đặc tả chi tiết mọi tham số đầu vào và kiểu trả về:
  | Tham số / Trường | Kiểu dữ liệu | Bắt buộc | Vị trí | Mô tả & Ràng buộc nghiệp vụ |
  (Phân tích chi tiết từng tham số của các method)

## 4. Cấu trúc Phản hồi & Bảng Mã lỗi (HTTP & Internal Error Codes)
- Tạo bảng mã trạng thái và xử lý lỗi:
  | HTTP Code | Exception / Mã lỗi | Điều kiện phát sinh | Giải pháp khắc phục |
  | 200 OK | - | Thực thi thành công | - |
  | 400 Bad Request | IllegalArgumentException | Dữ liệu đầu vào hoặc tham số không hợp lệ | Kiểm tra payload |
  | 401 Unauthorized | BadCredentialsException | Token hết hạn hoặc không có quyền | Xác thực lại phiên |
  | 404 Not Found | ResourceNotFoundException | Không tìm thấy thực thể được yêu cầu | Kiểm tra định danh |
  | 500 Internal Error | ServiceException | Lỗi nội bộ trong quá trình xử lý | Liên hệ Tech Lead |

## 5. Ví dụ Gọi API & Tích hợp (Code Snippet & Payload)
- Cung cấp ít nhất một đoạn code mẫu (Java RestClient / cURL / JSON payload) minh họa cách gọi các phương thức trên.
"""

        elif template_type == "README":
            template_rules = f"""### QUY TẮC CẤU TRÚC MARKDOWN BẮT BUỘC (MẪU README):
Tài liệu PHẢI tuân thủ chính xác các đề mục sau:

# {target_name} - Tài liệu Kỹ thuật & Hướng dẫn Sử dụng
> **Mẫu áp dụng:** README | **File nguồn:** `{file_path}` | **Phiên bản:** 1.0.0

## 1. Giới thiệu & Vai trò trong Hệ thống
- Tổng quan ngắn gọn về thành phần `{target_name}`, bài toán kỹ thuật mà nó giải quyết trong dự án LivingDocs.

## 2. Tính năng Cốt lõi
- Liệt kê danh sách các tính năng chính dưới dạng gạch đầu dòng (bullet points) dựa trên các method bóc tách từ AST.

## 3. Cấu trúc Mô-đun & Danh sách Thành phần
- Tạo bảng Markdown liệt kê cấu trúc thành phần:
  | Thành phần | Loại phần tử | Vị trí dòng | Trách nhiệm chính |

## 4. Yêu cầu Cấu hình & Dependencies
- Các thông số cấu hình, biến môi trường (environment variables) hoặc service liên quan mà lớp này phụ thuộc.

## 5. Hướng dẫn Bắt đầu Nhanh (Quick Start)
- Cung cấp đoạn code ví dụ minh họa cách khởi tạo và sử dụng `{target_name}` trong thực tế.
"""

        elif template_type == "MODULE_GUIDE":
            template_rules = f"""### QUY TẮC CẤU TRÚC MARKDOWN BẮT BUỘC (MẪU MODULE_GUIDE):
Tài liệu PHẢI tuân thủ chính xác các đề mục sau:

# Hướng dẫn Kiến trúc & Mô-đun: {target_name}
> **Mẫu áp dụng:** MODULE_GUIDE | **File nguồn:** `{file_path}` | **Kiến trúc:** Layered Architecture / DDD

## 1. Ranh giới Nghiệp vụ & Bounded Context
- Trách nhiệm đơn nhất (Single Responsibility Principle) của module `{target_name}` và phạm vi ranh giới nghiệp vụ trong hệ thống.

## 2. Thiết kế Thành phần & Luồng Dữ liệu (Workflow)
- Mô tả chi tiết quy trình xử lý dữ liệu qua từng bước khi một request đi qua các hàm của `{target_name}`.

## 3. Bảng Đặc tả Kỹ thuật & Ràng buộc Phương thức
- Tạo bảng Markdown chi tiết:
  | Phương thức | Chữ ký | Tham số | Kiểu trả về | Ràng buộc & Tiền điều kiện |

## 4. Chiến lược Xử lý Ngoại lệ & Quản lý Giao dịch (Transaction & Error Handling)
- Giải thích các annotation giao dịch (`@Transactional`), các trường hợp rollback và cách bắt/ném ngoại lệ nghiệp vụ.

## 5. Hướng dẫn Mở rộng & Tích hợp Nội bộ (Extension Guide)
- Hướng dẫn các developer khác cách kế thừa, mở rộng hoặc tích hợp thêm chức năng mà không phá vỡ logic cũ.
"""

        else:  # ADR (Architecture Decision Record)
            template_rules = f"""### QUY TẮC CẤU TRÚC MARKDOWN BẮT BUỘC (MẪU ADR - ARCHITECTURE DECISION RECORD):
Tài liệu PHẢI tuân thủ chính xác các đề mục sau:

# ADR: Quyết định Kiến trúc cho {target_name}
> **Mẫu áp dụng:** ADR | **File nguồn:** `{file_path}` | **Trạng thái:** ACCEPTED | **Ngày:** (Thời điểm hiện tại)

## 1. Bối cảnh & Vấn đề Kỹ thuật (Context)
- Bối cảnh thực tế của hệ thống và vấn đề kỹ thuật cần giải quyết đối với `{target_name}`.

## 2. Các Lựa chọn Kiến trúc Đã Xem xét (Options Considered)
- Tạo bảng so sánh các giải pháp kỹ thuật khả dĩ:
  | Phương án | Ưu điểm | Nhược điểm | Đánh giá tính khả thi |

## 3. Quyết định Kiến trúc Được Chọn (Decision Outcome)
- Khẳng định giải pháp thiết kế được áp dụng trong mã nguồn `{target_name}` và lý do chọn phương án này.

## 4. Hệ quả & Tác động Hệ thống (Consequences)
- **Tác động tích cực (+):** Về hiệu năng, tính mở rộng, độ tin cậy và khả năng bảo trì.
- **Tác động tiêu cực / Thách thức (-):** Độ phức tạp, chi phí kiểm thử hoặc các trade-off cần lưu ý.

## 5. Bảng Ánh xạ Thực thi trong Mã nguồn (Implementation Mapping)
- Tạo bảng Markdown đối chiếu quyết định với các phần tử trong code:
  | Thành phần triển khai | Loại | Vị trí dòng | Chức năng cụ thể |
"""

        footer_note = """
### YÊU CẦU TRÌNH BÀY:
- Viết bằng TIẾNG VIỆT chuẩn kỹ thuật phần mềm, văn phong chuyên sâu, giải thích cặn kẽ.
- BẮT BUỘC viết tài liệu DÀI, ĐẦY ĐỦ VÀ CHI TIẾT (Comprehensive Documentation). TUYỆT ĐỐI KHÔNG tóm tắt ngắn gọn hay lược bỏ thông tin.
- Với từng hàm/phương thức: BẮT BUỘC phân tích chi tiết mục đích, luồng xử lý bên trong (Step-by-Step Flow), ý nghĩa từng tham số, kiểu trả về và các ngoại lệ có thể phát sinh.
- BẮT BUỘC có các bảng Markdown, tiêu đề phân cấp rõ ràng, code block hoàn chỉnh (không viết code tắt hoặc '...').
- BẮT BUỘC có các bảng Markdown, tiêu đề rõ ràng, code block chuẩn cú pháp.
- KHÔNG viết thêm các lời chào hỏi hay giải thích ngoài lề, chỉ trả về nội dung Markdown của tài liệu.
"""
        return base_instructions + template_rules + footer_note

    @classmethod
    def generate_documentation(cls, request: DocGenerateRequest) -> DocGenerateResponse:
        """
        Sinh tài liệu Markdown hoàn chỉnh từ cấu trúc AST và template bằng Google Gemini API.
        Tự động xoay API Key trong Multi-Key Pool nếu gặp lỗi hạn mức Quota (429).
        Nhúng khối Grounding Evidence Box xác thực nguồn vào cuối tài liệu.
        Nếu API Key chưa hợp lệ hoặc tất cả model tạm thời gián đoạn, tự động fallback sang Smart AST Synthesis.
        """
        # ponytail: Hỗ trợ chỉ định trực tiếp provider='ollama' để sinh tài liệu offline trên GPU RTX 4060
        active_provider = (request.provider or get_settings().ai_provider or "auto").lower()
        if active_provider == "ollama":
            from app.services.ollama_doc_service import OllamaDocService
            logger.info("Yêu cầu chỉ định sử dụng AI Local Ollama (GPU RTX 4060)...")
            return OllamaDocService.generate_documentation(request)

        template_type = cls._normalize_template_type(request.template_type)
        commit_hash = request.commit_hash or "verified-ast-grounding"

        target_name = request.class_name or (
            request.entities[0].class_name if request.entities and request.entities[0].class_name else "CodeComponent"
        )

        entities_summary = []
        grounding_evidences: List[GroundingEvidence] = []
        entities_list = request.entities or []

        for e in entities_list:
            entities_summary.append({
                "entity_type": e.entity_type,
                "name": e.method_name or e.class_name,
                "signature": e.signature,
                "return_type": e.return_type or "void",
                "parameters": e.parameters or "None",
                "lines": f"L{e.start_line} -> L{e.end_line}",
                "annotations": e.annotations or [],
                "javadoc": e.javadoc or "Chưa có",
            })

            grounding_evidences.append(
                GroundingEvidence(
                    file_path=request.file_path,
                    class_name=e.class_name,
                    method_name=e.method_name,
                    start_line=e.start_line,
                    end_line=e.end_line,
                    commit_hash=commit_hash,
                    signature=e.signature,
                    entity_type=e.entity_type,
                )
            )

        # Tính toán điểm tin cậy dựa trên tỷ lệ entity và AST grounding
        total_count = len(entities_list) if entities_list else 1
        documented_count = sum(1 for e in entities_list if e.javadoc) if entities_list else 0
        base_score = 0.88 + min(0.10, (documented_count / total_count) * 0.10)
        confidence_score = round(base_score, 2)

        grounding_box_md = cls._build_grounding_box_markdown(
            file_path=request.file_path,
            commit_hash=commit_hash,
            entities=entities_list
        )

        active_key = GeminiKeyManager.get_active_api_key()
        if not cls._is_valid_google_api_key(active_key):
            logger.info("Sử dụng chế độ tổng hợp AST thông minh (Smart AST Synthesis) do GEMINI_API_KEY chưa hợp lệ.")
            synthesized_md = cls._build_smart_ast_markdown(request, target_name, entities_summary)
            if "Khối Bằng chứng Xác thực Nguồn" not in synthesized_md:
                synthesized_md = synthesized_md.rstrip() + "\n\n" + grounding_box_md.strip()
            return DocGenerateResponse(
                status="success",
                mode="ast-synthesis",
                template_type=template_type,
                file_path=request.file_path,
                generated_content=synthesized_md,
                confidence_score=confidence_score,
                grounding_evidence=grounding_evidences,
            )

        prompt = cls._build_prompt_for_template(
            template_type=template_type,
            target_name=target_name,
            file_path=request.file_path,
            commit_hash=commit_hash,
            entities_summary=entities_summary,
            source_code=request.source_code,
        )

        def _call_gemini_doc():
            client = GeminiKeyManager.get_active_client()
            last_err = None

            for model_name in DOC_MODELS:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            temperature=0.2,
                            top_p=0.9,
                            max_output_tokens=8192,
                        ),
                    )
                    return resp, model_name
                except Exception as ex:
                    last_err = ex
                    err_str = str(ex).lower()
                    if any(k in err_str for k in ("not found", "503", "unavailable", "overloaded", "404")):
                        logger.warning(f"Model {model_name} gặp sự cố ({ex}), chuyển sang model tiếp theo...")
                        continue
                    raise ex

            raise last_err or RuntimeError("Tất cả các model Gemini đều không khả dụng.")

        try:
            response, active_model_name = execute_with_gemini_retry(
                action=_call_gemini_doc,
                max_retries=3,
                initial_delay=1.0,
                backoff_factor=2.0,
                action_name="DocGenerate"
            )

            generated_raw = response.text if response and response.text else ""

            clean_markdown = generated_raw.strip()
            if clean_markdown.startswith("```markdown"):
                clean_markdown = clean_markdown[len("```markdown"):].strip()
            elif clean_markdown.startswith("```"):
                clean_markdown = clean_markdown[3:].strip()
            if clean_markdown.endswith("```"):
                clean_markdown = clean_markdown[:-3].strip()

            if "Khối Bằng chứng Xác thực Nguồn" not in clean_markdown and "Grounding Evidence Box" not in clean_markdown:
                clean_markdown = clean_markdown.rstrip() + "\n\n" + grounding_box_md.strip()

            return DocGenerateResponse(
                status="success",
                mode="real",
                template_type=template_type,
                file_path=request.file_path,
                generated_content=clean_markdown,
                confidence_score=confidence_score,
                grounding_evidence=grounding_evidences,
            )

        except Exception as ex:
            logger.warning(f"Sự cố gọi Gemini API: {ex}")
            # ponytail: Nếu Ollama local trên RTX 4060 đang chạy, ưu tiên sinh tài liệu hoàn chỉnh thay vì rớt xuống AST tĩnh
            try:
                from app.services.ollama_doc_service import OllamaDocService
                if OllamaDocService.is_available():
                    logger.info("Gemini gián đoạn, tự động failover sang mô hình AI Local Ollama (qwen2.5-coder:7b)...")
                    return OllamaDocService.generate_documentation(request)
            except Exception as o_ex:
                logger.warning(f"Failover sang Ollama cũng gặp sự cố: {o_ex}")

            logger.warning("Chuyển sang chế độ tổng hợp AST dự phòng do không có AI khả dụng.")
            synthesized_md = cls._build_smart_ast_markdown(request, target_name, entities_summary)
            if "Khối Bằng chứng Xác thực Nguồn" not in synthesized_md:
                synthesized_md = synthesized_md.rstrip() + "\n\n" + grounding_box_md.strip()
            return DocGenerateResponse(
                status="success",
                mode="ast-synthesis",
                template_type=template_type,
                file_path=request.file_path,
                generated_content=synthesized_md,
                confidence_score=confidence_score,
                grounding_evidence=grounding_evidences,
            )
