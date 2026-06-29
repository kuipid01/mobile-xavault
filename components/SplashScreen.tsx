import { useOnboarding } from "@/context/OnboardingContext";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function SplashScreen() {
  const { setStep } = useOnboarding();

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => setStep("onboarding")}
      style={styles.container}
    >
      <View />

      <View style={styles.centerContent}>
        <View>
          <Ionicons
            style={{
              fontSize: 100,
              color: "white",
              marginBottom: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
            name="wallet-sharp"
          />
        </View>
        <Text style={styles.title}>XAVAULT</Text>
      </View>
      <View />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  centerContent: {
    alignItems: "center",
  },

  iconContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 194, 140, 0.3)",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(0, 194, 140, 0.2)",
  },

  icon: {
    fontSize: 36,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 46,
    fontFamily: "PlayfairDisplay_700Bold",
    letterSpacing: 1,
    textAlign: "center",
  },

  subtitle: {
    color: "rgba(0, 194, 140, 0.7)",
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 1,
    fontFamily: "PlayfairDisplay_500Medium",
  },

  footer: {
    alignItems: "center",
  },

  securityText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    letterSpacing: 2,
    fontFamily: "PlayfairDisplay_700Bold",
    textTransform: "uppercase",
  },

  copyright: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 9,
    marginTop: 4,
    fontFamily: "PlayfairDisplay_400Regular",
  },
});
