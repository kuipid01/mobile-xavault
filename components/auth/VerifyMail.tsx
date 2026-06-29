import { useValidateMail } from "@/hooks/auth/auth";
import { COLORS, Padding } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

const getApiErrorMessage = (error: any) => {
  const data = error?.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (typeof error?.message === "string") return error.message;
  return "Please try again.";
};

const VerifyMailScreen = () => {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const [otp, setOtp] = useState("");
  const inputRef = useRef<TextInput>(null);
  const { mutateAsync: validateMail, isPending } = useValidateMail();

  const handleSubmit = async () => {
    if (otp.length !== 6) {
      Toast.show({
        type: "error",
        text1: "Enter OTP",
        text2: "The code must be 6 digits.",
      });
      return;
    }

    try {
      await validateMail({ email, otp });
      Toast.show({
        type: "success",
        text1: "Email verified",
        text2: "You can now log in.",
      });
      router.replace("/(auth)/login");
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Could not verify email",
        text2: getApiErrorMessage(error),
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <Text style={styles.title}>Verify email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit OTP we sent to {email || "your email"}.
        </Text>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => inputRef.current?.focus()}
          style={styles.otpRow}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <View
              key={index}
              style={[styles.otpBox, otp[index] && styles.otpBoxFilled]}
            >
              <Text style={styles.otpText}>{otp[index] || ""}</Text>
            </View>
          ))}
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.hiddenInput}
          textContentType="oneTimeCode"
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, isPending && styles.buttonDisabled]}
          disabled={isPending}
          onPress={handleSubmit}
        >
          <Text style={styles.buttonText}>
            {isPending ? "Verifying..." : "Verify OTP"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.footerText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default VerifyMailScreen;

const styles = {
  container: {
    backgroundColor: COLORS.hash,
    flex: 1,
    justifyContent: "center" as const,
    paddingHorizontal: Padding.containerX,
    paddingVertical: Padding.containerY,
  },

  card: {
    backgroundColor: COLORS.white,
    borderColor: "#E7ECE9",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 4,
    padding: 22,
    shadowColor: "#063B2E",
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },

  backButton: {
    alignItems: "center" as const,
    backgroundColor: "#F4F6F5",
    borderRadius: 14,
    height: 42,
    justifyContent: "center" as const,
    marginBottom: 24,
    width: 42,
  },

  title: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 28,
    marginBottom: 8,
  },

  subtitle: {
    color: "#6B7280",
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 28,
  },

  otpRow: {
    flexDirection: "row" as const,
    gap: 8,
    justifyContent: "space-between" as const,
    marginBottom: 28,
  },

  otpBox: {
    alignItems: "center" as const,
    backgroundColor: "#F7F8FA",
    borderColor: "#E1E7E4",
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: "center" as const,
    width: 42,
  },

  otpBoxFilled: {
    borderColor: COLORS.primary,
  },

  otpText: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
  },

  hiddenInput: {
    height: 0,
    opacity: 0,
    position: "absolute" as const,
    width: 0,
  },

  button: {
    alignItems: "center" as const,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center" as const,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: COLORS.white,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
  },

  footerText: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    marginTop: 20,
    textAlign: "center" as const,
  },
};
