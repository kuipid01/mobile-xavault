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

async function biometricKeysExist() {
  try {
    return await biometrics.biometricKeysExist();
  } catch (error) {
    console.warn(LOG_PREFIX, "native biometric key module is unavailable", error);
    return { keysExist: false };
  }
}

async function deleteBiometricKeys() {
  try {
    await biometrics.deleteKeys();
  } catch (error) {
    console.warn(LOG_PREFIX, "could not delete biometric keys", error);
  }
  // Keys gone => credentialReady changes; keep the availability cache honest
  // (covers the enroll-failure path too, not just explicit toggles).
  invalidateBiometricHardwareCache();
}

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

// ─── Availability cache ──────────────────────────────────────────────────────
// getBiometricAvailability() used to run 2 native auth checks + a native
// key-module probe + 7 SecureStore reads on EVERY call. The root-layout
// redirect and LoginScreen both call it within milliseconds of each other,
// and LoginScreen asks again after every failed unlock — each round trip
// delaying the login form.
//
// Split by mutability:
// - Hardware snapshot (deviceReady/enabled/credentialReady) only changes when
//   the user enrolls or disables biometrics — cached for the app session and
//   invalidated by the in-app toggles below. OS-level changes are picked up
//   on the next app launch.
// - Token fields (hasAccessToken/accessTokenValid/...) change on every
//   login/logout/refresh, so they are ALWAYS recomputed from fresh SecureStore
//   reads (two fast local reads + local JWT decode). No stale sessions.
type BiometricHardwareSnapshot = Pick<
  BiometricAvailability,
  "deviceReady" | "enabled" | "credentialReady"
>;

/** Cached hardware snapshot; the promise doubles as an in-flight dedupe so
 * concurrent callers (startup redirect + login screen) share one probe. */
let hardwareSnapshotPromise: Promise<BiometricHardwareSnapshot> | null = null;

async function loadBiometricHardwareSnapshot(): Promise<BiometricHardwareSnapshot> {
  const [hardware, enrolled, enabledValue, deviceID, keyState] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    SecureStore.getItemAsync(BIOMETRIC_LOGIN_KEY),
    SecureStore.getItemAsync(BIOMETRIC_DEVICE_ID_KEY),
    biometricKeysExist(),
  ]);

  return {
    deviceReady: hardware && enrolled,
    enabled: enabledValue === "true",
    credentialReady: Boolean(deviceID && keyState.keysExist),
  };
}

/** Get the hardware snapshot, probing native only once per app session. */
function getBiometricHardwareSnapshot() {
  if (!hardwareSnapshotPromise) {
    hardwareSnapshotPromise = loadBiometricHardwareSnapshot().catch((error) => {
      // Never cache a failure — let the next caller retry the probe.
      hardwareSnapshotPromise = null;
      throw error;
    });
  }

  return hardwareSnapshotPromise;
}

/** Drop the cached hardware snapshot. Called by the in-app enrollment
 * toggles below; exportable for future callers that change biometric state. */
export function invalidateBiometricHardwareCache() {
  hardwareSnapshotPromise = null;
}

export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  const [snapshot, accessToken, refreshToken] = await Promise.all([
    getBiometricHardwareSnapshot(),
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);

  const accessTokenValid = Boolean(accessToken && !isTokenExpired(accessToken));
  const refreshTokenValid = Boolean(refreshToken && !isTokenExpired(refreshToken));
  const availability: BiometricAvailability = {
    ...snapshot,
    hasAccessToken: Boolean(accessToken),
    accessTokenValid,
    hasRefreshToken: Boolean(refreshToken),
    refreshTokenValid,
    sessionRecoverable: snapshot.credentialReady,
  };

  console.log(LOG_PREFIX, "availability", availability);
  return availability;
}

export async function setBiometricLoginEnabled(enabled: boolean) {
  if (enabled) await SecureStore.setItemAsync(BIOMETRIC_LOGIN_KEY, "true");
  else await SecureStore.deleteItemAsync(BIOMETRIC_LOGIN_KEY);

  // `enabled` is part of the cached snapshot — keep the cache honest.
  invalidateBiometricHardwareCache();
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

  await deleteBiometricKeys();
  let publicKey: string;
  try {
    ({ publicKey } = await biometrics.createKeys());
  } catch (error) {
    console.error(LOG_PREFIX, "could not create biometric keys", error);
    throw new Error("Biometric signing requires a new development build");
  }
  const deviceID = await getOrCreateDeviceID();

  // New keys + device row change the snapshot's credentialReady.
  invalidateBiometricHardwareCache();
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
    await deleteBiometricKeys();
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
    deleteBiometricKeys(),
    SecureStore.deleteItemAsync(BIOMETRIC_LOGIN_KEY),
  ]);

  // Keys + the enabled flag were just wiped — invalidate the snapshot.
  invalidateBiometricHardwareCache();
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
  let signatureResult: Awaited<ReturnType<typeof biometrics.createSignature>>;
  try {
    signatureResult = await biometrics.createSignature({
      promptMessage,
      payload: challenge.signing_payload,
    });
  } catch (error) {
    console.error(LOG_PREFIX, "could not sign biometric challenge", error);
    throw new Error("Biometric signing requires a new development build");
  }
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
