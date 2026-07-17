import { OnboardingScreen } from "@/components/OnboardingScreen";
import { SplashScreen } from "@/components/SplashScreen";
import { useOnboarding } from "@/context/OnboardingContext";
import { router } from "expo-router";
import { useEffect } from "react";

export default function OnboardingIndex() {
  const { currentStep, completeOnboarding } = useOnboarding();

  useEffect(() => {
    if (currentStep !== "welcome") return;

    const finish = async () => {
      await completeOnboarding();
      router.replace("/(auth)/welcome");
    };

    void finish();
  }, [completeOnboarding, currentStep]);

  if (currentStep === "splash") return <SplashScreen />;
  if (currentStep === "onboarding") return <OnboardingScreen />;

  return null;
}
