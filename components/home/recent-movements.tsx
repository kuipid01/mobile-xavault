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
        <View>
          <Text style={styles.sectionTitle}>Recent Movements</Text>
          <Text style={styles.sectionSubtitle}>Last 3 wallet movements.</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.75}
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
              <Ionicons name="swap-horizontal-outline" size={20} color="#063B2E" />
            </View>
            <Text style={styles.emptyTitle}>No movements yet</Text>
            <Text style={styles.emptyText}>
              Deposit to your vault to see transactions here.
            </Text>
            {onDeposit ? (
              <TouchableOpacity
                activeOpacity={0.82}
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
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      style={styles.item}
    >
      <View
        style={[
          styles.iconBox,
          isCredit ? styles.iconBoxCredit : styles.iconBoxDebit,
        ]}
      >
        <Ionicons
          name={isCredit ? "arrow-down-outline" : "arrow-up-outline"}
          size={16}
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

      <View style={styles.amountCol}>
        <Text style={[styles.amount, isCredit && styles.amountCredit]}>
          {isCredit ? "+" : "-"}
          {formatMoney(Math.abs(amount))}
        </Text>
        <Text style={styles.typeLabel}>{isCredit ? "Credit" : "Debit"}</Text>
      </View>
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
  const signedAmount = `${isCredit ? "+" : "-"}${formatMoney(
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

          <View style={styles.receiptHeader}>
            <View
              style={[
                styles.receiptIcon,
                isCredit ? styles.receiptIconCredit : styles.receiptIconDebit,
              ]}
            >
              <Ionicons
                name={isCredit ? "arrow-down-outline" : "arrow-up-outline"}
                size={22}
                color={isCredit ? "#106B4F" : "#7A8580"}
              />
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close transaction receipt"
              activeOpacity={0.8}
              onPress={onClose}
              style={styles.receiptClose}
            >
              <Ionicons name="close" size={19} color="#063B2E" />
            </TouchableOpacity>
          </View>

          <Text style={styles.receiptEyebrow}>
            {isCredit ? "Credit Received" : "Debit Sent"}
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
            <ReceiptRow label="Wallet ID" value={item.wallet_id} />
            <ReceiptRow label="Transaction ID" value={item.id} />
            <ReceiptRow label="Reference" value={reference || "Not available"} />
          </ScrollView>

          {reference ? (
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={copyReference}
              style={styles.copyButton}
            >
              <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
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
}: {
  label: string;
  value?: string;
  emphasis?: boolean;
}) => (
  <View style={styles.receiptRow}>
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
    marginTop: 30,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#063B2E",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  viewAll: {
    color: "#106B4F",
    fontSize: 12,
    fontWeight: "900",
    paddingTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DDE6E1",
    borderRadius: 22,
    borderWidth: 1,
    elevation: 2,
    overflow: "hidden",
    shadowColor: "#063B2E",
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  divider: {
    backgroundColor: "#F0F4F2",
    height: 1,
    marginHorizontal: 16,
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
    borderRadius: 13,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  iconBoxCredit: {
    backgroundColor: "#EAF7F1",
  },
  iconBoxDebit: {
    backgroundColor: "#F0F4F2",
  },
  details: {
    flex: 1,
    gap: 3,
  },
  name: {
    color: "#063B2E",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  meta: {
    color: "#9EAAA5",
    fontSize: 11,
    fontWeight: "600",
  },
  amountCol: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    color: "#063B2E",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  amountCredit: {
    color: "#106B4F",
  },
  typeLabel: {
    color: "#9EAAA5",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  stateWrap: {
    gap: 14,
    padding: 16,
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  skeletonIcon: {
    backgroundColor: "#EDF1EE",
    borderRadius: 13,
    height: 38,
    width: 38,
  },
  skeletonLines: {
    flex: 1,
    gap: 7,
  },
  skeletonLine: {
    backgroundColor: "#EDF1EE",
    borderRadius: 6,
    height: 12,
    width: "65%",
  },
  skeletonLineSm: {
    backgroundColor: "#EDF1EE",
    borderRadius: 5,
    height: 9,
    width: "40%",
  },
  skeletonAmount: {
    backgroundColor: "#EDF1EE",
    borderRadius: 6,
    height: 14,
    width: 64,
  },
  emptyIconWrap: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#EAF3EF",
    borderColor: "#DDE6E1",
    borderRadius: 17,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    marginBottom: 10,
    width: 50,
  },
  emptyTitle: {
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    alignSelf: "center",
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 220,
    textAlign: "center",
  },
  emptyButton: {
    alignSelf: "center",
    backgroundColor: "#063B2E",
    borderRadius: 13,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  receiptOverlay: {
    backgroundColor: "rgba(2, 18, 13, 0.58)",
    flex: 1,
    justifyContent: "flex-end",
  },
  receiptSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "86%",
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  receiptHandle: {
    alignSelf: "center",
    backgroundColor: "#D8DDDA",
    borderRadius: 999,
    height: 5,
    marginBottom: 18,
    width: 48,
  },
  receiptHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  receiptIcon: {
    alignItems: "center",
    borderRadius: 20,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  receiptIconCredit: {
    backgroundColor: "#EAF7F1",
  },
  receiptIconDebit: {
    backgroundColor: "#F0F4F2",
  },
  receiptClose: {
    alignItems: "center",
    backgroundColor: "#F4F7F5",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  receiptEyebrow: {
    color: "#7A8580",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 18,
    textTransform: "uppercase",
  },
  receiptAmount: {
    color: "#063B2E",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 4,
  },
  receiptAmountCredit: {
    color: "#106B4F",
  },
  receiptDescription: {
    color: "#7A8580",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
  },
  receiptDetails: {
    backgroundColor: "#F7FAF8",
    borderColor: "#DDE6E1",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    overflow: "hidden",
  },
  receiptRow: {
    borderBottomColor: "#E9EFEC",
    borderBottomWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  receiptRowLabel: {
    color: "#9EAAA5",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  receiptRowValue: {
    color: "#063B2E",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  receiptRowValueEmphasis: {
    color: "#106B4F",
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
