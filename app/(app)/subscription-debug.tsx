import { PlanCode } from "@/api/subscription";
import {
  useActiveSubscription,
  useSubscriptionPlans,
} from "@/hooks/app/subscription";
import {
  clearSubscriptionReminderState,
  DEFAULT_SUBSCRIPTION_REMINDER_STATE,
  getSubscriptionReminderState,
  recordSubscriptionPromptSkipped,
  saveSubscriptionReminderState,
  SubscriptionPromptTrigger,
  SubscriptionReminderState,
} from "@/hooks/subscription-reminder-storage";
import {
  resetSubscriptionPromptSessionState,
  useSubscriptionPrompt,
} from "@/hooks/use-subscription-prompt";
import { useSubscriptionVerificationContext } from "@/hooks/verify-sub";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = {
  forest: "#063B2E",
  forestLight: "#E6F7EF",
  gold: "#D6A84F",
  surface: "#FFFFFF",
  bg: "#F4F7F5",
  muted: "#6B7280",
  faint: "#9EAAA5",
  border: "#E4ECE8",
  danger: "#B42318",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PLAN_ORDER: PlanCode[] = ["free", "lite", "premium", "power"];

export default function SubscriptionDebugScreen() {
  const [reminderState, setReminderState] =
    useState<SubscriptionReminderState>(DEFAULT_SUBSCRIPTION_REMINDER_STATE);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const { data: plans = [], refetch: refetchPlans } = useSubscriptionPlans();
  const { data: activeSubscription, refetch: refetchActiveSubscription } =
    useActiveSubscription({ enabled: true });
  const { maybeShowSubscriptionPrompt } = useSubscriptionPrompt();
  const {
    clearVerification,
    isVerifying,
    pendingPlanId,
    startVerification,
    checkStatus,
  } = useSubscriptionVerificationContext();

  const paidPlans = useMemo(
    () =>
      plans
        .filter((plan) => plan.Code !== "free")
        .sort(
          (a, b) => PLAN_ORDER.indexOf(a.Code) - PLAN_ORDER.indexOf(b.Code)
        ),
    [plans]
  );
  const testPlan = paidPlans[0];

  const refresh = useCallback(async () => {
    const state = await getSubscriptionReminderState();
    setReminderState(state);
    await Promise.all([refetchPlans(), refetchActiveSubscription()]);
  }, [refetchActiveSubscription, refetchPlans]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (label: string, action: () => Promise<void> | void) => {
    setBusyLabel(label);
    try {
      await action();
      await refresh();
    } catch (error: any) {
      Alert.alert(
        "Debug action failed",
        error?.message || "Something went wrong."
      );
    } finally {
      setBusyLabel(null);
    }
  };

  const triggerPrompt = (trigger: SubscriptionPromptTrigger) =>
    run(`Trigger ${trigger}`, async () => {
      const shown = await maybeShowSubscriptionPrompt(trigger);
      Alert.alert(
        "Prompt result",
        shown ? "Prompt opened." : "Prompt was suppressed."
      );
    });

  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.blocked}>
          <Ionicons name="lock-closed-outline" size={28} color={C.forest} />
          <Text style={styles.title}>Debug tools unavailable</Text>
          <Text style={styles.subtitle}>
            Subscription debug tools only render in development builds.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={20} color={C.forest} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Subscription Debug</Text>
            <Text style={styles.subtitle}>
              Seed reminder and payment states without waiting days.
            </Text>
          </View>
        </View>

        <DebugCard title="Current Data">
          <InfoRow label="Active status" value={activeSubscription?.status} />
          <InfoRow label="Active plan" value={activeSubscription?.plan?.Name} />
          <InfoRow label="Active plan ID" value={activeSubscription?.plan_id} />
          <InfoRow label="Test paid plan" value={testPlan?.Name} />
          <InfoRow label="Test paid plan ID" value={testPlan?.ID} />
          <InfoRow label="Pending verification" value={pendingPlanId || "None"} />
          <InfoRow label="Watcher visible" value={isVerifying ? "Yes" : "No"} />
        </DebugCard>

        <DebugCard title="Reminder State">
          <StateText state={reminderState} />
          <ButtonGrid>
            <DebugButton
              label="Refresh"
              busy={busyLabel === "Refresh"}
              onPress={() => run("Refresh", refresh)}
            />
            <DebugButton
              label="Clear reminder"
              danger
              busy={busyLabel === "Clear reminder"}
              onPress={() =>
                run("Clear reminder", async () => {
                  await clearSubscriptionReminderState();
                })
              }
            />
            <DebugButton
              label="Reset session flag"
              busy={busyLabel === "Reset session flag"}
              onPress={() =>
                run("Reset session flag", () => {
                  resetSubscriptionPromptSessionState();
                })
              }
            />
            <DebugButton
              label="Record skip"
              busy={busyLabel === "Record skip"}
              onPress={() =>
                run("Record skip", async () => {
                  await recordSubscriptionPromptSkipped();
                })
              }
            />
            <DebugButton
              label="Suppress 14 days"
              busy={busyLabel === "Suppress 14 days"}
              onPress={() =>
                run("Suppress 14 days", async () => {
                  await saveSubscriptionReminderState({
                    skipCount: 4,
                    lastShownAt: Date.now() - DAY,
                    lastSkippedAt: Date.now(),
                    suppressUntil: Date.now() + 14 * DAY,
                    lastTrigger: "app_open",
                  });
                })
              }
            />
            <DebugButton
              label="Expire backoff"
              busy={busyLabel === "Expire backoff"}
              onPress={() =>
                run("Expire backoff", async () => {
                  await saveSubscriptionReminderState({
                    skipCount: 2,
                    lastShownAt: Date.now() - 8 * DAY,
                    lastSkippedAt: Date.now() - 4 * DAY,
                    suppressUntil: Date.now() - HOUR,
                    lastTrigger: "app_open",
                  });
                })
              }
            />
            <DebugButton
              label="Allow app open"
              busy={busyLabel === "Allow app open"}
              onPress={() =>
                run("Allow app open", async () => {
                  await saveSubscriptionReminderState({
                    skipCount: 0,
                    lastShownAt: Date.now() - 8 * DAY,
                    lastSkippedAt: null,
                    suppressUntil: null,
                    lastTrigger: "app_open",
                  });
                  resetSubscriptionPromptSessionState();
                })
              }
            />
            <DebugButton
              label="Recent shown"
              busy={busyLabel === "Recent shown"}
              onPress={() =>
                run("Recent shown", async () => {
                  await saveSubscriptionReminderState({
                    skipCount: 0,
                    lastShownAt: Date.now(),
                    lastSkippedAt: null,
                    suppressUntil: null,
                    lastTrigger: "app_open",
                  });
                  resetSubscriptionPromptSessionState();
                })
              }
            />
          </ButtonGrid>
        </DebugCard>

        <DebugCard title="Trigger Prompt">
          <ButtonGrid>
            <DebugButton
              label="app_open"
              busy={busyLabel === "Trigger app_open"}
              onPress={() => triggerPrompt("app_open")}
            />
            <DebugButton
              label="manual"
              busy={busyLabel === "Trigger manual_upgrade_button"}
              onPress={() => triggerPrompt("manual_upgrade_button")}
            />
            <DebugButton
              label="wallet_action"
              busy={busyLabel === "Trigger wallet_action"}
              onPress={() => triggerPrompt("wallet_action")}
            />
            <DebugButton
              label="expired"
              busy={busyLabel === "Trigger subscription_expired"}
              onPress={() => triggerPrompt("subscription_expired")}
            />
          </ButtonGrid>
        </DebugCard>

        <DebugCard title="Payment Verification">
          <Text style={styles.note}>
            This uses the real verification watcher. Success still depends on
            the backend returning an active subscription with the same plan ID.
          </Text>
          <ButtonGrid>
            <DebugButton
              label="Start fake pending"
              disabled={!testPlan}
              busy={busyLabel === "Start fake pending"}
              onPress={() =>
                run("Start fake pending", async () => {
                  if (!testPlan) throw new Error("No paid plan is loaded.");
                  await startVerification(testPlan.ID);
                })
              }
            />
            <DebugButton
              label="Check now"
              busy={busyLabel === "Check now"}
              onPress={() =>
                run("Check now", async () => {
                  const verified = await checkStatus();
                  Alert.alert(
                    "Verification result",
                    verified ? "Verified." : "Not verified yet."
                  );
                })
              }
            />
            <DebugButton
              label="Clear pending"
              danger
              busy={busyLabel === "Clear pending"}
              onPress={() =>
                run("Clear pending", async () => {
                  await clearVerification();
                })
              }
            />
            <DebugButton
              label="Open full upgrade"
              onPress={() => router.push("/(app)/upgrade-plan")}
            />
          </ButtonGrid>
        </DebugCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function DebugCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ButtonGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.buttonGrid}>{children}</View>;
}

