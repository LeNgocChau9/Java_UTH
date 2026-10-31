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
 * Dùng chung cho nút "Đăng xuất" để luôn nhất quán.
 */
export function clearAuthStorage() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_PROFILE_KEY);
  // Xóa cookie token (ghi đè Max-Age=0)
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

/** Lưu token mới vào localStorage và Cookie */
export function saveToken(token: string, expiresIn = 86400) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  const maxAge = expiresIn > 0 ? expiresIn : 86400;
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}

// ── Request interceptor: tự động gắn "Authorization: Bearer <token>" ──
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

// ── Biến cờ kiểm soát refresh token đồng thời & hàng đợi yêu cầu ──
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ── Response interceptor: Tự động gia hạn ngầm (Silent Refresh) khi gặp 401 ──
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Bỏ qua nếu lỗi không có config hoặc không phải 401 hoặc chạy trên SSR
    if (!originalRequest || error.response?.status !== 401 || typeof window === "undefined") {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || "";
    const responseData = error.response?.data as { message?: string; errorCode?: string } | undefined;
    const errorMessage = (responseData?.message || "").toLowerCase();

    // Nếu lỗi 401 đến từ GitHub API (token GitHub hết hạn/revoked), tuyệt đối KHÔNG xóa phiên đăng nhập LivingDocs
    const isGitHubTokenError =
      responseData?.errorCode === "GITHUB_TOKEN_EXPIRED" ||
      errorMessage.includes("github api") ||
      errorMessage.includes("bad credentials");

    if (isGitHubTokenError) {
      return Promise.reject(error);
    }

    // Bỏ qua các URL đăng nhập, làm mới token hoặc preview
    const isAuthRoute =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/register") ||
      requestUrl.includes("/api/auth/refresh") ||
      requestUrl.includes("/preview") ||
      window.location.pathname === LOGIN_PATH;

    if (isAuthRoute) {
      return Promise.reject(error);
    }

    // Nếu request này đã từng thử retry 1 lần mà vẫn 401 -> hiện modal gia hạn nhưng giữ nguyên token/profile để gia hạn hoặc cấp lại quyền GitHub
    if (originalRequest._retry) {
      window.dispatchEvent(new CustomEvent("livingdocs:session_expired"));
      return Promise.reject(error);
    }

    // Nếu đang có một tiến trình refresh token chạy ngầm -> cho request này vào hàng đợi
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const currentToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);

    // Nếu trên máy client chưa từng có token thì không cần refresh
    if (!currentToken) {
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      // Dùng instance axios độc lập (không qua interceptor) để gọi API refresh
      const refreshResponse = await axios.post<{
        token: string;
        expiresIn: number;
        user?: unknown;
      }>(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/auth/refresh`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            Accept: "application/json",
          },
        }
      );

      const newToken = refreshResponse.data.token;
      saveToken(newToken, refreshResponse.data.expiresIn);

      if (refreshResponse.data.user) {
        window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(refreshResponse.data.user));
      }

      // Thông báo cho tất cả request đang chờ
      processQueue(null, newToken);

      // Cập nhật token cho request hiện tại và gửi lại
      originalRequest.headers.set("Authorization", `Bearer ${newToken}`);
      return apiClient(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      // KHÔNG gọi clearAuthStorage() ở đây để giữ nguyên tài khoản đăng nhập cho nút "Gia hạn phiên & Cấp quyền"
      window.dispatchEvent(new CustomEvent("livingdocs:session_expired"));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
