import { apiClient, ACCESS_TOKEN_KEY } from "@/services/apiClient";
import type { AuthResponse, LoginRequest } from "@/types/auth";

export async function login(payload: LoginRequest) {
  const { data } = await apiClient.post<AuthResponse>(
    "/api/auth/login",
    payload,
  );

  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, data.token);
  }

  return data;
}

export function logout() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}
