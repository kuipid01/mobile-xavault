import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import { api, refreshAuthTokens } from "./client";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  email: string;
  password: string;
  confirm_password: string;
};

type ValidateMailPayload = {
  email?: string;
  token?: string;
};

type JwtPayload = {
  exp?: number;
  [key: string]: unknown;
};

export const saveTokens = async (accessToken: string, refreshToken?: string) => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);

  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const getAccessToken = async () => {
  return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = async () => {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
};

export const removeTokens = async () => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};

export const isTokenExpired = (token: string | null) => {
  if (!token) return true;

  try {
    const decoded = jwtDecode<JwtPayload>(token);

    if (!decoded.exp) return true;

    const now = Date.now() / 1000;

    return decoded.exp <= now;
  } catch {
    return true;
  }
};

export const isLoggedIn = async () => {
  let token = await getAccessToken();

  if (!token || isTokenExpired(token)) {
    token = await refreshAuthTokens();
    return !!token;
  }

  return true;
};

export const loginUser = async (data: LoginPayload) => {
  const res = await api.post("/auth/login", data);

  const response = res.data.data;

  await saveTokens(response.access_token, response.refresh_token);
  return response;
};

export const registerUser = async (data: RegisterPayload) => {
  const res = await api.post("/auth/register", data);
  return res.data;
};

export const validateMail = async (data: ValidateMailPayload) => {
  const res = await api.post("/auth/validate-mail", data);
  return res.data;
};

export const logoutUser = async () => {
  await removeTokens();
};

export const useAuth = () => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const loadToken = async () => {
      try {
        let token = await getAccessToken();

        if (!token || isTokenExpired(token)) {
          token = await refreshAuthTokens();
        }

        if (!token) {
          await removeTokens();
          setUserToken(null);
          setIsAuthenticated(false);
          return;
        }

        setUserToken(token);
        setIsAuthenticated(true);
      } catch (error) {
        console.log("Failed to load token:", error);
        setUserToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  return {
    userToken,
    isLoading,
    isAuthenticated,
  };
};
