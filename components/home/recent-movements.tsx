import { formatMoney } from "@/api/money";
import { WalletLedger } from "@/api/types";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";

type Props = {
  items?: WalletLedger[];
  isLoading?: boolean;
  onDeposit?: () => void;
};

const getLedgerAmount = (item: WalletLedger) => item.amount ?? item.Amount ?? 0;
const getLedgerType = (item: WalletLedger) =>
  String(item.type ?? item.Type ?? "").toLowerCase();
const getLedgerDescription = (item: WalletLedger) =>
  item.description ??
  item.Description ??
  item.source ??
  item.Source ??
  "Wallet movement";
const getLedgerDate = (item: WalletLedger) =>
  item.created_at ?? item.CreatedAt ?? "";

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
  const displayItems = items.slice(0, 5);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Recent Movements</Text>
          <Text style={styles.sectionSubtitle}>Latest wallet activity.</Text>
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
              <MovementItem item={item} />
              {index < displayItems.length - 1 && <View style={styles.divider} />}
            </View>
          ))
        )}
      </View>
    </View>
  );
};

export default RecentMovements;

const MovementItem = ({ item }: { item: WalletLedger }) => {
  const type = getLedgerType(item);
  const amount = getLedgerAmount(item);
  const isCredit = type === "credit" || amount > 0;
  const dateStr = formatDate(getLedgerDate(item));
  const ref = item.reference;

  const showDetails = () => {
    Alert.alert(
      isCredit ? "Credit received" : "Debit sent",
      [
        getLedgerDescription(item),
        dateStr ? `Date: ${dateStr}` : null,
        `Amount: ${isCredit ? "+" : "-"}${formatMoney(Math.abs(amount))}`,
        ref ? `Reference: ${ref}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      ref
        ? [
            { text: "Close", style: "cancel" },
            {
              text: "Copy ref",
              onPress: async () => {
                await Clipboard.setStringAsync(ref);
                Toast.show({
                  type: "success",
                  text1: "Reference copied",
                  text2: ref,
                });
              },
            },
          ]
        : [{ text: "Close", style: "cancel" }]
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={showDetails}
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
});
