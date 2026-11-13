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

export const templateService = {
  async getTemplates(): Promise<DocTemplateDto[]> {
    const res = await apiClient.get<DocTemplateDto[]>("/api/templates");
    return res.data;
  },

  async getTemplateById(id: number): Promise<DocTemplateDto> {
    const res = await apiClient.get<DocTemplateDto>(`/api/templates/${id}`);
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
