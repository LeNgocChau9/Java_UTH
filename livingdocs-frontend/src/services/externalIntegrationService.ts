import { apiClient } from "@/services/apiClient";

export type ExternalProvider = "SLACK" | "DISCORD" | "CUSTOM_WEBHOOK" | "CONFLUENCE" | "NOTION" | string;

export type WebhookEventKey =
  | "DRIFT_HIGH_CRITICAL"
  | "REVIEW_SUBMITTED"
  | "DOCUMENT_PUBLISHED";

export interface ExternalIntegrationConfig {
  integrationId?: number | null;
  provider: ExternalProvider;
  workspaceId?: number;
  enabled: boolean;
  webhookUrl: string;
  channelName?: string;
  apiBaseUrl?: string;
  secret?: string;
  apiToken?: string;
  secretConfigured: boolean;
  events: string[];
  extraConfig?: Record<string, unknown>;
  updatedBy?: number | null;
  updatedAt?: string | null;
}

export interface UpdateExternalIntegrationPayload {
  workspaceId?: number;
  enabled?: boolean;
  webhookUrl?: string;
  channelName?: string;
  apiBaseUrl?: string;
  secret?: string;
  apiToken?: string;
  events?: string[];
  extraConfig?: Record<string, unknown>;
}

export interface TestExternalIntegrationPayload {
  provider: ExternalProvider;
  workspaceId?: number;
  webhookUrl?: string;
  secret?: string;
  message?: string;
}

export interface TestExternalIntegrationResponse {
  success: boolean;
  provider: string;
  statusCode: number;
  responseBody?: string;
  latencyMs: number;
  message: string;
}

export interface UserNotificationPreferences {
  userId?: number;
  emailEnabled: boolean;
  reviewEnabled: boolean;
  driftAlertEnabled: boolean;
  documentEnabled?: boolean;
  githubTokenIssueEnabled: boolean;
  githubEnabled?: boolean;
  updatedAt?: string | null;
}

export const externalIntegrationService = {
  async listIntegrations(workspaceId?: number): Promise<ExternalIntegrationConfig[]> {
    const res = await apiClient.get<ExternalIntegrationConfig[]>("/api/external-integrations", {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return res.data;
  },

  async getIntegration(provider: ExternalProvider, workspaceId?: number): Promise<ExternalIntegrationConfig> {
    const res = await apiClient.get<ExternalIntegrationConfig>(`/api/external-integrations/${provider}`, {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return res.data;
  },

  async updateIntegration(
    provider: ExternalProvider,
    payload: UpdateExternalIntegrationPayload,
    workspaceId?: number
  ): Promise<ExternalIntegrationConfig> {
    const res = await apiClient.put<ExternalIntegrationConfig>(
      `/api/external-integrations/${provider}`,
      payload,
      { params: workspaceId ? { workspaceId } : undefined }
    );
    return res.data;
  },

  async testConnection(
    payload: TestExternalIntegrationPayload,
    workspaceId?: number
  ): Promise<TestExternalIntegrationResponse> {
    const res = await apiClient.post<TestExternalIntegrationResponse>(
      "/api/external-integrations/test",
      payload,
      { params: workspaceId ? { workspaceId } : undefined }
    );
    return res.data;
  },

  async getNotificationPreferences(): Promise<UserNotificationPreferences> {
    const res = await apiClient.get<UserNotificationPreferences>("/api/me/notification-preferences");
    return res.data;
  },

  async updateNotificationPreferences(
    payload: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    const res = await apiClient.put<UserNotificationPreferences>("/api/me/notification-preferences", {
      emailEnabled: payload.emailEnabled,
      reviewEnabled: payload.reviewEnabled,
      driftAlertEnabled: payload.driftAlertEnabled,
      documentEnabled: payload.driftAlertEnabled,
      githubTokenIssueEnabled: payload.githubTokenIssueEnabled,
      githubEnabled: payload.githubTokenIssueEnabled,
    });
    return res.data;
  },
};
