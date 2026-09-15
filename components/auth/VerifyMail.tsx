import Coin from "@/assets/images/coin.svg";
import {
  useStartRegistration,
  useVerifyRegistrationMail,
} from "@/hooks/auth/auth";
import { COLORS, Radius } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { ErrorModal } from "../ui/ErrorModal";
import {
  clearRegistrationFlow,
  createRegistrationFlow,
  loadAuthFlow,
  PENDING_EMAIL_KEY,
  REGISTRATION_DRAFT_KEY,
  saveAuthFlow,
} from "./authFlow";

const OTP_LENGTH = 6;
const RESEND_COUNTDOWN = 30;

const VerifyMailScreen = () => {
  const params = useLocalSearchParams<{ email?: string }>();
  const paramEmail = typeof params.email === "string" ? params.email : "";

  const [email, setEmail] = useState(paramEmail);
  const [otp, setOtp] = useState("");
  const [resendSeconds, setResendSeconds] = useState(RESEND_COUNTDOWN);
  const [errorMessage, setErrorMessage] = useState("");

  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { mutateAsync: verifyRegistrationMail, isPending } =
    useVerifyRegistrationMail();

  const { mutateAsync: resendMail, isPending: isResending } =
    useStartRegistration();

  useEffect(() => {
    const loadEmail = async () => {
      if (paramEmail) return;

      const [authFlow, storedEmail] = await Promise.all([
        loadAuthFlow(),
        AsyncStorage.getItem(PENDING_EMAIL_KEY),
      ]);

      if (authFlow?.email) setEmail(authFlow.email);
      else if (storedEmail) setEmail(storedEmail);
    };

    loadEmail();
  }, [paramEmail]);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const t = setInterval(() => {
      setResendSeconds((s) => Math.max(s - 1, 0));
    }, 1000);

    return () => clearInterval(t);
  }, [resendSeconds]);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSubmit =
    otp.length === OTP_LENGTH && !!normalizedEmail && !isPending;

  const keepCodeInputVisible = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const focusInput = () => {
    inputRef.current?.focus();
    keepCodeInputVisible();
  };

  const handleVerify = async () => {
    try {
      await verifyRegistrationMail({
        email: normalizedEmail,
        otp,
      });

      const savedDraft = await AsyncStorage.getItem(REGISTRATION_DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        await AsyncStorage.setItem(
          REGISTRATION_DRAFT_KEY,
          JSON.stringify({
            ...draft,
            email: normalizedEmail,
            step: "details",
          }),
        );
      }
      await saveAuthFlow(createRegistrationFlow(normalizedEmail, "details"));
      await AsyncStorage.removeItem(PENDING_EMAIL_KEY);

      Toast.show({
        type: "success",
        text1: "Email verified",
      });

      router.replace({
        pathname: "/(auth)/register",
        params: { verified: "1" },
      });
    } catch (e: any) {
      setOtp("");
      setErrorMessage(e?.message ?? "Error");
      focusInput();
    }
  };

  const handleResend = async () => {
    if (resendSeconds > 0 || isResending) return;

    try {
      await resendMail({ email: normalizedEmail });

      setOtp("");
      setResendSeconds(RESEND_COUNTDOWN);

      Toast.show({
        type: "success",
        text1: "Code sent",
      });

      focusInput();
    } catch (e: any) {
      setErrorMessage(e?.message ?? "Error");
    }
  };

  const handleOpenMail = async () => {
    const gmail = "https://mail.google.com";
    const inbox = "message://";

    const canOpen = await Linking.canOpenURL(inbox);

    if (canOpen) {
      Linking.openURL(inbox);
    } else {
      Linking.openURL(gmail);
    }
  };

  const handleStartOver = async () => {
    await clearRegistrationFlow();
    router.replace("/(auth)/register");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={styles.container}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Close */}
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={COLORS.primary} />
        </TouchableOpacity>

        {/* Image */}
        <View style={styles.artWrap}>
          <Coin width={200} height={200} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Enter the code sent to</Text>

          <Text style={styles.email}>{normalizedEmail}</Text>

          {/* OTP INPUT (NOT BROKEN ANYMORE) */}
          <TouchableOpacity activeOpacity={1} onPress={focusInput}>
            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={(v) =>
                setOtp(v.replace(/\D/g, "").slice(0, OTP_LENGTH))
              }
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              onFocus={keepCodeInputVisible}
              style={styles.otpInput}
            />
          </TouchableOpacity>

          {/* CHECK EMAIL */}
          <TouchableOpacity onPress={handleOpenMail} style={styles.linkBtn}>
            <Text style={styles.linkText}>Check your email</Text>
          </TouchableOpacity>

          {/* RESEND */}
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendSeconds > 0 || isResending}
            style={styles.linkBtn}
          >
            <Text style={styles.linkText}>
              {resendSeconds > 0
                ? `Resend in 0:${String(resendSeconds).padStart(2, "0")}`
                : "Resend code"}
            </Text>
          </TouchableOpacity>

          {/* START OVER */}

          {/* BUTTON */}
          <TouchableOpacity
            disabled={!canSubmit}
            onPress={handleVerify}
            style={[styles.button, !canSubmit && { opacity: 0.4 }]}
          >
            <Text style={styles.buttonText}>
              {isPending ? "Checking..." : "Continue"}
            </Text>
          </TouchableOpacity>
          <View
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TouchableOpacity onPress={handleStartOver} style={styles.linkBtn}>
              <Text style={[{ color: "black", opacity: 0.7 }]}>
                Wrong email
              </Text>
              <Text style={[styles.linkText, { opacity: 0.7 }]}>
                Start over
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ErrorModal
          visible={!!errorMessage}
          message={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default VerifyMailScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingTop: 54,
  },

  artWrap: {
    alignItems: "center",
    marginTop: 20,
  },

  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 60,
  },

  title: {
    fontSize: 28,
    color: COLORS.primary,
  },

  email: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "600",
  },

  otpInput: {
    height: 55,
    borderBottomWidth: 2,
    borderBottomColor: "#D8DCE3",
    fontSize: 22,
    color: COLORS.primary,
    letterSpacing: 6,
    textAlign: "left",
  },

  linkBtn: {
    marginTop: 16,
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },

  linkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  button: {
    marginTop: 30,
    alignItems: "center" as const,
    backgroundColor: COLORS.primary,
    borderRadius: Radius.medium,
    height: 52,
    justifyContent: "center" as const,
  },

  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
