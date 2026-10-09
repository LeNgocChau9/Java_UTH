import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

export const ACCESS_TOKEN_KEY = "livingdocs_access_token";
export const LOGIN_PATH = "/login";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  headers: {
    Accept: "application/json",
  },
});

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

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);

      if (window.location.pathname !== LOGIN_PATH) {
        const next = window.location.pathname + window.location.search;
        const target = `${LOGIN_PATH}?next=${encodeURIComponent(next)}`;
        window.location.assign(target);
      }
    }

    return Promise.reject(error);
  },
);
