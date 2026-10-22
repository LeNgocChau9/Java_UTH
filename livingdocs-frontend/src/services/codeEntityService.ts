import { apiClient } from "./apiClient";

export interface CodeEntityDto {
  entityId?: number;
  repositoryId: number;
  filePath: string;
  entityType: "CLASS" | "INTERFACE" | "ENUM" | "RECORD" | "METHOD" | "CONSTRUCTOR" | string;
  className?: string;
  methodName?: string;
  signature: string;
  returnType?: string;
  parameters?: string;
  startLine: number;
  endLine: number;
  commitHash?: string;
  docStatus: "DOCUMENTED" | "UNDOCUMENTED" | "DRIFTED" | string;
  javadoc?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IndexFilePayload {
  repositoryId: number;
  filePath: string;
  sourceCode: string;
  commitHash?: string;
}

export interface AstExtractResponseDto {
  status: string;
  mode: string;
  file_path: string;
  commit_hash: string;
  total_entities: number;
  entities: {
    entity_type: string;
    class_name?: string;
    method_name?: string;
    signature: string;
    return_type?: string;
    parameters?: string;
    start_line: number;
    end_line: number;
    doc_status: string;
    javadoc?: string;
  }[];
}

export const codeEntityService = {
  /**
   * Lấy danh sách entities theo repository ID
   */
  async getByRepository(repositoryId: number): Promise<CodeEntityDto[]> {
    const res = await apiClient.get<CodeEntityDto[]>(
      `/api/v1/code-entities/repository/${repositoryId}`
    );
    return res.data;
  },

  /**
   * Lấy danh sách entities của một file cụ thể trong repository
   */
  async getByFile(repositoryId: number, filePath: string): Promise<CodeEntityDto[]> {
    const res = await apiClient.get<CodeEntityDto[]>(
      `/api/v1/code-entities/repository/${repositoryId}/file`,
      {
        params: { filePath },
      }
    );
    return res.data;
  },

  /**
   * Lập chỉ mục file Java: Gửi code sang FastAPI bóc tách và lưu vào CSDL
   */
  async indexFile(payload: IndexFilePayload): Promise<CodeEntityDto[]> {
    const res = await apiClient.post<CodeEntityDto[]>(
      "/api/v1/code-entities/index",
      payload
    );
    return res.data;
  },

  /**
   * Xem trước bóc tách AST mà không lưu vào CSDL
   */
  async previewExtract(payload: IndexFilePayload): Promise<AstExtractResponseDto> {
    const res = await apiClient.post<AstExtractResponseDto>(
      "/api/v1/code-entities/extract-preview",
      payload
    );
    return res.data;
  },
};
