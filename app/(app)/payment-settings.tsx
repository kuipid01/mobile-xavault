import {
  useForgotWithdrawalPin,
  useResetWithdrawalPin,
  useSetWithdrawalPin,
  useVerifyWithdrawalPin,
  useWithdrawalPinStatus,
} from "@/hooks/app/withdrawal-pin";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
  forestMid: "#0F6B4F",
  forestLight: "#E6F7EF",
  gold: "#D6A84F",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E4ECE8",
  danger: "#B42318",
  dangerBg: "#FFF1F3",
};

const PIN_LENGTH = 4;
const OTP_LENGTH = 6;

type Mode = "menu" | "create" | "verify_current" | "new_pin" | "forgot";

const cleanPin = (value: string) => value.replace(/\D/g, "").slice(0, PIN_LENGTH);
const cleanOtp = (value: string) => value.replace(/\D/g, "").slice(0, OTP_LENGTH);

function PinInput({
  label,
  value,
  onChangeText,
  length = PIN_LENGTH,
  autoFocus,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        secureTextEntry={length === PIN_LENGTH}
        maxLength={length}
        autoFocus={autoFocus}
        style={styles.input}
        placeholder={length === OTP_LENGTH ? "Enter 6-digit code" : "Enter 4-digit PIN"}
        placeholderTextColor={C.faint}
      />
      <View style={styles.dots}>
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[styles.dot, value.length > index && styles.dotFilled]}
          />
        ))}
      </View>
    </View>
  );
}

