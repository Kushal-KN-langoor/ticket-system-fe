import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { store } from "@/lib/redux/store";
import { logout, setCredentials } from "@/lib/redux/slices/authSlice";

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, user } = store.getState().auth;

  if (!refreshToken) return null;

  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-refresh-token": refreshToken,
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data?.accessToken) return null;

  store.dispatch(
    setCredentials({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      user: data.user || user!,
    })
  );

  return data.accessToken;
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;

  if (token) {
    config.headers.set("x-auth-token", token);
  }

  if (config.url?.startsWith("/api/")) {
    config.url = config.url.replace(/^\/api/, "");
  }

  // FormData (file uploads) needs the browser to set its own
  // multipart/form-data boundary. The instance default forces
  // "application/json" on every request, so relying on callers to pass
  // `{ "Content-Type": undefined }` per-call is fragile. Do it centrally
  // here instead — any request whose body is FormData gets its
  // Content-Type header deleted before it goes out.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (!newToken) {
      store.dispatch(logout());
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
      return Promise.reject(error);
    }

    originalRequest.headers.set("x-auth-token", newToken);

    return apiClient.request(originalRequest);
  }
);

export default apiClient;