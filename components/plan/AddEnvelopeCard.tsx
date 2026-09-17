import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "@/api/money";

type Props = {
    onPress?: () => void;
    allocatable?: number;
    currency?: string;
};

export function AddEnvelopeCard({ onPress, allocatable, currency }: Props) {
    // allocatable is undefined when the plan has no withdrawal data yet —
    // keep the card active in that case and let the server be the authority.
    const hasAllocatable = typeof allocatable === "number";
    const nothingAllocatable = hasAllocatable && allocatable <= 0;

    if (nothingAllocatable) {
        return (
            <View style={[styles.card, styles.cardDisabled]}>
                <View style={[styles.plus, styles.plusDisabled]}>
                    <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.title}>All funds paid out</Text>
                <Text style={styles.subtitle}>
                    Nothing left in this plan to allocate to envelopes.
                </Text>
            </View>
        );
    }

    return (
        <Pressable onPress={onPress} style={styles.card}>
            <View style={styles.plus}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>

            <Text style={styles.title}>Add Envelope</Text>
            <Text style={styles.subtitle}>
                {hasAllocatable
                    ? `Up to ${formatMoney(allocatable, currency)} allocatable`
                    : "Partition your plan further"}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        marginTop: 22,
        height: 190,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#D1D5DB",
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
    },
    cardDisabled: {
        borderColor: "#E5E7EB",
        backgroundColor: "#FAFAFA",
        borderStyle: "solid",
    },
    plus: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "#003C2F",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    plusDisabled: {
        backgroundColor: "#9CA3AF",
    },
    title: {
        color: "#063B2E",
        fontSize: 20,
        fontWeight: "900",
    },
    subtitle: {
        marginTop: 6,
        color: "#6B7280",
        fontSize: 13,
        fontWeight: "500",
    },
});
