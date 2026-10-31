import { apiClient, ACCESS_TOKEN_KEY, USER_PROFILE_KEY, ACCESS_TOKEN_COOKIE, clearAuthStorage } from "@/services/apiClient";
import type { AuthResponse, LoginRequest, UserProfile } from "@/types/auth";

export const SAVED_ACCOUNTS_KEY = "livingdocs_saved_accounts";

export interface SavedAccountEntry {
  token: string;
  user: UserProfile;
  lastUsedAt: number;
}

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

/** Lưu thông tin hồ sơ người dùng vào localStorage và đồng bộ vào danh sách chuyển nhanh tài khoản. */
export function saveProfile(user: UserProfile) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
  const currentToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (currentToken && user) {
    upsertSavedAccount(currentToken, user);
  }
}

export function saveSession(data: AuthResponse) {
  saveToken(data.token, data.expiresIn);
  saveProfile(data.user);
}

/** Đọc danh sách các tài khoản đã từng đăng nhập trên trình duyệt này */
export function getSavedAccounts(): SavedAccountEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ACCOUNTS_KEY);
    const list: SavedAccountEntry[] = raw ? JSON.parse(raw) : [];
    const currentToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const currentUserRaw = window.localStorage.getItem(USER_PROFILE_KEY);
    if (currentToken && currentUserRaw) {
      const currentUser = JSON.parse(currentUserRaw) as UserProfile;
      const exists = list.some(
        (item) =>
          item.user?.userId === currentUser?.userId ||
          item.user?.email?.toLowerCase() === currentUser?.email?.toLowerCase()
      );
      if (!exists && currentUser?.email) {
        list.unshift({ token: currentToken, user: currentUser, lastUsedAt: Date.now() });
        window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(list));
      }
    }
    return list.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch {
    return [];
  }
}

/** Thêm hoặc cập nhật tài khoản vào danh sách lưu trữ để chuyển nhanh */
export function upsertSavedAccount(token: string, user: UserProfile) {
  if (typeof window === "undefined" || !token || !user?.email) return;
  try {
    const raw = window.localStorage.getItem(SAVED_ACCOUNTS_KEY);
    const list: SavedAccountEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(
      (item) =>
        item.user?.userId !== user.userId &&
        item.user?.email?.toLowerCase() !== user.email.toLowerCase()
    );
    filtered.unshift({
      token,
      user,
      lastUsedAt: Date.now(),
    });
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered.slice(0, 10)));
  } catch {
    // ignore storage errors
  }
}

/** Xóa 1 tài khoản khỏi danh sách lưu nhanh */
export function removeSavedAccount(emailOrUserId: string | number) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(SAVED_ACCOUNTS_KEY);
    const list: SavedAccountEntry[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(
      (item) =>
        item.user?.userId !== emailOrUserId &&
        item.user?.email?.toLowerCase() !== String(emailOrUserId).toLowerCase()
    );
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

/** Chuyển ngay lập tức sang một tài khoản đã lưu mà không cần đăng xuất */
export function switchToSavedAccount(entry: SavedAccountEntry) {
  saveToken(entry.token, 604800);
  saveProfile(entry.user);
}

export async function refreshSession(): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/api/auth/refresh");
  saveSession(data);
  return data;
}

export async function updateCurrentUserProfile(payload: {
  fullName?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  bio?: string;
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
