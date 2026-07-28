import type { InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { apiErrorPayload, publishGlobalError } from "@/lib/global-error";

// ─── Config ───────────────────────────────────────────────────────────────────

// const BACKEND_URL = "http://localhost:8080/api/v1/";
// const BACKEND_URL = "https://apixavault.kuipid.com/api/v1/";
const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.118:8080/api/v1/";
// const BACKEND_URL = "http://192.168.1.118:8080/api/v1/";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";
const BIOMETRIC_LOGIN_KEY = "biometric_enabled";

// ─── Types ────────────────────────────────────────────────────────────────────

type JwtPayload = {
  exp?: number;
  [key: string]: unknown;
};

type RefreshResponse = {
  data?: {
    access_token?: string;
    refresh_token?: string;
  };
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  suppressGlobalErrorModal?: boolean;
};

// ─── Logging ──────────────────────────────────────────────────────────────────

const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[Auth] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[Auth] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[Auth] ${msg}`, ...args),
};

// ─── Logout callback registry ─────────────────────────────────────────────────
// Allows useAuth (or any other subscriber) to react when the session is killed
// mid-flight (e.g. a 401 during a background request).

type LogoutCallback = () => void;
let onLogoutCallback: LogoutCallback | null = null;

export const registerLogoutCallback = (cb: LogoutCallback) => {
  onLogoutCallback = cb;
};

export const unregisterLogoutCallback = () => {
  onLogoutCallback = null;
};

const triggerLogout = () => {
  log.info("Triggering global logout callback");
  onLogoutCallback?.();
};

// ─── Token helpers ────────────────────────────────────────────────────────────

export const isTokenExpired = (token: string | null): boolean => {
  if (!token) return true;
  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    if (!exp) return true;
    const expired = exp <= Date.now() / 1000;
    if (expired) log.info("Token is expired");
    return expired;
  } catch (err) {
    log.warn("Failed to decode token:", err);
    return true;
  }
};

export const saveTokens = async (
  accessToken: string,
  refreshToken?: string
): Promise<void> => {
  if (!accessToken) {
    log.error("saveTokens called without an access token");
    return;
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }

  const [storedAccessToken, storedRefreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  log.info("Tokens saved to SecureStore", {
    accessTokenSaved: Boolean(storedAccessToken),
    refreshTokenSaved: Boolean(storedRefreshToken),
    accessTokenExpired: isTokenExpired(storedAccessToken),
    refreshTokenExpired: storedRefreshToken ? isTokenExpired(storedRefreshToken) : null,
  });
};

export const clearAuthTokens = async (
  options: { clearBiometric?: boolean } = {},
): Promise<void> => {
  const keys = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY];
  if (options.clearBiometric) keys.push(BIOMETRIC_LOGIN_KEY);
  await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(key)));
  log.info("Auth tokens cleared from SecureStore", options);
};

// ─── Axios instances ──────────────────────────────────────────────────────────

// authApi is intentionally interceptor-free so refresh calls don't loop
export const authApi = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

export const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ─── Token refresh (singleton promise to prevent parallel refreshes) ──────────

let refreshPromise: Promise<string | null> | null = null;

export const refreshAuthTokens = async (flag?:boolean): Promise<string | null> => {
  if (refreshPromise) {
    log.info("Refresh already in progress, awaiting existing promise");
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if (!refreshToken) {
      log.warn("[KUIPID]No refresh token found — cannot refresh");
      await clearAuthTokens();
      triggerLogout();
      return null;
    }

    if (isTokenExpired(refreshToken)) {
      log.warn("Refresh token is expired — clearing session");
      await clearAuthTokens();
      triggerLogout();
      return null;
    }

    log.info("Attempting token refresh");

    try {
      const res = await authApi.post<RefreshResponse>("/auth/refresh-token", {
        refresh_token: refreshToken,
      });

      const accessToken = res.data.data?.access_token;
      const newRefreshToken = res.data.data?.refresh_token;

      if (!accessToken) {
        log.error("Refresh succeeded but response contained no access token");
        await clearAuthTokens();
        triggerLogout();
        return null;
      }

      await saveTokens(accessToken, newRefreshToken);
      log.info("Token refresh successful");
      return accessToken;
    } catch (err) {
      log.error("Token refresh request failed:", err);
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 400 || status === 401 || status === 403) {
        await clearAuthTokens();
        triggerLogout();
      }
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// ─── Request interceptor: attach + proactively refresh token ─────────────────

api.interceptors.request.use(
  async (config) => {
    config.headers["X-Request-ID"] =
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    let token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token && isTokenExpired(token)) {
      token = await refreshAuthTokens();
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      log.warn(`Sending request to ${config.url} without auth token`);
    }

    return config;
  },
  (error) => {
    log.error("Request interceptor error:", error);
    return Promise.reject(error);
  }
);

// ─── Response interceptor: handle 401s with one retry ────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    log.error(`API error [${status}] on ${url}:`, error.message);

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      log.info(`401 on ${url} — attempting token refresh and retry`);

      try {
        const token = await refreshAuthTokens();

        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          log.info(`Retrying ${url} with refreshed token`);
          return api(originalRequest);
        }

        // refreshAuthTokens already called triggerLogout + clearAuthTokens
        log.warn("Refresh returned null — session terminated, not retrying");
      } catch (refreshErr) {
        log.error("Refresh failed during 401 recovery:", refreshErr);
        // triggerLogout already called inside refreshAuthTokens on throw
      }
    }

    if (!originalRequest?.suppressGlobalErrorModal && !axios.isCancel(error)) {
      publishGlobalError(apiErrorPayload(error));
    }

    return Promise.reject(error);
  }
);
