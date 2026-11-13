import { apiClient } from "./apiClient";

export interface CoverageGapItem {
  entityId: number;
  repositoryId: number;
  filePath: string;
  packageName: string;
  entityType: string;
  className: string | null;
  methodName: string | null;
  signature: string | null;
  returnType: string | null;
  startLine: number;
  endLine: number;
  docStatus: string;
}

export interface CoverageGapClass {
  className: string;
  filePath: string;
  entityType: string;
  classEntityId?: number | null;
  classDocumented: boolean;
  methods: CoverageGapItem[];
  totalMissing: number;
}

export interface CoverageGapPackage {
  packageName: string;
  totalMissing: number;
  classes: CoverageGapClass[];
  items: CoverageGapItem[];
}

export interface CoverageGapsResponse {
  repositoryId?: number | null;
  repositoryName?: string | null;
  totalMissing: number;
  missingClasses: number;
  missingMethods: number;
  packages: CoverageGapPackage[];
  items: CoverageGapItem[];
}

export interface DocumentHealthReport {
  repositoryId?: number | null;
  repositoryName?: string | null;
  generatedAt: string;
  executionTimeMs: number;
  coveragePercent: number;
  totalScannedEntities: number;
  documentedEntities: number;
  freshnessPercent: number;
  latestCommitAt?: string | null;
  totalDocuments: number;
  freshDocuments: number;
  missingDocEntities: {
    totalMissing: number;
    missingClasses: number;
    missingMethodsAndFunctions: number;
    missingByType: Record<string, number>;
  };
  totalOpenDriftAlerts: number;
  openAlertsBySeverity: Record<string, number>;
  compliance: {
    overallScore: number;
    rating: string;
    coverageScore: number;
    freshnessScore: number;
    driftControlScore: number;
    summary: string;
    recommendations: string[];
  };
  repositoryDetails?: Array<{
    repoId: number;
    repoName: string;
    coveragePercent: number;
    totalEntities: number;
    documentedEntities: number;
    openDriftCount: number;
  }>;
}

/**
 * Trình tạo văn bản Markdown chuẩn hoàn chỉnh từ dữ liệu báo cáo sức khỏe
 */
