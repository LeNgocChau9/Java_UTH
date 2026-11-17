import { apiClient } from "./apiClient";

export interface CiTokenItem {
  tokenId: number;
  tokenName: string;
  tokenPrefix: string;
  createdByUserId?: number | null;
  createdByUserName?: string | null;
  repositoryId?: number | null;
  repositoryName?: string | null;
  description?: string | null;
  revoked?: boolean;
  isRevoked?: boolean;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string | null;
}

export interface CreateCiTokenPayload {
  tokenName: string;
  repositoryId?: number | null;
  description?: string;
  expiresInDays?: number | null;
}

export interface CreatedCiTokenItem {
  tokenId: number;
  tokenName: string;
  token: string;
  tokenPrefix: string;
  repositoryId?: number | null;
  expiresAt?: string | null;
  createdAt?: string | null;
  message?: string;
}

export const ciTokenService = {
  async getAllTokens(): Promise<CiTokenItem[]> {
    const res = await apiClient.get<CiTokenItem[]>("/api/ci-tokens");
    return Array.isArray(res.data) ? res.data : [];
  },

  async getTokensByRepository(repositoryId: number): Promise<CiTokenItem[]> {
    const res = await apiClient.get<CiTokenItem[]>(`/api/ci-tokens/repo/${repositoryId}`);
    return Array.isArray(res.data) ? res.data : [];
  },

  async createToken(payload: CreateCiTokenPayload): Promise<CreatedCiTokenItem> {
    const res = await apiClient.post<CreatedCiTokenItem>("/api/ci-tokens", payload);
    return res.data;
  },

  async revokeToken(tokenId: number): Promise<void> {
    await apiClient.delete(`/api/ci-tokens/${tokenId}`);
  },
};
