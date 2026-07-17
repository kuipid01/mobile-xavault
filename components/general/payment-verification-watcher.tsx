import { clearSubscriptionReminderState } from "@/hooks/subscription-reminder-storage";
import { resetSubscriptionPromptSessionState } from "@/hooks/use-subscription-prompt";
import { useSubscriptionVerificationContext } from "@/hooks/verify-sub";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

export function PaymentVerificationWatcher() {
  const {
    checkStatus,
    continuePayment,
    dismissPayment,
    isVerifying,
    pendingPaymentUrl,
    pendingPaymentReference,
    pendingPlanId,
    pendingStatus,
    startNewPayment,
  } = useSubscriptionVerificationContext();

  const visible = Boolean(isVerifying && pendingPlanId);
  if (!visible) return null;

  const isReady = pendingStatus === "ready";
  const isExpired = pendingStatus === "expired";
  const isChecking = pendingStatus === "verifying";
  const needsAction = pendingStatus === "needs_action";

  const title = isReady
    ? "Ready to upgrade"
    : isExpired
      ? "Payment link expired"
    : isChecking
      ? "Checking payment"
      : "Upgrade not confirmed";

  const body = isReady
    ? "Use the secure Paystack checkout to complete this upgrade."
    : isExpired
      ? "Paystack checkout links stay active for 24 hours. Start a new payment to continue this upgrade."
    : isChecking
      ? "We are checking Paystack briefly. This will stop if the payment is not confirmed."
      : "If you completed checkout, verify it now. If you closed checkout, continue the same payment or dismiss this prompt.";

  const handleVerify = async () => {
    const confirmed = await checkStatus({ bounded: false });
    if (confirmed) {
      await clearSubscriptionReminderState();
      resetSubscriptionPromptSessionState();
    }
  };

  const handleContinue = async () => {
    const confirmed = await continuePayment();
    if (confirmed) {
      await clearSubscriptionReminderState();
      resetSubscriptionPromptSessionState();
    }
  };

  const handleStartNew = async () => {
    const confirmed = await startNewPayment();
    if (confirmed) {
      await clearSubscriptionReminderState();
      resetSubscriptionPromptSessionState();
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => void dismissPayment()}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {isChecking ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Ionicons
                name={isReady ? "card-outline" : isExpired ? "time-outline" : "alert-circle-outline"}
                size={24}
                color={COLORS.white}
              />
            )}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.receipt}>
            <Row label="Plan ID" value={pendingPlanId || "-"} />
            <Row label="Reference" value={pendingPaymentReference || "-"} />
          </View>

          <View style={styles.actions}>
            {needsAction ? (
              <Pressable
                disabled={isChecking}
                onPress={() => void handleVerify()}
                style={[styles.secondaryButton, isChecking && styles.disabled]}
              >
                <Text style={styles.secondaryText}>Verify again</Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={(isChecking || !pendingPaymentUrl) && !isExpired}
              onPress={() =>
                void (isExpired ? handleStartNew() : handleContinue())
              }
              style={[
                styles.primaryButton,
                ((isChecking || !pendingPaymentUrl) && !isExpired) &&
                  styles.disabled,
              ]}
            >
              <Text style={styles.primaryText}>
                {isExpired
                  ? "Start new payment"
                  : isReady
                    ? "Continue payment"
                    : "Continue same payment"}
              </Text>
            </Pressable>

            <Pressable
              disabled={isChecking}
              onPress={() => void dismissPayment()}
              style={[styles.dismissButton, isChecking && styles.disabled]}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 22,
    width: "100%",
  },
  iconWrap: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
    marginBottom: 14,
    width: 44,
  },
  title: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  body: {
    color: "#51605A",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  receipt: {
    backgroundColor: "#F6F8F7",
    borderRadius: 12,
    gap: 10,
    marginBottom: 18,
    padding: 14,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  rowLabel: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "700",
  },
  rowValue: {
    color: COLORS.primary,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#E8F5EF",
    borderRadius: 10,
    paddingVertical: 13,
  },
  secondaryText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: "800",
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  dismissText: {
    color: "#8D9793",
    fontSize: 13,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.55,
  },
});
