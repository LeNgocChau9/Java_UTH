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
