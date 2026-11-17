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
  structureWarning?: boolean;
  missingHeadings?: string[];
  aiGenerated?: boolean;
  docType?: string;
  approvalTiers?: number;
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
  commitSha?: string | null;
}

export interface ReviewHistoryItem {
  id: number;
  docId: number;
  versionId?: number | null;
  title: string;
  repo: string;
  reviewer: string;
  action: "approved" | "rejected" | "returned" | "pending";
  result: string;
  note: string;
  reviewedAt: string;
}

export interface ApprovalPolicyItem {
  docType: string;
  tiers: number; // 1 | 2
  description?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ManagerDelegationItem {
  id?: string;
  delegatorId?: number;
  delegatorEmail?: string;
  delegatorName: string;
  delegateeId?: number;
  delegateeEmail?: string;
  delegateeName: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  active?: boolean;
  createdAt?: string;
}

export interface ReviewCommentItem {
  commentId: number;
  reviewId?: number | null;
  docId: number;
  textSegment?: string | null;
  detailedComment: string;
  status: "OPEN" | "RESOLVED";
  authorEmail?: string | null;
  authorRole?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
}

export interface WorkspaceManagerItem {
  userId: number;
  fullName: string;
  email: string;
  roles: string[];
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
    payload: {
      action?: string;
      decision?: string;
      comment?: string;
      note?: string;
      actorRole?: string;
      sectionComments?: { textSegment: string; detailedComment: string }[];
    }
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
    payload: {
      action?: string;
      decision?: string;
      comment?: string;
      note?: string;
      actorRole?: string;
      commitToGithub?: boolean;
      delegationId?: string;
      delegatedFromEmail?: string;
      delegatedFromName?: string;
    }
  ): Promise<ReviewActionResponse> {
    const res = await apiClient.post<ReviewActionResponse>(`/api/reviews/${id}/manager-action`, payload);
    return res.data;
  },

  /**
   * GET /api/reviews/history
   * Lấy toàn bộ lịch sử xem xét tài liệu từ Staff và Manager.
   */
  async getReviewHistory(): Promise<ReviewHistoryItem[]> {
    const res = await apiClient.get<ReviewHistoryItem[]>("/api/reviews/history");
    return res.data;
  },

  /**
   * GET /api/reviews/policies
   * Lấy cấu hình phê duyệt 1 cấp / 2 cấp theo loại tài liệu (doc_type).
   */
  async getApprovalPolicies(): Promise<ApprovalPolicyItem[]> {
    const res = await apiClient.get<ApprovalPolicyItem[]>("/api/reviews/policies");
    return res.data;
  },

  /**
   * PUT /api/reviews/policies
   * Cập nhật danh sách chính sách phê duyệt 1 cấp vs 2 cấp.
   */
  async updateApprovalPolicies(policies: ApprovalPolicyItem[]): Promise<ApprovalPolicyItem[]> {
    const res = await apiClient.put<ApprovalPolicyItem[]>("/api/reviews/policies", policies);
    return res.data;
  },

  /**
   * GET /api/reviews/delegations
   * Lấy danh sách các bản ghi ủy quyền phê duyệt giữa các Quản lý.
   */
  async getManagerDelegations(): Promise<ManagerDelegationItem[]> {
    const res = await apiClient.get<ManagerDelegationItem[]>("/api/reviews/delegations");
    return res.data;
  },

  /**
   * POST /api/reviews/delegations
   * Tạo bản ghi ủy quyền phê duyệt Manager mới.
   */
  async createManagerDelegation(delegation: ManagerDelegationItem): Promise<ManagerDelegationItem> {
    const res = await apiClient.post<ManagerDelegationItem>("/api/reviews/delegations", delegation);
    return res.data;
  },

  /**
   * GET /api/reviews/documents/{docId}/comments
   * Lấy danh sách nhận xét từng mục của tài liệu.
   */
  async getDocumentComments(docId: number, status?: string): Promise<ReviewCommentItem[]> {
    const params = status ? { status } : undefined;
    const res = await apiClient.get<ReviewCommentItem[]>(`/api/reviews/documents/${docId}/comments`, { params });
    return res.data;
  },

  /**
   * POST /api/reviews/documents/{docId}/comments
   * Gửi nhận xét cho đoạn văn bản hoặc tiêu đề được chọn.
   */
  async createDocumentComment(
    docId: number,
    data: { reviewId?: number; textSegment?: string; detailedComment: string; authorEmail?: string; authorRole?: string }
  ): Promise<ReviewCommentItem> {
    const res = await apiClient.post<ReviewCommentItem>(`/api/reviews/documents/${docId}/comments`, data);
    return res.data;
  },

  /**
   * PATCH /api/reviews/documents/{docId}/comments/{commentId}
   * Đánh dấu nhận xét đã được giải quyết / khắc phục (RESOLVED).
   */
  async resolveDocumentComment(
    docId: number,
    commentId: number,
    detailedComment?: string
  ): Promise<ReviewCommentItem> {
    const res = await apiClient.patch<ReviewCommentItem>(`/api/reviews/documents/${docId}/comments/${commentId}`, {
      status: "RESOLVED",
      detailedComment,
    });
    return res.data;
  },

  /**
   * GET /api/reviews/workspace-managers
   * Lấy danh sách Manager/Admin đang hoạt động để chọn người ủy quyền.
   */
  async getWorkspaceManagers(): Promise<WorkspaceManagerItem[]> {
    const res = await apiClient.get<WorkspaceManagerItem[]>("/api/reviews/workspace-managers");
    return res.data;
  },
};
