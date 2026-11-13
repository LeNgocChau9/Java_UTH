"""
chat_service.py
Dịch vụ Chatbot AI hỗ trợ người dùng toàn hệ thống LivingDocs:
- Ưu tiên 1: Google Gemini API (Multi-Key Pool với Auto-Rotation khi gặp lỗi 429 Quota).
- Ưu tiên 2 (Failover): AI Local (Ollama - Qwen 2.5 Coder 7B trên GPU RTX 4060) khi Gemini cạn key hoặc ngoại tuyến.
- Ưu tiên 3 (Dự phòng): Bộ phản hồi trợ giúp thông minh LivingDocs Helper nếu cả hai đều bận.
"""

import json
import logging
from typing import List, Optional
import httpx
from google import genai
from google.genai import types as genai_types

from app.core.config import get_settings
from app.core.gemini_key_manager import GeminiKeyManager
from app.core.gemini_retry import (
    execute_with_gemini_retry,
    GeminiQuotaExceededError,
    GeminiServiceUnavailableError,
)
from app.services.gemini_doc_service import GeminiDocService
from app.services.ollama_doc_service import OllamaDocService
from app.schemas.ai_schemas import ChatRequest, ChatResponse, ChatMessageItem

logger = logging.getLogger(__name__)

CHAT_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.5-pro",
]

DEFAULT_SYSTEM_PROMPT = """Bạn là Trợ lý AI LivingDocs chuyên nghiệp, đồng hành cùng kỹ sư và người dùng trong hệ thống Tài liệu Kỹ thuật Tự động (LivingDocs AI Documentation).
Bạn có kiến thức sâu rộng về:
1. Tính năng cốt lõi của LivingDocs:
   - **Workspace**: Không gian soạn thảo Markdown kết hợp Live Preview, nạp tài liệu Word (.docx), xuất Word chuyên nghiệp, lưu bản nháp và gửi duyệt.
   - **Cây mã nguồn (AST Explorer)**: Bóc tách các Class, Method, Constructor, Field từ mã nguồn bằng Tree-sitter AST (hỗ trợ Java, TypeScript, Python, SQL).
   - **Đối chiếu Template (Cross-Check)**: Rà soát tài liệu 2 chiều với các Template tiêu chuẩn (Mẫu Dự án 10 phần, API Reference, README, Module Guide, ADR), đối chiếu với thực thể mã nguồn thật để phát hiện thiếu sót.
   - **Khoảng trống tài liệu (Documentation Gaps)**: Liệt kê các Class, Method trong code chưa có tài liệu mô tả, gắn nút sinh tài liệu AI một chạm.
   - **Cảnh báo sai lệch (Drift Detection)**: Tự động phân tích và cảnh báo khi mã nguồn thay đổi qua commit / PR nhưng tài liệu kỹ thuật chưa cập nhật kịp thời.
   - **Đồ thị liên kết kiến trúc (Architecture Knowledge Graph)**: Trực quan hóa mối liên kết giữa tài liệu và các thành phần code.
   - **Hàng đợi xem xét & Phê duyệt**: Quy trình kiểm duyệt và xuất bản tài liệu kỹ thuật có quản lý phiên bản (v1, v2...).
2. Kiến trúc phần mềm & Công nghệ:
   - Clean Architecture, Hexagonal Architecture, Domain-Driven Design (DDD).
   - Java Spring Boot, TypeScript/Next.js, Python FastAPI, PostgreSQL.
Hãy trả lời người dùng ngắn gọn, súc tích, chuyên nghiệp bằng tiếng Việt, định dạng Markdown rõ ràng (bullet points, bảng, code block khi cần thiết). Thân thiện và sẵn lòng hướng dẫn chi tiết từng bước khi người dùng hỏi cách thao tác."""


