import { formatMoney } from "@/api/money";
import { EnvelopeCard } from "@/components/plan/EnvelopeCard";
import { EnvelopeDetailSkeleton } from "@/components/plan/PlanSkeletons";
import { useDeleteEnvelope, useEnvelope } from "@/hooks/app/envelopes";
import { usePlan } from "@/hooks/app/plans";
import { useEnvelopeWithdrawals } from "@/hooks/app/withdrawals";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useState } from "react";
import Toast from "react-native-toast-message";

export default function EnvelopeDetailScreen() {
  const { id, envelopeId } = useLocalSearchParams<{
    id: string;
    envelopeId: string;
  }>();

  const planId = typeof id === "string" ? id : "";
  const selectedEnvelopeId = typeof envelopeId === "string" ? envelopeId : "";

  const { data: plan } = usePlan(planId);
  const { data: envelope, isLoading } = useEnvelope(planId, selectedEnvelopeId);
  const { data: envelopeTransactions = [] } = useEnvelopeWithdrawals(planId, selectedEnvelopeId);
  const { mutateAsync: deleteEnvelope, isPending: isDeleting } = useDeleteEnvelope(planId);
  const [showDelete, setShowDelete] = useState(false);
  const handleDelete = async () => {
    try {
      await deleteEnvelope(selectedEnvelopeId);
      setShowDelete(false);
      Toast.show({ type: "success", text1: "Envelope deleted" });
      router.back();
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Could not delete envelope",
        text2: error?.response?.data?.message || error?.message || "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <EnvelopeDetailSkeleton />
      </View>
    );
  }

  if (!envelope) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={28} color="#063B2E" />
          </View>
          <Text style={styles.emptyTitle}>Envelope not found</Text>
          <Text style={styles.emptyText}>
            This envelope may have been removed or is no longer available.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const policyText = envelope.unboxed_balance_policy.replace(/_/g, " ");

  // Derive a progress ratio: how much of the amount is unboxed
  const totalAmount = envelope.amount || 1;
  const allocatedRatio = Math.min(
    (envelope.allocated_to_children || 0) / totalAmount,
    1
  );
  const unboxedRatio = Math.min(
    (envelope.unboxed_balance || 0) / totalAmount,
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

          <View style={styles.headerBadge}>
            <View style={styles.headerBadgeDot} />
            <Text style={styles.headerBadgeText}>Envelope</Text>
          </View>
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
              <Text style={styles.kicker} numberOfLines={1}>
                {plan?.name || "Plan Envelope"}
              </Text>
              <Text style={styles.title} numberOfLines={2}>
                {envelope.name}
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="albums-outline" size={22} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>Total allocated</Text>
            <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(envelope.amount)}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              {/* Children slice */}
              <View
                style={[
                  styles.progressSlice,
                  styles.progressSliceChildren,
                  { flex: allocatedRatio },
                ]}
              />
              {/* Unboxed slice */}
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
                  {formatMoney(envelope.allocated_to_children)} children
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
                  {formatMoney(envelope.unboxed_balance)} unboxed
                </Text>
              </View>
            </View>
          </View>

          {/* Policy pill */}
          <View style={styles.policyPill}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#58FFBE" />
            <Text style={styles.policyPillText}>{policyText}</Text>
          </View>
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCell
            label="Amount"
            value={formatMoney(envelope.amount)}
            icon="cash-outline"
            accent={false}
          />
          <View style={styles.statsDivider} />
          <StatCell
            label="Children"
            value={formatMoney(envelope.allocated_to_children)}
            icon="git-branch-outline"
            accent={false}
          />
          <View style={styles.statsDivider} />
          <StatCell
            label="Unboxed"
            value={formatMoney(envelope.unboxed_balance)}
            icon="cube-outline"
            accent={true}
          />
        </View>

        {/* ── Section header ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Envelope card</Text>
          <Text style={styles.sectionSubtitle}>
            Tap through for deeper actions.
          </Text>
        </View>

        <View style={styles.cardWrap}>
          <EnvelopeCard
            envelope={envelope}
            inheritsPlanLock={plan?.unboxed_balance_policy === "locked_until_plan_ends"}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Text style={styles.sectionSubtitle}>Withdrawals recorded against this envelope.</Text>
        </View>
        {envelopeTransactions.length === 0 ? (
          <View style={styles.noTransactions}>
            <Ionicons name="receipt-outline" size={20} color="#8A9892" />
            <Text style={styles.noTransactionsText}>No transactions yet</Text>
          </View>
        ) : (
          envelopeTransactions.map((item) => (
            <View key={item.id} style={styles.transactionRow}>
              <View style={styles.transactionIcon}><Ionicons name="arrow-up-outline" size={16} color="#B42318" /></View>
              <View style={styles.transactionCopy}>
                <Text style={styles.transactionTitle}>{item.description || "Envelope withdrawal"}</Text>
                <Text style={styles.transactionMeta}>{item.status.replace(/_/g, " ")} · {item.created_at ? new Date(item.created_at).toLocaleDateString("en-NG") : ""}</Text>
              </View>
              <Text style={styles.transactionAmount}>-{formatMoney(item.amount, item.currency)}</Text>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[styles.deleteEnvelopeButton, envelopeTransactions.length > 0 && styles.deleteEnvelopeButtonDisabled]}
          disabled={envelopeTransactions.length > 0}
          onPress={() => setShowDelete(true)}
        >
          <Ionicons name="trash-outline" size={16} color={envelopeTransactions.length > 0 ? "#A7B0AC" : "#B42318"} />
          <Text style={[styles.deleteEnvelopeText, envelopeTransactions.length > 0 && styles.deleteEnvelopeTextDisabled]}>
            {envelopeTransactions.length > 0 ? "Cannot delete an envelope with transactions" : "Delete envelope"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal visible={showDelete} transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Delete this envelope?</Text>
            <Text style={styles.deleteModalText}>Its allocation will return to the parent plan. This is only allowed while it has no transaction history.</Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowDelete(false)} disabled={isDeleting}><Text style={styles.modalCancelText}>Keep it</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalDeleteButton} onPress={handleDelete} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.modalDeleteText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
    <View
      style={[
        styles.statIconWrap,
        accent && styles.statIconWrapAccent,
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={accent ? "#063B2E" : "#106B4F"}
      />
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
  noTransactions: { padding: 18, borderRadius: 18, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 9 },
  noTransactionsText: { color: "#7A8580", fontSize: 13, fontWeight: "700" },
  transactionRow: { marginBottom: 9, padding: 14, borderRadius: 16, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 10 },
  transactionIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#FEECEB", alignItems: "center", justifyContent: "center" },
  transactionCopy: { flex: 1 },
  transactionTitle: { color: "#063B2E", fontSize: 12, fontWeight: "800" },
  transactionMeta: { marginTop: 3, color: "#89948F", fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  transactionAmount: { color: "#B42318", fontSize: 12, fontWeight: "900" },
  deleteEnvelopeButton: { marginTop: 22, minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: "#F2C7C3", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  deleteEnvelopeButtonDisabled: { borderColor: "#DDE3E0", backgroundColor: "#EEF1F0" },
  deleteEnvelopeText: { color: "#B42318", fontSize: 12, fontWeight: "800" },
  deleteEnvelopeTextDisabled: { color: "#89948F" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(3,25,19,0.52)", justifyContent: "flex-end", padding: 18 },
  deleteModal: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20 },
  deleteModalTitle: { color: "#063B2E", fontSize: 19, fontWeight: "900" },
  deleteModalText: { marginTop: 7, color: "#66736E", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  deleteModalActions: { marginTop: 20, flexDirection: "row", gap: 10 },
  modalCancelButton: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: "#EDF2EF", alignItems: "center", justifyContent: "center" },
  modalCancelText: { color: "#33443E", fontWeight: "800" },
  modalDeleteButton: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: "#B42318", alignItems: "center", justifyContent: "center" },
  modalDeleteText: { color: "#FFFFFF", fontWeight: "900" },
  container: {
    flex: 1,
    backgroundColor: "#F0F4F2",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 110,
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

  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE6E1",
  },

  headerBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#106B4F",
  },

  headerBadgeText: {
    color: "#106B4F",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
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

  // Progress
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

  progressSliceChildren: {
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

  // Policy pill
  policyPill: {
    alignSelf: "flex-start",
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

  policyPillText: {
    color: "#58FFBE",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
    letterSpacing: 0.2,
  },

  // ── Stats row ──

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginBottom: 20,
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

  // ── Section header ──

  sectionHeader: {
    marginBottom: 12,
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

  cardWrap: {
    gap: 10,
  },

  // ── Empty / loading ──

  emptyState: {
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

  button: {
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

  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
