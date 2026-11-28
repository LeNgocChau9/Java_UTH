export type UserStatus = "PENDING" | "ACTIVE" | "REJECTED" | "LOCKED";

export type UserProfile = {
  userId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: UserStatus | string;
  roles: string[];
  enterpriseId?: number | null;
  enterpriseName?: string | null;
  workspaceId?: number | null;
  githubUsername?: string | null;
  dateOfBirth?: string | null;
  bio?: string | null;
  createdAt: string;
};

export type AuthResponse = {
  token: string | null;
  tokenType: string | null;
  expiresIn: number | null;
  pendingApproval?: boolean;
  message?: string | null;
  user: UserProfile;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ApiErrorBody = {
  status?: number;
  message?: string;
  error?: string;
  errorCode?: string;
  timestamp?: string;
};

export type AdminUser = {
  userId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: UserStatus | string;
  roles: string[];
  enterpriseId?: number | null;
  enterpriseName?: string | null;
  githubUsername?: string | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  createdAt: string;
};

export type EnterpriseItem = {
  enterpriseId: number;
  name: string;
  slug: string;
  userCount: number;
  repositoryCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};
