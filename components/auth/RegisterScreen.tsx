import { Input } from "@/components/Input";
import { useRegister } from "@/hooks/auth/auth";
import { COLORS, Padding } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

type SupportedCountry = "NG" | "GH";

const countryMeta: Record<
  SupportedCountry,
  { label: string; maxLength: number; alternateLength: number; hint: string }
> = {
  NG: {
    label: "Nigeria",
    maxLength: 11,
    alternateLength: 10,
    hint: "Use 10 digits, or 11 digits starting with 0.",
  },
  GH: {
    label: "Ghana",
    maxLength: 10,
    alternateLength: 9,
    hint: "Use 9 digits, or 10 digits starting with 0.",
  },
};

const RegisterScreen = () => {
  const [viewPassword, setViewPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<SupportedCountry>("NG");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { mutateAsync: register, isPending } = useRegister();

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

  const handleRegister = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    const selectedCountry = countryMeta[country];
    const validLength =
      cleanPhone.length === selectedCountry.maxLength ||
      cleanPhone.length === selectedCountry.alternateLength;

    if (!validLength) {
      Toast.show({
        type: "error",
        text1: "Check phone number",
        text2: selectedCountry.hint,
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: "error",
        text1: "Passwords do not match",
      });
      return;
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await register({
        email: normalizedEmail,
        password,
        confirm_password: confirmPassword,
        country,
        phone_number: cleanPhone,
      });

      await AsyncStorage.setItem("pendingVerificationEmail", normalizedEmail);

      Toast.show({
        type: "success",
        text1: "Account created",
        text2: "Enter the OTP we sent to your email.",
      });

      router.replace({
        pathname: "/(auth)/verify-mail",
        params: { email: normalizedEmail },
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Registration failed",
        text2: getApiErrorMessage(error),
      });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>Create an account</Text>
          <Text style={styles.subtitle}>
            Start protecting your plans with email OTP verification.
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Input
          placeholder="Enter email"
          label="Email"
          icon="mail-outline"
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />

        <Text style={styles.segmentLabel}>Country</Text>
        <View style={styles.countryGroup}>
          {(["NG", "GH"] as SupportedCountry[]).map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setCountry(option);
                setPhone("");
              }}
              style={[
                styles.countryOption,
                country === option && styles.countryOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.countryText,
                  country === option && styles.countryTextActive,
                ]}
              >
                {countryMeta[option].label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          placeholder={country === "NG" ? "08012345678" : "0241234567"}
          label="Phone Number"
          icon="call-outline"
          value={phone}
          keyboardType="phone-pad"
          maxLength={countryMeta[country].maxLength}
          onChangeText={(value) => setPhone(value.replace(/\D/g, ""))}
        />

        <Input
          placeholder="Enter password"
          label="Password"
          icon="lock-closed-outline"
          secureTextEntry
          viewPassword={viewPassword}
          setViewPassword={setViewPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Input
          placeholder="Confirm password"
          label="Confirm Password"
          icon="lock-closed-outline"
          secureTextEntry
          viewPassword={viewPassword}
          setViewPassword={setViewPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity
          style={[styles.button, isPending && styles.buttonDisabled]}
          disabled={isPending}
          onPress={handleRegister}
        >
          <Text style={styles.buttonText}>
            {isPending ? "Creating..." : "Create Account"}
          </Text>
        </TouchableOpacity>
      </View>

      <Pressable onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.footerText}>
          Already have an account? <Text style={styles.link}>Log in</Text>
        </Text>
      </Pressable>
    </ScrollView>
  );
};

export default RegisterScreen;

const styles = {
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.hash,
    paddingHorizontal: Padding.containerX,
    paddingVertical: Padding.containerY,
  },

  header: {
    marginTop: 20,
  },

  backButton: {
    alignItems: "center" as const,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    height: 44,
    justifyContent: "center" as const,
    width: 44,
  },

  titleContainer: {
    alignItems: "center" as const,
    marginTop: 24,
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
    paddingHorizontal: 10,
    textAlign: "center" as const,
  },

  form: {
    backgroundColor: COLORS.white,
    borderColor: "#E7ECE9",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 3,
    marginTop: 32,
    padding: 18,
    shadowColor: "#063B2E",
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },

  segmentLabel: {
    color: COLORS.text,
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },

  countryGroup: {
    backgroundColor: "#F4F6F5",
    borderRadius: 12,
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 14,
    padding: 5,
  },

  countryOption: {
    alignItems: "center" as const,
    borderRadius: 9,
    flex: 1,
    height: 42,
    justifyContent: "center" as const,
  },

  countryOptionActive: {
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: "#063B2E",
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },

  countryText: {
    color: "#72807A",
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 13,
  },

  countryTextActive: {
    color: COLORS.primary,
  },

  button: {
    alignItems: "center" as const,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center" as const,
    marginTop: 20,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: "white",
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 15,
  },

  footerText: {
    color: COLORS.text,
    fontFamily: "PlayfairDisplay_400Regular",
    marginTop: 20,
    textAlign: "center" as const,
  },

  link: {
    color: COLORS.primary,
    fontFamily: "PlayfairDisplay_700Bold",
  },
};
