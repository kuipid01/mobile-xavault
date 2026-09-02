import { koboToNaira } from "@/api/money";
import { useDepositVerificationContext } from "@/hooks/verify-deposit";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

const formatAmount = (amount: number | null) =>
  `NGN ${koboToNaira(amount || 0).toLocaleString("en-NG")}`;

export function DepositPaymentModal() {
  const {
    continueDepositPayment,
    dismissPendingDeposit,
    isVerifyingDeposit,
    pendingAmount,
    pendingAuthorizationUrl,
    pendingReference,
    pendingStatus,
    startNewDepositPayment,
    verifyPendingDeposit,
  } = useDepositVerificationContext();

  const visible = Boolean(
    pendingReference &&
      pendingStatus !== "idle" &&
      pendingStatus !== "confirmed" &&
      pendingStatus !== "dismissed"
  );

  if (!visible) return null;

  const isReady = pendingStatus === "ready";
  const isExpired = pendingStatus === "expired";
  const isVerifying = pendingStatus === "verifying" || isVerifyingDeposit;
  const isProcessing = pendingStatus === "still_processing";
  const needsAction =
    pendingStatus === "needs_action" ||
    pendingStatus === "failed";

  const title = isReady
    ? "Ready to pay"
    : isExpired
      ? "Payment link expired"
    : isVerifying
      ? "Checking payment"
    : isProcessing
      ? "Payment still processing"
      : "Payment not confirmed";

  const body = isReady
    ? "Use the secure Paystack checkout to complete this deposit."
    : isExpired
      ? "Paystack checkout links stay active for 24 hours. Start a new payment to keep funding this wallet."
    : isVerifying
      ? "We are checking Paystack briefly. This will stop if the payment is not confirmed."
    : isProcessing
      ? "Your payment may still be processing on Paystack's end. You can check again or continue the same payment."
      : "If you completed checkout, verify it now. If you closed checkout, continue the same payment or dismiss this prompt.";

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => void dismissPendingDeposit()}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {isVerifying ? (
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
            <Row label="Amount" value={formatAmount(pendingAmount)} />
            <Row label="Reference" value={pendingReference || "-"} />
          </View>

          <View style={styles.actions}>
            {needsAction || isProcessing ? (
              <Pressable
                disabled={isVerifying}
                onPress={() => void verifyPendingDeposit({ bounded: !isProcessing })}
                style={[styles.secondaryButton, isVerifying && styles.disabled]}
              >
                <Text style={styles.secondaryText}>Check again</Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={(!pendingAuthorizationUrl && !isExpired) || isVerifying}
              onPress={() =>
                void (isExpired
                  ? startNewDepositPayment()
                  : continueDepositPayment())
              }
              style={[
                styles.primaryButton,
                ((!pendingAuthorizationUrl && !isExpired) || isVerifying) &&
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
              disabled={isVerifying}
              onPress={() => void dismissPendingDeposit()}
              style={[styles.dismissButton, isVerifying && styles.disabled]}
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
    justifyContent: "space-between",
    gap: 12,
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
