import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

export const ACCESS_TOKEN_KEY = "livingdocs_access_token";
export const USER_PROFILE_KEY = "livingdocs_user";
export const ACCESS_TOKEN_COOKIE = "livingdocs_access_token";
export const LOGIN_PATH = "/login";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  headers: {
    Accept: "application/json",
  },
});

/**
 * Xóa toàn bộ dấu vết phiên đăng nhập phía client (localStorage + cookie).
 * Dùng chung cho interceptor 401 và nút "Đăng xuất" để luôn nhất quán.
 */
export function clearAuthStorage() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_PROFILE_KEY);
  // Xóa cookie token (ghi đè Max-Age=0) — đảm bảo không còn sót sau khi 401.
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

// ── Request interceptor: tự động gắn "Authorization: Bearer <token>" ──
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

// ── Response interceptor: bắt 401 → xóa token + chuyển về trang đăng nhập ──
let redirectingToLogin = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // Không xử lý nếu đang ở trang đăng nhập (để form báo "sai mật khẩu").
      if (window.location.pathname !== LOGIN_PATH) {
        clearAuthStorage();

        // Chống redirect lặp khi nhiều request đồng thời cùng trả 401.
        if (!redirectingToLogin) {
          redirectingToLogin = true;
          const next = window.location.pathname + window.location.search;
          window.location.assign(`${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
        }
      }
    }

    return Promise.reject(error);
  },
);
