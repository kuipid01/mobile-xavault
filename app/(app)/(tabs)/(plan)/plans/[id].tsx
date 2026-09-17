import { formatMoney } from "@/api/money";
import { AddEnvelopeCard } from "@/components/plan/AddEnvelopeCard";
import { EnvelopeCard } from "@/components/plan/EnvelopeCard";
import {
  EnvelopeListSkeleton,
  PlanDetailSkeleton,
} from "@/components/plan/PlanSkeletons";
import { envelopeKeys, useEnvelopes } from "@/hooks/app/envelopes";
import {
  planKeys,
  useCancelPlan,
  useConfirmPlan,
  usePlan,
  usePreviewPlan,
} from "@/hooks/app/plans";
import { useSubscriptionLimitModal } from "@/hooks/use-subscription-limit-modal";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
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

  const queryClient = useQueryClient();
  const { data: plan, isLoading: isPlanLoading } = usePlan(planId);
  const {
    data: envelopes = [],
    isLoading: isEnvelopesLoading,
    refetch: refetchEnvelopes,
    isRefetching: isEnvelopesRefetching,
  } = useEnvelopes(planId);
  const { data: preview } = usePreviewPlan(
    plan?.status === "draft" ? planId : undefined
  );
  const { mutateAsync: confirm, isPending: isConfirming } =
    useConfirmPlan(planId);
  const { mutateAsync: deleteDraft, isPending: isDeletingDraft } = useCancelPlan(planId);
  const [showDeleteDraft, setShowDeleteDraft] = useState(false);
  const { showSubscriptionLimitModal } = useSubscriptionLimitModal();

  const handleConfirm = async () => {
    try {
      await confirm();
      Toast.show({ type: "success", text1: "Plan confirmed" });
    } catch (error: any) {
      if (showSubscriptionLimitModal("plan_confirm", error)) {
        return;
      }

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

  const handleDeleteDraft = async () => {
    try {
      await deleteDraft("Deleted draft plan");
      setShowDeleteDraft(false);
      Toast.show({ type: "success", text1: "Draft plan deleted" });
      router.replace("/(app)/(tabs)/(plan)/plans");
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Could not delete draft",
        text2: error?.response?.data?.message || error?.message || "Please try again.",
      });
    }
  };

  if (isPlanLoading) {
    return (
      <View style={styles.container}>
        <PlanDetailSkeleton />
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

  // Withdrawal / exhaustion state
  const planPaid = plan.withdrawn_amount ?? 0;
  const planPending = plan.pending_withdrawal_amount ?? 0;
  const planRemaining =
    plan.remaining_balance ?? Math.max(plan.amount - planPaid - planPending, 0);
  const isPlanExhausted =
    plan.is_exhausted ?? (plan.amount > 0 && planRemaining <= 0);

  // Countdown state
  const endDateMs = plan.end_date ? new Date(plan.end_date).getTime() : NaN;
  const daysRemaining = Number.isNaN(endDateMs)
    ? null
    : Math.ceil((endDateMs - Date.now()) / 86_400_000);
  const hasNoDaysRemaining = daysRemaining !== null && daysRemaining <= 0;

  // Allocation actions are pointless once every kobo has been paid out.
  const bulkDisabled = !isDraft && isPlanExhausted;

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
  const withdrawnRatio = Math.min((planPaid + planPending) / totalAmount, 1);

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
        

          <View style={styles.heroTop}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.kicker}>Spending Plan</Text>
              <Text style={styles.title} numberOfLines={2}>
                {plan.name}
              </Text>
            </View>

            <View style={styles.heroIcon}>
         
            <TouchableOpacity
              onPress={() => {
                queryClient.invalidateQueries({ queryKey: envelopeKeys.list(planId) });
                queryClient.invalidateQueries({ queryKey: planKeys.detail(planId) });
                refetchEnvelopes();
              }}
              disabled={isEnvelopesRefetching}
              activeOpacity={0.7}
              // style={styles.refreshButton}
              accessibilityLabel="Refresh envelopes"
              accessibilityRole="button"
            >
              <Ionicons
                name="refresh"
                size={16}
                color="white"
              />
            </TouchableOpacity>

    
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
                  styles.progressSliceWithdrawn,
                  { flex: withdrawnRatio },
                ]}
              />
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
              {planPaid + planPending > 0 ? (
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: "#D6A84F" },
                    ]}
                  />
                  <Text style={styles.legendText}>
                    {formatMoney(planPaid + planPending, plan.currency)} withdrawn
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Meta pills */}
          <View style={styles.heroMetaRow}>
            <View
              style={[styles.metaPill, hasNoDaysRemaining && styles.metaPillEnded]}
            >
              <Ionicons
                name={hasNoDaysRemaining ? "calendar-clear-outline" : "time-outline"}
                size={13}
                color={hasNoDaysRemaining ? "#D6A84F" : "#58FFBE"}
              />
              <Text
                style={[
                  styles.metaPillText,
                  hasNoDaysRemaining && styles.metaPillTextEnded,
                ]}
              >
                {hasNoDaysRemaining
                  ? "No days remaining"
                  : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`}
              </Text>
            </View>

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

        {/* ── Exhausted banner ── */}
        {isPlanExhausted && !isDraft ? (
          <View style={styles.exhaustedBanner}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color="#6B7280" />
            <Text style={styles.exhaustedBannerText}>
              Fully withdrawn — all funds from this plan have been paid out.
            </Text>
          </View>
        ) : null}

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
            label="Withdrawn"
            value={formatMoney(planPaid + planPending, plan.currency)}
            icon="arrow-up-circle-outline"
            accent={false}
          />
          <View style={styles.statsDivider} />
          <StatCell
            label="Remaining"
            value={formatMoney(planRemaining, plan.currency)}
            icon="cube-outline"
            accent={!isPlanExhausted}
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
            <TouchableOpacity
              style={styles.deleteDraftButton}
              onPress={() => setShowDeleteDraft(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={16} color="#B42318" />
              <Text style={styles.deleteDraftText}>Delete draft</Text>
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

        
        </View>

        {isEnvelopesLoading ? (
          <EnvelopeListSkeleton />
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
              inheritsPlanLock={plan.unboxed_balance_policy === "locked_until_plan_ends"}
              onPress={() =>
                router.push({
                  pathname: "/(app)/(tabs)/(plan)/plans/[id]/envelopes/[envelopeId]",
                  params: { id: plan.id, envelopeId: envelope.id },
                })
              }
              onChildPress={(child) =>
                router.push({
                  pathname: "/(app)/(tabs)/(plan)/plans/[id]/envelopes/[envelopeId]",
                  params: { id: plan.id, envelopeId: child.id },
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
          allocatable={isDraft ? undefined : Math.max(planRemaining - (plan.top_level_allocated || 0), 0)}
          currency={plan.currency}
        />

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() =>
            router.push({
              pathname: "/(app)/(tabs)/(plan)/plans/[id]/envelopes/bulk",
              params: { id: plan.id },
            })
          }
          disabled={bulkDisabled}
          style={[styles.bulkButton, bulkDisabled && styles.bulkButtonDisabled]}
        >
          <Ionicons
            name={bulkDisabled ? "lock-closed-outline" : "layers-outline"}
            size={18}
            color={bulkDisabled ? "#8A9892" : "#106B4F"}
          />
          <Text
            style={[
              styles.bulkButtonText,
              bulkDisabled && styles.bulkButtonTextDisabled,
            ]}
          >
            {bulkDisabled ? "All funds paid out" : "Bulk envelopes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal visible={showDeleteDraft} transparent animationType="fade" onRequestClose={() => setShowDeleteDraft(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteModalIcon}><Ionicons name="trash-outline" size={22} color="#B42318" /></View>
            <Text style={styles.deleteModalTitle}>Delete this draft?</Text>
            <Text style={styles.deleteModalText}>The draft and its unconfirmed setup will be removed. No wallet funds are affected.</Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowDeleteDraft(false)} disabled={isDeletingDraft}>
                <Text style={styles.modalCancelText}>Keep draft</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteButton} onPress={handleDeleteDraft} disabled={isDeletingDraft}>
                {isDeletingDraft ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.modalDeleteText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  progressSliceWithdrawn: {
    backgroundColor: "#D6A84F",
    borderRadius: 3,
  },

  exhaustedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },

  exhaustedBannerText: {
    flex: 1,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
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

  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
    alignItems: "center",
    justifyContent: "center",
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
  deleteDraftButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F2C7C3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  deleteDraftText: { color: "#B42318", fontSize: 13, fontWeight: "800" },
  bulkButton: {
    marginTop: 10,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EAF7F1",
    borderWidth: 1,
    borderColor: "#CDEDE0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bulkButtonDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  bulkButtonText: { color: "#106B4F", fontSize: 14, fontWeight: "900" },
  bulkButtonTextDisabled: { color: "#8A9892" },

  metaPillEnded: {
    backgroundColor: "rgba(214,168,79,0.12)",
    borderColor: "rgba(214,168,79,0.3)",
  },

  metaPillTextEnded: {
    color: "#D6A84F",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 25, 19, 0.52)",
    justifyContent: "flex-end",
    padding: 18,
  },
  deleteModal: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20 },
  deleteModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#FEECEB",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteModalTitle: { marginTop: 14, color: "#063B2E", fontSize: 19, fontWeight: "900" },
  deleteModalText: { marginTop: 7, color: "#66736E", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  deleteModalActions: { marginTop: 20, flexDirection: "row", gap: 10 },
  modalCancelButton: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: "#EDF2EF", alignItems: "center", justifyContent: "center" },
  modalCancelText: { color: "#33443E", fontWeight: "800" },
  modalDeleteButton: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: "#B42318", alignItems: "center", justifyContent: "center" },
  modalDeleteText: { color: "#FFFFFF", fontWeight: "900" },
});
