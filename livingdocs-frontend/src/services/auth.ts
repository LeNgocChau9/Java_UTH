import { ACCESS_TOKEN_KEY } from "@/services/apiClient";
import { clearSession } from "@/services/authService";
import type { UserProfile } from "@/types/auth";
import { USER_PROFILE_KEY } from "@/services/apiClient";

export { login } from "@/services/authService";

export function readProfile(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(USER_PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function logout() {
  clearSession();
}

export function hasToken() {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY));
}
