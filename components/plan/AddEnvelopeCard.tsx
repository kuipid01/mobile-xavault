import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
    onPress?: () => void;
};

export function AddEnvelopeCard({ onPress }: Props) {
    return (
        <Pressable onPress={onPress} style={styles.card}>
            <View style={styles.plus}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>

            <Text style={styles.title}>Add Envelope</Text>
            <Text style={styles.subtitle}>Partition your plan further</Text>
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
    plus: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: "#003C2F",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
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