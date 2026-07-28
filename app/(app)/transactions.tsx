import { formatMoney } from "@/api/money";
import { WalletLedger } from "@/api/types";
import { WithdrawalRecord } from "@/api/withdrawals";
import { useWalletLedger } from "@/hooks/app/wallet";
import { useWithdrawalHistory } from "@/hooks/app/withdrawals";
import { trackEvent } from "@/lib/analytics";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { COLORS, Padding, Radius } from "../../themes/colors";



const monoFont = Platform.select({ ios: "Courier New", android: "monospace", default: "monospace" });

type Filter = "all" | "credit" | "debit";

type TransactionItem = WalletLedger & {
  withdrawal_status?: string;
  withdrawal_id?: string;
  is_withdrawal_record?: boolean;
};

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "credit", label: "Credits" },
  { key: "debit", label: "Debits" },
];

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<TransactionItem | null>(null);
  const { data: ledger = [], isLoading, isRefetching, refetch } = useWalletLedger();
  const {
    data: withdrawals = [],
    isLoading: isWithdrawalsLoading,
    isRefetching: isWithdrawalsRefetching,
    refetch: refetchWithdrawals,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useWithdrawalHistory();
  const previousWithdrawalStatuses = useRef<string | undefined>(undefined);

  useEffect(() => {
    const signature = withdrawals.map((item) => `${item.id}:${item.status}`).join("|");
    if (previousWithdrawalStatuses.current === undefined) {
      previousWithdrawalStatuses.current = signature;
      return;
    }
    if (previousWithdrawalStatuses.current !== signature) {
      previousWithdrawalStatuses.current = signature;
      void refetch();
    }
  }, [refetch, withdrawals]);

  const transactions = useMemo<TransactionItem[]>(() => {
    const withdrawalByReference = new Map(
      withdrawals.map((withdrawal) => [withdrawal.reference, withdrawal])
    );
    const withdrawalByID = new Map(withdrawals.map((withdrawal) => [withdrawal.id, withdrawal]));
    const representedReferences = new Set<string>();

    const ledgerItems = ledger.map((item) => {
      const reference = getReference(item);
      const sourceID = item.source_id || item.SourceID;
      const withdrawal = withdrawalByReference.get(reference) || withdrawalByID.get(sourceID || "");
      if (withdrawal) representedReferences.add(withdrawal.reference);
      return withdrawal
        ? {
            ...item,
            withdrawal_status: withdrawal.status,
            withdrawal_id: withdrawal.id
          }
        : item;
    });

    const historyItems = withdrawals
      .filter((withdrawal) => !representedReferences.has(withdrawal.reference))
      .map(withdrawalToTransaction);

    return [...ledgerItems, ...historyItems].sort(
      (a, b) => new Date(getTimestamp(b)).getTime() - new Date(getTimestamp(a)).getTime()
    );
  }, [ledger, withdrawals]);

  useEffect(() => {
    trackEvent("transactions_opened", {
      count: ledger.length,
    });
  }, [ledger.length]);

  const filtered = useMemo(() => {
    return transactions.filter((item) => {
      if (filter === "all") return true;
      return getDirection(item) === filter;
    });
  }, [filter, transactions]);

  const totals = useMemo(() => {
    return ledger.reduce(
      (sum, item) => {
        const amount = Math.abs(getAmount(item));
        if (getDirection(item) === "credit") {
          sum.credit += amount;
        } else {
          sum.debit += amount;
        }

        return sum;
      },
      { credit: 0, debit: 0 }
    );
  }, [ledger]);

  const openDetails = (item: TransactionItem) => {
    setSelected(item);
    trackEvent("transaction_detail_opened", {
      direction: getDirection(item),
      reference: getReference(item),
      source: getSource(item),
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(app)/(tabs)/home");
          }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>Audit deposits, withdrawals and wallet movement.</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || isWithdrawalsRefetching}
            onRefresh={() => void Promise.all([refetch(), refetchWithdrawals()])}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.summaryGrid}>
          <SummaryCard label="Credited" value={formatMoney(totals.credit)} tone="credit" />
          <SummaryCard label="Debited" value={formatMoney(totals.debit)} tone="debit" />
        </View>

        <View style={styles.filterRow}>
          {filters.map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.82}
                onPress={() => setFilter(item.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.listCard}>
          <View style={styles.listCardHeader}>
            <Text style={styles.listCardHeaderText}>Statement</Text>
            <View style={styles.dot} />
            <Text style={styles.listCardHeaderCount}>
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </Text>
          </View>

          {isLoading || isWithdrawalsLoading ? (
            <TransactionListSkeleton />
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={28} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No transactions found</Text>
              <Text style={styles.emptyText}>
                Wallet activity will appear here once money moves in or out.
              </Text>
            </View>
          ) : (
            <>
              {filtered.map((item, index) => (
                <View key={item.id || item.reference || index}>
                  <TransactionRow item={item} onPress={() => openDetails(item)} />
                  {index < filtered.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              ))}
              {hasNextPage ? (
                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={isFetchingNextPage}
                  onPress={() => void fetchNextPage()}
                  style={styles.loadMoreButton}
                >
                  <Text style={styles.loadMoreText}>
                    {isFetchingNextPage ? "Loading..." : "Load older"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <TransactionDetailModal item={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "credit" | "debit";
}) {
  const isCredit = tone === "credit";
  return (
    <View style={[styles.summaryCard, isCredit ? styles.summaryCardCredit : styles.summaryCardDebit]}>
      <View style={styles.summaryTopRow}>
        <View style={[styles.summaryIcon, isCredit ? styles.creditBg : styles.debitBg]}>
          <Ionicons
            name={isCredit ? "arrow-down-outline" : "arrow-up-outline"}
            size={15}
            color={isCredit ? COLORS.secondary : COLORS.tertiary}
          />
        </View>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function TransactionRow({
  item,
  onPress,
}: {
  item: TransactionItem;
  onPress: () => void;
}) {
  const direction = getDirection(item);
  const isCredit = direction === "credit";
  const status = getTransactionStatus(item);

  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, isCredit ? styles.creditBg : styles.debitBg]}>
        <Ionicons
          name={isCredit ? "arrow-down-outline" : "arrow-up-outline"}
          size={16}
          color={isCredit ? COLORS.secondary : COLORS.tertiary}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {getDescription(item)}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {formatTimestamp(getTimestamp(item))} · {getSource(item)}
        </Text>
      </View>
      <View style={styles.rowAmountWrap}>
        <Text style={[styles.rowAmount, isCredit && styles.creditText]}>
          {isCredit ? "+" : "−"}
          {formatMoney(Math.abs(getAmount(item)), getCurrency(item))}
        </Text>
        <Text style={[styles.rowType, statusToneStyle(status)]}>
          {formatStatus(status)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function TransactionDetailModal({
  item,
  onClose,
}: {
  item: TransactionItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const reference = getReference(item);
  const direction = getDirection(item);
  const isCredit = direction === "credit";
  const amount = Math.abs(getAmount(item));
  const status = getTransactionStatus(item);

  const copyReference = async () => {
    if (!reference) return;

    await Clipboard.setStringAsync(reference);
    Toast.show({
      type: "success",
      text1: "Reference copied",
      text2: reference,
    });
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.receiptWrap}>
          <View style={[styles.detailCard, receiptToneStyle(status)]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={16} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.receiptBrandRow}>
              <View style={styles.receiptBadge}>
                <Ionicons name="receipt-outline" size={16} color={COLORS.white} />
              </View>
              <Text style={styles.detailEyebrow}>Transaction receipt</Text>
            </View>

            <Text style={styles.detailTitle}>{getDescription(item)}</Text>

            <View style={styles.amountBlock}>
              <Text style={[styles.amountLabel, isCredit ? styles.creditText : styles.debitText]}>
                {isCredit ? "Money in" : "Money out"}
              </Text>
              <Text style={styles.amountValue}>
                {isCredit ? "+" : "−"}
                {formatMoney(amount, getCurrency(item))}
              </Text>
            </View>

            <View style={styles.perforationRow}>
              {Array.from({ length: 16 }).map((_, i) => (
                <View key={i} style={styles.perforationDot} />
              ))}
            </View>

            <View style={styles.auditList}>
              <AuditRow label="Status" value={formatStatus(status)} />
              <AuditRow label="Timestamp" value={formatTimestamp(getTimestamp(item), true)} />
              <AuditRow label="Reference" value={reference || "Unavailable"} mono />
              <AuditRow label="Source" value={getSource(item)} />
              <AuditRow label="Ledger type" value={getType(item) || direction} />
              {!item.is_withdrawal_record ? (
                <>
                  <AuditRow
                    label="Balance before"
                    value={formatMoney(getBalanceBefore(item), getCurrency(item))}
                    mono
                  />
                  <AuditRow
                    label="Balance after"
                    value={formatMoney(getBalanceAfter(item), getCurrency(item))}
                    mono
                    last
                  />
                </>
              ) : null}
            </View>

            {reference ? (
              <TouchableOpacity activeOpacity={0.82} onPress={copyReference} style={styles.copyButton}>
                <Ionicons name="copy-outline" size={15} color={COLORS.white} />
                <Text style={styles.copyButtonText}>Copy reference</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.receiptFooter}>Keep this for your records</Text>
          </View>

          {/* notches to fake a torn ticket-stub edge */}
          <View style={[styles.notch, styles.notchLeft]} />
          <View style={[styles.notch, styles.notchRight]} />
        </View>
      </View>
    </Modal>
  );
}

function AuditRow({
  label,
  value,
  last,
  mono,
}: {
  label: string;
  value: string;
  last?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={[styles.auditRow, last && styles.auditRowLast]}>
      <Text style={styles.auditLabel}>{label}</Text>
      <Text style={[styles.auditValue, mono && styles.auditValueMono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function withdrawalToTransaction(withdrawal: WithdrawalRecord): TransactionItem {
  return {
    id: `withdrawal:${withdrawal.id}`,
    user_id: "",
    wallet_id: "",
    currency: withdrawal.currency,
    reference: withdrawal.reference,
    type: "withdrawal_debit",
    source: "withdrawal",
    amount: withdrawal.amount,
    description: withdrawal.description || "Wallet withdrawal",
    created_at: withdrawal.created_at || "",
    withdrawal_status: withdrawal.status,
    withdrawal_id: withdrawal.id,
    is_withdrawal_record: true
  };
}

function getTransactionStatus(item: TransactionItem) {
  return String(item.withdrawal_status || "completed").toLowerCase();
}

function formatStatus(status: string) {
  if (["paid", "success", "successful", "completed"].includes(status)) return "Completed";
  if (["failed", "reversed", "cancelled", "canceled", "rejected"].includes(status)) {
    return status === "reversed" ? "Reversed" : "Failed";
  }
  return "Processing";
}

function isCompletedStatus(status: string) {
  return formatStatus(status) === "Completed";
}

function isFailedStatus(status: string) {
  return ["Failed", "Reversed"].includes(formatStatus(status));
}

function statusToneStyle(status: string) {
  if (isCompletedStatus(status)) return styles.rowTypeCompleted;
  if (isFailedStatus(status)) return styles.rowTypeFailed;
  return styles.rowTypeProcessing;
}

function receiptToneStyle(status: string) {
  if (isCompletedStatus(status)) return styles.detailCardCompleted;
  if (isFailedStatus(status)) return styles.detailCardFailed;
  return styles.detailCardProcessing;
}

function TransactionListSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonCopy}>
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLineShort} />
          </View>
          <View style={styles.skeletonAmount} />
        </View>
      ))}
    </View>
  );
}

function getAmount(item: WalletLedger) {
  return item.amount ?? item.Amount ?? 0;
}

function getDirection(item: WalletLedger): "credit" | "debit" {
  const type = getType(item);
  if (
    type === "debit" ||
    type === "withdrawal" ||
    type === "withdrawal_debit" ||
    type.includes("fee")
  ) {
    return "debit";
  }
  if (type === "credit" || type === "refund") return "credit";
  const amount = getAmount(item);
  if (amount < 0) return "debit";
  if (amount > 0) return "credit";
  return "debit";
}

function getType(item: WalletLedger) {
  return String(item.type ?? item.Type ?? "").toLowerCase();
}

function getSource(item: WalletLedger) {
  const source = String(item.source ?? item.Source ?? "").trim();
  return source || "Wallet";
}

function getDescription(item: WalletLedger) {
  const description = String(item.description ?? item.Description ?? "").trim();
  if (description) return description;

  const source = getSource(item);
  const sourceLower = source.toLowerCase();
  const direction = getDirection(item);

  if (sourceLower.includes("deposit")) return "Wallet deposit";
  if (sourceLower.includes("withdraw")) return "Wallet withdrawal";
  if (direction === "credit") return "Wallet deposit";
  if (direction === "debit") return "Wallet withdrawal";

  return source || "Wallet movement";
}

function getTimestamp(item: WalletLedger) {
  return item.created_at ?? item.CreatedAt ?? "";
}

function getCurrency(item: WalletLedger) {
  return item.currency || item.Currency || "NGN";
}

function getReference(item: WalletLedger) {
  return item.reference || item.Reference || "";
}

function getBalanceBefore(item: WalletLedger) {
  return item.balance_before ?? item.BalanceBefore ?? 0;
}

function getBalanceAfter(item: WalletLedger) {
  return item.balance_after ?? item.BalanceAfter ?? 0;
}

function formatTimestamp(value: string, withTime = false) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime
      ? {
        hour: "2-digit",
        minute: "2-digit",
      }
      : {}),
  });
}

const NOTCH_SIZE = 20;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.hash,
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: Padding.containerX,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderColor: `${COLORS.border}33`,
    borderRadius: Radius.large,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    opacity: 0.75,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: Padding.containerX,
    paddingTop: 18,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: Radius.large + 6,
    borderWidth: 1,
    flex: 1,
    padding: 16,
  },
  summaryCardCredit: {
    borderColor: `${COLORS.secondary}33`,
  },
  summaryCardDebit: {
    borderColor: `${COLORS.tertiary}40`,
  },
  summaryTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  summaryIcon: {
    alignItems: "center",
    borderRadius: Radius.medium + 4,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  creditBg: {
    backgroundColor: `${COLORS.secondary}1A`,
  },
  debitBg: {
    backgroundColor: `${COLORS.tertiary}26`,
  },
  summaryLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
    opacity: 0.6,
    textTransform: "uppercase",
  },
  summaryValue: {
    color: COLORS.primary,
    fontSize: 19,
    fontWeight: "900",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  filterChip: {
    backgroundColor: COLORS.white,
    borderColor: `${COLORS.border}33`,
    borderRadius: Radius.large + 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    opacity: 0.7,
  },
  filterTextActive: {
    color: COLORS.white,
    opacity: 1,
  },
  listCard: {
    backgroundColor: COLORS.white,
    borderColor: `${COLORS.border}26`,
    borderRadius: Radius.large + 10,
    borderWidth: 1,
    marginTop: 16,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  listCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  listCardHeaderText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  dot: {
    backgroundColor: `${COLORS.border}55`,
    borderRadius: 2,
    height: 3,
    width: 3,
  },
  listCardHeaderCount: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.55,
  },
  loading: {
    alignItems: "center",
    gap: 10,
    padding: 32,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    opacity: 0.7,
  },
  skeletonList: {
    paddingHorizontal: 18,
    paddingBottom: 10
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14
  },
  skeletonIcon: {
    backgroundColor: COLORS.hash,
    borderRadius: Radius.medium + 6,
    height: 38,
    width: 38
  },
  skeletonCopy: {
    flex: 1,
    gap: 7
  },
  skeletonLine: {
    backgroundColor: COLORS.hash,
    borderRadius: 6,
    height: 12,
    width: "66%"
  },
  skeletonLineShort: {
    backgroundColor: COLORS.hash,
    borderRadius: 5,
    height: 9,
    width: "42%"
  },
  skeletonAmount: {
    backgroundColor: COLORS.hash,
    borderRadius: 6,
    height: 13,
    width: 72
  },
  empty: {
    alignItems: "center",
    padding: 34,
  },
  emptyTitle: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.65,
    textAlign: "center",
  },
  divider: {
    backgroundColor: COLORS.hash,
    height: 1,
    marginHorizontal: 18,
  },
  loadMoreButton: {
    alignItems: "center",
    borderTopColor: COLORS.hash,
    borderTopWidth: 1,
    justifyContent: "center",
    marginHorizontal: 18,
    minHeight: 48
  },
  loadMoreText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800"
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: Radius.medium + 6,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  rowMeta: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.55,
  },
  rowAmountWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  rowAmount: {
    color: COLORS.primary,
    fontFamily: monoFont,
    fontSize: 13,
    fontWeight: "800",
  },
  creditText: {
    color: COLORS.secondary,
  },
  debitText: {
    color: COLORS.tertiary,
  },
  rowType: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  rowTypeCredit: {
    color: COLORS.secondary,
    opacity: 0.7,
  },
  rowTypeDebit: {
    color: COLORS.tertiary,
    opacity: 0.85,
  },
  rowTypeCompleted: {
    color: COLORS.secondary
  },
  rowTypeProcessing: {
    color: "#C47B08"
  },
  rowTypeFailed: {
    color: "#C93C37"
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(6, 20, 16, 0.6)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  receiptWrap: {
    maxWidth: 420,
    position: "relative",
    width: "100%",
  },
  notch: {
    backgroundColor: "rgba(6, 20, 16, 0.6)",
    borderRadius: NOTCH_SIZE / 2,
    height: NOTCH_SIZE,
    position: "absolute",
    top: "38%",
    width: NOTCH_SIZE,
  },
  notchLeft: {
    left: -NOTCH_SIZE / 2,
  },
  notchRight: {
    right: -NOTCH_SIZE / 2,
  },
  detailCard: {
    backgroundColor: COLORS.white,
    borderRadius: Radius.large + 12,
    padding: Padding.containerX,
    width: "100%",
    borderTopWidth: 7
  },
  detailCardCompleted: {
    borderTopColor: COLORS.secondary
  },
  detailCardProcessing: {
    borderTopColor: "#E59A18"
  },
  detailCardFailed: {
    borderTopColor: "#C93C37"
  },
  closeButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: COLORS.hash,
    borderRadius: Radius.medium + 6,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  receiptBrandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  receiptBadge: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: Radius.medium + 4,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  detailEyebrow: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    opacity: 0.55,
    textTransform: "uppercase",
  },
  detailTitle: {
    color: COLORS.primary,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 10,
  },
  amountBlock: {
    marginTop: 18,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  amountValue: {
    color: COLORS.primary,
    fontFamily: monoFont,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  perforationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    justifyContent: "space-between",
    marginTop: 18,
  },
  perforationDot: {
    backgroundColor: COLORS.hash,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  auditList: {
    marginTop: 6,
  },
  auditRow: {
    alignItems: "flex-start",
    borderBottomColor: COLORS.hash,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  auditRowLast: {
    borderBottomWidth: 0,
  },
  auditLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.55,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  auditValue: {
    color: COLORS.primary,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "right",
  },
  auditValueMono: {
    fontFamily: monoFont,
  },
  copyButton: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: Radius.large + 4,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
    marginTop: 20,
  },
  copyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  receiptFooter: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginTop: 14,
    opacity: 0.4,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
