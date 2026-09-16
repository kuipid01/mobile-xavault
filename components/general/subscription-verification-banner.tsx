import {
  useSubscriptionVerificationContext,
} from "@/hooks/verify-sub";
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

// Subscription counterpart of DepositVerificationBanner. It shows the
// confirmation receipt of a just-completed upgrade (persisted with a short
// TTL, so it also appears after an app restart). Pending/failed payment
// states are owned by the root-mounted PaymentVerificationWatcher modal,
// exactly like the deposit flow splits banner vs. modal responsibilities.

const RECEIPT_VISIBLE_MS = 12000;

export function SubscriptionVerificationBanner() {
  const {
    confirmedReceipt,
    dismissReceipt,
    isVerifying,
  } = useSubscriptionVerificationContext();
  const translateY = useRef(new Animated.Value(-18)).current;
  const opacity = useRef(new Animated.Value(0)).current;
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

  // Auto-dismiss shortly after appearing, mirroring the deposit receipt.
  useEffect(() => {
    if (!confirmedReceipt) return;

    const timer = setTimeout(() => void dismissReceipt(), RECEIPT_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [confirmedReceipt, dismissReceipt]);

  if (!isVisible || !confirmedReceipt) return null;

  const reference = confirmedReceipt.reference || "";
  const planName = confirmedReceipt.planName || "new";

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
      <View style={[styles.card, styles.cardConfirmed]}>
        <View style={[styles.icon, styles.iconConfirmed]}>
          {isVerifying ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.iconText}>OK</Text>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Upgrade confirmed</Text>
          <Text style={styles.body}>
            Your {planName} plan is now active.
          </Text>
          {reference ? (
            <Text style={styles.meta} numberOfLines={1}>
              Ref {reference}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          {reference ? (
            <Pressable onPress={() => void copyReference()} style={styles.actionButton}>
              <Text style={styles.actionText}>Copy ref</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => void dismissReceipt()}
            style={styles.dismissButton}
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
    // Sits below the deposit banner when both are visible (deposits at 58).
    top: 132,
    zIndex: 29,
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
});
