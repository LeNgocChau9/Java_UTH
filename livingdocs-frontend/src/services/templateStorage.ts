import type { DocumentTemplate, DocumentTemplateSection, TemplateVersionItem } from "@/types/template";

const STORAGE_KEY = "livingdocs.document-templates.v2";

export const SAMPLE_TEMPLATES: DocumentTemplate[] = [
  {
    id: "api-reference",
    name: "Tài liệu API Chuẩn",
    type: "Kỹ thuật",
    description: "Cấu trúc chuẩn để mô tả endpoint RESTful, phương thức xác thực JWT, mã lỗi và ví dụ request/response thực tế.",
    status: "PUBLISHED",
    publishedAt: "2026-10-15T09:30:00.000Z",
    currentVersion: 2,
    createdAt: "2026-09-24T08:30:00.000Z",
    documentCount: 18,
    sections: [
      {
        id: "sec-api-1",
        key: "overview",
        title: "1. Tổng quan API & Phạm vi",
        description: "Mục đích, phiên bản API (Semantic Versioning), Base URL và phạm vi đối tượng tích hợp.",
        required: true,
        contentPlaceholder: `### Base URL
\`\`\`text
https://api.livingdocs.io/v1
\`\`\`

### Chuẩn dữ liệu
- Giao thức: **HTTPS / RESTful**
- Định dạng dữ liệu: **application/json; charset=utf-8**
- Mã hóa: **UTF-8**

Tài liệu này định nghĩa chi tiết các thông số kỹ thuật, quy ước và hướng dẫn kết nối tích hợp hệ thống LivingDocs.`,
      },
      {
        id: "sec-api-2",
        key: "authentication",
        title: "2. Xác thực & Phân quyền (Authentication & Authorization)",
        description: "Cơ chế xác thực sử dụng JSON Web Token (Bearer JWT), header bắt buộc và mã lỗi xác thực 401/403.",
        required: true,
        contentPlaceholder: `Mọi yêu cầu đến API (ngoại trừ các endpoint công khai như \`/api/auth/login\`) đều bắt buộc đính kèm JWT token trong request header:

\`\`\`http
Authorization: Bearer <your_access_token>
Content-Type: application/json
\`\`\`

> **Lưu ý bảo mật:** Token có thời hạn 60 phút. Khi hết hạn, client cần gọi endpoint \`/api/auth/refresh\` để nhận token mới.`,
      },
      {
        id: "sec-api-3",
        key: "endpoints",
        title: "3. Danh mục Endpoints & Phương thức HTTP",
        description: "Bảng chi tiết các phương thức GET, POST, PUT, DELETE kèm tham số Path, Query và Request Body.",
        required: true,
        contentPlaceholder: `| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| \`GET\` | \`/api/documents\` | \`USER\`, \`ADMIN\` | Lấy danh sách tài liệu dự án kèm phân trang |
| \`GET\` | \`/api/documents/{id}\` | \`USER\`, \`ADMIN\` | Xem chi tiết nội dung tài liệu theo mã định danh |
| \`POST\` | \`/api/documents\` | \`TECH_LEAD\`, \`ADMIN\` | Tạo mới một tài liệu kỹ thuật |
| \`PUT\` | \`/api/documents/{id}\` | \`TECH_LEAD\`, \`ADMIN\` | Cập nhật phiên bản nội dung tài liệu |
| \`DELETE\` | \`/api/documents/{id}\` | \`ADMIN\` | Xóa hoặc đưa tài liệu vào lưu trữ |`,
      },
      {
        id: "sec-api-4",
        key: "error-codes",
        title: "4. Quy ước Mã lỗi & Rate Limiting",
        description: "Bảng mã phản hồi HTTP tiêu chuẩn và cấu trúc phản hồi lỗi dạng RFC 7807 (Problem Details).",
        required: false,
        contentPlaceholder: `Định dạng phản hồi lỗi tiêu chuẩn:
\`\`\`json
{
  "timestamp": "2026-11-14T08:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Trường 'title' là bắt buộc và không được để trống",
  "path": "/api/documents"
}
\`\`\`

- \`400 Bad Request\`: Tham số đầu vào không hợp lệ.
- \`401 Unauthorized\`: Thiếu token hoặc token đã hết hạn.
- \`403 Forbidden\`: Không đủ quyền hạn truy cập tài nguyên.
- \`404 Not Found\`: Tài nguyên không tồn tại.
- \`429 Too Many Requests\`: Vượt quá giới hạn (tối đa 100 req/phút).`,
      },
      {
        id: "sec-api-5",
        key: "examples",
        title: "5. Ví dụ Request / Response mẫu",
        description: "Kịch bản gọi mẫu curl và dữ liệu JSON phản hồi thành công 200 OK.",
        required: true,
        contentPlaceholder: `#### Request mẫu (cURL):
\`\`\`bash
curl -X GET "https://api.livingdocs.io/v1/api/documents/42" \\
  -H "Authorization: Bearer eyJhbGciOi..." \\
  -H "Accept: application/json"
\`\`\`

#### Response mẫu (200 OK):
\`\`\`json
{
  "id": 42,
  "title": "LivingDocs Architecture Overview",
  "status": "PUBLISHED",
  "version": 3,
  "updatedAt": "2026-11-14T10:30:00Z"
}
\`\`\``,
      },
    ],
    versionHistory: [
      {
        versionId: "v2-api-reference",
        versionNum: 2,
        createdAt: "2026-10-15T09:30:00.000Z",
        createdBy: "Lê Hoàng Long (Tech Lead)",
        changeNote: "Bổ sung chuẩn xác thực Bearer JWT, bảng mã lỗi RFC 7807 và ví dụ cURL hoàn chỉnh",
        sectionsCount: 5,
        isCurrent: true,
        sections: [
          {
            id: "sec-api-1",
            key: "overview",
            title: "1. Tổng quan API & Phạm vi",
            description: "Mục đích, phiên bản API (Semantic Versioning), Base URL và phạm vi đối tượng tích hợp.",
            required: true,
            contentPlaceholder: "Mục đích, phiên bản API và Base URL.",
          },
          {
            id: "sec-api-2",
            key: "authentication",
            title: "2. Xác thực & Phân quyền (Authentication & Authorization)",
            description: "Cơ chế xác thực sử dụng JSON Web Token (Bearer JWT), header bắt buộc và mã lỗi xác thực 401/403.",
            required: true,
            contentPlaceholder: "Bearer JWT trong header Authorization.",
          },
          {
            id: "sec-api-3",
            key: "endpoints",
            title: "3. Danh mục Endpoints & Phương thức HTTP",
            description: "Bảng chi tiết các phương thức GET, POST, PUT, DELETE kèm tham số Path, Query và Request Body.",
            required: true,
            contentPlaceholder: "Bảng endpoints và quyền hạn.",
          },
          {
            id: "sec-api-4",
            key: "error-codes",
            title: "4. Quy ước Mã lỗi & Rate Limiting",
            description: "Bảng mã phản hồi HTTP tiêu chuẩn và cấu trúc phản hồi lỗi dạng RFC 7807 (Problem Details).",
            required: false,
            contentPlaceholder: "Mã lỗi 400, 401, 403, 404, 429.",
          },
          {
            id: "sec-api-5",
            key: "examples",
            title: "5. Ví dụ Request / Response mẫu",
            description: "Kịch bản gọi mẫu curl và dữ liệu JSON phản hồi thành công 200 OK.",
            required: true,
            contentPlaceholder: "cURL và response json mẫu.",
          },
        ],
      },
      {
        versionId: "v1-api-reference",
        versionNum: 1,
        createdAt: "2026-09-24T08:30:00.000Z",
        createdBy: "Nguyễn Văn An (Architect)",
        changeNote: "Khởi tạo khung mẫu cấu trúc API Reference sơ bộ v1.0",
        sectionsCount: 3,
        isCurrent: false,
        sections: [
          {
            id: "sec-api-1-old",
            key: "overview",
            title: "1. Tổng quan API",
            description: "Mục đích, phạm vi và phiên bản ban đầu của API.",
            required: true,
            contentPlaceholder: "Tổng quan các API của hệ thống.",
          },
          {
            id: "sec-api-2-old",
            key: "endpoints",
            title: "2. Danh sách Endpoints",
            description: "Danh sách endpoint sơ khai và các tham số truy vấn cơ bản.",
            required: true,
            contentPlaceholder: "Danh sách API cơ bản.",
          },
          {
            id: "sec-api-3-old",
            key: "examples",
            title: "3. Ví dụ phản hồi",
            description: "Response JSON mẫu không kèm xác thực.",
            required: false,
            contentPlaceholder: "Ví dụ response trả về từ backend.",
          },
        ],
      },
    ],
  },
  {
    id: "architecture-decision",
    name: "Quyết định kiến trúc (ADR)",
    type: "Kiến trúc",
    description: "Ghi lại bối cảnh kỹ thuật, các phương án kiến trúc cân nhắc, quyết định lựa chọn và hệ quả lâu dài của hệ thống.",
    status: "PUBLISHED",
    publishedAt: "2026-10-02T14:20:00.000Z",
    currentVersion: 2,
    createdAt: "2026-09-18T03:15:00.000Z",
    documentCount: 7,
    sections: [
      {
        id: "sec-adr-1",
        key: "context",
        title: "1. Bối cảnh & Vấn đề Kỹ thuật (Context)",
        description: "Trình bày cụ thể bài toán kinh doanh, giới hạn kỹ thuật hiện tại và lý do cần đưa ra quyết định.",
        required: true,
        contentPlaceholder: `### Bối cảnh bài toán
Hệ thống hiện tại đang gặp hiện tượng trễ khi đồng bộ tài liệu từ các commit lớn của Git.

### Vấn đề cần giải quyết
1. Giảm thiểu tải CPU trên database chính.
2. Tách biệt luồng phân tích AST khỏi tiến trình HTTP chính của backend.`,
      },
      {
        id: "sec-adr-2",
        key: "options",
        title: "2. Các phương án Cân nhắc (Options Considered)",
        description: "So sánh chi tiết ít nhất 2 đến 3 kiến trúc khả thi, liệt kê ưu điểm và nhược điểm từng phương án.",
        required: true,
        contentPlaceholder: `#### Phương án A: Xử lý đồng bộ (Synchronous In-Memory)
- **Ưu điểm:** Đơn giản, không phụ thuộc hạ tầng ngoài.
- **Nhược điểm:** Dễ nghẽn thread pool, timeout khi commit có trên 50 files.

#### Phương án B: Message Queue bất đồng bộ (RabbitMQ / Kafka)
- **Ưu điểm:** Khả năng chịu tải cao, có retry policy tự động, mở rộng worker dễ dàng.
- **Nhược điểm:** Phức tạp hóa hạ tầng vận hành.`,
      },
      {
        id: "sec-adr-3",
        key: "decision",
        title: "3. Quyết định Kiến trúc & Lý do (Decision Outcome)",
        description: "Khẳng định phương án được lựa chọn chính thức và lập luận kỹ thuật chứng minh tính phù hợp.",
        required: true,
        contentPlaceholder: `**Lựa chọn:** Chúng tôi quyết định áp dụng **Phương án B (RabbitMQ Worker Pattern)**.

**Lý do lựa chọn:**
- Đảm bảo độ sẵn sàng 99.9% của API khi có hàng loạt webhook từ GitHub/GitLab.
- Tận dụng container worker có sẵn trong cụm Docker nội bộ của dự án.`,
      },
      {
        id: "sec-adr-4",
        key: "consequences",
        title: "4. Hệ quả & Rủi ro (Consequences & Trade-offs)",
        description: "Đánh giá các tác động tích cực, chi phí phát sinh, rủi ro tiềm ẩn và các biện pháp dự phòng.",
        required: true,
        contentPlaceholder: `### Tác động tích cực
- API response time giảm từ 2.4s xuống dưới 120ms.
- Phân tích mã nguồn không còn làm block các request tra cứu tài liệu.

### Biện pháp theo dõi
- Cài đặt Dead Letter Queue (DLQ) để cảnh báo khi tin nhắn phân tích thất bại quá 3 lần.`,
      },
    ],
    versionHistory: [
      {
        versionId: "v2-adr",
        versionNum: 2,
        createdAt: "2026-10-02T14:20:00.000Z",
        createdBy: "Phạm Minh Đức (Principal Architect)",
        changeNote: "Bổ sung tiêu chí đánh giá Dead Letter Queue và ma trận so sánh trade-off phương án B",
        sectionsCount: 4,
        isCurrent: true,
        sections: [
          {
            id: "sec-adr-1",
            key: "context",
            title: "1. Bối cảnh & Vấn đề Kỹ thuật (Context)",
            description: "Trình bày cụ thể bài toán kinh doanh và giới hạn kỹ thuật.",
            required: true,
          },
          {
            id: "sec-adr-2",
            key: "options",
            title: "2. Các phương án Cân nhắc (Options Considered)",
            description: "So sánh chi tiết ít nhất 2 đến 3 kiến trúc khả thi.",
            required: true,
          },
          {
            id: "sec-adr-3",
            key: "decision",
            title: "3. Quyết định Kiến trúc & Lý do (Decision Outcome)",
            description: "Khẳng định phương án được lựa chọn chính thức.",
            required: true,
          },
          {
            id: "sec-adr-4",
            key: "consequences",
            title: "4. Hệ quả & Rủi ro (Consequences & Trade-offs)",
            description: "Đánh giá các tác động tích cực và rủi ro tiềm ẩn.",
            required: true,
          },
        ],
      },
      {
        versionId: "v1-adr",
        versionNum: 1,
        createdAt: "2026-09-18T03:15:00.000Z",
        createdBy: "Phạm Minh Đức (Principal Architect)",
        changeNote: "Thiết lập cấu trúc ADR sơ khai v1.0",
        sectionsCount: 3,
        isCurrent: false,
        sections: [
          {
            id: "sec-adr-1-old",
            key: "context",
            title: "1. Bối cảnh",
            description: "Mô tả bài toán cần giải quyết.",
            required: true,
          },
          {
            id: "sec-adr-2-old",
            key: "decision",
            title: "2. Quyết định",
            description: "Phương án được chọn.",
            required: true,
          },
          {
            id: "sec-adr-3-old",
            key: "consequences",
            title: "3. Hệ quả",
            description: "Kết quả sau khi áp dụng.",
            required: false,
          },
        ],
      },
    ],
  },
  {
    id: "user-guide",
    name: "Hướng dẫn sử dụng",
    type: "Hướng dẫn",
    description: "Khung hướng dẫn từng bước (Step-by-step) thân thiện, có điều kiện tiên quyết, ảnh chụp màn hình minh họa và xử lý sự cố.",
    status: "DRAFT",
    currentVersion: 1,
    createdAt: "2026-09-11T10:00:00.000Z",
    documentCount: 12,
    sections: [
      {
        id: "sec-ug-1",
        key: "goals",
        title: "1. Mục tiêu & Đối tượng tiếp cận",
        description: "Kết quả người dùng sẽ đạt được và kiến thức nền tảng cần có.",
        required: true,
        contentPlaceholder: `Sau khi hoàn thành hướng dẫn này, người dùng sẽ:
- Nắm vững cách quản lý mẫu tài liệu và phân quyền xuất bản.
- Biết cách đối chiếu sai lệch mã nguồn và khôi phục phiên bản khi có sự cố.`,
      },
      {
        id: "sec-ug-2",
        key: "prerequisites",
        title: "2. Điều kiện Cần & Chuẩn bị Môi trường",
        description: "Tài khoản đăng nhập, quyền hạn cần cấp và công cụ cài đặt trước.",
        required: true,
        contentPlaceholder: `- Tài khoản đăng nhập phân quyền tối thiểu: \`TECH_LEAD\` hoặc \`DOC_MANAGER\`.
- Trình duyệt hiện đại: Chrome, Edge hoặc Firefox phiên bản mới nhất.`,
      },
      {
        id: "sec-ug-3",
        key: "steps",
        title: "3. Trình tự các Bước Thực hiện Chi tiết",
        description: "Quy trình tuần tự từ bước 1 đến bước n kèm thao tác cụ thể.",
        required: true,
        contentPlaceholder: `1. **Bước 1:** Truy cập menu **"Quản lý Mẫu tài liệu"** trên thanh điều hướng.
2. **Bước 2:** Chọn mẫu tài liệu mong muốn hoặc bấm **"Tạo mẫu mới"**.
3. **Bước 3:** Sử dụng tab **"Xem trước trực quan"** để kiểm tra bố cục trước khi xuất bản.
4. **Bước 4:** Bấm nút **"Xuất bản vào thư viện dùng chung"**.`,
      },
      {
        id: "sec-ug-4",
        key: "troubleshooting",
        title: "4. Xử lý Sự cố & Câu hỏi Thường gặp (FAQ)",
        description: "Danh sách mã lỗi thường gặp, nguyên nhân và biện pháp khắc phục nhanh.",
        required: false,
        contentPlaceholder: `#### Lỗi không thể xuất bản mẫu:
- **Nguyên nhân:** Thiếu ít nhất một đề mục bắt buộc.
- **Khắc phục:** Kiểm tra lại các đề mục có đánh dấu *Bắt buộc* và điền nội dung mẫu phù hợp.`,
      },
    ],
    versionHistory: [
      {
        versionId: "v1-ug",
        versionNum: 1,
        createdAt: "2026-09-11T10:00:00.000Z",
        createdBy: "Trần Thị Mai (Technical Writer)",
        changeNote: "Khởi tạo bản nháp đầu tiên cho hướng dẫn người dùng",
        sectionsCount: 4,
        isCurrent: true,
        sections: [
          {
            id: "sec-ug-1",
            key: "goals",
            title: "1. Mục tiêu & Đối tượng tiếp cận",
            description: "Kết quả người dùng sẽ đạt được.",
            required: true,
          },
          {
            id: "sec-ug-2",
            key: "prerequisites",
            title: "2. Điều kiện Cần & Chuẩn bị Môi trường",
            description: "Tài khoản đăng nhập và công cụ.",
            required: true,
          },
          {
            id: "sec-ug-3",
            key: "steps",
            title: "3. Trình tự các Bước Thực hiện Chi tiết",
            description: "Quy trình tuần tự từng bước.",
            required: true,
          },
          {
            id: "sec-ug-4",
            key: "troubleshooting",
            title: "4. Xử lý Sự cố & Câu hỏi Thường gặp (FAQ)",
            description: "Khắc phục các lỗi thông dụng.",
            required: false,
          },
        ],
      },
    ],
  },
];

