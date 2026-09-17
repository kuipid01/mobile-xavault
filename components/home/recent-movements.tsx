import { formatMoney } from "@/api/money";
import { WalletLedger } from "@/api/types";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

type Props = {
  items?: WalletLedger[];
  isLoading?: boolean;
  onDeposit?: () => void;
};

const getLedgerAmount = (item: WalletLedger) => item.amount ?? item.Amount ?? 0;
const getLedgerType = (item: WalletLedger) =>
  String(item.type ?? item.Type ?? "").toLowerCase();
const getCleanText = (value?: string | null) => {
  const cleaned = String(value ?? "").trim();
  return cleaned.length ? cleaned : null;
};
const getLedgerDescription = (item: WalletLedger) => {
  const description = getCleanText(item.description ?? item.Description);
  if (description) return description;

  const source = getCleanText(item.source ?? item.Source);
  const type = getLedgerType(item);
  const amount = getLedgerAmount(item);

  if (source?.toLowerCase().includes("deposit")) return "Wallet deposit";
  if (source?.toLowerCase().includes("withdraw")) return "Wallet withdrawal";
  if (type.includes("credit") || amount > 0) return "Wallet deposit";
  if (type.includes("debit") || amount < 0) return "Wallet withdrawal";

  return source || "Wallet movement";
};
const getLedgerDate = (item: WalletLedger) =>
  item.created_at ?? item.CreatedAt ?? "";
const getLedgerSource = (item: WalletLedger) =>
  getCleanText(item.source ?? item.Source) || "Wallet";
const getBalanceBefore = (item: WalletLedger) =>
  item.balance_before ?? item.BalanceBefore;
const getBalanceAfter = (item: WalletLedger) =>
  item.balance_after ?? item.BalanceAfter;

const formatDate = (raw: string): string => {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return raw;
  }
};

