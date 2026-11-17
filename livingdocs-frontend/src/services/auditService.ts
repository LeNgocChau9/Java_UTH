import { apiClient } from "./apiClient";

export interface AuditLogItem {
  logId: number;
  actorId: number | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditRetentionConfig {
  retentionDays: number;
  autoCleanupEnabled: boolean;
  cleanupCron?: string;
  lastCleanupAt?: string | null;
  lastCleanupStatus?: string | null;
  lastAuditLogsDeleted?: number | null;
  lastChangelogsDeleted?: number | null;
  updatedBy?: number | null;
  updatedAt?: string | null;
}

export interface AuditCleanupResult {
  auditLogsDeleted: number;
  changelogsDeleted: number;
  cutoffTime: string;
  retentionDaysApplied: number;
  executedAt?: string | null;
  triggerMethod: string;
  message: string;
}

export async function getAuditLogs(params: {
  action?: string;
  from?: string;
  to?: string;
}): Promise<AuditLogItem[]> {
  const { data } = await apiClient.get<AuditLogItem[]>("/api/audit-logs", {
    params: {
      action: params.action || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    },
  });
  return data;
}

export async function getRetentionConfig(): Promise<AuditRetentionConfig> {
  const { data } = await apiClient.get<AuditRetentionConfig>("/api/audit-logs/retention/config");
  return data;
}

export async function updateRetentionConfig(
  payload: Pick<AuditRetentionConfig, "retentionDays" | "autoCleanupEnabled"> & { cleanupCron?: string }
): Promise<AuditRetentionConfig> {
  const { data } = await apiClient.put<AuditRetentionConfig>("/api/audit-logs/retention/config", payload);
  return data;
}

export async function triggerManualCleanup(retentionDays?: number): Promise<AuditCleanupResult> {
  const { data } = await apiClient.post<AuditCleanupResult>("/api/audit-logs/cleanup", null, {
    params: retentionDays ? { retentionDays } : undefined,
  });
  return data;
}
