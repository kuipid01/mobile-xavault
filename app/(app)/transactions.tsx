import { formatMoney } from "@/api/money";
import { WalletLedger } from "@/api/types";
import { useWalletLedger } from "@/hooks/app/wallet";
import { trackEvent } from "@/lib/analytics";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

type Filter = "all" | "credit" | "debit";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "credit", label: "Credits" },
  { key: "debit", label: "Debits" },
];

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<WalletLedger | null>(null);
  const { data: ledger = [], isLoading, isRefetching, refetch } = useWalletLedger();

  useEffect(() => {
    trackEvent("transactions_opened", {
      count: ledger.length,
    });
  }, [ledger.length]);

  const filtered = useMemo(() => {
    return ledger.filter((item) => {
      if (filter === "all") return true;
      return getDirection(item) === filter;
    });
  }, [filter, ledger]);

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

  const openDetails = (item: WalletLedger) => {
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
          <Ionicons name="arrow-back" size={18} color="#063B2E" />
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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
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
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#106B4F" />
              <Text style={styles.loadingText}>Loading transactions...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={28} color="#9EAAA5" />
              <Text style={styles.emptyTitle}>No transactions found</Text>
              <Text style={styles.emptyText}>
                Wallet activity will appear here once money moves in or out.
              </Text>
            </View>
          ) : (
            filtered.map((item, index) => (
              <View key={item.id || item.reference || index}>
                <TransactionRow item={item} onPress={() => openDetails(item)} />
                {index < filtered.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TransactionDetailModal
        item={selected}
        onClose={() => setSelected(null)}
      />
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
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, tone === "credit" ? styles.creditBg : styles.debitBg]}>
        <Ionicons
          name={tone === "credit" ? "arrow-down-outline" : "arrow-up-outline"}
          size={16}
          color={tone === "credit" ? "#106B4F" : "#946500"}
        />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
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
  item: WalletLedger;
  onPress: () => void;
}) {
  const direction = getDirection(item);
  const isCredit = direction === "credit";

  return (
    <TouchableOpacity activeOpacity={0.78} onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, isCredit ? styles.creditBg : styles.debitBg]}>
        <Ionicons
          name={isCredit ? "arrow-down-outline" : "arrow-up-outline"}
          size={16}
          color={isCredit ? "#106B4F" : "#946500"}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {getDescription(item)}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {formatTimestamp(getTimestamp(item))} | {getSource(item)}
        </Text>
      </View>
      <View style={styles.rowAmountWrap}>
        <Text style={[styles.rowAmount, isCredit && styles.creditText]}>
          {isCredit ? "+" : "-"}
          {formatMoney(Math.abs(getAmount(item)), getCurrency(item))}
        </Text>
        <Text style={styles.rowType}>{direction}</Text>
      </View>
    </TouchableOpacity>
  );
}

function TransactionDetailModal({
  item,
  onClose,
}: {
  item: WalletLedger | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const reference = getReference(item);
  const direction = getDirection(item);
  const amount = Math.abs(getAmount(item));

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
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.detailEyebrow}>Transaction audit</Text>
              <Text style={styles.detailTitle}>{getDescription(item)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={16} color="#063B2E" />
            </TouchableOpacity>
          </View>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>{direction}</Text>
            <Text style={styles.amountValue}>
              {direction === "credit" ? "+" : "-"}
              {formatMoney(amount, getCurrency(item))}
            </Text>
          </View>

          <View style={styles.auditList}>
            <AuditRow label="Timestamp" value={formatTimestamp(getTimestamp(item), true)} />
            <AuditRow label="Reference" value={reference || "Unavailable"} />
            <AuditRow label="Source" value={getSource(item)} />
            <AuditRow label="Ledger type" value={getType(item) || direction} />
            <AuditRow
              label="Balance before"
              value={formatMoney(getBalanceBefore(item), getCurrency(item))}
            />
            <AuditRow
              label="Balance after"
              value={formatMoney(getBalanceAfter(item), getCurrency(item))}
              last
            />
          </View>

          {reference ? (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={copyReference}
              style={styles.copyButton}
            >
              <Ionicons name="copy-outline" size={15} color="#FFFFFF" />
              <Text style={styles.copyButtonText}>Copy reference</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function AuditRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.auditRow, last && styles.auditRowLast]}>
      <Text style={styles.auditLabel}>{label}</Text>
      <Text style={styles.auditValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function getAmount(item: WalletLedger) {
  return item.amount ?? item.Amount ?? 0;
}

function getDirection(item: WalletLedger): "credit" | "debit" {
  const type = getType(item);
  const amount = getAmount(item);
  if (type.includes("credit") || amount > 0) return "credit";
  return "debit";
}

function getType(item: WalletLedger) {
  return String(item.type ?? item.Type ?? "").toLowerCase();
}

function getSource(item: WalletLedger) {
  return String(item.source ?? item.Source ?? "Wallet");
}

function getDescription(item: WalletLedger) {
  return item.description ?? item.Description ?? getSource(item) ?? "Wallet movement";
}

function getTimestamp(item: WalletLedger) {
  return item.created_at ?? item.CreatedAt ?? "";
}

function getCurrency(item: WalletLedger) {
  return item.currency || "NGN";
}

function getReference(item: WalletLedger) {
  return item.reference || "";
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#F0F4F2",
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: "#063B2E",
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  content: {
    paddingBottom: 120,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  summaryIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    marginBottom: 12,
    width: 34,
  },
  creditBg: {
    backgroundColor: "#EAF7F1",
  },
  debitBg: {
    backgroundColor: "#FFFBEE",
  },
  summaryLabel: {
    color: "#7A8580",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: "#063B2E",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  filterChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: "#063B2E",
    borderColor: "#063B2E",
  },
  filterText: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 14,
    overflow: "hidden",
  },
  loading: {
    alignItems: "center",
    gap: 10,
    padding: 28,
  },
  loadingText: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    alignItems: "center",
    padding: 30,
  },
  emptyTitle: {
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },
  divider: {
    backgroundColor: "#F0F4F2",
    height: 1,
    marginHorizontal: 16,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    alignItems: "center",
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: "#063B2E",
    fontSize: 14,
    fontWeight: "800",
  },
  rowMeta: {
    color: "#9EAAA5",
    fontSize: 11,
    fontWeight: "600",
  },
  rowAmountWrap: {
    alignItems: "flex-end",
    gap: 2,
  },
  rowAmount: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "900",
  },
  creditText: {
    color: "#106B4F",
  },
  rowType: {
    color: "#9EAAA5",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(6, 20, 16, 0.55)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    width: "100%",
  },
  detailHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  detailEyebrow: {
    color: "#7A8580",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  detailTitle: {
    color: "#063B2E",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F0F4F2",
    borderRadius: 13,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  amountBlock: {
    backgroundColor: "#EAF7F1",
    borderRadius: 18,
    marginTop: 16,
    padding: 16,
  },
  amountLabel: {
    color: "#106B4F",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  amountValue: {
    color: "#063B2E",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },
  auditList: {
    borderColor: "#DDE6E1",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
    overflow: "hidden",
  },
  auditRow: {
    borderBottomColor: "#F0F4F2",
    borderBottomWidth: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  auditRowLast: {
    borderBottomWidth: 0,
  },
  auditLabel: {
    color: "#9EAAA5",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  auditValue: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  copyButton: {
    alignItems: "center",
    backgroundColor: "#063B2E",
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    height: 52,
    justifyContent: "center",
    marginTop: 16,
  },
  copyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
