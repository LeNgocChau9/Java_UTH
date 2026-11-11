import { apiClient } from "./apiClient";

export interface RepoItem {
  repositoryId: number;
  workspaceId: number;
  connectionId: number;
  githubRepoId: number;
  repoName: string;
  repoFullName: string;
  defaultBranch: string;
  cloneUrl?: string;
  isActive: boolean;
  autoDocEnabled: boolean;
  lastSyncedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tokenStatus?: "CONNECTED" | "EXPIRED" | "REVOKED" | "DISCONNECTED" | string;
  tokenValid?: boolean;
  tokenWarningMessage?: string | null;
}

export interface GitHubConnectionStatusItem {
  connectionId: number;
  workspaceId: number;
  userId: number;
  githubUsername: string;
  status: "CONNECTED" | "EXPIRED" | "REVOKED" | string;
  valid: boolean;
  tokenScope?: string;
  tokenExpiresAt?: string;
  lastCheckedAt?: string;
  warningMessage?: string;
  renewUrl?: string;
}

export interface PullRequestItem {
  prId: number;
  repositoryId: number;
  githubPrId: number;
  prNumber: number;
  title: string;
  headBranch: string;
  baseBranch: string;
  headCommitHash?: string;
  baseCommitHash?: string;
  state: "OPEN" | "CLOSED" | "MERGED" | string;
  authorUsername?: string;
  githubCreatedAt?: string;
  githubUpdatedAt?: string;
  githubClosedAt?: string;
}

export interface CommitItem {
  commitId: number;
  repositoryId: number;
  commitHash: string;
  authorName: string;
  authorEmail?: string;
  commitMessage: string;
  committedAt: string;
  prId?: number;
}

export interface CreateRepoPayload {
  workspaceId?: number;
  repoFullName: string;
  repoName?: string;
  defaultBranch?: string;
  githubToken?: string;
}

export interface GitHubFileItem {
  path: string;
  mode?: string;
  type: string; // "blob" hoặc "tree"
  sha?: string;
  size?: number;
  url?: string;
}

export interface SyncResult {
  repositoryId: number;
  repoFullName: string;
  syncedPullRequestsCount: number;
  syncedCommitsCount: number;
  syncedAt: string;
  message: string;
}

export const repoService = {
  async getRepositories(workspaceId?: number): Promise<RepoItem[]> {
    const res = await apiClient.get<RepoItem[]>("/api/repos", {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return res.data;
  },

  async getRepositoryById(id: number): Promise<RepoItem> {
    const res = await apiClient.get<RepoItem>(`/api/repos/${id}`);
    return res.data;
  },

  async addRepository(payload: CreateRepoPayload): Promise<RepoItem> {
    const res = await apiClient.post<RepoItem>("/api/repos", payload);
    return res.data;
  },

  async syncRepository(id: number, token?: string): Promise<SyncResult> {
    const res = await apiClient.post<SyncResult>(`/api/repos/${id}/sync`, null, {
      params: token ? { token } : undefined,
    });
    return res.data;
  },

  async getRepoPullRequests(id: number): Promise<PullRequestItem[]> {
    const res = await apiClient.get<PullRequestItem[]>(`/api/repos/${id}/pulls`);
    return res.data;
  },

  async getRepoCommits(id: number): Promise<CommitItem[]> {
    const res = await apiClient.get<CommitItem[]>(`/api/repos/${id}/commits`);
    return res.data;
  },

  async getRepositoryTree(id: number, sha?: string): Promise<GitHubFileItem[]> {
    const res = await apiClient.get<GitHubFileItem[]>(`/api/repos/${id}/tree`, {
      params: sha ? { sha } : undefined,
    });
    return res.data;
  },

  async getFileContent(id: number, path: string, branch?: string): Promise<{ filePath: string; content: string }> {
    const res = await apiClient.get<{ filePath: string; content: string }>(`/api/repos/${id}/file-content`, {
      params: { path, branch },
    });
    return res.data;
  },

  async getConnections(workspaceId?: number): Promise<GitHubConnectionStatusItem[]> {
    const res = await apiClient.get<GitHubConnectionStatusItem[]>("/api/repos/connections", {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return res.data;
  },

  async verifyConnection(connectionId: number): Promise<GitHubConnectionStatusItem> {
    const res = await apiClient.post<GitHubConnectionStatusItem>(`/api/repos/connections/${connectionId}/verify`);
    return res.data;
  },

  async verifyAllConnections(workspaceId?: number): Promise<GitHubConnectionStatusItem[]> {
    const res = await apiClient.post<GitHubConnectionStatusItem[]>("/api/repos/connections/verify-all", null, {
      params: workspaceId ? { workspaceId } : undefined,
    });
    return res.data;
  },
};
