import { useLogin } from "@/hooks/auth/auth";
import { COLORS, Radius } from "@/themes/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from 'expo-image';
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "../../api/auth";
import { FlatInput } from "../flatinput";
import { ErrorModal } from "../ui/ErrorModal";
import { clearRegistrationFlow } from "./authFlow";

const LoginScreen = () => {
  const [viewPassword, setViewPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("Welcome back");
  const [mailAvailable, setMailAvailable] = useState(false)
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { mutateAsync: login, isPending } = useLogin();
  const { onLoginSuccess } = useAuth();
  useEffect(() => {
    const checkMail = async () => {
      const mailInStorage = await AsyncStorage.getItem("email");
      const nameInStorage = await AsyncStorage.getItem("name");
      if (mailInStorage) {
        setEmail(mailInStorage)
        setMailAvailable(true)
        if (nameInStorage) {
          setTitle(`Welcome back, ${nameInStorage}`)
        }
      }
    }
    checkMail();
  }, [])
  const handleLogin = async () => {
    try {
      const response = await login({
        email: email.trim().toLowerCase(),
        password,
      });

      onLoginSuccess(response.access_token);

      await clearRegistrationFlow();
      await AsyncStorage.setItem("email", email.trim().toLowerCase());

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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >


      <View style={{ width: "100%", justifyContent: "center", alignItems: "center" }}>
        <Image
          source={require("@/assets/images/coin.svg")}
          style={{ width: 250, height: 250, marginBottom: 3 }}
          contentFit="contain"
        />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.card}>

        {!mailAvailable && <FlatInput
          label="Email"
          placeholder="Enter your email"
          value={email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
        />}
        <FlatInput
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
          onPress={() => router.push("/(auth)/initial")}
          style={styles.footerText}
        >
          {/* :TODO USE REAL NAME  */}
          Not Stephen ?
          <Text style={styles.link}>Switch Account</Text>
        </Text>

        {/* //this is just so the keyboard shows on click  */}
        <View
          style={{ height: 100 }}
        >

        </View>



      </View>
      <ErrorModal
        visible={!!errorMessage}
        message={errorMessage}
        onClose={() => setErrorMessage("")}
      />
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
    fontFamily: "System",
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
    fontFamily: "System",
    fontSize: 12,
  },

  segmentActiveText: {
    color: COLORS.primary,
    fontFamily: "System",
    fontSize: 12,
  },

  header: {
    alignItems: "flex-start" as const,
    marginVertical: 8,

  },

  title: {
    color: COLORS.primary,
    fontFamily: "System",
    fontSize: 27,
    marginBottom: 6,
  },

  subtitle: {
    color: "#6B7280",
    fontFamily: "System",
    fontSize: 13,
  },

  card: {



  },

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
    fontFamily: "System",
    fontSize: 13,
    letterSpacing: 1.2,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  forgotText: {
    color: COLORS.primary,
    fontFamily: "System",
    fontSize: 14,
    marginBottom: 14,
    marginTop: -4,
    textAlign: "right" as const,
  },

  footerText: {
    color: "#6B7280",
    fontFamily: "System",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center" as const,
  },

  link: {
    color: COLORS.primary,
    fontFamily: "System",
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
    fontFamily: "System",
    fontSize: 20,
  },
};
