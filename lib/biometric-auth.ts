import {
  getAccessToken,
  getRefreshToken,
  isTokenExpired,
  refreshAuthTokens,
} from "@/api/auth";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

export const BIOMETRIC_LOGIN_KEY = "biometric_enabled";
const LOG_PREFIX = "[BiometricAuth]";

export type BiometricAvailability = {
  deviceReady: boolean;
  enabled: boolean;
  hasAccessToken: boolean;
  accessTokenValid: boolean;
  hasRefreshToken: boolean;
  refreshTokenValid: boolean;
  sessionRecoverable: boolean;
};

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const [hardware, enrolled, enabledValue, accessToken, refreshToken] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    SecureStore.getItemAsync(BIOMETRIC_LOGIN_KEY),
    getAccessToken(),
    getRefreshToken(),
  ]);

  const accessTokenValid = Boolean(accessToken && !isTokenExpired(accessToken));
  const refreshTokenValid = Boolean(refreshToken && !isTokenExpired(refreshToken));
  const availability = {
    deviceReady: hardware && enrolled,
    enabled: enabledValue === "true",
    hasAccessToken: Boolean(accessToken),
    accessTokenValid,
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenValid,
    sessionRecoverable: accessTokenValid || refreshTokenValid,
  };

  console.log(LOG_PREFIX, "availability", availability);
  return availability;
}

export async function setBiometricLoginEnabled(enabled: boolean) {
  console.log(LOG_PREFIX, "set enabled", { enabled });
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_LOGIN_KEY, "true");
    await SecureStore.setItemAsync("BIOMETRIC_LOGIN_KEY_TEST", "true");
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_LOGIN_KEY);
  }
}

export async function unlockWithBiometrics(promptMessage = "Sign in with biometrics") {
  const availability = await getBiometricAvailability();
  console.log(LOG_PREFIX, "unlock requested", availability);

  if (!availability.deviceReady || !availability.enabled || !availability.sessionRecoverable) {
    if (!availability.sessionRecoverable) {
      await setBiometricLoginEnabled(false);
    }
    console.log(LOG_PREFIX, "unlock blocked", availability);
    return { accessToken: null, reason: availability };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: "Use password",
    cancelLabel: "Cancel",
  });

  if (!result.success) {
    console.log(LOG_PREFIX, "local auth cancelled or failed", result);
    return { accessToken: null, reason: "authentication_failed" as const };
  }

  const existingAccessToken = await getAccessToken();
  if (existingAccessToken && !isTokenExpired(existingAccessToken)) {
    console.log(LOG_PREFIX, "using existing valid access token");
    return { accessToken: existingAccessToken, reason: "success" as const };
  }

  const accessToken = await refreshAuthTokens();
  console.log(LOG_PREFIX, "refresh after biometric", {
    success: Boolean(accessToken),
  });
  return { accessToken, reason: accessToken ? "success" as const : "refresh_failed" as const };
}
