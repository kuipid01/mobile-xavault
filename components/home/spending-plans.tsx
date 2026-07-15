import { formatMoney } from "@/api/money";
import { Plan } from "@/api/types";
import { trackEvent } from "@/lib/analytics";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type IconName = ComponentProps<typeof Ionicons>["name"];

type SpendingPlan = {
  id: string;
  title: string;
  amount: string;
  allocatedAmount: string;
  savedPercent: number;
  icon: IconName;
  isActive: boolean;
  milestone: number | null;
};

type Props = {
  plans?: Plan[];
  isLoading?: boolean;
};

const toSpendingPlan = (plan: Plan): SpendingPlan => {
  const savedPercent =
    plan.amount > 0
      ? Math.min(
        Math.round((plan.top_level_allocated / plan.amount) * 100),
        100
      )
      : 0;

  return {
    id: plan.id,
    title: plan.name,
    amount: formatMoney(plan.amount, plan.currency),
    allocatedAmount: formatMoney(plan.top_level_allocated, plan.currency),
    savedPercent,
    icon:
      plan.status === "active"
        ? "shield-checkmark-outline"
        : "albums-outline",
    isActive: plan.status === "active",
    milestone: getMilestone(savedPercent),
  };
};

const getMilestone = (percent: number) => {
  if (percent >= 100) return 100;
  if (percent >= 75) return 75;
  if (percent >= 50) return 50;
  if (percent >= 25) return 25;
  return null;
};

const SpendingPlans = ({ plans = [], isLoading }: Props) => {
  const displayPlans = plans.slice(0, 5).map(toSpendingPlan);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Spending Plans</Text>
          <Text style={styles.sectionSubtitle}>
            Your budgets at a glance.
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.replace("/(app)/(tabs)/(plan)/plans")}>
          <Text style={[styles.viewAll, isLoading && styles.viewAllLoading]}>
            {isLoading ? "Loading…" : "View All"}
          </Text>
        </TouchableOpacity>

      </View>

      {isLoading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </ScrollView>
      ) : displayPlans.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="albums-outline" size={22} color="#063B2E" />
          </View>
          <Text style={styles.emptyTitle}>No plans yet</Text>
          <Text style={styles.emptyText}>
            Create a spending plan to start allocating your funds.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {displayPlans.map((plan) => (
            <SpendingPlanCard key={plan.id} plan={plan} />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default SpendingPlans;

const SpendingPlanCard = ({ plan }: { plan: SpendingPlan }) => {
  useEffect(() => {
    if (!plan.milestone) return;

    trackEvent("plan_milestone_seen", {
      milestone: plan.milestone,
      plan_id: plan.id,
    });
  }, [plan.id, plan.milestone]);

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View
          style={[
            styles.iconBox,
            plan.isActive ? styles.iconBoxActive : styles.iconBoxDraft,
          ]}
        >
          <Ionicons
            name={plan.icon}
            size={17}
            color={plan.isActive ? "#063B2E" : "#7A8580"}
          />
        </View>

        <View
          style={[
            styles.statusPill,
            plan.isActive ? styles.statusPillActive : styles.statusPillDraft,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              plan.isActive
                ? styles.statusDotActive
                : styles.statusDotDraft,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              plan.isActive
                ? styles.statusTextActive
                : styles.statusTextDraft,
            ]}
          >
            {plan.isActive ? "Active" : "Draft"}
          </Text>
        </View>
        {plan.milestone ? (
          <View style={styles.milestonePill}>
            <Ionicons name="flag-outline" size={11} color="#106B4F" />
            <Text style={styles.milestoneText}>{plan.milestone}%</Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <Text style={styles.planTitle} numberOfLines={1}>
          {plan.title}
        </Text>
        <Text style={styles.targetText}>Target {plan.amount}</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Allocated</Text>
          <Text style={styles.progressPct}>{plan.savedPercent}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${plan.savedPercent}%`,
                backgroundColor: plan.isActive ? "#58FFBE" : "#DDE6E1",
              },
            ]}
          />
        </View>
        <Text style={styles.allocatedAmt}>{plan.allocatedAmount} of {plan.amount}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 30,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9EAAA5",
    marginTop: 2,
  },

  viewAll: {
    fontSize: 12,
    fontWeight: "800",
    color: "#106B4F",
    paddingTop: 4,
  },

  viewAllLoading: {
    color: "#9EAAA5",
  },

  listContent: {
    gap: 12,
    paddingRight: 4,
  },

  // ── Card ──

  card: {
    width: 272,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    shadowColor: "#063B2E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 14,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  iconBoxActive: {
    backgroundColor: "#DDF7EE",
  },

  iconBoxDraft: {
    backgroundColor: "#EFF1F0",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusPillActive: {
    backgroundColor: "#EAF7F1",
    borderColor: "#CDEDE0",
  },

  statusPillDraft: {
    backgroundColor: "#F4F7F5",
    borderColor: "#DDE6E1",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusDotActive: {
    backgroundColor: "#106B4F",
  },

  statusDotDraft: {
    backgroundColor: "#9EAAA5",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  milestonePill: {
    alignItems: "center",
    backgroundColor: "#EAF7F1",
    borderColor: "#CDEDE0",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  milestoneText: {
    color: "#106B4F",
    fontSize: 10,
    fontWeight: "900",
  },

  statusTextActive: {
    color: "#106B4F",
  },

  statusTextDraft: {
    color: "#7A8580",
  },

  cardBody: {
    gap: 3,
  },

  planTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -0.3,
  },

  targetText: {
    fontSize: 12,
    color: "#9EAAA5",
    fontWeight: "600",
  },

  progressSection: {
    gap: 6,
  },

  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  progressLabel: {
    color: "#9EAAA5",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  progressPct: {
    color: "#063B2E",
    fontSize: 12,
    fontWeight: "900",
  },

  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EDF1EE",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  allocatedAmt: {
    color: "#9EAAA5",
    fontSize: 11,
    fontWeight: "600",
  },

  // ── Skeleton ──

  skeletonCard: {
    width: 272,
    height: 190,
    borderRadius: 22,
    backgroundColor: "#EDF1EE",
    opacity: 0.6,
  },

  // ── Empty ──

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDE6E1",
  },

  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDE6E1",
  },

  emptyTitle: {
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4,
  },

  emptyText: {
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240,
  },
});
