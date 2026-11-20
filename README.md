<div align="center">

<img src="livingdocs-frontend/public/logo.png" alt="LivingDocs" width="120" />

<h3>LivingDocs</h3>

**Nền tảng quản trị, tự động sinh và đồng bộ tài liệu kỹ thuật theo mã nguồn bằng AI**

[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.3-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.10+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-pgvector-4169E1?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/LeNgocChau9/Java_UTH/pulls)

[Tổng quan](#tổng-quan) |
[Tính năng](#tính-năng-nổi-bật) |
[Kiến trúc](#kiến-trúc-hệ-thống) |
[Quick Start](#quick-start) |
[Đóng góp](#đóng-góp)

</div>

### Tổng quan

Trong các dự án phần mềm, tài liệu kỹ thuật nhanh chóng lỗi thời (documentation drift) mỗi khi lập trình viên thay đổi code, thêm hoặc sửa hàm, hay merge Pull Request.

LivingDocs giải quyết vấn đề này bằng cách:

- Bóc tách cây cú pháp trừu tượng (AST) của mã nguồn để nắm chính xác cấu trúc code.
- Phát hiện sai lệch giữa code và tài liệu gần như theo thời gian thực.
- Tự động sinh và cập nhật tài liệu cục bộ bằng AI, hỗ trợ cả Cloud LLM lẫn Ollama chạy trên máy.
- Kiểm soát chất lượng qua quy trình phê duyệt 2 cấp trước khi xuất bản ngược lên GitHub.

### Tính năng nổi bật

| # | Tính năng | Mô tả |
|:-:|-----------|-------|
| 1 | AST Extraction và Coverage Gaps | Quét kho mã nguồn, lập chỉ mục `CLASS`, `INTERFACE`, `METHOD`, `FUNCTION` vào bảng `code_entities`. Thống kê độ bao phủ tài liệu (%) và liệt kê các thực thể còn thiếu tài liệu để sinh chỉ với một cú nhấp chuột. |
| 2 | Localized Entity Doc Regeneration | Chọn một hàm hoặc lớp đã lỗi thời trên cây mã nguồn (`/cay-ma-nguon`), bóc tách lại AST của riêng thực thể đó, AI viết lại đúng phần mô tả và cập nhật vào tài liệu tổng thể mà không làm xáo trộn các phần đã được phê duyệt. Kết quả lưu thành bản nháp `DRAFT` mới. |
| 3 | Drift Detection và GitHub Checks Gate | Phân loại độ trôi dạt (`SIGNATURE`, `SEMANTIC`, `REFERENCE`) theo 4 mức (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). Tích hợp GitHub Checks API với hai chế độ: Strict Block (chặn merge PR) và Warn Only (chỉ cảnh báo). Tự động mở khóa khi tài liệu được duyệt. |
| 4 | 2-Tier Review Workflow và Delegation | Chu trình `DRAFT`, `UNDER_REVIEW_STAFF`, `UNDER_REVIEW_MANAGER`, `PUBLISHED`. Chính sách phê duyệt linh hoạt: 1 cấp cho API Reference, 2 cấp cho tài liệu Kiến trúc hoặc Dự án. Hỗ trợ ủy quyền phê duyệt theo khoảng ngày; Audit Trail ghi nhận cả người ủy quyền và người duyệt thay. |
| 5 | Collections và Template Versioning | Quản lý bộ sưu tập tài liệu (`doc_collections`) theo phân hệ nghiệp vụ, gán chủ sở hữu chịu trách nhiệm. Quản lý mẫu tài liệu chuẩn (`doc_templates`) kèm lịch sử và khôi phục phiên bản (`document_template_versions`). |
| 6 | Hash-Chain Versioning và Audit Trail | Mỗi phiên bản (`document_versions`) lưu `hash` và `prev_hash` để chống giả mạo. Hỗ trợ Changelog, đối chiếu Diff và Rollback về bất kỳ phiên bản nào. |
| 7 | Trợ lý ZAZA AI | Chatbot nổi tích hợp từ Landing Page đến không gian làm việc: hỏi đáp kiến trúc, tra cứu tài liệu dựa trên RAG và hướng dẫn sử dụng hệ thống. |

#### Giao diện

- Trình soạn thảo Markdown 3 cột kiểu VS Code: Repo Explorer, Markdown và Live Preview song song, đối chiếu Template và AST.
- Nhập trực tiếp từ file Word (`.docx`).
- So sánh Side-by-Side Diff theo phong cách GitHub.
- Chế độ Sáng/Tối, thông báo thời gian thực qua Server-Sent Events (SSE).

### Kiến trúc hệ thống

LivingDocs gồm 3 phân hệ độc lập kết hợp cơ sở dữ liệu vector:

<div align="center">
  <a href="https://gitdiagram.com/lengocchau9/java_uth?utm_source=readme&utm_medium=picture">
    <img src="https://gitdiagram.com/lengocchau9/java_uth/diagram.png" alt="Sơ đồ kiến trúc LivingDocs" width="900" />
  </a>
</div>

- **Frontend** (Next.js, cổng 3000) giao tiếp với Backend qua REST và SSE, đồng thời gọi trực tiếp AI Engine cho chức năng chat và gợi ý viết lại.
- **Backend** (Spring Boot, cổng 8080) điều phối toàn bộ nghiệp vụ, xác thực, phân quyền, đồng bộ GitHub, lưu trữ dữ liệu vào PostgreSQL và gọi AI Engine để bóc tách AST, sinh tài liệu, phân tích Drift.
- **AI Engine** (FastAPI, cổng 8000) bóc tách AST, phân tích sai lệch và định tuyến yêu cầu AI giữa Google Gemini (Cloud) và Ollama (Local).
- **PostgreSQL 16 + pgvector** (cổng 5433) lưu dữ liệu nghiệp vụ và các đoạn tri thức phục vụ tìm kiếm ngữ nghĩa RAG.

#### Công nghệ sử dụng

<div align="center">

**Frontend**
<br/>
<img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />

**Backend**
<br/>
<img src="https://img.shields.io/badge/Java_17+-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java" />
<img src="https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot" />
<img src="https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=springsecurity&logoColor=white" alt="Spring Security" />
<img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
<img src="https://img.shields.io/badge/Hibernate-59666C?style=for-the-badge&logo=hibernate&logoColor=white" alt="Hibernate" />
<img src="https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Swagger" />
<img src="https://img.shields.io/badge/Maven-C71A36?style=for-the-badge&logo=apachemaven&logoColor=white" alt="Maven" />

**AI Engine**
<br/>
<img src="https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
<img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
<img src="https://img.shields.io/badge/Pydantic-E92063?style=for-the-badge&logo=pydantic&logoColor=white" alt="Pydantic" />
<img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Google Gemini" />
<img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama" />

**Database và Hạ tầng**
<br/>
<img src="https://img.shields.io/badge/PostgreSQL_16_+_pgvector-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL pgvector" />
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
<img src="https://img.shields.io/badge/GitHub_API-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />

</div>

| Phân hệ | Cổng | Công nghệ chính |
|---------|:----:|-----------------|
| `livingdocs-frontend` | 3000 | Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4, Lucide Icons, SSE |
| `livingdocs-backend` | 8080 | Java 17+, Spring Boot 3.3.4, Spring Security, JWT (HS256), GitHub OAuth2, Spring Data JPA, Hibernate 6.5, Springdoc OpenAPI 3 |
| `livingdocs-ai-engine` | 8000 | Python 3.10+, FastAPI, Uvicorn, Pydantic v2, `javalang`, `google-genai`, Ollama |
| Database | 5433 | PostgreSQL 16 + `pgvector` (`pgvector/pgvector:pg16`), bảng `knowledge_chunks` phục vụ RAG |

#### Hybrid AI Routing

| Chế độ | Nhà cung cấp | Đặc điểm |
|--------|--------------|----------|
| Cloud AI | Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`) | Xoay vòng nhiều API Key tự động qua `GeminiKeyManager` |
| Local AI | Ollama (`http://127.0.0.1:11434`, ví dụ `qwen2.5-coder:7b`) | Chạy hoàn toàn offline, mã nguồn nội bộ không rời khỏi máy |

### Phân quyền vai trò (RBAC)

| Vai trò | Trách nhiệm và quyền hạn chính |
|:--------|:-------------------------------|
| `DEVELOPER` | Kết nối GitHub Repo, làm việc trên Workspace và Editor 3 cột, sinh tài liệu AI từ cây mã nguồn hoặc danh sách tài liệu còn trống, xử lý Drift Alerts và gửi duyệt. |
| `STAFF` | Kiểm duyệt cấp 1: rà soát Review Queue, đối chiếu tài liệu AI với mã nguồn thực tế (AST Grounding), chỉnh sửa trực tiếp và chuyển lên Manager, hoặc xuất bản ngay với mẫu 1 cấp. |
| `MANAGER` | Kiểm duyệt cấp 2: phê duyệt cuối tại Trung tâm phê duyệt, quyết định xuất bản (`PUBLISHED`) và đẩy commit `.md` lên GitHub, cấu hình chính sách phê duyệt (1 hoặc 2 cấp) và ủy quyền phê duyệt. |
| `TECH_LEAD` | Quản trị bộ sưu tập tài liệu và chỉ định người sở hữu, quản lý Template cùng lịch sử phiên bản, theo dõi Dashboard chất lượng, đồ thị liên kết Code-Doc và Audit Trail. |
| `ADMIN` | Quản trị người dùng và phân quyền, cấu hình hệ thống (Cloud AI Key, Local Ollama Router, PR Merge Gate), xem Audit Trail hệ thống và giám sát sức khỏe toàn hệ thống. |

### Cấu trúc thư mục

```text
LivingDocs/
├── docker-compose.yml          # PostgreSQL 16 (pgvector) cổng 5433 và pgAdmin 4 cổng 5050
├── .env.example                # Mẫu cấu hình biến môi trường toàn cục
├── livingdocs-backend/         # Spring Boot 3.3.4 REST API (cổng 8080)
│   ├── src/main/java/.../
│   │   ├── domain/             # Entities và Business Models cốt lõi
│   │   ├── application/        # Services, Use Cases, DTOs và Ports
│   │   └── infrastructure/     # Controllers, JPA Repositories, Security, SSE, GitHub và AI Clients
│   └── src/main/resources/     # application.properties và schema.sql
├── livingdocs-ai-engine/       # FastAPI Microservice cho AST, Drift và LLM (cổng 8000)
│   ├── app/
│   │   ├── api/                # REST Endpoints (/v1/ast/extract, /v1/docs/generate, /v1/ai/rewrite-suggestion...)
│   │   ├── core/               # GeminiKeyManager và cấu hình môi trường
│   │   ├── schemas/            # Pydantic v2 Request/Response Schemas
│   │   └── services/           # AST Parser, Drift Analyzer, Gemini và Ollama Services
│   └── requirements.txt
└── livingdocs-frontend/        # Next.js 15 App Router Web UI (cổng 3000)
    ├── public/                 # Tài nguyên tĩnh (logo, ZAZA AI avatar, media)
    └── src/
        ├── app/                # Các trang theo vai trò (workspace, cay-ma-nguon, tai-lieu-cua-toi...)
        ├── components/         # AppShell, FloatingChatBot (ZAZA AI), MarkdownViewer, UI Components
        ├── hooks/              # Custom React Hooks (useSession...)
        └── services/           # API Clients giao tiếp với Backend và AI Engine
```

### Quick Start

#### Yêu cầu môi trường

| Công cụ | Phiên bản | Ghi chú |
|---------|-----------|---------|
| Docker và Docker Compose | Mới nhất | Chạy PostgreSQL 16 + `pgvector` |
| Java JDK | 17+ (hoặc 21) | Kèm Maven Wrapper (`./mvnw`) |
| Python và `pip` | 3.10+ | Cho AI Engine |
| Node.js và `npm` | 18+ hoặc 20+ | Cho Frontend |
| Ollama | Tùy chọn | Local AI: `ollama pull qwen2.5-coder:7b` |

#### Bước 0: Clone repository

```bash
git clone https://github.com/LeNgocChau9/Java_UTH.git
cd Java_UTH
```

#### Bước 1: Khởi chạy cơ sở dữ liệu

```bash
cp .env.example .env
docker compose up -d
```

- PostgreSQL: `localhost:5433` (Database: `livingdocs`, User: `LivingDocs`).
- pgAdmin 4 (tùy chọn): http://localhost:5050

#### Bước 2: Khởi chạy AI Engine (cổng 8000)

```bash
cd livingdocs-ai-engine
python -m venv venv
# Windows: venv\Scripts\activate | macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- Swagger của AI Engine: http://127.0.0.1:8000/docs

#### Bước 3: Khởi chạy Backend (cổng 8080)

```bash
cd livingdocs-backend
./mvnw spring-boot:run
```

- Swagger của Backend: http://localhost:8080/swagger-ui.html

#### Bước 4: Khởi chạy Frontend (cổng 3000)

```bash
cd livingdocs-frontend
npm install
npm run dev
```

- Truy cập ứng dụng: http://localhost:3000

#### Các dịch vụ sau khi khởi chạy

| Dịch vụ | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| Backend Swagger | http://localhost:8080/swagger-ui.html |
| AI Engine Docs | http://127.0.0.1:8000/docs |
| pgAdmin 4 | http://localhost:5050 |

### Biến môi trường

Sao chép `.env.example` thành `.env` rồi điền giá trị phù hợp. Không commit file `.env` lên Git.

| Biến | Mô tả | Ví dụ |
|------|-------|-------|
| `POSTGRES_DB` | Tên database | `livingdocs` |
| `POSTGRES_USER` | Tài khoản database | `LivingDocs` |
| `POSTGRES_PASSWORD` | Mật khẩu database | `your_password` |
| `GITHUB_CLIENT_ID` | Client ID của GitHub OAuth App | `Iv1.xxxxxxxx` |
| `GITHUB_CLIENT_SECRET` | Client Secret của GitHub OAuth App | `********` |
| `JWT_SECRET` | Khóa ký JWT (HS256), tối thiểu 32 ký tự | `change-me-to-a-long-random-string` |
| `GEMINI_API_KEYS` | Danh sách Gemini API Key, xoay vòng tự động | `key1,key2,key3` |
| `OLLAMA_BASE_URL` | Địa chỉ Ollama | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Model Ollama sử dụng | `qwen2.5-coder:7b` |

> Tên biến ở trên mang tính minh họa, hãy đối chiếu với `.env.example` thực tế của repository.

### Kiểm thử

```bash
# Backend (Spring Boot)
cd livingdocs-backend
./mvnw test

# Frontend (kiểm tra kiểu TypeScript)
cd livingdocs-frontend
npx tsc --noEmit

# AI Engine (FastAPI)
cd livingdocs-ai-engine
pytest
```

### Roadmap

- [x] Bóc tách AST đa ngôn ngữ (Java, TypeScript/TSX, Python, SQL)
- [x] Drift Detection và GitHub Checks Gate
- [x] Quy trình phê duyệt 2 cấp và ủy quyền
- [x] Hybrid AI (Gemini và Ollama) cùng RAG
- [ ] Bổ sung các hạng mục tiếp theo của nhóm

### Đóng góp

Mọi đóng góp đều được hoan nghênh.

1. Fork repository này.
2. Tạo nhánh tính năng: `git checkout -b feature/ten-tinh-nang`
3. Commit theo [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m "feat: them tinh nang X"`
4. Push lên nhánh: `git push origin feature/ten-tinh-nang`
5. Mở Pull Request và mô tả rõ thay đổi.

Trước khi gửi PR, hãy đảm bảo `./mvnw test`, `npx tsc --noEmit` và `pytest` đều chạy thành công. Báo lỗi hoặc đề xuất tính năng tại [Issues](https://github.com/LeNgocChau9/Java_UTH/issues).

### Nhóm phát triển

| Thành viên | Vai trò | GitHub |
|------------|---------|--------|
| Lê Ngọc Châu | Leader | [@LeNgocChau9](https://github.com/LeNgocChau9) |
| Trần Thị Thanh Thơ | Thành viên | [@thanhther](https://github.com/thanhther) |
| Nguyễn Thị Thanh Thảo | Thành viên | [@thaontt0302](https://github.com/thaontt0302) |
| N Jan Bruy | Thành viên | [@NJanBruy06](https://github.com/NJanBruy06) |
| Nguyễn Phúc Cảnh | Thành viên | [@nguyenphuccanh8533-cell](https://github.com/nguyenphuccanh8533-cell) |