const RecentMovements = ({ items = [], isLoading, onDeposit }: Props) => {
  const [selectedItem, setSelectedItem] = useState<WalletLedger | null>(null);
  const displayItems = items.slice(0, 3);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent movements</Text>
        <TouchableOpacity
          activeOpacity={0.6}
          hitSlop={8}
          onPress={() => router.push("/(app)/transactions" as never)}
        >
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {isLoading ? (
          <View style={styles.stateWrap}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <View style={styles.skeletonIcon} />
                <View style={styles.skeletonLines}>
                  <View style={styles.skeletonLine} />
                  <View style={styles.skeletonLineSm} />
                </View>
                <View style={styles.skeletonAmount} />
              </View>
            ))}
          </View>
        ) : displayItems.length === 0 ? (
          <View style={styles.stateWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="swap-horizontal-outline" size={18} color="#7A8580" />
            </View>
            <Text style={styles.emptyTitle}>No movements yet</Text>
            <Text style={styles.emptyText}>
              Deposit to your vault to see transactions here.
            </Text>
            {onDeposit ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onDeposit}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>Deposit money</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          displayItems.map((item, index) => (
            <View key={item.id || item.reference}>
              <MovementItem item={item} onPress={() => setSelectedItem(item)} />
              {index < displayItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        )}
      </View>

      <MovementReceiptModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </View>
  );
};

export default RecentMovements;

const MovementItem = ({
  item,
  onPress,
}: {
  item: WalletLedger;
  onPress: () => void;
}) => {
  const type = getLedgerType(item);
  const amount = getLedgerAmount(item);
  const isCredit = type === "credit" || amount > 0;
  const dateStr = formatDate(getLedgerDate(item));
  const ref = item.reference;

  return (
    <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={styles.item}>
      <View style={styles.iconBox}>
        <Ionicons
          name={isCredit ? "arrow-down-outline" : "arrow-up-outline"}
          size={14}
          color={isCredit ? "#106B4F" : "#7A8580"}
        />
      </View>

      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {getLedgerDescription(item)}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {dateStr || ref}
        </Text>
      </View>

      <Text style={[styles.amount, isCredit && styles.amountCredit]}>
        {isCredit ? "+" : "−"}
        {formatMoney(Math.abs(amount))}
      </Text>
    </TouchableOpacity>
  );
};

const MovementReceiptModal = ({
  item,
  onClose,
}: {
  item: WalletLedger | null;
  onClose: () => void;
}) => {
  if (!item) return null;

  const type = getLedgerType(item);
  const amount = getLedgerAmount(item);
  const isCredit = type === "credit" || amount > 0;
  const dateStr = formatDate(getLedgerDate(item));
  const reference = item.reference;
  const balanceBefore = getBalanceBefore(item);
  const balanceAfter = getBalanceAfter(item);
  const signedAmount = `${isCredit ? "+" : "−"}${formatMoney(
    Math.abs(amount),
    item.currency
  )}`;

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
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.receiptOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.receiptSheet}>
          <View style={styles.receiptHandle} />

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close transaction receipt"
            activeOpacity={0.6}
            hitSlop={8}
            onPress={onClose}
            style={styles.receiptClose}
          >
            <Ionicons name="close" size={18} color="#7A8580" />
          </TouchableOpacity>

          <Text style={styles.receiptEyebrow}>
            {isCredit ? "Credit received" : "Debit sent"}
          </Text>
          <Text style={[styles.receiptAmount, isCredit && styles.receiptAmountCredit]}>
            {signedAmount}
          </Text>
          <Text style={styles.receiptDescription} numberOfLines={2}>
            {getLedgerDescription(item)}
          </Text>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.receiptDetails}
          >
            <ReceiptRow label="Status" value="Completed" emphasis />
            <ReceiptRow label="Date" value={dateStr || "Not available"} />
            <ReceiptRow label="Source" value={getLedgerSource(item)} />
            <ReceiptRow label="Type" value={isCredit ? "Credit" : "Debit"} />
            <ReceiptRow
              label="Balance before"
              value={
                typeof balanceBefore === "number"
                  ? formatMoney(balanceBefore, item.currency)
                  : "Not available"
              }
            />
            <ReceiptRow
              label="Balance after"
              value={
                typeof balanceAfter === "number"
                  ? formatMoney(balanceAfter, item.currency)
                  : "Not available"
              }
            />
            {/* <ReceiptRow label="Wallet ID" value={item.wallet_id} /> */}
            <ReceiptRow label="Transaction ID" value={item.id} />
            <ReceiptRow label="Reference" value={reference || "Not available"} last />
          </ScrollView>

          {reference ? (
            <TouchableOpacity
              activeOpacity={0.8}
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
};

const ReceiptRow = ({
  label,
  value,
  emphasis,
  last,
}: {
  label: string;
  value?: string;
  emphasis?: boolean;
  last?: boolean;
}) => (
  <View style={[styles.receiptRow, last && styles.receiptRowLast]}>
    <Text style={styles.receiptRowLabel}>{label}</Text>
    <Text
      style={[styles.receiptRowValue, emphasis && styles.receiptRowValueEmphasis]}
      numberOfLines={2}
    >
      {value || "Not available"}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: "#063B2E",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  viewAll: {
    color: "#7A8580",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E5EBE8",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  divider: {
    backgroundColor: "#F0F4F2",
    height: 1,
    marginLeft: 54,
  },
  item: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconBox: {
    alignItems: "center",
    backgroundColor: "#F7FAF8",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  details: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: "#063B2E",
    fontSize: 13.5,
    fontWeight: "600",
  },
  meta: {
    color: "#9EAAA5",
    fontSize: 11,
    fontWeight: "500",
  },
  amount: {
    color: "#063B2E",
    fontSize: 13.5,
    fontWeight: "700",
  },
  amountCredit: {
    color: "#106B4F",
  },
  stateWrap: {
    gap: 12,
    padding: 18,
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  skeletonIcon: {
    backgroundColor: "#F0F4F2",
    borderRadius: 12,
    height: 34,
    width: 34,
  },
  skeletonLines: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    backgroundColor: "#F0F4F2",
    borderRadius: 5,
    height: 11,
    width: "60%",
  },
  skeletonLineSm: {
    backgroundColor: "#F0F4F2",
    borderRadius: 4,
    height: 8,
    width: "35%",
  },
  skeletonAmount: {
    backgroundColor: "#F0F4F2",
    borderRadius: 5,
    height: 12,
    width: 56,
  },
  emptyIconWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#F7FAF8",
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    marginBottom: 10,
    width: 44,
  },
  emptyTitle: {
    color: "#063B2E",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    alignSelf: "center",
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 4,
    maxWidth: 210,
    textAlign: "center",
  },
  emptyButton: {
    alignSelf: "center",
    backgroundColor: "#063B2E",
    borderRadius: 12,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  receiptOverlay: {
    backgroundColor: "rgba(6, 20, 15, 0.5)",
    flex: 1,
    justifyContent: "flex-end",
  },
  receiptSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "86%",
    paddingBottom: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  receiptHandle: {
    alignSelf: "center",
    backgroundColor: "#E5EBE8",
    borderRadius: 999,
    height: 4,
    marginBottom: 8,
    width: 36,
  },
  receiptClose: {
    alignItems: "center",
    alignSelf: "flex-end",
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  receiptEyebrow: {
    color: "#9EAAA5",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginTop: 4,
  },
  receiptAmount: {
    color: "#063B2E",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -0.8,
    marginTop: 4,
  },
  receiptAmountCredit: {
    color: "#106B4F",
  },
  receiptDescription: {
    color: "#7A8580",
    fontSize: 13.5,
    fontWeight: "500",
    lineHeight: 19,
    marginTop: 6,
  },
  receiptDetails: {
    marginTop: 20,
  },
  receiptRow: {
    borderBottomColor: "#F0F4F2",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  receiptRowLast: {
    borderBottomWidth: 0,
  },
  receiptRowLabel: {
    color: "#9EAAA5",
    fontSize: 12.5,
    fontWeight: "500",
  },
  receiptRowValue: {
    color: "#063B2E",
    fontSize: 12.5,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  receiptRowValueEmphasis: {
    color: "#106B4F",
  },
  copyButton: {
    alignItems: "center",
    backgroundColor: "#063B2E",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    height: 50,
    justifyContent: "center",
    marginTop: 18,
  },
  copyButtonText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
});