import { useAuth } from "@/api/auth";
import { useSubscriptionPlans } from "@/hooks/app/subscription";
import { clearSubscriptionReminderState } from "@/hooks/subscription-reminder-storage";
import { resetSubscriptionPromptSessionState } from "@/hooks/use-subscription-prompt";
import { useSubscriptionVerificationContext } from "@/hooks/verify-sub";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { PaystackWebView, isCancelledRedirect } from "./paystack-webview";

export function PaymentVerificationWatcher() {
  const { isAuthenticated } = useAuth();
  const {
    checkStatus,
    closeCheckout,
    checkoutUrl,
    continuePayment,
    dismissPayment,
    isVerifying,
    pendingPaymentUrl,
    pendingPlanId,
    pendingStatus,
    startNewPayment,
  } = useSubscriptionVerificationContext();
  const { data: plans = [] } = useSubscriptionPlans({
    enabled: isAuthenticated,
  });
  const pendingPlan = plans.find((plan) => plan.ID === pendingPlanId);
  const planName = pendingPlan?.Name || "-";
  const amount = pendingPlan
    ? new Intl.NumberFormat("en-NG", {
        currency: pendingPlan.Currency,
        maximumFractionDigits: 0,
        style: "currency",
      }).format(pendingPlan.PriceKobo / 100)
    : "-";

  // The subscription checkout reuses the same in-app Paystack WebView as the
  // deposit flow: it closes on the transaction callback redirect and triggers
  // a bounded verification, exactly like deposits.
  const handleTerminalRedirect = useCallback(
    (url: string) => {
      closeCheckout();
      if (isCancelledRedirect(url)) {
        // Customer cancelled on the Paystack page: just return to the
        // upgrade prompt - the pending payment stays resumable.
        return;
      }
      void checkStatus({ bounded: true });
    },
    [checkStatus, closeCheckout]
  );

  const handleClose = useCallback(
    ({ terminalHandled }: { terminalHandled: boolean }) => {
      closeCheckout();
      if (!terminalHandled) {
        // Manual close (X / back): verify once in case the payment completed
        // without a redirect (mirrors the deposit checkout behaviour).
        void checkStatus({ bounded: true });
      }
    },
    [checkStatus, closeCheckout]
  );

  // Success UX: the verification hook flips to "confirmed" right before it
  // clears the pending payment, so this effect is the single place that
  // celebrates + resets prompt/reminder session state for every confirm path
  // (checkout redirect, AppState return, manual "Verify again").
  useEffect(() => {
    if (pendingStatus !== "confirmed") return;

    Toast.show({
      type: "success",
      text1: "Upgrade confirmed",
      text2: "Your new plan is now active.",
    });
    void (async () => {
      await clearSubscriptionReminderState();
      resetSubscriptionPromptSessionState();
    })();
  }, [pendingStatus]);

  if (checkoutUrl) {
    return (
      <PaystackWebView
        checkoutUrl={checkoutUrl}
        onClose={handleClose}
        onTerminalRedirect={handleTerminalRedirect}
      />
    );
  }

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
            <Text style={styles.planLabel} numberOfLines={1}>
              {planName}
            </Text>
            <Text style={styles.amount} numberOfLines={1}>
              {amount}
            </Text>
          </View>

          <View style={styles.actions}>
            {needsAction ? (
              <Pressable
                disabled={isChecking}
                testID="subscription-check-again"
                onPress={() => void handleVerify()}
                style={[styles.secondaryButton, isChecking && styles.disabled]}
              >
                <Text style={styles.secondaryText}>Verify again</Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={(isChecking || !pendingPaymentUrl) && !isExpired}
              testID="subscription-primary"
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

            {/* Bug fix: dismissal must always be available - even while a
                check is in flight - so the user can cancel an initiated
                payment at any time. Cancelling propagates to the backend and
                stops all checking for this reference. */}
            <Pressable
              onPress={() => void dismissPayment()}
              testID="subscription-cancel"
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
  planLabel: {
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