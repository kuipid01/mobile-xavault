import { formatMoney } from "@/api/money";
import { AddEnvelopeCard } from "@/components/plan/AddEnvelopeCard";
import { EnvelopeCard } from "@/components/plan/EnvelopeCard";
import { useEnvelopes } from "@/hooks/app/envelopes";
import { useConfirmPlan, usePlan, usePreviewPlan } from "@/hooks/app/plans";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === "string" ? id : "";

  const { data: plan, isLoading: isPlanLoading } = usePlan(planId);
  const { data: envelopes = [], isLoading: isEnvelopesLoading } =
    useEnvelopes(planId);
  const { data: preview } = usePreviewPlan(
    plan?.status === "draft" ? planId : undefined
  );
  const { mutateAsync: confirm, isPending: isConfirming } =
    useConfirmPlan(planId);

  const handleConfirm = async () => {
    try {
      await confirm();
      Toast.show({ type: "success", text1: "Plan confirmed" });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Could not confirm plan",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please try again.",
      });
    }
  };

  if (isPlanLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#063B2E" />
          <Text style={styles.loadingTitle}>Loading plan…</Text>
          <Text style={styles.loadingSubtitle}>
            Fetching your spending plan details.
          </Text>
        </View>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="folder-open-outline" size={28} color="#063B2E" />
          </View>
          <Text style={styles.emptyTitle}>Plan not found</Text>
          <Text style={styles.emptyText}>
            This plan may have been deleted or is no longer available.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isDraft = plan.status === "draft";
  const canConfirm = Boolean(preview?.can_confirm);

  // Allocation progress
  const totalAmount = plan.amount || 1;
  const allocatedRatio = Math.min(
    (plan.top_level_allocated || 0) / totalAmount,
    1
  );
  const unboxedRatio = Math.min(
    (plan.plan_unboxed_balance || 0) / totalAmount,
    1
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header bar ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={20} color="#063B2E" />
          </TouchableOpacity>

          <StatusBadge status={plan.status} />
        </View>

        {/* ── Hero card ── */}
        <View style={styles.heroCard}>
          {/* Dot-grid texture */}
          <View style={styles.dotGrid} pointerEvents="none">
            {Array.from({ length: 48 }).map((_, i) => (
              <View key={i} style={styles.dot} />
            ))}
          </View>

          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.kicker}>Spending Plan</Text>
              <Text style={styles.title} numberOfLines={2}>
                {plan.name}
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="pie-chart-outline" size={22} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Target amount</Text>
            <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(plan.amount, plan.currency)}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressSlice,
                  styles.progressSliceAllocated,
                  { flex: allocatedRatio },
                ]}
              />
              <View
                style={[
                  styles.progressSlice,
                  styles.progressSliceUnboxed,
                  { flex: unboxedRatio },
                ]}
              />
            </View>
            <View style={styles.progressLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#58FFBE" }]} />
                <Text style={styles.legendText}>
                  {formatMoney(plan.top_level_allocated, plan.currency)} allocated
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: "rgba(255,255,255,0.4)" },
                  ]}
                />
                <Text style={styles.legendText}>
                  {formatMoney(plan.plan_unboxed_balance, plan.currency)} unboxed
                </Text>
              </View>
            </View>
          </View>

          {/* Meta pills */}
          <View style={styles.heroMetaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="albums-outline" size={13} color="#58FFBE" />
              <Text style={styles.metaPillText}>
                {envelopes.length} envelope{envelopes.length === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.metaPill}>
              <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.55)" />
              <Text style={[styles.metaPillText, styles.metaPillTextMuted]}>
                {plan.unboxed_balance_policy.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCell
            label="Allocated"
            value={formatMoney(plan.top_level_allocated, plan.currency)}
            icon="checkmark-circle-outline"
            accent={true}
          />
          <View style={styles.statsDivider} />
          <StatCell
            label="Unboxed"
            value={formatMoney(plan.plan_unboxed_balance, plan.currency)}
            icon="cube-outline"
            accent={false}
          />
          <View style={styles.statsDivider} />
          <StatCell
            label="Policy"
            value={plan.unboxed_balance_policy.replace(/_/g, " ")}
            icon="lock-closed-outline"
            accent={false}
          />
        </View>

        {/* ── Draft confirmation card ── */}
        {isDraft ? (
          <View
            style={[
              styles.previewCard,
              canConfirm ? styles.previewCardReady : styles.previewCardBlocked,
            ]}
          >
            <View style={styles.previewHeader}>
              <View
                style={[
                  styles.previewIconWrap,
                  canConfirm
                    ? styles.previewIconWrapReady
                    : styles.previewIconWrapBlocked,
                ]}
              >
                <Ionicons
                  name={
                    canConfirm
                      ? "checkmark-circle-outline"
                      : "alert-circle-outline"
                  }
                  size={20}
                  color={canConfirm ? "#106B4F" : "#B42318"}
                />
              </View>

              <View style={styles.previewHeaderText}>
                <Text style={styles.previewTitle}>
                  {canConfirm ? "Ready to go live" : "Action needed"}
                </Text>
                <Text style={styles.previewSubtitle}>
                  {canConfirm
                    ? "This plan passes all checks."
                    : "Fix the issues below before confirming."}
                </Text>
              </View>
            </View>

            {preview?.validation_errors?.length ? (
              <View style={styles.previewBody}>
                {preview.validation_errors.map((error) => (
                  <View
                    key={`${error.code}-${error.field}`}
                    style={styles.errorRow}
                  >
                    <Ionicons name="warning-outline" size={14} color="#B42318" />
                    <Text style={styles.errorText}>{error.message}</Text>
                  </View>
                ))}
              </View>
            ) : !canConfirm ? (
              <View style={styles.previewBody}>
                <View style={styles.hintRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color="#7A8580"
                  />
                  <Text style={styles.hintText}>
                    Add envelopes or fund your wallet before confirming.
                  </Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!canConfirm || isConfirming) && styles.confirmButtonDisabled,
              ]}
              disabled={!canConfirm || isConfirming}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              {isConfirming ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.confirmButtonText}>Confirm Plan</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Envelopes section ── */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Envelopes</Text>
            <Text style={styles.sectionSubtitle}>
              Split this plan into categories and goals.
            </Text>
          </View>

          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{envelopes.length}</Text>
          </View>
        </View>

        {isEnvelopesLoading ? (
          <View style={styles.envelopeLoadingCard}>
            <ActivityIndicator color="#063B2E" size="small" />
            <Text style={styles.loadingTitle}>Loading envelopes…</Text>
          </View>
        ) : null}

        {!isEnvelopesLoading && envelopes.length === 0 ? (
          <View style={styles.emptyEnvelopeCard}>
            <View style={styles.emptyEnvelopeIcon}>
              <Ionicons name="albums-outline" size={22} color="#063B2E" />
            </View>
            <Text style={styles.emptyEnvelopeTitle}>No envelopes yet</Text>
            <Text style={styles.emptyEnvelopeText}>
              Add your first envelope to direct where this money should go.
            </Text>
          </View>
        ) : null}

        <View style={styles.envelopes}>
          {envelopes.map((envelope) => (
            <EnvelopeCard
              key={envelope.id}
              envelope={envelope}
              onPress={() =>
                router.push({
                  pathname: "/(app)/(tabs)/(plan)/plans/[id]/envelopes/[envelopeId]",
                  params: { id: plan.id, envelopeId: envelope.id },
                })
              }
            />
          ))}
        </View>

        <AddEnvelopeCard
          onPress={() =>
            router.push({
              pathname: "/(app)/(tabs)/(plan)/plans/[id]/envelopes/create",
              params: { id: plan.id },
            })
          }
        />
      </ScrollView>
    </View>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  const normalized = status.toLowerCase();
  const isDraft = normalized === "draft";
  const isActive = normalized === "active" || normalized === "confirmed";

  return (
    <View
      style={[
        styles.statusBadge,
        isDraft && styles.statusBadgeDraft,
        isActive && styles.statusBadgeActive,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          isDraft && styles.statusDotDraft,
          isActive && styles.statusDotActive,
        ]}
      />
      <Text
        style={[
          styles.statusText,
          isDraft && styles.statusTextDraft,
          isActive && styles.statusTextActive,
        ]}
      >
        {status.replace(/_/g, " ").toUpperCase()}
      </Text>
    </View>
  );
};

// ─── Stat cell ────────────────────────────────────────────────────────────────

const StatCell = ({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: boolean;
}) => (
  <View style={styles.statCell}>
    <View style={[styles.statIconWrap, accent && styles.statIconWrapAccent]}>
      <Ionicons name={icon} size={16} color={accent ? "#063B2E" : "#106B4F"} />
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <Text
      style={[styles.statValue, accent && styles.statValueAccent]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F2",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 110,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },

  loadingTitle: {
    color: "#063B2E",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 14,
  },

  loadingSubtitle: {
    color: "#9EAAA5",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 5,
  },

  // ── Header ──

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    shadowColor: "#063B2E",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusBadgeDraft: {
    backgroundColor: "#FFFBEE",
    borderColor: "#F2E4A8",
  },

  statusBadgeActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  statusDotDraft: {
    backgroundColor: "#D79500",
  },

  statusDotActive: {
    backgroundColor: "#106B4F",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  statusTextDraft: {
    color: "#946500",
  },

  statusTextActive: {
    color: "#106B4F",
  },

  // ── Hero card ──

  heroCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#063B2E",
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
  },

  dotGrid: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 160,
    height: 130,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 14,
    opacity: 0.18,
  },

  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#FFFFFF",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 24,
  },

  heroTextWrap: {
    flex: 1,
  },

  kicker: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.6,
    lineHeight: 30,
  },

  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  amountBlock: {
    marginBottom: 20,
  },

  amountLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  amount: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1.5,
  },

  progressWrap: {
    marginBottom: 16,
  },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 10,
  },

  progressSlice: {
    height: "100%",
  },

  progressSliceAllocated: {
    backgroundColor: "#58FFBE",
    borderRadius: 3,
  },

  progressSliceUnboxed: {
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 3,
  },

  progressLegend: {
    flexDirection: "row",
    gap: 16,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  legendText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
  },

  heroMetaRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(88,255,190,0.12)",
    borderWidth: 1,
    borderColor: "rgba(88,255,190,0.2)",
  },

  metaPillText: {
    color: "#58FFBE",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },

  metaPillTextMuted: {
    color: "rgba(255,255,255,0.55)",
  },

  // ── Stats row ──

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    overflow: "hidden",
    shadowColor: "#063B2E",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  statCell: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "flex-start",
  },

  statsDivider: {
    width: 1,
    backgroundColor: "#EDF1EE",
    marginVertical: 14,
  },

  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EAF7F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  statIconWrapAccent: {
    backgroundColor: "#58FFBE",
  },

  statLabel: {
    color: "#9EAAA5",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },

  statValue: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  statValueAccent: {
    color: "#063B2E",
  },

  // ── Preview / confirmation card ──

  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    shadowColor: "#063B2E",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },

  previewCardReady: {
    borderColor: "#CDEDE0",
  },

  previewCardBlocked: {
    borderColor: "#FFDAD6",
  },

  previewHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },

  previewIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  previewIconWrapReady: {
    backgroundColor: "#EAF7F1",
  },

  previewIconWrapBlocked: {
    backgroundColor: "#FFF1F0",
  },

  previewHeaderText: {
    flex: 1,
    justifyContent: "center",
  },

  previewTitle: {
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  previewSubtitle: {
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    lineHeight: 17,
  },

  previewBody: {
    gap: 7,
    marginBottom: 14,
  },

  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFF4F3",
    borderWidth: 1,
    borderColor: "#FFDAD6",
    borderRadius: 12,
    padding: 11,
  },

  errorText: {
    flex: 1,
    color: "#B42318",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },

  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F4F7F5",
    borderRadius: 12,
    padding: 11,
  },

  hintText: {
    flex: 1,
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },

  confirmButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#063B2E",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#063B2E",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },

  confirmButtonDisabled: {
    opacity: 0.4,
  },

  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },

  // ── Section header ──

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#063B2E",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },

  countPill: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  countPillText: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "900",
  },

  // ── Envelope list states ──

  envelopeLoadingCard: {
    minHeight: 80,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  emptyEnvelopeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    marginBottom: 14,
  },

  emptyEnvelopeIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDE6E1",
  },

  emptyEnvelopeTitle: {
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "900",
  },

  emptyEnvelopeText: {
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 5,
    maxWidth: 240,
  },

  envelopes: {
    gap: 10,
    marginBottom: 12,
  },

  // ── Full-screen empty/error ──

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#DDE6E1",
  },

  emptyTitle: {
    color: "#063B2E",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
  },

  emptyText: {
    color: "#9EAAA5",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 6,
  },

  primaryButton: {
    marginTop: 20,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#063B2E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    flexDirection: "row",
    gap: 8,
    shadowColor: "#063B2E",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