function sanitizeTemplate(template: DocumentTemplate): DocumentTemplate {
  const currentVersion = template.currentVersion ?? 1;
  const status = template.status ?? "PUBLISHED";
  const sections = Array.isArray(template.sections) ? template.sections : [];

  let versionHistory = template.versionHistory;
  if (!Array.isArray(versionHistory) || versionHistory.length === 0) {
    versionHistory = [
      {
        versionId: `v${currentVersion}-${template.id}`,
        versionNum: currentVersion,
        createdAt: template.createdAt,
        createdBy: "Quản trị viên",
        changeNote: "Khởi tạo phiên bản ban đầu",
        sectionsCount: sections.length,
        sections: JSON.parse(JSON.stringify(sections)),
        isCurrent: true,
      },
    ];
  } else {
    // Đảm bảo cờ isCurrent chính xác theo currentVersion
    versionHistory = versionHistory.map((item) => ({
      ...item,
      isCurrent: item.versionNum === currentVersion,
    }));
  }

  return {
    ...template,
    currentVersion,
    status,
    sections,
    versionHistory,
  };
}

export function loadTemplates(): DocumentTemplate[] {
  if (typeof window === "undefined") {
    return SAMPLE_TEMPLATES;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      saveTemplates(SAMPLE_TEMPLATES);
      return SAMPLE_TEMPLATES;
    }

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      saveTemplates(SAMPLE_TEMPLATES);
      return SAMPLE_TEMPLATES;
    }

    return parsed.map((item) => sanitizeTemplate(item as DocumentTemplate));
  } catch (err) {
    console.error("Lỗi khi đọc template từ localStorage:", err);
    return SAMPLE_TEMPLATES;
  }
}

