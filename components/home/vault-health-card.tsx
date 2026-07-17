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
      <View style={styles.iconWrap}>
        <Ionicons name={getHealthIcon(health.score)} size={18} color="#063B2E" />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.eyebrow}>Vault Health</Text>
          <Text style={styles.score}>{health.score}/100</Text>
        </View>
        <Text style={styles.title}>{health.label}</Text>
        <Text style={styles.recap} numberOfLines={1}>
          {formatMoney(health.protectedThisWeek, wallet?.currency)} protected this week
        </Text>
      </View>

      <View style={styles.statusPill}>
        <Ionicons name="checkmark-circle" size={13} color="#106B4F" />
        <Text style={styles.statusText}>{health.badges.filter((badge) => badge.active).length}/4</Text>
      </View>
    </View>
  );
}

function getHealthIcon(score: number) {
  if (score >= 80) return "shield-checkmark-outline";
  if (score >= 55) return "trending-up-outline";
  if (score >= 30) return "leaf-outline";
  return "alert-circle-outline";
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
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 14,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#EAF7F1",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
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
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },
  score: {
    color: "#106B4F",
    fontSize: 11,
    fontWeight: "900",
  },
  recap: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: "#F4F7F5",
    borderColor: "#DDE6E1",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  statusText: {
    color: "#106B4F",
    fontSize: 11,
    fontWeight: "900",
  },
});
