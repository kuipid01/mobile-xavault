import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatDate, formatMoney } from "@/api/money";
import { Plan } from "@/api/types";

type Props = {
  plan: Plan;
  onPress?: () => void;
};

export function PlanCard({ plan, onPress }: Props) {
  const progress = plan.amount > 0 ? Math.round((plan.top_level_allocated / plan.amount) * 100) : 0;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="wallet-outline" size={22} color="#007A5A" />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{plan.status.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.title}>{plan.name}</Text>
      <Text style={styles.meta}>
        {formatDate(plan.start_date)} - {formatDate(plan.end_date)} • {formatMoney(plan.amount, plan.currency)}
      </Text>

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amount}>{formatMoney(plan.top_level_allocated, plan.currency)}</Text>
          <Text style={styles.amountLabel}>Allocated</Text>
        </View>
        <Text style={styles.percent}>{progress}%</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
      </View>
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
  badgeText: {
    color: "#007A5A",
    fontSize: 10,
    fontWeight: "900",
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
});
