import { formatMoney } from "@/api/money";
import { WalletLedger } from "@/api/types";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  items?: WalletLedger[];
  isLoading?: boolean;
};

const getLedgerAmount = (item: WalletLedger) =>
  item.amount ?? item.Amount ?? 0;
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

const RecentMovements = ({ items = [], isLoading }: Props) => {
  const displayItems = items.slice(0, 5);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Recent Movements</Text>
          <Text style={styles.sectionSubtitle}>Latest wallet activity.</Text>
        </View>
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
          </View>
        ) : (
          displayItems.map((item, index) => (
            <View key={item.id || item.reference}>
              <MovementItem item={item} />
              {index < displayItems.length - 1 && (
                <View style={styles.divider} />
              )}
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

  return (
    <View style={styles.item}>
      <View
        style={[
          styles.iconBox,
          isCredit ? styles.iconBoxCredit : styles.iconBoxDebit,
        ]}
      >
        <Ionicons
          name={
            isCredit
              ? "arrow-down-outline"
              : "arrow-up-outline"
          }
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
          {isCredit ? "+" : "−"}
          {formatMoney(Math.abs(amount))}
        </Text>
        <Text style={styles.typeLabel}>{isCredit ? "Credit" : "Debit"}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginTop: 30,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -0.3,
  },

  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9EAAA5",
    marginTop: 2,
  },

  // ── Card wrapper ──

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    overflow: "hidden",
    shadowColor: "#063B2E",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  divider: {
    height: 1,
    backgroundColor: "#F0F4F2",
    marginHorizontal: 16,
  },

  // ── Movement item ──

  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 14,
    fontWeight: "700",
    color: "#063B2E",
    letterSpacing: -0.1,
  },

  meta: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9EAAA5",
  },

  amountCol: {
    alignItems: "flex-end",
    gap: 2,
  },

  amount: {
    fontSize: 14,
    fontWeight: "900",
    color: "#063B2E",
    letterSpacing: -0.3,
  },

  amountCredit: {
    color: "#106B4F",
  },

  typeLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9EAAA5",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // ── Skeleton ──

  stateWrap: {
    padding: 16,
    gap: 14,
  },

  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  skeletonIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#EDF1EE",
  },

  skeletonLines: {
    flex: 1,
    gap: 7,
  },

  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EDF1EE",
    width: "65%",
  },

  skeletonLineSm: {
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EDF1EE",
    width: "40%",
  },

  skeletonAmount: {
    width: 64,
    height: 14,
    borderRadius: 6,
    backgroundColor: "#EDF1EE",
  },

  // ── Empty ──

  emptyIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#EAF3EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#DDE6E1",
    alignSelf: "center",
  },

  emptyTitle: {
    color: "#063B2E",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  emptyText: {
    color: "#9EAAA5",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 220,
    alignSelf: "center",
  },
});