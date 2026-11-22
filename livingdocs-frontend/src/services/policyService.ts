import { apiClient } from "./apiClient";

export interface DocumentUpdatePolicy {
  policyId?: number;
  documentType: string;
  triggerCommit: boolean;
  triggerPullRequest: boolean;
  triggerMerge: boolean;
  action: "AUTO_UPDATE" | "REVIEW";
  updatedBy?: number;
  updatedAt?: string;
}

export interface DocumentChangePolicy {
  policyId?: number;
  workspaceId?: number;
  repositoryId?: number | null;
  modulePattern: string;
  documentType: string;
  threshold: number;
  autoUpdateEnabled: boolean;
  updatedBy?: number;
  updatedAt?: string;
}

export interface PolicyEvaluationRequest {
  repositoryId?: number;
  workspaceId?: number;
  documentType: string;
  eventType: "commit" | "push" | "pull_request" | "merge";
  changedFilesCount: number;
  filePath?: string;
}

export interface PolicyEvaluationResponse {
  effectiveAction: "AUTO_UPDATE" | "REVIEW" | "SKIP";
  reason: string;
  autoUpdateEnabled: boolean;
  threshold: number;
  changedFilesCount: number;
  matchingPattern: string;
  appliedUpdatePolicy?: DocumentUpdatePolicy;
  appliedChangePolicy?: DocumentChangePolicy;
}

export const policyService = {
  /**
   * Lấy danh sách quy tắc kích hoạt cập nhật (document_update_policies)
   */
  async getUpdatePolicies(): Promise<DocumentUpdatePolicy[]> {
    const res = await apiClient.get<DocumentUpdatePolicy[]>("/api/policies/update");
    return res.data;
  },

  /**
   * Thêm hoặc lưu quy tắc kích hoạt cập nhật (AUTO_UPDATE vs REVIEW)
   */
  async saveUpdatePolicy(policy: DocumentUpdatePolicy): Promise<DocumentUpdatePolicy> {
    const res = await apiClient.post<DocumentUpdatePolicy>("/api/policies/update", policy);
    return res.data;
  },

  /**
   * Lấy danh sách quy tắc thay đổi mã nguồn (document_change_policies)
   */
  async getChangePolicies(repositoryId?: number, workspaceId?: number): Promise<DocumentChangePolicy[]> {
    const res = await apiClient.get<DocumentChangePolicy[]>("/api/policies/change", {
      params: { repositoryId, workspaceId },
    });
    return res.data;
  },

  /**
   * Thêm hoặc lưu quy tắc thay đổi module & threshold
   */
  async saveChangePolicy(policy: DocumentChangePolicy): Promise<DocumentChangePolicy> {
    const res = await apiClient.post<DocumentChangePolicy>("/api/policies/change", policy);
    return res.data;
  },

  /**
   * Xóa quy tắc thay đổi module theo ID
   */
  async deleteChangePolicy(policyId: number): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/api/policies/change/${policyId}`);
    return res.data;
  },

  /**
   * Chạy thử mô phỏng đánh giá luật thực tế (Policy Evaluation Sandbox)
   */
  async evaluatePolicy(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResponse> {
    const res = await apiClient.post<PolicyEvaluationResponse>("/api/policies/evaluate", request);
    return res.data;
  },
};
