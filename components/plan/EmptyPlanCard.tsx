import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
    onPress?: () => void;
};

export function EmptyPlanCard({ onPress }: Props) {
    return (
        <Pressable onPress={onPress} style={styles.card}>
            <View style={styles.circle}>
                <Ionicons name="add-circle-outline" size={28} color="#6B7280" />
            </View>

            <Text style={styles.title}>Planning for a new goal?</Text>

            <Text style={styles.description}>
                Create a structured plan to manage your cash flow and secure your future.
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#D1D5DB",
        backgroundColor: "#F7F8FD",
        borderRadius: 14,
        height: 260,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 38,
    },
    circle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#EEF1FF",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    title: {
        color: "#063B2E",
        fontSize: 20,
        fontWeight: "900",
        textAlign: "center",
        marginBottom: 12,
    },
    description: {
        color: "#6B7280",
        fontSize: 14,
        lineHeight: 20,
        textAlign: "center",
        fontWeight: "500",
    },
});