class ChatService:

    @classmethod
    async def chat(cls, request: ChatRequest) -> ChatResponse:
        """
        Điều phối chat:
        1. Ưu tiên thử gọi Google Gemini API với hồ chứa Multi-Key và Auto-Rotation.
        2. Nếu Gemini hết hạn mức hoặc lỗi, tự động chuyển đổi dự phòng (failover) sang AI Local (Ollama).
        3. Nếu cả 2 đều không khả dụng, trả về câu trả lời hỗ trợ tích hợp sẵn.
        """
        system_instruction = request.system_prompt or DEFAULT_SYSTEM_PROMPT

        # 1. THỬ GỌI GOOGLE GEMINI TRƯỚC TIÊN
        has_gemini_keys = False
        try:
            active_key = GeminiKeyManager.get_active_api_key()
            has_gemini_keys = GeminiDocService._is_valid_google_api_key(active_key)
        except Exception:
            has_gemini_keys = False

        if has_gemini_keys:
            try:
                gemini_reply, model_used = cls._call_gemini_chat(request, system_instruction)
                if gemini_reply and gemini_reply.strip():
                    return ChatResponse(
                        status="success",
                        reply=gemini_reply.strip(),
                        provider="gemini",
                        model=model_used,
                    )
            except (GeminiQuotaExceededError, GeminiServiceUnavailableError) as qe:
                logger.warning(f"[ChatService] Gemini Quota cạn kiệt hoặc dịch vụ gián đoạn ({qe}). Kích hoạt AI Local (Ollama)...")
            except Exception as ex:
                logger.warning(f"[ChatService] Lỗi khi gọi Gemini ({ex}). Chuyển đổi sang AI Local (Ollama)...")

        # 2. FAILOVER SANG AI LOCAL (OLLAMA TRÊN GPU RTX 4060)
        if OllamaDocService.is_available():
            try:
                logger.info("[ChatService] Đang điều phối câu hỏi sang AI Local (Ollama)...")
                ollama_reply, model_used = cls._call_ollama_chat(request, system_instruction)
                if ollama_reply and ollama_reply.strip():
                    return ChatResponse(
                        status="success",
                        reply=ollama_reply.strip(),
                        provider="ollama",
                        model=f"{model_used} (Local GPU)",
                    )
            except Exception as ex:
                logger.error(f"[ChatService] AI Local (Ollama) phản hồi lỗi: {ex}")

        # 3. DỰ PHÒNG TÍCH HỢP (FALLBACK INTELLIGENT HELPER)
        logger.info("[ChatService] Sử dụng bộ phản hồi dự phòng thông minh...")
        fallback_reply = cls._generate_smart_fallback(request.message)
        return ChatResponse(
            status="success",
            reply=fallback_reply,
            provider="fallback",
            model="LivingDocs Assistant (Offline Guide)",
        )

    @classmethod
    def _call_gemini_chat(cls, request: ChatRequest, system_prompt: str) -> tuple[str, str]:
        """Gọi Google Gemini với cơ chế Retry & Auto-Rotation."""
        # Xây dựng nội dung gửi sang Gemini
        contents = []

        # Thêm lịch sử hội thoại nếu có
        for h in (request.history or [])[-8:]:  # Lấy 8 tin nhắn gần nhất
            role_tag = "user" if h.role == "user" else "model"
            contents.append(
                genai_types.Content(
                    role=role_tag,
                    parts=[genai_types.Part.from_text(text=h.content)],
                )
            )

        # Thêm câu hỏi hiện tại
        contents.append(
            genai_types.Content(
                role="user",
                parts=[genai_types.Part.from_text(text=request.message)],
            )
        )

        def _invoke():
            client = GeminiKeyManager.get_active_client()
            last_err = None

            for model_name in CHAT_MODELS:
                try:
                    resp = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=genai_types.GenerateContentConfig(
                            system_instruction=system_prompt,
                            temperature=0.3,
                            max_output_tokens=2048,
                        ),
                    )
                    text = resp.text if resp and resp.text else ""
                    return text, model_name
                except Exception as ex:
                    last_err = ex
                    err_str = str(ex).lower()
                    if any(k in err_str for k in ("not found", "503", "unavailable", "overloaded", "404")):
                        logger.warning(f"[ChatService] Model {model_name} bận, thử model tiếp theo...")
                        continue
                    raise ex

            raise last_err or RuntimeError("Không thể kết nối đến các model Gemini.")

        reply_text, used_model = execute_with_gemini_retry(
            action=_invoke,
            max_retries=2,
            initial_delay=0.8,
            backoff_factor=1.5,
            action_name="ChatGemini",
        )
        return reply_text, used_model

    @classmethod
    def _call_ollama_chat(cls, request: ChatRequest, system_prompt: str) -> tuple[str, str]:
        """Gọi Ollama Local qua API /api/chat."""
        settings = get_settings()
        chat_url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"

        messages = [{"role": "system", "content": system_prompt}]
        for h in (request.history or [])[-6:]:
            messages.append({"role": h.role, "content": h.content})
        messages.append({"role": "user", "content": request.message})

        payload = {
            "model": settings.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 1024,
            },
        }

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(chat_url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        reply_text = data.get("message", {}).get("content", "")
        return reply_text, settings.ollama_model

    @classmethod
    def _generate_smart_fallback(cls, message: str) -> str:
        """Bộ phản hồi dự phòng dựa trên phân tích từ khóa khi hệ thống AI bên ngoài không phản hồi."""
        msg_lower = message.lower()

        if any(w in msg_lower for w in ("workspace", "soạn thảo", "word", "docx")):
            return (
                "### 📝 Không gian làm việc Workspace\n\n"
                "- **Soạn thảo song song:** Hỗ trợ viết Markdown bên trái và xem trước (Live Preview) bên phải.\n"
                "- **Nạp & Xuất Word:** Bấm nút **'Nạp Word'** để đưa tài liệu `.docx` có sẵn vào Workspace và tự động đối chiếu, hoặc bấm **'Xuất Word'** để tải về tài liệu định dạng chuẩn Word.\n"
                "- **Kéo dãn các ngăn:** Rê chuột vào đường viền phân cách giữa các tab để kéo qua lại phóng to/thu nhỏ khung soạn thảo theo ý muốn.\n"
                "- **Đối chiếu Template:** Bấm nút **'Đối chiếu'** hoặc rê chuột vào để chọn mẫu tiêu chuẩn (Dự án 10 phần, API, README...).\n\n"
                "*Bạn cần hướng dẫn chi tiết thêm ở thao tác nào?*"
            )

        if any(w in msg_lower for w in ("đối chiếu", "template", "mẫu", "cross-check", "cross check")):
            return (
                "### 🔍 Đối chiếu tài liệu theo Template chuẩn\n\n"
                "- **Đối chiếu 2 chiều:** Hệ thống kiểm tra cấu trúc tài liệu của bạn có đủ các đề mục bắt buộc theo Template hay chưa, đồng thời so sánh với các Class/Method thật trong code.\n"
                "- **Đổi Template linh hoạt:** Rê chuột vào nút **'Đối chiếu'** ở thanh công cụ hoặc chọn ở ngăn **'Đối chiếu 2 Chiều'** bên phải để đổi sang Template khác (vd: *Mẫu Dự án 10 phần*, *API Reference*...).\n"
                "- **Bổ sung tự động một chạm:** Bấm **'Quét lại'** hoặc **'Đối chiếu'**, bảng đề xuất sẽ hiện các mục còn thiếu kèm nút tự động chèn vào tài liệu."
            )

        if any(w in msg_lower for w in ("khoảng trống", "gaps", "chưa có tài liệu")):
            return (
                "### ⚠️ Quản lý Khoảng trống Tài liệu (Documentation Gaps)\n\n"
                "- **Mục đích:** Phát hiện các Lớp (Class), Giao diện (Interface) và Phương thức (Method) trong mã nguồn dự án chưa được viết tài liệu mô tả.\n"
                "- **Cách dùng:** Vào menu **'Khoảng trống tài liệu'** ở thanh bên trái, chọn kho lưu trữ để xem danh sách chi tiết.\n"
                "- **Sinh tự động:** Bấm nút hành động cạnh thực thể để tự động nạp sang Workspace và sinh tài liệu AI tức thì."
            )

        if any(w in msg_lower for w in ("sai lệch", "drift", "cảnh báo")):
            return (
                "### 🚨 Phát hiện Sai lệch Tài liệu (Drift Detection)\n\n"
                "- Khi lập trình viên thay đổi code (đổi tên hàm, sửa tham số, xóa phương thức) qua Git commit/PR, LivingDocs tự động phân tích diff AST.\n"
                "- Cảnh báo mức độ nghiêm trọng (Low, Medium, High, Critical) và đề xuất viết lại tài liệu tại trang **'Cảnh báo sai lệch'**."
            )

        if any(w in msg_lower for w in ("cây thư mục", "ast", "tree-sitter", "mã nguồn")):
            return (
                "### 🌲 Cây mã nguồn (AST Explorer)\n\n"
                "- Trực quan hóa cấu trúc tệp của Repository.\n"
                "- Bóc tách chi tiết từng Class, Function, Method, Constructor, Field cùng với chữ ký (Signature), tham số và kiểu trả về thật nhờ bộ phân giải Tree-sitter AST."
            )

        return (
            "Chào bạn! Tôi là **Trợ lý AI LivingDocs**.\n\n"
            "Tôi có thể hỗ trợ bạn trong suốt quá trình làm việc với hệ thống:\n"
            "- 📂 **Workspace & Quản lý Tài liệu:** Hướng dẫn soạn thảo, nạp/xuất file Word (`.docx`), đối chiếu Template chuẩn.\n"
            "- 🔍 **Bóc tách AST & Kho lưu trữ:** Giải thích cấu trúc mã nguồn, phát hiện khoảng trống tài liệu chưa có mô tả.\n"
            "- ⚡ **Cảnh báo sai lệch (Drift):** Kiểm tra khi mã nguồn thay đổi nhưng tài liệu chưa cập nhật.\n"
            "- 💡 **Hỗ trợ kỹ thuật phần mềm:** Giải đáp về kiến trúc Java, Spring Boot, Clean Architecture, Next.js, API.\n\n"
            "*Hãy nhập câu hỏi của bạn để tôi hỗ trợ nhé!*"
        )
