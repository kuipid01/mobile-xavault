import { AppScreenHeader } from "@/components/ui/AppScreenHeader";
import { useActiveSubscription } from "@/hooks/app/subscription";
import {
  useForgotWithdrawalPin,
  useResetWithdrawalPin,
  useSetWithdrawalPin,
  useVerifyWithdrawalPin,
  useWithdrawalPinStatus,
} from "@/hooks/app/withdrawal-pin";
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import { router } from "expo-router";
import { ReactNode, useEffect, useRef, useState } from "react";
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
  dangerBg: "#FBEAE8",
  warn: "#9A6B12",
  warnBg: "#FBF3E1",
};

const PIN_LENGTH = 4;
const OTP_LENGTH = 6;
const OTP_RESEND_SECONDS = 60;

type Mode = "menu" | "create" | "verify_current" | "new_pin" | "forgot" | "fees";

const cleanPin = (value: string) => value.replace(/\D/g, "").slice(0, PIN_LENGTH);
const cleanOtp = (value: string) => value.replace(/\D/g, "").slice(0, OTP_LENGTH);

// Flags obviously-weak PINs (repeated or sequential digits) so we can nudge
// the user without ever blocking them from saving what they choose.
function weakPinReason(pin: string): string | null {
  if (pin.length !== PIN_LENGTH) return null;
  if (/^(\d)\1+$/.test(pin)) return "Avoid repeated digits, e.g. 1111";
  const ascending = "0123456789";
  const descending = "9876543210";
  if (ascending.includes(pin) || descending.includes(pin)) {
    return "Avoid sequential digits, e.g. 1234";
  }
  return null;
}

/**
 * Segmented PIN / OTP entry. Renders individual boxes for a tap target and
 * clear progress feedback, backed by a single off-screen TextInput so the
 * numeric keyboard behaves normally (paste, autofill from SMS, etc).
 */
