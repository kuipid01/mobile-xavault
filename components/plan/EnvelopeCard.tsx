import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "@/api/money";
import { Envelope } from "@/api/types";

type Props = {
    envelope: Envelope;
    inheritsPlanLock?: boolean;
    onPress?: () => void;
    onChildPress?: (envelope: Envelope) => void;
};

function isEnvelopeExhausted(envelope: Envelope) {
    return (envelope.amount || 0) > 0 && (envelope.unboxed_balance || 0) <= 0;
}

function spentRatioFor(envelope: Envelope) {
    const total = envelope.amount || 0;
    if (total <= 0) return 0;
    const committed =
        (envelope.allocated_to_children || 0) +
        (envelope.withdrawn_amount || 0) +
        (envelope.pending_withdrawal_amount || 0);
    return Math.min(committed / total, 1);
}

export function EnvelopeCard({ envelope, inheritsPlanLock = false, onPress, onChildPress }: Props) {
    const isLocked = envelope.unboxed_balance_policy !== "flexible";
    const isExhausted = isEnvelopeExhausted(envelope);
    const unboxed = envelope.unboxed_balance || 0;
    const spent = (envelope.withdrawn_amount || 0) + (envelope.pending_withdrawal_amount || 0);

    return (
        <Pressable onPress={onPress} style={styles.wrapper}>
            <View style={[styles.card, isExhausted && styles.cardExhausted]}>
                <View style={[styles.iconCircle, isExhausted && styles.iconCircleExhausted]}>
                    <Ionicons name="wallet-outline" size={22} color={isExhausted ? "#9AA5A1" : "#007A5A"} />
                </View>

                <View style={styles.content}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{envelope.name}</Text>

                        {isExhausted ? (
                            <View style={styles.exhaustedBadge}>
                                <Text style={styles.exhaustedBadgeText}>EXHAUSTED</Text>
                            </View>
                        ) : (
                            <View style={[styles.badge, isLocked ? styles.lockedBadge : styles.flexibleBadge]}>
                                <Text style={[styles.badgeText, isLocked ? styles.lockedText : styles.flexibleText]}>
                                    {inheritsPlanLock ? "PLAN LOCK" : isLocked ? "LOCKED" : "FLEXIBLE"}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.amountRow}>
                        <Text style={[styles.amount, isExhausted && styles.amountExhausted]}>
                            {formatMoney(envelope.amount)}
                        </Text>
                        <Text style={[styles.balance, isExhausted && styles.balanceExhausted]}>
                            Unboxed: {formatMoney(unboxed)}
                        </Text>
                    </View>

                    <View style={styles.progressTrack}>
                        <View
                            style={[
                                styles.progressFill,
                                isExhausted && styles.progressFillExhausted,
                                { width: `${Math.max(spentRatioFor(envelope) * 100, spent > 0 ? 6 : 0)}%` },
                            ]}
                        />
                    </View>

                    {spent > 0 ? (
                        <Text style={styles.spentLine}>Spent {formatMoney(spent)}</Text>
                    ) : null}
                </View>
            </View>

            {envelope.children?.length ? (
                <View style={styles.childrenWrap}>
                    <View style={styles.branchLine} />

                    <View style={styles.children}>
                        {envelope.children.map((child) => {
                            const childExhausted = isEnvelopeExhausted(child);

                            return (
                                <Pressable
                                    key={child.id}
                                    style={[styles.childCard, childExhausted && styles.childCardExhausted]}
                                    onPress={() => onChildPress?.(child)}
                                >
                                    <View style={[styles.childIcon, childExhausted && styles.childIconExhausted]}>
                                        <Ionicons name="cart-outline" size={16} color={childExhausted ? "#9CA3AF" : "#9CA3AF"} />
                                    </View>

                                    <View style={styles.childText}>
                                        <Text style={styles.childName}>{child.name}</Text>
                                        <Text style={styles.childMeta}>
                                            {childExhausted
                                                ? "Exhausted"
                                                : `Unboxed: ${formatMoney(child.unboxed_balance)}`}
                                        </Text>
                                    </View>

                                    <Text style={[styles.childAmount, childExhausted && styles.childAmountExhausted]}>
                                        {formatMoney(child.amount)}
                                    </Text>
                                </Pressable>
                            );
                        })}
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
    cardExhausted: {
        borderColor: "#E5E7EB",
        backgroundColor: "#FAFAFA",
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
    iconCircleExhausted: {
        backgroundColor: "#F3F4F6",
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
    exhaustedBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
    },
    exhaustedBadgeText: {
        fontSize: 9,
        fontWeight: "900",
        color: "#6B7280",
        letterSpacing: 0.5,
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
    amountExhausted: {
        color: "#9AA5A1",
    },
    balance: {
        color: "#007A5A",
        fontSize: 12,
        fontWeight: "800",
    },
    balanceExhausted: {
        color: "#9AA5A1",
    },
    progressTrack: {
        marginTop: 10,
        height: 5,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 999,
        backgroundColor: "#007A5A",
    },
    progressFillExhausted: {
        backgroundColor: "#9CA3AF",
    },
    spentLine: {
        marginTop: 6,
        color: "#6B7280",
        fontSize: 10,
        fontWeight: "700",
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
    childCardExhausted: {
        backgroundColor: "#F3F4F6",
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
    childIconExhausted: {
        backgroundColor: "#E5E7EB",
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
    childAmountExhausted: {
        color: "#9AA5A1",
    },
});