function DebugButton({
  busy,
  danger,
  disabled,
  label,
  onPress,
}: {
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={busy || disabled}
      onPress={onPress}
      style={[
        styles.debugButton,
        danger && styles.debugButtonDanger,
        (busy || disabled) && styles.debugButtonDisabled,
      ]}
    >
      <Text
        style={[styles.debugButtonText, danger && styles.debugButtonTextDanger]}
      >
        {busy ? "Working..." : label}
      </Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value || "None"}
      </Text>
    </View>
  );
}

function StateText({ state }: { state: SubscriptionReminderState }) {
  const lines = [
    ["skipCount", String(state.skipCount)],
    ["lastTrigger", state.lastTrigger || "null"],
    ["lastShownAt", formatDebugTime(state.lastShownAt)],
    ["lastSkippedAt", formatDebugTime(state.lastSkippedAt)],
    ["suppressUntil", formatDebugTime(state.suppressUntil)],
  ];

  return (
    <View style={styles.stateBox}>
      {lines.map(([label, value]) => (
        <InfoRow key={label} label={label} value={value} />
      ))}
    </View>
  );
}

function formatDebugTime(value: number | null) {
  if (!value) return "null";
  return `${new Date(value).toLocaleString()} (${value})`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.bg,
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 120,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: C.forest,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 4,
  },
  blocked: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: C.surface,
    borderColor: C.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: C.forest,
    fontSize: 16,
    fontWeight: "900",
  },
  infoRow: {
    gap: 4,
    paddingVertical: 4,
  },
  infoLabel: {
    color: C.faint,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  infoValue: {
    color: C.forest,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  stateBox: {
    backgroundColor: "#F7FAF8",
    borderColor: C.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  note: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  debugButton: {
    alignItems: "center",
    backgroundColor: C.forest,
    borderRadius: 14,
    minHeight: 44,
    minWidth: "47%",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  debugButtonDanger: {
    backgroundColor: "#FFF1F3",
    borderColor: "#FECDD3",
    borderWidth: 1,
  },
  debugButtonDisabled: {
    opacity: 0.5,
  },
  debugButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  debugButtonTextDanger: {
    color: C.danger,
  },
});
