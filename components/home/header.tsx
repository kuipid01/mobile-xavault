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
        colors={["#052B20", "#063B2E", "#0B4D3A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.dotGrid} pointerEvents="none">
          {Array.from({ length: 80 }).map((_, i) => (
            <View key={i} style={styles.dot} />
          ))}
        </View>

        <View style={styles.arcGlow} pointerEvents="none" />



        <View style={styles.balanceSection}>
          <View style={styles.balanceLabelRow}>
            <View style={styles.labelPill}>
              <View style={styles.labelDot} />
              <Text style={styles.heroLabel}>Vault Balance</Text>
            </View>

            <View style={styles.balanceActions}>
              <TouchableOpacity
                onPress={refreshWallet}
                activeOpacity={0.7}
                style={styles.iconButton}
              >
                <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.65)" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowBalance((prev) => !prev)}
                activeOpacity={0.7}
                style={styles.iconButton}
              >
                <Ionicons
                  name={showBalance ? "eye-outline" : "eye-off-outline"}
                  size={15}
                  color="rgba(255,255,255,0.65)"
                />
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.skeletonWrap}>
              <View style={styles.balanceSkeleton} />
              <View style={styles.balanceSkeletonSm} />
            </View>
          ) : (
            <View style={styles.balanceFigureWrap}>
              <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
                {showBalance ? balance : "NGN ********"}
              </Text>
              <Text style={styles.balanceHint}>
                Available for deposits, transfers and bills
              </Text>
            </View>
          )}

          <View style={styles.balanceDivider} />

          <View style={styles.statsRow}>
            <StatItem label="Available" value={showBalance ? balance : "Hidden"} />
            <View style={styles.statSep} />
            <StatItem label="Locked" value={showBalance ? lockedBalance : "Hidden"} />
            <View style={styles.statSep} />
            <StatItem label="Total" value={showBalance ? ledgerBalance : "Hidden"} />
          </View>
        </View>


      </LinearGradient>
      <LinearGradient
        colors={["#052B20", "#063B2E", "#0B4D3A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ ...styles.hero, ...{ marginVertical: 20, borderRadius: 22, } }}
      ><View style={{ ...styles.actionsWrap }}>
          <ActionButton text="Deposit" icon="add" onPress={onDeposit} />
          <ActionButton text="Withdraw" icon="paper-plane-outline" onPress={onWithdraw} />
          <ActionButton text="Pay Bills" icon="receipt-outline" />
          <ActionButton text="Lock" icon="lock-closed-outline" />
        </View></LinearGradient>

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
    borderRadius: 32,
    overflow: "hidden",
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 18,
    position: "relative",
    width: "100%",
  },
  dotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 11,
    height: 180,
    opacity: 0.13,
    padding: 16,
    position: "absolute",
    right: 0,
    top: 0,
    width: 210,
  },
  dot: {
    backgroundColor: "#FFFFFF",
    borderRadius: 1.5,
    height: 3,
    width: 3,
  },
  arcGlow: {
    backgroundColor: "rgba(88,255,190,0.07)",
    borderRadius: 120,
    bottom: -100,
    height: 240,
    left: -90,
    position: "absolute",
    width: 240,
  },
  balanceSection: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 26,
    borderWidth: 1,
    marginBottom: 20,
    marginTop: 24,
    overflow: "hidden",
    paddingBottom: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  balanceLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  labelPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  labelDot: {
    backgroundColor: "#58FFBE",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  balanceActions: {
    flexDirection: "row",
    gap: 7,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  balanceFigureWrap: {
    marginBottom: 18,
  },
  balance: {
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -1.8,
    marginBottom: 6,
  },
  balanceHint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  skeletonWrap: {
    gap: 10,
    marginBottom: 18,
  },
  balanceSkeleton: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    height: 46,
    width: "65%",
  },
  balanceSkeletonSm: {
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 6,
    height: 10,
    width: "42%",
  },
  balanceDivider: {
    backgroundColor: "rgba(255,255,255,0.08)",
    height: 1,
    marginHorizontal: -18,
  },
  statsRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: 14,
  },
  statItem: {
    alignItems: "flex-start",
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  statSep: {
    backgroundColor: "rgba(255,255,255,0.10)",
    height: 28,
    marginHorizontal: 8,
    width: 1,
  },
  statLabel: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statValue: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "800",
    maxWidth: "100%",
  },
  actionsWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
});
