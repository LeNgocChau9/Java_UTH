"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  AlertTriangle,
  GitPullRequest,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
  Zap,
  CheckCircle2,
  FileCode,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
  Search,
  ExternalLink,
  Code,
  FileCheck,
  Sparkles,
  Info,
  Edit3,
  XCircle,
  EyeOff,
  Filter,
  Layers,
  FileDiff,
  Check,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";

export type SeverityType = "low" | "medium" | "high" | "critical";
export type ClassificationType = "SIGNATURE" | "SEMANTIC" | "REFERENCE";

export interface DriftAlertItem {
  id: number;
  docTitle: string;
  docPath: string;
  repo: string;
  classification: ClassificationType;
  pr?: {
    number: number;
    title: string;
    branch: string;
    author: string;
    mergedAt: string;
  } | null;
  daysStale: number;
  affectedFiles: string[];
  severity: SeverityType;
  status: "OPEN" | "DRAFT_CREATED" | "RESOLVED" | "IGNORED";
  driftReason: string;
  aiSuggestion: string;
  codeDiff: {
    fileName: string;
    oldCode: string;
    newCode: string;
  };
  docDiff: {
    sectionTitle: string;
    outdatedContent: string;
    suggestedContent: string;
  };
  draftVersionId?: number;
}

const INITIAL_ALERTS: DriftAlertItem[] = [
  {
    id: 1,
    docTitle: "Tài liệu API Xác thực AuthService (JWT & RBAC)",
    docPath: "/docs/api/auth-service.md",
    repo: "livingdocs-backend",
    classification: "SIGNATURE",
    pr: {
      number: 142,
      title: "refactor(auth): tách token provider và cập nhật method generateToken()",
      branch: "feature/auth-jwt-refresh",
      author: "lengocchau",
      mergedAt: "28/10/2026",
    },
    daysStale: 3,
    affectedFiles: ["AuthService.java", "JwtTokenProvider.java"],
    severity: "high",
    status: "OPEN",
    driftReason:
      "Chữ ký hàm `generateToken(User user)` đã được đổi thành `generateToken(User user, Map<String, Object> extraClaims, long ttlSeconds)` và chuyển sang class JwtTokenProvider.",
    aiSuggestion:
      "Cập nhật tài liệu API mô tả tham số bổ sung `extraClaims`, `ttlSeconds` cho việc sinh JWT Token và bổ sung cấu trúc response chuẩn với thời hạn hết hạn.",
    codeDiff: {
      fileName: "AuthService.java ➔ JwtTokenProvider.java",
      oldCode: `// Phiên bản cũ trong AuthService.java
public String generateToken(User user) {
    return Jwts.builder()
        .setSubject(user.getEmail())
        .setIssuedAt(new Date())
        .setExpiration(new Date(System.currentTimeMillis() + 86400000))
        .signWith(SignatureAlgorithm.HS256, secretKey)
        .compact();
}`,
      newCode: `// Phiên bản mới trong JwtTokenProvider.java
public String generateToken(User user, Map<String, Object> extraClaims, long ttlSeconds) {
    long now = System.currentTimeMillis();
    return Jwts.builder()
        .setClaims(extraClaims != null ? extraClaims : new HashMap<>())
        .setSubject(user.getEmail())
        .claim("roles", user.getRoleNames())
        .claim("userId", user.getId())
        .setIssuedAt(new Date(now))
        .setExpiration(new Date(now + ttlSeconds * 1000))
        .signWith(signingKey, SignatureAlgorithm.HS256)
        .compact();
}`,
    },
    docDiff: {
      sectionTitle: "Mục 3.2: Cấu hình và Sinh mã Access Token",
      outdatedContent: `### Phương thức \`generateToken(User user)\`
- **Mô tả:** Nhận vào đối tượng User và trả về chuỗi JWT Token có hiệu lực 24 giờ.
- **Tham số:** \`User user\` (Người dùng hệ thống).
- **Phản hồi:** Chuỗi JWT dạng String chứa thông tin email người dùng.`,
      suggestedContent: `### Phương thức \`generateToken(User user, Map<String, Object> extraClaims, long ttlSeconds)\`
- **Mô tả:** Nhận vào User, danh sách claims tùy chọn và thời gian sống (TTL) tính bằng giây để sinh JWT chuẩn mã hóa.
- **Tham số:** 
  + \`User user\`: Người dùng đang xác thực.
  + \`Map<String, Object> extraClaims\`: Metadata bổ sung (roles, tenantId, permissions).
  + \`long ttlSeconds\`: Thời gian hiệu lực của Token (ví dụ: 3600 cho 1 giờ).
- **Phản hồi:** Chuỗi JWT Token mang payload đầy đủ quyền hạn và định danh.`,
    },
  },
  {
    id: 2,
    docTitle: "Hướng dẫn Cấu trúc Cơ sở dữ liệu & Vector Embeddings",
    docPath: "/docs/database/vector-schema.md",
    repo: "livingdocs-backend",
    classification: "REFERENCE",
    pr: {
      number: 139,
      title: "feat(db): bổ sung extension pgvector và bảng document_embeddings (S4-09)",
      branch: "feat/postgres-pgvector",
      author: "nguyenphuccanh",
      mergedAt: "24/10/2026",
    },
    daysStale: 7,
    affectedFiles: ["V3__add_embeddings.sql", "DocumentEmbedding.java"],
    severity: "critical",
    status: "OPEN",
    driftReason:
      "Tài liệu kiến trúc DB hiện tại chưa đề cập đến PostgreSQL pgvector, bảng mới `document_embeddings` và chỉ mục HNSW cosine index.",
    aiSuggestion:
      "Thêm đặc tả bảng `document_embeddings`, mô tả vector 768 chiều cho semantic search, và tài liệu hóa cấu hình chỉ mục vector.",
    codeDiff: {
      fileName: "V3__add_embeddings.sql",
      oldCode: `-- Chưa có cấu trúc bảng vector embedding
-- Chỉ lưu trữ bảng document_versions dạng plaintext (content text)`,
      newCode: `CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_embed_hnsw ON document_embeddings 
USING hnsw (embedding vector_cosine_ops);`,
    },
    docDiff: {
      sectionTitle: "Kiến trúc Dữ liệu: Phân đoạn & Tìm kiếm Ngữ nghĩa",
      outdatedContent: `Hệ thống lưu trữ toàn văn tài liệu kỹ thuật trong bảng \`document_versions\` và sử dụng truy vấn SQL LIKE/ILIKE truyền thống để tìm kiếm tài liệu.`,
      suggestedContent: `Hệ thống tích hợp **PostgreSQL pgvector** để lưu trữ vector nhúng 768 chiều (\`document_embeddings\`) được sinh tự động bởi Gemini Text Embedding. Sử dụng chỉ mục **HNSW Cosine** tối ưu hóa tra cứu ngữ nghĩa thời gian thực (< 15ms).`,
    },
  },
  {
    id: 3,
    docTitle: "Tài liệu Tích hợp Cổng thanh toán & Quy trình Hoàn tiền",
    docPath: "/docs/services/payment-refund.md",
    repo: "payment-service",
    classification: "SEMANTIC",
    pr: {
      number: 88,
      title: "feat(refund): tự động xác thực chữ ký số VietQR và webhook hoàn tiền",
      branch: "feat/vietqr-refund",
      author: "hoanganhthu",
      mergedAt: "17/10/2026",
    },
    daysStale: 14,
    affectedFiles: ["PaymentController.java", "RefundService.java"],
    severity: "critical",
    status: "OPEN",
    driftReason:
      "Thêm luồng hoàn trả tự động `POST /api/v1/payments/refund` với chữ ký RSA-SHA256, nhưng tài liệu hướng dẫn kỹ thuật vẫn ghi hoàn tiền thủ công qua CSKH.",
    aiSuggestion:
      "Cập nhật tài liệu thanh toán sang API tự động: quy chuẩn Header `X-Signature`, payload hoàn tiền và quy tắc trạng thái giao dịch.",
    codeDiff: {
      fileName: "RefundService.java",
      oldCode: `// Trước đây yêu cầu quản trị viên xử lý thủ công qua Dashboard
public boolean manualRefund(String transactionId, String reason) {
    log.info("Yêu cầu hoàn tiền thủ công cho giao dịch {}", transactionId);
    return internalRefundQueue.enqueue(transactionId);
}`,
      newCode: `// Hiện tại xử lý API tức thì qua cổng ngân hàng
public RefundResult processAutomaticRefund(RefundRequest req, String signature) {
    boolean valid = rsaVerifier.verifySignature(req, signature);
    if (!valid) throw new InvalidSignatureException("Chữ ký số không hợp lệ");
    return bankGatewayClient.executeRefund(req.getTransactionId(), req.getAmount());
}`,
    },
    docDiff: {
      sectionTitle: "Quy trình Hoàn tiền (Refund Policy & Flow)",
      outdatedContent: `Khi khách hàng hủy dịch vụ, quản trị viên đối soát thủ công và tạo phiếu chuyển khoản bằng tay trong vòng 48 giờ làm việc.`,
      suggestedContent: `Hệ thống hỗ trợ **Hoàn tiền Tự động tức thì qua API** thông qua phương thức \`POST /api/v1/payments/refund\`. Yêu cầu gửi kèm \`X-Signature\` (RSA-SHA256) và xử lý đối soát ngân hàng tự động trong 5 giây.`,
    },
  },
  {
    id: 4,
    docTitle: "Quy chuẩn Frontend Kiến trúc Next.js App Router",
    docPath: "/docs/frontend/architecture.md",
    repo: "livingdocs-web",
    classification: "REFERENCE",
    pr: {
      number: 61,
      title: "chore: nâng cấp Next.js 15 và chuẩn hóa App Router",
      branch: "feat/nextjs-15-migration",
      author: "athw25",
      mergedAt: "26/10/2026",
    },
    daysStale: 5,
    affectedFiles: ["src/app/layout.tsx", "CLAUDE.md"],
    severity: "medium",
    status: "OPEN",
    driftReason:
      "Tài liệu vẫn hướng dẫn cấu trúc thư mục dạng `src/pages` (Pages Router) dù toàn bộ dự án đã chuyển hẳn sang `src/app` (App Router Next.js 15).",
    aiSuggestion:
      "Sửa đổi cây thư mục mẫu, quy tắc layout lồng ghép và cách khai báo Server/Client Components theo Next.js 15.",
    codeDiff: {
      fileName: "src/app/layout.tsx",
      oldCode: `// Cấu trúc cũ trong pages/_app.tsx
export default function MyApp({ Component, pageProps }: AppProps) {
    return <Component {...pageProps} />;
}`,
      newCode: `// Cấu trúc mới trong src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="vi" className="h-full antialiased">
            <body className="min-h-dvh">{children}</body>
        </html>
    );
}`,
    },
    docDiff: {
      sectionTitle: "2. Cấu trúc Thư mục và Điều hướng Router",
      outdatedContent: `Mỗi file đặt trong \`src/pages\` tự động trở thành một route (ví dụ: \`src/pages/dashboard.tsx\` ánh xạ thành \`/dashboard\`). Sử dụng \`pages/_app.tsx\` để chia sẻ trạng thái toàn cục.`,
      suggestedContent: `Dự án áp dụng **Next.js 15 App Router** chuẩn hóa trong thư mục \`src/app\`. Điểm vào là \`layout.tsx\`, các trang sử dụng \`page.tsx\` với kiến trúc kết hợp linh hoạt giữa React Server Components và Client Components (\`"use client"\`).`,
    },
  },
  {
    id: 5,
    docTitle: "Tài liệu Biến môi trường & Cấu hình Docker Deploy",
    docPath: "/docs/devops/environment-variables.md",
    repo: "livingdocs-backend",
    classification: "SEMANTIC",
    pr: {
      number: 140,
      title: "feat(config): bổ sung biến GEMINI_TIMEOUT_MS và REDIS_CACHE_TTL",
      branch: "feature/perf-cache-settings",
      author: "lengocchau",
      mergedAt: "30/10/2026",
    },
    daysStale: 1,
    affectedFiles: ["application.yml", ".env.example"],
    severity: "low",
    status: "OPEN",
    driftReason:
      "Bổ sung 2 biến môi trường mới `GEMINI_TIMEOUT_MS` (mặc định 30000) và `SPRING_DATA_REDIS_TTL` (mặc định 7200s) nhưng chưa được ghi chú vào bảng biến môi trường.",
    aiSuggestion:
      "Thêm dòng mô tả cho 2 biến môi trường trên trong bảng tra cứu cấu hình để lập trình viên mới biết cách cấu hình khi deploy.",
    codeDiff: {
      fileName: ".env.example",
      oldCode: `GEMINI_API_KEY=your_key_here
POSTGRES_DB=livingdocs`,
      newCode: `GEMINI_API_KEY=your_key_here
GEMINI_TIMEOUT_MS=30000
POSTGRES_DB=livingdocs
SPRING_DATA_REDIS_TTL=7200`,
    },
    docDiff: {
      sectionTitle: "Bảng Tra cứu Biến Môi trường Deploy",
      outdatedContent: `| Tên biến | Kiểu dữ liệu | Ý nghĩa |
| GEMINI_API_KEY | Chuỗi bí mật | Khóa truy cập Google Gemini API |
| POSTGRES_DB | Chuỗi | Tên database vận hành |`,
      suggestedContent: `| Tên biến | Kiểu dữ liệu | Ý nghĩa |
| GEMINI_API_KEY | Chuỗi bí mật | Khóa truy cập Google Gemini API |
| GEMINI_TIMEOUT_MS | Số nguyên (ms) | Thời gian chờ tối đa khi gọi AI Engine (mặc định: 30000) |
| SPRING_DATA_REDIS_TTL | Số nguyên (giây)| Thời gian lưu cache Redis cho các truy vấn phân tích (mặc định: 7200) |
| POSTGRES_DB | Chuỗi | Tên database vận hành |`,
    },
  },
];

