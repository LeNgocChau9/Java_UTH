import { apiClient } from "./apiClient";
import type { DocumentTemplate, DocumentTemplateSection, TemplateVersionItem } from "@/types/template";

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

export interface TemplateValidationDto {
  templateId: number;
  valid: boolean;
  warning: boolean;
  missingHeadings: string[];
  warnings: string[];
}

export interface SaveTemplateInput {
  name: string;
  type: string;
  description?: string;
  sections: DocumentTemplateSection[];
  isDefault?: boolean;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export function normalizeTemplateType(type: string): string {
  const clean = type.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  return clean || "TEMPLATE";
}

export function structureJsonFrom(description: string, sections: DocumentTemplateSection[]): string {
  return JSON.stringify({
    description: description ?? "",
    sections: sections.map((section, index) => ({
      key: section.key || section.id || `section-${index + 1}`,
      title: section.title,
      description: section.description ?? "",
      contentPlaceholder: section.contentPlaceholder ?? "",
      required: section.required !== false,
    })),
  });
}

function readStructure(structureJson: string | null | undefined): {
  description: string;
  sections: DocumentTemplateSection[];
} {
  try {
    const parsed = JSON.parse(structureJson || "{}") as {
      description?: string;
      sections?: Array<Partial<DocumentTemplateSection> & { title?: string }>;
    };
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
          .filter((section) => section && typeof section.title === "string" && section.title.trim())
          .map((section, index) => ({
            id: section.id || section.key || `section-${index + 1}`,
            key: section.key || section.id || `section-${index + 1}`,
            title: section.title!.trim(),
            description: section.description ?? "",
            contentPlaceholder: section.contentPlaceholder ?? "",
            required: section.required !== false,
          }))
      : [];
    return { description: parsed.description ?? "", sections };
  } catch {
    return { description: "", sections: [] };
  }
}

function readChangeNote(rulesJson: string | null | undefined): string {
  try {
    const parsed = JSON.parse(rulesJson || "{}") as { changeNote?: string };
    return parsed.changeNote ?? "";
  } catch {
    return "";
  }
}

export function toDocumentTemplate(dto: DocTemplateDto, versions: TemplateVersionDto[] = []): DocumentTemplate {
  const current = readStructure(dto.structureJson);
  const history: TemplateVersionItem[] = versions.map((version, index) => {
    const stored = readStructure(version.structureJson);
    return {
      versionId: version.versionId,
      versionNum: version.versionNum,
      createdAt: version.createdAt,
      createdBy: version.createdBy != null ? `Người dùng #${version.createdBy}` : "Hệ thống",
      changeNote: readChangeNote(version.rulesJson),
      sectionsCount: stored.sections.length,
      sections: stored.sections,
      isCurrent: index === 0,
    };
  });
  return {
    id: String(dto.id),
    name: dto.name,
    type: dto.type,
    description: current.description || dto.type,
    status: dto.isDefault ? "PUBLISHED" : "DRAFT",
    currentVersion: history[0]?.versionNum ?? 1,
    createdAt: dto.createdAt ?? new Date().toISOString(),
    documentCount: 0,
    sections: current.sections,
    versionHistory: history,
  };
}

export const templateService = {
  async getTemplates(): Promise<DocTemplateDto[]> {
    const res = await apiClient.get<DocTemplateDto[]>("/api/templates");
    return res.data;
  },

  async listLibrary(): Promise<DocumentTemplate[]> {
    const templates = await this.getTemplates();
    const detailed = await Promise.all(
      templates.map(async (template) => {
        const versions = await this.listVersions(template.id).catch(() => [] as TemplateVersionDto[]);
        return toDocumentTemplate(template, versions);
      }),
    );
    return detailed;
  },

  async loadLibraryItem(id: number): Promise<DocumentTemplate> {
    const [template, versions] = await Promise.all([
      this.getTemplateById(id),
      this.listVersions(id),
    ]);
    return toDocumentTemplate(template, versions);
  },

  async createTemplate(input: SaveTemplateInput): Promise<DocTemplateDto> {
    try {
      const res = await apiClient.post<DocTemplateDto>("/api/templates", {
        name: input.name.trim(),
        type: normalizeTemplateType(input.type),
        structureJson: structureJsonFrom(input.description ?? "", input.sections),
        isDefault: Boolean(input.isDefault),
      });
      return res.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Không tạo được mẫu tài liệu."));
    }
  },

  async updateTemplate(id: number, input: SaveTemplateInput): Promise<DocTemplateDto> {
    try {
      const res = await apiClient.put<DocTemplateDto>(`/api/templates/${id}`, {
        name: input.name.trim(),
        type: normalizeTemplateType(input.type),
        structureJson: structureJsonFrom(input.description ?? "", input.sections),
        isDefault: Boolean(input.isDefault),
      });
      return res.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Không cập nhật được mẫu tài liệu."));
    }
  },

  async deleteTemplate(id: number): Promise<void> {
    try {
      await apiClient.delete(`/api/templates/${id}`);
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Không xóa được mẫu tài liệu."));
    }
  },

  async saveVersion(
    templateId: number,
    input: SaveTemplateInput & { changeNote?: string; createdBy?: number },
  ): Promise<TemplateVersionDto> {
    try {
      const res = await apiClient.post<TemplateVersionDto>(`/api/templates/${templateId}/versions`, {
        structureJson: structureJsonFrom(input.description ?? "", input.sections),
        rulesJson: JSON.stringify({ changeNote: input.changeNote ?? "" }),
        createdBy: input.createdBy,
      });
      return res.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Không lưu được phiên bản mẫu."));
    }
  },

  async validateTemplate(id: number, markdown: string): Promise<TemplateValidationDto> {
    try {
      const res = await apiClient.post<TemplateValidationDto>(`/api/templates/${id}/validate`, { markdown });
      return res.data;
    } catch (error) {
      throw new Error(apiErrorMessage(error, "Không kiểm tra được mẫu tài liệu."));
    }
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
