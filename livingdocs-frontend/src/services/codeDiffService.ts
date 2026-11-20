import { apiClient } from "./apiClient";

export interface FileDiffItem {
  file_path: string;
  base_code?: string;
  head_code?: string;
}

export interface AstDiffRequest {
  repository_id: number;
  pr_number: number;
  base_commit_hash?: string;
  head_commit_hash?: string;
  files: FileDiffItem[];
}

export interface AffectedEntityItem {
  entity_type: string;
  class_name: string;
  method_name: string;
  change_type: string;
  impact_level: string;
  old_signature?: string;
  new_signature?: string;
  start_line?: number;
  end_line?: number;
  details?: string;
}

export interface FileDiffResult {
  file_path: string;
  file_status: string;
  class_name: string;
  total_affected: number;
  affected_entities: AffectedEntityItem[];
}

export interface AstDiffResponse {
  status: string;
  repository_id: number;
  pr_number: number;
  base_commit_hash?: string;
  head_commit_hash?: string;
  total_files_analyzed: number;
  total_affected_entities: number;
  files: FileDiffResult[];
}

export interface AffectedDocumentResult {
  documentId: number;
  documentTitle: string;
  documentPath: string;
  relatedFilePath: string;
  className: string;
  methodName: string;
  changeType: string;
  severity: string;
  details: string;
  startLine?: number;
  endLine?: number;
}

export interface PrCheckRunResult {
  checkRunId?: number;
  status: string;
  conclusion?: string;
  detailsUrl?: string;
  summary?: string;
  htmlUrl?: string;
}

export const codeDiffService = {
  /**
   * Kéo Git Diff thời gian thực từ GitHub API cho PR (lấy danh sách file và code Base/Head)
   */
  async pullDiff(repositoryId: number, prNumber: number): Promise<AstDiffRequest> {
    const res = await apiClient.get<AstDiffRequest>(
      `/api/code-diff/repositories/${repositoryId}/pull-requests/${prNumber}/pull-diff`
    );
    return res.data;
  },

  /**
   * Tự động kéo Git Diff từ GitHub và gửi sang AI Engine /v1/ast/diff để bóc tách các hàm bị thay đổi
   */
  async pullAndAnalyze(repositoryId: number, prNumber: number): Promise<AstDiffResponse> {
    const res = await apiClient.post<AstDiffResponse>(
      `/api/code-diff/repositories/${repositoryId}/pull-requests/${prNumber}/pull-and-analyze`
    );
    return res.data;
  },

  /**
   * Xem trước định dạng Markdown comment review chuyên nghiệp sẽ đăng lên PR GitHub
   */
  async previewComment(repositoryId: number, prNumber: number): Promise<string> {
    const res = await apiClient.post<string>(
      `/api/code-diff/repositories/${repositoryId}/pull-requests/${prNumber}/preview-comment`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "text/plain",
        },
        responseType: "text" as any,
      }
    );
    return res.data;
  },

  /**
   * Đăng hoặc cập nhật comment/review cảnh báo sai lệch tài liệu lên Pull Request trên GitHub
   */
  async postDriftComment(repositoryId: number, prNumber: number): Promise<any> {
    const res = await apiClient.post(
      `/api/code-diff/repositories/${repositoryId}/pull-requests/${prNumber}/drift-comment`,
      {},
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    return res.data;
  },

  /**
   * Quy trình hoàn chỉnh: Tự động kéo Diff, đối chiếu AST và trả về danh sách tài liệu bị ảnh hưởng
   */
  async getAffectedDocuments(repositoryId: number, prNumber: number): Promise<AffectedDocumentResult[]> {
    const res = await apiClient.get<AffectedDocumentResult[]>(
      `/api/code-diff/repositories/${repositoryId}/pull-requests/${prNumber}/affected-documents`
    );
    return res.data;
  },

  /**
   * Kích hoạt đánh giá lại trạng thái Checks API và gửi kết quả lên GitHub PR (Chặn PR Gate)
   */
  async evaluatePrBlocking(
    repositoryId: number,
    prNumber: number,
    headSha?: string
  ): Promise<PrCheckRunResult> {
    const url = `/api/v1/settings/pr-blocking/evaluate/${repositoryId}/${prNumber}${
      headSha ? `?headSha=${encodeURIComponent(headSha)}` : ""
    }`;
    const res = await apiClient.post<PrCheckRunResult>(url);
    return res.data;
  },

  /**
   * Lấy danh sách cảnh báo trôi dạt tài liệu theo Kho lưu trữ
   */
  async getAlertsByRepo(repositoryId: number): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/api/code-diff/repositories/${repositoryId}/alerts`);
    return res.data;
  },

  /**
   * Lấy danh sách cảnh báo trôi dạt tài liệu theo Pull Request ID
   */
  async getAlertsByPr(prId: number): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/api/code-diff/pull-requests/${prId}/alerts`);
    return res.data;
  },
};
