import { Input } from "@/components/Input";
import { useForgetPassword, useResetPassword } from "@/hooks/auth/auth";
import { COLORS, Padding } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { ErrorModal } from "../ui/ErrorModal";

const getApiErrorMessage = (error: any) => {
  const data = error?.response?.data;
  if (data?.error && typeof data.error === "object") {
    const firstError = Object.values(data.error)[0];
    if (typeof firstError === "string") return firstError;
  }
  if (typeof data?.message === "string") return data.message;
  if (typeof error?.message === "string") return error.message;
  return "Please try again.";
};

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [viewPassword, setViewPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { mutateAsync: requestReset, isPending: isRequesting } =
    useForgetPassword();
  const { mutateAsync: resetPassword, isPending: isResetting } =
    useResetPassword();

  const handleRequestReset = async () => {
    try {
      await requestReset({ email: email.trim().toLowerCase() });
      Toast.show({
        type: "success",
        text1: "OTP sent",
        text2: "Check your email for the reset code.",
      });
      setStep("reset");
    } catch (error: any) {
      setErrorMessage(`Could not send OTP\n${getApiErrorMessage(error)}`);
    }
  };

  const handleResetPassword = async () => {
    if (otp.length !== 6) {
      setErrorMessage("Enter OTP\nThe code must be 6 digits.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      await resetPassword({
        otp,
        password,
        confirm_password: confirmPassword,
      });
      Toast.show({
        type: "success",
        text1: "Password reset",
        text2: "You can now sign in.",
      });
      router.replace("/(auth)/login");
    } catch (error: any) {
      setErrorMessage(`Could not reset password\n${getApiErrorMessage(error)}`);
    }
  };

  const isPending = isRequesting || isResetting;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          {step === "email"
            ? "Enter your email and we will send a reset OTP."
            : "Enter the OTP from your email and choose a new password."}
        </Text>
      </View>

      <View style={styles.card}>
        {step === "email" ? (
          <>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
            />
            <TouchableOpacity
              style={[styles.button, isPending && styles.buttonDisabled]}
              disabled={isPending}
              onPress={handleRequestReset}
            >
              <Text style={styles.buttonText}>
                {isRequesting ? "Sending..." : "Send OTP"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Input
              label="OTP"
              placeholder="Enter 6-digit OTP"
              value={otp}
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) =>
                setOtp(value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <Input
              label="New Password"
              placeholder="Enter new password"
              value={password}
              secureTextEntry
              viewPassword={viewPassword}
              setViewPassword={setViewPassword}
              onChangeText={setPassword}
            />
            <Input
              label="Confirm Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              secureTextEntry
              viewPassword={viewPassword}
              setViewPassword={setViewPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={[styles.button, isPending && styles.buttonDisabled]}
              disabled={isPending}
              onPress={handleResetPassword}
            >
              <Text style={styles.buttonText}>
                {isResetting ? "Resetting..." : "Reset Password"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <ErrorModal
        visible={!!errorMessage}
        message={errorMessage}
        onClose={() => setErrorMessage("")}
      />
    </ScrollView>
  );
}

const styles = {
  container: {
    backgroundColor: COLORS.hash,
    flexGrow: 1,
    justifyContent: "center" as const,
    paddingHorizontal: Padding.containerX,
    paddingVertical: Padding.containerY,
  },

  backButton: {
    alignItems: "center" as const,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    height: 44,
    justifyContent: "center" as const,
    marginBottom: 28,
    width: 44,
  },

  header: {
    marginBottom: 24,
  },

  title: {
    color: COLORS.primary,
    fontFamily: "System",
    fontSize: 28,
    marginBottom: 8,
  },

  subtitle: {
    color: "#6B7280",
    fontFamily: "System",
    fontSize: 14,
    lineHeight: 21,
  },

  card: {
    backgroundColor: COLORS.white,
    borderColor: "#E7ECE9",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 4,
    padding: 20,
    shadowColor: "#063B2E",
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },

  button: {
    alignItems: "center" as const,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center" as const,
    marginTop: 6,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: COLORS.white,
    fontFamily: "System",
    fontSize: 15,
  },
};