export function saveTemplates(templates: DocumentTemplate[]): void {
  if (typeof window === "undefined") {
    return;
  }
  const clean = templates.map(sanitizeTemplate);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
}

export function getTemplateById(id: string): DocumentTemplate | null {
  const all = loadTemplates();
  return all.find((item) => item.id === id) ?? null;
}

export function updateTemplate(updated: DocumentTemplate): DocumentTemplate {
  const all = loadTemplates();
  const index = all.findIndex((item) => item.id === updated.id);
  const sanitized = sanitizeTemplate(updated);

  if (index >= 0) {
    all[index] = sanitized;
  } else {
    all.push(sanitized);
  }

  saveTemplates(all);
  return sanitized;
}

export function publishTemplate(templateId: string): { success: boolean; template: DocumentTemplate } {
  const all = loadTemplates();
  const target = all.find((item) => item.id === templateId);
  if (!target) {
    throw new Error("Không tìm thấy mẫu tài liệu id=" + templateId);
  }

  target.status = "PUBLISHED";
  target.publishedAt = new Date().toISOString();

  // Tạo hoặc cập nhật mốc phiên bản xuất bản vào lịch sử
  const newVersionNum = (target.currentVersion || 1) + 1;
  const historyItem: TemplateVersionItem = {
    versionId: `v${newVersionNum}-${target.id}-${Date.now()}`,
    versionNum: newVersionNum,
    createdAt: target.publishedAt,
    createdBy: "Ban Quản trị LivingDocs",
    changeNote: "Xuất bản chính thức mẫu tài liệu vào thư viện dùng chung",
    sectionsCount: target.sections.length,
    sections: JSON.parse(JSON.stringify(target.sections)),
    isCurrent: true,
  };

  const currentHistory = target.versionHistory || [];
  target.versionHistory = [
    historyItem,
    ...currentHistory.map((item) => ({ ...item, isCurrent: false })),
  ];
  target.currentVersion = newVersionNum;

  saveTemplates(all);
  return { success: true, template: target };
}

