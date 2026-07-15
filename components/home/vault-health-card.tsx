import { formatMoney } from "@/api/money";
import { Plan, Wallet, WalletLedger } from "@/api/types";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  wallet?: Wallet;
  plans?: Plan[];
  ledger?: WalletLedger[];
};

type VaultHealth = {
  score: number;
  label: string;
  protectedThisWeek: number;
  badges: {
    key: string;
    label: string;
    active: boolean;
  }[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function VaultHealthCard({ wallet, plans = [], ledger = [] }: Props) {
  const health = useMemo(
    () => calculateVaultHealth(wallet, plans, ledger),
    [ledger, plans, wallet]
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Vault Health</Text>
          <Text style={styles.title}>{health.label}</Text>
        </View>
        <View style={styles.scoreCircle}>
          <Text style={styles.score}>{health.score}</Text>
          <Text style={styles.scoreUnit}>/100</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${health.score}%` }]} />
      </View>

      <Text style={styles.recap}>
        You protected {formatMoney(health.protectedThisWeek, wallet?.currency)} this
        week.
      </Text>

      <View style={styles.badges}>
        {health.badges.map((badge) => (
          <View
            key={badge.key}
            style={[styles.badge, badge.active && styles.badgeActive]}
          >
            <Ionicons
              name={badge.active ? "checkmark-circle" : "ellipse-outline"}
              size={13}
              color={badge.active ? "#106B4F" : "#9EAAA5"}
            />
            <Text
              style={[styles.badgeText, badge.active && styles.badgeTextActive]}
            >
              {badge.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function calculateVaultHealth(
  wallet?: Wallet,
  plans: Plan[] = [],
  ledger: WalletLedger[] = []
): VaultHealth {
  const activePlans = plans.filter((plan) => plan.status === "active");
  const completedPlans = plans.filter((plan) => plan.status === "completed");
  const hasDeposit = ledger.some((item) =>
    String(item.type ?? item.Type ?? "").toLowerCase().includes("credit")
  );
  const hasLockedMoney = (wallet?.locked_balance || 0) > 0;
  const totalTarget = plans.reduce((sum, plan) => sum + Math.max(plan.amount, 0), 0);
  const totalAllocated = plans.reduce(
    (sum, plan) => sum + Math.max(plan.top_level_allocated, 0),
    0
  );
  const allocationScore =
    totalTarget > 0 ? Math.min((totalAllocated / totalTarget) * 30, 30) : 0;
  const score = Math.min(
    100,
    Math.round(
      (hasDeposit ? 15 : 0) +
        (plans.length > 0 ? 20 : 0) +
        Math.min(activePlans.length * 12, 24) +
        (hasLockedMoney ? 16 : 0) +
        Math.min(completedPlans.length * 15, 15) +
        allocationScore
    )
  );

  const now = Date.now();
  const protectedThisWeek = ledger.reduce((sum, item) => {
    const createdAt = item.created_at ?? item.CreatedAt;
    const createdTime = createdAt ? new Date(createdAt).getTime() : 0;
    const type = String(item.type ?? item.Type ?? "").toLowerCase();
    const amount = item.amount ?? item.Amount ?? 0;

    if (!createdTime || now - createdTime > WEEK_MS) return sum;
    if (!type.includes("credit") && amount <= 0) return sum;

    return sum + Math.abs(amount);
  }, 0);

  return {
    score,
    label:
      score >= 80
        ? "Strong protection"
        : score >= 55
          ? "Building momentum"
          : score >= 30
            ? "Getting started"
            : "Needs funding",
    protectedThisWeek,
    badges: [
      { key: "first_deposit", label: "First deposit", active: hasDeposit },
      { key: "first_plan", label: "First plan", active: plans.length > 0 },
      {
        key: "active_plan",
        label: "Active plan",
        active: activePlans.length > 0,
      },
      {
        key: "locked_money",
        label: "Money locked",
        active: hasLockedMoney,
      },
    ],
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
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
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  scoreCircle: {
    alignItems: "baseline",
    backgroundColor: "#EAF7F1",
    borderRadius: 18,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  score: {
    color: "#063B2E",
    fontSize: 20,
    fontWeight: "900",
  },
  scoreUnit: {
    color: "#7A8580",
    fontSize: 11,
    fontWeight: "800",
  },
  track: {
    backgroundColor: "#EDF1EE",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  fill: {
    backgroundColor: "#58FFBE",
    borderRadius: 999,
    height: "100%",
  },
  recap: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 12,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#F4F7F5",
    borderColor: "#DDE6E1",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  badgeActive: {
    backgroundColor: "#EAF7F1",
    borderColor: "#CDEDE0",
  },
  badgeText: {
    color: "#7A8580",
    fontSize: 11,
    fontWeight: "800",
  },
  badgeTextActive: {
    color: "#106B4F",
  },
});
