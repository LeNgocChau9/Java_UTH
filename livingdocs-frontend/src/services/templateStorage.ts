import type { DocumentTemplate } from "@/types/template";

const STORAGE_KEY = "livingdocs.document-templates.v1";

const SAMPLE_TEMPLATES: DocumentTemplate[] = [
  {
    id: "api-reference",
    name: "Tài liệu API",
    type: "Kỹ thuật",
    description: "Cấu trúc chuẩn để mô tả endpoint, xác thực và ví dụ request/response.",
    createdAt: "2026-09-24T08:30:00.000Z",
    documentCount: 18,
    sections: [
      { title: "Tổng quan", description: "Mục đích, phạm vi và phiên bản của API." },
      { title: "Xác thực", description: "Cách cấp và sử dụng thông tin xác thực." },
      { title: "Endpoints", description: "Danh sách endpoint, tham số và kiểu dữ liệu trả về." },
      { title: "Ví dụ", description: "Request và response mẫu cho các trường hợp phổ biến." },
    ],
  },
  {
    id: "architecture-decision",
    name: "Quyết định kiến trúc",
    type: "Kiến trúc",
    description: "Ghi lại bối cảnh, phương án và hệ quả của một quyết định kỹ thuật.",
    createdAt: "2026-09-18T03:15:00.000Z",
    documentCount: 7,
    sections: [
      { title: "Bối cảnh", description: "Vấn đề hoặc yêu cầu dẫn đến quyết định." },
      { title: "Các phương án", description: "Những hướng tiếp cận đã được cân nhắc." },
      { title: "Quyết định", description: "Phương án được lựa chọn và lý do." },
      { title: "Hệ quả", description: "Tác động tích cực, hạn chế và việc cần theo dõi." },
    ],
  },
  {
    id: "user-guide",
    name: "Hướng dẫn sử dụng",
    type: "Hướng dẫn",
    description: "Hướng dẫn theo từng bước, giúp người đọc hoàn thành một quy trình.",
    createdAt: "2026-09-11T10:00:00.000Z",
    documentCount: 12,
    sections: [
      { title: "Mục tiêu", description: "Kết quả người dùng sẽ đạt được sau khi làm theo." },
      { title: "Điều kiện cần", description: "Quyền truy cập, công cụ và dữ liệu cần chuẩn bị." },
      { title: "Các bước thực hiện", description: "Trình tự thao tác cùng kết quả mong đợi." },
      { title: "Xử lý sự cố", description: "Cách kiểm tra và khắc phục những lỗi thường gặp." },
    ],
  },
];

function isDocumentTemplate(value: unknown): value is DocumentTemplate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const template = value as Record<string, unknown>;
  return typeof template.id === "string"
    && typeof template.name === "string"
    && typeof template.type === "string"
    && typeof template.description === "string"
    && typeof template.createdAt === "string"
    && typeof template.documentCount === "number"
    && Array.isArray(template.sections)
    && template.sections.every((section) => (
      typeof section === "object"
      && section !== null
      && typeof (section as Record<string, unknown>).title === "string"
      && typeof (section as Record<string, unknown>).description === "string"
    ));
}

export function loadTemplates(): DocumentTemplate[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    saveTemplates(SAMPLE_TEMPLATES);
    return SAMPLE_TEMPLATES;
  }

  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isDocumentTemplate)) {
    throw new Error("Dữ liệu template trong trình duyệt không hợp lệ.");
  }

  return parsed;
}

export function saveTemplates(templates: DocumentTemplate[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}
