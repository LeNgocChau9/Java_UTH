import { apiClient } from "./apiClient";

export interface DocTemplateDto {
  id: number;
  name: string;
  type: string;
  structureJson: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface MissingCodeEntityDto {
  entityId?: number;
  entityType: string;
  className: string;
  methodName?: string;
  filePath: string;
  signature?: string;
  suggestion: string;
  suggestedMarkdown: string;
}

export interface CrossCheckSuggestionDto {
  type: string;
  title: string;
  description: string;
  suggestedMarkdown: string;
}

export interface DocumentCrossCheckResponse {
  templateId?: number;
  templateName: string;
  templateValid: boolean;
  missingTemplateHeadings: string[];
  templateWarnings: string[];
  repositoryId?: number;
  totalCodeEntities: number;
  documentedCodeEntities: number;
  missingCodeEntitiesCount: number;
  coveragePercentage: number;
  missingCodeEntities: MissingCodeEntityDto[];
  suggestions: CrossCheckSuggestionDto[];
}

export interface DocumentCrossCheckPayload {
  templateId?: number;
  repositoryId: number;
  markdown: string;
  targetPath?: string;
}

export interface DriftAlertNotificationItem {
  alertId: number;
  repositoryId: number;
  documentId?: number;
  documentTitle?: string;
  severity: string;
  classification: string;
  status: string;
  sourceCommit?: string;
  sourcePrId?: number;
  details: string;
  createdAt: string;
  suggestionUrl: string;
}

export interface DriftAlertSummaryResponse {
  pendingCount: number;
  recentAlerts: DriftAlertNotificationItem[];
}

export interface TemplateVersionDto {
  versionId: number;
  templateId: number;
  versionNum: number;
  structureJson: string;
  rulesJson: string;
  createdBy?: number;
  createdAt: string;
}

export interface TemplatePreviewRequest {
  targetPath?: string;
  targetPackage?: string;
  targetClass?: string;
  targetMethods?: string[];
}

export interface TemplatePreviewResponse {
  templateId: number;
  templateName: string;
  templateType: string;
  markdown: string;
}

export const templateService = {
  async getTemplates(): Promise<DocTemplateDto[]> {
    const res = await apiClient.get<DocTemplateDto[]>("/api/templates");
    return res.data;
  },

  async getTemplateById(id: number): Promise<DocTemplateDto> {
    const res = await apiClient.get<DocTemplateDto>(`/api/templates/${id}`);
    return res.data;
  },

  async listVersions(templateId: number): Promise<TemplateVersionDto[]> {
    const res = await apiClient.get<TemplateVersionDto[]>(`/api/templates/${templateId}/versions`);
    return res.data;
  },

  async rollbackVersion(templateId: number, versionId: number): Promise<TemplateVersionDto> {
    const res = await apiClient.post<TemplateVersionDto>(`/api/templates/${templateId}/versions/${versionId}/rollback`);
    return res.data;
  },

  async previewTemplate(templateId: number, req: TemplatePreviewRequest): Promise<TemplatePreviewResponse> {
    const res = await apiClient.post<TemplatePreviewResponse>(`/api/templates/${templateId}/preview`, req);
    return res.data;
  },

  async crossCheck(payload: DocumentCrossCheckPayload): Promise<DocumentCrossCheckResponse> {
    const res = await apiClient.post<DocumentCrossCheckResponse>("/api/templates/cross-check", payload);
    return res.data;
  },

  async getDriftAlertSummary(repositoryId?: number): Promise<DriftAlertSummaryResponse> {
    const res = await apiClient.get<DriftAlertSummaryResponse>("/api/drift-alerts/summary", {
      params: repositoryId ? { repositoryId } : undefined,
    });
    return res.data;
  },
};
