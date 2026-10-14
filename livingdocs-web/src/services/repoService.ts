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
};
