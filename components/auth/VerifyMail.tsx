import { useValidateMail, useResendVerificationMail } from "@/hooks/auth/auth";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 30; // seconds

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getApiErrorMessage = (error: any): string => {
  const data = error?.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (typeof error?.message === "string") return error.message;
  return "Please try again.";
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const VerifyMailScreen = () => {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";

  const [otp, setOtp] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [resendInterval, setResendInterval] = useState(RESEND_COUNTDOWN);
  const [resendSeconds, setResendSeconds] = useState(RESEND_COUNTDOWN);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { mutateAsync: validateMail, isPending } = useValidateMail();
  const { mutateAsync: resendMail, isPending: isResending } = useResendVerificationMail();

  // ── Fade in on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Resend countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds > 0]);

  // ── Auto-submit when 6 digits entered ────────────────────────────────────
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !hasSubmitted) {
      handleSubmit(otp);
    }
  }, [otp]);

  // ── Shake animation on error ──────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSubmit = useCallback(
    async (code = otp) => {
      if (code.length !== OTP_LENGTH || isPending) return;

      setHasSubmitted(true);
      try {
        await validateMail({ email, otp: code });
        await AsyncStorage.removeItem("pendingVerificationEmail");
        Toast.show({
          type: "success",
          text1: "Email verified",
          text2: "You can now log in.",
        });
        router.replace("/(auth)/login");
      } catch (error: any) {
        triggerShake();
        setOtp("");
        setHasSubmitted(false);
        inputRef.current?.focus();
        Toast.show({
          type: "error",
          text1: "Invalid code",
          text2: getApiErrorMessage(error),
        });
      }
    },
    [otp, isPending, email, validateMail, triggerShake]
  );

  const handleResend = async () => {
    if (resendSeconds > 0 || isResending) return;

    try {
      await resendMail({ email });
      
      const nextInterval = Math.min(resendInterval + 15, 120);
      setResendInterval(nextInterval);
      setResendSeconds(nextInterval);
      setOtp("");
      setHasSubmitted(false);

      Toast.show({
        type: "success",
        text1: "Verification code sent",
        text2: `Check ${email} for your new OTP.`,
      });
      inputRef.current?.focus();
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Failed to resend code",
        text2: getApiErrorMessage(error),
      });
    }
  };

  const isComplete = otp.length === OTP_LENGTH;
  const canResend = resendSeconds === 0;

  // ── Masked email for display ──────────────────────────────────────────────
  const displayEmail = email
    ? email.replace(/(.{2}).+(@.+)/, "$1•••$2")
    : "your email";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <Ionicons name="mail-outline" size={28} color={COLORS.primary} />
            </View>

            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{"\n"}
              <Text style={styles.emailHighlight}>{displayEmail}</Text>
            </Text>
          </View>

          {/* ── OTP boxes ── */}
          <Animated.View
            style={[
              styles.otpWrap,
              { transform: [{ translateX: shakeAnim }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={styles.otpRow}
            >
              {Array.from({ length: OTP_LENGTH }).map((_, index) => {
                const char = otp[index];
                const isActive = isFocused && index === otp.length && !isComplete;
                const isFilled = !!char;

                return (
                  <View
                    key={index}
                    style={[
                      styles.otpBox,
                      isFilled && styles.otpBoxFilled,
                      isActive && styles.otpBoxActive,
                      isComplete && styles.otpBoxComplete,
                    ]}
                  >
                    {isFilled ? (
                      <Text style={styles.otpChar}>{char}</Text>
                    ) : isActive ? (
                      <View style={styles.cursor} />
                    ) : null}
                  </View>
                );
              })}
            </TouchableOpacity>
          </Animated.View>

          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, OTP_LENGTH))}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
          />

          {/* ── Status line ── */}
          <Text style={styles.statusText}>
            {isPending
              ? "Verifying…"
              : isComplete
                ? "Checking your code"
                : `Enter ${OTP_LENGTH - otp.length} more digit${OTP_LENGTH - otp.length !== 1 ? "s" : ""}`}
          </Text>

          {/* ── Submit button (shows when not auto-submitting) ── */}
          {!isComplete && (
            <TouchableOpacity
              style={[styles.button, otp.length < OTP_LENGTH && styles.buttonDim]}
              disabled={otp.length < OTP_LENGTH || isPending}
              onPress={() => handleSubmit()}
            >
              <Text style={styles.buttonText}>Verify code</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}

          {isPending && isComplete && (
            <View style={styles.button}>
              <Text style={styles.buttonText}>Verifying…</Text>
            </View>
          )}

          {/* ── Resend ── */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive it? </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendSeconds > 0 || isResending}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={[styles.resendLink, (resendSeconds > 0 || isResending) && styles.resendLinkDisabled]}>
                {isResending 
                  ? "Resending..." 
                  : resendSeconds === 0 
                    ? "Resend code" 
                    : `Resend in ${resendSeconds}s`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <TouchableOpacity
            onPress={async () => {
              await AsyncStorage.removeItem("pendingVerificationEmail");
              router.replace("/(auth)/login");
            }}
            style={styles.loginLink}
          >
            <Ionicons name="log-in-outline" size={14} color={COLORS.primary} />
            <Text style={styles.loginLinkText}>Back to login</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default VerifyMailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const BOX_SIZE = 48;
const BOX_GAP = 8;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    backgroundColor: COLORS.hash,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 20,
  },

  card: {
    backgroundColor: COLORS.white,
    borderColor: "#E7ECE9",
    borderRadius: 24,
    borderWidth: 1,
    elevation: 6,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: "#063B2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },

  // ── Header ──────────────────────────────────────────────────────────────

  header: {
    alignItems: "center",
    marginBottom: 32,
  },

  backButton: {
    alignSelf: "flex-start",
    alignItems: "center",
    backgroundColor: "#F4F6F5",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    marginBottom: 20,
    width: 38,
  },

  iconWrap: {
    alignItems: "center",
    backgroundColor: "#EAF4F0",
    borderRadius: 20,
    height: 64,
    justifyContent: "center",
    marginBottom: 16,
    width: 64,
    borderWidth: 1,
    borderColor: "#D1E9DF",
  },

  title: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 24,
    marginBottom: 8,
    textAlign: "center",
  },

  subtitle: {
    color: "#6B7280",
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  emailHighlight: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
  },

  // ── OTP ──────────────────────────────────────────────────────────────────

  otpWrap: {
    marginBottom: 16,
  },

  otpRow: {
    flexDirection: "row",
    gap: BOX_GAP,
    justifyContent: "center",
  },

  otpBox: {
    alignItems: "center",
    backgroundColor: "#F7F9F8",
    borderColor: "#DDE6E1",
    borderRadius: 14,
    borderWidth: 1.5,
    height: BOX_SIZE,
    justifyContent: "center",
    width: BOX_SIZE,
  },

  otpBoxActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0F8F4",
    // subtle shadow to lift the active box
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },

  otpBoxFilled: {
    backgroundColor: "#EAF4F0",
    borderColor: COLORS.primary,
  },

  otpBoxComplete: {
    borderColor: "#2D9B6F",
    backgroundColor: "#EAF4F0",
  },

  otpChar: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
  },

  cursor: {
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    height: 20,
    width: 2,
    opacity: 0.8,
  },

  hiddenInput: {
    height: 0,
    opacity: 0,
    position: "absolute",
    width: 0,
  },

  // ── Status ───────────────────────────────────────────────────────────────

  statusText: {
    color: "#9AA5A0",
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 12,
    marginBottom: 20,
    textAlign: "center",
  },

  // ── Button ───────────────────────────────────────────────────────────────

  button: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
    marginBottom: 20,
  },

  buttonDim: {
    opacity: 0.45,
  },

  buttonText: {
    color: COLORS.white,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
  },

  // ── Resend ───────────────────────────────────────────────────────────────

  resendRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },

  resendLabel: {
    color: "#9AA5A0",
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 13,
  },

  resendLink: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 13,
  },

  resendLinkDisabled: {
    color: "#B0BCBA",
  },

  // ── Footer ───────────────────────────────────────────────────────────────

  loginLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
  },

  loginLinkText: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 13,
  },
});