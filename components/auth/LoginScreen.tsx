import Coin from "@/assets/images/coin.svg";
import { useLogin } from "@/hooks/auth/auth";
import {
  getBiometricAvailability,
  unlockWithBiometrics,
} from "@/lib/biometric-auth";
import { COLORS, Radius } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "../../api/auth";
import { clearRegistrationFlow } from "./authFlow";
import { AuthField } from "./register/FormControls";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginScreen = () => {
  const [viewPassword, setViewPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [rememberedName, setRememberedName] = useState("");
  const [title, setTitle] = useState("Welcome back");
  const [mailAvailable, setMailAvailable] = useState(false);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showBiometricEntry, setShowBiometricEntry] = useState(false);
  const [biometricCanAutoUnlock, setBiometricCanAutoUnlock] = useState(false);
  const [isBiometricPending, setIsBiometricPending] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const { mutateAsync: login, isPending } = useLogin();
  const { logout, onLoginSuccess } = useAuth();
  const didAutoPromptBiometric = useRef(false);

  useEffect(() => {
    const checkMail = async () => {
      const mailInStorage = await AsyncStorage.getItem("email");
      const nameInStorage = await AsyncStorage.getItem("name");
      setRememberedName(nameInStorage ?? "");
      if (mailInStorage) {
        setEmail(mailInStorage);
        setMailAvailable(true);
        if (nameInStorage) {
          setTitle(`Welcome back, ${nameInStorage}`);
        }
      }
    };
    checkMail();
  }, []);

  const isSwitchingRef = useRef(false);
  const handleSwitchAccount = () => {
    // One tap = one switch. Rapid taps can't stack parallel logout chains.
    if (isSwitchingRef.current) return;
    isSwitchingRef.current = true;

    // Redirect FIRST — instant feedback, nothing awaits the network.
    router.replace("/(auth)/initial");

    // Local teardown + server revoke happen in the background. logout() itself
    // no longer touches the network before state is cleared.
    void (async () => {
      try {
        await logout();
        await AsyncStorage.multiRemove(["name", "email"]);
      } catch (err) {
        console.warn("[LoginScreen] switch-account cleanup failed:", err);
      }
    })();
  };

  useEffect(() => {
    const checkBiometric = async () => {
      const availability = await getBiometricAvailability();
      const canAutoUnlock =
        availability.enabled &&
        availability.deviceReady &&
        availability.sessionRecoverable;
      const shouldShow = canAutoUnlock;

      console.log("[LoginScreen] biometric availability", {
        ...availability,
        shouldShow,
        canAutoUnlock,
      });

      setShowBiometricEntry(shouldShow);
      setBiometricCanAutoUnlock(canAutoUnlock);
    };

    void checkBiometric();
  }, []);

  useEffect(() => {
    if (
      didAutoPromptBiometric.current ||
      !showBiometricEntry ||
      !biometricCanAutoUnlock ||
      isPending ||
      isBiometricPending
    ) {
      return;
    }

    didAutoPromptBiometric.current = true;
    console.log("[LoginScreen] auto prompting biometric login");
    void handleBiometricLogin({ automatic: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricCanAutoUnlock, showBiometricEntry]);

  // --- Validation -------------------------------------------------------
  const trimmedEmail = email.trim();
  const isEmailValid = mailAvailable
    ? trimmedEmail.length > 0
    : EMAIL_REGEX.test(trimmedEmail);
  const isPasswordValid = password.length > 0;

  const canSubmit = useMemo(
    () => isEmailValid && isPasswordValid && !isPending && !isBiometricPending,
    [isEmailValid, isPasswordValid, isPending, isBiometricPending],
  );

  const emailErrorText =
    emailTouched && !mailAvailable && !isEmailValid
      ? trimmedEmail.length === 0
        ? "Email is required"
        : "Enter a valid email address"
      : "";

  const passwordErrorText =
    passwordTouched && !isPasswordValid ? "Password is required" : "";

  // Clear any stale error as soon as the person starts fixing their input
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (!emailTouched) setEmailTouched(true);
    if (errorMessage) setErrorMessage("");
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (!passwordTouched) setPasswordTouched(true);
    if (errorMessage) setErrorMessage("");
  };

  const handleLogin = async () => {
    if (!canSubmit) return;

    try {
      const response = await login({
        email: trimmedEmail.toLowerCase(),
        password,
      });

      onLoginSuccess(response.access_token);

      await clearRegistrationFlow();
      await AsyncStorage.setItem("email", trimmedEmail.toLowerCase());

      Toast.show({
        type: "success",
        text1: "Login successful",
        text2: "Welcome back to XAVAULT.",
      });

      router.replace("/(app)/(tabs)/home");
    } catch (error) {
      console.error("Login failed:", error);
      setErrorMessage("Incorrect email or password.");
    }
  };

  const handleBiometricLogin = async (
    options: { automatic?: boolean } = {},
  ) => {
    try {
      console.log("[LoginScreen] biometric login pressed", options);
      setIsBiometricPending(true);
      const result = await unlockWithBiometrics("Sign in to XAVAULT");
      console.log("[LoginScreen] biometric login result", {
        hasAccessToken: Boolean(result.accessToken),
        reason: result.reason,
      });

      if (!result.accessToken) {
        const availability = await getBiometricAvailability();
        setShowBiometricEntry(
          availability.enabled &&
          availability.deviceReady &&
          availability.sessionRecoverable,
        );
        setBiometricCanAutoUnlock(
          availability.enabled &&
          availability.deviceReady &&
          availability.sessionRecoverable,
        );

        if (result.reason === "authentication_failed") {
          if (!options.automatic) {
            Toast.show({
              type: "info",
              text1: "Biometric cancelled",
              text2: "Tap the fingerprint to try again.",
            });
          }
          return;
        }

        Toast.show({
          type: "error",
          text1: "Biometric login unavailable",
          text2: "Sign in with your password to refresh your session.",
        });
        return;
      }

      onLoginSuccess(result.accessToken);
      await clearRegistrationFlow();

      Toast.show({
        type: "success",
        text1: "Welcome back",
        text2: "Signed in with biometrics.",
      });

      router.replace("/(app)/(tabs)/home");
    } catch (error) {
      console.error("Biometric login failed:", error);
      const availability = await getBiometricAvailability();
      setShowBiometricEntry(
        availability.enabled &&
        availability.deviceReady &&
        availability.sessionRecoverable,
      );
      setBiometricCanAutoUnlock(false);
      Toast.show({
        type: "error",
        text1: "Biometric login failed",
        text2: "Sign in with your password to continue.",
      });
    } finally {
      setIsBiometricPending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardAvoidingView}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "100%",
            justifyContent: "center",
            alignItems: "center",
          }}
        >

          <Coin width={250}
            height={250} />
        </View>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.card}>
          {!mailAvailable && (
            <>
              <AuthField
                label="Email"
                placeholder="Enter your email"
                value={email}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={handleEmailChange}
                onBlur={() => setEmailTouched(true)}
                onSubmitEditing={() => {
                  // let the return key move focus rather than submit;
                  // keeps the flow predictable when password isn't filled yet
                }}
              />
              {!!emailErrorText && (
                <Text style={styles.fieldError}>{emailErrorText}</Text>
              )}
            </>
          )}
          <AuthField
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={handlePasswordChange}
            onBlur={() => setPasswordTouched(true)}
            onSubmitEditing={canSubmit ? handleLogin : undefined}
            returnKeyType="go"
            secureTextEntry
            viewPassword={viewPassword}
            setViewPassword={setViewPassword}
          />
          {!!passwordErrorText && (
            <Text style={styles.fieldError}>{passwordErrorText}</Text>
          )}

          <TouchableOpacity
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            disabled={!canSubmit}
            onPress={handleLogin}
          >
            <Text style={styles.buttonText}>
              {isPending ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>

          {showBiometricEntry ? (
            <TouchableOpacity
              style={[
                styles.biometricIconButton,
                isBiometricPending && styles.buttonDisabled,
              ]}
              disabled={isPending || isBiometricPending}
              onPress={() => handleBiometricLogin()}
              accessibilityRole="button"
              accessibilityLabel="Use biometric login"
            >
              <Ionicons
                name="finger-print-outline"
                size={28}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          ) : null}

          <Text
            onPress={() => void handleSwitchAccount()}
            style={styles.footerText}
          >
            {rememberedName ? `Not ${rememberedName}? ` : ""}
            <Text style={styles.link}>Switch Account</Text>
          </Text>
        {process.env.EXPO_PUBLIC_TEST === "true" && (
          <Button
            title="Clear Storage"
            onPress={async () => {
              await AsyncStorage.clear();
            }}
          />
        )}
        </View>
        {/* <ErrorModal
        visible={!!errorMessage}
        message={errorMessage}
        onClose={() => setErrorMessage("")}
      /> */}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = {
  keyboardAvoidingView: {
    flex: 1,
  },

  container: {
    backgroundColor: "#F6F7FB",
    flexGrow: 1,
    justifyContent: "center" as const,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  brand: {
    color: COLORS.primary,
    fontFamily: "Lexend_400Regular",
    fontSize: 22,
    letterSpacing: 2,
    marginBottom: 18,
    textAlign: "center" as const,
  },

  segment: {
    alignSelf: "center" as const,
    backgroundColor: "#EEF0F3",
    borderRadius: 12,
    flexDirection: "row" as const,
    height: 42,
    marginBottom: 24,
    padding: 4,
    width: "86%" as const,
  },

  segmentItem: {
    alignItems: "center" as const,
    flex: 1,
    justifyContent: "center" as const,
  },

  segmentActive: {
    alignItems: "center" as const,
    backgroundColor: COLORS.white,
    borderRadius: 9,
    elevation: 2,
    flex: 1,
    justifyContent: "center" as const,
    shadowColor: "#063B2E",
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  segmentText: {
    color: "#9AA5A1",
    fontFamily: "Lexend_400Regular",
    fontSize: 12,
  },

  segmentActiveText: {
    color: COLORS.primary,
    fontFamily: "Lexend_400Regular",
    fontSize: 12,
  },

  header: {
    alignItems: "flex-start" as const,
    marginVertical: 8,
  },

  title: {
    color: COLORS.primary,
    fontFamily: "Lexend_400Regular",
    fontSize: 27,
    marginBottom: 6,
  },

  subtitle: {
    color: "#6B7280",
    fontFamily: "Lexend_400Regular",
    fontSize: 13,
  },

  card: {},

  button: {
    alignItems: "center" as const,
    backgroundColor: COLORS.primary,
    borderRadius: Radius.medium,
    height: 52,
    justifyContent: "center" as const,
    marginTop: 2,
  },

  buttonText: {
    color: "white",
    fontFamily: "Lexend_400Regular",
    fontSize: 13,
    letterSpacing: 1.2,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  fieldError: {
    color: "#D14343",
    fontFamily: "Lexend_400Regular",
    fontSize: 12,
    marginBottom: 10,
    marginTop: -6,
  },

  biometricIconButton: {
    alignItems: "center" as const,
    alignSelf: "center" as const,
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(6, 59, 46, 0.18)",
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: "center" as const,
    marginTop: 14,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    width: 56,
  },

  forgotText: {
    color: COLORS.primary,
    fontFamily: "Lexend_400Regular",
    fontSize: 14,
    marginBottom: 14,
    marginTop: -4,
    textAlign: "right" as const,
  },

  footerText: {
    color: "#6B7280",
    fontFamily: "Lexend_400Regular",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center" as const,
  },

  link: {
    color: COLORS.primary,
    fontFamily: "Lexend_400Regular",
  },

  brandMark: {
    alignItems: "center" as const,
    alignSelf: "center" as const,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    height: 62,
    justifyContent: "center" as const,
    marginBottom: 14,
    width: 62,
  },

  brandMarkText: {
    color: COLORS.tertiary,
    fontFamily: "Lexend_400Regular",
    fontSize: 20,
  },
};
