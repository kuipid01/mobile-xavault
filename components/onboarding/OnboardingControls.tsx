import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ProgressDots } from "@/components/ProgressDots";

type OnboardingControlsProps = {
  /** Zero-based index of the slide currently in view. */
  activeIndex: number;
  /** Total number of slides, used for the progress dots. */
  slideCount: number;
  /** Whether the user is on the last slide (swaps arrow for "Get Started"). */
  isLastSlide: boolean;
  /** Called when the user taps "Skip". */
  onSkip: () => void;
  /** Called when the user taps the arrow / "Get Started". */
  onNext: () => void;
};

/**
 * Bottom action bar of the onboarding carousel: Skip on the left,
 * progress dots in the middle, and Next (or "Get Started" on the last
 * slide) on the right.
 *
 * Purely presentational — the parent owns the slide index and what
 * "next"/"skip" actually do.
 */
export function OnboardingControls({
  activeIndex,
  slideCount,
  isLastSlide,
  onSkip,
  onNext,
}: OnboardingControlsProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onSkip} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ProgressDots activeIndex={activeIndex} count={slideCount} />

      <TouchableOpacity
        onPress={onNext}
        activeOpacity={0.8}
        style={styles.nextButton}
      >
        {isLastSlide ? (
          // Expands the circular arrow button into a pill on the last slide.
          <Text style={styles.getStartedText}>Get Started</Text>
        ) : (
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#FFFFFF"
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 34,
    left: 24,
    right: 24,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  skipText: {
    color: "#080A0C",
    fontFamily: "Lexend_700Bold",
    fontSize: 14,
  },

  nextButton: {
    height: 46,
    minWidth: 46,
    borderRadius: 23,
    paddingHorizontal: 16,

    backgroundColor: "#080A0C",

    alignItems: "center",
    justifyContent: "center",
  },

  getStartedText: {
    color: "#FFFFFF",
    fontFamily: "Lexend_700Bold",
    fontSize: 12,
  },
});