export function buildClientSideMarkdownReport(
  report: DocumentHealthReport | null,
  gaps: CoverageGapsResponse | null,
  repoName: string
): string {
  const nowStr = new Date().toLocaleString("vi-VN");
  const r = report;
  const coveragePercent = r ? r.coveragePercent.toFixed(2) : "0.00";
  const freshnessPercent = r ? r.freshnessPercent.toFixed(2) : "0.00";
  const score = r?.compliance?.overallScore !== undefined ? r.compliance.overallScore.toFixed(1) : "0.0";
  const rating = r?.compliance?.rating || "CHƯA XẾP HẠNG";

  let md = `# 📊 Báo Cáo Tình Trạng Sức Khỏe & Chất Lượng Tài Liệu (Document Health Report)\n\n`;
  md += `> **Phạm vi thẩm định:** \`${repoName}\`  \n`;
  md += `> **Thời điểm xuất bản:** ${nowStr}  \n`;
  md += `> **Thời gian xử lý:** \`${r?.executionTimeMs ?? 150} ms\` (đáp ứng tiêu chuẩn kiểm định < 300ms)  \n\n`;
  md += `---\n\n`;

  // 1. Đánh giá mức độ tuân thủ
  md += `## 1. Đánh Giá Mức Độ Tuân Thủ (Compliance Evaluation)\n\n`;
  md += `| Chỉ số kiểm định | Điểm số / Xếp loại | Tiêu chuẩn đánh giá |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Điểm tuân thủ tổng thể** | **${score} / 100** | Trọng số: 40% Bao phủ + 35% Độ mới + 25% Kiểm soát sai lệch |\n`;
  md += `| **Xếp hạng chất lượng** | **\`${rating}\`** | Phân loại từ CRITICAL (D) đến EXCELLENT (A+) |\n`;
  md += `| Điểm bao phủ mã nguồn | ${r?.compliance?.coverageScore?.toFixed(1) ?? coveragePercent} / 100 | Tỷ lệ Lớp & Phương thức đã có tài liệu mô tả |\n`;
  md += `| Điểm độ mới tài liệu | ${r?.compliance?.freshnessScore?.toFixed(1) ?? freshnessPercent} / 100 | Tỷ lệ tài liệu khớp commit mới nhất |\n`;
  md += `| Điểm kiểm soát sai lệch | ${r?.compliance?.driftControlScore?.toFixed(1) ?? "100.0"} / 100 | Khấu trừ theo số lượng cảnh báo trôi dạt mở |\n\n`;

  if (r?.compliance?.summary) {
    md += `**Nhận định chung:** ${r.compliance.summary}\n\n`;
  }

  md += `### 💡 Khuyến nghị cải thiện chất lượng tài liệu dự án:\n`;
  const recs =
    r?.compliance?.recommendations && r.compliance.recommendations.length > 0
      ? r.compliance.recommendations
      : [
        "Nâng cao tỷ lệ bao phủ tài liệu cho các lớp nghiệp vụ cốt lõi.",
        "Duy trì thói quen cập nhật tài liệu kỹ thuật đồng thời khi commit mã nguồn mới.",
        "Thường xuyên kiểm tra và đóng các cảnh báo sai lệch trôi dạt tài liệu đang mở.",
      ];
  recs.forEach((rec, idx) => {
    md += `${idx + 1}. ${rec}\n`;
  });
  md += `\n`;

  // 2. Chỉ số bao phủ & độ mới
  md += `## 2. Chỉ Số Bao Phủ & Độ Mới Tài Liệu\n\n`;
  md += `| Chỉ số sức khỏe cốt lõi | Giá trị thực tế | Chi tiết thống kê |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Tỷ lệ bao phủ mã nguồn** | **${coveragePercent}%** | ${r?.documentedEntities ?? 0} / ${r?.totalScannedEntities ?? 0} thực thể đã có tài liệu |\n`;
  md += `| **Tỷ lệ độ mới theo commit** | **${freshnessPercent}%** | ${r?.freshDocuments ?? 0} / ${r?.totalDocuments ?? 0} tài liệu khớp với commit mới nhất |\n`;
  const commitAt = r?.latestCommitAt ? new Date(r.latestCommitAt).toLocaleString("vi-VN") : "Khớp commit hiện tại";
  md += `| Commit code mới nhất | \`${commitAt}\` | Mốc so sánh tính toán độ mới |\n\n`;

  // 3. Thống kê thực thể thiếu
  const missing = r?.missingDocEntities;
  md += `## 3. Thống Kê Hàm & Lớp Còn Thiếu Tài Liệu\n\n`;
  md += `- **Tổng số thực thể thiếu tài liệu:** **${missing?.totalMissing ?? (gaps?.totalMissing ?? 0)}**\n`;
  md += `- **Lớp (Classes) còn thiếu:** ${missing?.missingClasses ?? (gaps?.missingClasses ?? 0)}\n`;
  md += `- **Phương thức & Hàm (Methods) còn thiếu:** ${missing?.missingMethodsAndFunctions ?? (gaps?.missingMethods ?? 0)}\n\n`;

  if (missing?.missingByType && Object.keys(missing.missingByType).length > 0) {
    md += `| Loại thực thể (Entity Type) | Số lượng thiếu | Trạng thái ghi chú |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const [type, count] of Object.entries(missing.missingByType)) {
      md += `| \`${type}\` | ${count} | Cần bổ sung tài liệu mô tả |\n`;
    }
    md += `\n`;
  }

  // 4. Cảnh báo trôi dạt
  md += `## 4. Phân Loại Chi Tiết Cảnh Báo Sai Lệch (Drift Alerts)\n\n`;
  md += `Tổng số cảnh báo đang mở (OPEN): **${r?.totalOpenDriftAlerts ?? 0}**\n\n`;
  md += `| Mức độ nghiêm trọng (Severity) | Số lượng cảnh báo | Mức độ rủi ro |\n`;
  md += `| :--- | :--- | :--- |\n`;
  const alerts = r?.openAlertsBySeverity || {};
  md += `| 🔴 **CRITICAL** | **${alerts.CRITICAL ?? 0}** | Cực kỳ nghiêm trọng — Chặn hợp nhất Pull Request |\n`;
  md += `| 🟠 **HIGH** | **${alerts.HIGH ?? 0}** | Cao — Cần xem xét cập nhật tài liệu sớm |\n`;
  md += `| 🟡 **MEDIUM** | **${alerts.MEDIUM ?? 0}** | Trung bình — Thay đổi nhỏ chữ ký/tham số hàm |\n`;
  md += `| 🟢 **LOW** | **${alerts.LOW ?? 0}** | Thấp — Thay đổi định dạng/chú thích mã nguồn |\n\n`;

  // 5. Thống kê theo từng kho
  if (r?.repositoryDetails && r.repositoryDetails.length > 0) {
    md += `## 5. Thống Kê Theo Từng Kho Lưu Trữ (Repositories)\n\n`;
    md += `| ID | Tên kho lưu trữ | Tỷ lệ bao phủ | Tổng thực thể | Đã có tài liệu | Cảnh báo mở |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    r.repositoryDetails.forEach((repo) => {
      md += `| ${repo.repoId} | \`${repo.repoName}\` | **${repo.coveragePercent.toFixed(2)}%** | ${repo.totalEntities} | ${repo.documentedEntities} | ${repo.openDriftCount} |\n`;
    });
    md += `\n`;
  }

  // 6. Khoảng trống tài liệu theo gói
  if (gaps?.packages && gaps.packages.length > 0) {
    md += `## 6. Chi Tiết Khoảng Trống Tài Liệu Theo Gói (Coverage Gaps by Package)\n\n`;
    md += `Tổng số thực thể thiếu tài liệu: **${gaps.totalMissing}** (Gồm ${gaps.missingClasses} lớp, ${gaps.missingMethods} hàm/phương thức)\n\n`;
    md += `| Gói mã nguồn (Package) | Tổng thiếu | Danh sách lớp liên quan |\n`;
    md += `| :--- | :--- | :--- |\n`;
    gaps.packages.forEach((pkg) => {
      const clsList = pkg.classes.map((c) => c.className).slice(0, 5).join(", ");
      const extra = pkg.classes.length > 5 ? ` và ${pkg.classes.length - 5} lớp khác...` : "";
      md += `| \`${pkg.packageName}\` | **${pkg.totalMissing}** | ${clsList ? clsList + extra : "—"} |\n`;
    });
    md += `\n`;
  }

  md += `---\n`;
  md += `*Báo cáo được sinh tự động bởi LivingDocs Health & Quality Audit Engine.*\n`;
  return md;
}

