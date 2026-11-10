import { apiClient } from "./apiClient";

export interface RepoCoverage {
  repoId: number;
  repoName: string;
  coveragePercent: number;
  totalEntities: number;
  documentedEntities: number;
  openDriftCount: number;
}

export interface DashboardStats {
  coveragePercent: number;
  freshnessPercent: number;
  unresolvedDriftCount: number;
  criticalDriftCount: number;
  totalDocuments: number;
  approvedDocuments: number;
  pendingReviewDocuments: number;
  draftDocuments: number;
  totalPullRequests: number;
  totalRepositories: number;
  repoCoverages: RepoCoverage[];
}

export interface DashboardTrendItem {
  label: string;
  period: string;
  updatedDocs: number;
  driftAlerts: number;
  coverageRate: number;
}

interface BackendDashboardStatsResponse {
  repositoryId?: number | null;
  totalClassesAndFunctions?: number;
  documentedEntities?: number;
  coveragePercent?: number;
  freshnessPercent?: number;
  latestCommitAt?: string | null;
  totalDocuments?: number;
  freshDocuments?: number;
  openDriftAlerts?: number;
  openAlertsBySeverity?: Record<string, number>;
  approvedDocuments?: number;
  pendingReviewDocuments?: number;
  draftDocuments?: number;
  totalPullRequests?: number;
  totalRepositories?: number;
  repoCoverages?: RepoCoverage[];
  unresolvedDriftCount?: number;
  criticalDriftCount?: number;
}

interface BackendTrendPoint {
  weekStart: string;
  createdDocuments: number;
  updates: number;
  alerts: number;
}

interface BackendDashboardTrendResponse {
  repositoryId?: number | null;
  weeks?: number;
  points?: BackendTrendPoint[];
}

function formatWeekPeriod(weekStartIso: string): string {
  const start = new Date(weekStartIso);
  if (Number.isNaN(start.getTime())) {
    return weekStartIso;
  }
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} - ${pad(end.getDate())}/${pad(end.getMonth() + 1)}`;
}

export const dashboardService = {
  /**
   * Lấy số liệu thống kê đo lường sức khỏe tài liệu tổng quan thực tế từ CSDL
   */
  async getStats(repositoryId?: number): Promise<DashboardStats> {
    try {
      const response = await apiClient.get<BackendDashboardStatsResponse>("/api/dashboard/stats", {
        params: repositoryId ? { repositoryId } : undefined,
      });
      const raw = response.data || {};

      const totalEntities = raw.totalClassesAndFunctions ?? 0;
      const documentedEntities = raw.documentedEntities ?? 0;
      const coveragePercent =
        typeof raw.coveragePercent === "number"
          ? Number(raw.coveragePercent.toFixed(1))
          : totalEntities > 0
          ? Number(((documentedEntities / totalEntities) * 100).toFixed(1))
          : 0;

      const freshnessPercent =
        typeof raw.freshnessPercent === "number"
          ? Number(raw.freshnessPercent.toFixed(1))
          : 0;

      const unresolvedDriftCount = raw.unresolvedDriftCount ?? raw.openDriftAlerts ?? 0;
      const criticalDriftCount =
        raw.criticalDriftCount ?? raw.openAlertsBySeverity?.CRITICAL ?? 0;

      const totalDocuments = raw.totalDocuments ?? 0;
      const approvedDocuments = raw.approvedDocuments ?? 0;
      const pendingReviewDocuments = raw.pendingReviewDocuments ?? 0;
      const draftDocuments = raw.draftDocuments ?? 0;
      const totalPullRequests = raw.totalPullRequests ?? 0;
      const totalRepositories = raw.totalRepositories ?? 0;

      const repoCoverages: RepoCoverage[] = Array.isArray(raw.repoCoverages)
        ? raw.repoCoverages.map((rc) => ({
            repoId: rc.repoId,
            repoName: rc.repoName,
            coveragePercent: typeof rc.coveragePercent === "number" ? Number(rc.coveragePercent.toFixed(1)) : 0,
            totalEntities: rc.totalEntities ?? 0,
            documentedEntities: rc.documentedEntities ?? 0,
            openDriftCount: rc.openDriftCount ?? 0,
          }))
        : [];

      return {
        coveragePercent,
        freshnessPercent,
        unresolvedDriftCount,
        criticalDriftCount,
        totalDocuments,
        approvedDocuments,
        pendingReviewDocuments,
        draftDocuments,
        totalPullRequests,
        totalRepositories,
        repoCoverages,
      };
    } catch (error) {
      console.error("Không thể tải stats từ API:", error);
      return {
        coveragePercent: 0,
        freshnessPercent: 0,
        unresolvedDriftCount: 0,
        criticalDriftCount: 0,
        totalDocuments: 0,
        approvedDocuments: 0,
        pendingReviewDocuments: 0,
        draftDocuments: 0,
        totalPullRequests: 0,
        totalRepositories: 0,
        repoCoverages: [],
      };
    }
  },

  /**
   * Lấy dữ liệu xu hướng cập nhật tài liệu qua các đợt PR thực tế từ PostgreSQL
   */
  async getTrend(repositoryId?: number, weeks = 4): Promise<DashboardTrendItem[]> {
    try {
      const response = await apiClient.get<DashboardTrendItem[] | BackendDashboardTrendResponse>(
        "/api/dashboard/trend",
        {
          params: {
            weeks,
            ...(repositoryId ? { repositoryId } : {}),
          },
        }
      );
      const data = response.data;

      if (Array.isArray(data)) {
        return data;
      }

      if (data && Array.isArray(data.points) && data.points.length > 0) {
        const lastPoints = data.points.slice(-weeks);
        return lastPoints.map((pt, index) => {
          const isLast = index === lastPoints.length - 1;
          const updatedDocs = Number(pt.createdDocuments ?? 0) + Number(pt.updates ?? 0);
          const driftAlerts = Number(pt.alerts ?? 0);
          return {
            label: isLast ? `Tuần ${index + 1} (Hiện tại)` : `Tuần ${index + 1}`,
            period: formatWeekPeriod(pt.weekStart),
            updatedDocs,
            driftAlerts,
            coverageRate: 100.0,
          };
        });
      }

      return [];
    } catch (error) {
      console.error("Không thể tải trend từ API:", error);
      return [];
    }
  },
};