export default function PaymentSettingsScreen() {
  const { data: pinStatus, isLoading } = useWithdrawalPinStatus();
  const { mutateAsync: setPaymentPin, isPending: isSaving } = useSetWithdrawalPin();
  const { mutateAsync: verifyPaymentPin, isPending: isChecking } =
    useVerifyWithdrawalPin();
  const { mutateAsync: forgotPaymentPin, isPending: isSendingOtp } =
    useForgotWithdrawalPin();
  const { mutateAsync: resetPaymentPin, isPending: isResetting } =
    useResetWithdrawalPin();

  const hasPin = !!pinStatus?.has_pin;
  const [mode, setMode] = useState<Mode>("menu");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otp, setOtp] = useState("");

  const busy = isSaving || isChecking || isSendingOtp || isResetting;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/profile");
  };

  useEffect(() => {
    if (!isLoading && !hasPin) setMode("create");
  }, [hasPin, isLoading]);

  const resetForm = (nextMode: Mode = "menu") => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setOtp("");
    setMode(nextMode);
  };

  const saveNewPin = async () => {
    if (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
      Toast.show({ type: "error", text1: "Enter a 4-digit PIN twice" });
      return;
    }
    if (newPin !== confirmPin) {
      Toast.show({ type: "error", text1: "PINs do not match" });
      setConfirmPin("");
      return;
    }

    try {
      await setPaymentPin(newPin);
      Toast.show({ type: "success", text1: "Payment PIN saved" });
      resetForm("menu");
    } catch {
      Toast.show({ type: "error", text1: "Could not save payment PIN" });
    }
  };

  const checkCurrentPin = async () => {
    if (currentPin.length !== PIN_LENGTH) {
      Toast.show({ type: "error", text1: "Enter your current PIN" });
      return;
    }

    try {
      await verifyPaymentPin(currentPin);
      Toast.show({ type: "success", text1: "PIN confirmed" });
      setMode("new_pin");
    } catch {
      Toast.show({
        type: "error",
        text1: "Incorrect payment PIN",
        text2: "Please check your PIN or use forgot PIN.",
      });
      setCurrentPin("");
    }
  };

  const sendForgotOtp = async () => {
    try {
      await forgotPaymentPin();
      Toast.show({ type: "success", text1: "OTP sent to your email" });
      resetForm("forgot");
    } catch {
      Toast.show({ type: "error", text1: "Could not send OTP" });
    }
  };

  const resetWithOtp = async () => {
    if (otp.length !== OTP_LENGTH) {
      Toast.show({ type: "error", text1: "Enter the email OTP" });
      return;
    }
    if (newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH) {
      Toast.show({ type: "error", text1: "Enter a 4-digit PIN twice" });
      return;
    }
    if (newPin !== confirmPin) {
      Toast.show({ type: "error", text1: "PINs do not match" });
      setConfirmPin("");
      return;
    }

    try {
      await resetPaymentPin({ otp, pin: newPin });
      Toast.show({ type: "success", text1: "Payment PIN changed" });
      resetForm("menu");
    } catch {
      Toast.show({
        type: "error",
        text1: "Could not change PIN",
        text2: "Check the OTP and try again.",
      });
      setOtp("");
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={C.forest} />
          <Text style={styles.loadingText}>Checking payment PIN status...</Text>
        </View>
      );
    }

    if (mode === "menu") {
      return (
        <View style={styles.card}>
          <ActionRow
            icon="keypad-outline"
            label="Change Payment PIN"
            sublabel="Confirm your current PIN first"
            onPress={() => resetForm("verify_current")}
          />
          <View style={styles.divider} />
          <ActionRow
            icon="mail-outline"
            label="Forgot Payment PIN"
            sublabel="Send an OTP to your email"
            onPress={sendForgotOtp}
            loading={isSendingOtp}
          />
        </View>
      );
    }

    if (mode === "verify_current") {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change Payment PIN</Text>
          <Text style={styles.cardSub}>Enter your current PIN so we can check it.</Text>
          <PinInput
            label="Current PIN"
            value={currentPin}
            onChangeText={(value) => setCurrentPin(cleanPin(value))}
            autoFocus
          />
          <PrimaryButton
            label="Check PIN"
            loading={isChecking}
            disabled={currentPin.length !== PIN_LENGTH}
            onPress={checkCurrentPin}
          />
          <TextButton label="Forgot PIN?" onPress={sendForgotOtp} loading={isSendingOtp} />
        </View>
      );
    }

    if (mode === "forgot") {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Forgot Payment PIN</Text>
          <Text style={styles.cardSub}>
            Enter the OTP sent to your email, then choose a new PIN.
          </Text>
          <PinInput
            label="Email OTP"
            value={otp}
            onChangeText={(value) => setOtp(cleanOtp(value))}
            length={OTP_LENGTH}
            autoFocus
          />
          <PinInput
            label="New PIN"
            value={newPin}
            onChangeText={(value) => setNewPin(cleanPin(value))}
          />
          <PinInput
            label="Confirm New PIN"
            value={confirmPin}
            onChangeText={(value) => setConfirmPin(cleanPin(value))}
          />
          <PrimaryButton
            label="Save New PIN"
            loading={isResetting}
            disabled={
              otp.length !== OTP_LENGTH ||
              newPin.length !== PIN_LENGTH ||
              confirmPin.length !== PIN_LENGTH
            }
            onPress={resetWithOtp}
          />
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {mode === "create" ? "Create Payment PIN" : "Set New Payment PIN"}
        </Text>
        <Text style={styles.cardSub}>
          Enter your new 4-digit PIN twice so we can save it.
        </Text>
        <PinInput
          label="New PIN"
          value={newPin}
          onChangeText={(value) => setNewPin(cleanPin(value))}
          autoFocus
        />
        <PinInput
          label="Confirm New PIN"
          value={confirmPin}
          onChangeText={(value) => setConfirmPin(cleanPin(value))}
        />
        <PrimaryButton
          label="Save Payment PIN"
          loading={isSaving}
          disabled={newPin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
          onPress={saveNewPin}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={22} color={C.forest} />
            </TouchableOpacity>
            <View style={styles.headerIcon}>
              <Ionicons name="card-outline" size={26} color={C.forest} />
            </View>
            <Text style={styles.title}>Payment Settings</Text>
            <Text style={styles.subtitle}>
              Manage the PIN used to approve payments and withdrawals.
            </Text>
          </View>

          {renderBody()}

          {hasPin && mode !== "menu" ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => resetForm("menu")}
              disabled={busy}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ActionRow({
  icon,
  label,
  sublabel,
  onPress,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={loading}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={C.forest} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sublabel}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={C.forest} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={C.faint} />
      )}
    </TouchableOpacity>
  );
}

function PrimaryButton({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.primaryButton, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

function TextButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.textButton} onPress={onPress} disabled={loading}>
      <Text style={styles.textButtonLabel}>{loading ? "Sending OTP..." : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { alignItems: "center", marginBottom: 24 },
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
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { color: C.forest, fontSize: 24, fontWeight: "900", textAlign: "center" },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 300,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    shadowColor: C.forest,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  loadingCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  cardTitle: { color: C.forest, fontSize: 18, fontWeight: "900" },
  cardSub: { color: C.muted, fontSize: 13, fontWeight: "600", marginTop: 6, lineHeight: 19 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 56 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
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
  rowSub: { color: C.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  inputGroup: { marginTop: 20 },
  inputLabel: { color: C.forest, fontSize: 13, fontWeight: "800", marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    paddingHorizontal: 16,
    color: C.forest,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 4,
  },
  dots: { flexDirection: "row", gap: 8, marginTop: 10 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotFilled: { backgroundColor: C.gold },
  primaryButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.45 },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  textButton: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 14, marginTop: 8 },
  textButtonLabel: { color: C.forestMid, fontSize: 14, fontWeight: "900" },
  cancelButton: {
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 14,
  },
  cancelText: { color: C.danger, fontSize: 14, fontWeight: "900" },
});
