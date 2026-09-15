import { useOnboarding } from "@/context/OnboardingContext";
import { router } from "expo-router";
import React from "react";

import { OnboardingCarousel } from "./OnboardingCarousel";
import { OnboardingSplash } from "./OnboardingSplash";

/**
 * Orchestrates the first-time-user flow inside the `(onboarding)` route.
 *
 * Step map (state lives in `OnboardingContext`):
 *   splash     -> brand splash; tap anywhere to continue
 *   onboarding -> swipeable carousel; finishing navigates to `/(auth)/welcome`
 *
 * Anti-flicker note: the finish handler navigates FIRST, synchronously in
 * the tap handler, and only then persists/completes onboarding. Navigating
 * from an effect after `completeOnboarding()` resolved used to leave the
 * carousel unmounted/blank for a frame ("flicker to nothing") before the
 * welcome screen appeared.
 */
export function OnboardingFlow() {
  const { currentStep, completeOnboarding } = useOnboarding();

  /** Leave onboarding and hand off to the auth welcome screen. */
  const handleFinish = () => {
    // 1. Navigate immediately — the welcome screen starts mounting on tap.
    router.replace("/(auth)/welcome");

    // 2. Persist "seen onboarding" and flip state in the background.
    //    The root-layout redirect guard treats /(auth)/welcome as a valid
    //    destination, so this state change cannot bounce the user back.
    void completeOnboarding();
  };

  if (currentStep === "splash") return <OnboardingSplash />;

  return <OnboardingCarousel onFinish={handleFinish} />;
}
