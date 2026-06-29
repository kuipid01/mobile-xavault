import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  api,
  clearAuthTokens,
  isTokenExpired,
  refreshAuthTokens,
  registerLogoutCallback,
  saveTokens,
  unregisterLogoutCallback,
} from "./client";

// ─── Logging ──────────────────────────────────────────────────────────────────

const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[Auth] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[Auth] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[Auth] ${msg}`, ...args),
};

// ─── Types ────────────────────────────────────────────────────────────────────

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  confirm_password: string;
  country: "NG" | "GH";
  phone_number: string;
};

type ValidateMailPayload = {
  email?: string;
  token?: string;
  otp?: string;
};

type ForgetPasswordPayload = {
  email: string;
};

type ResetPasswordPayload = {
  otp: string;
  password: string;
  confirm_password: string;
};

// ─── Token helpers (thin wrappers — logic lives in client.ts) ─────────────────

export const getAccessToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

export const getRefreshToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

/** Alias kept for call-site compatibility */
export const removeTokens = clearAuthTokens;

// Re-export so consumers only need to import from one place
export { isTokenExpired, saveTokens };

// ─── Session check ────────────────────────────────────────────────────────────

export const isLoggedIn = async (): Promise<boolean> => {
  log.info("Checking login state");
  let token = await getAccessToken();

  if (!token || isTokenExpired(token)) {
    log.info("Access token missing or expired — attempting refresh");
    token = await refreshAuthTokens();
    const result = !!token;
    log.info(`isLoggedIn result after refresh: ${result}`);
    return result;
  }

  log.info("Access token valid — user is logged in");
  return true;
};

// ─── Auth API calls ───────────────────────────────────────────────────────────

export const loginUser = async (data: LoginPayload) => {
  log.info("Logging in user:", data.email);
  const res = await api.post("/auth/login", data);
  const response = res.data.data;
  await saveTokens(response.access_token, response.refresh_token);
  log.info("Login successful, tokens saved");
  return response;
};

export const registerUser = async (data: RegisterPayload) => {
  log.info("Registering user:", data.email);
  const res = await api.post("/auth/register", data);
  log.info("Registration successful");
  return res.data;
};

export const validateMail = async (data: ValidateMailPayload) => {
  log.info("Validating email:", data.email);
  const res = await api.post("/auth/validate-mail", data);
  log.info("Email validation successful");
  return res.data;
};

export const forgetPassword = async (data: ForgetPasswordPayload) => {
  log.info("Requesting password reset OTP:", data.email);
  const res = await api.post("/auth/forget-password", data);
  log.info("Password reset OTP requested");
  return res.data;
};

export const resetPassword = async (data: ResetPasswordPayload) => {
  log.info("Resetting password with OTP");
  const res = await api.post("/auth/reset-password", data);
  log.info("Password reset successful");
  return res.data;
};

export const logoutUser = async (): Promise<void> => {
  log.info("Logging out user — clearing tokens");
  await clearAuthTokens();
};

// ─── useAuth hook ─────────────────────────────────────────────────────────────

type AuthState = {
  userToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type UseAuthReturn = AuthState & {
  /** Call this to log the user out from anywhere in the app */
  logout: () => Promise<void>;
  /** Call this after a successful login to update hook state without remounting */
  onLoginSuccess: (token: string) => void;
};

export const useAuth = (): UseAuthReturn => {
  const [state, setState] = useState<AuthState>({
    userToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Stable ref so the logout callback registered in client.ts
  // always calls the latest version of this function.
  const logoutRef = useRef<() => Promise<void>>(null);

  const logout = useCallback(async () => {
    log.info("useAuth: logout called");
    await logoutUser();
    setState({ userToken: null, isLoading: false, isAuthenticated: false });
  }, []);

  // Keep the ref in sync
  logoutRef.current = logout;

  const onLoginSuccess = useCallback((token: string) => {
    log.info("useAuth: onLoginSuccess called");
    setState({ userToken: token, isLoading: false, isAuthenticated: true });
  }, []);

  useEffect(() => {
    // Register a callback so client.ts can trigger logout when a refresh
    // fails mid-session (e.g. during a background API call).
    registerLogoutCallback(() => {
      log.warn("useAuth: logout triggered by client (token refresh failed)");
      logoutRef.current?.();
    });

    const loadToken = async () => {
      log.info("useAuth: loading initial auth state");
      try {
        let token = await getAccessToken();

        if (!token || isTokenExpired(token)) {
          log.info("useAuth: token missing or expired — attempting refresh");
          token = await refreshAuthTokens();
        }

        if (!token) {
          log.warn(
            "useAuth: no valid token after refresh — user is logged out",
          );
          setState({
            userToken: null,
            isLoading: false,
            isAuthenticated: false,
          });
          return;
        }

        log.info("useAuth: valid token found, user is authenticated");
        setState({ userToken: token, isLoading: false, isAuthenticated: true });
      } catch (err) {
        log.error("useAuth: unexpected error loading token:", err);
        setState({ userToken: null, isLoading: false, isAuthenticated: false });
      }
    };

    loadToken();

    return () => {
      unregisterLogoutCallback();
    };
  }, []);

  return { ...state, logout, onLoginSuccess };
};
