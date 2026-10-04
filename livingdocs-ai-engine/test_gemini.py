import os
import sys

# Đảm bảo console Windows in chuẩn UTF-8 tiếng Việt không bị lỗi charmap
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
import google.generativeai as genai

def test_gemini_connection():
    print("=" * 60)
    print(" LivingDocs AI Engine - Kiểm tra kết nối Google Gemini API")
    print("=" * 60)

    current_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(current_dir, ".env")
    
    if not os.path.exists(env_path):
        print(f"[!] LỖI: Không tìm thấy file: {env_path}")
        sys.exit(1)

    load_dotenv(dotenv_path=env_path)
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("[!] LỖI: GEMINI_API_KEY chưa được cấu hình trong .env!")
        sys.exit(1)

    print(f"[+] Đã tìm thấy GEMINI_API_KEY (Độ dài: {len(api_key)} ký tự)")

    try:
        genai.configure(api_key=api_key)
        
        # Sử dụng model mới nhất: gemini-3.8-flash
        model_name = "gemini-3.8-flash"
        model = genai.GenerativeModel(model_name)
        print(f"[+] Khởi tạo model thành công: {model_name}")

        sample_java_code = """
public class UserService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User registerUser(String email, String rawPassword) {
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already in use");
        }
        String hashedPassword = passwordEncoder.encode(rawPassword);
        User newUser = new User(email, hashedPassword, UserRole.DEVELOPER);
        return userRepository.save(newUser);
    }
}
"""

        prompt = f"""Bạn là LivingDocs AI Engine chuyên phân tích mã nguồn.
Hãy tóm tắt ngắn gọn mục đích của lớp Java sau và liệt kê các phương thức của nó bằng tiếng Việt:

```java
{sample_java_code}
```
"""

        print("[*] Đang gửi request tới Gemini API...")
        response = model.generate_content(prompt)

        print("\n" + "=" * 60)
        print(" KẾT QUẢ PHẢN HỒI TỪ GEMINI (THÀNH CÔNG):")
        print("=" * 60)
        print(response.text.strip())
        print("=" * 60)
        print("\n[OK] KẾT NỐI GEMINI API HOÀN TOÀN THÀNH CÔNG! SẴN SÀNG CHO SPRINT 1.")

    except Exception as e:
        print("\n[!] LỖI KHI GỌI GEMINI API:")
        print(f"    Chi tiết: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_gemini_connection()
