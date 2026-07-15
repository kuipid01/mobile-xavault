import { useProfile } from "@/hooks/app/profile";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
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
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E4ECE8",
};

export default function ChangeEmailScreen() {
  const { data: profile } = useProfile();
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/my-profile");
  };

  const handleSendOtp = () => {
    if (!newEmail.includes("@")) {
      Toast.show({ type: "error", text1: "Enter a valid email" });
      return;
    }
    setStep("otp");
    Toast.show({
      type: "info",
      text1: "Verification flow",
      text2: "Backend email change verification will connect here.",
    });
  };

  const handleVerify = () => {
    if (otp.length !== 6) {
      Toast.show({ type: "error", text1: "Enter the 6-digit OTP" });
      return;
    }
    Toast.show({
      type: "info",
      text1: "Email verification",
      text2: "Verification endpoint is coming next.",
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={22} color={C.forest} />
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Ionicons name="mail-outline" size={25} color={C.forest} />
          </View>
          <Text style={styles.title}>Change Email</Text>
          <Text style={styles.subtitle}>Verify a new email before it replaces your current one.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Current Email</Text>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyText}>{profile?.email || "No email found"}</Text>
          </View>

          <Text style={styles.label}>New Email</Text>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="new@email.com"
            placeholderTextColor={C.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={step === "email"}
            style={styles.input}
          />

          {step === "otp" ? (
            <>
              <Text style={styles.label}>Email OTP</Text>
              <TextInput
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                placeholderTextColor={C.faint}
                keyboardType="number-pad"
                style={styles.input}
              />
            </>
          ) : null}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={step === "email" ? handleSendOtp : handleVerify}
          >
            <Text style={styles.primaryText}>
              {step === "email" ? "Send Verification OTP" : "Verify Email"}
            </Text>
          </TouchableOpacity>

          {step === "otp" ? (
            <TouchableOpacity style={styles.textButton} onPress={() => setStep("email")}>
              <Text style={styles.textButtonLabel}>Change email address</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { alignItems: "center", marginBottom: 22 },
  backButton: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { color: C.forest, fontSize: 24, fontWeight: "900" },
  subtitle: { color: C.muted, fontSize: 13, fontWeight: "700", marginTop: 6, textAlign: "center" },
  card: { backgroundColor: C.surface, borderRadius: 22, borderWidth: 1, borderColor: C.border, padding: 18 },
  label: { color: C.forest, fontSize: 13, fontWeight: "900", marginBottom: 8, marginTop: 14 },
  readonlyBox: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  readonlyText: { color: C.muted, fontSize: 15, fontWeight: "700" },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    paddingHorizontal: 14,
    color: C.forest,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  textButton: { alignItems: "center", padding: 14 },
  textButtonLabel: { color: C.forest, fontSize: 14, fontWeight: "900" },
});
