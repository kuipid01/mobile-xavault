import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatDate, formatMoney } from "@/api/money";
import { Plan } from "@/api/types";

type Props = {
  plan: Plan;
  onPress?: () => void;
};

export function PlanCard({ plan, onPress }: Props) {
  const total = plan.amount || 0;
  const paid = plan.withdrawn_amount ?? 0;
  const pending = plan.pending_withdrawal_amount ?? 0;
  const remaining = plan.remaining_balance ?? Math.max(total - paid - pending, 0);
  const isExhausted = plan.is_exhausted ?? (total > 0 && remaining <= 0);
  const spentRatio = total > 0 ? Math.min((paid + pending) / total, 1) : 0;
  const progress = total > 0 ? Math.round(spentRatio * 100) : 0;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="wallet-outline" size={22} color={isExhausted ? "#9AA5A1" : "#007A5A"} />
        </View>
        <View style={[styles.badge, isExhausted && styles.badgeExhausted]}>
          <Text style={[styles.badgeText, isExhausted && styles.badgeTextExhausted]}>
            {isExhausted ? "EXHAUSTED" : plan.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{plan.name}</Text>
      <Text style={styles.meta}>
        {formatDate(plan.start_date)} - {formatDate(plan.end_date)} • {formatMoney(total, plan.currency)}
      </Text>

      <View style={styles.amountRow}>
        <View>
          <Text style={[styles.amount, isExhausted && styles.amountExhausted]}>
            {formatMoney(remaining, plan.currency)}
          </Text>
          <Text style={styles.amountLabel}>{isExhausted ? "Nothing left" : "Remaining"}</Text>
        </View>
        <Text style={[styles.percent, isExhausted && styles.percentExhausted]}>{progress}% spent</Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            isExhausted && styles.progressFillExhausted,
            { width: `${Math.max(Math.min(progress, 100), spentRatio > 0 ? 6 : 0)}%` },
          ]}
        />
      </View>

      {paid + pending > 0 ? (
        <Text style={styles.spentLine}>
          Spent {formatMoney(paid, plan.currency)}
          {pending > 0 ? ` · ${formatMoney(pending, plan.currency)} pending` : ""}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#E7ECE9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E1FFF1",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  badgeExhausted: {
    backgroundColor: "#F3F4F6",
  },
  badgeText: {
    color: "#007A5A",
    fontSize: 10,
    fontWeight: "900",
  },
  badgeTextExhausted: {
    color: "#6B7280",
    letterSpacing: 0.5,
  },
  title: {
    color: "#063B2E",
    fontSize: 20,
    fontWeight: "900",
  },
  meta: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  amountRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amount: {
    color: "#063B2E",
    fontSize: 18,
    fontWeight: "900",
  },
  amountExhausted: {
    color: "#9AA5A1",
  },
  amountLabel: {
    color: "#9AA5A1",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  percent: {
    color: "#007A5A",
    fontSize: 13,
    fontWeight: "900",
  },
  percentExhausted: {
    color: "#6B7280",
  },
  progressTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#007A5A",
  },
  progressFillExhausted: {
    backgroundColor: "#9CA3AF",
  },
  spentLine: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "700",
  },
});
