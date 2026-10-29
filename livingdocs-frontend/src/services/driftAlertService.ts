import { apiClient } from "./apiClient";

export interface DriftAlertDto {
  alertId: number;
  repoId: number;
  repoName: string;
  prNumber?: number;
  filePath: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  diffSnippet?: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  documentId?: number;
  documentTitle: string;
  currentDocContent?: string;
  methodName?: string;
  changeType?: string;
  aiSuggestion?: string;
  createdAt: string;
  resolvedAt?: string;
}

export const driftAlertService = {
  /**
   * Lấy danh sách các cảnh báo sai lệch tài liệu (Drift Alerts)
   */
  async getAlerts(params?: { repoId?: number; status?: string; severity?: string }): Promise<DriftAlertDto[]> {
    try {
      const response = await apiClient.get<DriftAlertDto[]>("/api/drift-alerts", { params });
      return response.data;
    } catch (error) {
      console.warn("Không thể tải cảnh báo từ backend, sử dụng dữ liệu mặc định:", error);
      return [];
    }
  },

  /**
   * Xem chi tiết một cảnh báo
   */
  async getAlertDetail(id: number): Promise<DriftAlertDto | null> {
    try {
      const response = await apiClient.get<DriftAlertDto>(`/api/drift-alerts/${id}`);
      return response.data;
    } catch (error) {
      console.error("Lỗi khi tải chi tiết cảnh báo:", error);
      return null;
    }
  },

  /**
   * Cập nhật trạng thái (RESOLVED hoặc DISMISSED)
   */
  async updateStatus(id: number, status: "RESOLVED" | "DISMISSED" | "OPEN"): Promise<boolean> {
    try {
      await apiClient.patch(`/api/drift-alerts/${id}/status`, null, { params: { status } });
      return true;
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái cảnh báo:", error);
      return false;
    }
  },

  /**
   * Chấp nhận sửa: Tạo bản nháp mới và giải quyết cảnh báo
   */
  async acceptFix(id: number): Promise<{ success: boolean; message: string; documentId?: number }> {
    try {
      const response = await apiClient.post(`/api/drift-alerts/${id}/accept-fix`);
      return response.data;
    } catch (error) {
      console.error("Lỗi khi chấp nhận sửa:", error);
      return { success: false, message: "Không thể kết nối đến máy chủ" };
    }
  },
};

