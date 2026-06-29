import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";

// const BACKENDURL = "http://localhost:8080/api/v1/";
// const BACKENDURL = "https://apixavault.kuipid.com/api/v1/";
const BACKENDURL = "http://10.106.49.66:8080/api/v1/";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

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
};

const authApi = axios.create({
  baseURL: BACKENDURL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const api = axios.create({
  baseURL: BACKENDURL,
  headers: {
    "Content-Type": "application/json",
  },
});

const isTokenExpired = (token: string | null) => {
  if (!token) return true;

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    if (!decoded.exp) return true;

    return decoded.exp <= Date.now() / 1000;
  } catch {
    return true;
  }
};

const saveTokens = async (accessToken: string, refreshToken?: string) => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const clearAuthTokens = async () => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

let refreshPromise: Promise<string | null> | null = null;

export const refreshAuthTokens = async () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if (!refreshToken || isTokenExpired(refreshToken)) {
      await clearAuthTokens();
      return null;
    }

    try {
      const res = await authApi.post<RefreshResponse>("/auth/refresh-token", {
        refresh_token: refreshToken,
      });

      const accessToken = res.data.data?.access_token;
      const newRefreshToken = res.data.data?.refresh_token;

      if (!accessToken) {
        await clearAuthTokens();
        return null;
      }

      await saveTokens(accessToken, newRefreshToken);
      return accessToken;
    } catch (error) {
      await clearAuthTokens();
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

api.interceptors.request.use(
  async (config) => {
    let token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

    if (token && isTokenExpired(token)) {
      token = await refreshAuthTokens();
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.log("API Error:", error.response?.data || error.message);
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const token = await refreshAuthTokens();

        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch {
        await clearAuthTokens();
      }
    }

    return Promise.reject(error);
  }
);