export function rollbackTemplateVersion(
  templateId: string,
  targetVersionNum: number
): { success: boolean; newVersionNum: number; template: DocumentTemplate; message: string } {
  const all = loadTemplates();
  const target = all.find((item) => item.id === templateId);
  if (!target) {
    throw new Error("Không tìm thấy mẫu tài liệu id=" + templateId);
  }

  const history = target.versionHistory || [];
  const targetVersionRecord = history.find((v) => v.versionNum === targetVersionNum);
  if (!targetVersionRecord) {
    throw new Error(`Không tìm thấy phiên bản v${targetVersionNum} trong lịch sử của mẫu này.`);
  }

  // Khôi phục cấu trúc sections từ phiên bản mục tiêu
  const restoredSections: DocumentTemplateSection[] = JSON.parse(
    JSON.stringify(targetVersionRecord.sections)
  );

  const newVersionNum = (target.currentVersion || 1) + 1;
  const nowIso = new Date().toISOString();

  const newHistoryRecord: TemplateVersionItem = {
    versionId: `v${newVersionNum}-${target.id}-${Date.now()}`,
    versionNum: newVersionNum,
    createdAt: nowIso,
    createdBy: "Người dùng (Khôi phục)",
    changeNote: `Khôi phục cấu trúc và nội dung mẫu từ Phiên bản v${targetVersionNum}.0`,
    sectionsCount: restoredSections.length,
    sections: restoredSections,
    isCurrent: true,
  };

  target.sections = restoredSections;
  target.currentVersion = newVersionNum;
  target.versionHistory = [
    newHistoryRecord,
    ...history.map((v) => ({ ...v, isCurrent: false })),
  ];

  saveTemplates(all);
  return {
    success: true,
    newVersionNum,
    template: target,
    message: `Khôi phục thành công về cấu trúc phiên bản v${targetVersionNum}.0. Hệ thống đã tạo phiên bản v${newVersionNum}.0 làm phiên bản hiện tại!`,
  };
}
