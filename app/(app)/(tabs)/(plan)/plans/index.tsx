import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { PlanStatus } from "@/api/types";
import AppHeaderActions from "@/components/home/AppHeaderActions";
import { EmptyPlanCard } from "@/components/plan/EmptyPlanCard";
import { PlanCard } from "@/components/plan/PlanCard";
import { usePlans } from "@/hooks/app/plans";
import { useWalletActions } from "@/hooks/app/use-wallet-actions";

const tabs: { label: string; value: PlanStatus }[] = [
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function PlansScreen() {
  const [activeTab, setActiveTab] = useState<PlanStatus>("active");
  const { data, isLoading } = usePlans(activeTab);
  const { openDeposit, openWithdrawal, walletActionModals } = useWalletActions();
  const visiblePlans = data?.items || [];

  return (
    <View style={styles.container}>
      <AppHeaderActions onDeposit={openDeposit} onWithdraw={openWithdrawal} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>Planning</Text>
          <Text style={styles.heading}>Plan your money with clarity</Text>
          <Text style={styles.subtitle}>
            Organize your funds into simple plans and envelopes before spending starts.
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((tab) => {
            const isActive = tab.value === activeTab;

            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setActiveTab(tab.value)}
                style={[styles.tab, isActive && styles.activeTab]}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isLoading ? <Text style={styles.emptyText}>Loading plans...</Text> : null}

        {!isLoading && !visiblePlans.length ? (
          <Text style={styles.emptyText}>No {activeTab} plans yet.</Text>
        ) : null}

        {visiblePlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onPress={() =>
              router.push({
                pathname: "/(app)/(tabs)/(plan)/plans/[id]",
                params: { id: plan.id },
              })
            }
          />
        ))}

        <EmptyPlanCard onPress={() => router.push("/(app)/(tabs)/(plan)/plans/create")} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(app)/(tabs)/(plan)/plans/create")}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      {walletActionModals}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FD",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 120,
  },
  headerCard: {
    backgroundColor: "#063B2E",
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  eyebrow: {
    color: "#D6A84F",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 8,
  },
  subtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 22,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E7ECE9",
  },
  activeTab: {
    backgroundColor: "#063B2E",
    borderColor: "#063B2E",
  },
  tabText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "800",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 100,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#003C2F",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 16,
  },
});
