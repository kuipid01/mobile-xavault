import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "@/api/money";
import { Envelope } from "@/api/types";

type Props = {
    envelope: Envelope;
    inheritsPlanLock?: boolean;
    onPress?: () => void;
};

export function EnvelopeCard({ envelope, inheritsPlanLock = false, onPress }: Props) {
    const isLocked = envelope.unboxed_balance_policy !== "flexible";

    return (
        <Pressable onPress={onPress} style={styles.wrapper}>
            <View style={styles.card}>
                <View style={styles.iconCircle}>
                    <Ionicons name="wallet-outline" size={22} color="#007A5A" />
                </View>

                <View style={styles.content}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{envelope.name}</Text>

                        <View style={[styles.badge, isLocked ? styles.lockedBadge : styles.flexibleBadge]}>
                            <Text style={[styles.badgeText, isLocked ? styles.lockedText : styles.flexibleText]}>
                                {inheritsPlanLock ? "PLAN LOCK" : isLocked ? "LOCKED" : "FLEXIBLE"}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.amountRow}>
                        <Text style={styles.amount}>{formatMoney(envelope.amount)}</Text>
                        <Text style={styles.balance}>Unboxed: {formatMoney(envelope.unboxed_balance)}</Text>
                    </View>
                </View>
            </View>

            {envelope.children?.length ? (
                <View style={styles.childrenWrap}>
                    <View style={styles.branchLine} />

                    <View style={styles.children}>
                        {envelope.children.map((child) => (
                            <Pressable key={child.id} style={styles.childCard}>
                                <View style={styles.childIcon}>
                                    <Ionicons name="cart-outline" size={16} color="#9CA3AF" />
                                </View>

                                <View style={styles.childText}>
                                    <Text style={styles.childName}>{child.name}</Text>
                                    <Text style={styles.childMeta}>Unboxed: {formatMoney(child.unboxed_balance)}</Text>
                                </View>

                                <Text style={styles.childAmount}>{formatMoney(child.amount)}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 18,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 14,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#E7ECE9",
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "#E1FFF1",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    nameRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    name: {
        color: "#063B2E",
        fontSize: 17,
        fontWeight: "900",
        flex: 1,
        marginRight: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    lockedBadge: {
        backgroundColor: "#003C2F",
    },
    flexibleBadge: {
        backgroundColor: "#A7F3D0",
    },
    badgeText: {
        fontSize: 9,
        fontWeight: "900",
    },
    lockedText: {
        color: "#FFFFFF",
    },
    flexibleText: {
        color: "#007A5A",
    },
    amountRow: {
        marginTop: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },
    amount: {
        color: "#063B2E",
        fontSize: 13,
        fontWeight: "700",
    },
    balance: {
        color: "#007A5A",
        fontSize: 12,
        fontWeight: "800",
    },
    childrenWrap: {
        marginLeft: 42,
        flexDirection: "row",
    },
    branchLine: {
        width: 2,
        backgroundColor: "#E5E7EB",
        marginRight: 16,
    },
    children: {
        flex: 1,
        paddingTop: 12,
        gap: 10,
    },
    childCard: {
        backgroundColor: "#F7F8FD",
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
    },
    childIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    childText: {
        flex: 1,
    },
    childName: {
        color: "#063B2E",
        fontSize: 13,
        fontWeight: "900",
    },
    childMeta: {
        marginTop: 3,
        color: "#6B7280",
        fontSize: 10,
        fontWeight: "600",
    },
    childAmount: {
        color: "#063B2E",
        fontSize: 12,
        fontWeight: "900",
    },
});
