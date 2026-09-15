import Pigs from "@/assets/images/pg.svg";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../themes/colors";
import { clearRegistrationFlow } from "./authFlow";

// Map layout configuration for floating background elements cleanly
const PIG_BACKGROUNDS = [
    { top: 60, left: 30 },
    { top: 20, right: 30 },
    { top: 240, right: 30 },
    { top: 300, left: 30 },
    { bottom: 210, left: 30 },
    { bottom: 110, right: 30 },
    { bottom: 60, left: 30 },
];

const IndexScreen = () => {
    return (
        <View style={styles.container}>
            {/* Floating Background Icons */}
            {PIG_BACKGROUNDS.map((position, index) => (
                <Pigs
                    key={index}
                    width={42}
                    height={42}
                    style={[styles.pig, position]}
                />
            ))}

            {/* Brand Header */}
            <Text style={styles.brand}>xavault</Text>

            {/* Center Copy */}
            <View style={styles.centerTextView}>
                <Text style={styles.headerText}>Save with purpose and grow.</Text>

                <Text style={styles.subheaderText}>
                    Save smarter, budget better, and master your spending.{"\n"}
                    Xavault helps you stay in control.
                </Text>
            </View>

            {/* Action CTA Buttons */}
            <View style={styles.bottomView}>
                <TouchableOpacity
                    onPress={() => {
                        router.replace("/(auth)/login");
                        void clearRegistrationFlow();
                    }}
                    style={styles.loginButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.loginText}>Login</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => router.replace("/(auth)/register")}
                    style={styles.signupButton}
                    activeOpacity={0.8}
                >
                    <Text style={styles.signupText}>Sign Up</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default IndexScreen;

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.primary,
        flex: 1,
        justifyContent: "space-between",
        paddingHorizontal: 24,
        paddingVertical: 50,
        position: "relative",
    },
    pig: {
        position: "absolute",
        opacity: 0.15,
    },
    brand: {
        fontSize: 30,
        fontWeight: "900",
        color: "white",
        textAlign: "center",
        letterSpacing: -0.5,
        marginTop: 10
    },
    centerTextView: {
        alignItems: "center",
        gap: 16,
        zIndex: 10, // Keeps copy above backgrounds
    },
    headerText: {
        fontSize: 38,
        fontWeight: "900",
        color: "white",
        textAlign: "center",
        lineHeight: 44,
        letterSpacing: -0.5,
    },
    subheaderText: {
        fontSize: 16,
        color: "rgba(255,255,255,0.75)",
        textAlign: "center",
        lineHeight: 24,
        maxWidth: 320,
    },
    bottomView: {
        gap: 12,
        flexDirection: "row",
        zIndex: 10,
    },
    loginButton: {
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: "white",
        flex: 1,
        justifyContent: "center",
    },
    signupButton: {
        paddingVertical: 16,
        borderRadius: 12,
        backgroundColor: "white",
        flex: 1,
        justifyContent: "center",
    },
    loginText: {
        textAlign: "center",
        fontSize: 16,
        fontWeight: "700",
        color: "white",
    },
    signupText: {
        textAlign: "center",
        fontSize: 16,
        fontWeight: "700",
        color: COLORS.primary,
    },
});