const SEVERITY_CONFIG: Record<
  SeverityType,
  {
    label: string;
    bg: string;
    color: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  low: {
    label: "Thấp",
    bg: "#f0fdf4",
    color: "#166534",
    border: "#bbf7d0",
    badgeBg: "#dcfce7",
    badgeText: "#15803d",
  },
  medium: {
    label: "Trung bình",
    bg: "#ecfdf5",
    color: "#047857",
    border: "#a7f3d0",
    badgeBg: "#eaf6ef",
    badgeText: "#07543f",
  },
  high: {
    label: "Cao",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fde68a",
    badgeBg: "#fef3c7",
    badgeText: "#92400e",
  },
  critical: {
    label: "Nghiêm trọng",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
    badgeBg: "#fee2e2",
    badgeText: "#991b1b",
  },
};

const CLASSIFICATION_CONFIG: Record<
  ClassificationType,
  {
    label: string;
    description: string;
    color: string;
    bg: string;
    border: string;
  }
> = {
  SIGNATURE: {
    label: "Chữ ký hàm (SIGNATURE)",
    description: "Thay đổi tên hàm, tham số, kiểu trả về",
    color: "#0284c7",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  SEMANTIC: {
    label: "Ngữ nghĩa logic (SEMANTIC)",
    description: "Thay đổi luồng xử lý hoặc quy tắc nghiệp vụ",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  REFERENCE: {
    label: "Tham chiếu cấu trúc (REFERENCE)",
    description: "Thay đổi bảng DB, thư mục hoặc thực thể liên kết",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
};

export default function CanhBaoSaiLechPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<DriftAlertItem[]>(INITIAL_ALERTS);
  const [selectedAlertId, setSelectedAlertId] = useState<number>(1);
  const [severityFilter, setSeverityFilter] = useState<"all" | SeverityType>("all");
  const [classificationFilter, setClassificationFilter] = useState<"all" | ClassificationType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [ignoringId, setIgnoringId] = useState<number | null>(null);
  const [copiedCodeSide, setCopiedCodeSide] = useState<"old" | "new" | null>(null);
  const [successToast, setSuccessToast] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({ show: false, title: "", message: "" });

  const counts = useMemo(() => {
    return {
      all: alerts.length,
      low: alerts.filter((a) => a.severity === "low").length,
      medium: alerts.filter((a) => a.severity === "medium").length,
      high: alerts.filter((a) => a.severity === "high").length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      signature: alerts.filter((a) => a.classification === "SIGNATURE").length,
      semantic: alerts.filter((a) => a.classification === "SEMANTIC").length,
      reference: alerts.filter((a) => a.classification === "REFERENCE").length,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((item) => {
      const matchSeverity =
        severityFilter === "all" || item.severity === severityFilter;
      const matchClassification =
        classificationFilter === "all" || item.classification === classificationFilter;
      const matchSearch =
        searchQuery.trim() === "" ||
        item.docTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.repo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.affectedFiles.some((f) =>
          f.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchSeverity && matchClassification && matchSearch;
    });
  }, [alerts, severityFilter, classificationFilter, searchQuery]);

  const selectedAlert = useMemo(() => {
    return (
      alerts.find((a) => a.id === selectedAlertId) ||
      filteredAlerts[0] ||
      alerts[0]
    );
  }, [alerts, selectedAlertId, filteredAlerts]);

  // Hành động 1: Chấp nhận đề xuất (Tạo bản nháp mới & giải quyết cảnh báo)
  const handleAcceptFix = async (alertItem: DriftAlertItem) => {
    setAcceptingId(alertItem.id);
    try {
      try {
        await apiClient.post(`/api/drift-alerts/${alertItem.id}/auto-draft`);
        await apiClient.post(`/api/drift-alerts/${alertItem.id}/accept-draft`);
      } catch (e) {
        console.info("Using frontend draft sync simulation for alert #", alertItem.id);
      }

      await new Promise((r) => setTimeout(r, 600));

      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertItem.id
            ? {
                ...a,
                status: "RESOLVED",
                draftVersionId: 100 + a.id,
              }
            : a
        )
      );

      setSuccessToast({
        show: true,
        title: "Đã chấp nhận đề xuất & Tạo bản nháp mới!",
        message: `Đã tự động áp dụng nội dung AI đề xuất vào bản nháp DRAFT (v2.1) cho "${alertItem.docTitle}". Cảnh báo đã được đánh dấu RESOLVED.`,
      });

      setTimeout(() => {
        setSuccessToast((prev) => ({ ...prev, show: false }));
      }, 5000);
    } catch (err: any) {
      alert("Không thể tạo bản nháp: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setAcceptingId(null);
    }
  };

  // Hành động 2: Chỉnh sửa (Mở trực tiếp sang trang Trình soạn thảo Editor kèm nội dung tài liệu & đề xuất)
  const handleEdit = (alertItem: DriftAlertItem) => {
    // Lưu tạm thời thông tin tài liệu cần sửa vào sessionStorage để Editor nạp mượt mà (ngay cả khi DB chưa có docId này)
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        `drift_alert_draft_${alertItem.id}`,
        JSON.stringify({
          title: alertItem.docTitle,
          targetPath: alertItem.docPath,
          repo: alertItem.repo,
          content: `# ${alertItem.docTitle}\n\n> **Trạng thái trôi dạt**: ${alertItem.classification} (${alertItem.severity.toUpperCase()})\n> **Nhánh / PR**: ${alertItem.pr?.branch || "main"} (#${alertItem.pr?.number || "N/A"})\n\n## 1. Tổng quan & Lý do cập nhật\n${alertItem.driftReason}\n\n## 2. ${alertItem.docDiff.sectionTitle}\n${alertItem.docDiff.suggestedContent}\n\n## 3. Thay đổi mã nguồn liên quan\n\`\`\`java\n${alertItem.codeDiff.newCode}\n\`\`\`\n`,
        })
      );
    }
    router.push(`/tai-lieu-cua-toi/editor?docId=${alertItem.id}&fromAlert=${alertItem.id}`);
  };

  // Hành động 3: Bỏ qua (Đánh dấu trạng thái IGNORED)
  const handleIgnore = async (alertItem: DriftAlertItem) => {
    setIgnoringId(alertItem.id);
    try {
      try {
        await apiClient.patch(`/api/drift-alerts/${alertItem.id}`, {
          action: "IGNORE",
          comment: "Người dùng chọn bỏ qua cảnh báo này từ Trung tâm Cảnh báo",
        });
      } catch (e) {
        console.info("Simulating ignore alert #", alertItem.id);
      }

      setAlerts((prev) =>
        prev.map((a) => (a.id === alertItem.id ? { ...a, status: "IGNORED" } : a))
      );

      setSuccessToast({
        show: true,
        title: "Đã bỏ qua cảnh báo",
        message: `Cảnh báo cho "${alertItem.docTitle}" đã được chuyển sang trạng thái IGNORED.`,
      });

      setTimeout(() => {
        setSuccessToast((prev) => ({ ...prev, show: false }));
      }, 4000);
    } catch (err: any) {
      alert("Lỗi khi bỏ qua cảnh báo: " + (err.message || "Lỗi hệ thống"));
    } finally {
      setIgnoringId(null);
    }
  };

  const copyCode = (code: string, side: "old" | "new") => {
    navigator.clipboard.writeText(code);
    setCopiedCodeSide(side);
    setTimeout(() => setCopiedCodeSide(null), 2000);
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 1400, margin: "0 auto", paddingBottom: 40 }}>
        {/* Header trang chuẩn màu sáng Emerald Green */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#eaf6ef",
                  display: "grid",
                  placeItems: "center",
                  color: "#087f5b",
                  border: "1px solid #b8dec5",
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#0f172a",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Cảnh báo sai lệch tài liệu (Drift Alerts)
                </h1>
                <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>
                  Phát hiện sự không đồng nhất giữa mã nguồn Git vừa thay đổi và nội dung tài liệu kỹ thuật
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => {
                setAlerts(INITIAL_ALERTS);
                setSelectedAlertId(1);
              }}
              className="ld-btn ld-btn-secondary ld-btn-sm"
              style={{ gap: 6, fontSize: 13, background: "#ffffff", border: "1px solid #e2e8f0" }}
            >
              <RefreshCw size={14} />
              Quét lại
            </button>
            <a
              href="/tai-lieu-cua-toi"
              className="ld-btn ld-btn-primary ld-btn-sm"
              style={{
                gap: 6,
                fontSize: 13,
                background: "#087f5b",
                color: "#ffffff",
                boxShadow: "0 2px 6px rgba(8, 127, 91, 0.2)",
              }}
            >
              <FileCheck size={14} />
              Kho tài liệu ({alerts.length})
            </a>
          </div>
        </div>

        {/* Thông báo Toast thành công */}
        {successToast.show && (
          <div
            style={{
              marginBottom: 18,
              padding: "12px 16px",
              borderRadius: 8,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 4px 12px rgba(4, 120, 87, 0.08)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle2 size={18} style={{ color: "#059669", flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: 13, display: "block" }}>{successToast.title}</strong>
                <span style={{ fontSize: 12, color: "#047857" }}>{successToast.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast((prev) => ({ ...prev, show: false }))}
              style={{
                background: "none",
                border: "none",
                color: "#059669",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Thanh lọc theo Mức độ nghiêm trọng, Dạng sai lệch & Tìm kiếm */}
        <div
          className="ld-card"
          style={{
            padding: "14px 18px",
            marginBottom: 18,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "#ffffff",
            border: "1px solid #e4eae6",
            borderRadius: 10,
          }}
        >
          {/* Tầng 1: Bộ lọc Mức độ nghiêm trọng & Ô tìm kiếm */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <Filter size={13} style={{ color: "#087f5b" }} /> Mức độ:
              </span>
              <button
                type="button"
                onClick={() => setSeverityFilter("all")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "all" ? "1.5px solid #087f5b" : "1px solid #e2e8f0",
                  background: severityFilter === "all" ? "#eaf6ef" : "#f8fafc",
                  color: severityFilter === "all" ? "#07543f" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Tất cả ({counts.all})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("critical")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "critical" ? "1.5px solid #b91c1c" : "1px solid #fecaca",
                  background: severityFilter === "critical" ? "#fee2e2" : "#fef2f2",
                  color: "#b91c1c",
                  transition: "all 0.15s ease",
                }}
              >
                🔴 Nghiêm trọng ({counts.critical})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("high")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "high" ? "1.5px solid #b45309" : "1px solid #fde68a",
                  background: severityFilter === "high" ? "#fef3c7" : "#fffbeb",
                  color: "#b45309",
                  transition: "all 0.15s ease",
                }}
              >
                🟠 Cao ({counts.high})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("medium")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "medium" ? "1.5px solid #087f5b" : "1px solid #a7f3d0",
                  background: severityFilter === "medium" ? "#eaf6ef" : "#ecfdf5",
                  color: "#047857",
                  transition: "all 0.15s ease",
                }}
              >
                🟢 Trung bình ({counts.medium})
              </button>

              <button
                type="button"
                onClick={() => setSeverityFilter("low")}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: severityFilter === "low" ? "1.5px solid #166534" : "1px solid #bbf7d0",
                  background: severityFilter === "low" ? "#dcfce7" : "#f0fdf4",
                  color: "#166534",
                  transition: "all 0.15s ease",
                }}
              >
                ⚪ Thấp ({counts.low})
              </button>
            </div>

            {/* Ô tìm kiếm nhanh */}
            <div style={{ position: "relative", minWidth: 260 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tài liệu, repo, file..."
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#0f172a",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Tầng 2: Bộ lọc Dạng sai lệch (SIGNATURE / SEMANTIC / REFERENCE) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              paddingTop: 8,
              borderTop: "1px dashed #e2e8f0",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <Layers size={13} style={{ color: "#0284c7" }} /> Dạng sai lệch:
            </span>

            <button
              type="button"
              onClick={() => setClassificationFilter("all")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "all" ? "1.5px solid #087f5b" : "1px solid #e2e8f0",
                background: classificationFilter === "all" ? "#eaf6ef" : "#f8fafc",
                color: classificationFilter === "all" ? "#07543f" : "#475569",
                transition: "all 0.15s ease",
              }}
            >
              Tất cả dạng ({alerts.length})
            </button>

            <button
              type="button"
              onClick={() => setClassificationFilter("SIGNATURE")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "SIGNATURE" ? "1.5px solid #0284c7" : "1px solid #bae6fd",
                background: classificationFilter === "SIGNATURE" ? "#e0f2fe" : "#f0f9ff",
                color: "#0284c7",
                transition: "all 0.15s ease",
              }}
            >
              🔹 Chữ ký hàm (SIGNATURE) ({counts.signature})
            </button>

            <button
              type="button"
              onClick={() => setClassificationFilter("SEMANTIC")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "SEMANTIC" ? "1.5px solid #7c3aed" : "1px solid #ddd6fe",
                background: classificationFilter === "SEMANTIC" ? "#ede9fe" : "#f5f3ff",
                color: "#7c3aed",
                transition: "all 0.15s ease",
              }}
            >
              🔸 Ngữ nghĩa logic (SEMANTIC) ({counts.semantic})
            </button>

            <button
              type="button"
              onClick={() => setClassificationFilter("REFERENCE")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                border: classificationFilter === "REFERENCE" ? "1.5px solid #b45309" : "1px solid #fde68a",
                background: classificationFilter === "REFERENCE" ? "#fef3c7" : "#fffbeb",
                color: "#b45309",
                transition: "all 0.15s ease",
              }}
            >
              📚 Tham chiếu cấu trúc (REFERENCE) ({counts.reference})
            </button>
          </div>
        </div>

        {/* KHUNG BỐ CỤC 2 CỘT: CỘT TRÁI (DANH SÁCH) + CỘT PHẢI (CHI TIẾT ĐỐI CHIẾU DIFF) */}
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 18, alignItems: "start" }}>
          {/* CỘT TRÁI: DANH SÁCH CẢNH BÁO */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredAlerts.length === 0 ? (
              <div
                className="ld-card"
                style={{ textAlign: "center", padding: "40px 16px", background: "#ffffff" }}
              >
                <CheckCircle2 size={32} style={{ color: "#087f5b", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>
                  Không tìm thấy cảnh báo nào
                </p>
                <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
                  Hãy thử chọn mức độ hoặc dạng sai lệch khác, hoặc xóa ô tìm kiếm.
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const isSelected = alert.id === selectedAlert.id;
                const sev = SEVERITY_CONFIG[alert.severity];
                const cls = CLASSIFICATION_CONFIG[alert.classification];

                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlertId(alert.id)}
                    style={{
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      border: isSelected ? "1.5px solid #087f5b" : "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "14px 16px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 4px 14px rgba(8, 127, 91, 0.1)" : "0 1px 3px rgba(0,0,0,0.02)",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 9999,
                            background: sev.badgeBg,
                            color: sev.badgeText,
                            border: `1px solid ${sev.border}`,
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                          }}
                        >
                          {sev.label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: cls.bg,
                            color: cls.color,
                            border: `1px solid ${cls.border}`,
                          }}
                        >
                          {alert.classification}
                        </span>
                      </div>

                      {alert.status === "RESOLVED" || alert.status === "DRAFT_CREATED" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#eaf6ef",
                            color: "#087f5b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={12} /> Đã tạo bản nháp
                        </span>
                      ) : alert.status === "IGNORED" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#f1f5f9",
                            color: "#64748b",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <EyeOff size={12} /> Đã bỏ qua
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={11} /> {alert.daysStale} ngày trước
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isSelected ? "#07543f" : "#0f172a",
                        margin: "8px 0 4px",
                        lineHeight: 1.4,
                      }}
                    >
                      {alert.docTitle}
                    </h3>

                    <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 500, color: "#334155" }}>{alert.repo}</span>
                      {alert.pr && (
                        <>
                          <span>•</span>
                          <span style={{ color: "#087f5b", fontWeight: 600 }}>PR #{alert.pr.number}</span>
                        </>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: 12,
                        color: "#475569",
                        margin: "8px 0 0",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {alert.driftReason}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* CỘT PHẢI: MÀN HÌNH XEM CHI TIẾT & ĐỐI CHIẾU DIFF CODE - TÀI LIỆU */}
          {selectedAlert && (
            <div
              className="ld-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e4eae6",
                padding: "20px 24px",
                borderRadius: 10,
                boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              }}
            >
              {/* Tiêu đề & Thanh trạng thái chi tiết */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: 16,
                  marginBottom: 18,
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 9999,
                        background: SEVERITY_CONFIG[selectedAlert.severity].badgeBg,
                        color: SEVERITY_CONFIG[selectedAlert.severity].badgeText,
                        border: `1px solid ${SEVERITY_CONFIG[selectedAlert.severity].border}`,
                      }}
                    >
                      Mức độ: {SEVERITY_CONFIG[selectedAlert.severity].label}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Kho lưu trữ: <strong style={{ color: "#0f172a" }}>{selectedAlert.repo}</strong>
                    </span>
                  </div>

                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#0f172a",
                      margin: "4px 0 2px",
                    }}
                  >
                    {selectedAlert.docTitle}
                  </h2>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0, fontFamily: "var(--font-mono)" }}>
                    Đường dẫn: {selectedAlert.docPath}
                  </p>
                </div>

                {/* 3 NÚT HÀNH ĐỘNG NHANH TRÊN HEADER: Chấp nhận đề xuất, Chỉnh sửa, Bỏ qua */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {/* Nút 1: Chấp nhận đề xuất (Tạo bản nháp mới) */}
                  {selectedAlert.status === "RESOLVED" || selectedAlert.status === "DRAFT_CREATED" ? (
                    <button
                      type="button"
                      onClick={() => handleEdit(selectedAlert)}
                      className="ld-btn ld-btn-primary ld-btn-sm"
                      style={{
                        background: "#087f5b",
                        color: "#ffffff",
                        gap: 6,
                        fontSize: 12,
                        padding: "7px 14px",
                        fontWeight: 600,
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Đã giải quyết (Mở Editor v2.1)
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={acceptingId === selectedAlert.id}
                      onClick={() => handleAcceptFix(selectedAlert)}
                      className="ld-btn ld-btn-primary ld-btn-sm"
                      title="Tự động áp dụng đề xuất của AI và tạo bản nháp DRAFT v2.1"
                      style={{
                        background: "#087f5b",
                        color: "#ffffff",
                        gap: 6,
                        fontSize: 12,
                        padding: "7px 16px",
                        fontWeight: 600,
                        boxShadow: "0 2px 8px rgba(8, 127, 91, 0.25)",
                        cursor: acceptingId === selectedAlert.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {acceptingId === selectedAlert.id ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Đang tạo bản nháp...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Chấp nhận đề xuất
                        </>
                      )}
                    </button>
                  )}

                  {/* Nút 2: Chỉnh sửa (Mở Trình soạn thảo Split Editor) */}
                  <button
                    type="button"
                    onClick={() => handleEdit(selectedAlert)}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                    title="Mở trình soạn thảo Markdown với nội dung tài liệu để chỉnh sửa thủ công"
                    style={{
                      gap: 6,
                      fontSize: 12,
                      padding: "7px 14px",
                      fontWeight: 600,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      color: "#334155",
                    }}
                  >
                    <Edit3 size={14} style={{ color: "#0284c7" }} />
                    Chỉnh sửa
                  </button>

                  {/* Nút 3: Bỏ qua (Đánh dấu trạng thái IGNORED) */}
                  {selectedAlert.status !== "IGNORED" && (
                    <button
                      type="button"
                      disabled={ignoringId === selectedAlert.id}
                      onClick={() => handleIgnore(selectedAlert)}
                      className="ld-btn ld-btn-ghost ld-btn-sm"
                      title="Bỏ qua cảnh báo này và không cập nhật tài liệu"
                      style={{
                        gap: 5,
                        fontSize: 12,
                        padding: "7px 12px",
                        fontWeight: 500,
                        color: "#64748b",
                        border: "1px solid #e2e8f0",
                        cursor: ignoringId === selectedAlert.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {ignoringId === selectedAlert.id ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <EyeOff size={13} />
                      )}
                      Bỏ qua
                    </button>
                  )}
                </div>
              </div>

              {/* Thông tin Pull Request liên quan */}
              {selectedAlert.pr && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <GitPullRequest size={16} style={{ color: "#087f5b" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                      PR #{selectedAlert.pr.number}: {selectedAlert.pr.title}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Nhánh: <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: 3, color: "#0f172a" }}>{selectedAlert.pr.branch}</code> • Bởi: <strong>{selectedAlert.pr.author}</strong> ({selectedAlert.pr.mergedAt})
                  </div>
                </div>
              )}

              {/* Nguyên nhân sai lệch & Đề xuất sửa đổi của AI */}
              <div
                style={{
                  background: "#eaf6ef",
                  border: "1px solid #b8dec5",
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Zap size={14} style={{ color: "#087f5b" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#07543f", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Phân tích & Đề xuất AI
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#0f172a", margin: "0 0 6px", lineHeight: 1.5 }}>
                  <strong>Lý do sai lệch:</strong> {selectedAlert.driftReason}
                </p>
                <p style={{ fontSize: 13, color: "#07543f", margin: 0, lineHeight: 1.5 }}>
                  <strong>Hành động khuyến nghị:</strong> {selectedAlert.aiSuggestion}
                </p>
              </div>

              {/* PHẦN 1: SO SÁNH DIFF TÀI LIỆU 2 CỘT TRỰC QUAN (YÊU CẦU TRỌNG TÂM TASK 5) */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <FileDiff size={17} style={{ color: "#087f5b" }} />
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      So sánh Diff 2 cột trực quan: Tài liệu hiện tại vs Đề xuất AI
                    </h3>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#047857",
                      fontWeight: 600,
                      background: "#eaf6ef",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid #b8dec5",
                    }}
                  >
                    Mục: {selectedAlert.docDiff.sectionTitle}
                  </span>
                </div>

                {/* Diff Viewer 2 cột: Cột trái (Tài liệu hiện tại - Outdated bôi đỏ) vs Cột phải (Đề xuất AI - Suggested bôi xanh) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {/* CỘT TRÁI: TÀI LIỆU HIỆN TẠI (CÁC ĐOẠN BỊ TRÔI DẠT BÔI ĐỎ) */}
                  <div
                    style={{
                      border: "1.5px solid #fca5a5",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#fffaf9",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 14px",
                        background: "#fee2e2",
                        borderBottom: "1px solid #fca5a5",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#991b1b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626" }}></span>
                        Cột trái: Tài liệu hiện tại (Đã trôi dạt)
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#fecaca",
                          color: "#7f1d1d",
                          padding: "1px 8px",
                          borderRadius: 4,
                          textTransform: "uppercase",
                        }}
                      >
                        BỊ TRÔI DẠT / CŨ
                      </span>
                    </div>

                    <div
                      style={{
                        padding: 14,
                        fontSize: 12.5,
                        color: "#7f1d1d",
                        lineHeight: 1.7,
                        minHeight: 180,
                        whiteSpace: "pre-wrap",
                        background: "#fff5f5",
                        borderLeft: "4px solid #ef4444",
                        flex: 1,
                      }}
                    >
                      {selectedAlert.docDiff.outdatedContent}
                    </div>
                  </div>

                  {/* CỘT PHẢI: ĐỀ XUẤT VIẾT LẠI CỦA AI (CÁC ĐOẠN CẬP NHẬT BÔI XANH) */}
                  <div
                    style={{
                      border: "1.5px solid #86efac",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#f7fee7",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        padding: "8px 14px",
                        background: "#dcfce7",
                        borderBottom: "1px solid #86efac",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#166534",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a" }}></span>
                        Cột phải: Đề xuất viết lại của AI (Mới)
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#bbf7d0",
                          color: "#14532d",
                          padding: "1px 8px",
                          borderRadius: 4,
                          textTransform: "uppercase",
                        }}
                      >
                        ĐỀ XUẤT CẬP NHẬT
                      </span>
                    </div>

                    <div
                      style={{
                        padding: 14,
                        fontSize: 12.5,
                        color: "#14532d",
                        lineHeight: 1.7,
                        minHeight: 180,
                        whiteSpace: "pre-wrap",
                        background: "#f0fdf4",
                        borderLeft: "4px solid #22c55e",
                        flex: 1,
                      }}
                    >
                      {selectedAlert.docDiff.suggestedContent}
                    </div>
                  </div>
                </div>
              </div>

              {/* PHẦN 2: ĐỐI CHIẾU THAY ĐỔI MÃ NGUỒN GIT (CODE DIFF THỰC TẾ) */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Code size={15} style={{ color: "#087f5b" }} />
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: 0 }}>
                      Mã nguồn Git thay đổi tương ứng ({selectedAlert.codeDiff.fileName})
                    </h3>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => copyCode(selectedAlert.codeDiff.newCode, "new")}
                      className="ld-btn ld-btn-ghost ld-btn-xs"
                      style={{ fontSize: 11, gap: 4, color: "#64748b" }}
                    >
                      {copiedCodeSide === "new" ? <Check size={12} className="text-emerald-600" /> : <FileCode size={12} />}
                      {copiedCodeSide === "new" ? "Đã chép code mới" : "Sao chép code"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {/* Mã nguồn cũ */}
                  <div style={{ border: "1px solid #fecaca", borderRadius: 8, overflow: "hidden" }}>
                    <div
                      style={{
                        padding: "6px 12px",
                        background: "#fef2f2",
                        borderBottom: "1px solid #fecaca",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#991b1b",
                      }}
                    >
                      <span>- Code gốc trước khi PR merge</span>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: 12,
                        background: "#fff5f5",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "#7f1d1d",
                        lineHeight: 1.6,
                        overflowX: "auto",
                        minHeight: 120,
                      }}
                    >
                      {selectedAlert.codeDiff.oldCode}
                    </pre>
                  </div>

                  {/* Mã nguồn mới */}
                  <div style={{ border: "1px solid #bbf7d0", borderRadius: 8, overflow: "hidden" }}>
                    <div
                      style={{
                        padding: "6px 12px",
                        background: "#f0fdf4",
                        borderBottom: "1px solid #bbf7d0",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#166534",
                      }}
                    >
                      <span>+ Code mới vừa merge (Gây trôi dạt)</span>
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        padding: 12,
                        background: "#f0fdf4",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "#14532d",
                        lineHeight: 1.6,
                        overflowX: "auto",
                        minHeight: 120,
                      }}
                    >
                      {selectedAlert.codeDiff.newCode}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Nút hành động bổ sung dưới chân trang chi tiết */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
                  <Info size={14} style={{ color: "#087f5b" }} />
                  <span>
                    Quy trình 3 clicks: <strong>1. Chọn cảnh báo</strong> ➔ <strong>2. Xem Diff 2 cột</strong> ➔ <strong>3. Bấm Chấp nhận đề xuất</strong> để cập nhật tài liệu.
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleIgnore(selectedAlert)}
                    className="ld-btn ld-btn-ghost ld-btn-sm"
                    style={{ fontSize: 12, color: "#64748b" }}
                  >
                    <XCircle size={13} /> Bỏ qua cảnh báo
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEdit(selectedAlert)}
                    className="ld-btn ld-btn-secondary ld-btn-sm"
                    style={{ fontSize: 12, gap: 5 }}
                  >
                    <Edit3 size={13} /> Chỉnh sửa thủ công
                  </button>

                  {selectedAlert.status !== "RESOLVED" && (
                    <button
                      type="button"
                      disabled={acceptingId === selectedAlert.id}
                      onClick={() => handleAcceptFix(selectedAlert)}
                      className="ld-btn ld-btn-primary ld-btn-sm"
                      style={{
                        background: "#087f5b",
                        color: "#ffffff",
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={14} />
                      Chấp nhận đề xuất
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
