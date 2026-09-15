import { COLORS } from "@/themes/colors";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { clearRegistrationFlow } from "./auth/authFlow";
import { LogoWhiteBG } from "./general/logo";

export function WelcomeAuthScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{marginBottom:10}}>
         <LogoWhiteBG/>
        </View>
        <Text style={styles.logo}>XAVAULT</Text>

        <Text style={styles.title}>
          Money with somewhere to go.
        </Text>

        <Text style={styles.description}>
          Plan your salary. Protect your priorities. Build a vault that grows
          as fast as your ambitions.
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/register")}
          activeOpacity={0.9}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            router.push("/(auth)/login");
            void clearRegistrationFlow();
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Log In</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            BUILT FOR ALL. FOCUSED ON YOU.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },

  header: {
    alignItems: "center",
    marginTop: 20,
  },

  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: COLORS.tertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  logo: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 42,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 42,
    paddingHorizontal: 8,
  },

  description: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    paddingHorizontal: 24,
    lineHeight: 20,
  },

  actions: {
    width: "100%",
  },

  primaryButton: {
    width: "100%",
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.tertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  primaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },

  secondaryButton: {
    width: "100%",
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  footer: {
    alignItems: "center",
    paddingTop: 32,
  },

  footerText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
});
