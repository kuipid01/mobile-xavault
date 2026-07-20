import { getAccessToken } from "@/api/auth";
import { useForgetPassword, useResetPassword } from "@/hooks/auth/auth";
import {
  disableBiometricLogin,
  enrollBiometricLogin,
  getBiometricAvailability,
} from "@/lib/biometric-auth";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

const C = {
  forest: "#063B2E",
  forestMid: "#0F6B4F",
  forestLight: "#E6F7EF",
  gold: "#D6A84F",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E4ECE8",
};

type JwtWithEmail = { email?: string; sub?: string;[key: string]: unknown };
type PasswordMode = "menu" | "forgot";

export default function LoginSettingsScreen() {
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<PasswordMode>("menu");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricSessionReady, setBiometricSessionReady] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const { mutateAsync: requestReset, isPending: isRequesting } = useForgetPassword();
  const { mutateAsync: resetPassword, isPending: isResetting } = useResetPassword();

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/profile");
  };

  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) return;
      try {
        const payload = jwtDecode<JwtWithEmail>(token);
        setEmail(payload.email ?? payload.sub ?? "");
      } catch {
        setEmail("");
      }
    });
  }, []);

  useEffect(() => {
    (async () => {
      const availability = await getBiometricAvailability();
      setBiometricSupported(availability.deviceReady);
      setBiometricSessionReady(
        availability.accessTokenValid || availability.credentialReady,
      );
      setBiometricEnabled(availability.enabled && availability.sessionRecoverable);
    })();
  }, []);

  const toggleBiometric = async (value: boolean) => {
    if (!value) {
      await disableBiometricLogin();
      setBiometricEnabled(false);
      Toast.show({ type: "success", text1: "Biometric login disabled" });
      return;
    }

    const availability = await getBiometricAvailability();
    console.log("[AVAILABILY DUIDI", availability)
    setBiometricSupported(availability.deviceReady);
    setBiometricSessionReady(
      availability.accessTokenValid || availability.credentialReady,
    );

    if (!availability.deviceReady) {
      Toast.show({ type: "error", text1: "Biometrics are not available on this device" });
      return;
    }

    if (!availability.accessTokenValid) {
      Toast.show({ type: "error", text1: "Sign in again first" });
      return;
    }

    try {
      const enrolled = await enrollBiometricLogin();
      if (!enrolled) return;
      setBiometricEnabled(true);
      setBiometricSessionReady(true);
      Toast.show({ type: "success", text1: "Biometric login enabled" });
    } catch (error) {
      console.error("Could not enable biometric login", error);
      Toast.show({ type: "error", text1: "Could not enable biometric login" });
    }
  };

  const startForgotPassword = async () => {
    if (!email) {
      Toast.show({ type: "error", text1: "Email not found" });
      return;
    }

    try {
      await requestReset({ email });
      setMode("forgot");
      Toast.show({ type: "success", text1: "OTP sent to your email" });
    } catch {
      Toast.show({ type: "error", text1: "Could not send OTP" });
    }
  };

  const submitReset = async () => {
    if (otp.length !== 6) {
      Toast.show({ type: "error", text1: "Enter the 6-digit OTP" });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: "error", text1: "Passwords do not match" });
      return;
    }

    try {
      await resetPassword({ otp, password, confirm_password: confirmPassword });
      setOtp("");
      setPassword("");
      setConfirmPassword("");
      setMode("menu");
      Toast.show({ type: "success", text1: "Password changed" });
    } catch {
      Toast.show({ type: "error", text1: "Could not change password" });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header title="Login Settings" subtitle="Control how you sign in." onBack={handleBack} />

        {mode === "menu" ? (
          <View style={styles.card}>
            <ActionRow
              icon="key-outline"
              label="Change Password"
              sublabel="Current password change is coming soon"
              pill="Upcoming"
              onPress={() => Toast.show({ type: "info", text1: "Change password is coming soon" })}
            />
            <View style={styles.divider} />
            <ActionRow
              icon="mail-outline"
              label="Forgot Password"
              sublabel="Send an OTP to your email"
              loading={isRequesting}
              onPress={startForgotPassword}
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Forgot Password</Text>
            <Text style={styles.cardSub}>Enter the OTP from your email and choose a new password.</Text>
            <Field
              label="Email OTP"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit OTP"
              keyboardType="number-pad"
            />
            <Field
              label="New Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter new password"
              secure
            />
            <Field
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secure
            />
            <TouchableOpacity style={styles.primaryButton} onPress={submitReset} disabled={isResetting}>
              {isResetting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Reset Password</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.textButton} onPress={() => setMode("menu")}>
              <Text style={styles.textButtonLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.rowIcon}>
              <Ionicons name="finger-print-outline" size={20} color={C.forest} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Biometric Login</Text>
              <Text style={styles.rowSub}>
                {!biometricSupported
                  ? "Not available on this device"
                  : biometricSessionReady
                    ? "Use Face ID or fingerprint"
                    : "Sign in again before enabling"}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              disabled={!biometricSupported || !biometricSessionReady}
              onValueChange={toggleBiometric}
              trackColor={{ false: "#D1D5DB", true: C.forestMid }}
              thumbColor={biometricEnabled ? C.gold : "#F3F4F6"}
            />
          </View>
          <View style={styles.divider} />
          <ActionRow
            icon="grid-outline"
            label="Setup Pattern"
            sublabel="Pattern unlock will be added soon"
            pill="Upcoming"
            onPress={() => Toast.show({ type: "info", text1: "Pattern setup is coming soon" })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color={C.forest} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  loading,
  pill,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
  loading?: boolean;
  pill?: string;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} disabled={loading}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={C.forest} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sublabel}</Text>
      </View>
      {loading ? <ActivityIndicator color={C.forest} /> : pill ? <Text style={styles.pill}>{pill}</Text> : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "number-pad";
  secure?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        style={styles.input}
      />
    </View>
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
  title: { color: C.forest, fontSize: 24, fontWeight: "900", textAlign: "center" },
  subtitle: { color: C.muted, fontSize: 13, fontWeight: "600", marginTop: 6 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 16,
  },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { color: C.forest, fontSize: 15, fontWeight: "900" },
  rowSub: { color: C.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 8 },
  pill: {
    overflow: "hidden",
    backgroundColor: C.forestLight,
    color: C.forest,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "900",
  },
  cardTitle: { color: C.forest, fontSize: 18, fontWeight: "900" },
  cardSub: { color: C.muted, fontSize: 13, fontWeight: "700", marginTop: 6, marginBottom: 6 },
  field: { marginTop: 14 },
  label: { color: C.forest, fontSize: 13, fontWeight: "900", marginBottom: 8 },
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
    marginTop: 22,
  },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  textButton: { alignItems: "center", padding: 14 },
  textButtonLabel: { color: C.forest, fontSize: 14, fontWeight: "900" },
});
