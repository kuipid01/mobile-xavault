import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";

import type { OnboardingSlide } from "./slides";

/** Width/height the illustration is rendered at inside a slide. */
const ILLUSTRATION_SIZE = 320;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type OnboardingSlideViewProps = {
  slide: OnboardingSlide;
};

/**
 * The content of a single onboarding slide: a centered illustration with
 * the slide's background color and its title underneath.
 *
 * Rendered as the item of the horizontal carousel in `OnboardingCarousel`.
 * Each view is pinned to the exact screen width — required for
 * `pagingEnabled` to snap one full slide per swipe (a plain `flex: 1`
 * collapses to intrinsic content width and shows slides side-by-side).
 */
export function OnboardingSlideView({ slide }: OnboardingSlideViewProps) {
  const Illustration = slide.Image;

  return (
    <View style={[styles.slide, { backgroundColor: slide.background }]}>
      <View style={styles.illustrationContainer}>
        <Illustration width={ILLUSTRATION_SIZE} height={ILLUSTRATION_SIZE} />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{slide.title}</Text>

        <View style={styles.rule} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 120,
  },

  illustrationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  textContainer: {
    marginBottom: 20,
  },

  title: {
    color: "#080A0C",
    fontFamily: "Lexend_700Bold",
    fontSize: 25,
    lineHeight: 31,
    maxWidth: 320,
  },

  rule: {
    width: 42,
    height: 2,
    backgroundColor: "#080A0C",
    marginTop: 18,
  },
});
