import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useOnboarding } from "@/context/OnboardingContext";
import { COLORS } from "@/themes/colors";

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
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔒</Text>
        </View>

        <Text style={styles.title}>XAVAULT</Text>

        <Text style={styles.subtitle}>
          Salary planning, simplified.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.securityText}>
          🛡️ Institutional Grade Security
        </Text>

        <Text style={styles.copyright}>
          © 2026 XAVAULT FINANCIAL TECHNOLOGY
        </Text>
      </View>
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
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
  },

  subtitle: {
    color: "rgba(0, 194, 140, 0.7)",
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 1,
    fontWeight: "500",
  },

  footer: {
    alignItems: "center",
  },

  securityText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  copyright: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 9,
    marginTop: 4,
  },
});
