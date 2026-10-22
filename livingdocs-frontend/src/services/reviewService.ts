import { apiClient } from "./apiClient";
import type { DocumentItem, DocumentStatus, DocumentVersionItem } from "@/types/document";

export interface ReviewQueueItem {
  id: number;
  docId: number;
  title: string;
  targetPath?: string | null;
  status: DocumentStatus;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  repoId: number;
  repoName: string;
  repoFullName: string;
  defaultBranch: string;
  repo?: {
    repoId: number;
    repoName: string;
    repoFullName: string;
    defaultBranch: string;
  };
  authorName: string;
  authorEmail: string;
  authorRole: string;
  author?: {
    name: string;
    email: string;
    role: string;
  };
  latestContent: string;
  latestVersion?: DocumentVersionItem | null;
  staffComment?: string | null;
  staffReviewer?: string | null;
  staffReviewedAt?: string | null;
}

export interface ReviewActionResponse {
  id: number;
  docId: number;
  reviewId: number;
  title: string;
  status: DocumentStatus;
  currentVersion: number;
  action: string;
  reviewer: string;
  comment: string;
  message: string;
  document?: DocumentItem;
  timestamp: string;
}

export const reviewService = {
  /**
   * GET /api/reviews/staff/queue
   * Lấy danh sách tài liệu đang chờ Staff rà soát kèm thông tin tác giả và repo.
   */
  async getStaffQueue(): Promise<ReviewQueueItem[]> {
    const res = await apiClient.get<ReviewQueueItem[]>("/api/reviews/staff/queue");
    return res.data;
  },

  /**
   * POST /api/reviews/{id}/staff-action
   * Xử lý hành động của Staff (Duyệt kèm ghi chú hoặc Từ chối).
   */
  async processStaffAction(
    id: number,
    payload: { action?: string; decision?: string; comment?: string; note?: string; actorRole?: string }
  ): Promise<ReviewActionResponse> {
    const res = await apiClient.post<ReviewActionResponse>(`/api/reviews/${id}/staff-action`, payload);
    return res.data;
  },

  /**
   * GET /api/reviews/manager/queue
   * Lấy danh sách tài liệu chờ Manager ký duyệt cuối cùng.
   */
  async getManagerQueue(): Promise<ReviewQueueItem[]> {
    const res = await apiClient.get<ReviewQueueItem[]>("/api/reviews/manager/queue");
    return res.data;
  },

  /**
   * POST /api/reviews/{id}/manager-action
   * Xử lý hành động của Manager (Phê duyệt xuất bản hoặc Trả về).
   */
  async processManagerAction(
    id: number,
    payload: { action?: string; decision?: string; comment?: string; note?: string; actorRole?: string }
  ): Promise<ReviewActionResponse> {
    const res = await apiClient.post<ReviewActionResponse>(`/api/reviews/${id}/manager-action`, payload);
    return res.data;
  },
};
