import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

export const ACCESS_TOKEN_KEY = "livingdocs_access_token";
export const USER_PROFILE_KEY = "livingdocs_user";
export const ACCESS_TOKEN_COOKIE = "livingdocs_access_token";
export const ADMIN_ENTERPRISE_SCOPE_KEY = "livingdocs_admin_enterprise_scope";
export const LOGIN_PATH = "/login";

export const INACTIVE_ACCOUNT_REDIRECT: Record<string, string> = {
  ACCOUNT_PENDING: "/login?notice=account_pending",
  ACCOUNT_REJECTED: "/login?error=account_rejected",
  ACCOUNT_LOCKED: "/login?error=account_locked",
  ACCOUNT_DISABLED: "/login?error=account_locked",
};

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
  headers: {
    Accept: "application/json",
  },
});

/** Đọc phạm vi doanh nghiệp đang chọn (chỉ áp dụng cho ADMIN). */
export function getAdminEnterpriseScope(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ADMIN_ENTERPRISE_SCOPE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Lưu hoặc xóa phạm vi doanh nghiệp cho ADMIN (null = Tất cả doanh nghiệp). */
export function setAdminEnterpriseScope(enterpriseId: number | null) {
  if (typeof window === "undefined") return;
  if (enterpriseId && enterpriseId > 0) {
    window.localStorage.setItem(ADMIN_ENTERPRISE_SCOPE_KEY, String(enterpriseId));
  } else {
    window.localStorage.removeItem(ADMIN_ENTERPRISE_SCOPE_KEY);
  }
}

/** Xóa các khóa client gắn với tenant/repo khi đăng xuất hoặc chuyển tài khoản. */
export function clearTenantClientState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("livingdocs_selected_repo_id");
  window.localStorage.removeItem("selected_repository_id");
  window.localStorage.removeItem(ADMIN_ENTERPRISE_SCOPE_KEY);
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith("drift_alert_draft_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // ignore storage errors
  }
}

/**
 * Xóa toàn bộ dấu vết phiên đăng nhập phía client (localStorage + cookie).
 * Dùng chung cho nút "Đăng xuất" để luôn nhất quán.
 */
export function clearAuthStorage() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_PROFILE_KEY);
  clearTenantClientState();
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

// ── Request interceptor: tự động gắn "Authorization: Bearer <token>" & X-Enterprise-Id (ADMIN) ──
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  const adminScopeId = getAdminEnterpriseScope();
  if (adminScopeId && !config.headers.has("X-Enterprise-Id")) {
    try {
      const rawUser = window.localStorage.getItem(USER_PROFILE_KEY);
      if (rawUser) {
        const parsed = JSON.parse(rawUser) as { roles?: string[] };
        const isAdmin =
          Array.isArray(parsed.roles) &&
          parsed.roles.some((r) => r === "ADMIN" || r === "ROLE_ADMIN");
        if (isAdmin) {
          config.headers.set("X-Enterprise-Id", String(adminScopeId));
        }
      }
    } catch {
      // ignore malformed user profile JSON
    }
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

// ── Response interceptor: Xử lý tài khoản không hoạt động (401/403) & Tự động gia hạn ngầm (Silent Refresh) khi gặp 401 ──
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!originalRequest || typeof window === "undefined") {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const requestUrl = originalRequest.url || "";
    const responseData = error.response?.data as { message?: string; errorCode?: string } | undefined;
    const errorCode = responseData?.errorCode;

    // Nếu tài khoản bị khóa/từ chối/chờ duyệt khi đang có phiên -> xóa phiên và chuyển thẳng về /login
    const isPublicAuthAction =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/register") ||
      window.location.pathname === LOGIN_PATH;

    if (
      !isPublicAuthAction &&
      (status === 401 || status === 403) &&
      errorCode &&
      errorCode in INACTIVE_ACCOUNT_REDIRECT
    ) {
      clearAuthStorage();
      window.location.replace(INACTIVE_ACCOUNT_REDIRECT[errorCode]);
      return Promise.reject(error);
    }

    // Bỏ qua nếu không phải 401
    if (status !== 401) {
      return Promise.reject(error);
    }

    const errorMessage = (responseData?.message || "").toLowerCase();

    // Nếu lỗi 401 đến từ GitHub API (token GitHub hết hạn/revoked), tuyệt đối KHÔNG xóa phiên đăng nhập LivingDocs
    const isGitHubTokenError =
      errorCode === "GITHUB_TOKEN_EXPIRED" ||
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
      if (axios.isAxiosError(refreshErr)) {
        const refreshCode = (refreshErr.response?.data as { errorCode?: string } | undefined)?.errorCode;
        if (refreshCode && refreshCode in INACTIVE_ACCOUNT_REDIRECT) {
          clearAuthStorage();
          window.location.replace(INACTIVE_ACCOUNT_REDIRECT[refreshCode]);
          return Promise.reject(refreshErr);
        }
      }
      // KHÔNG gọi clearAuthStorage() ở đây để giữ nguyên tài khoản đăng nhập cho nút "Gia hạn phiên & Cấp quyền"
      window.dispatchEvent(new CustomEvent("livingdocs:session_expired"));
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
