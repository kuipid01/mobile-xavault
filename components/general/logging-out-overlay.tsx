import { BlurView } from "expo-blur";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function LoggingOutOverlay() {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
            <BlurView
                intensity={25}
                tint="light"
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <ActivityIndicator size="small" />

                    <Text style={styles.title}>
                        Signing out...
                    </Text>

                    <Text style={styles.subtitle}>
                        Securing your session
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.12)",
    },

    card: {
        minWidth: 180,
        alignItems: "center",
        paddingVertical: 20,
        paddingHorizontal: 24,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.95)",
    },

    title: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: "600",
    },

    subtitle: {
        marginTop: 4,
        fontSize: 13,
        opacity: 0.6,
    },
});