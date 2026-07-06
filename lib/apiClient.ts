import { store } from "@/lib/redux/store";
import { setCredentials, logout } from "@/lib/redux/slices/authSlice";

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
  if (!data.accessToken) return null;

  store.dispatch(
    setCredentials({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      user: data.user || user!,
    })
  );

  return data.accessToken;
}

// path must always start with "/api/..." — this only ever calls your own
// Next.js server routes, never the real backend directly, so CORS never applies.
export async function apiClient(path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = store.getState().auth.accessToken;

  const doFetch = (token: string | null) =>
    fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { "x-auth-token": `${token}` } : {}),
      },
    });

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;

    if (newToken) {
      res = await doFetch(newToken);
    } else {
      store.dispatch(logout());
      if (typeof window !== "undefined") window.location.href = "/";
    }
  }

  return res;
}