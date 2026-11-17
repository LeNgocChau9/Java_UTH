import { apiClient } from "./apiClient";

export type JobStatusType =
  | "QUEUED"
  | "PENDING"
  | "PROCESSING"
  | "RUNNING"
  | "COMPLETED"
  | "DONE"
  | "FAILED"
  | "DEAD"
  | string;

export interface JobProgressItem {
  jobId: number;
  type: string;
  status: JobStatusType;
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  nextRetryAt?: string | null;
  lockedAt?: string | null;
  payloadJson?: string | null;
  resultJson?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deadLetter?: boolean;
  isDeadLetter?: boolean;
}

export interface JobSseProgressEvent {
  jobId: number;
  state:
    | "QUEUED"
    | "FETCHING_REPO"
    | "EXTRACTING_AST"
    | "RAG_CONTEXT"
    | "LLM_GENERATING"
    | "RETRY_SCHEDULED"
    | "RETRYING"
    | "COMPLETED"
    | "FAILED"
    | string;
  progress: number;
  message: string;
  payload?: unknown;
}

export const jobService = {
  async listJobs(status?: string, limit = 50): Promise<JobProgressItem[]> {
    const res = await apiClient.get<JobProgressItem[]>("/api/jobs", {
      params: status ? { status, limit } : { limit },
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  async getDeadLetterJobs(limit = 50): Promise<JobProgressItem[]> {
    const res = await apiClient.get<JobProgressItem[]>("/api/jobs/dlq", {
      params: { limit },
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  async getJobById(jobId: number): Promise<JobProgressItem> {
    const res = await apiClient.get<JobProgressItem>(`/api/jobs/${jobId}`);
    return res.data;
  },

  async retryDeadLetterJob(jobId: number): Promise<JobProgressItem> {
    const res = await apiClient.post<JobProgressItem>(`/api/jobs/dlq/${jobId}/retry`);
    return res.data;
  },

  async retryJob(jobId: number): Promise<JobProgressItem> {
    const res = await apiClient.post<JobProgressItem>(`/api/jobs/${jobId}/retry`);
    return res.data;
  },
};
