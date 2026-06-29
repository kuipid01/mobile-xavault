import { formatMoney } from "@/api/money";
import { Wallet } from "@/api/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ActionButton from "../general/button";
import ProfileHeader from "./ProfileHeader";

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

    const balance = formatMoney(
        wallet?.available_balance || 0,
        wallet?.currency
    );

    return (
        <LinearGradient
            colors={["#052B20", "#063B2E", "#0B4D3A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
        >
            {/* Dot-grid texture — top right */}
            <View style={styles.dotGrid} pointerEvents="none">
                {Array.from({ length: 80 }).map((_, i) => (
                    <View key={i} style={styles.dot} />
                ))}
            </View>

            {/* Mint arc glow — bottom left */}
            <View style={styles.arcGlow} pointerEvents="none" />

            {/* ── Profile row ── */}
            <ProfileHeader />

            {/* ── Balance section ── */}
            <View style={styles.balanceSection}>
                {/* Label + actions */}
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
                            <Ionicons
                                name="refresh"
                                size={15}
                                color="rgba(255,255,255,0.65)"
                            />
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

                {/* Balance figure */}
                {isLoading ? (
                    <View style={styles.skeletonWrap}>
                        <View style={styles.balanceSkeleton} />
                        <View style={styles.balanceSkeletonSm} />
                    </View>
                ) : (
                    <View style={styles.balanceFigureWrap}>
                        <Text
                            style={styles.balance}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                        >
                            {showBalance ? balance : "₦ ••••••••"}
                        </Text>
                        <Text style={styles.balanceHint}>
                            Available · deposits, transfers &amp; bills
                        </Text>
                    </View>
                )}

                {/* Divider */}
                <View style={styles.balanceDivider} />

                {/* Mini stats row */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Currency</Text>
                        <Text style={styles.statValue}>
                            {wallet?.currency ?? "NGN"}
                        </Text>
                    </View>

                    <View style={styles.statSep} />

                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Status</Text>
                        <View style={styles.statStatusRow}>
                            <View style={styles.statStatusDot} />
                            <Text style={[styles.statValue, styles.statValueGreen]}>
                                Active
                            </Text>
                        </View>
                    </View>

                    {/* <View style={styles.statSep} /> */}

                    {/* <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Account</Text>
                        <Text style={styles.statValue}>
                            {wallet?.account_number
                                ? `••${String(wallet.account_number).slice(-4)}`
                                : "—"}
                        </Text>
                    </View> */}
                </View>
            </View>

            {/* ── Quick actions ── */}
            <View style={styles.actionsWrap}>
                <ActionButton text="Deposit" icon="add" onPress={onDeposit} />
                <ActionButton text="Withdraw" icon="paper-plane-outline" onPress={onWithdraw} />
                <ActionButton text="Pay Bills" icon="receipt-outline" />
                <ActionButton text="Lock" icon="lock-closed-outline" />
            </View>
        </LinearGradient>
    );
};

export default HomeScreenHeader;

const styles = StyleSheet.create({
    hero: {
        width: "100%",
        borderRadius: 32,
        paddingTop: 18,
        paddingHorizontal: 18,
        paddingBottom: 20,
        overflow: "hidden",
        position: "relative",
    },

    // ── Texture / atmosphere ──

    dotGrid: {
        position: "absolute",
        top: 0,
        right: 0,
        width: 210,
        height: 180,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 11,
        padding: 16,
        opacity: 0.13,
    },

    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: "#FFFFFF",
    },

    arcGlow: {
        position: "absolute",
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: "rgba(88,255,190,0.07)",
        bottom: -100,
        left: -90,
    },

    // ── Balance section ──

    balanceSection: {
        marginTop: 24,
        marginBottom: 20,
        borderRadius: 26,
        backgroundColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        paddingTop: 16,
        paddingHorizontal: 18,
        paddingBottom: 0,
        overflow: "hidden",
    },

    balanceLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },

    labelPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.07)",
    },

    labelDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#58FFBE",
    },

    heroLabel: {
        color: "rgba(255,255,255,0.65)",
        fontSize: 11,
        fontWeight: "800",
        textTransform: "uppercase",
        letterSpacing: 0.7,
    },

    balanceActions: {
        flexDirection: "row",
        gap: 7,
    },

    iconButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: "rgba(255,255,255,0.09)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },

    // Balance figure

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

    // Skeleton

    skeletonWrap: {
        gap: 10,
        marginBottom: 18,
    },

    balanceSkeleton: {
        width: "65%",
        height: 46,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.16)",
    },

    balanceSkeletonSm: {
        width: "42%",
        height: 10,
        borderRadius: 6,
        backgroundColor: "rgba(255,255,255,0.09)",
    },

    // Divider inside card

    balanceDivider: {
        height: 1,
        backgroundColor: "rgba(255,255,255,0.08)",
        marginHorizontal: -18,
    },

    // Mini stats

    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
    },

    statItem: {
        flex: 1,
        gap: 4,
        alignItems: "flex-start",
    },

    statSep: {
        width: 1,
        height: 28,
        backgroundColor: "rgba(255,255,255,0.10)",
        marginHorizontal: 10,
    },

    statLabel: {
        color: "rgba(255,255,255,0.38)",
        fontSize: 10,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },

    statValue: {
        color: "rgba(255,255,255,0.78)",
        fontSize: 13,
        fontWeight: "800",
    },

    statStatusRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },

    statStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#58FFBE",
    },

    statValueGreen: {
        color: "#58FFBE",
    },

    // ── Actions row ──

    actionsWrap: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
    },
});
