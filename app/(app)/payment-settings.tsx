import {
  useForgotWithdrawalPin,
  useResetWithdrawalPin,
  useSetWithdrawalPin,
  useVerifyWithdrawalPin,
  useWithdrawalPinStatus,
} from "@/hooks/app/withdrawal-pin";
import { useActiveSubscription } from "@/hooks/app/subscription";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
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
  ink: "#0F1F1A",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E9EFEC",
  danger: "#B42318",
};

const PIN_LENGTH = 4;
const OTP_LENGTH = 6;

type Mode = "menu" | "create" | "verify_current" | "new_pin" | "forgot" | "fees";

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
	const { data: subscription } = useActiveSubscription({ enabled: true });

  const hasPin = !!pinStatus?.has_pin;
  const [mode, setMode] = useState<Mode>("menu");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [otp, setOtp] = useState("");

  const busy = isSaving || isChecking || isSendingOtp || isResetting;

  const handleBack = () => {
	if (mode !== "menu") {
	  resetForm("menu");
	  return;
	}
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/profile");
  };

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
		<View style={styles.settingsList}>
		  <Text style={styles.sectionLabel}>PAYMENT SECURITY</Text>
		  <View style={styles.card}>
			<ActionRow
			  icon="keypad-outline"
			  label="Withdrawal PIN"
			  sublabel={hasPin ? "Used to approve every withdrawal" : "Not set · required before your first withdrawal"}
			  status={hasPin ? "Set" : "Not set"}
			  onPress={() => resetForm(hasPin ? "verify_current" : "create")}
			  last
			/>
		  </View>

		  <Text style={styles.sectionLabel}>FEES AND PLAN</Text>
		  <View style={styles.card}>
			<ActionRow
			  icon="receipt-outline"
			  label="Fees and allowances"
			  sublabel="Deposit charges and included withdrawals"
			  onPress={() => setMode("fees")}
			/>
			<View style={styles.divider} />
			<ActionRow
			  icon="sparkles-outline"
			  label="Subscription plan"
			  sublabel="Review capacity and plan benefits"
			  status={subscription?.plan?.Name || "Free"}
			  onPress={() => router.push("/(app)/upgrade-plan")}
			  last
			/>
		  </View>

		  <Text style={styles.sectionLabel}>PAYMENT ACTIVITY</Text>
		  <View style={styles.card}>
			<ActionRow
			  icon="time-outline"
			  label="Transaction history"
			  sublabel="Deposits, withdrawals and reversals"
			  onPress={() => router.push("/(app)/transactions")}
			  last
			/>
		  </View>
		</View>
      );
    }

	if (mode === "fees") {
	  const included = subscription?.plan?.FreeWithdrawalsMonthly ?? 0;
	  return (
		<View style={styles.card}>
		  <Text style={styles.cardTitle}>Fees and allowances</Text>
		  <Text style={styles.cardSub}>The exact charge is always shown before you confirm.</Text>
		  <FeeRow label="Current plan" value={subscription?.plan?.Name || "Free"} />
		  <FeeRow label="Included withdrawals" value={`${included} per month`} />
		  <View style={styles.feeDivider} />
		  <FeeRow label="Paystack checkout" value="1.5% + NGN 100" note="NGN 100 waived below NGN 2,500 · capped at NGN 2,000" />
		  <FeeRow label="Bank-transfer deposit" value="1%" note="Capped at NGN 300" />
		  <FeeRow label="Withdrawal transfer" value="NGN 10 / 25 / 50" note="Based on transfer amount; applicable levy is quoted separately" />
		  <PrimaryButton label="Review plans" onPress={() => router.push("/(app)/upgrade-plan")} />
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
            <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={C.forest} />
            </TouchableOpacity>
            <Text style={styles.title}>Payment Settings</Text>
            <Text style={styles.subtitle}>
              Manage withdrawal security, fees, your plan and payment activity.
            </Text>
          </View>

          {renderBody()}

		  {mode !== "menu" ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => resetForm("menu")}
              disabled={busy}
              activeOpacity={0.7}
            >
			  <Text style={styles.cancelText}>
				{mode === "fees" ? "Back to payment settings" : "Cancel"}
			  </Text>
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
  status,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
  loading?: boolean;
  status?: string;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.6}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={19} color={C.forest} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sublabel}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={C.forest} />
      ) : (
		<View style={styles.rowEnd}>
		  {status ? <Text style={styles.rowStatus}>{status}</Text> : null}
		  <Ionicons name="chevron-forward" size={17} color={C.faint} />
		</View>
      )}
    </TouchableOpacity>
  );
}

function FeeRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
	<View style={styles.feeRow}>
	  <View style={styles.feeRowTop}>
		<Text style={styles.feeLabel}>{label}</Text>
		<Text style={styles.feeValue}>{value}</Text>
	  </View>
	  {note ? <Text style={styles.feeNote}>{note}</Text> : null}
	</View>
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
    <TouchableOpacity style={styles.textButton} onPress={onPress} disabled={loading} activeOpacity={0.6}>
      <Text style={styles.textButtonLabel}>{loading ? "Sending OTP..." : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  header: { alignItems: "center", marginBottom: 26 },
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
    shadowColor: C.ink,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { color: C.ink, fontSize: 21, fontWeight: "700", textAlign: "center" },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
    maxWidth: 290,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    shadowColor: C.ink,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
	settingsList: { gap: 10 },
	sectionLabel: {
	  color: C.faint,
	  fontSize: 11,
	  fontWeight: "800",
	  letterSpacing: 0.8,
	  marginTop: 8,
	  marginLeft: 4,
	},
  loadingCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 30,
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  cardTitle: { color: C.ink, fontSize: 17, fontWeight: "700" },
  cardSub: { color: C.muted, fontSize: 13, fontWeight: "500", marginTop: 6, lineHeight: 19 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 56 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  rowLast: {},
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowLabel: { color: C.ink, fontSize: 14.5, fontWeight: "700" },
  rowSub: { color: C.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },
	rowEnd: { flexDirection: "row", alignItems: "center", gap: 6 },
	rowStatus: { color: C.forestMid, fontSize: 12, fontWeight: "800" },
	feeRow: { marginTop: 20 },
	feeRowTop: { flexDirection: "row", justifyContent: "space-between", gap: 16 },
	feeLabel: { flex: 1, color: C.ink, fontSize: 13.5, fontWeight: "700" },
	feeValue: { color: C.forest, fontSize: 13.5, fontWeight: "800", textAlign: "right" },
	feeNote: { color: C.muted, fontSize: 11.5, lineHeight: 17, marginTop: 4 },
	feeDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginTop: 20 },
  inputGroup: { marginTop: 20 },
  inputLabel: { color: C.ink, fontSize: 12.5, fontWeight: "700", marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    paddingHorizontal: 16,
    color: C.ink,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 4,
  },
  dots: { flexDirection: "row", gap: 8, marginTop: 10 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#D9DEDB",
  },
  dotFilled: { backgroundColor: C.gold },
  primaryButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: C.forest,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    shadowColor: C.forest,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.4, shadowOpacity: 0 },
  primaryText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "700", letterSpacing: 0.2 },
  textButton: { alignSelf: "center", paddingHorizontal: 16, paddingVertical: 14, marginTop: 6 },
  textButtonLabel: { color: C.forestMid, fontSize: 13.5, fontWeight: "700" },
  cancelButton: {
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 12,
  },
	cancelText: { color: C.forestMid, fontSize: 13.5, fontWeight: "700" },
});
