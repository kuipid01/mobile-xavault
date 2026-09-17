import { formatMoney } from "@/api/money";
import { Wallet } from "@/api/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ActionButton from "../general/button";

interface Props {
  onDeposit: () => void;
  onWithdraw: () => void;
  wallet?: Wallet;
  isLoading?: boolean;
  refreshWallet: () => void;
}

const HomeScreenHeader = ({
  onDeposit,
  onWithdraw,
  wallet,
  isLoading,
  refreshWallet,
}: Props) => {
  const [showBalance, setShowBalance] = useState(true);

  const balance = formatMoney(wallet?.available_balance || 0, wallet?.currency);
  const lockedBalance = formatMoney(wallet?.locked_balance || 0, wallet?.currency);
  const ledgerBalance = formatMoney(wallet?.ledger_balance || 0, wallet?.currency);

  return (
    <View>
      <LinearGradient
        colors={["#08312A", "#063B2E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.topRow}>
          <Text style={styles.heroLabel}>Vault Balance</Text>

          <View style={styles.iconRow}>
            <TouchableOpacity
              onPress={refreshWallet}
              activeOpacity={0.6}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowBalance((prev) => !prev)}
              activeOpacity={0.6}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Ionicons
                name={showBalance ? "eye-outline" : "eye-off-outline"}
                size={16}
                color="rgba(255,255,255,0.55)"
              />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.skeletonWrap}>
            <View style={styles.balanceSkeleton} />
          </View>
        ) : (
          <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
            {showBalance ? balance : "•••••••"}
          </Text>
        )}

        <View style={styles.statsRow}>
          <StatItem label="Available" value={showBalance ? balance : "Hidden"} />
          <StatItem label="Locked" value={showBalance ? lockedBalance : "Hidden"} />
          <StatItem label="Total" value={showBalance ? ledgerBalance : "Hidden"} />
        </View>
      </LinearGradient>

      <View style={styles.actionsWrap}>
        <ActionButton text="Deposit" icon="add" onPress={onDeposit} />
        <ActionButton text="Withdraw" icon="paper-plane-outline" onPress={onWithdraw} />
        <ActionButton text="Pay Bills" icon="receipt-outline" />
        <ActionButton text="Lock" icon="lock-closed-outline" />
      </View>
    </View>
  );
};

export default HomeScreenHeader;

const StatItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.statItem}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  hero: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
    width: "100%",
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  iconRow: {
    flexDirection: "row",
    gap: 4,
  },
  iconButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  balance: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "700",
    letterSpacing: -1.2,
    marginTop: 14,
    marginBottom: 26,
  },
  skeletonWrap: {
    marginTop: 14,
    marginBottom: 26,
  },
  balanceSkeleton: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    height: 42,
    width: "55%",
  },
  statsRow: {
    borderTopColor: "rgba(255,255,255,0.08)",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: 18,
  },
  statItem: {
    flex: 1,
    gap: 5,
  },
  statLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  statValue: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
  },
  actionsWrap: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 16,
  },
});