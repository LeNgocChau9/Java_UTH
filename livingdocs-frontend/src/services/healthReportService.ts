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
  async downloadMarkdownReport(repositoryId?: number, repoName?: string): Promise<void> {
    const markdown = await this.exportHealthReportMarkdown(repositoryId);
    const filename = repositoryId
      ? `document-health-report-${repoName || "repo-" + repositoryId}.md`
      : "document-health-report-system.md";

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
