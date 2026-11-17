import { apiClient } from "./apiClient";

export interface BackendHealthInfo {
  status: string;
  service: string;
  version: string;
  port: number;
  latencyMs: number;
}

export interface PostgresHealthInfo {
  status: string;
  latencyMs: number;
  pgvectorInstalled: boolean;
  pgvectorVersion: string | null;
  error: string | null;
}

export interface GitHubRateLimitHealthInfo {
  status: string;
  authenticated: boolean;
  latencyMs: number;
  limit: number | null;
  remaining: number | null;
  used: number | null;
  reset: number | null;
  resetAt: string | null;
  error: string | null;
}

export interface AiProviderDetail {
  available: boolean;
  type: string;
  models?: string[];
  base_url?: string;
  model?: string;
  device?: string;
}

export interface AiProvidersPayload {
  status: string;
  default_provider?: string;
  providers?: {
    gemini?: AiProviderDetail;
    ollama?: AiProviderDetail;
  };
}

export interface AiQuotaMetricsPayload {
  status: string;
  active_model: string;
  primary_model: string;
  fallback_model: string;
  max_rpm: number;
  current_rpm: number;
  total_requests: number;
  total_retries: number;
  total_model_failovers: number;
  total_key_rotations: number;
  quota_429_count: number;
  transient_503_count: number;
  last_error_time: number | null;
  last_error_message: string | null;
}

export interface AiEngineHealthInfo {
  status: string;
  url: string;
  latencyMs: number;
  message: string;
  error: string | null;
  providers: AiProvidersPayload | null;
  quotaMetrics: AiQuotaMetricsPayload | null;
}

export interface HealthAuditLogItem {
  logId: number;
  actorId: number | null;
  action: string | null;
  resourceType: string | null;
  resourceId: string | null;
  detail: string | null;
  createdAt: string | null;
}

export interface DetailedHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  backend: BackendHealthInfo;
  postgres: PostgresHealthInfo;
  github: GitHubRateLimitHealthInfo;
  aiEngine: AiEngineHealthInfo;
  recentAuditLogs: HealthAuditLogItem[];
}

export const healthService = {
  async getDetailedHealth(): Promise<DetailedHealthResponse> {
    const { data } = await apiClient.get<DetailedHealthResponse>("/api/health/detailed");
    return data;
  },
};
