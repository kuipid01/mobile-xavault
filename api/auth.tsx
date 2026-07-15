import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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

const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[Auth] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[Auth] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[Auth] ${msg}`, ...args),
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  country: "NG" | "GH";
  phone_number: string;
  nickname?: string;
};

type StartRegistrationPayload = {
  email: string;
};

type VerifyRegistrationMailPayload = {
  email: string;
  otp: string;
};

type ValidateMailPayload = {
  email?: string;
  token?: string;
  otp?: string;
};

type ForgetPasswordPayload = {
  email: string;
};

type ResendVerificationMailPayload = {
  email: string;
};

type ResetPasswordPayload = {
  otp: string;
  password: string;
  confirm_password: string;
};

export const getAccessToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

export const getRefreshToken = (): Promise<string | null> =>
  SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

export const removeTokens = clearAuthTokens;

export { isTokenExpired, saveTokens };

export const isLoggedIn = async (): Promise<boolean> => {
  log.info("Checking login state");

  let token = await getAccessToken();

  if (!token || isTokenExpired(token)) {
    log.info("Access token missing or expired, attempting refresh");

    token = await refreshAuthTokens();

    const result = !!token;
    log.info(`isLoggedIn result after refresh: ${result}`);

    return result;
  }

  log.info("Access token valid, user is logged in");
  return true;
};

export const loginUser = async (data: LoginPayload) => {
  log.info("Logging in user:", data.email);

  const res = await api.post("/auth/login", data);
  const response = res.data.data;

  await saveTokens(response.access_token, response.refresh_token);
  if (response.user.name) {
    await AsyncStorage.setItem("name", response.user.name);
  } else {
    await AsyncStorage.removeItem("name");
  }
  log.info("Login successful, tokens saved", response);

  return response;
};

export const registerUser = async (data: RegisterPayload) => {
  log.info("Registering user:", data.email);

  const res = await api.post("/auth/register", data);

  log.info("Registration successful");

  return res.data;
};

export const startRegistration = async (data: StartRegistrationPayload) => {
  log.info("Starting registration:", data.email);

  const res = await api.post("/auth/register/start", data);

  log.info("Registration OTP sent");

  return res.data;
};

export const verifyRegistrationMail = async (
  data: VerifyRegistrationMailPayload,
) => {
  log.info("Verifying registration email:", data.email);

  const res = await api.post("/auth/register/verify-mail", data);

  log.info("Registration email verified");

  return res.data;
};

export const validateMail = async (data: ValidateMailPayload) => {
  log.info("Validating email:", data.email);

  const res = await api.post("/auth/validate-mail", data);

  log.info("Email validation successful");

  return res.data;
};

export const resendVerificationMail = async (
  data: ResendVerificationMailPayload,
) => {
  log.info("Resending verification mail to:", data.email);

  const res = await api.post("/auth/resend-verification-mail", data);

  log.info("Verification mail resend successful");

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
  log.info("Logging out user, clearing tokens");
  await clearAuthTokens();
};

type AuthState = {
  userToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthContextValue = AuthState & {
  logout: () => Promise<void>;
  onLoginSuccess: (token: string) => void;
  reloadAuthState: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    userToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const logoutRef = useRef<() => Promise<void>>(null);

  const logout = useCallback(async () => {
    log.info("AuthProvider: logout called");

    await logoutUser();

    setState({
      userToken: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  logoutRef.current = logout;

  const onLoginSuccess = useCallback((token: string) => {
    log.info("AuthProvider: onLoginSuccess called");

    setState({
      userToken: token,
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  const reloadAuthState = useCallback(async () => {
    log.info("AuthProvider: loading auth state");

    setState((prev) => ({
      ...prev,
      isLoading: true,
    }));

    try {
      let token = await getAccessToken();

      if (!token || isTokenExpired(token)) {
        log.info("AuthProvider: token missing or expired, attempting refresh");
        token = await refreshAuthTokens();
      }

      if (!token) {
        log.warn("AuthProvider: no valid token, user is logged out");

        setState({
          userToken: null,
          isLoading: false,
          isAuthenticated: false,
        });

        return;
      }

      log.info("AuthProvider: valid token found");

      setState({
        userToken: token,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (err) {
      log.error("AuthProvider: unexpected error loading token:", err);

      setState({
        userToken: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    registerLogoutCallback(() => {
      log.warn("AuthProvider: logout triggered by client");
      logoutRef.current?.();
    });

    reloadAuthState();

    return () => {
      unregisterLogoutCallback();
    };
  }, [reloadAuthState]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        logout,
        onLoginSuccess,
        reloadAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
