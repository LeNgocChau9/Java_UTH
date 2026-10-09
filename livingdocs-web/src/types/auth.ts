export type UserProfile = {
  userId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  status: string;
  roles: string[];
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
