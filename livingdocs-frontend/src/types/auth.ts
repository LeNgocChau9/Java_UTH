export type UserProfile = {
  userId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: string;
  roles: string[];
  githubUsername?: string | null;
  dateOfBirth?: string | null;
  bio?: string | null;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfile;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type ApiErrorBody = {
  message?: string;
  error?: string;
};

export type AdminUser = {
  userId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: string;
  roles: string[];
  createdAt: string;
};