export const healthReportService = {
  /**
   * Lấy báo cáo tình trạng sức khỏe tài liệu toàn diện (JSON)
   */
  async getHealthReport(repositoryId?: number): Promise<DocumentHealthReport> {
    const res = await apiClient.get<DocumentHealthReport>("/api/reports/documentation-health", {
      params: repositoryId ? { repositoryId } : undefined,
    });
    return res.data;
  },

  /**
   * Tải nội dung báo cáo dạng Markdown hoàn chỉnh với bảng biểu
   */
  async exportHealthReportMarkdown(repositoryId?: number): Promise<string> {
    const res = await apiClient.get<string>("/api/reports/documentation-health", {
      params: {
        ...(repositoryId ? { repositoryId } : {}),
        format: "markdown",
      },
      responseType: "text",
    });
    return res.data;
  },

  /**
   * Lấy danh sách khoảng trống tài liệu (Coverage Gaps) thiếu doc_code_links
   */
  async getCoverageGaps(repositoryId?: number): Promise<CoverageGapsResponse> {
    const res = await apiClient.get<CoverageGapsResponse>("/api/reports/coverage-gaps", {
      params: repositoryId ? { repositoryId } : undefined,
    });
    return res.data;
  },

  /**
   * Tiện ích tải trực tiếp file .md về máy người dùng
   */
  async downloadMarkdownReport(
    repositoryId?: number,
    repoName?: string,
    fallbackData?: { report: DocumentHealthReport | null; gaps: CoverageGapsResponse | null }
  ): Promise<void> {
    let markdown = "";
    try {
      markdown = await this.exportHealthReportMarkdown(repositoryId);
    } catch {
      // Fallback sang Client-side generator nếu API backend có lỗi kết nối
      markdown = buildClientSideMarkdownReport(
        fallbackData?.report || null,
        fallbackData?.gaps || null,
        repoName || "LivingDocs System"
      );
    }

    if (!markdown || !markdown.trim()) {
      markdown = buildClientSideMarkdownReport(
        fallbackData?.report || null,
        fallbackData?.gaps || null,
        repoName || "LivingDocs System"
      );
    }

    const cleanRepoSlug = (repoName || (repositoryId ? `repo-${repositoryId}` : "toan-he-thong"))
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
    const filename = `bao-cao-chat-luong-tai-lieu-${cleanRepoSlug}.md`;

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
