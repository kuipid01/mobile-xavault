import { Input } from "@/components/Input";
import { useLogin } from "@/hooks/auth/auth";
import { COLORS, Radius } from "@/themes/colors";
import { router } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

const LoginScreen = () => {
  const [viewPassword, setViewPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutateAsync: login, isPending } = useLogin();

  const handleLogin = async () => {
    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      });
      Toast.show({
        type: "success",
        text1: "Login successful",
        text2: "Welcome back to XAVAULT.",
      });
      router.replace("/(app)/home");
    } catch (error) {
      console.error("Login failed:", error);
      Toast.show({
        type: "error",
        text1: "Login failed",
        text2: "Please check your credentials and try again.",
      });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>XA</Text>
      </View>
      <Text style={styles.brand}>XAVAULT</Text>

      <View style={styles.segment}>
        <TouchableOpacity style={styles.segmentActive}>
          <Text style={styles.segmentActiveText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/register")}
          style={styles.segmentItem}
        >
          <Text style={styles.segmentText}>Sign up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Welcome back,</Text>
        <Text style={styles.subtitle}>Good to see you again.</Text>
      </View>

      <View style={styles.card}>
        <Input
          label="Email"
          placeholder="Enter your email"
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          viewPassword={viewPassword}
          setViewPassword={setViewPassword}
        />

        <TouchableOpacity
          onPress={() => router.push("/(auth)/forgot-password")}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isPending && styles.buttonDisabled]}
          disabled={isPending}
          onPress={handleLogin}
        >
          <Text style={styles.buttonText}>
            {isPending ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>

        <Text
          onPress={() => router.push("/(auth)/register")}
          style={styles.footerText}
        >
          Don&apos;t have an account?{" "}
          <Text style={styles.link}>Create one</Text>
        </Text>
      </View>
    </ScrollView>
  );
};

export default LoginScreen;

const styles = {
  container: {
    backgroundColor: "#F6F7FB",
    flexGrow: 1,
    justifyContent: "center" as const,
    paddingHorizontal: 24,
  },

  brand: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
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
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 12,
  },

  segmentActiveText: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 12,
  },

  header: {
    alignItems: "flex-start" as const,
    marginBottom: 18,
  },

  title: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 27,
    marginBottom: 6,
  },

  subtitle: {
    color: "#6B7280",
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 13,
  },

  card: {
    backgroundColor: COLORS.white,
    borderColor: "#E7ECE9",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 4,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },

  button: {
    alignItems: "center" as const,
    backgroundColor: COLORS.primary,
    borderRadius: Radius.medium,
    height: 48,
    justifyContent: "center" as const,
    marginTop: 2,
  },

  buttonText: {
    color: "white",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 13,
    letterSpacing: 1.2,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  forgotText: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 12,
    marginBottom: 14,
    marginTop: -4,
    textAlign: "right" as const,
  },

  footerText: {
    color: "#6B7280",
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center" as const,
  },

  link: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_600SemiBold",
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
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 20,
  },
};
