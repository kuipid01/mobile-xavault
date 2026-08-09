import { useProfile } from "@/hooks/app/profile";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const C = {
  forest: "#063B2E",
  forestLight: "#E6F7EF",
  gold: "#D6A84F",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E4ECE8",
  danger: "#B42318",
  dangerSoft: "#FDECEC",
};

type Step = "email" | "otp" | "done";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function ChangeEmailScreen() {
  const { data: profile } = useProfile();
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [step, setStep] = useState<Step>("email");
  const [emailFocused, setEmailFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [otpError, setOtpError] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const progress = useRef(new Animated.Value(0)).current;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const emailIsCurrent =
    !!profile?.email && newEmail.trim().toLowerCase() === profile.email.toLowerCase();

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step === "email" ? 0 : step === "otp" ? 1 : 2,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, progress]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleBack = () => {
    if (step === "otp") {
      setStep("email");
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/my-profile");
  };

  const handleSendOtp = async () => {
    if (!emailValid) {
      Toast.show({ type: "error", text1: "Enter a valid email" });
      return;
    }
    if (emailIsCurrent) {
      Toast.show({ type: "error", text1: "That's already your current email" });
      return;
    }
    setSending(true);
    try {
      // Backend call placeholder — swap for the real mutation.
      await new Promise((resolve) => setTimeout(resolve, 500));
      setStep("otp");
      setOtp(Array(OTP_LENGTH).fill(""));
      setOtpError(false);
      setResendIn(RESEND_SECONDS);
      Toast.show({
        type: "success",
        text1: "Code sent",
        text2: `We sent a 6-digit code to ${newEmail.trim()}`,
      });
      setTimeout(() => otpRefs.current[0]?.focus(), 300);
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setResendIn(RESEND_SECONDS);
    setOtp(Array(OTP_LENGTH).fill(""));
    setOtpError(false);
    otpRefs.current[0]?.focus();
    Toast.show({ type: "info", text1: "Code resent", text2: `Check ${newEmail.trim()}` });
  };

  const handleOtpChange = (value: string, index: number) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const next = [...otp];
      next[index] = "";
      setOtp(next);
      return;
    }
    const next = [...otp];
    // support pasting a full code
    if (digits.length > 1) {
      digits
        .slice(0, OTP_LENGTH - index)
        .split("")
        .forEach((digit, i) => {
          next[index + i] = digit;
        });
      setOtp(next);
      const lastIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      otpRefs.current[lastIndex]?.focus();
      if (next.every((d) => d)) Keyboard.dismiss();
      return;
    }
    next[index] = digits;
    setOtp(next);
    setOtpError(false);
    if (index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
    else Keyboard.dismiss();
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      setOtpError(true);
      Toast.show({ type: "error", text1: "Enter the full 6-digit code" });
      return;
    }
    setVerifying(true);
    try {
      // Backend call placeholder — swap for the real mutation.
      await new Promise((resolve) => setTimeout(resolve, 600));
      setStep("done");
      Toast.show({ type: "success", text1: "Email updated", text2: newEmail.trim() });
    } catch {
      setOtpError(true);
      Toast.show({ type: "error", text1: "Incorrect code", text2: "Please try again." });
    } finally {
      setVerifying(false);
    }
  };

  const widthInterpolated = progress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ["33%", "66%", "100%"],
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={C.forest} />
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Ionicons
              name={step === "done" ? "checkmark-circle" : "mail-outline"}
              size={26}
              color={C.forest}
            />
          </View>
          <Text style={styles.title}>
            {step === "email" ? "Change Email" : step === "otp" ? "Verify It's You" : "All Set"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "email"
              ? "Verify a new email before it replaces your current one."
              : step === "otp"
                ? `Enter the 6-digit code we sent to ${newEmail.trim()}`
                : "Your email has been updated successfully."}
          </Text>
        </View>

        {step !== "done" ? (
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: widthInterpolated }]} />
          </View>
        ) : null}

        <View style={styles.card}>
          {step === "email" ? (
            <>
              <Text style={styles.label}>Current Email</Text>
              <View style={styles.readonlyBox}>
                <Ionicons name="mail-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
                <Text style={styles.readonlyText}>{profile?.email || "No email found"}</Text>
              </View>

              <Text style={[styles.label, { marginTop: 18 }]}>New Email</Text>
              <View
                style={[
                  styles.inputWrap,
                  emailFocused && styles.inputWrapFocused,
                  emailIsCurrent && styles.inputWrapError,
                ]}
              >
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="new@email.com"
                  placeholderTextColor={C.faint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
                {newEmail.length > 0 ? (
                  <Ionicons
                    name={emailValid && !emailIsCurrent ? "checkmark-circle" : "close-circle"}
                    size={18}
                    color={emailValid && !emailIsCurrent ? C.forest : C.faint}
                  />
                ) : null}
              </View>
              {emailIsCurrent ? (
                <Text style={styles.errorHint}>This matches your current email.</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!emailValid || emailIsCurrent || sending) && styles.primaryButtonDisabled,
                ]}
                onPress={handleSendOtp}
                disabled={!emailValid || emailIsCurrent || sending}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryText}>
                  {sending ? "Sending…" : "Send Verification Code"}
                </Text>
                {!sending ? (
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                ) : null}
              </TouchableOpacity>
            </>
          ) : step === "otp" ? (
            <>
              <Text style={styles.label}>Verification Code</Text>
              <View style={styles.otpRow}>
                {otp.map((digit, index) => (
                  <OtpBox
                    key={index}
                    value={digit}
                    error={otpError}
                    autoFocus={index === 0}
                    inputRef={(el) => (otpRefs.current[index] = el)}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(key) => handleOtpKeyPress(key, index)}
                  />
                ))}
              </View>
              {otpError ? (
                <Text style={styles.errorHint}>That code did not match. Try again.</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (otp.some((d) => !d) || verifying) && styles.primaryButtonDisabled,
                ]}
                onPress={handleVerify}
                disabled={otp.some((d) => !d) || verifying}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryText}>{verifying ? "Verifying…" : "Verify Email"}</Text>
              </TouchableOpacity>

              <View style={styles.resendRow}>
                <Text style={styles.resendText}>Did not get a code? </Text>
                <TouchableOpacity onPress={handleResend} disabled={resendIn > 0}>
                  <Text style={[styles.resendLink, resendIn > 0 && styles.resendLinkDisabled]}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.textButton} onPress={() => setStep("email")}>
                <Ionicons name="pencil-outline" size={14} color={C.forest} />
                <Text style={styles.textButtonLabel}>Change email address</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.doneBlock}>
              <View style={styles.doneIconWrap}>
                <Ionicons name="checkmark" size={30} color={C.forest} />
              </View>
              <Text style={styles.doneEmail}>{newEmail.trim()}</Text>
              <Text style={styles.doneSub}>This is now your account email.</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.replace("/(app)/my-profile")}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryText}>Back to Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OtpBox({
  value,
  error,
  autoFocus,
  inputRef,
  onChangeText,
  onKeyPress,
}: {
  value: string;
  error: boolean;
  autoFocus?: boolean;
  inputRef: (el: TextInput | null) => void;
  onChangeText: (value: string) => void;
  onKeyPress: (key: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const internalRef = useRef<TextInput | null>(null);

  return (
    <Pressable onPress={() => internalRef.current?.focus()}>
      <View
        style={[
          styles.otpBox,
          focused && styles.otpBoxFocused,
          error && styles.otpBoxError,
          value && styles.otpBoxFilled,
        ]}
      >
        <TextInput
          ref={(el) => {
            internalRef.current = el;
            inputRef(el);
          }}
          value={value}
          onChangeText={onChangeText}
          onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          style={styles.otpInput}
          selectTextOnFocus
          autoFocus={autoFocus}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { alignItems: "center", marginBottom: 20 },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { color: C.forest, fontSize: 22, fontWeight: "900" },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 12,
  },

  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    marginBottom: 20,
    overflow: "hidden",
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: C.forest },

  card: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    shadowColor: "#0B2E23",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  label: { color: C.forest, fontSize: 12.5, fontWeight: "800", marginBottom: 8 },

  readonlyBox: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F7FAF8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  readonlyText: { color: C.muted, fontSize: 15, fontWeight: "700" },

  inputWrap: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.3,
    borderColor: "transparent",
    backgroundColor: "#F7FAF8",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  inputWrapFocused: { borderColor: C.forest, backgroundColor: "#FFFFFF" },
  inputWrapError: { borderColor: C.danger, backgroundColor: C.dangerSoft },
  input: { flex: 1, color: C.forest, fontSize: 15, fontWeight: "700" },
  errorHint: { color: C.danger, fontSize: 12, fontWeight: "700", marginTop: 8 },

  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 22,
    shadowColor: C.forest,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  primaryButtonDisabled: { opacity: 0.4, shadowOpacity: 0 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },

  otpRow: { flexDirection: "row", justifyContent: "space-between" },
  otpBox: {
    width: 46,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.3,
    borderColor: C.border,
    backgroundColor: "#F7FAF8",
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFocused: { borderColor: C.forest, backgroundColor: "#FFFFFF" },
  otpBoxFilled: { borderColor: C.forest, backgroundColor: C.forestLight },
  otpBoxError: { borderColor: C.danger, backgroundColor: C.dangerSoft },
  otpInput: {
    width: "100%",
    height: "100%",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "900",
    color: C.forest,
  },

  resendRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  resendText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  resendLink: { color: C.forest, fontSize: 13, fontWeight: "900" },
  resendLinkDisabled: { color: C.faint },

  textButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    marginTop: 4,
  },
  textButtonLabel: { color: C.forest, fontSize: 13, fontWeight: "800" },

  doneBlock: { alignItems: "center", paddingVertical: 8 },
  doneIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  doneEmail: { color: C.forest, fontSize: 16, fontWeight: "900" },
  doneSub: { color: C.muted, fontSize: 13, fontWeight: "600", marginTop: 4, marginBottom: 6 },
});
