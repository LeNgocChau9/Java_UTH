import { apiClient, ACCESS_TOKEN_KEY, USER_PROFILE_KEY, ACCESS_TOKEN_COOKIE, clearAuthStorage } from "@/services/apiClient";
import type { AuthResponse, LoginRequest, UserProfile } from "@/types/auth";

export async function login(payload: LoginRequest) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/login", payload);
  saveSession(data);
  return data;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  avatarUrl?: string;
}

export async function register(payload: RegisterRequest) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/register", payload);
  saveSession(data);
  return data;
}

/** Lưu token vào localStorage + cookie (dùng cho cả đăng nhập email và GitHub OAuth). */
export function saveToken(token: string, expiresIn = 86400) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  const maxAge = expiresIn > 0 ? expiresIn : 86400;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Lưu thông tin hồ sơ người dùng vào localStorage. */
export function saveProfile(user: UserProfile) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
}

export function saveSession(data: AuthResponse) {
  saveToken(data.token, data.expiresIn);
  saveProfile(data.user);
}

export async function refreshSession(): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/refresh");
  saveSession(data);
  return data;
}

export async function updateCurrentUserProfile(payload: {
  fullName?: string;
  avatarUrl?: string;
  newPassword?: string;
  oldPassword?: string;
}): Promise<UserProfile> {
  const { data } = await apiClient.put<UserProfile>("/api/me", payload);
  saveProfile(data);
  return data;
}

export function clearSession() {
  clearAuthStorage();
}
