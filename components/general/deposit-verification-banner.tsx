import { koboToNaira } from "@/api/money";
import {
  DepositVerificationStatus,
  useDepositVerificationContext,
} from "@/hooks/verify-deposit";
import { COLORS } from "@/themes/colors";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

const statusCopy: Record<
  DepositVerificationStatus,
  { title: string; body: string }
> = {
  idle: {
    title: "",
    body: "",
  },
  ready: {
    title: "Deposit ready",
    body: "Continue payment from the secure checkout modal.",
  },
  checkout_opened: {
    title: "Checkout opened",
    body: "We will check once when you return.",
  },
  verifying: {
    title: "Checking payment",
    body: "We are confirming your Paystack payment now.",
  },
  needs_action: {
    title: "Payment not confirmed",
    body: "Continue the same payment or verify again.",
  },
  confirmed: {
    title: "Deposit confirmed",
    body: "Your wallet has been refreshed.",
  },
  still_processing: {
    title: "Still processing",
    body: "Paystack has not confirmed this yet. You can retry safely.",
  },
  failed: {
    title: "Deposit failed",
    body: "We could not confirm this payment. Try again or start a new deposit.",
  },
  expired: {
    title: "Payment link expired",
    body: "Start a new Paystack checkout to continue this deposit.",
  },
  dismissed: {
    title: "Deposit dismissed",
    body: "Webhook verification can still complete it later.",
  },
};

export function DepositVerificationBanner() {
  const {
    clearDepositVerification,
    confirmedReceipt,
    dismissDepositReceipt,
    isVerifyingDeposit,
    pendingAmount,
    pendingReference,
    pendingStatus,
    verifyPendingDeposit,
  } = useDepositVerificationContext();
  const translateY = useRef(new Animated.Value(-18)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isReceipt = Boolean(confirmedReceipt);
  const isVisible = Boolean(confirmedReceipt);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: isVisible ? 0 : -18,
        useNativeDriver: true,
        tension: 70,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: isVisible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isVisible, opacity, translateY]);

  useEffect(() => {
    if (!confirmedReceipt) return;

    const timer = setTimeout(dismissDepositReceipt, 12000);
    return () => clearTimeout(timer);
  }, [confirmedReceipt, dismissDepositReceipt]);

  if (!isVisible) return null;

  const reference = pendingReference || confirmedReceipt?.reference || "";
  const copy = isReceipt ? statusCopy.confirmed : statusCopy[pendingStatus];
  const showRetry = false;
  const amount = pendingAmount || confirmedReceipt?.amount || 0;
  const amountLabel =
    amount > 0
      ? `NGN ${koboToNaira(amount).toLocaleString("en-NG")}`
      : "Pending deposit";
  const dismiss = isReceipt ? dismissDepositReceipt : clearDepositVerification;

  const copyReference = async () => {
    if (!reference) return;

    await Clipboard.setStringAsync(reference);
    Toast.show({
      type: "success",
      text1: "Reference copied",
      text2: reference,
    });
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[styles.card, isReceipt && styles.cardConfirmed]}>
        <View style={[styles.icon, isReceipt && styles.iconConfirmed]}>
          {isVerifyingDeposit ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.iconText}>{isReceipt ? "OK" : "NG"}</Text>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {amountLabel} | Ref {reference}
          </Text>
        </View>

        <View style={styles.actions}>
          {showRetry ? (
            <Pressable
              disabled={isVerifyingDeposit}
              onPress={() => void verifyPendingDeposit()}
              style={[styles.actionButton, isVerifyingDeposit && styles.disabled]}
            >
              <Text style={styles.actionText}>Retry</Text>
            </Pressable>
          ) : null}

          {isReceipt ? (
            <Pressable onPress={copyReference} style={styles.actionButton}>
              <Text style={styles.actionText}>Copy ref</Text>
            </Pressable>
          ) : null}

          <Pressable
            disabled={isVerifyingDeposit}
            onPress={() => void dismiss()}
            style={[styles.dismissButton, isVerifyingDeposit && styles.disabled]}
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    left: 14,
    position: "absolute",
    right: 14,
    top: 58,
    zIndex: 30,
  },
  card: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: "rgba(15, 107, 79, 0.16)",
    borderRadius: 18,
    borderWidth: 1,
    elevation: 8,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    shadowColor: "#0F1F18",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
  },
  cardConfirmed: {
    borderColor: "rgba(45, 152, 103, 0.28)",
  },
  icon: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  iconConfirmed: {
    backgroundColor: COLORS.secondary,
  },
  iconText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "900",
  },
  content: {
    flex: 1,
  },
  title: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  body: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    marginTop: 2,
  },
  meta: {
    color: COLORS.border,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 5,
  },
  actions: {
    alignItems: "flex-end",
    gap: 8,
  },
  actionButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "900",
  },
  dismissButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  dismissText: {
    color: COLORS.border,
    fontSize: 12,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.45,
  },
});
