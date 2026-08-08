import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useOnboarding } from "@/context/OnboardingContext";

const slides = [
  {
    icon: "wallet-outline" as const,
    background: "#F8C9A5",
    title: "Split your money before it slips away.",
  },
  {
    icon: "calendar-outline" as const,
    background: "#9DB9E8",
    title: "Lock savings until your plan is ready.",
  },
  {
    icon: "shield-checkmark-outline" as const,
    background: "#B7DFC3",
    title: "Withdraw securely when goals unlock.",
  },
];

export function OnboardingScreen() {
  const { setStep } = useOnboarding();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex];

  const finish = () => setStep("welcome");

  const goNext = () => {
    if (activeIndex === slides.length - 1) {
      finish();
      return;
    }

    setActiveIndex((current) => current + 1);
  };

  return (
    <View
      style={[styles.container, { backgroundColor: activeSlide.background }]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={activeSlide.icon} size={112} color="#080A0C" />
      </View>

      <View style={styles.footer}>
        <Text style={styles.title}>{activeSlide.title}</Text>
        <View style={styles.rule} />

        <View style={styles.actions}>
          <TouchableOpacity onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>

          <View style={styles.dots}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === activeIndex && styles.activeDot]}
              />
            ))}
          </View>

          <TouchableOpacity
            accessibilityLabel="Next onboarding slide"
            activeOpacity={0.85}
            onPress={goNext}
            style={styles.nextButton}
          >
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 34,
    paddingTop: 84,
  },

  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },

  footer: {
    gap: 18,
  },

  title: {
    color: "#080A0C",
    fontFamily: "Lexend_700Bold",
    fontSize: 23,
    lineHeight: 28,
    maxWidth: 270,
  },

  rule: {
    width: 42,
    height: 2,
    backgroundColor: "#080A0C",
  },

  actions: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },

  skip: {
    color: "#080A0C",
    fontFamily: "Lexend_700Bold",
    fontSize: 14,
  },

  dots: {
    flexDirection: "row",
    gap: 7,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(8, 10, 12, 0.35)",
  },

  activeDot: {
    backgroundColor: "#080A0C",
  },

  nextButton: {
    alignItems: "center",
    backgroundColor: "#080A0C",
    borderRadius: 999,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
