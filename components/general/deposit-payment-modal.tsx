import { koboToNaira } from "@/api/money";
import { useDepositVerificationContext } from "@/hooks/verify-deposit";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PaystackCheckoutLayer } from "./paystack-checkout-layer";

const formatAmount = (amount: number | null) =>
  `NGN ${koboToNaira(amount || 0).toLocaleString("en-NG")}`;

// Restyled to mirror the subscription verification card (the minimalistic
// "Ready to upgrade" card): small icon chip, compact title/body, dashed
// divider over a big labelled amount, and stacked compact buttons.
export function DepositPaymentModal() {
  const {
    checkoutUrl,
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

  if (!visible && !checkoutUrl) return null;

  // The Paystack checkout is open: render the in-app WebView layer instead
  // of the prompt card. The prompt reappears when the user closes the
  // checkout (or the deposit reaches a terminal state and the layer unmounts).
  if (checkoutUrl) return <PaystackCheckoutLayer />;

  const isReady = pendingStatus === "ready";
  const isExpired = pendingStatus === "expired";
  const isVerifying = pendingStatus === "verifying" || isVerifyingDeposit;
  const isProcessing = pendingStatus === "still_processing";
  const needsAction =
    pendingStatus === "needs_action" ||
    pendingStatus === "failed";
  // checkout_opened means the user left the WebView before completion was
  // detected — always offer a manual verify here. Previously this state fell
  // into the generic "Payment not confirmed" branch with no Check again
  // button, leaving paid users stuck.
  const canCheckAgain =
    needsAction || isProcessing || pendingStatus === "checkout_opened";

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
              <ActivityIndicator color={COLORS.secondary} size="small" />
            ) : (
              <Ionicons
                name={isReady ? "card-outline" : isExpired ? "time-outline" : "alert-circle-outline"}
                size={16}
                color={COLORS.secondary}
              />
            )}
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel} numberOfLines={1}>
              Deposit
            </Text>
            <Text style={styles.amount} numberOfLines={1}>
              {formatAmount(pendingAmount)}
            </Text>
            <Text style={styles.reference} numberOfLines={1}>
              Ref {pendingReference || "-"}
            </Text>
          </View>

          <View style={styles.actions}>
            {canCheckAgain ? (
              <Pressable
                disabled={isVerifying}
                testID="deposit-check-again"
                onPress={() => void verifyPendingDeposit({ bounded: !isProcessing })}
                style={[styles.secondaryButton, isVerifying && styles.disabled]}
              >
                <Text style={styles.secondaryText}>Check again</Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={(!pendingAuthorizationUrl && !isExpired) || isVerifying}
              testID="deposit-primary"
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

            {/* Dismissal must always be available - even while a verification
                is in flight - so the user can cancel an initiated payment at
                any time. Cancelling propagates to the backend and stops all
                polling for this reference. */}
            <Pressable
              onPress={() => void dismissPendingDeposit()}
              testID="deposit-cancel"
              style={styles.dismissButton}
            >
              <Text style={styles.dismissText}>Cancel payment</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Style values mirror payment-verification-watcher.tsx so both cards look
// and feel identical (minimalistic: chip → title → body → dashed divider →
// big labelled amount → compact actions).
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
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
  iconWrap: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: `${COLORS.secondary}18`,
    borderRadius: 9,
    height: 34,
    justifyContent: "center",
    marginBottom: 14,
    width: 34,
  },
  title: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  body: {
    color: "#51605A",
    fontSize: 12.5,
    lineHeight: 18,
  },
  amountBlock: {
    borderTopColor: `${COLORS.secondary}55`,
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginTop: 16,
    paddingTop: 16,
  },
  amountLabel: {
    color: "#8D9793",
    fontSize: 11,
    marginBottom: 2,
  },
  amount: {
    color: COLORS.primary,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  reference: {
    color: "#8D9793",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },
  actions: {
    gap: 8,
    marginTop: 18,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#D8DEDA",
    borderRadius: 12,
    borderWidth: 0.5,
    paddingVertical: 11,
  },
  secondaryText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "500",
  },
  dismissButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  dismissText: {
    color: "#8D9793",
    fontSize: 12,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  disabled: {
    opacity: 0.55,
  },
});
