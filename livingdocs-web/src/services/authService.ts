import { apiClient, ACCESS_TOKEN_KEY, USER_PROFILE_KEY, ACCESS_TOKEN_COOKIE, clearAuthStorage } from "@/services/apiClient";
import type { AuthResponse, LoginRequest } from "@/types/auth";

export async function login(payload: LoginRequest) {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/login", payload);
  saveSession(data);
  return data;
}

export function saveSession(data: AuthResponse) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, data.token);
  window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(data.user));

  const maxAge = data.expiresIn > 0 ? data.expiresIn : 86400;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${data.token}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSession() {
  clearAuthStorage();
}
