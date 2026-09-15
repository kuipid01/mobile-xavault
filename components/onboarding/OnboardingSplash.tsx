import { useOnboarding } from "@/context/OnboardingContext";
import { COLORS } from "@/themes/colors";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { LogoWhiteBG } from "../general/logo";

/**
 * Full-screen splash shown before the onboarding carousel.
 *
 * Tapping anywhere advances to the carousel step. (The app's root layout
 * shows its own loading screen while AsyncStorage is checked, so this
 * screen is purely the "brand moment" for first-time users.)
 */
export function OnboardingSplash() {
  const { setStep } = useOnboarding();

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => setStep("onboarding")}
      style={styles.container}
    >
      <View />

      <View style={styles.centerContent}>
        <LogoWhiteBG />
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

  title: {
    color: "#FFFFFF",
    fontSize: 46,
    fontFamily: "Lexend_700Bold",
    letterSpacing: 1,
    textAlign: "center",
  },
});
