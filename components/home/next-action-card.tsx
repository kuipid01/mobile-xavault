import { formatMoney } from "@/api/money";
import { Plan, Wallet } from "@/api/types";
import { DepositVerificationStatus } from "@/hooks/verify-deposit";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type NextAction = {
  icon: IconName;
  title: string;
  body: string;
  cta: string;
  tone: "money" | "plan" | "alert";
  onPress: () => void;
};

type Props = {
  wallet?: Wallet;
  plans?: Plan[];
  pendingDeposit?: {
    reference: string | null;
    amount: number | null;
    status: DepositVerificationStatus;
    onPress: () => void;
  };
  isSubscriptionVerifying?: boolean;
  onCreatePlan: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
};

export default function NextActionCard({
  wallet,
  plans = [],
  pendingDeposit,
  isSubscriptionVerifying,
  onCreatePlan,
  onDeposit,
  onWithdraw,
}: Props) {
  const action = getNextAction({
    wallet,
    plans,
    pendingDeposit,
    isSubscriptionVerifying,
    onCreatePlan,
    onDeposit,
    onWithdraw,
  });

  return (
    <View style={[styles.card, styles[action.tone]]}>
      <View style={styles.iconWrap}>
        <Ionicons name={action.icon} size={18} color="#063B2E" />
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>Next Action</Text>
        <Text style={styles.title}>{action.title}</Text>
        <Text style={styles.body}>{action.body}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.82}
        onPress={action.onPress}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>{action.cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

function getNextAction({
  wallet,
  plans = [],
  pendingDeposit,
  isSubscriptionVerifying,
  onCreatePlan,
  onDeposit,
  onWithdraw,
}: Omit<Props, "pendingDeposit" | "plans"> & {
  plans?: Plan[];
  pendingDeposit?: Props["pendingDeposit"];
}): NextAction {
  if (isSubscriptionVerifying) {
    return {
      icon: "card-outline",
      title: "Subscription payment is being checked",
      body: "We are confirming your upgrade. You can continue using the app.",
      cta: "Keep going",
      tone: "alert",
      onPress: () => undefined,
    };
  }

  if (pendingDeposit?.reference) {
    const amount =
      pendingDeposit.amount && pendingDeposit.amount > 0
        ? `${formatMoney(pendingDeposit.amount)} `
        : "";
    return {
      icon: "refresh-circle-outline",
      title:
        pendingDeposit.status === "needs_action" ||
        pendingDeposit.status === "failed" ||
        pendingDeposit.status === "still_processing"
          ? "Payment not confirmed"
          : "Deposit needs confirmation",
      body: `${amount}Ref ${pendingDeposit.reference}. Continue payment or verify if Paystack has completed it.`,
      cta: "Check status",
      tone: "alert",
      onPress: pendingDeposit.onPress,
    };
  }

  if (plans.length === 0) {
    return {
      icon: "albums-outline",
      title: "Create your first spending plan",
      body: "Plans help you separate money before it gets spent casually.",
      cta: "Create plan",
      tone: "plan",
      onPress: onCreatePlan,
    };
  }

  const draftPlan = plans.find((plan) => plan.status === "draft");
  if (draftPlan) {
    return {
      icon: "checkmark-done-circle-outline",
      title: `Finish ${draftPlan.name}`,
      body: "Review envelopes and confirm the plan when the allocation is ready.",
      cta: "View plan",
      tone: "plan",
      onPress: onCreatePlan,
    };
  }

  const available = wallet?.available_balance || 0;
  if (available > 0) {
    return {
      icon: "wallet-outline",
      title: "Put available money to work",
      body: `${formatMoney(available, wallet?.currency)} is available for deposits, plans, or withdrawals.`,
      cta: "Withdraw",
      tone: "money",
      onPress: onWithdraw,
    };
  }

  return {
    icon: "add-circle-outline",
    title: "Fund your vault",
    body: "Deposit money to start building plans and tracking wallet movement.",
    cta: "Deposit",
    tone: "money",
    onPress: onDeposit,
  };
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 14,
  },
  money: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
  },
  plan: {
    backgroundColor: "#F6FBF8",
    borderColor: "#CDEDE0",
  },
  alert: {
    backgroundColor: "#FFFBEE",
    borderColor: "#F2E4A8",
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#EAF7F1",
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: "#7A8580",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#063B2E",
    fontSize: 14,
    fontWeight: "900",
  },
  body: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  cta: {
    backgroundColor: "#063B2E",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
});
