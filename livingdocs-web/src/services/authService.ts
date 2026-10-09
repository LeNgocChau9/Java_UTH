import { apiClient, ACCESS_TOKEN_KEY, USER_PROFILE_KEY } from "@/services/apiClient";
import type { AuthResponse, LoginRequest } from "@/types/auth";

const TOKEN_COOKIE = "livingdocs_access_token";

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
  document.cookie = `${TOKEN_COOKIE}=${data.token}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_PROFILE_KEY);
  document.cookie = `${TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}
