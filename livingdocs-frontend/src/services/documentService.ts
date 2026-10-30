import { apiClient } from "./apiClient";
import type {
  CreateDocumentPayload,
  DocCollection,
  DocumentDetail,
  DocumentItem,
  DocumentVersionItem,
  DocumentAuditLogItem,
  ChangelogItem,
  PaginatedResponse,
  IntegrityCheckResult,
  RollbackResponse,
  UpdateDocumentPayload,
} from "@/types/document";

export const documentService = {
  /**
   * Lấy danh sách tài liệu, hỗ trợ lọc theo collectionId hoặc repoId
   */
  async getDocuments(params?: {
    collectionId?: number;
    repoId?: number;
  }): Promise<DocumentItem[]> {
    const res = await apiClient.get<DocumentItem[]>("/api/documents", {
      params,
    });
    return res.data;
  },

  /**
   * Lấy chi tiết tài liệu kèm nội dung mới nhất và lịch sử các phiên bản
   */
  async getDocumentById(docId: number): Promise<DocumentDetail> {
    const res = await apiClient.get<DocumentDetail>(`/api/documents/${docId}`);
    return res.data;
  },

  /**
   * Tạo tài liệu mới và tự động sinh phiên bản Genesis v1
   */
  async createDocument(payload: CreateDocumentPayload): Promise<DocumentItem> {
    const res = await apiClient.post<DocumentItem>("/api/documents", payload);
    return res.data;
  },

  /**
   * Cập nhật tài liệu và tự động tạo phiên bản tiếp theo v(N+1) kèm chuỗi băm
   */
  async updateDocument(
    docId: number,
    payload: UpdateDocumentPayload
  ): Promise<DocumentItem> {
    const res = await apiClient.put<DocumentItem>(
      `/api/documents/${docId}`,
      payload
    );
    return res.data;
  },

  /**
   * Xóa tài liệu
   */
  async deleteDocument(docId: number): Promise<void> {
    await apiClient.delete(`/api/documents/${docId}`);
  },

  /**
   * Developer gửi tài liệu lên quy trình phê duyệt
   */
  async submitForReview(docId: number): Promise<DocumentItem> {
    const res = await apiClient.post<DocumentItem>(
      `/api/documents/${docId}/submit-review`
    );
    return res.data;
  },

  /**
   * Staff duyệt hoặc từ chối tài liệu (Cấp 1)
   */
  async reviewByStaff(
    docId: number,
    payload: { decision: "APPROVE" | "REJECT"; comment?: string }
  ): Promise<DocumentItem> {
    const res = await apiClient.post<DocumentItem>(
      `/api/documents/${docId}/staff-review`,
      payload
    );
    return res.data;
  },

  /**
   * Alias tương thích cho trang Hàng đợi xem xét của Staff
   */
  async processStaffReview(
    docId: number,
    payload: { decision: "APPROVE" | "REJECT"; comment?: string }
  ): Promise<DocumentItem> {
    return this.reviewByStaff(docId, payload);
  },

  /**
   * Manager phê duyệt tài liệu (Cấp 2)
   */
  async reviewByManager(
    docId: number,
    payload: { decision: "PUBLISH" | "APPROVE" | "RETURN_STAFF" | "REJECT"; comment?: string }
  ): Promise<DocumentItem> {
    const res = await apiClient.post<DocumentItem>(
      `/api/documents/${docId}/manager-review`,
      payload
    );
    return res.data;
  },

  /**
   * Lấy nhật ký lịch sử thay đổi (Audit trail) của tài liệu
   */
  async getDocumentAuditTrail(docId: number): Promise<DocumentAuditLogItem[]> {
    const res = await apiClient.get<DocumentAuditLogItem[]>(
      `/api/documents/${docId}/audit-trail`
    );
    return res.data;
  },

  /**
   * Lấy danh sách changelog của một tài liệu cụ thể
   */
  async getDocumentChangelogs(docId: number): Promise<ChangelogItem[]> {
    const res = await apiClient.get<ChangelogItem[]>(
      `/api/documents/${docId}/changelogs`
    );
    return res.data;
  },

  /**
   * Lấy danh sách changelog toàn hệ thống có hỗ trợ lọc và phân trang
   */
  async getSystemChangelogs(params?: {
    actorRole?: string;
    repoId?: number;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<ChangelogItem>> {
    const res = await apiClient.get<PaginatedResponse<ChangelogItem>>("/api/changelogs", {
      params,
    });
    return res.data;
  },

  /**
   * Xác thực tính toàn vẹn chuỗi băm SHA-256
   */
  async verifyIntegrity(docId: number): Promise<IntegrityCheckResult> {
    const res = await apiClient.get<IntegrityCheckResult>(
      `/api/documents/${docId}/verify-integrity`
    );
    return res.data;
  },

  /**
   * Lấy danh sách toàn bộ phiên bản của tài liệu (từ mới nhất đến cũ nhất)
   */
  async getDocumentVersions(docId: number): Promise<DocumentVersionItem[]> {
    const res = await apiClient.get<DocumentVersionItem[]>(
      `/api/documents/${docId}/versions`
    );
    return res.data;
  },

  /**
   * Lấy chi tiết và nội dung của một phiên bản cụ thể
   */
  async getDocumentVersion(
    docId: number,
    versionNum: number
  ): Promise<DocumentVersionItem> {
    const res = await apiClient.get<DocumentVersionItem>(
      `/api/documents/${docId}/versions/${versionNum}`
    );
    return res.data;
  },

  /**
   * Khôi phục tài liệu về phiên bản chỉ định (tạo phiên bản mới bảo toàn chuỗi băm)
   */
  async rollbackToVersion(
    docId: number,
    payload: {
      targetVersion: number;
      reason?: string;
      actorRole?: string;
    }
  ): Promise<RollbackResponse> {
    const res = await apiClient.post<RollbackResponse>(
      `/api/documents/${docId}/rollback`,
      payload
    );
    return res.data;
  },

  /**
   * Lấy danh sách toàn bộ các bộ sưu tập tài liệu
   */
  async getCollections(): Promise<DocCollection[]> {
    const res = await apiClient.get<DocCollection[]>("/api/collections");
    return res.data;
  },

  /**
   * Tạo bộ sưu tập mới
   */
  async createCollection(payload: {
    name: string;
    description?: string;
  }): Promise<DocCollection> {
    const res = await apiClient.post<DocCollection>(
      "/api/collections",
      payload
    );
    return res.data;
  },

  /**
   * Xóa bộ sưu tập
   */
  async deleteCollection(id: number): Promise<void> {
    await apiClient.delete(`/api/collections/${id}`);
  },
};
