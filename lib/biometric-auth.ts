import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  authApi,
  isTokenExpired,
  saveTokens,
  api,
} from "@/api/client";
import * as Device from "expo-device";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import ReactNativeBiometrics from "react-native-biometrics";

export const BIOMETRIC_LOGIN_KEY = "biometric_enabled";
const BIOMETRIC_DEVICE_ID_KEY = "biometric_device_id";
const LOG_PREFIX = "[BiometricAuth]";
const biometrics = new ReactNativeBiometrics({ allowDeviceCredentials: true });

type ChallengeResponse = {
  data: {
    challenge_id: string;
    challenge: string;
    signing_payload: string;
    expires_at: string;
  };
};

type VerifyResponse = {
  data: {
    access_token: string;
    refresh_token: string;
    user?: { name?: string };
  };
};

export type BiometricAvailability = {
  deviceReady: boolean;
  enabled: boolean;
  credentialReady: boolean;
  hasAccessToken: boolean;
  accessTokenValid: boolean;
  hasRefreshToken: boolean;
  refreshTokenValid: boolean;
  sessionRecoverable: boolean;
};

async function getOrCreateDeviceID() {
  const existing = await SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceID = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16);
    const nibble = value === "x" ? random : (random & 0x3) | 0x8;
    return nibble.toString(16);
  });
  await SecureStore.setItemAsync(BIOMETRIC_DEVICE_ID_KEY, deviceID);
  return deviceID;
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const [hardware, enrolled, enabledValue, deviceID, accessToken, refreshToken, keyState] =
    await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      SecureStore.getItemAsync(BIOMETRIC_LOGIN_KEY),
      SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY),
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
      biometrics.biometricKeysExist().catch(() => ({ keysExist: false })),
    ]);

  const accessTokenValid = Boolean(accessToken && !isTokenExpired(accessToken));
  const refreshTokenValid = Boolean(refreshToken && !isTokenExpired(refreshToken));
  const credentialReady = Boolean(deviceID && keyState.keysExist);
  const availability = {
    deviceReady: hardware && enrolled,
    enabled: enabledValue === "true",
    credentialReady,
    hasAccessToken: Boolean(accessToken),
    accessTokenValid,
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenValid,
    sessionRecoverable: credentialReady,
  };

  console.log(LOG_PREFIX, "availability", availability);
  return availability;
}

export async function setBiometricLoginEnabled(enabled: boolean) {
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_LOGIN_KEY, "true");
  else await SecureStore.deleteItemAsync(BIOMETRIC_LOGIN_KEY);
}

export async function enrollBiometricLogin() {
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hardware || !enrolled) throw new Error("Biometrics are not available on this device");

  const confirmation = await LocalAuthentication.authenticateAsync({
    promptMessage: "Confirm to enable biometric login",
    fallbackLabel: "Use device passcode",
    cancelLabel: "Cancel",
  });
  if (!confirmation.success) return false;

  await biometrics.deleteKeys().catch(() => undefined);
  const { publicKey } = await biometrics.createKeys();
  const deviceID = await getOrCreateDeviceID();
  try {
    await api.post("/auth/biometric/devices", {
      device_id: deviceID,
      device_name: Device.deviceName ?? `${Platform.OS} device`,
      platform: Platform.OS,
      public_key: publicKey,
      key_algorithm: "RS256",
    });
    await setBiometricLoginEnabled(true);
    return true;
  } catch (error) {
    await biometrics.deleteKeys().catch(() => undefined);
    throw error;
  }
}

export async function disableBiometricLogin() {
  const [deviceID, accessToken] = await Promise.all([
    SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY),
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  ]);
  if (deviceID && accessToken && !isTokenExpired(accessToken)) {
    await authApi.delete(`/auth/biometric/devices/${encodeURIComponent(deviceID)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch((error) => {
      console.warn(LOG_PREFIX, "server revocation failed", error);
    });
  }
  await Promise.all([
    biometrics.deleteKeys().catch(() => undefined),
    SecureStore.deleteItemAsync(BIOMETRIC_LOGIN_KEY),
  ]);
}

export async function unlockWithBiometrics(promptMessage = "Sign in with biometrics") {
  const availability = await getBiometricAvailability();
  if (!availability.deviceReady || !availability.enabled || !availability.credentialReady) {
    return { accessToken: null, reason: availability };
  }

  const deviceID = await SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY);
  if (!deviceID) return { accessToken: null, reason: "credential_missing" as const };

  const challengeResponse = await authApi.post<ChallengeResponse>("/auth/biometric/challenge", {
    device_id: deviceID,
  });
  const challenge = challengeResponse.data.data;
  const signatureResult = await biometrics.createSignature({
    promptMessage,
    payload: challenge.signing_payload,
  });
  if (!signatureResult.success || !signatureResult.signature) {
    return { accessToken: null, reason: "authentication_failed" as const };
  }

  const verifyResponse = await authApi.post<VerifyResponse>("/auth/biometric/verify", {
    device_id: deviceID,
    challenge_id: challenge.challenge_id,
    challenge: challenge.challenge,
    signature: signatureResult.signature,
  });
  const session = verifyResponse.data.data;
  await saveTokens(session.access_token, session.refresh_token);
  return { accessToken: session.access_token, reason: "success" as const };
}