function PinBoxInput({
  label,
  value,
  onChangeText,
  length = PIN_LENGTH,
  autoFocus,
  secure = true,
  error,
  hint,
  success,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  secure?: boolean;
  error?: string | null;
  hint?: string | null;
  success?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const [reveal, setReveal] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <View style={styles.inputLabelRow}>
        <Text style={styles.inputLabel}>{label}</Text>
        {secure && value.length > 0 ? (
          <TouchableOpacity
            onPress={() => setReveal((r) => !r)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.revealToggle}>{reveal ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxRow}>
        {Array.from({ length }).map((_, index) => {
          const filled = value.length > index;
          const isCursor = focused && value.length === index;
          return (
            <View
              key={index}
              style={[
                styles.box,
                filled && styles.boxFilled,
                isCursor && styles.boxCursor,
                !!error && styles.boxError,
                success && styles.boxSuccess,
              ]}
            >
              <Text style={styles.boxText}>
                {filled ? (secure && !reveal ? "•" : value[index]) : ""}
              </Text>
            </View>
          );
        })}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType={length === OTP_LENGTH ? "oneTimeCode" : undefined}
        maxLength={length}
        autoFocus={autoFocus}
        style={styles.hiddenInput}
        caretHidden
      />

      {error ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="alert-circle" size={13} color={C.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : success ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="checkmark-circle" size={13} color={C.forestMid} />
          <Text style={styles.successText}>PINs match</Text>
        </View>
      ) : hint ? (
        <View style={styles.feedbackRow}>
          <Ionicons name="information-circle" size={13} color={C.warn} />
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={styles.stepRow}>
      {steps.map((label, index) => (
        <View key={label} style={styles.stepItemWrap}>
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                index < current && styles.stepDotDone,
                index === current && styles.stepDotActive,
              ]}
            >
              {index < current ? (
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              ) : (
                <Text
                  style={[
                    styles.stepNum,
                    index === current && styles.stepNumActive,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.stepLabel, index === current && styles.stepLabelActive]}>
              {label}
            </Text>
          </View>
          {index < steps.length - 1 ? (
            <View style={[styles.stepLine, index < current && styles.stepLineDone]} />
          ) : null}
        </View>
      ))}
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

  // Tracks whether "new_pin" was reached via the verify-current-PIN flow
  // (so we can show a 2-step indicator) vs a first-time PIN creation.
  const [changeFlow, setChangeFlow] = useState(false);
  const [currentPinError, setCurrentPinError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const busy = isSaving || isChecking || isSendingOtp || isResetting;

  const resetForm = (nextMode: Mode = "menu") => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setOtp("");
    setCurrentPinError(null);
    setOtpError(null);
    if (nextMode === "menu") {
      setChangeFlow(false);
      setResendIn(0);
    }
    setMode(nextMode);
  };

  // The bottom action button doubles as "Back" (one step) or "Cancel" (all
  // the way to the menu) depending on where the user is. On the "new_pin"
  // step of a change-PIN flow, stepping back should return to "Verify"
  // rather than discarding the whole flow.
  const isBackStep = mode === "new_pin" && changeFlow;

  const handleSecondaryAction = () => {
    if (isBackStep) {
      setNewPin("");
      setConfirmPin("");
      setMode("verify_current");
      return;
    }
    resetForm("menu");
  };

  const secondaryActionLabel =
    mode === "fees" ? "Back to payment settings" : isBackStep ? "Back to Verify" : "Cancel";

  const handleBack = () => {
    if (mode !== "menu") {
      handleSecondaryAction();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/profile");
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
      setCurrentPinError("Enter your current 4-digit PIN");
      return;
    }

    try {
      setCurrentPinError(null);
      await verifyPaymentPin(currentPin);
      setChangeFlow(true);
      setMode("new_pin");
    } catch {
      setCurrentPinError("That PIN doesn't match your current one");
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
      setResendIn(OTP_RESEND_SECONDS);
    } catch {
      Toast.show({ type: "error", text1: "Could not send OTP" });
    }
  };

  const resendOtp = async () => {
    if (resendIn > 0) return;
    try {
      await forgotPaymentPin();
      setResendIn(OTP_RESEND_SECONDS);
      Toast.show({ type: "success", text1: "OTP resent" });
    } catch {
      Toast.show({ type: "error", text1: "Could not resend OTP" });
    }
  };

  const resetWithOtp = async () => {
    if (otp.length !== OTP_LENGTH) {
      setOtpError("Enter the 6-digit code from your email");
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
      setOtpError(null);
      await resetPaymentPin({ otp, pin: newPin });
      Toast.show({ type: "success", text1: "Payment PIN changed" });
      resetForm("menu");
    } catch {
      setOtpError("That code is incorrect or has expired");
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
              icon={<MaterialCommunityIcons name="security" size={24} color={C.forest} />}
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
              icon={<Ionicons name="wallet" size={24} color={C.forest} />}
              label="Fees and allowances"
              sublabel="Deposit charges and included withdrawals"
              onPress={() => setMode("fees")}
            />
            <View style={styles.divider} />
            <ActionRow
              icon={<MaterialIcons name="card-membership" size={24} color={C.forest} />}
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
              icon={<FontAwesome5 name="receipt" size={22} color={C.forest} />}
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
          <PinCardHeader
            icon={<MaterialCommunityIcons name="shield-key" size={20} color={C.forest} />}
            title="Change Payment PIN"
            sub="Enter your current PIN so we can confirm it's you."
          />
          <StepIndicator steps={["Verify", "New PIN"]} current={0} />
          <PinBoxInput
            label="Current PIN"
            value={currentPin}
            onChangeText={(value) => {
              setCurrentPin(cleanPin(value));
              if (currentPinError) setCurrentPinError(null);
            }}
            autoFocus
            error={currentPinError}
          />
          <PrimaryButton
            label="Continue"
            loading={isChecking}
            disabled={currentPin.length !== PIN_LENGTH}
            onPress={checkCurrentPin}
          />
          <TextButton label="Forgot PIN?" onPress={sendForgotOtp} loading={isSendingOtp} />
        </View>
      );
    }

    if (mode === "forgot") {
      const pinsMismatch =
        newPin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && newPin !== confirmPin;
      const pinsMatch =
        newPin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && newPin === confirmPin;
      return (
        <View style={styles.card}>
          <PinCardHeader
            icon={<MaterialCommunityIcons name="email-lock" size={20} color={C.forest} />}
            title="Forgot Payment PIN"
            sub="Enter the code we emailed you, then choose a new PIN."
          />
          <PinBoxInput
            label="Email OTP"
            value={otp}
            onChangeText={(value) => {
              setOtp(cleanOtp(value));
              if (otpError) setOtpError(null);
            }}
            length={OTP_LENGTH}
            secure={false}
            autoFocus
            error={otpError}
          />
          <View style={styles.resendRow}>
			<Text style={styles.resendText}>Didn&apos;t get it?</Text>
            <TouchableOpacity onPress={resendOtp} disabled={resendIn > 0 || isSendingOtp}>
              <Text style={[styles.resendLink, resendIn > 0 && styles.resendLinkDisabled]}>
                {resendIn > 0 ? `Resend in ${resendIn}s` : isSendingOtp ? "Sending..." : "Resend code"}
              </Text>
            </TouchableOpacity>
          </View>

          <PinBoxInput
            label="New PIN"
            value={newPin}
            onChangeText={(value) => setNewPin(cleanPin(value))}
            hint={weakPinReason(newPin)}
          />
          <PinBoxInput
            label="Confirm New PIN"
            value={confirmPin}
            onChangeText={(value) => setConfirmPin(cleanPin(value))}
            error={pinsMismatch ? "PINs do not match" : null}
            success={pinsMatch}
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

    // mode === "create" or "new_pin"
    const pinsMismatch =
      newPin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && newPin !== confirmPin;
    const pinsMatch =
      newPin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH && newPin === confirmPin;

    return (
      <View style={styles.card}>
        <PinCardHeader
          icon={<MaterialCommunityIcons name="lock-check" size={20} color={C.forest} />}
          title={mode === "create" ? "Create Payment PIN" : "Set New Payment PIN"}
          sub="Choose a 4-digit PIN you'll use to approve every withdrawal."
        />
        {changeFlow && mode === "new_pin" ? (
          <StepIndicator steps={["Verify", "New PIN"]} current={1} />
        ) : null}
        <PinBoxInput
          label="New PIN"
          value={newPin}
          onChangeText={(value) => setNewPin(cleanPin(value))}
          autoFocus
          hint={weakPinReason(newPin)}
        />
        <PinBoxInput
          label="Confirm New PIN"
          value={confirmPin}
          onChangeText={(value) => setConfirmPin(cleanPin(value))}
          error={pinsMismatch ? "PINs do not match" : null}
          success={pinsMatch}
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
      <AppScreenHeader
        title="Payment Settings"
        subtitle="Manage withdrawal security, fees, your plan and payment activity."
        onBack={handleBack}
        fallbackRoute="/(app)/(tabs)/profile"
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderBody()}

          {mode !== "menu" ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleSecondaryAction}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>{secondaryActionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PinCardHeader({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <View style={styles.pinCardHeader}>
      <View style={styles.pinCardIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
    </View>
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
  icon: ReactNode;
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
        {icon}
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

  // Pin card header (icon + title + sub) used across create/verify/forgot
  pinCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  pinCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.forestLight,
    alignItems: "center",
    justifyContent: "center",
  },

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

  // Step indicator
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 20 },
  stepItemWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  stepItem: { alignItems: "center", gap: 6 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EEF2F0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: C.forest },
  stepDotDone: { backgroundColor: C.forestMid },
  stepNum: { color: C.faint, fontSize: 11, fontWeight: "800" },
  stepNumActive: { color: "#FFFFFF" },
  stepLabel: { color: C.faint, fontSize: 10.5, fontWeight: "700" },
  stepLabelActive: { color: C.forest },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#EEF2F0",
    marginHorizontal: 8,
    marginBottom: 16,
  },
  stepLineDone: { backgroundColor: C.forestMid },

  // Segmented pin/otp boxes
  inputGroup: { marginTop: 22 },
  inputLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  inputLabel: { color: C.ink, fontSize: 12.5, fontWeight: "700" },
  revealToggle: { color: C.forestMid, fontSize: 12, fontWeight: "700" },
  boxRow: { flexDirection: "row", gap: 10 },
  box: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: "#F9FBFA",
    alignItems: "center",
    justifyContent: "center",
  },
  boxFilled: { borderColor: C.forestMid, backgroundColor: C.forestLight },
  boxCursor: { borderColor: C.gold },
  boxError: { borderColor: C.danger, backgroundColor: C.dangerBg },
  boxSuccess: { borderColor: C.forestMid, backgroundColor: C.forestLight },
  boxText: { color: C.ink, fontSize: 20, fontWeight: "800" },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 1,
    width: 1,
  },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  errorText: { color: C.danger, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  successText: { color: C.forestMid, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  hintText: { color: C.warn, fontSize: 12, fontWeight: "600", flexShrink: 1 },

  resendRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  resendText: { color: C.muted, fontSize: 12.5, fontWeight: "500" },
  resendLink: { color: C.forestMid, fontSize: 12.5, fontWeight: "700" },
  resendLinkDisabled: { color: C.faint },

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
